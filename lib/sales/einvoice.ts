import type { Company, Customer, Invoice } from '@/types';

/**
 * e-Qaimə-faktura XML generasiyası (06 §5).
 * ⚠️ MVP: STS-in rəsmi sxeminə yaxın strukturlaşdırılmış XML — bütün məcburi sahələr
 * (hər iki tərəfin VÖEN-i, mal/xidmət kodları, məbləğlər). Tam sertifikatlaşdırılmış
 * API/ASAN İmza inteqrasiyası gələcək fazadır; mühasib bu faylı e-taxes.gov.az-a
 * əl ilə yükləyir.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
const n2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export function buildEInvoiceXml(inv: Invoice, company: Company, customer: Customer | null): string {
  const items = inv.lineItems.map((l, i) => {
    const gross = l.quantity * l.unitPrice;
    const net = gross - gross * (l.discountPercent || 0) / 100;
    const vat = net * (l.vatRate || 0) / 100;
    return `    <Mal sira="${i + 1}">
      <Kod>${esc(l.goodId ?? '')}</Kod>
      <Ad>${esc(l.description)}</Ad>
      <Olcu>${esc(l.unit ?? 'ədəd')}</Olcu>
      <Miqdar>${n2(l.quantity)}</Miqdar>
      <Qiymet>${n2(l.unitPrice)}</Qiymet>
      <EndirimFaiz>${n2(l.discountPercent || 0)}</EndirimFaiz>
      <Mebleg>${n2(net)}</Mebleg>
      <EDVDereces>${n2(l.vatRate || 0)}</EDVDereces>
      <EDVMebleg>${n2(vat)}</EDVMebleg>
    </Mal>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<eQaime versiya="1.0" ferqlendiriciNomre="${esc(inv.invoiceNumber)}">
  <Satici>
    <Ad>${esc(company.legalName ?? company.name)}</Ad>
    <VOEN>${esc(company.taxId ?? '')}</VOEN>
    <Unvan>${esc(company.address ?? '')}</Unvan>
  </Satici>
  <Alici>
    <Ad>${esc(customer?.legalName ?? customer?.name ?? inv.customerName ?? '')}</Ad>
    <VOEN>${esc(customer?.taxId ?? '')}</VOEN>
    <Unvan>${esc(customer?.billingAddress ?? '')}</Unvan>
  </Alici>
  <Faktura>
    <Nomre>${esc(inv.invoiceNumber)}</Nomre>
    <Tarix>${esc(inv.issueDate)}</Tarix>
    <Valyuta>${esc(inv.currency)}</Valyuta>
  </Faktura>
  <Mallar>
${items}
  </Mallar>
  <Yekun>
    <AraCem>${n2(inv.subtotal - inv.discountTotal)}</AraCem>
    <EDVCem>${n2(inv.vatTotal)}</EDVCem>
    <UmumiMebleg>${n2(inv.grandTotal)}</UmumiMebleg>
  </Yekun>
</eQaime>`;
}

/** XML faylını brauzerdə endirir */
export function downloadEInvoiceXml(inv: Invoice, company: Company, customer: Customer | null): void {
  const xml = buildEInvoiceXml(inv, company, customer);
  const blob = new Blob(['﻿' + xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `e-qaime-${inv.invoiceNumber}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
