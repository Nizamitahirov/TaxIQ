import type { Company, Employee, HROrder, HROrderType, ServiceContract } from '@/types';

/**
 * HR sənəd şablonları — əmrlər, əmək müqaviləsi, xidməti müqavilə və
 * elektron əmək müqaviləsi bildirişi (10 §2.2, §7). Brauzerdə çap üçün HTML.
 */

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));
const azDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const money = (n: number, cur = 'AZN') => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur;

export const ORDER_TYPE_LABEL: Record<HROrderType, string> = {
  hire: 'İşə qəbul əmri', termination: 'İşdən azad etmə əmri', leave: 'Məzuniyyət əmri',
  business_trip: 'Ezamiyyət əmri', bonus: 'Mükafatlandırma əmri', penalty: 'İntizam tənbehi əmri',
  transfer: 'Vəzifə dəyişikliyi əmri', salary_change: 'Əmək haqqı dəyişikliyi əmri',
};

/** İngiliscə əmr növü adları (i18n interfeys üçün — sənəd mətni AZ qalır) */
export const ORDER_TYPE_LABEL_EN: Record<HROrderType, string> = {
  hire: 'Hire order', termination: 'Termination order', leave: 'Leave order',
  business_trip: 'Business trip order', bonus: 'Bonus order', penalty: 'Disciplinary penalty order',
  transfer: 'Position change order', salary_change: 'Salary change order',
};

const CONTRACT_TYPE_LABEL: Record<string, string> = { indefinite: 'müddətsiz', fixed_term: 'müddətli' };

/** Əmr növünə görə hazır mətn şablonu (redaktə edilə bilər) */
export function buildOrderText(type: HROrderType, emp: Employee, meta: Record<string, string> = {}): { title: string; body: string } {
  const name = `${emp.firstName} ${emp.lastName}`;
  const pos = emp.position ?? 'işçi';
  switch (type) {
    case 'hire':
      return { title: ORDER_TYPE_LABEL.hire,
        body: `${name} ${azDate(meta.effectiveDate)} tarixindən «${pos}» vəzifəsinə ${meta.salary ? meta.salary + ' AZN əmək haqqı ilə ' : ''}işə qəbul edilsin.\nƏmək müqaviləsi Əmək Məcəlləsinin 49-cu maddəsinə uyğun elektron sistemdə qeydiyyata alınsın.` };
    case 'termination':
      return { title: ORDER_TYPE_LABEL.termination,
        body: `${name} «${pos}» vəzifəsindən ${azDate(meta.effectiveDate)} tarixindən azad edilsin.\nƏsas: ${meta.reason ?? '—'}.\nİstifadə edilməmiş məzuniyyət günlərinə görə (əsas və əlavə) tam kompensasiya ödənilsin${meta.compensationDays ? ` (${meta.compensationDays} gün)` : ''}.` };
    case 'leave':
      return { title: ORDER_TYPE_LABEL.leave,
        body: `${name}-ə ${azDate(meta.startDate)} — ${azDate(meta.endDate)} tarixləri üçün ${meta.days ?? ''} təqvim günü ${meta.leaveType ?? 'əsas'} məzuniyyəti verilsin.` };
    case 'business_trip':
      return { title: ORDER_TYPE_LABEL.business_trip,
        body: `${name} ${azDate(meta.startDate)} — ${azDate(meta.endDate)} tarixlərində ${meta.destination ?? ''} təyinatı üzrə ezam edilsin.\nMəqsəd: ${meta.purpose ?? '—'}.\nEzamiyyət xərcləri müvafiq normalar üzrə ödənilsin${meta.totalCost ? ` (${meta.totalCost})` : ''}.` };
    case 'bonus':
      return { title: ORDER_TYPE_LABEL.bonus,
        body: `${name} «${pos}» vəzifəsi üzrə göstərdiyi nəticələrə görə ${meta.amount ?? ''} məbləğində mükafatlandırılsın.` };
    case 'penalty':
      return { title: ORDER_TYPE_LABEL.penalty,
        body: `${name}-ə əmək intizamının pozulmasına görə ${meta.penalty ?? 'töhmət'} intizam tənbehi verilsin.\nƏsas: ${meta.reason ?? '—'}.` };
    case 'transfer':
      return { title: ORDER_TYPE_LABEL.transfer,
        body: `${name} ${azDate(meta.effectiveDate)} tarixindən «${meta.newPosition ?? ''}» vəzifəsinə keçirilsin.` };
    case 'salary_change':
      return { title: ORDER_TYPE_LABEL.salary_change,
        body: `${name}-in əmək haqqı ${azDate(meta.effectiveDate)} tarixindən ${meta.newSalary ?? ''} AZN müəyyən edilsin.` };
    default:
      return { title: 'Əmr', body: '' };
  }
}

