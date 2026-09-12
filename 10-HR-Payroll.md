# TaxIQ ERP — Modul 10: HR və Əmək Haqqı (Payroll) Modulu

> **Sənəd statusu:** 10 fayldan sonuncusu (10/10). Bu sənəd işçi qeydiyyatından işdən çıxarılmasına qədər bütün HR həyat dövrünü, məzuniyyət idarəetməsini, iş vaxtı uçotunu, əmək haqqı hesablanmasını, Azərbaycanın **elektron əmək müqaviləsi bildirişi sisteminə** inteqrasiya nöqtəsini və Fayl 7-dəki bank fayl mexanizmi vasitəsilə əmək haqqı ödənişini təsvir edir. Sənədin sonunda bütün 10 modulun necə bir-birinə bağlandığının xülasəsi verilir.

---

## 1. İşçi Profili (Employee Master Data)

### 1.1. `employees/{employeeId}` sənəd sxemi

```
employees/{employeeId}
├── companyId: string
├── employeeCode: string                // daxili ardıcıl nömrə
├── firstName, lastName, fatherName: string
├── personalId: string                  // FİN (Fərdi İdentifikasiya Nömrəsi)
├── birthDate: timestamp, gender: 'male' | 'female'
├── contactInfo: { phone, email, address }
├── position: string, departmentId: string    // Fayl 2, Bölmə 4-ə istinad
├── employmentType: 'full_time' | 'part_time' | 'contract'
├── hireDate: timestamp
├── contractNumber: string, contractType: 'indefinite' | 'fixed_term'
├── contractEndDate: timestamp | null   // yalnız fixed_term üçün
├── baseSalary: number, currency: string
├── bankAccountIban: string             // əmək haqqı ödənişi üçün, Fayl 7-yə istinad
├── status: 'active' | 'on_leave' | 'terminated'
├── terminationDate: timestamp | null, terminationReason: string | null
├── laborContractNotification: {        // bax Bölmə 2.2
│     submittedToEGov: boolean,
│     eGovReferenceNumber: string | null,
│     submittedAt: timestamp | null
│   }
├── documents: [{ type: string, fileUrl: string, uploadedAt: timestamp }]
├── customFieldValues: { [key]: any }
└── createdAt, updatedAt, createdBy
```

- **Həssas sahə qorunması:** `baseSalary` sahəsinə giriş Fayl 1, Bölmə 6.2-dəki `hr.employee.salary.view` icazəsi ilə məhdudlaşdırılır — bu icazəsi olmayan istifadəçi işçi kartını görür, maaş sahəsi maskalanır.

---

## 2. İşə Qəbul (Onboarding) Prosesi

### 2.1. Daxili Axın

Yeni işçi yaradıldıqda Fayl 4-ün **"Yeni İşçi Onboarding Checklist"** workflow şablonu avtomatik tetiklənir (`on_create` trigger, `employees` entity) — IT hesabı yaratma tapşırığı, sənəd toplama tapşırığı, 3 gün sonra rəhbərə xatırlatma (Fayl 4, Bölmə 7.2-dəki nümunə).

### 2.2. Elektron Əmək Müqaviləsi Bildirişi — Qanuni Tələb

Azərbaycan Əmək Məcəlləsinin 49-cu maddəsinə əsasən, **əmək müqaviləsinin bağlanması yalnız Əmək və Əhalinin Sosial Müdafiəsi Nazirliyinin elektron informasiya sistemində (e-gov.az / e-social.gov.az) qeydiyyatdan keçdikdən və işəgötürənə elektron təsdiq göndərildikdən sonra hüquqi qüvvəyə minir**. Bildiriş gücləndirilmiş elektron imza (ASAN İmza) ilə təqdim olunur. Bu tələb işə qəbula, müqavilə dəyişikliyinə və işdən çıxarmaya bərabər aiddir.

