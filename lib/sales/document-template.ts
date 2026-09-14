import type { Company, Customer, Invoice } from '@/types';

/**
 * Sadə merge-tag şablon mühərriki (06 §6.4) — Handlebars alt-toplusu:
 *   {{path.to.value}}  və  {{#each lineItems}} ... {{this.field}} ... {{/each}}
 * Server-side Puppeteer PDF (tam WYSIWYG) gələcək fazadır; bu, brauzerdə çap alternatividir.
 */
type Ctx = Record<string, unknown>;

function getPath(ctx: Ctx, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Ctx)[key] : undefined), ctx);
}

export function renderTemplate(html: string, ctx: Ctx): string {
  // {{#each list}} ... {{/each}} bloklarını aç
  let out = html.replace(/\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, listPath: string, inner: string) => {
    const list = getPath(ctx, listPath);
    if (!Array.isArray(list)) return '';
    return list.map((item, idx) => inner.replace(/\{\{\s*(this\.[\w.]+|@index)\s*\}\}/g, (__, tok: string) => {
      if (tok === '@index') return String(idx + 1);
      const v = getPath(item as Ctx, tok.slice('this.'.length));
      return esc(v);
    })).join('');
  });
  // Sadə {{path}} əvəzləmələri
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => esc(getPath(ctx, path)));
  return out;
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
const money = (n: number, cur: string) => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur;

/** Faktura üçün şablon konteksti qurur */
export function buildInvoiceContext(inv: Invoice, company: Company, customer: Customer | null): Ctx {
  return {
    company: { name: company.name, legalName: company.legalName ?? '', taxId: company.taxId ?? '', address: company.address ?? '', phone: company.phone ?? '', logoUrl: company.logoUrl ?? '', brandColor: company.brandColor ?? '#5B5BF5' },
    customer: { name: inv.customerName ?? customer?.name ?? '', taxId: customer?.taxId ?? '', address: customer?.billingAddress ?? '' },
    invoice: { invoiceNumber: inv.invoiceNumber, issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency, subtotal: money(inv.subtotal - inv.discountTotal, inv.currency), vatTotal: money(inv.vatTotal, inv.currency), grandTotal: money(inv.grandTotal, inv.currency) },
    lineItems: inv.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit ?? '', unitPrice: money(l.unitPrice, inv.currency), discountPercent: l.discountPercent || 0, vatRate: l.vatRate || 0, lineTotal: money(l.lineTotal, inv.currency) })),
  };
}

/** Şablonu render edib yeni pəncərədə çap edir */
export function printWithTemplate(html: string, ctx: Ctx): void {
  const rendered = renderTemplate(html, ctx);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(rendered.includes('<html') ? rendered : `<!doctype html><html lang="az"><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');body{font-family:Montserrat,Arial,sans-serif;padding:32px;color:#0f1129}table{width:100%;border-collapse:collapse}td,th{border:1px solid #e7e9f2;padding:6px 8px;text-align:left}</style></head><body>${rendered}<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

/** Standart başlanğıc faktura şablonu (merge-tag nümunəsi) */
export const DEFAULT_INVOICE_TEMPLATE = `<div style="border-bottom:3px solid {{company.brandColor}};padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between">
  <div>
    <h1 style="margin:0;color:{{company.brandColor}}">{{company.name}}</h1>
    <div style="color:#6b6f8a;font-size:12px">{{company.legalName}} · VÖEN {{company.taxId}}</div>
    <div style="color:#6b6f8a;font-size:12px">{{company.address}} {{company.phone}}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:800">HESAB-FAKTURA</div>
    <div style="color:#6b6f8a;font-size:12px">№ {{invoice.invoiceNumber}}</div>
    <div style="color:#6b6f8a;font-size:12px">Tarix: {{invoice.issueDate}} · Ödəmə: {{invoice.dueDate}}</div>
  </div>
</div>
<p><strong>Müştəri:</strong> {{customer.name}} · VÖEN: {{customer.taxId}}</p>
<table>
  <thead><tr style="background:{{company.brandColor}};color:#fff"><th>№</th><th>Təsvir</th><th>Say</th><th>Qiymət</th><th>ƏDV%</th><th>Cəm</th></tr></thead>
  <tbody>
  {{#each lineItems}}
    <tr><td>{{@index}}</td><td>{{this.description}}</td><td>{{this.quantity}} {{this.unit}}</td><td>{{this.unitPrice}}</td><td>{{this.vatRate}}%</td><td>{{this.lineTotal}}</td></tr>
  {{/each}}
  </tbody>
</table>
<div style="margin-top:16px;margin-left:auto;width:280px">
  <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Ara cəm:</span><span>{{invoice.subtotal}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:4px 0"><span>ƏDV:</span><span>{{invoice.vatTotal}}</span></div>
  <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:800;font-size:16px;border-top:2px solid {{company.brandColor}};color:{{company.brandColor}}"><span>YEKUN:</span><span>{{invoice.grandTotal}}</span></div>
</div>
<div style="margin-top:48px;display:flex;justify-content:space-between"><div style="border-top:1px solid #999;padding-top:6px;width:40%;text-align:center;font-size:11px">İmza (Satıcı)</div><div style="border-top:1px solid #999;padding-top:6px;width:40%;text-align:center;font-size:11px">İmza (Alıcı)</div></div>`;

export const INVOICE_MERGE_TAGS = [
  'company.name', 'company.legalName', 'company.taxId', 'company.address', 'company.phone', 'company.logoUrl', 'company.brandColor',
  'customer.name', 'customer.taxId', 'customer.address',
  'invoice.invoiceNumber', 'invoice.issueDate', 'invoice.dueDate', 'invoice.currency', 'invoice.subtotal', 'invoice.vatTotal', 'invoice.grandTotal',
  '#each lineItems → this.description, this.quantity, this.unit, this.unitPrice, this.vatRate, this.lineTotal, @index',
];
