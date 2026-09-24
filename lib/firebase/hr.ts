import { where, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, listByCompanySorted, getDocById, createDoc, updateDocById, deleteDocById, setDocById, listDocs } from './firestore';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import { resolvePostingRule, codeFor } from './posting-rules';
import { DEFAULT_TAX_CONFIG, calcPayrollLine } from '@/lib/payroll/tax';
import { fireWorkflows } from '@/lib/workflow/engine';
import type {
  Employee, LeaveType, LeaveRequest, LeaveBalance, LeaveBalanceItem, PayrollRun, PayrollLine,
  PayrollTaxConfig, PayrollAdjustment, TimePermission, BusinessTrip, MonthlyTimesheet,
  HROrder, HROrderType, ServiceContract, TerminationReason, LocalizedText,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);

// ── İşçilər ──────────────────────────────────────────────────
export const listEmployees = (companyId: string) => listByCompany<Employee>('employees', companyId);
export const getEmployee = (id: string) => getDocById<Employee>('employees', id);
export async function createEmployee(d: Omit<Employee, 'id'>): Promise<string> {
  const id = await createDoc('employees', d as Record<string, unknown>);
  // Onboarding workflow (on_create) — 10 §2.1 / 04 §7.2
  await fireWorkflows(d.companyId, 'employees', 'on_create', { id, ...d } as Record<string, unknown>, id, d.createdBy ?? null);
  return id;
}
export const updateEmployee = (id: string, d: Partial<Employee>) => updateDocById('employees', id, d as Record<string, unknown>);

// ── Məzuniyyət növləri (Əmək Məcəlləsi minimumları, 10 §4.1) ──
const L = (az: string, en: string): LocalizedText => ({ az, en });
export const DEFAULT_LEAVE_TYPES: Omit<LeaveType, 'id' | 'companyId'>[] = [
  { code: 'annual', name: L('Əsas məzuniyyət', 'Annual leave'), paid: true, defaultDays: 21 },
  { code: 'additional', name: L('Əlavə məzuniyyət', 'Additional leave'), paid: true, defaultDays: 0 },
  { code: 'sick', name: L('Xəstəlik vərəqəsi', 'Sick leave'), paid: true, defaultDays: 0 },
  { code: 'maternity', name: L('Hamiləlik və doğuş', 'Maternity'), paid: true, defaultDays: 126 },
  { code: 'unpaid', name: L('Ödənişsiz məzuniyyət', 'Unpaid leave'), paid: false, defaultDays: 0 },
  { code: 'other', name: L('Digər', 'Other'), paid: false, defaultDays: 0 },
];

export async function listLeaveTypes(companyId: string): Promise<LeaveType[]> {
  const existing = await listByCompany<LeaveType>('leaveTypes', companyId);
  return existing;
}
export async function seedLeaveTypes(companyId: string): Promise<void> {
  const existing = await listByCompany<LeaveType>('leaveTypes', companyId);
  if (existing.length > 0) return;
  for (const t of DEFAULT_LEAVE_TYPES) await createDoc('leaveTypes', { companyId, ...t });
}

// ── Məzuniyyət tələbləri (10 §4.3) ──────────────────────────
export const listLeaveRequests = (companyId: string) => listByCompanySorted<LeaveRequest>('leaveRequests', companyId, 'createdAt', 'desc');

export async function createLeaveRequest(d: Omit<LeaveRequest, 'id' | 'status'>): Promise<string> {
  const id = await createDoc('leaveRequests', { ...d, status: 'pending' } as Record<string, unknown>);
  // Məzuniyyət təsdiqi workflow (on_create) — 10 §4.3 / 04 §7.2
  await fireWorkflows(d.companyId, 'leaveRequests', 'on_create', { id, ...d, status: 'pending' } as Record<string, unknown>, id, d.createdBy ?? null);
  return id;
}