**MVP Yanaşması (Fayl 6/7-dəki eyni prinsiplə şəffaf qeyd olunur):** Tam avtomatik API inteqrasiyası (ASAN İmza SDK, Nazirliyin rəsmi sertifikatlaşdırılmış inteqrasiyası) bu 10 faylın ilkin əhatəsindən kənardadır. İlkin versiyada:
1. Sistem işçi məlumatlarına əsasən bildiriş formasının **tələb olunan sahələrini strukturlaşdırılmış şəkildə** göstərir (kopyalama/çap üçün hazır).
2. HR mütəxəssisi bu məlumatı əl ilə e-gov.az portalına daxil edir, ASAN İmza ilə təsdiqləyir.
3. Nazirlikdən gələn qeydiyyat nömrəsini sistemə daxil edir (`laborContractNotification.eGovReferenceNumber`), status "Qeydiyyata alınıb" olur.
4. **Sistem işçinin statusu `active` olsa belə, bildiriş təsdiqlənməyibsə, Dashboard-da (Fayl 3) xəbərdarlıq göstərir** — bu, hüquqi risk baxımından vacibdir.

---

## 3. İşdən Çıxarma (Offboarding) Prosesi

### 3.1. Axın

1. HR "İşdən Çıxar" prosesini başladır: son iş günü, səbəb (`resignation`, `mutual_agreement`, `redundancy`, `disciplinary`, `contract_end`), bildiriş müddəti tarixi.
2. Sistem Bölmə 2.2-dəki eyni elektron bildiriş MVP axınını **xitam** üçün tələb edir (Əmək Məcəlləsi eyni maddəsi ilə).
3. **Kompensasiya hesablanması:** 2026-cı il fevralın 18-də Azərbaycan Respublikası Konstitusiya Məhkəməsinin qərarına əsasən, **işdən çıxarılma səbəbindən asılı olmayaraq, işəgötürən istifadə edilməmiş həm əsas, həm əlavə məzuniyyət günlərinə görə tam kompensasiya ödəməyə borcludur** — sistem `leaveBalances`-dəki (Bölmə 4) qalan gün sayını avtomatik son əmək haqqı hesablamasına (Bölmə 6) daxil edir.
4. Status `terminated` olur, `employees.status` dəyişir, gələcək payroll dövrlərindən avtomatik çıxarılır.

---

## 4. Məzuniyyət və İşdən Ayrılma Halları (Leave Management)

### 4.1. `leaveTypes/{leaveTypeId}` — Əmək Məcəlləsi Minimum Tələblərinə Uyğun Sistem Şablonları

| Kod | Ad | Ödənişli? | Defolt Gün/Şərt |
|---|---|---|---|
| `annual` | Əsas Məzuniyyət | Bəli | Minimum 21 təqvim günü (bəzi peşə kateqoriyaları üçün 30 gün — Company səviyyəsində vəzifəyə görə fərqləndirilə bilər) |
| `additional` | Əlavə Məzuniyyət | Bəli | İş stajına/əmək şəraitinə görə (Company konfiqurasiyası) |
| `sick` | Xəstəlik Vərəqəsi | Bəli (sosial sığorta vasitəsilə) | Həkim arayışı əsasında, gün sayı məhdudiyyətsiz |
| `maternity` | Hamiləlik və Doğuş Məzuniyyəti | Bəli | 126 təqvim günü (70 doğuşdan əvvəl + 56 sonra, mürəkkəb doğuşda +14 gün) |
| `paternity_unpaid` | Ata Məzuniyyəti (ödənişsiz) | Xeyr | 14 gün (və ya alternativ 7 gün ailə/sosial səbəblərlə) |
| `unpaid` | Ödənişsiz Məzuniyyət | Xeyr | Tərəflərin razılığı ilə |
| `other` | Digər (təhsil, hüzn s.) | Company konfiqurasiyası | Sərbəst |

> ⚠️ **Qeyd:** Yuxarıdakı rəqəmlər Əmək Məcəlləsinin **ilkin quraşdırma zamanı bilinən** minimum tələbləridir. Əmək qanunvericiliyi dəyişə bilər, ona görə bu dəyərlər `leaveTypes` sənədində **konfiqurasiya edilə bilən sahələr** kimi saxlanılır, sərt kodlaşdırılmır — Company Admin/HR Meneceri hüquqi məsləhətlə yenilədə bilər.

### 4.2. `leaveBalances/{employeeId}_{year}` — İllik Balans

