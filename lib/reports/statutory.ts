'use client';

/**
 * Rəsmi (dövlət) hesabatların real sistem datası ilə doldurulması — DSMF/ASAN
 * "Əlavə №1" hissələri + əməkhaqqı cədvəli. Şablonların strukturu (başlıqlar,
 * birləşdirilmiş xanalar, büdcə kodları, üslub) dəyişmir — yalnız data xanaları
 * doldurulur. exceljs şablonu olduğu kimi saxlayır (loqo, üslub, birləşmələr).
 */
import type ExcelJSNS from 'exceljs';
import { calcPayrollLine } from '@/lib/payroll/tax';
import { resolveRate } from '@/lib/firebase/treasury';
import type {
  BusinessTrip, Company, Employee, ExchangeRate, LeaveBalance, LeaveRequest, MonthlyTimesheet, PayrollRun, PayrollTaxConfig,
} from '@/types';

const MONTHS_AZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
export const monthNameAz = (m: number) => MONTHS_AZ[m - 1] ?? '';

export interface PreviewTable { title: string; note?: string; columns: string[]; rows: (string | number)[][]; html?: string }
export interface GeneratedReport { blob: Blob; filename: string; preview: PreviewTable }

export interface ReportContext {
  company: Company;
  employees: Employee[];
  runs: PayrollRun[];           // bütün əmək haqqı dövrləri
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  timesheets: MonthlyTimesheet[];
  businessTrips: BusinessTrip[];
  rates: ExchangeRate[];
  cfg: PayrollTaxConfig;
  year: number;
  quarter: number;              // 1–4 (DSMF formaları üçün)
  month: number;                // əməkhaqqı cədvəli üçün
}

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const lastDay = (year: number, month: number) => `${ym(year, month)}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

/** Timesheet varsa faktiki iş günləri; yoxdursa təqvim norması */
function actualWorkdays(ctx: ReportContext, employeeId: string, month: number): number {
  const t = ctx.timesheets.find((x) => x.employeeId === employeeId && x.yearMonth === ym(ctx.year, month));
  return t ? t.workedDays : workdays(ctx.year, month);
}
/** Timesheet varsa faktiki iş saatları; yoxdursa norma (gün×8) */
function actualHours(ctx: ReportContext, employeeId: string, month: number): number {
  const t = ctx.timesheets.find((x) => x.employeeId === employeeId && x.yearMonth === ym(ctx.year, month));
  return t ? round2(t.totalWorkedHours) : workdays(ctx.year, month) * 8;
}
/** İşçinin qalıq (istifadə edilməmiş) məzuniyyət günləri — leaveBalances-dan */
function remainingLeaveDays(ctx: ReportContext, employeeId: string, year: number): number {
  const lb = ctx.leaveBalances.find((b) => b.employeeId === employeeId && b.year === year)
    ?? ctx.leaveBalances.filter((b) => b.employeeId === employeeId).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
  if (!lb) return 0;
  return round2(lb.balances.reduce((s, it) => s + (it.remainingDays || 0), 0));
}
/** Xarici valyutada aylıq əməkhaqqı (manat + valyuta) */
function foreignMonthlyAmounts(ctx: ReportContext, e: Employee, month: number): { manat: number; fx: number; currency: string } {
  const base = ctx.company.baseCurrency || 'AZN';
  const cur = e.currency || base;
  const gross = grossFor(ctx, e.id, month);
  if (cur === base) return { manat: gross, fx: 0, currency: cur };
  // xarici valyutada saxlanılan maaş: baseSalary valyutadadır → manata çevir
  const rate = resolveRate(ctx.rates, cur, lastDay(ctx.year, month), base) || 1;
  const fxAmount = round2(e.baseSalary);
  const manat = gross > 0 ? gross : round2(fxAmount * rate);
  return { manat, fx: fxAmount, currency: cur };
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

/** Ayda işçinin işləmədiyi (məzuniyyət/qeyri-iş) günlərinin sayı və səbəbi.
 *  Timesheet varsa faktiki (norma − işlənmiş) götürülür; yoxdursa təsdiqlənmiş
 *  məzuniyyət sorğularından hesablanır. */
function notWorked(ctx: ReportContext, employeeId: string, month: number): { days: number; reasons: string[] } {
  const start = new Date(ctx.year, month - 1, 1);
  const end = new Date(ctx.year, month, 0);
  const reasons = new Set<string>();
  // Səbəbləri hər halda məzuniyyət sorğularından yığırıq
  for (const lr of ctx.leaveRequests) {
    if (lr.employeeId !== employeeId || lr.status !== 'approved') continue;
    const s = new Date(lr.startDate); const e = new Date(lr.endDate);
    const os = s > start ? s : start; const oe = e < end ? e : end;
    if (os > oe) continue;
    reasons.add(lr.leaveTypeName || lr.reason || 'Məzuniyyət');
  }
  const t = ctx.timesheets.find((x) => x.employeeId === employeeId && x.yearMonth === ym(ctx.year, month));
  if (t) {
    const missed = Math.max(0, t.absenceDays + t.leaveDays + t.sickDays);
    if (t.leaveDays > 0) reasons.add('Məzuniyyət');
    if (t.sickDays > 0) reasons.add('Xəstəlik');
    if (t.absenceDays > 0) reasons.add('Digər');
    return { days: missed, reasons: [...reasons] };
  }
  // timesheet yoxdursa məzuniyyət sorğularından iş günlərini hesabla
  let days = 0;
  for (const lr of ctx.leaveRequests) {
    if (lr.employeeId !== employeeId || lr.status !== 'approved') continue;
    const s = new Date(lr.startDate); const e = new Date(lr.endDate);
    const os = s > start ? s : start; const oe = e < end ? e : end;
    if (os > oe) continue;
    for (let d = new Date(os); d <= oe; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay(); if (wd !== 0 && wd !== 6) days++;
    }
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

// ── Doldurulmuş vərəqi HTML kimi göstərir (preview şablonun eynisi görünsün) ──
function colToNum(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function splitAddr(addr: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  return m ? { col: colToNum(m[1]), row: Number(m[2]) } : { col: 1, row: 1 };
}
function argbToCss(c?: { argb?: string }): string | null {
  const a = c?.argb;
  if (!a || a.length < 6) return null;
  return `#${a.length === 8 ? a.slice(2) : a}`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
