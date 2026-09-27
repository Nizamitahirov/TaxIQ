'use client';

/**
 * Vergi bəyannamələrinin XML ixracı.
 * Qeyd: e-taxes.gov.az-ın rəsmi XSD sxemi ilə birbaşa yükləmə Cloud Functions +
 * inteqrasiya tələb edir. Bu modul strukturlaşdırılmış, düzgün formatlı XML
 * yaradır (məlumat mübadiləsi / arxiv üçün) — rəsmi sxemə uyğunlaşdırıla bilər.
 */
import type { VatDeclaration, WithholdingDeclaration, ProfitTaxDeclaration } from './declarations';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] ?? c));
const n2 = (v: number) => (Math.round((v || 0) * 100) / 100).toFixed(2);

export interface DeclMeta {
  companyName: string;
  taxId: string;
  periodLabel: string;
  year: number;
  month?: number;
  quarter?: number;
}

function header(meta: DeclMeta): string {
  return `  <Taxpayer>
    <Name>${esc(meta.companyName)}</Name>
    <TIN>${esc(meta.taxId)}</TIN>
  </Taxpayer>
  <Period year="${meta.year}"${meta.month ? ` month="${meta.month}"` : ''}${meta.quarter ? ` quarter="${meta.quarter}"` : ''} label="${esc(meta.periodLabel)}"/>`;
}

/** ƏDV bəyannaməsi XML */
export function vatDeclarationXml(d: VatDeclaration, meta: DeclMeta): string {
  const line = (x: { date: string; number: string; party: string; base: number; vat: number }) =>
    `      <Row date="${esc(x.date)}" doc="${esc(x.number)}" party="${esc(x.party)}" base="${n2(x.base)}" vat="${n2(x.vat)}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<VatReturn generator="TaxIQ">
${header(meta)}
  <Output total="${n2(d.outputVat)}" base="${n2(d.salesBase)}">
    <Sales>
${d.sales.map(line).join('\n')}
    </Sales>
  </Output>
  <Input total="${n2(d.inputVat)}" base="${n2(d.purchaseBase)}">
    <Purchases>
${d.purchases.map(line).join('\n')}
    </Purchases>
  </Input>
  <Payable>${n2(d.payable)}</Payable>
</VatReturn>`;
}

/** Ödəmə mənbəyində tutulan vergi (muzdlu iş) XML */
export function withholdingXml(d: WithholdingDeclaration, meta: DeclMeta): string {
  const line = (l: { employee: string; gross: number; incomeTax: number; social: number; unemployment: number; medical: number }) =>
    `      <Employee name="${esc(l.employee)}" gross="${n2(l.gross)}" incomeTax="${n2(l.incomeTax)}" social="${n2(l.social)}" unemployment="${n2(l.unemployment)}" medical="${n2(l.medical)}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<WithholdingReturn generator="TaxIQ">
${header(meta)}
  <Totals gross="${n2(d.gross)}" incomeTax="${n2(d.incomeTax)}" social="${n2(d.social)}" unemployment="${n2(d.unemployment)}" medical="${n2(d.medical)}"/>
  <Employees>
${d.lines.map(line).join('\n')}
  </Employees>
</WithholdingReturn>`;
}

/** Mənfəət vergisi XML */
export function profitTaxXml(d: ProfitTaxDeclaration, meta: DeclMeta): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ProfitTaxReturn generator="TaxIQ">
${header(meta)}
  <TaxableProfit>${n2(d.profit)}</TaxableProfit>
  <Rate>${(d.rate * 100).toFixed(0)}</Rate>
  <Tax>${n2(d.tax)}</Tax>
</ProfitTaxReturn>`;
}

/** XML mətnini fayl kimi endirir. */
export function downloadXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xml') ? filename : `${filename}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