```
leaveBalances/{employeeId}_{year}
├── employeeId, year: string/number
├── balances: [{
│     leaveTypeId: string,
│     entitledDays: number,        // ilin əvvəlində hesablanan haqq
│     usedDays: number,
│     remainingDays: number,
│     carriedOverFromPreviousYear: number   // Əmək Məcəlləsi: maksimum 2 il üst-üstə yığıla bilər
│   }]
└── updatedAt: timestamp
```

- Yanvarın 1-də Cloud Scheduler avtomatik yeni il balansını yaradır (əvvəlki ilin istifadə olunmamış günlərini `carriedOverFromPreviousYear`-a köçürür, 2 illik məhdudiyyəti yoxlayır).

### 4.3. `leaveRequests/{requestId}` — Təsdiq Axını

```
leaveRequests/{requestId}
├── companyId, employeeId, leaveTypeId: string
├── startDate, endDate: timestamp, totalDays: number
├── status: 'pending' | 'approved' | 'rejected' | 'cancelled'
├── approvalWorkflowRunId: string | null   // Fayl 4-ə istinad
├── reason: string | null
├── attachmentUrl: string | null           // həkim arayışı s.
└── createdAt, createdBy
```

Yaradılan kimi Fayl 4-ün **"Məzuniyyət Tələbi Təsdiqi"** şablonu (birbaşa rəhbərə sequential approval) tetiklənir. Təsdiqləndikdə `leaveBalances.usedDays` avtomatik artırılır.

---

## 5. İş Vaxtının Uçotu (Timesheet / Tabel)

### 5.1. `timesheetEntries/{entryId}` — Gündəlik Qeyd

```
timesheetEntries/{entryId}
├── companyId, employeeId: string
├── date: timestamp
├── checkIn, checkOut: timestamp | null    // manual rejimdə boş qala bilər
├── hoursWorked: number
├── overtimeHours: number
├── dayType: 'workday' | 'weekend' | 'public_holiday'
├── status: 'present' | 'absent' | 'on_leave' | 'sick'
└── source: 'manual' | 'self_checkin'
```

- **Normal iş həftəsi:** 40 saat (Əmək Məcəlləsi standartı), gündəlik defolt 8 saat — Company konfiqurasiyasında dəyişdirilə bilər.
- **Overtime (Əlavə İş Vaxtı):** standart dərəcədən yüksək əmsalla ödənilir (Company tənzimləməsində əmsal, məs. ×1.5 — Əmək Məcəlləsi minimumuna uyğun) — Bölmə 6-da payroll hesablamasına daxil olur.
- **Özünü qeydiyyat (self check-in):** mobil brauzerdən "Gəldim/Getdim" düyməsi (Fayl 1-in mobil responsivlik standartına uyğun), opsional həndəsi mövqe (geolocation) təsdiqi ilə.

### 5.2. `monthlyTimesheetSummaries/{employeeId}_{yearMonth}` — Aylıq Xülasə

```
monthlyTimesheetSummaries/{employeeId}_{yearMonth}
├── employeeId, yearMonth: string
├── totalWorkedHours, totalOvertimeHours: number
├── absenceDays, leaveDays, sickDays: number
├── status: 'draft' | 'submitted' | 'approved'
└── approvedBy: string | null
```

Bu sənəd Cloud Function tərəfindən gündəlik qeydlərdən avtomatik aqreqasiya olunur və **yalnız `approved` statusunda olan aylıq xülasə** Bölmə 6-nın əmək haqqı hesablanmasına daxil edilə bilər (nəzarət nöqtəsi).

---

## 6. Əmək Haqqı Hesablanması (Payroll Calculation)

### 6.1. Konfiqurasiya Edilə Bilən Vergi/Sığorta Parametrləri — **Sərt Kodlaşdırma QADAĞANDIR**

> **Ən vacib dizayn qərarı:** Azərbaycanda gəlir vergisi dərəcələri, sosial sığorta, tibbi sığorta və işsizlik sığortası dərəcələri **tez-tez dəyişir** (məs. 2026-cı ildə mütərəqqi gəlir vergisi sistemi tətbiq olundu, sosial/tibbi sığorta dərəcələri yenidən nəzərdən keçirildi). Bu parametrlər **heç bir halda kodda sabit rəqəm kimi yazılmır** — tam konfiqurasiya edilə bilən, **tarixə görə versiyalanan** bir kolleksiyada saxlanılır:

