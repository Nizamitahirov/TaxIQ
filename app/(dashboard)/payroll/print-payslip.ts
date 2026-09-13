import type { Company, PayrollRun } from '@/types';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const fmt = (n: number, cur: string) => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + cur;
const esc = (s: string) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] ?? c));

/** Hər işçi üçün payslip (06 §6 dizayner infrastrukturunun sadə alternativi) */
export function printPayslips(run: PayrollRun, company: Company, cur: string) {
  const brand = company.brandColor || '#5B5BF5';
  const period = `${MONTHS[run.periodMonth - 1]} ${run.periodYear}`;
  const slips = run.lines.map((l) => `
    <div class="slip">
      <div class="hd"><div><strong>${esc(company.name)}</strong><div class="muted">${esc(company.legalName ?? '')}</div></div>
        <div style="text-align:right"><div class="title">Əmək haqqı vərəqəsi</div><div class="muted">${period}</div></div></div>
      <p><strong>İşçi:</strong> ${esc(l.employeeName)}</p>
      <table>
        <tr><td>Əsas əmək haqqı</td><td class="r">${fmt(l.baseSalary, cur)}</td></tr>
        <tr><td>Əlavə iş / bonus</td><td class="r">${fmt(l.overtimePay + l.bonuses, cur)}</td></tr>
        <tr class="b"><td>Gross</td><td class="r">${fmt(l.grossSalary, cur)}</td></tr>
        <tr><td>Gəlir vergisi</td><td class="r">−${fmt(l.incomeTax, cur)}</td></tr>
        <tr><td>Sosial sığorta</td><td class="r">−${fmt(l.employeeSocialInsurance, cur)}</td></tr>
        <tr><td>Tibbi sığorta</td><td class="r">−${fmt(l.employeeMedicalInsurance, cur)}</td></tr>
        <tr><td>İşsizlik sığortası</td><td class="r">−${fmt(l.employeeUnemploymentInsurance, cur)}</td></tr>
        ${l.otherDeductions ? `<tr><td>Digər kəsintilər</td><td class="r">−${fmt(l.otherDeductions, cur)}</td></tr>` : ''}
        <tr class="net"><td>NET (ödəniləcək)</td><td class="r">${fmt(l.netSalary, cur)}</td></tr>
      </table>
      <div class="muted" style="margin-top:8px">İşəgötürən xərci (informativ): ${fmt(l.totalEmployerCost, cur)}</div>
    </div>`).join('');

  const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>Payslip ${period}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
    body{font-family:Montserrat,Arial,sans-serif;color:#0f1129;margin:0;padding:24px}
    .slip{border:1px solid #e7e9f2;border-radius:12px;padding:20px;margin-bottom:16px;page-break-inside:avoid}
    .hd{display:flex;justify-content:space-between;border-bottom:2px solid ${brand};padding-bottom:10px;margin-bottom:10px}
    .title{font-weight:800;color:${brand}} .muted{color:#6b6f8a;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:13px} td{padding:5px 0;border-bottom:1px solid #f0f1f6} .r{text-align:right}
    .b td{font-weight:700;border-top:1px solid #ccc} .net td{font-weight:800;color:${brand};font-size:15px;border-top:2px solid ${brand}}
  </style></head><body>${slips}<script>window.onload=function(){window.print()}</script></body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