function cellCss(cell: ExcelJSNS.Cell): string {
  const s: string[] = ['border:1px solid #cbd0d8', 'padding:1px 4px', 'overflow:hidden', 'white-space:pre-wrap', 'word-break:break-word'];
  const f = cell.font;
  s.push(`font-size:${Math.max(9, f?.size ?? 10)}px`);
  if (f?.bold) s.push('font-weight:700');
  if (f?.italic) s.push('font-style:italic');
  const fc = argbToCss(f?.color as { argb?: string } | undefined);
  if (fc && fc.toLowerCase() !== '#000000') s.push(`color:${fc}`);
  const al = cell.alignment;
  s.push(`text-align:${al?.horizontal ?? 'left'}`);
  s.push(`vertical-align:${al?.vertical === 'middle' ? 'middle' : al?.vertical === 'bottom' ? 'bottom' : 'top'}`);
  const fill = cell.fill as { type?: string; pattern?: string; fgColor?: { argb?: string } } | undefined;
  if (fill?.type === 'pattern' && fill.pattern === 'solid') { const bg = argbToCss(fill.fgColor); if (bg) s.push(`background:${bg}`); }
  return s.join(';');
}
/** exceljs vərəqini birləşmələr + üslublarla HTML cədvələ çevirir */
export function worksheetToHtml(ws: ExcelJSNS.Worksheet): string {
  const merges = (ws.model as unknown as { merges?: string[] }).merges ?? [];
  const spanMap = new Map<string, { colspan: number; rowspan: number }>();
  const covered = new Set<string>();
  for (const rng of merges) {
    const [a, b] = rng.split(':');
    if (!a || !b) continue;
    const s = splitAddr(a); const e = splitAddr(b);
    spanMap.set(`${s.row}:${s.col}`, { colspan: e.col - s.col + 1, rowspan: e.row - s.row + 1 });
    for (let r = s.row; r <= e.row; r++) for (let c = s.col; c <= e.col; c++) { if (r === s.row && c === s.col) continue; covered.add(`${r}:${c}`); }
  }
  // Son mənalı sətri tap — şablonun boş formatlaşdırılmış sətirlərini göstərmə
  const scanMax = Math.min(ws.rowCount || 1, 300);
  let lastRow = 1;
  for (let r = 1; r <= scanMax; r++) {
    let has = false;
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => { if (cell.text != null && String(cell.text).trim() !== '') has = true; });
    if (has) lastRow = r;
  }
  for (const rng of merges) { const parts = rng.split(':'); if (parts[1]) { const e = splitAddr(parts[1]); if (e.row <= scanMax) lastRow = Math.max(lastRow, e.row); } }
  const rowCount = lastRow;
  const colCount = Math.min(ws.actualColumnCount || ws.columnCount || 1, 60);
  let colgroup = '';
  for (let c = 1; c <= colCount; c++) { const w = ws.getColumn(c).width; colgroup += `<col style="width:${w ? Math.round(w * 7) : 60}px">`; }
  let html = `<table style="border-collapse:collapse;table-layout:fixed;font-family:Calibri,Arial,sans-serif;color:#111;background:#fff"><colgroup>${colgroup}</colgroup><tbody>`;
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    html += `<tr${row.height ? ` style="height:${Math.round(row.height * 1.33)}px"` : ''}>`;
    for (let c = 1; c <= colCount; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = row.getCell(c);
      const span = spanMap.get(`${r}:${c}`);
      const text = cell.text != null && cell.text !== '' ? String(cell.text) : (cell.value != null ? String(cell.value) : '');
      const cs = span && span.colspan > 1 ? ` colspan="${span.colspan}"` : '';
      const rs = span && span.rowspan > 1 ? ` rowspan="${span.rowspan}"` : '';
      html += `<td${cs}${rs} style="${cellCss(cell)}">${escapeHtml(text)}</td>`;
    }
    html += '</tr>';
  }
  return html + '</tbody></table>';
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
  const normHours = workdays(ctx.year, ctx.month) * 8;

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

  const T = { F: 0, G: 0, H: 0, I: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0, S: 0, TT: 0, U: 0 };
  lines.forEach(({ e, line }, i) => {
    const r = FIRST + i;
    const empDed = round2(line.incomeTax + line.employeeMedicalInsurance + line.employeeSocialInsurance + line.employeeUnemploymentInsurance);
    const net = round2(line.grossSalary - empDed);
    const set = (c: string, v: string | number) => { ws.getCell(`${c}${r}`).value = v; };
    const actHours = actualHours(ctx, e.id, ctx.month);
    set('B', i + 1); set('C', empName(e)); set('D', e.personalId ?? ''); set('E', e.position ?? '');
    set('F', round2(e.baseSalary)); set('G', normHours); set('H', actHours);
    set('I', round2(line.grossSalary)); set('J', 0); set('K', 0); set('L', round2(line.grossSalary));
    set('M', round2(line.incomeTax)); set('N', round2(line.employeeSocialInsurance)); set('O', round2(line.employeeUnemploymentInsurance)); set('P', round2(line.employeeMedicalInsurance));
    set('Q', round2(line.employerSocialInsurance)); set('R', round2(line.employerUnemploymentInsurance)); set('S', round2(line.employerMedicalInsurance));
    set('T', empDed); set('U', net);
    T.F += e.baseSalary; T.G += normHours; T.H += actHours; T.I += line.grossSalary; T.L += line.grossSalary; T.M += line.incomeTax;
    T.N += line.employeeSocialInsurance; T.O += line.employeeUnemploymentInsurance; T.P += line.employeeMedicalInsurance;
    T.Q += line.employerSocialInsurance; T.R += line.employerUnemploymentInsurance; T.S += line.employerMedicalInsurance;
    T.TT += empDed; T.U += net;
    preview.rows.push([i + 1, empName(e), e.personalId ?? '', e.position ?? '', round2(e.baseSalary), round2(line.grossSalary), round2(line.incomeTax), empDed, net]);
  });

  // Cəmi sətri (literal)
  const st = (c: string, v: number) => { ws.getCell(`${c}${totalsRow}`).value = round2(v); };
  ws.getCell(`B${totalsRow}`).value = 'Cəmi';
  st('F', T.F); st('G', T.G); st('H', T.H); st('I', T.I); st('L', T.L); st('M', T.M); st('N', T.N); st('O', T.O); st('P', T.P); st('Q', T.Q); st('R', T.R); st('S', T.S); st('T', T.TT); st('U', T.U);

  // Fond xülasəsi (J17..J25 → şablonda formul; literal ilə əvəz olunur, mövqe extra qədər sürüşür)
  const jrow = (base: number) => base + extra;
  const setJ = (base: number, v: number) => { ws.getCell(`J${jrow(base)}`).value = round2(v); };
  setJ(17, T.L); setJ(19, T.M); setJ(20, T.N); setJ(21, T.O); setJ(22, T.P); setJ(23, T.Q); setJ(24, T.R); setJ(25, T.S);

  preview.html = worksheetToHtml(ws);
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
  preview.html = worksheetToHtml(ws);
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
        D: 'Bəli', E: actualWorkdays(c, e.id, m1), F: grossFor(c, e.id, m1),
        O: 'Bəli', P: actualWorkdays(c, e.id, m2), Q: grossFor(c, e.id, m2),
        Z: 'Bəli', AA: actualWorkdays(c, e.id, m3), AB: grossFor(c, e.id, m3),
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
      // Orta günlük məzuniyyət haqqı ≈ aylıq əməkhaqqı / 30.4 (AR ƏM 140-cı maddə üzrə sadələşdirilmiş)
      const dailyRate = (e: Employee) => round2(e.baseSalary / 30.4);
      const days = (e: Employee) => remainingLeaveDays(c, e.id, c.year);
      const compFor = (e: Employee) => round2(dailyRate(e) * days(e));
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
          note: terms.length === 0 ? 'Bu rübdə işdən çıxan işçi yoxdur.' : 'Qalıq məzuniyyət günləri işçinin balansından (leaveBalances) götürülür.',
          columns: ['№', 'A.S.A', 'FİN', 'İl', 'Qalıq gün', 'Kompensasiya'],
          rows: terms.map((e, i) => [i + 1, empName(e), e.personalId ?? '', c.year, days(e), compFor(e)]),
        },
      };
    },
  });
}