export async function decideLeaveRequest(req: LeaveRequest, approve: boolean, actorUid: string): Promise<void> {
  await updateDocById('leaveRequests', req.id, { status: approve ? 'approved' : 'rejected' });
  // Təsdiqləndikdə balansdan çıxılır (10 §4.3)
  if (approve) {
    const year = new Date(req.startDate).getFullYear();
    await applyLeaveUsage(req.companyId, req.employeeId, req.employeeName ?? '', year, req.leaveTypeId, req.leaveTypeName ?? '', req.totalDays);
  }
  await logAudit({ companyId: req.companyId, userId: actorUid, action: approve ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', entityType: 'leaveRequest', entityId: req.id });
}

export function pendingLeaveCount(requests: LeaveRequest[]): number {
  return requests.filter((r) => r.status === 'pending').length;
}

// ── Məzuniyyət balansları (10 §4.2) ─────────────────────────
const balanceId = (employeeId: string, year: number) => `${employeeId}_${year}`;
export const listLeaveBalances = (companyId: string) => listByCompany<LeaveBalance>('leaveBalances', companyId);
export const getLeaveBalance = (employeeId: string, year: number) => getDocById<LeaveBalance>('leaveBalances', balanceId(employeeId, year));

/** İlin əvvəlində/işə qəbulda balansı qur (əvvəlki ilin qalığı 2 illik məhdudiyyətlə köçürülür) */
export async function ensureLeaveBalance(companyId: string, emp: Employee, year: number, types: LeaveType[]): Promise<LeaveBalance> {
  const existing = await getLeaveBalance(emp.id, year);
  const prev = await getLeaveBalance(emp.id, year - 1);
  const items: LeaveBalanceItem[] = types.filter((t) => t.paid).map((t) => {
    const cur = existing?.balances.find((b) => b.leaveTypeId === t.id);
    const prevItem = prev?.balances.find((b) => b.leaveTypeId === t.id);
    // 2 illik daşınma məhdudiyyəti: yalnız 1 il əvvəlin qalığı köçür
    const carriedOver = t.code === 'annual' ? Math.min(prevItem?.remainingDays ?? 0, t.defaultDays) : 0;
    const entitled = (t.defaultDays ?? 0) + carriedOver;
    const used = cur?.usedDays ?? 0;
    return { leaveTypeId: t.id, leaveTypeName: t.name.az, entitledDays: entitled, usedDays: used, remainingDays: round2(entitled - used), carriedOver };
  });
  const bal: Omit<LeaveBalance, 'id'> = { companyId, employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`, year, balances: items };
  await setDocById('leaveBalances', balanceId(emp.id, year), bal as Record<string, unknown>);
  return { id: balanceId(emp.id, year), ...bal };
}

/** Bütün aktiv işçilər üçün seçilmiş il balansını yenidən qur */
export async function rebuildLeaveBalances(companyId: string, year: number): Promise<number> {
  const [emps, types] = await Promise.all([listEmployees(companyId), listLeaveTypes(companyId)]);
  const active = emps.filter((e) => e.status !== 'terminated');
  for (const e of active) await ensureLeaveBalance(companyId, e, year, types);
  return active.length;
}

/** Təsdiqlənən məzuniyyət günlərini balansa yaz */
async function applyLeaveUsage(companyId: string, employeeId: string, employeeName: string, year: number, leaveTypeId: string, leaveTypeName: string, days: number): Promise<void> {
  const cur = await getLeaveBalance(employeeId, year);
  const items = cur?.balances ? [...cur.balances] : [];
  const idx = items.findIndex((b) => b.leaveTypeId === leaveTypeId);
  if (idx >= 0) {
    const used = round2(items[idx].usedDays + days);
    items[idx] = { ...items[idx], usedDays: used, remainingDays: round2(items[idx].entitledDays - used) };
  } else {
    items.push({ leaveTypeId, leaveTypeName, entitledDays: 0, usedDays: days, remainingDays: -days, carriedOver: 0 });
  }
  await setDocById('leaveBalances', balanceId(employeeId, year), { companyId, employeeId, employeeName, year, balances: items } as Record<string, unknown>);
}

export const upsertLeaveType = (companyId: string, t: Omit<LeaveType, 'id' | 'companyId'>) => createDoc('leaveTypes', { companyId, ...t } as Record<string, unknown>);
export const updateLeaveType = (id: string, d: Partial<LeaveType>) => updateDocById('leaveTypes', id, d as Record<string, unknown>);
export const deleteLeaveType = (id: string) => deleteDocById('leaveTypes', id);

// ── Saatlıq icazə (time permissions) ────────────────────────
export const listTimePermissions = (companyId: string) => listByCompanySorted<TimePermission>('timePermissions', companyId, 'createdAt', 'desc');
export const createTimePermission = (d: Omit<TimePermission, 'id' | 'status'>) => createDoc('timePermissions', { ...d, status: 'pending' } as Record<string, unknown>);
export async function decideTimePermission(p: TimePermission, approve: boolean, actorUid: string): Promise<void> {
  await updateDocById('timePermissions', p.id, { status: approve ? 'approved' : 'rejected' });
  await logAudit({ companyId: p.companyId, userId: actorUid, action: approve ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED', entityType: 'timePermission', entityId: p.id });
}

// ── Ezamiyyət (business trips) ──────────────────────────────
export const listBusinessTrips = (companyId: string) => listByCompanySorted<BusinessTrip>('businessTrips', companyId, 'createdAt', 'desc');
export const createBusinessTrip = (d: Omit<BusinessTrip, 'id' | 'status'>) => createDoc('businessTrips', { ...d, status: 'pending' } as Record<string, unknown>);
export async function decideBusinessTrip(t: BusinessTrip, status: BusinessTrip['status'], actorUid: string): Promise<void> {
  await updateDocById('businessTrips', t.id, { status });
  await logAudit({ companyId: t.companyId, userId: actorUid, action: 'TRIP_' + status.toUpperCase(), entityType: 'businessTrip', entityId: t.id });
}

// ── Tabel / aylıq iş vaxtı xülasəsi (10 §5.2) ───────────────
export const listMonthlyTimesheets = (companyId: string, yearMonth?: string) =>
  listByCompany<MonthlyTimesheet>('monthlyTimesheets', companyId, yearMonth ? [where('yearMonth', '==', yearMonth)] : []);
const tsId = (employeeId: string, ym: string) => `${employeeId}_${ym}`;
export async function upsertTimesheet(d: Omit<MonthlyTimesheet, 'id'>): Promise<void> {
  await setDocById('monthlyTimesheets', tsId(d.employeeId, d.yearMonth), d as Record<string, unknown>);
}
export async function setTimesheetStatus(id: string, status: MonthlyTimesheet['status'], approvedBy: string | null): Promise<void> {
  await updateDocById('monthlyTimesheets', id, { status, approvedBy });
}
/** Aktiv işçilər üçün standart tabel qur (40 saat/həftə, 8 saat/gün) */
export async function seedTimesheets(companyId: string, yearMonth: string): Promise<number> {
  const emps = (await listEmployees(companyId)).filter((e) => e.status === 'active');
  const [y, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  let workdays = 0;
  for (let d = 1; d <= daysInMonth; d++) { const wd = new Date(y, mo - 1, d).getDay(); if (wd !== 0 && wd !== 6) workdays++; }
  for (const e of emps) {
    const existing = await getDocById<MonthlyTimesheet>('monthlyTimesheets', tsId(e.id, yearMonth));
    if (existing) continue;
    await upsertTimesheet({ companyId, employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, yearMonth,
      totalWorkedHours: workdays * 8, totalOvertimeHours: 0, workedDays: workdays, absenceDays: 0, leaveDays: 0, sickDays: 0, status: 'draft', approvedBy: null });
  }
  return emps.length;
}

// ── HR Əmrləri (əmrləşdirmə) ────────────────────────────────
export const listHROrders = (companyId: string) => listByCompanySorted<HROrder>('hrOrders', companyId, 'createdAt', 'desc');
export async function nextOrderNumber(companyId: string): Promise<string> {
  const all = await listByCompany<HROrder>('hrOrders', companyId);
  const year = new Date().getFullYear();
  const n = all.filter((o) => o.orderNumber?.includes(`/${year}`)).length + 1;
  return `${String(n).padStart(3, '0')}/${year}`;
}
export async function createHROrder(d: Omit<HROrder, 'id' | 'status' | 'orderNumber'> & { orderNumber?: string }): Promise<string> {
  const orderNumber = d.orderNumber ?? await nextOrderNumber(d.companyId);
  const id = await createDoc('hrOrders', { ...d, orderNumber, status: 'issued' } as Record<string, unknown>);
  await logAudit({ companyId: d.companyId, userId: d.createdBy ?? '', action: 'HR_ORDER_ISSUED', entityType: 'hrOrder', entityId: id });
  return id;
}
export const cancelHROrder = (id: string) => updateDocById('hrOrders', id, { status: 'cancelled' });

// ── Xidməti (mülki-hüquqi) müqavilələr ──────────────────────
export const listServiceContracts = (companyId: string) => listByCompanySorted<ServiceContract>('serviceContracts', companyId, 'createdAt', 'desc');
export async function nextServiceContractNumber(companyId: string): Promise<string> {
  const all = await listByCompany<ServiceContract>('serviceContracts', companyId);
  const year = new Date().getFullYear();
  return `XM-${String(all.length + 1).padStart(3, '0')}/${year}`;
}
export const createServiceContract = (d: Omit<ServiceContract, 'id'>) => createDoc('serviceContracts', d as Record<string, unknown>);
export const updateServiceContract = (id: string, d: Partial<ServiceContract>) => updateDocById('serviceContracts', id, d as Record<string, unknown>);

// ── İşdən çıxarma + istifadə olunmamış məzuniyyət kompensasiyası (10 §3) ──
export async function terminateEmployee(emp: Employee, terminationDate: string, reason: TerminationReason, actorUid: string): Promise<{ compensationDays: number }> {
  const year = new Date(terminationDate).getFullYear();
  const bal = await getLeaveBalance(emp.id, year);
  // Konstitusiya Məhkəməsi 2026: istifadə olunmamış əsas+əlavə məzuniyyət tam kompensasiya olunur
  const compensationDays = round2((bal?.balances ?? [])
    .filter((b) => b.remainingDays > 0)
    .reduce((s, b) => s + b.remainingDays, 0));
  await updateEmployee(emp.id, { status: 'terminated', terminationDate, terminationReason: reason });
  await logAudit({ companyId: emp.companyId, userId: actorUid, action: 'EMPLOYEE_TERMINATED', entityType: 'employee', entityId: emp.id, after: { reason, compensationDays } });
  return { compensationDays };
}

// ── Vergi konfiqurasiyası ───────────────────────────────────
export async function getActiveTaxConfig(): Promise<PayrollTaxConfig> {
  const configs = await listDocs<PayrollTaxConfig>('payrollTaxConfigs');
  if (configs.length === 0) return DEFAULT_TAX_CONFIG;
  // effectiveFrom-a görə ən son
  return configs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export async function saveTaxConfig(cfg: Omit<PayrollTaxConfig, 'id'>): Promise<void> {
  const id = `cfg_${cfg.effectiveFrom}`;
  await setDoc(doc(getDb(), 'payrollTaxConfigs', id), { ...cfg, createdAt: serverTimestamp() }, { merge: true });
}

// ── Payroll düzəlişləri (overtime/bonus/kəsinti) ────────────
const adjId = (employeeId: string, y: number, m: number) => `${employeeId}_${y}_${m}`;
export const listPayrollAdjustments = (companyId: string, year: number, month: number) =>
  listByCompany<PayrollAdjustment>('payrollAdjustments', companyId, [where('periodYear', '==', year), where('periodMonth', '==', month)]);
export async function savePayrollAdjustment(d: Omit<PayrollAdjustment, 'id'>): Promise<void> {
  await setDocById('payrollAdjustments', adjId(d.employeeId, d.periodYear, d.periodMonth), d as Record<string, unknown>);
}

// ── Əmək haqqı dövrləri (10 §6) ─────────────────────────────
export const listPayrollRuns = (companyId: string) => listByCompanySorted<PayrollRun>('payrollRuns', companyId, 'createdAt', 'desc');

/** Dövr üçün bütün aktiv işçiləri hesabla (draft), aylıq düzəlişlərlə birlikdə */
export async function calculatePayrollRun(companyId: string, month: number, year: number, createdBy: string): Promise<string> {
  const [employees, cfg, adjustments] = await Promise.all([
    listEmployees(companyId), getActiveTaxConfig(), listPayrollAdjustments(companyId, year, month),
  ]);
  const active = employees.filter((e) => e.status === 'active');
  if (active.length === 0) throw new Error('Aktiv işçi yoxdur');
  const adjMap = new Map(adjustments.map((a) => [a.employeeId, a]));

  const lines: PayrollLine[] = active.map((e) => {
    const a = adjMap.get(e.id);
    return calcPayrollLine({
      employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, baseSalary: e.baseSalary,
      overtimePay: a?.overtimePay ?? 0, bonuses: a?.bonuses ?? 0, otherDeductions: a?.otherDeductions ?? 0,
    }, cfg);
  });

  const totalGross = round2(lines.reduce((s, l) => s + l.grossSalary, 0));
  const totalNet = round2(lines.reduce((s, l) => s + l.netSalary, 0));
  const totalEmployerCost = round2(lines.reduce((s, l) => s + l.totalEmployerCost, 0));

  return createDoc('payrollRuns', {
    companyId, periodMonth: month, periodYear: year, status: 'calculated', lines,
    totalGross, totalNet, totalEmployerCost, taxConfigNote: cfg.notes ?? '', journalEntryId: null,
    approvedBy: null, createdBy,
  });
}

/** Təsdiq → konsolidasiya edilmiş jurnal yazısı (10 §6.3 addım 6 / 08 §2.3) */
export async function approvePayrollRun(run: PayrollRun, baseCurrency: string, actorUid: string): Promise<void> {
  if (run.status !== 'calculated') throw new Error('Yalnız hesablanmış dövr təsdiqlənə bilər');
  const accounts = await listAccounts(run.companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const rule = await resolvePostingRule(run.companyId, 'salary_accrued');
  const cExpense = codeFor(rule, 'expense', '721'), cPayroll = codeFor(rule, 'payrollPayable', '533'), cTax = codeFor(rule, 'taxLiability', '521'), cSocial = codeFor(rule, 'socialLiability', '522');
  const expense = find(cExpense), payablePayroll = find(cPayroll), taxLiab = find(cTax), socialLiab = find(cSocial);
  if (!expense || !payablePayroll) throw new Error('Hesablar Planı qurulmayıb (721/533 tapılmadı)');

  const totalIncomeTax = round2(run.lines.reduce((s, l) => s + l.incomeTax, 0));
  const employeeContribs = round2(run.lines.reduce((s, l) => s + l.employeeSocialInsurance + l.employeeMedicalInsurance + l.employeeUnemploymentInsurance, 0));
  const employerContribs = round2(run.lines.reduce((s, l) => s + l.employerSocialInsurance + l.employerMedicalInsurance + l.employerUnemploymentInsurance, 0));
  const debitExpense = round2(run.totalGross + employerContribs);
  const socialTotal = round2(employeeContribs + employerContribs);

  const lines = [
    { accountId: expense.id, accountCode: expense.accountCode, accountName: expense.accountName.az, debit: debitExpense, credit: 0 },
    { accountId: payablePayroll.id, accountCode: payablePayroll.accountCode, accountName: payablePayroll.accountName.az, debit: 0, credit: run.totalNet },
  ];
  if (totalIncomeTax > 0 && taxLiab) lines.push({ accountId: taxLiab.id, accountCode: taxLiab.accountCode, accountName: taxLiab.accountName.az, debit: 0, credit: totalIncomeTax });
  if (socialTotal > 0 && socialLiab) lines.push({ accountId: socialLiab.id, accountCode: socialLiab.accountCode, accountName: socialLiab.accountName.az, debit: 0, credit: socialTotal });
  // Balans qorunması: əgər 521/522 hesabları yoxdursa, qalığı 533-ə yığ
  const creditSum = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(creditSum - debitExpense) > 0.01) lines[1].credit = round2(lines[1].credit + (debitExpense - creditSum));

  const journalEntryId = await postJournalEntry({
    companyId: run.companyId, entryDate: `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}-28`,
    description: `Əmək haqqı hesablanması ${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
    sourceType: 'payroll', sourceDocumentId: run.id, lines, createdBy: actorUid, baseCurrency,
  });
  await updateDocById('payrollRuns', run.id, { status: 'approved', approvedBy: actorUid, journalEntryId });
  await logAudit({ companyId: run.companyId, userId: actorUid, action: 'PAYROLL_APPROVED', entityType: 'payrollRun', entityId: run.id, after: { totalGross: run.totalGross } });
}

/** Ödənildi kimi işarələ — 10 §6.3 addım 8 (bank faylı UI-da generasiya olunur) */
export async function markPayrollPaid(run: PayrollRun, actorUid: string): Promise<void> {
  await updateDocById('payrollRuns', run.id, { status: 'paid' });
  await logAudit({ companyId: run.companyId, userId: actorUid, action: 'PAYROLL_PAID', entityType: 'payrollRun', entityId: run.id });
}

export { where };
