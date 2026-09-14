import type { Payment, StatementLine } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayDiff = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

/** Ödənişin çıxarışdakı işarəli məbləği (daxil +, çıxış −) */
function signedAmount(p: Payment): number {
  return p.direction === 'incoming' ? round2(p.amount) : -round2(p.amount);
}

/**
 * Qayda-əsaslı avtomatik uyğunlaşdırma (07 §5.2): məbləğ (±0.01) + tarix (±3 gün).
 * Hər ödəniş yalnız bir sətrə bağlanır. Uyğunlaşmayan sətirlər 'unmatched' qalır.
 */
export function autoMatch(lines: StatementLine[], payments: Payment[]): { lines: StatementLine[]; matched: number } {
  const used = new Set<string>();
  let matched = 0;
  const out = lines.map((line) => {
    if (line.matchStatus === 'matched' || line.matchStatus === 'ignored') return line;
    const candidate = payments.find((p) => !used.has(p.id) && Math.abs(signedAmount(p) - round2(line.amount)) < 0.011 && dayDiff(p.paymentDate, line.date) <= 3);
    if (candidate) {
      used.add(candidate.id);
      matched++;
      return { ...line, matchStatus: 'matched' as const, matchedPaymentId: candidate.id };
    }
    return line;
  });
  return { lines: out, matched };
}

export interface ReconcileSummary { total: number; matched: number; unmatched: number; ignored: number }
export function reconcileSummary(lines: StatementLine[]): ReconcileSummary {
  return {
    total: lines.length,
    matched: lines.filter((l) => l.matchStatus === 'matched').length,
    unmatched: lines.filter((l) => l.matchStatus === 'unmatched').length,
    ignored: lines.filter((l) => l.matchStatus === 'ignored').length,
  };
}

/** CSV/TSV mətnindən çıxarış sətirlərini oxuyur (sadə: tarix, təsvir, məbləğ sütunları) */
export function parseStatementText(text: string): StatementLine[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const delim = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
  const out: StatementLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;
    // Başlıq sətrini atla
    const amount = Number(cols[2].replace(/\s/g, '').replace(',', '.'));
    const dateOk = /\d{4}-\d{2}-\d{2}/.test(cols[0]) || /\d{2}[./]\d{2}[./]\d{4}/.test(cols[0]);
    if (!dateOk || Number.isNaN(amount)) continue;
    const date = normalizeDate(cols[0]);
    out.push({ id: `l${i}`, date, description: cols[1], amount: Math.round(amount * 100) / 100, matchStatus: 'unmatched', matchedPaymentId: null });
  }
  return out;
}

function normalizeDate(s: string): string {
  if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/(\d{2})[./](\d{2})[./](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}