function printHtml(title: string, brand: string, inner: string) {
  const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
    body{font-family:Montserrat,Arial,sans-serif;color:#0f1129;margin:0;padding:32px;line-height:1.55}
    .doc{max-width:760px;margin:0 auto}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${brand};padding-bottom:12px;margin-bottom:20px}
    .brand{font-weight:800;font-size:18px}.muted{color:#6b6f8a;font-size:12px}
    h1{font-size:18px;text-align:center;margin:18px 0}.no{text-align:center;color:#6b6f8a;font-size:13px;margin-bottom:18px}
    .body{white-space:pre-wrap;font-size:14px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
    td,th{padding:7px 8px;border:1px solid #e7e9f2;text-align:left;vertical-align:top}
    th{background:#f6f7fb;width:38%}
    .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}
    .sign div{width:45%}.line{border-top:1px solid #333;margin-top:36px;padding-top:4px;color:#6b6f8a}
    @media print{body{padding:0}}
  </style></head><body><div class="doc">${inner}</div>
  <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

const header = (company: Company) => `<div class="hd">
  <div><div class="brand">${esc(company.name)}</div><div class="muted">${esc(company.legalName ?? '')}${company.taxId ? ' · VÖEN ' + esc(company.taxId) : ''}</div></div>
  <div class="muted" style="text-align:right">${esc(company.address ?? '')}</div>
</div>`;

/** HR əmri (decree) çapı */
export function printHROrder(order: HROrder, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  printHtml(order.title, brand, `${header(company)}
    <h1>Ə M R</h1>
    <div class="no">№ ${esc(order.orderNumber)} · ${azDate(order.orderDate)}</div>
    <div class="body">${esc(order.body)}</div>
    <div class="sign"><div><div class="line">Direktor (imza)</div></div><div><div class="line">Tanış oldum: ${esc(order.employeeName ?? '')} (imza)</div></div></div>`);
}

/** Əmək müqaviləsi (labor contract) çapı */
export function printLaborContract(emp: Employee, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const rows = `
    <table>
      <tr><th>İşəgötürən</th><td>${esc(company.legalName ?? company.name)}${company.taxId ? ', VÖEN ' + esc(company.taxId) : ''}</td></tr>
      <tr><th>İşçi</th><td>${esc(emp.firstName)} ${esc(emp.lastName)} ${esc(emp.fatherName ?? '')}</td></tr>
      <tr><th>FİN</th><td>${esc(emp.personalId ?? '—')}</td></tr>
      <tr><th>Vəzifə</th><td>${esc(emp.position ?? '—')}</td></tr>
      <tr><th>Müqavilə növü</th><td>${CONTRACT_TYPE_LABEL[emp.contractType ?? 'indefinite']}${emp.contractEndDate ? ', bitmə: ' + azDate(emp.contractEndDate) : ''}</td></tr>
      <tr><th>İşə başlama tarixi</th><td>${azDate(emp.hireDate)}</td></tr>
      <tr><th>Əmək haqqı</th><td>${money(emp.baseSalary, emp.currency ?? 'AZN')} (aylıq)</td></tr>
      <tr><th>İş rejimi</th><td>Həftədə 40 saat (Əmək Məcəlləsi standartı)</td></tr>
      <tr><th>Bank hesabı (IBAN)</th><td>${esc(emp.bankAccountIban ?? '—')}</td></tr>
    </table>`;
  printHtml('Əmək müqaviləsi', brand, `${header(company)}
    <h1>ƏMƏK MÜQAVİLƏSİ</h1>
    <div class="no">№ ${esc(emp.contractNumber ?? '—')} · ${azDate(emp.hireDate)}</div>
    <p class="body">Aşağıda göstərilən tərəflər Azərbaycan Respublikasının Əmək Məcəlləsinə uyğun olaraq bu əmək müqaviləsini bağladılar. Müqavilə Əmək Məcəlləsinin 49-cu maddəsinə əsasən elektron informasiya sistemində qeydiyyata alındıqdan sonra hüquqi qüvvəyə minir.</p>
    ${rows}
    <p class="muted">Tərəflərin hüquq və vəzifələri Əmək Məcəlləsi və şirkətin daxili qaydaları ilə tənzimlənir.</p>
    <div class="sign"><div><div class="line">İşəgötürən (imza, möhür)</div></div><div><div class="line">İşçi (imza)</div></div></div>`);
}

/** Xidməti (mülki-hüquqi) müqavilə çapı */
export function printServiceContract(c: ServiceContract, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const rows = `
    <table>
      <tr><th>Sifarişçi</th><td>${esc(company.legalName ?? company.name)}${company.taxId ? ', VÖEN ' + esc(company.taxId) : ''}</td></tr>
      <tr><th>İcraçı</th><td>${esc(c.contractorName)} (${c.contractorType === 'individual' ? 'fiziki şəxs' : 'hüquqi şəxs'})${c.contractorId ? ', ' + esc(c.contractorId) : ''}</td></tr>
      <tr><th>Xidmətin predmeti</th><td>${esc(c.subject)}</td></tr>
      <tr><th>Müddət</th><td>${azDate(c.startDate)}${c.endDate ? ' — ' + azDate(c.endDate) : ''}</td></tr>
      <tr><th>Məbləğ</th><td>${money(c.amount, c.currency)}${c.withholdTax ? ' (ödəniş mənbəyində vergi tutulur)' : ''}</td></tr>
      <tr><th>Ödəniş şərtləri</th><td>${esc(c.paymentTerms ?? '—')}</td></tr>
    </table>`;
  printHtml('Xidmət müqaviləsi', brand, `${header(company)}
    <h1>XİDMƏT (MÜLKİ-HÜQUQİ) MÜQAVİLƏSİ</h1>
    <div class="no">№ ${esc(c.contractNumber)} · ${azDate(c.startDate)}</div>
    <p class="body">Bu müqavilə Azərbaycan Respublikasının Mülki Məcəlləsinə uyğun olaraq xidmətlərin göstərilməsi barədə bağlanır. Bu, əmək münasibəti yaratmır.</p>
    ${rows}
    <div class="sign"><div><div class="line">Sifarişçi (imza, möhür)</div></div><div><div class="line">İcraçı (imza)</div></div></div>`);
}

/** Elektron əmək müqaviləsi bildirişi — struktur forma (10 §2.2, kopyala/çap üçün) */
export function printEContractNotification(emp: Employee, company: Company) {
  const brand = company.brandColor || '#5B5BF5';
  const rows = `
    <table>
      <tr><th>İşəgötürənin adı</th><td>${esc(company.legalName ?? company.name)}</td></tr>
      <tr><th>İşəgötürənin VÖEN-i</th><td>${esc(company.taxId ?? '—')}</td></tr>
      <tr><th>İşçinin soyadı, adı, atasının adı</th><td>${esc(emp.lastName)} ${esc(emp.firstName)} ${esc(emp.fatherName ?? '')}</td></tr>
      <tr><th>İşçinin FİN-i</th><td>${esc(emp.personalId ?? '—')}</td></tr>
      <tr><th>Vəzifə</th><td>${esc(emp.position ?? '—')}</td></tr>
      <tr><th>Əmək müqaviləsinin nömrəsi</th><td>${esc(emp.contractNumber ?? '—')}</td></tr>
      <tr><th>Müqavilənin növü</th><td>${CONTRACT_TYPE_LABEL[emp.contractType ?? 'indefinite']}</td></tr>
      <tr><th>İşə başlama tarixi</th><td>${azDate(emp.hireDate)}</td></tr>
      <tr><th>Aylıq əmək haqqı</th><td>${money(emp.baseSalary, emp.currency ?? 'AZN')}</td></tr>
    </table>`;
  printHtml('E-müqavilə bildirişi', brand, `${header(company)}
    <h1>ELEKTRON ƏMƏK MÜQAVİLƏSİ BİLDİRİŞİ</h1>
    <div class="no">Əmək Məcəlləsi maddə 49 · e-social.gov.az</div>
    <p class="body">Aşağıdakı məlumatlar e-gov.az / e-social.gov.az portalına daxil edilməli və ASAN İmza ilə təsdiqlənməlidir. Qeydiyyat nömrəsi alındıqdan sonra sistemə daxil edin.</p>
    ${rows}
    <p class="muted">Qeyd: Tam avtomatik API inteqrasiyası (ASAN İmza SDK) MVP əhatəsindən kənardadır — bu forma əl ilə daxiletmə üçün hazırlanıb.</p>`);
}
