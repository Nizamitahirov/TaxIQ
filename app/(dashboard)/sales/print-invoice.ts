import type { Company, Invoice } from '@/types';

const fmt = (n: number, cur: string) => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur;
const esc = (s: string) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));

/**
 * Faktura üçün tam HTML sənədi qurur (çap/önizləmə üçün).
 * `autoPrint` true olduqda yükləndikdən sonra avtomatik window.print() çağırır.
 */
export function buildInvoiceHtml(inv: Invoice, company: Company, opts: { autoPrint?: boolean } = {}): string {
  const brand = company.brandColor || '#5B5BF5';
  const rows = inv.lineItems.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(l.description)}</td>
      <td style="text-align:right">${l.quantity}</td>
      <td style="text-align:right">${fmt(l.unitPrice, inv.currency)}</td>
      <td style="text-align:right">${l.discountPercent || 0}%</td>
      <td style="text-align:right">${l.vatRate || 0}%</td>
      <td style="text-align:right">${fmt(l.lineTotal, inv.currency)}</td>
    </tr>`).join('');

  const html = `<!doctype html><html lang="az"><head><meta charset="utf-8">
  <title>${esc(inv.invoiceNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box} body{font-family:Montserrat,Arial,sans-serif;color:#0f1129;margin:0;padding:40px;font-size:13px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brand};padding-bottom:16px;margin-bottom:24px}
    .hdr h1{margin:0;font-size:26px;color:${brand}} .muted{color:#6b6f8a;font-size:12px}
    .title{font-size:22px;font-weight:800;text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:16px} th{background:${brand};color:#fff;padding:8px;text-align:left;font-size:11px}
    td{padding:8px;border-bottom:1px solid #e7e9f2} .tot{margin-top:16px;margin-left:auto;width:280px}
    .tot div{display:flex;justify-content:space-between;padding:4px 0} .grand{font-weight:800;font-size:16px;border-top:2px solid ${brand};padding-top:8px;color:${brand}}
    .sign{margin-top:60px;display:flex;justify-content:space-between} .sign div{width:40%;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:11px}
  </style></head><body>
    <div class="hdr">
      <div>
        ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" style="max-height:56px;margin-bottom:8px">` : ''}
        <h1>${esc(company.name)}</h1>
        <div class="muted">${esc(company.legalName ?? '')}${company.taxId ? ' · VÖEN ' + esc(company.taxId) : ''}</div>
        <div class="muted">${esc(company.address ?? '')} ${esc(company.phone ?? '')}</div>
      </div>
      <div>
        <div class="title">HESAB-FAKTURA</div>
        <div class="muted">№ ${esc(inv.invoiceNumber)}</div>
        <div class="muted">Tarix: ${esc(inv.issueDate)}</div>
        <div class="muted">Ödəmə: ${esc(inv.dueDate)}</div>
      </div>
    </div>
    <div><strong>Müştəri:</strong> ${esc(inv.customerName ?? '')}</div>
    <table>
      <thead><tr><th>№</th><th>Təsvir</th><th style="text-align:right">Say</th><th style="text-align:right">Qiymət</th><th style="text-align:right">Endirim</th><th style="text-align:right">ƏDV</th><th style="text-align:right">Cəm</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">
      <div><span>Ara cəm:</span><span>${fmt(inv.subtotal - inv.discountTotal, inv.currency)}</span></div>
      <div><span>ƏDV:</span><span>${fmt(inv.vatTotal, inv.currency)}</span></div>
      <div class="grand"><span>YEKUN:</span><span>${fmt(inv.grandTotal, inv.currency)}</span></div>
    </div>
    <div class="sign"><div>İmza (Satıcı)</div><div>İmza (Alıcı)</div></div>
    ${opts.autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
  </body></html>`;

  return html;
}

/**
 * Sadə WYSIWYG faktura çapı (client-side window.print).
 * Qeyd: tam GrapesJS Sənəd Dizayneri + Puppeteer PDF (06 §6) Cloud Function tələb edir
 * və gələcək faza kimi qeyd olunub; bu, funksional çap alternatividir.
 */
export function printInvoice(inv: Invoice, company: Company) {
  const html = buildInvoiceHtml(inv, company, { autoPrint: true });
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