```
payrollTaxConfigs/{configId}
├── effectiveFrom: timestamp, effectiveTo: timestamp | null
├── minimumWage: number
├── incomeTaxBrackets: [{ uptoAmount: number | null, rate: number, fixedAmount: number }]
├── socialInsurance: {
│     employeeBaseRate: number, employeeBaseThreshold: number,
│     employeeRateAboveThreshold: number,
│     employerRate: number
│   }
├── medicalInsurance: {
│     employeeRateLowerBand: number, lowerBandThreshold: number, employeeRateUpperBand: number,
│     employerRateLowerBand: number, employerRateUpperBand: number
│   }
├── unemploymentInsurance: { employeeRate: number, employerRate: number }
└── notes: string             // rəsmi mənbəyə istinad (Dövlət Vergi Xidməti/DSMF elanı tarixi)
```

**2026-cı il üçün ilkin seed dəyərləri (implementasiya zamanı taxes.gov.az-dan TƏSDİQLƏNMƏLİDİR, çünki rəqəmlər tez-tez yenilənir):**
- Qeyri-neft özəl sektor üçün mütərəqqi gəlir vergisi: 2,500 ₼-ə qədər 14%, üzəri üçün sabit+25% (dəqiq həddlər və 8,000 ₼-lik güzəşt dövrünün statusu implementasiya zamanı yoxlanılmalıdır).
- İşçi sosial sığorta payı: ilk 200 ₼-yə 3%, üzərinə 10%.
- Tibbi sığorta: 2,500 ₼-ə qədər 2%, üzəri 0.5% (işçi və işəgötürən üçün ayrı-ayrı).
- İşsizlik sığortası: işçi 0.5%, işəgötürən 0.5%.
- Minimum əmək haqqı: 400 ₼.

Bu dəyərlər HR/Mühasibat Admin ekranından **yeni versiya əlavə etməklə** yenilənir (köhnə versiya `effectiveTo` ilə bağlanır) — keçmiş dövrlərin payroll hesablamaları həmişə **o dövrdə qüvvədə olan** konfiqurasiya ilə aparılır (tarixi dəqiqlik qorunur).

### 6.2. `payrollRuns/{runId}` sənəd sxemi

```
payrollRuns/{runId}
├── companyId: string, periodMonth: number, periodYear: number
├── status: 'draft' | 'calculated' | 'approved' | 'paid'
├── lines: [{
│     employeeId: string,
│     baseSalary: number,
│     overtimePay: number,
│     bonuses: number,
│     otherDeductions: number,
│     grossSalary: number,
│     incomeTax: number,
│     employeeSocialInsurance: number,
│     employeeMedicalInsurance: number,
│     employeeUnemploymentInsurance: number,
│     netSalary: number,                    // ödəniləcək faktiki məbləğ
│     employerSocialInsurance: number,      // işəgötürən xərci, işçiyə ödənilmir
│     employerMedicalInsurance: number,
│     employerUnemploymentInsurance: number,
│     totalEmployerCost: number             // grossSalary + bütün işəgötürən öhdəlikləri
│   }]
├── totalGross, totalNet, totalEmployerCost: number
├── taxConfigIdUsed: string             // hansı `payrollTaxConfigs` versiyası istifadə olunub (audit üçün)
├── approvedBy: string | null, approvedAt: timestamp | null
├── paymentBatchId: string | null       // Fayl 7-yə istinad
└── createdAt, createdBy
```

### 6.3. Hesablama Axını