// 5) FİN-i olmayan xarici əməkdaşlar (Əlavə1 Hissə4) — rüblük
export async function genForeignEmployees(ctx: ReportContext): Promise<GeneratedReport> {
  const [m1, m2, m3] = quarterMonths(ctx.quarter);
  return genList(ctx, {
    // manat: G/H/I (2.1) + M/N/O (2.3); valyuta (dollar): J/K/L (2.2) + P/Q/R (2.4)
    slug: 'foreign-employees.xlsx', firstRow: 6, seqCol: 'A',
    cols: ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
    fill: (c) => {
      const foreign = c.employees.filter((e) => e.isForeigner);
      const amt = (e: Employee, m: number) => foreignMonthlyAmounts(c, e, m);
      const rows = foreign.map((e) => {
        const a1 = amt(e, m1), a2 = amt(e, m2), a3 = amt(e, m3);
        return {
          B: empName(e), C: e.residencePermitFin ?? '', D: e.passportSeries ?? '', E: e.passportNumber ?? '', F: e.citizenshipCountry ?? '',
          G: a1.manat, H: a2.manat, I: a3.manat, J: a1.fx, K: a2.fx, L: a3.fx,
          M: a1.manat, N: a2.manat, O: a3.manat, P: a1.fx, Q: a2.fx, R: a3.fx,
        };
      });
      return {
        rows,
        filename: `Xarici-emekdaslar-${c.year}-R${c.quarter}.xlsx`,
        preview: {
          title: `FİN-i olmayan xarici əməkdaşlar — ${c.year} R${c.quarter}`,
          note: foreign.length === 0 ? 'Sistemdə xarici əməkdaş qeyd olunmayıb (İşçi kartında «Xarici əməkdaş»). Valyuta sütunları işçinin valyutası baza valyutadan fərqli olduqda FX məzənnə ilə doldurulur.' : 'Valyuta (dollar) sütunları işçinin valyutasından, manat sütunları FX məzənnə ilə hesablanır.',
          columns: ['№', 'A.S.A', 'Ölkə', 'Pasport', `Manat ${monthNameAz(m1)}`, monthNameAz(m2), monthNameAz(m3), 'Valyuta (aylıq)'],
          rows: foreign.map((e, i) => { const a1 = amt(e, m1), a2 = amt(e, m2), a3 = amt(e, m3); return [i + 1, empName(e), e.citizenshipCountry ?? '', `${e.passportSeries ?? ''} ${e.passportNumber ?? ''}`.trim(), a1.manat, a2.manat, a3.manat, `${a1.fx || ''} ${a1.currency !== (c.company.baseCurrency || 'AZN') ? a1.currency : ''}`.trim()]; }),
        },
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  6) İş vaxtının uçotu tabeli (per-day timesheet) — tək ay
//  Şablon sistemdə olmadığından exceljs ilə standart formada qurulur.
//  Kodlar: rəqəm=işlənmiş saat, İ=istirahət/bayram, M=məzuniyyət,
//          X=xəstəlik, E=ezamiyyət, Q=qayıb/davamiyyətsizlik.
// ═══════════════════════════════════════════════════════════════
export const TABEL_LEGEND = 'Kodlar:  8 = işlənmiş saat · İ = istirahət/bayram · M = məzuniyyət · X = xəstəlik · E = ezamiyyət · Q = qayıb';

function dayMark(ctx: ReportContext, e: Employee, day: number): string | number {
  const date = new Date(ctx.year, ctx.month - 1, day);
  const iso = `${ym(ctx.year, ctx.month)}-${String(day).padStart(2, '0')}`;
  const wd = date.getDay();
  // təsdiqlənmiş məzuniyyət/xəstəlik
  for (const lr of ctx.leaveRequests) {
    if (lr.employeeId !== e.id || lr.status !== 'approved') continue;
    if (iso >= lr.startDate && iso <= lr.endDate) {
      const nm = (lr.leaveTypeName || '').toLowerCase();
      return nm.includes('xəstə') || nm.includes('sick') || nm.includes('bülleten') ? 'X' : 'M';
    }
  }
  // ezamiyyət
  for (const bt of ctx.businessTrips) {
    if (bt.employeeId !== e.id || (bt.status !== 'approved' && bt.status !== 'completed')) continue;
    if (iso >= bt.startDate && iso <= bt.endDate) return 'E';
  }
  if (wd === 0 || wd === 6) return 'İ';
  return 8; // iş günü
}

export async function genTimeTabel(ctx: ReportContext): Promise<GeneratedReport> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${monthNameAz(ctx.month)} ${ctx.year}`);
  const daysInMonth = new Date(ctx.year, ctx.month, 0).getDate();
  const active = ctx.employees.filter((e) => e.status !== 'terminated');
  const dayCols = daysInMonth;
  const totalCols = 3 + dayCols + 5; // №, A.S.A, Vəzifə + günlər + 5 yekun
  const lastColLetter = ws.getColumn(totalCols).letter;

  // Başlıq
  ws.mergeCells(1, 1, 1, totalCols);
  const t = ws.getCell(1, 1);
  t.value = 'İş vaxtının uçotu tabeli';
  t.font = { bold: true, size: 14 }; t.alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, totalCols);
  ws.getCell(2, 1).value = `${ctx.company.name}${ctx.company.taxId ? ' · VÖEN ' + ctx.company.taxId : ''} — ${monthNameAz(ctx.month)} ${ctx.year}`;
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  // Sütun başlıqları (4-cü sətir)
  const hr = 4;
  const head = (col: number, val: string | number) => { const c = ws.getCell(hr, col); c.value = val; c.font = { bold: true, size: 9 }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = box; };
  head(1, '№'); head(2, 'Soyadı, adı, atasının adı'); head(3, 'Vəzifə');
  for (let d = 1; d <= dayCols; d++) head(3 + d, d);
  const totalStart = 3 + dayCols;
  head(totalStart + 1, 'İşlənmiş gün'); head(totalStart + 2, 'İşlənmiş saat'); head(totalStart + 3, 'Məzuniyyət (gün)'); head(totalStart + 4, 'Xəstəlik (gün)'); head(totalStart + 5, 'Ezamiyyət (gün)');
  ws.getColumn(1).width = 4; ws.getColumn(2).width = 28; ws.getColumn(3).width = 16;
  for (let d = 1; d <= dayCols; d++) ws.getColumn(3 + d).width = 3.4;
  for (let k = 1; k <= 5; k++) ws.getColumn(totalStart + k).width = 11;

  const preview: PreviewTable = {
    title: `İş vaxtının uçotu tabeli — ${monthNameAz(ctx.month)} ${ctx.year}`,
    note: TABEL_LEGEND,
    columns: ['№', 'A.S.A', 'Vəzifə', ...Array.from({ length: dayCols }, (_, i) => String(i + 1)), 'Gün', 'Saat', 'M', 'X', 'E'],
    rows: [],
  };

  active.forEach((e, i) => {
    const r = hr + 1 + i;
    ws.getCell(r, 1).value = i + 1; ws.getCell(r, 2).value = empName(e); ws.getCell(r, 3).value = e.position ?? '';
    let workedDays = 0, workedHours = 0, mDays = 0, xDays = 0, eDays = 0;
    const marks: (string | number)[] = [];
    for (let d = 1; d <= dayCols; d++) {
      const m = dayMark(ctx, e, d);
      marks.push(m);
      const cell = ws.getCell(r, 3 + d);
      cell.value = m; cell.alignment = { horizontal: 'center' }; cell.font = { size: 9 }; cell.border = box;
      if (typeof m === 'number') { workedDays++; workedHours += m; }
      else if (m === 'M') mDays++; else if (m === 'X') xDays++; else if (m === 'E') eDays++;
    }
    for (let c = 1; c <= 3; c++) ws.getCell(r, c).border = box;
    const tot = [workedDays, workedHours, mDays, xDays, eDays];
    tot.forEach((v, k) => { const c = ws.getCell(r, totalStart + 1 + k); c.value = v; c.alignment = { horizontal: 'center' }; c.border = box; });
    preview.rows.push([i + 1, empName(e), e.position ?? '', ...marks, workedDays, workedHours, mDays, xDays, eDays]);
  });

  // Leqenda + imza
  const legRow = hr + active.length + 2;
  ws.mergeCells(legRow, 1, legRow, totalCols);
  ws.getCell(legRow, 1).value = TABEL_LEGEND;
  ws.getCell(legRow, 1).font = { italic: true, size: 9 };
  ws.getCell(legRow + 2, 2).value = `Baş Direktor: ${ctx.company.directorName ?? '________________'}`;

  void lastColLetter;
  preview.html = worksheetToHtml(ws);
  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return { blob, filename: `Is-vaxti-tabeli-${ctx.year}-${String(ctx.month).padStart(2, '0')}.xlsx`, preview };
}

const box: Partial<ExcelJSNS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
};

export type StatutoryReportKey = 'salary' | 'timesheet' | 'emp-general' | 'days-not-worked' | 'leave-compensation' | 'foreign';

export const STATUTORY_REPORTS: { key: StatutoryReportKey; az: string; en: string; desc: string; periodic: 'month' | 'quarter'; gen: (ctx: ReportContext) => Promise<GeneratedReport> }[] = [
  { key: 'salary', az: 'Əməkhaqqı Cədvəli', en: 'Salary table', desc: 'Aylıq əməkhaqqı hesablanması (vergi/DSMF ilə)', periodic: 'month', gen: genSalaryTable },
  { key: 'timesheet', az: 'İş vaxtının uçotu tabeli', en: 'Work-time record', desc: 'Gün-gün tabel (təqvim + məzuniyyət + ezamiyyət)', periodic: 'month', gen: genTimeTabel },
  { key: 'emp-general', az: 'İşçilər üzrə ümumi məlumat', en: 'Employees general info', desc: 'DSMF Əlavə №1 - Hissə 1 (rüblük)', periodic: 'quarter', gen: genEmpGeneral },
  { key: 'days-not-worked', az: 'İşlənməyən iş günləri', en: 'Days not worked', desc: 'DSMF Əlavə №1 - Hissə 3 (rüblük)', periodic: 'quarter', gen: genDaysNotWorked },
  { key: 'leave-compensation', az: 'Məzuniyyət kompensasiyası', en: 'Leave compensation', desc: 'DSMF Əlavə №1 - Hissə 6 (rüblük)', periodic: 'quarter', gen: genLeaveCompensation },
  { key: 'foreign', az: 'Xarici əməkdaşlar (FİN-siz)', en: 'Foreign employees', desc: 'DSMF Əlavə №1 - Hissə 4 (rüblük)', periodic: 'quarter', gen: genForeignEmployees },
];
