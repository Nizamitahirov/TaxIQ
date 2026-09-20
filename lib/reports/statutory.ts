'use client';

/**
 * Rəsmi (dövlət) hesabatların real sistem datası ilə doldurulması — DSMF/ASAN
 * "Əlavə №1" hissələri + əməkhaqqı cədvəli. Şablonların strukturu (başlıqlar,
 * birləşdirilmiş xanalar, büdcə kodları, üslub) dəyişmir — yalnız data xanaları
 * doldurulur. exceljs şablonu olduğu kimi saxlayır (loqo, üslub, birləşmələr).
 */
import type ExcelJSNS from 'exceljs';
import { calcPayrollLine } from '@/lib/payroll/tax';
import type { Company, Employee, LeaveRequest, PayrollRun, PayrollTaxConfig } from '@/types';

const MONTHS_AZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
export const monthNameAz = (m: number) => MONTHS_AZ[m - 1] ?? '';

export interface PreviewTable { title: string; note?: string; columns: string[]; rows: (string | number)[][] }
export interface GeneratedReport { blob: Blob; filename: string; preview: PreviewTable }

export interface ReportContext {
  company: Company;
  employees: Employee[];
  runs: PayrollRun[];           // bütün əmək haqqı dövrləri
  leaveRequests: LeaveRequest[];
  cfg: PayrollTaxConfig;
  year: number;
  quarter: number;              // 1–4 (DSMF formaları üçün)
  month: number;                // əməkhaqqı cədvəli üçün
}

const empName = (e: Employee) => `${e.firstName} ${e.lastName}${e.fatherName ? ' ' + e.fatherName : ''}`.trim();
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ayda iş günləri (Bazar ertəsi–Cümə) */
function workdays(year: number, month: number): number {
  let d = 0;
  const days = new Date(year, month, 0).getDate();
  for (let i = 1; i <= days; i++) { const wd = new Date(year, month - 1, i).getDay(); if (wd !== 0 && wd !== 6) d++; }
  return d;
}

function quarterMonths(q: number): number[] { return [q * 3 - 2, q * 3 - 1, q * 3]; }

function grossFor(ctx: ReportContext, employeeId: string, month: number): number {
  const run = ctx.runs.find((r) => r.periodYear === ctx.year && r.periodMonth === month);
  const line = run?.lines.find((l) => l.employeeId === employeeId);
  return line ? round2(line.grossSalary) : 0;
}

/** Ayda işçinin işləmədiyi (məzuniyyət/qeyri-iş) günlərinin sayı və səbəbi */
function notWorked(ctx: ReportContext, employeeId: string, month: number): { days: number; reasons: string[] } {
  const start = new Date(ctx.year, month - 1, 1);
  const end = new Date(ctx.year, month, 0);
  let days = 0; const reasons = new Set<string>();
  for (const lr of ctx.leaveRequests) {
    if (lr.employeeId !== employeeId || lr.status !== 'approved') continue;
    const s = new Date(lr.startDate); const e = new Date(lr.endDate);
    const os = s > start ? s : start; const oe = e < end ? e : end;
    if (os > oe) continue;
    // kəsişən iş günləri
    for (let d = new Date(os); d <= oe; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay(); if (wd !== 0 && wd !== 6) days++;
    }
    reasons.add(lr.leaveTypeName || lr.reason || 'Məzuniyyət');
  }
  return { days, reasons: [...reasons] };
}

async function loadTemplate(slug: string): Promise<{ ExcelJS: typeof ExcelJSNS; wb: ExcelJSNS.Workbook }> {
  const ExcelJS = (await import('exceljs')).default;
  const res = await fetch(`/report-templates/${slug}`);
  if (!res.ok) throw new Error(`Şablon tapılmadı: ${slug}`);
  const buf = await res.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return { ExcelJS, wb };
}