1. HR/Mühasib "Yeni Əmək Haqqı Dövrü" yaradır (ay seçir) → sistem bütün `active` işçiləri, onların `baseSalary`-ni, təsdiqlənmiş `monthlyTimesheetSummaries`-dəki overtime saatlarını, təsdiqlənmiş bonusları/kəsintiləri toplayır.
2. Cari tarixə uyğun **effektiv `payrollTaxConfigs`** avtomatik seçilir.
3. Sistem hər işçi üçün ardıcıl hesablayır: Gross → Gəlir Vergisi → Sosial/Tibbi/İşsizlik Sığortası (işçi payı) → Net.
4. Nəticə `draft` statusunda göstərilir, HR/Mühasib nəzərdən keçirir, lazım gələrsə fərdi düzəliş edir.
5. **Təsdiq** (icazə: `payroll.run.approve`, Fayl 4-ün Approval workflow-u könüllü tətbiq oluna bilər — böyük Company-lərdə Baş Mühasib təsdiqi tövsiyə olunur) → status `approved`.
6. Fayl 8-ə **konsolidasiya edilmiş jurnal yazısı** avtomatik göndərilir (Fayl 8, Bölmə 2.3-dəki nümunə: Dt İnzibati/Kommersiya Xərci, Kt İşçi Heyətinə Borc + Sosial Sığorta Öhdəliyi).
7. Fayl 7-nin `paymentOrderBatches` (`batchType: 'salary_bulk'`) mexanizmi çağırılır, seçilmiş bank hesabının formatına uyğun toplu ödəniş faylı generasiya olunur.
8. Fayl uğurla bankda icra ediləndən sonra status `paid` olur, hər işçi üçün ayrı `payments` yazısı (Fayl 7) yaradılır.

---

## 7. Əmək Haqqı Vərəqəsi (Payslip)

Fayl 6-dakı **Sənəd (Blank) Dizayneri** infrastrukturu təkrar istifadə olunur (`documentTemplates.type = 'payslip'`) — hər işçi üçün fərdi PDF generasiya olunur (Gross, hər kəsinti sətri ayrı-ayrı, Net, işəgötürən xərci ayrıca informativ bölmədə). İşçilər (əgər Client User kimi məhdud girişə malikdirsə) öz payslip-lərini yalnız özününkü olaraq görə bilər (Security Rules: `resource.data.employeeId == request.auth.uid`-ə uyğun əlaqələndirmə, əgər işçi hesabı sistemdə varsa).

---

## 8. Vergi/Sosial Sığorta Hesabatları (Dövlət Orqanlarına Təqdimat)

**MVP Yanaşması:** Aylıq Gəlir Vergisi və DSMF bəyannamələrinin tam avtomatik e-Taxes/e-Sosial API inteqrasiyası bu fazanın əhatəsindən kənardadır (Bölmə 2.2 ilə eyni səbəb — sertifikatlaşdırma tələbi). Sistem `payrollRuns`-dan **Dövlət Vergi Xidmətinin tələb etdiyi struktura uyğun Excel/CSV export** generasiya edir (Fayl 3-ün Universal Export Framework-ü, xüsusi "Vergi Bəyannaməsi" şablonu ilə), mühasib bu faylı rəsmi portala əl ilə yükləyir.

---

## 9. Excel Export Nöqtələri (Fayl 3-ə istinad)

- [ ] İşçi Siyahısı (tam profil məlumatları ilə, maaş sahəsi icazəyə görə maskalanaraq)
- [ ] Məzuniyyət Tarixçəsi və Balansları
- [ ] Aylıq Tabel (Timesheet) Xülasəsi
- [ ] Əmək Haqqı Cədvəli (`payrollRuns`, hər dövr üçün tam sətir detalları ilə)
- [ ] Ödəniş Siyahısı (bank faylına göndərilənlər)
- [ ] Vergi/Sosial Sığorta Bəyannaməsi Export-u

---

## 10. Qəbul Meyarları (Acceptance Criteria) — Modul 10

