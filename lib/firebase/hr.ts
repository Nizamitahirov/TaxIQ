import { where, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, getDocById, createDoc, updateDocById, listDocs } from './firestore';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import { DEFAULT_TAX_CONFIG, calcPayrollLine } from '@/lib/payroll/tax';
import type {
  Employee, LeaveType, LeaveRequest, PayrollRun, PayrollLine, PayrollTaxConfig, LocalizedText,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── İşçilər ──────────────────────────────────────────────────
export const listEmployees = (companyId: string) => listByCompany<Employee>('employees', companyId);
export const getEmployee = (id: string) => getDocById<Employee>('employees', id);
export const createEmployee = (d: Omit<Employee, 'id'>) => createDoc('employees', d as Record<string, unknown>);
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
export const listLeaveRequests = (companyId: string) => listByCompany<LeaveRequest>('leaveRequests', companyId, [orderBy('createdAt', 'desc')]);

export async function createLeaveRequest(d: Omit<LeaveRequest, 'id' | 'status'>): Promise<string> {
  return createDoc('leaveRequests', { ...d, status: 'pending' } as Record<string, unknown>);
}

export async function decideLeaveRequest(req: LeaveRequest, approve: boolean, actorUid: string): Promise<void> {
  await updateDocById('leaveRequests', req.id, { status: approve ? 'approved' : 'rejected' });
  await logAudit({ companyId: req.companyId, userId: actorUid, action: approve ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', entityType: 'leaveRequest', entityId: req.id });
}

export function pendingLeaveCount(requests: LeaveRequest[]): number {
  return requests.filter((r) => r.status === 'pending').length;
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

// ── Əmək haqqı dövrləri (10 §6) ─────────────────────────────
export const listPayrollRuns = (companyId: string) => listByCompany<PayrollRun>('payrollRuns', companyId, [orderBy('createdAt', 'desc')]);

/** Dövr üçün bütün aktiv işçiləri hesabla (draft) */
export async function calculatePayrollRun(companyId: string, month: number, year: number, createdBy: string): Promise<string> {
  const [employees, cfg] = await Promise.all([listEmployees(companyId), getActiveTaxConfig()]);
  const active = employees.filter((e) => e.status === 'active');
  if (active.length === 0) throw new Error('Aktiv işçi yoxdur');

  const lines: PayrollLine[] = active.map((e) =>
    calcPayrollLine({ employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, baseSalary: e.baseSalary }, cfg));

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
  const expense = find('721'), payablePayroll = find('533'), taxLiab = find('521'), socialLiab = find('522');
  if (!expense || !payablePayroll) throw new Error('Hesablar Planı qurulmayıb (721/533 tapılmadı)');

  const totalIncomeTax = round2(run.lines.reduce((s, l) => s + l.incomeTax, 0));
  const employeeContribs = round2(run.lines.reduce((s, l) => s + l.employeeSocialInsurance + l.employeeMedicalInsurance + l.employeeUnemploymentInsurance, 0));
  const employerContribs = round2(run.lines.reduce((s, l) => s + l.employerSocialInsurance + l.employerMedicalInsurance + l.employerUnemploymentInsurance, 0));
  const debitExpense = round2(run.totalGross + employerContribs);
  const socialTotal = round2(employeeContribs + employerContribs);

  const lines = [
    { accountId: expense.id, accountCode: '721', accountName: expense.accountName.az, debit: debitExpense, credit: 0 },
    { accountId: payablePayroll.id, accountCode: '533', accountName: payablePayroll.accountName.az, debit: 0, credit: run.totalNet },
  ];
  if (totalIncomeTax > 0 && taxLiab) lines.push({ accountId: taxLiab.id, accountCode: '521', accountName: taxLiab.accountName.az, debit: 0, credit: totalIncomeTax });
  if (socialTotal > 0 && socialLiab) lines.push({ accountId: socialLiab.id, accountCode: '522', accountName: socialLiab.accountName.az, debit: 0, credit: socialTotal });
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
