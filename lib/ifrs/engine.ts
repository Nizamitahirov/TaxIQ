import { listAccounts, listJournalEntries } from '@/lib/firebase/accounting';
import type { ChartAccount, JournalEntry } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface StatementRow {
  label: string;
  current: number;
  prior: number;
  level: number;        // indent
  bold?: boolean;
  subtotal?: boolean;
}

export interface FinancialStatement {
  title: string;
  periodLabel: string;
  rows: StatementRow[];
  balanced?: boolean;   // balans hesabatı üçün
  warning?: string;
}

export interface Period { start: string; end: string; label: string }

/** Tam il dövrü */
export function yearPeriod(year: number): Period {
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}` };
}

interface Dataset { accounts: ChartAccount[]; entries: JournalEntry[] }

async function load(companyId: string): Promise<Dataset> {
  const [accounts, entries] = await Promise.all([listAccounts(companyId), listJournalEntries(companyId)]);
  return { accounts, entries };
}

/** Hesab → net (debit − credit). cumulative: tarixə qədər; əks halda aralıqda */
function accountNets(ds: Dataset, opts: { upTo?: string; from?: string; to?: string }): Map<string, number> {
  const nets = new Map<string, number>();
  for (const e of ds.entries) {
    const d = e.entryDateStr ?? '';
    if (opts.upTo && d > opts.upTo) continue;
    if (opts.from && d < opts.from) continue;
    if (opts.to && d > opts.to) continue;
    for (const l of e.lines) {
      nets.set(l.accountId, (nets.get(l.accountId) ?? 0) + (l.debit || 0) - (l.credit || 0));
    }
  }
  return nets;
}

/** Sinif üzrə net cəmi */
function sumByClass(ds: Dataset, nets: Map<string, number>, cls: number): number {
  let s = 0;
  for (const a of ds.accounts) if (a.accountClass === cls) s += nets.get(a.id) ?? 0;
  return s;
}
/** Qrup üzrə net cəmi */
function sumByGroup(ds: Dataset, nets: Map<string, number>, group: string): number {
  let s = 0;
  for (const a of ds.accounts) if (a.accountGroup === group) s += nets.get(a.id) ?? 0;
  return s;
}

// ── Balans (Maliyyə Vəziyyəti) — 09 §2 ──
export async function generateBalanceSheet(companyId: string, current: Period, prior: Period): Promise<FinancialStatement> {
  const ds = await load(companyId);
  const cur = accountNets(ds, { upTo: current.end });
  const pri = accountNets(ds, { upTo: prior.end });

  // profit (cari illər nəticəsi) = -(net6 + net7 + net9) — bütün tarix üzrə
  const profit = (n: Map<string, number>) => -(sumByClass(ds, n, 6) + sumByClass(ds, n, 7) + sumByClass(ds, n, 9));

  const nonCurrentA = (n: Map<string, number>) => sumByClass(ds, n, 1);
  const currentA = (n: Map<string, number>) => sumByClass(ds, n, 2);
  const totalA = (n: Map<string, number>) => round2(nonCurrentA(n) + currentA(n));
  const equity = (n: Map<string, number>) => round2(-sumByClass(ds, n, 3) + profit(n));
  const nonCurrentL = (n: Map<string, number>) => round2(-sumByClass(ds, n, 4));
  const currentL = (n: Map<string, number>) => round2(-sumByClass(ds, n, 5));
  const totalL = (n: Map<string, number>) => round2(nonCurrentL(n) + currentL(n));
  const totalEL = (n: Map<string, number>) => round2(equity(n) + totalL(n));

  const rows: StatementRow[] = [
    { label: 'AKTİVLƏR', current: 0, prior: 0, level: 0, bold: true },
    { label: 'Uzunmüddətli aktivlər', current: round2(nonCurrentA(cur)), prior: round2(nonCurrentA(pri)), level: 1 },
    { label: 'Qısamüddətli aktivlər', current: round2(currentA(cur)), prior: round2(currentA(pri)), level: 1 },
    { label: 'CƏMİ AKTİVLƏR', current: totalA(cur), prior: totalA(pri), level: 0, bold: true, subtotal: true },
    { label: 'KAPİTAL VƏ ÖHDƏLİKLƏR', current: 0, prior: 0, level: 0, bold: true },
    { label: 'Kapital (cari dövr nəticəsi daxil)', current: equity(cur), prior: equity(pri), level: 1 },
    { label: 'Uzunmüddətli öhdəliklər', current: nonCurrentL(cur), prior: nonCurrentL(pri), level: 1 },
    { label: 'Qısamüddətli öhdəliklər', current: currentL(cur), prior: currentL(pri), level: 1 },
    { label: 'CƏMİ KAPİTAL VƏ ÖHDƏLİKLƏR', current: totalEL(cur), prior: totalEL(pri), level: 0, bold: true, subtotal: true },
  ];
  const balanced = Math.abs(totalA(cur) - totalEL(cur)) < 0.01;
  return {
    title: 'Maliyyə Vəziyyəti haqqında Hesabat (Balans)',
    periodLabel: `${current.label} / ${prior.label}`,
    rows, balanced,
    warning: balanced ? undefined : 'DİQQƏT: Balans uyğunsuzluğu (Aktivlər ≠ Kapital + Öhdəliklər)',
  };
}

// ── Mənfəət və Zərər (P&L) — 09 §3 ──
export async function generateProfitLoss(companyId: string, current: Period, prior: Period): Promise<FinancialStatement> {
  const ds = await load(companyId);
  const cur = accountNets(ds, { from: current.start, to: current.end });
  const pri = accountNets(ds, { from: prior.start, to: prior.end });

  const revenue = (n: Map<string, number>) => -sumByGroup(ds, n, '60');
  const cogs = (n: Map<string, number>) => sumByGroup(ds, n, '70');
  const gross = (n: Map<string, number>) => round2(revenue(n) - cogs(n));
  const commercial = (n: Map<string, number>) => sumByGroup(ds, n, '71');
  const admin = (n: Map<string, number>) => sumByGroup(ds, n, '72');
  const otherOpex = (n: Map<string, number>) => sumByGroup(ds, n, '73');
  const otherInc = (n: Map<string, number>) => -sumByGroup(ds, n, '61');
  const operating = (n: Map<string, number>) => round2(gross(n) - commercial(n) - admin(n) - otherOpex(n) + otherInc(n));
  const finInc = (n: Map<string, number>) => -sumByGroup(ds, n, '63');
  const finExp = (n: Map<string, number>) => sumByGroup(ds, n, '75');
  const preTax = (n: Map<string, number>) => round2(operating(n) + finInc(n) - finExp(n));
  const tax = (n: Map<string, number>) => sumByClass(ds, n, 9);
  const net = (n: Map<string, number>) => round2(preTax(n) - tax(n));

  const r = (label: string, f: (n: Map<string, number>) => number, level = 1, bold = false, subtotal = false): StatementRow =>
    ({ label, current: round2(f(cur)), prior: round2(f(pri)), level, bold, subtotal });

  const rows: StatementRow[] = [
    r('Xalis satış gəliri', revenue),
    r('Satışın maya dəyəri', cogs),
    r('ÜMUMİ MƏNFƏƏT', gross, 0, true, true),
    r('Kommersiya xərcləri', commercial),
    r('İnzibati xərclər', admin),
    r('Sair əməliyyat xərcləri', otherOpex),
    r('Sair əməliyyat gəlirləri', otherInc),
    r('ƏMƏLİYYAT MƏNFƏƏTİ', operating, 0, true, true),
    r('Maliyyə gəlirləri', finInc),
    r('Maliyyə xərcləri', finExp),
    r('VERGİDƏN ƏVVƏL MƏNFƏƏT', preTax, 0, true, true),
    r('Mənfəət vergisi', tax),
    r('XALİS MƏNFƏƏT', net, 0, true, true),
  ];
  return { title: 'Mənfəət və Zərər haqqında Hesabat', periodLabel: `${current.label} / ${prior.label}`, rows };
}

// ── Pul Vəsaitlərinin Hərəkəti (Dolayı metod) — 09 §5 ──
export async function generateCashFlow(companyId: string, current: Period, prior: Period): Promise<FinancialStatement> {
  const ds = await load(companyId);
  const periodMov = accountNets(ds, { from: current.start, to: current.end });
  const opening = accountNets(ds, { upTo: prevDay(current.start) });
  const closing = accountNets(ds, { upTo: current.end });

  // Xalis mənfəət (dövr)
  const profit = -(sumByClass(ds, periodMov, 6) + sumByClass(ds, periodMov, 7) + sumByClass(ds, periodMov, 9));
  // Amortizasiya (112 kontr-hesabın dövr üzrə kredit artımı = -net(112) dövr)
  const depr = -(netOfGroup(ds, periodMov, '11') < 0 ? netOfAccountCode(ds, periodMov, '112') : netOfAccountCode(ds, periodMov, '112'));
  const deprPeriod = -netOfAccountCode(ds, periodMov, '112'); // kontr-aktivin krediti müsbət amortizasiya
  // İşlək kapital dəyişiklikləri (net fərq closing-opening)
  const changeGroup = (g: string) => (groupNet(ds, closing, g) - groupNet(ds, opening, g));
  const arChange = changeGroup('21');      // debitor artımı → pul azalması
  const invChange = changeGroup('20');     // ehtiyat artımı → pul azalması
  const apChange = changeGroup('53');       // kreditor artımı (kredit) → net mənfi, pul artması

  const operatingCF = round2(profit + deprPeriod - arChange - invChange - apChange);

  // İnvestisiya: sinif 1 (əsas vəsait) dəyər artımı → pul çıxışı
  const ppeChange = (sumByClass(ds, closing, 1) - sumByClass(ds, opening, 1));
  const investingCF = round2(-ppeChange);

  // Maliyyələşdirmə: sinif 4,5 faiz öhdəlikləri + sinif 3 kapital (kredit artımı pul gətirir)
  const loanChange = -((sumByClass(ds, closing, 4) + sumByClass(ds, closing, 5)) - (sumByClass(ds, opening, 4) + sumByClass(ds, opening, 5)));
  const equityChange = -(sumByClass(ds, closing, 3) - sumByClass(ds, opening, 3));
  const financingCF = round2(loanChange + equityChange);

  const netChange = round2(operatingCF + investingCF + financingCF);
  const openingCash = groupNet(ds, opening, '22');
  const closingCashCalc = round2(openingCash + netChange);
  const closingCashActual = round2(groupNet(ds, closing, '22'));
  const matches = Math.abs(closingCashCalc - closingCashActual) < 0.01;

  void depr;
  const rows: StatementRow[] = [
    { label: 'Əməliyyat fəaliyyəti', current: 0, prior: 0, level: 0, bold: true },
    { label: 'Xalis mənfəət', current: round2(profit), prior: 0, level: 1 },
    { label: 'Amortizasiya (qeyri-pul)', current: round2(deprPeriod), prior: 0, level: 1 },
    { label: 'Debitor borclarındakı dəyişiklik', current: round2(-arChange), prior: 0, level: 1 },
    { label: 'Ehtiyatlardakı dəyişiklik', current: round2(-invChange), prior: 0, level: 1 },
    { label: 'Kreditor borclarındakı dəyişiklik', current: round2(-apChange), prior: 0, level: 1 },
    { label: 'ƏMƏLİYYATDAN XALİS PUL', current: operatingCF, prior: 0, level: 0, bold: true, subtotal: true },
    { label: 'İnvestisiya fəaliyyətindən xalis pul', current: investingCF, prior: 0, level: 0, bold: true, subtotal: true },
    { label: 'Maliyyələşdirmədən xalis pul', current: financingCF, prior: 0, level: 0, bold: true, subtotal: true },
    { label: 'PUL VƏSAİTLƏRİNİN XALİS DƏYİŞİKLİYİ', current: netChange, prior: 0, level: 0, bold: true, subtotal: true },
    { label: 'Dövrün əvvəlinə pul qalığı', current: round2(openingCash), prior: 0, level: 1 },
    { label: 'DÖVRÜN SONUNA PUL (hesablanmış)', current: closingCashCalc, prior: 0, level: 0, bold: true, subtotal: true },
    { label: 'Faktiki pul qalığı (22 hesab)', current: closingCashActual, prior: 0, level: 1 },
  ];
  return {
    title: 'Pul Vəsaitlərinin Hərəkəti haqqında Hesabat (dolayı metod)',
    periodLabel: current.label, rows,
    warning: matches ? undefined : 'DİQQƏT: Hesablanmış pul qalığı faktiki 22 hesab qalığı ilə üst-üstə düşmür',
  };
}

// ── Kapitalda Dəyişikliklər — 09 §4 ──
export async function generateEquityChanges(companyId: string, current: Period): Promise<FinancialStatement> {
  const ds = await load(companyId);
  const opening = accountNets(ds, { upTo: prevDay(current.start) });
  const closing = accountNets(ds, { upTo: current.end });
  const periodMov = accountNets(ds, { from: current.start, to: current.end });

  const openingEquity = round2(-sumByClass(ds, opening, 3));
  const closingEquityBase = round2(-sumByClass(ds, closing, 3));
  const periodProfit = round2(-(sumByClass(ds, periodMov, 6) + sumByClass(ds, periodMov, 7) + sumByClass(ds, periodMov, 9)));
  const capitalChange = round2(-(sumByGroup(ds, closing, '30') - sumByGroup(ds, opening, '30')));

  const rows: StatementRow[] = [
    { label: 'Dövrün əvvəlinə kapital qalığı', current: openingEquity, prior: 0, level: 1 },
    { label: 'Dövrün xalis mənfəəti', current: periodProfit, prior: 0, level: 1 },
    { label: 'Nizamnamə kapitalında dəyişiklik', current: capitalChange, prior: 0, level: 1 },
    { label: 'DÖVRÜN SONUNA KAPİTAL (hesab qalığı)', current: closingEquityBase, prior: 0, level: 0, bold: true, subtotal: true },
  ];
  return { title: 'Kapitalda Dəyişikliklər haqqında Hesabat', periodLabel: current.label, rows };
}

// helpers
function groupNet(ds: Dataset, nets: Map<string, number>, group: string): number { return sumByGroup(ds, nets, group); }
function netOfGroup(ds: Dataset, nets: Map<string, number>, group: string): number { return sumByGroup(ds, nets, group); }
function netOfAccountCode(ds: Dataset, nets: Map<string, number>, code: string): number {
  let s = 0;
  for (const a of ds.accounts) if (a.accountCode === code) s += nets.get(a.id) ?? 0;
  return s;
}
function prevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