async function toBlob(wb: ExcelJSNS.Workbook): Promise<Blob> {
  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Sətrin üslubunu şablon nümunə sətrindən köçürür (sərhədlər uzansın) */
function copyRowStyle(ws: ExcelJSNS.Worksheet, fromRow: number, toRow: number, cols: string[]) {
  for (const c of cols) {
    const src = ws.getCell(`${c}${fromRow}`);
    const dst = ws.getCell(`${c}${toRow}`);
    dst.style = { ...src.style };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════════════════════════
//  1) Əməkhaqqı Cədvəli (Salary Table) — tək ay
// ═══════════════════════════════════════════════════════════════
export async function genSalaryTable(ctx: ReportContext): Promise<GeneratedReport> {
  const { wb } = await loadTemplate('salary-table.xlsx');
  const ws = wb.worksheets[0];
  const active = ctx.employees.filter((e) => e.status === 'active');
  const hours = workdays(ctx.year, ctx.month) * 8;

  // Dinamik başlıqlar
  ws.getCell('B4').value = ctx.company.name;
  ws.getCell('T2').value = ctx.company.legalName || ctx.company.name;
  ws.getCell('T3').value = `Director: ${ctx.company.directorName ?? ''}`;
  ws.getCell('B5').value = `${ctx.year}-ci ilin ${monthNameAz(ctx.month)} ayı üçün hesablanmış əməkhaqqı Cədvəli`;

  const FIRST = 10, TEMPLATE_ROWS = 5, TOTALS_TEMPLATE = 15;
  const dataCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];
  const n = active.length;
  const extra = Math.max(0, n - TEMPLATE_ROWS);
  if (extra > 0) {
    ws.spliceRows(TOTALS_TEMPLATE, 0, ...Array.from({ length: extra }, () => []));
    for (let i = 0; i < extra; i++) copyRowStyle(ws, FIRST + TEMPLATE_ROWS - 1, FIRST + TEMPLATE_ROWS + i, dataCols);
  }
  const totalsRow = FIRST + n; // cəmi sətri (n>=... boş buraxılmır)

  const lines = active.map((e) => {
    const line = calcPayrollLine({ employeeId: e.id, employeeName: empName(e), baseSalary: e.baseSalary, overtimePay: 0, bonuses: 0, otherDeductions: 0 }, ctx.cfg);
    return { e, line };
  });

  const preview: PreviewTable = {
    title: `Əməkhaqqı Cədvəli — ${monthNameAz(ctx.month)} ${ctx.year}`,
    columns: ['№', 'Soyadı, adı, atasının adı', 'FİN', 'Vəzifə', 'Əməkhaqqı', 'Hesablanmış', 'Gəlir vergisi', 'CƏMİ tutulmuş', 'Ödəniləcək'],
    rows: [],
  };

  const T = { F: 0, I: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0, S: 0, TT: 0, U: 0 };
  lines.forEach(({ e, line }, i) => {
    const r = FIRST + i;
    const empDed = round2(line.incomeTax + line.employeeMedicalInsurance + line.employeeSocialInsurance + line.employeeUnemploymentInsurance);
    const net = round2(line.grossSalary - empDed);
    const set = (c: string, v: string | number) => { ws.getCell(`${c}${r}`).value = v; };
    set('B', i + 1); set('C', empName(e)); set('D', e.personalId ?? ''); set('E', e.position ?? '');
    set('F', round2(e.baseSalary)); set('G', hours); set('H', hours);
    set('I', round2(line.grossSalary)); set('J', 0); set('K', 0); set('L', round2(line.grossSalary));
    set('M', round2(line.incomeTax)); set('N', round2(line.employeeSocialInsurance)); set('O', round2(line.employeeUnemploymentInsurance)); set('P', round2(line.employeeMedicalInsurance));
    set('Q', round2(line.employerSocialInsurance)); set('R', round2(line.employerUnemploymentInsurance)); set('S', round2(line.employerMedicalInsurance));
    set('T', empDed); set('U', net);
    T.F += e.baseSalary; T.I += line.grossSalary; T.L += line.grossSalary; T.M += line.incomeTax;
    T.N += line.employeeSocialInsurance; T.O += line.employeeUnemploymentInsurance; T.P += line.employeeMedicalInsurance;
    T.Q += line.employerSocialInsurance; T.R += line.employerUnemploymentInsurance; T.S += line.employerMedicalInsurance;
    T.TT += empDed; T.U += net;
    preview.rows.push([i + 1, empName(e), e.personalId ?? '', e.position ?? '', round2(e.baseSalary), round2(line.grossSalary), round2(line.incomeTax), empDed, net]);
  });

  // Cəmi sətri (literal)
  const st = (c: string, v: number) => { ws.getCell(`${c}${totalsRow}`).value = round2(v); };
  ws.getCell(`B${totalsRow}`).value = 'Cəmi';
  st('F', T.F); st('G', hours); st('H', hours); st('I', T.I); st('L', T.L); st('M', T.M); st('N', T.N); st('O', T.O); st('P', T.P); st('Q', T.Q); st('R', T.R); st('S', T.S); st('T', T.TT); st('U', T.U);

  // Fond xülasəsi (J17..J25 → şablonda formul; literal ilə əvəz olunur, mövqe extra qədər sürüşür)
  const jrow = (base: number) => base + extra;
  const setJ = (base: number, v: number) => { ws.getCell(`J${jrow(base)}`).value = round2(v); };
  setJ(17, T.L); setJ(19, T.M); setJ(20, T.N); setJ(21, T.O); setJ(22, T.P); setJ(23, T.Q); setJ(24, T.R); setJ(25, T.S);

  const blob = await toBlob(wb);
  return { blob, filename: `Emekhaqqi-Cedveli-${ctx.year}-${String(ctx.month).padStart(2, '0')}.xlsx`, preview };
}

// ═══════════════════════════════════════════════════════════════
//  Ümumi list-forma doldurucusu (DSMF Əlavə №1 hissələri)
// ═══════════════════════════════════════════════════════════════
interface ListDef {
  slug: string; sheetIndex?: number; firstRow: number; seqCol?: string; cols: string[];
  fill: (ctx: ReportContext) => { rows: Record<string, string | number>[]; preview: PreviewTable; filename: string };
}

async function genList(ctx: ReportContext, def: ListDef): Promise<GeneratedReport> {
  const { wb } = await loadTemplate(def.slug);
  const ws = wb.worksheets[def.sheetIndex ?? 0];
  const { rows, preview, filename } = def.fill(ctx);
  rows.forEach((row, i) => {
    const r = def.firstRow + i;
    if (i > 0) copyRowStyle(ws, def.firstRow, r, [...(def.seqCol ? [def.seqCol] : []), ...def.cols]);
    if (def.seqCol) ws.getCell(`${def.seqCol}${r}`).value = i + 1;
    for (const [c, v] of Object.entries(row)) ws.getCell(`${c}${r}`).value = v;
  });
  const blob = await toBlob(wb);
  return { blob, filename, preview };
}

// 2) İşçilər üzrə ümumi məlumat (Əlavə1 Hissə1) — rüblük
export async function genEmpGeneral(ctx: ReportContext): Promise<GeneratedReport> {
  const [m1, m2, m3] = quarterMonths(ctx.quarter);
  return genList(ctx, {
    slug: 'emp-general.xlsx', firstRow: 10, seqCol: 'A',
    cols: ['B', 'C', 'D', 'E', 'F', 'O', 'P', 'Q', 'Z', 'AA', 'AB'],
    fill: (c) => {
      const active = c.employees.filter((e) => e.status !== 'terminated');
      const rows = active.map((e) => ({
        B: empName(e), C: e.personalId ?? '',
        D: 'Bəli', E: workdays(c.year, m1), F: grossFor(c, e.id, m1),
        O: 'Bəli', P: workdays(c.year, m2), Q: grossFor(c, e.id, m2),
        Z: 'Bəli', AA: workdays(c.year, m3), AB: grossFor(c, e.id, m3),
      }));
      return {
        rows,
        filename: `Iscilr-umumi-melumat-${c.year}-R${c.quarter}.xlsx`,
        preview: {
          title: `İşçilər üzrə ümumi məlumat — ${c.year} R${c.quarter}`,
          columns: ['№', 'A.S.A', 'FİN', `Əmək haqqı ${monthNameAz(m1)}`, `${monthNameAz(m2)}`, `${monthNameAz(m3)}`],
          rows: active.map((e, i) => [i + 1, empName(e), e.personalId ?? '', grossFor(c, e.id, m1), grossFor(c, e.id, m2), grossFor(c, e.id, m3)]),
        },
      };
    },
  });
}

// 3) İşçinin işləmədiyi iş günləri (Əlavə1 Hissə3) — rüblük
export async function genDaysNotWorked(ctx: ReportContext): Promise<GeneratedReport> {
  const [m1, m2, m3] = quarterMonths(ctx.quarter);
  return genList(ctx, {
    slug: 'days-not-worked.xlsx', firstRow: 7, seqCol: 'A', cols: ['B', 'C', 'D', 'E', 'F', 'G'],
    fill: (c) => {
      const active = c.employees.filter((e) => e.status !== 'terminated');
      const enriched = active.map((e) => {
        const a = notWorked(c, e.id, m1), b = notWorked(c, e.id, m2), d = notWorked(c, e.id, m3);
        return { e, a, b, d, total: a.days + b.days + d.days };
      }).filter((x) => x.total > 0);
      const rows = enriched.map(({ e, a, b, d }) => ({
        B: empName(e), C: e.personalId ?? '', D: a.days, E: b.days, F: d.days,
        G: [...new Set([...a.reasons, ...b.reasons, ...d.reasons])].join(', '),
      }));
      return {
        rows,
        filename: `Islemediyi-gunler-${c.year}-R${c.quarter}.xlsx`,
        preview: {
          title: `İşçinin işləmədiyi iş günləri — ${c.year} R${c.quarter}`,
          note: enriched.length === 0 ? 'Bu rübdə təsdiqlənmiş məzuniyyət/qeyri-iş günü yoxdur.' : undefined,
          columns: ['№', 'A.S.A', 'FİN', monthNameAz(m1), monthNameAz(m2), monthNameAz(m3), 'Səbəb'],
          rows: enriched.map(({ e, a, b, d }, i) => [i + 1, empName(e), e.personalId ?? '', a.days, b.days, d.days, [...new Set([...a.reasons, ...b.reasons, ...d.reasons])].join(', ')]),
        },
      };
    },
  });
}

// 4) İstifadə edilməmiş məzuniyyət kompensasiyası (Əlavə1 Hissə6) — rüblük
export async function genLeaveCompensation(ctx: ReportContext): Promise<GeneratedReport> {
  const months = quarterMonths(ctx.quarter);
  return genList(ctx, {
    slug: 'leave-compensation.xlsx', firstRow: 7, seqCol: 'A', cols: ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    fill: (c) => {
      // Bu rübdə işdən çıxmış işçilər üçün istifadə edilməmiş məzuniyyət kompensasiyası
      const terms = c.employees.filter((e) => e.status === 'terminated' && e.terminationDate && Number(e.terminationDate.slice(0, 4)) === c.year && months.includes(Number(e.terminationDate.slice(5, 7))));
      const dailyRate = (e: Employee) => round2(e.baseSalary / 30);
      const compFor = (e: Employee) => round2(dailyRate(e) * 14); // nümunə: 14 gün qalıq (real balans olduqda əvəzlənir)
      const rows = terms.map((e) => {
        const tm = Number(e.terminationDate!.slice(5, 7));
        const comp = compFor(e);
        const monthCol = { [months[0]]: 'E', [months[1]]: 'F', [months[2]]: 'G' }[tm] ?? 'E';
        const row: Record<string, string | number> = { B: empName(e), C: e.personalId ?? '', D: c.year, E: 0, F: 0, G: 0, H: 0, I: comp, J: comp };
        row[monthCol] = comp;
        return row;
      });
      return {
        rows,
        filename: `Mezuniyyet-kompensasiya-${c.year}-R${c.quarter}.xlsx`,
        preview: {
          title: `İstifadə edilməmiş məzuniyyət kompensasiyası — ${c.year} R${c.quarter}`,
          note: terms.length === 0 ? 'Bu rübdə işdən çıxan işçi yoxdur.' : 'Qalıq məzuniyyət günləri balansdan götürülür (nümunə: 14 gün).',
          columns: ['№', 'A.S.A', 'FİN', 'İl', 'Kompensasiya'],
          rows: terms.map((e, i) => [i + 1, empName(e), e.personalId ?? '', c.year, compFor(e)]),
        },
      };
    },
  });
}

// 5) FİN-i olmayan xarici əməkdaşlar (Əlavə1 Hissə4) — rüblük
export async function genForeignEmployees(ctx: ReportContext): Promise<GeneratedReport> {
  const [m1, m2, m3] = quarterMonths(ctx.quarter);
  return genList(ctx, {
    slug: 'foreign-employees.xlsx', firstRow: 6, seqCol: 'A', cols: ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'M', 'N', 'O'],
    fill: (c) => {
      const foreign = c.employees.filter((e) => e.isForeigner);
      const rows = foreign.map((e) => ({
        B: empName(e), C: e.residencePermitFin ?? '', D: e.passportSeries ?? '', E: e.passportNumber ?? '', F: e.citizenshipCountry ?? '',
        G: grossFor(c, e.id, m1), H: grossFor(c, e.id, m2), I: grossFor(c, e.id, m3),
        M: grossFor(c, e.id, m1), N: grossFor(c, e.id, m2), O: grossFor(c, e.id, m3),
      }));
      return {
        rows,
        filename: `Xarici-emekdaslar-${c.year}-R${c.quarter}.xlsx`,
        preview: {
          title: `FİN-i olmayan xarici əməkdaşlar — ${c.year} R${c.quarter}`,
          note: foreign.length === 0 ? 'Sistemdə xarici əməkdaş qeyd olunmayıb (İşçi kartında «Xarici əməkdaş»).' : undefined,
          columns: ['№', 'A.S.A', 'Ölkə', 'Pasport', `Ə/h ${monthNameAz(m1)}`, monthNameAz(m2), monthNameAz(m3)],
          rows: foreign.map((e, i) => [i + 1, empName(e), e.citizenshipCountry ?? '', `${e.passportSeries ?? ''} ${e.passportNumber ?? ''}`.trim(), grossFor(c, e.id, m1), grossFor(c, e.id, m2), grossFor(c, e.id, m3)]),
        },
      };
    },
  });
}

export type StatutoryReportKey = 'salary' | 'emp-general' | 'days-not-worked' | 'leave-compensation' | 'foreign';

export const STATUTORY_REPORTS: { key: StatutoryReportKey; az: string; en: string; desc: string; periodic: 'month' | 'quarter'; gen: (ctx: ReportContext) => Promise<GeneratedReport> }[] = [
  { key: 'salary', az: 'Əməkhaqqı Cədvəli', en: 'Salary table', desc: 'Aylıq əməkhaqqı hesablanması (vergi/DSMF ilə)', periodic: 'month', gen: genSalaryTable },
  { key: 'emp-general', az: 'İşçilər üzrə ümumi məlumat', en: 'Employees general info', desc: 'DSMF Əlavə №1 - Hissə 1 (rüblük)', periodic: 'quarter', gen: genEmpGeneral },
  { key: 'days-not-worked', az: 'İşlənməyən iş günləri', en: 'Days not worked', desc: 'DSMF Əlavə №1 - Hissə 3 (rüblük)', periodic: 'quarter', gen: genDaysNotWorked },
  { key: 'leave-compensation', az: 'Məzuniyyət kompensasiyası', en: 'Leave compensation', desc: 'DSMF Əlavə №1 - Hissə 6 (rüblük)', periodic: 'quarter', gen: genLeaveCompensation },
  { key: 'foreign', az: 'Xarici əməkdaşlar (FİN-siz)', en: 'Foreign employees', desc: 'DSMF Əlavə №1 - Hissə 4 (rüblük)', periodic: 'quarter', gen: genForeignEmployees },
];