- [ ] Yeni işçi yaradıldıqda onboarding workflow-u avtomatik başlayır.
- [ ] Elektron əmək müqaviləsi bildirişi göndərilməyən işçilər Dashboard-da aydın xəbərdarlıqla görünür.
- [ ] İşdən çıxarılan işçinin istifadə olunmamış məzuniyyət kompensasiyası (əsas + əlavə) avtomatik son hesablamaya daxil edilir.
- [ ] Məzuniyyət balansı ilin əvvəlində düzgün yenilənir, 2 illik daşınma məhdudiyyəti tətbiq olunur.
- [ ] Məzuniyyət tələbi təsdiqləndikdə balans dərhal azalır, rədd edildikdə dəyişməz qalır.
- [ ] Overtime saatları düzgün əmsalla hesablanır və payroll-a daxil edilir.
- [ ] Əmək haqqı hesablanması **yalnız təsdiqlənmiş** tabel xülasələrini istifadə edir.
- [ ] Vergi/sığorta hesablamaları həmişə **həmin dövrdə qüvvədə olan** `payrollTaxConfigs` versiyasından istifadə edir, sərt kodlaşdırılmış rəqəm heç yerdə yoxdur.
- [ ] Əmək haqqı təsdiqləndikdə Fayl 8-ə düzgün jurnal yazısı, Fayl 7-yə düzgün bank toplu faylı avtomatik göndərilir.
- [ ] Hər işçi üçün fərdi PDF payslip düzgün generasiya olunur.
- [ ] Bütün siyahı ekranlarında Excel export mövcuddur.

---

## 11. Digər Modullara İstinadlar

- Fayl 1, Bölmə 6.2 → `hr.employee.salary.view` icazəsi maaş sahəsini qoruyur.
- Fayl 3 → HR KPI-ları (aktiv işçi sayı, dövriyyə, gözləyən məzuniyyət tələbləri) bu modulun kolleksiyalarından qidalanır.
- Fayl 4 → Onboarding checklist, Məzuniyyət Təsdiqi workflow şablonları bu modulda istifadə olunur.
- Fayl 6 → Sənəd Dizayneri Payslip generasiyası üçün təkrar istifadə olunur.
- Fayl 7 → Əmək haqqı ödənişi `paymentOrderBatches` (`salary_bulk`) mexanizmi ilə bank faylına çevrilir.
- Fayl 8 → Əmək haqqı hesablanması/ödənişi konsolidasiya edilmiş jurnal yazısı yaradır.

---

## 12. TaxIQ ERP — 10 Modulun Tam Xülasəsi

Bu, seriyanın sonuncu faylı olduğu üçün bütün sistemin necə bir vahid kimi işlədiyinin qısa xəritəsi:

| № | Modul | Əsas Rolu |
|---|---|---|
| 1 | Core Platform, Auth, RBAC | Multi-tenant təməl, giriş, rol/icazə |
| 2 | Müştəri Qeydiyyatı, Sektor Şablonları | Hər Company-nin fərdi profili və konfiqurasiyası |
| 3 | Dashboard, Hesabat, Excel Export | Bütün modulların vizual və ixrac qatı |
| 4 | Workflow Management | Bütün approval/avtomatlaşdırma məntiqinin mərkəzi mühərriki |
| 5 | Anbar, Mal/Xidmət | Fiziki/xidmət ehtiyatının uçotu |
| 6 | Satış, Faktura, Blank Dizayner | Gəlir tərəfi və sənəd generasiyası |
| 7 | Kassa, Bank, Xəzinədarlıq | Pul hərəkəti və bank inteqrasiyası |
| 8 | Mühasibat Nüvəsi | Bütün maliyyə əməliyyatlarının "tək həqiqət mənbəyi" |
| 9 | IFRS Hesabatlar | Fayl 8-dən avtomatik qurulan rəsmi maliyyə hesabatları |
| 10 | HR, Əmək Haqqı | İşçi həyat dövrü və əmək haqqı — Fayl 7/8-ə bağlı |

Bu 10 fayl birlikdə **TaxIQ**-ı — Azərbaycanda fəaliyyət göstərən maliyyə/mühasibat/HR konsaltinq şirkətinin özünün və çoxsaylı müştərilərinin bütün əməliyyat, mühasibat və insan resursları işlərini tək platformadan idarə edə biləcəyi, Firebase əsaslı, GitHub/Vercel üzərindən inkişaf etdirilən, tam modulyar ERP sistemini təşkil edir. Hər fayl Claude Code-a ayrıca kontekst kimi verilə bilər, lakin fayllar arasındakı bölmə istinadları (məs. "Fayl 8-ə istinad") sayəsində vahid, ziddiyyətsiz bir sistem kimi implementasiya oluna bilər.
