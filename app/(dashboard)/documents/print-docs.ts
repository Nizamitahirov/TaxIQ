import type { Company, DeliveryNote, CmrConsignment, RemittanceAdvice } from '@/types';

const fmt = (n: number, cur: string) => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));

function shell(title: string, brand: string, company: Company, docTitle: string, meta: string, body: string, autoPrint = true): string {
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box} body{font-family:Montserrat,Arial,sans-serif;color:#0f1129;margin:0;padding:36px;font-size:12.5px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brand};padding-bottom:14px;margin-bottom:20px}
    .hdr h1{margin:0;font-size:22px;color:${brand}} .muted{color:#6b6f8a;font-size:11.5px}
    .title{font-size:19px;font-weight:800;text-align:right} table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:${brand};color:#fff;padding:7px;text-align:left;font-size:10.5px} td{padding:7px;border-bottom:1px solid #e7e9f2}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
    .box{border:1px solid #e7e9f2;border-radius:8px;padding:10px} .box h3{margin:0 0 6px;font-size:11px;color:${brand};text-transform:uppercase}
    .kv{display:flex;justify-content:space-between;padding:2px 0} .kv span:first-child{color:#6b6f8a}
    .sign{margin-top:44px;display:flex;justify-content:space-between} .sign div{width:40%;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:10.5px}
  </style></head><body>
    <div class="hdr">
      <div>${company.logoUrl ? `<img src="${esc(company.logoUrl)}" style="max-height:50px;margin-bottom:6px">` : ''}
        <h1>${esc(company.name)}</h1>
        <div class="muted">${esc(company.legalName ?? '')}${company.taxId ? ' · VÖEN ' + esc(company.taxId) : ''}</div>
        <div class="muted">${esc(company.address ?? '')} ${esc(company.phone ?? '')}</div></div>
      <div><div class="title">${esc(docTitle)}</div>${meta}</div>
    </div>
    ${body}
    ${autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
  </body></html>`;
}

function openHtml(html: string) {
  const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close();
}

/** Malların təhvil verilməsi qaiməsi (Goods Despatched Note). */
export function printDeliveryNote(dn: DeliveryNote, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const rows = dn.lineItems.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.description)}</td><td style="text-align:right">${l.quantity}</td><td>${esc(l.unit ?? '')}</td></tr>`).join('');
  const meta = `<div class="muted">№ ${esc(dn.deliveryNoteNumber)}</div><div class="muted">Tarix: ${esc(dn.despatchDate)}</div>`;
  const body = `
    <div class="grid2">
      <div class="box"><h3>Alan (Müştəri)</h3><div>${esc(dn.customerName ?? '')}</div><div class="muted">${esc(dn.deliveryAddress ?? '')}</div></div>
      <div class="box"><h3>Daşınma</h3>
        <div class="kv"><span>Daşıyıcı</span><b>${esc(dn.carrier ?? '—')}</b></div>
        <div class="kv"><span>N/v nömrəsi</span><b>${esc(dn.vehiclePlate ?? '—')}</b></div>
        <div class="kv"><span>Sürücü</span><b>${esc(dn.driverName ?? '—')}</b></div></div>
    </div>
    <table><thead><tr><th>№</th><th>Məhsul/Xidmət</th><th style="text-align:right">Miqdar</th><th>Vahid</th></tr></thead><tbody>${rows}</tbody></table>
    ${dn.notes ? `<p class="muted" style="margin-top:12px">Qeyd: ${esc(dn.notes)}</p>` : ''}
    <div class="sign"><div>Təhvil verdi</div><div>Təhvil aldı</div></div>`;
  openHtml(shell(dn.deliveryNoteNumber, brand, company, 'MALLARIN TƏHVİL-VERİLMƏ QAİMƏSİ', meta, body));
}

/** CMR — əmtəə-nəqliyyat qaiməsi (yerli/beynəlxalq). */
export function printCmr(c: CmrConsignment, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const kind = c.kind === 'international' ? 'BEYNƏLXALQ' : 'YERLİ';
  const meta = `<div class="muted">№ ${esc(c.cmrNumber)} · ${kind}</div><div class="muted">Tarix: ${esc(c.issueDate)}</div>`;
  const body = `
    <div class="grid2">
      <div class="box"><h3>1 — Göndərən</h3><div>${esc(c.senderName)}</div><div class="muted">${esc(c.senderAddress ?? '')}</div></div>
      <div class="box"><h3>2 — Alan</h3><div>${esc(c.consigneeName)}</div><div class="muted">${esc(c.consigneeAddress ?? '')}</div></div>
      <div class="box"><h3>3 — Boşaltma yeri</h3><div>${esc(c.placeOfDelivery ?? '—')}</div>${c.kind === 'international' ? `<div class="muted">Ölkə: ${esc(c.countryTo ?? '')}</div>` : ''}</div>
      <div class="box"><h3>4 — Yükləmə yeri</h3><div>${esc(c.placeOfLoading ?? '—')}</div><div class="muted">Tarix: ${esc(c.loadingDate ?? '')}</div>${c.kind === 'international' ? `<div class="muted">Ölkə: ${esc(c.countryFrom ?? '')}</div>` : ''}</div>
    </div>
    <div class="box" style="margin-top:14px"><h3>Daşıyıcı</h3>
      <div class="kv"><span>Ad</span><b>${esc(c.carrierName ?? '—')}</b></div>
      <div class="kv"><span>N/v · qoşqu</span><b>${esc(c.vehiclePlate ?? '—')} · ${esc(c.trailerPlate ?? '—')}</b></div>
      <div class="kv"><span>Sürücü</span><b>${esc(c.driverName ?? '—')}</b></div></div>
    <div class="box" style="margin-top:14px"><h3>6–12 — Yük</h3>
      <div>${esc(c.goodsDescription ?? '')}</div>
      <div class="kv"><span>Yerlərin sayı</span><b>${esc(c.packages ?? '—')}</b></div>
      <div class="kv"><span>Brutto çəki (kq)</span><b>${esc(c.grossWeightKg ?? '—')}</b></div>
      <div class="kv"><span>Həcm (m³)</span><b>${esc(c.volumeM3 ?? '—')}</b></div></div>
    ${c.notes ? `<p class="muted" style="margin-top:12px">Qeyd: ${esc(c.notes)}</p>` : ''}
    <div class="sign"><div>16 — Göndərən imzası</div><div>23 — Daşıyıcı imzası</div><div>24 — Alan imzası</div></div>`;
  openHtml(shell(c.cmrNumber, brand, company, 'CMR — ƏMTƏƏ-NƏQLİYYAT QAİMƏSİ', meta, body));
}

/** Remittance advice (ödəniş məktubu). */
export function printRemittance(ra: RemittanceAdvice, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const rows = ra.allocations.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.billNumber)}</td><td>${esc(a.billDate ?? '')}</td><td style="text-align:right">${fmt(a.amount, ra.currency)}</td></tr>`).join('');
  const meta = `<div class="muted">№ ${esc(ra.adviceNumber)}</div><div class="muted">Tarix: ${esc(ra.paymentDate)}</div>`;
  const body = `
    <div class="box"><h3>Təchizatçı</h3><div>${esc(ra.vendorName)}</div>
      <div class="kv"><span>Ödəniş üsulu</span><b>${esc(ra.paymentMethod ?? '—')}</b></div>
      <div class="kv"><span>Bank istinadı</span><b>${esc(ra.bankReference ?? '—')}</b></div></div>
    <p style="margin-top:14px">Hörmətli tərəfdaş, aşağıdakı fakturalar üzrə ödəniş həyata keçirilmişdir:</p>
    <table><thead><tr><th>№</th><th>Faktura</th><th>Tarix</th><th style="text-align:right">Məbləğ</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="box" style="margin-top:14px;width:280px;margin-left:auto"><div class="kv"><span>Ümumi ödəniş</span><b style="color:${brand};font-size:15px">${fmt(ra.totalAmount, ra.currency)}</b></div></div>
    ${ra.notes ? `<p class="muted" style="margin-top:12px">Qeyd: ${esc(ra.notes)}</p>` : ''}
    <div class="sign"><div>Hazırladı</div><div>Təsdiq etdi</div></div>`;
  openHtml(shell(ra.adviceNumber, brand, company, 'ÖDƏNİŞ MƏKTUBU (REMITTANCE ADVICE)', meta, body));
}
