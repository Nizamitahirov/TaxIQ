'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen, Building2, Settings, Users, Layers, Upload, ShoppingCart, Package, Wallet,
  UsersRound, FileSpreadsheet, Sparkles, ShieldCheck, GitBranch, Lightbulb, ArrowRight, Rocket,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTT } from '@/lib/i18n/tt';

interface Step { t: string; d: string; href?: string; cta?: string }
interface Section { id: string; icon: typeof BookOpen; tint: string; title: string; desc: string; steps: Step[]; tip?: string }

export default function GuidePage() {
  const tt = useTT();

  const sections: Section[] = useMemo(() => [
    {
      id: 'company', icon: Building2, tint: 'from-indigo-500 to-violet-500',
      title: tt('1. Şirkət yaratmaq', '1. Create a company'),
      desc: tt('Sıfırdan yeni müştəri/şirkət qeydiyyatı — 6 addımlıq sihirbaz.', 'Register a new client/company from scratch — a 6-step wizard.'),
      steps: [
        { t: tt('Sihirbazı aç', 'Open the wizard'), d: tt('«Şirkətlər» → «Yeni şirkət». Yalnız Super Admin şirkət yarada bilər.', 'Companies → New company. Only a Super Admin can create a company.'), href: '/companies/new', cta: tt('Şirkət yarat', 'Create company') },
        { t: tt('Əsas məlumatlar', 'Basic info'), d: tt('Ad, hüquqi ad, VÖEN, hüquqi forma (MMC və s.), sektor seç. Sektora görə standart şöbələr avtomatik qurulur.', 'Name, legal name, tax ID (VÖEN), legal form, sector. Default departments are created based on the sector.') },
        { t: tt('Valyuta və modullar', 'Currency & modules'), d: tt('Baza valyutasını (AZN) və aktiv olacaq modulları seçin (mühasibat, satış, anbar, HR, HSE, CRM…).', 'Pick the base currency (AZN) and the modules to enable (accounting, sales, warehouse, HR, HSE, CRM…).') },
        { t: tt('Direktor və rekvizitlər', 'Director & details'), d: tt('Direktorun adı, ünvan, telefon, e-poçt — bunlar sonradan Tənzimləmələrdə də dəyişilə bilər.', 'Director name, address, phone, email — all editable later in Settings.') },
        { t: tt('Tamamla', 'Finish'), d: tt('Şirkət yaradıldıqdan sonra yuxarıdakı şirkət seçicidən ona keçin.', 'After creation, switch to it via the company switcher at the top.') },
      ],
      tip: tt('Bir neçə şirkəti idarə edirsinizsə, yuxarı paneldəki şirkət seçicidən aktiv şirkəti dəyişin.', 'Managing several companies? Switch the active one from the company switcher in the top bar.'),
    },
    {
      id: 'settings', icon: Settings, tint: 'from-sky-500 to-cyan-500',
      title: tt('2. Tənzimləmələr', '2. Settings'),
      desc: tt('Şirkət rekvizitləri, logo, direktor, valyutalar və əmək haqqı vergisi.', 'Company details, logo, director, currencies and payroll tax.'),
      steps: [
        { t: tt('Şirkət & logo', 'Company & logo'), d: tt('Tənzimləmələr → Şirkət: logo yükləyin (fakturada çıxır) və Direktor adını təyin edin.', 'Settings → Company: upload the logo (appears on invoices) and set the Director name.'), href: '/settings', cta: tt('Tənzimləmələr', 'Open settings') },
        { t: tt('Valyutalar', 'Currencies'), d: tt('İşlədəcəyiniz valyutaları aktivləşdirin; məzənnələr Xəzinə → Valyuta bölməsində idarə olunur.', 'Enable the currencies you use; rates are managed under Treasury → Currency.') },
        { t: tt('Əmək haqqı vergisi', 'Payroll tax'), d: tt('Neft-qaz olmayan / özəl sektor dərəcələri əvvəlcədən qurulub; lazım olsa dövrə görə yeniləyin.', 'Non-oil / private-sector rates are preconfigured; update per period if needed.') },
      ],
    },
    {
      id: 'roles', icon: Users, tint: 'from-amber-500 to-orange-500',
      title: tt('3. İstifadəçilər və rollar', '3. Users & roles'),
      desc: tt('İstifadəçi yaratmaq, rol təyin etmək, icazələri idarə etmək.', 'Create users, assign roles, manage permissions.'),
      steps: [
        { t: tt('İstifadəçi yarat', 'Create a user'), d: tt('İstifadəçilər → Yeni istifadəçi. Tip seçin: Staff (konsultant), Müştəri istifadəçisi və ya Super Admin. Müvəqqəti parol yaradılır.', 'Users → New user. Choose type: Staff (consultant), Client user, or Super Admin. A temporary password is issued.'), href: '/users', cta: tt('İstifadəçilər', 'Open users') },
        { t: tt('Şirkətə təyin et', 'Assign to company'), d: tt('İstifadəçini bir və ya bir neçə şirkətə rol ilə təyin edin (məs. Şirkət admini, Mühasib, Satış meneceri).', 'Assign the user to one or more companies with a role (e.g. Company admin, Accountant, Sales manager).') },
        { t: tt('Rollar və icazələr', 'Roles & permissions'), d: tt('Rollar səhifəsində sistem rolları var; şirkətə özəl rol da yaradıb icazə matrisini fərdiləşdirmək olar.', 'The Roles page has system roles; you can also create a custom role per company and tune the permission matrix.'), href: '/roles', cta: tt('Rollar', 'Open roles') },
        { t: tt('Müştəri baxışı (client_viewer)', 'Client viewer'), d: tt('Müştərinin özünə yalnız-oxu giriş üçün «client_viewer» rolu var — fakturalar, hesabatlar və s. görə bilir, dəyişə bilmir.', 'For read-only client access there is a “client_viewer” role — sees invoices, reports, etc. but cannot edit.') },
      ],
      tip: tt('«İcazə yoxdur» xətası? İstifadəçilər səhifəsində Super Admin «Girişləri sinxronla» düyməsi ilə giriş massivlərini bərpa edə bilər.', 'Permission errors? On the Users page, a Super Admin can repair access with “Re-sync access”.'),
    },
    {
      id: 'coa', icon: Layers, tint: 'from-emerald-500 to-teal-500',
      title: tt('4. Hesablar Planı', '4. Chart of Accounts'),
      desc: tt('Mühasibatın təməli — rəsmi hesablar strukturu.', 'The accounting foundation — the official account structure.'),
      steps: [
        { t: tt('Planı yoxla', 'Review the chart'), d: tt('Mühasibat → Hesablar Planı: Azərbaycan rəsmi strukturu əvvəlcədən yüklənib. Lazım olsa alt-hesab əlavə edin.', 'Accounting → Chart of Accounts: the official Azerbaijani structure is preloaded. Add sub-accounts if needed.'), href: '/accounting', cta: tt('Mühasibat', 'Open accounting') },
        { t: tt('Açılış qalıqları', 'Opening balances'), d: tt('İlk dövr üçün açılış qalıqlarını jurnal yazısı ilə daxil edin.', 'Enter opening balances for the first period via a journal entry.') },
        { t: tt('Posting qaydaları', 'Posting rules'), d: tt('Satış, alış, əmək haqqı əməliyyatlarının hansı hesablara düşəcəyi əvvəlcədən qurulub.', 'Rules mapping sales, purchases and payroll to accounts are preconfigured.') },
      ],
    },
    {
      id: 'import', icon: Upload, tint: 'from-fuchsia-500 to-purple-500',
      title: tt('5. Əsas məlumatlar (Excel idxal)', '5. Master data (Excel import)'),
      desc: tt('Müştəri, təchizatçı, mal və əməkdaşları toplu şəkildə yükləyin.', 'Bulk-load customers, vendors, goods and employees.'),
      steps: [
        { t: tt('Şablonu yüklə', 'Download the template'), d: tt('Tənzimləmələr → Excel idxal: varlığı seçin, boş şablonu (.xlsx) yükləyin.', 'Settings → Excel import: pick the entity, download the empty template (.xlsx).'), href: '/settings', cta: tt('Excel idxal', 'Excel import') },
        { t: tt('Doldur və geri yüklə', 'Fill & upload'), d: tt('Şablonu doldurub geri yükləyin — hər sətir yoxlanır, təkrarlar avtomatik ötürülür.', 'Fill it and upload back — each row is validated, duplicates are skipped.') },
        { t: tt('Önizlə və idxal et', 'Preview & import'), d: tt('Yalnız xətasız sətirlər idxal olunur; önizləmədə xətalı sahələr qırmızı göstərilir.', 'Only error-free rows are imported; invalid fields are highlighted in the preview.') },
      ],
      tip: tt('Az sayda qeyd üçün müvafiq modulda «əlavə et» düyməsindən əl ilə də daxil etmək olar.', 'For a few records you can also add them manually via the “add” button in each module.'),
    },
    {
      id: 'operations', icon: ShoppingCart, tint: 'from-rose-500 to-pink-500',
      title: tt('6. Əməliyyatlar', '6. Day-to-day operations'),
      desc: tt('Satış, alış, anbar və xəzinə əməliyyatları.', 'Sales, purchases, inventory and treasury.'),
      steps: [
        { t: tt('Satış / faktura', 'Sales / invoicing'), d: tt('Satış: faktura, təklif, sifariş, e-qaimə, təkrarlanan fakturalar; çap və PDF önizləmə.', 'Sales: invoices, quotes, orders, e-invoice, recurring invoices; print and PDF preview.'), href: '/sales', cta: tt('Satış', 'Open sales') },
        { t: tt('Alış', 'Purchases'), d: tt('Kassa/Bank → Alışlar: təchizatçı fakturaları və ödənişlər.', 'Cash/Bank → Purchases: vendor bills and payments.'), href: '/cashbank', cta: tt('Kassa/Bank', 'Open cash/bank') },
        { t: tt('Anbar', 'Warehouse'), d: tt('Anbar: mal qəbulu/çıxışı, FIFO, inventarizasiya, qiymət siyahıları, barkod.', 'Warehouse: goods in/out, FIFO, stock counts, price lists, barcode.'), href: '/warehouse', cta: tt('Anbar', 'Open warehouse') },
        { t: tt('Xəzinə', 'Treasury'), d: tt('Kassa/Bank: ödənişlər, valyuta/məzənnə, bank uzlaşdırma, gündəlik bağlanış.', 'Cash/Bank: payments, FX rates, bank reconciliation, daily close.') },
      ],
    },
    {
      id: 'hr', icon: UsersRound, tint: 'from-blue-500 to-indigo-500',
      title: tt('7. HR və Əmək haqqı', '7. HR & Payroll'),
      desc: tt('İşçilər, tabel, məzuniyyət və əmək haqqı hesablanması.', 'Employees, timesheets, leave and payroll.'),
      steps: [
        { t: tt('İşçiləri əlavə et', 'Add employees'), d: tt('İnsan Resursları → İşçilər: şəxsi məlumat, FİN, vəzifə, maaş, «əsas iş yeri», xarici əməkdaş sahələri.', 'HR → Employees: personal info, FİN, position, salary, “primary workplace”, foreign-employee fields.'), href: '/hr', cta: tt('İnsan Resursları', 'Open HR') },
        { t: tt('Tabel və məzuniyyət', 'Timesheet & leave'), d: tt('İş vaxtı tabelini qurun, məzuniyyət növlərini və tələbləri idarə edin — bunlar hesabatlara real data verir.', 'Build the work-time timesheet, manage leave types and requests — these feed real data into reports.') },
        { t: tt('Əmək haqqı hesabla', 'Run payroll'), d: tt('Əmək haqqı: ayı seçin, hesablayın, təsdiqləyin — vergi/sığorta avtomatik hesablanır.', 'Payroll: select the month, calculate, approve — tax/insurance are computed automatically.'), href: '/payroll', cta: tt('Əmək haqqı', 'Open payroll') },
      ],
    },
    {
      id: 'reports', icon: FileSpreadsheet, tint: 'from-teal-500 to-emerald-500',
      title: tt('8. Hesabatlar', '8. Reports'),
      desc: tt('IFRS maliyyə hesabatları və rəsmi dövlət (DSMF) formaları.', 'IFRS financials and official government (DSMF) forms.'),
      steps: [
        { t: tt('Rəsmi hesabatlar', 'Statutory reports'), d: tt('Əmək haqqı → Rəsmi hesabatlar: DSMF formaları + əmək haqqı cədvəli + iş vaxtı tabeli real data ilə dolur; önizlə və .xlsx yüklə.', 'Payroll → Statutory reports: DSMF forms + salary table + time record fill with real data; preview and download .xlsx.'), href: '/payroll', cta: tt('Rəsmi hesabatlar', 'Statutory reports') },
        { t: tt('IFRS hesabatları', 'IFRS statements'), d: tt('IFRS: Balans, Mənfəət-Zərər, Pul vəsaitlərinin hərəkəti, Kapital — ixrac oluna bilir.', 'IFRS: Balance sheet, P&L, Cash flow, Equity — exportable.'), href: '/ifrs', cta: tt('IFRS', 'Open IFRS') },
        { t: tt('Hesabat qurucusu', 'Report builder'), d: tt('Hesabatlar: fərdi hesabatlar qurun və ixrac edin.', 'Reports: build and export custom reports.'), href: '/reports', cta: tt('Hesabatlar', 'Open reports') },
      ],
    },
    {
      id: 'more', icon: Sparkles, tint: 'from-violet-500 to-fuchsia-500',
      title: tt('9. CRM, SƏTƏM və İş axını', '9. CRM, HSE & Workflow'),
      desc: tt('Satış boru xətti, təhlükəsizlik və təsdiq axınları.', 'Sales pipeline, safety, and approval flows.'),
      steps: [
        { t: tt('CRM', 'CRM'), d: tt('Lead, imkan (pipeline), kontakt, kampaniya və fəaliyyətlər — satışa çevirmə ilə.', 'Leads, opportunities (pipeline), contacts, campaigns and activities — with conversion to sales.'), href: '/crm', cta: tt('CRM', 'Open CRM') },
        { t: tt('SƏTƏM (HSE)', 'HSE'), d: tt('Təlimlər, auditlər, iş icazələri, sənəd kitabxanası.', 'Trainings, audits, work permits, document library.'), href: '/hse', cta: tt('SƏTƏM', 'Open HSE') },
        { t: tt('İş axını', 'Workflow'), d: tt('Təsdiq axınları qurun (məzuniyyət, faktura, əmək haqqı) və inbox-dan təsdiqləyin.', 'Build approval flows (leave, invoices, payroll) and approve from the inbox.'), href: '/workflow', cta: tt('İş axını', 'Open workflow') },
      ],
    },
  ], [tt]);

  return (
    <div>
      <PageHeader
        title={tt('İstifadəçi Təlimatı', 'User Guide')}
        subtitle={tt('Sıfırdan şirkət qurulması və bütün proseslərin ardıcıllığı', 'Setting up a company from scratch and the full process sequence')}
      />

      {/* Giriş / axın xülasəsi */}
      <Card className="mb-6 overflow-hidden rounded-card border-0 bg-gradient-to-br from-[#5B5BF5] to-[#8B3DF0] text-white">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Rocket className="h-6 w-6" /></span>
            <div>
              <h2 className="text-lg font-bold">{tt('Tövsiyə olunan quraşdırma ardıcıllığı', 'Recommended setup sequence')}</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/85">{tt('Aşağıdakı 9 addımı ardıcıllıqla izləsəniz, platforma tam işlək vəziyyətə gələcək. Hər bölmədən birbaşa müvafiq səhifəyə keçə bilərsiniz.', 'Follow the 9 steps below in order and the platform will be fully operational. Each section links straight to the relevant page.')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs font-medium">
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-full bg-white/15 px-2.5 py-1 transition hover:bg-white/25">{i + 1}</a>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
        {/* Sticky mündəricat */}
        <aside className="mb-6 hidden lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tt('Mündəricat', 'Contents')}</p>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                <s.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{s.title}</span>
              </a>
            ))}
            <a href="#tips" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <Lightbulb className="h-4 w-4 shrink-0" /> <span className="truncate">{tt('Məsləhətlər', 'Tips')}</span>
            </a>
          </div>
        </aside>

        {/* Bölmələr */}
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <Card className="rounded-card">
                <CardContent className="p-6">
                  <div className="mb-5 flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} text-white shadow-soft`}>
                      <s.icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>

                  <ol className="space-y-4">
                    {s.steps.map((st, i) => (
                      <li key={i} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{st.t}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{st.d}</p>
                          {st.href && (
                            <Button asChild size="sm" variant="outline" className="mt-2 h-8">
                              <Link href={st.href}>{st.cta ?? tt('Aç', 'Open')} <ArrowRight className="h-3.5 w-3.5" /></Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  {s.tip && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> <span>{s.tip}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          ))}

          {/* Ümumi məsləhətlər */}
          <section id="tips" className="scroll-mt-24">
            <Card className="rounded-card">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600"><Lightbulb className="h-5 w-5" /></span>
                  <h3 className="text-lg font-bold tracking-tight">{tt('Faydalı məsləhətlər', 'Handy tips')}</h3>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    tt('⌘K / Ctrl+K ilə istənilən səhifəni və ya qeydi tez tapın.', 'Press ⌘K / Ctrl+K to quickly find any page or record.'),
                    tt('Yuxarı paneldə dil (AZ/EN), tema və hesabat ilini dəyişə bilərsiniz.', 'Switch language (AZ/EN), theme and reporting year from the top bar.'),
                    tt('«Yarат» (+) menyusundan istənilən yerdən yeni faktura, işçi, müştəri əlavə edin.', 'Use the “Create” (+) menu to add invoices, employees, customers from anywhere.'),
                    tt('Hesabatları yükləmədən əvvəl həmişə önizləyin — şablon strukturu qorunur.', 'Always preview reports before downloading — the template structure is preserved.'),
                    tt('Bölmələr (Workspaces) səhifəsi bütün modullara sürətli giriş verir.', 'The Workspaces page gives fast access to every module.'),
                    tt('Hər siyahıda axtarış və filtrlər var; ixrac düyməsi ilə Excel-ə çıxarın.', 'Every list has search and filters; export to Excel with the export button.'),
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                      <span className="text-primary">•</span> <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
