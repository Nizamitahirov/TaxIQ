# TaxIQ ERP — Modul 2: Müştəri (Tenant) Qeydiyyatı, Sektor Şablonları və Profil İdarəetməsi

> **Sənəd statusu:** 10 fayldan 2-cisi. Bu sənəd **Fayl 1**-də təyin olunan `companies/{companyId}` sənədinin **necə yaradıldığını, sektor üzrə necə fərqləndirildiyini və qeydiyyatdan sonra necə idarə olunduğunu** təsvir edir. Fayl 1-dəki bütün istinadlar (`hasCompanyAccess()`, `roles`, `userCompanyAccess`, Montserrat/tema/dil standartları) burada da qüvvədədir və təkrarlanmır.

---

## 0. Vacib Konseptual Dəqiqləşdirmə: Qeydiyyat Kim Tərəfindən Aparılır?

TaxIQ **ictimai özünüqeydiyyat (public self-signup) platforması deyil** — bu, konsaltinq firmasının **daxili işçi aləti**dir. Ona görə:

- Yeni Company yalnız **Platform Super Admin** və ya `platform.company.create` icazəsinə malik **Staff** (adətən Baş Mühasib/Tərəfdaş səviyyəsində) tərəfindən yaradılır.
- Müştəri şirkətinin özü heç vaxt "qeydiyyatdan keç" düyməsini görmür — TaxIQ-ın əməkdaşı yeni müqavilə bağlanan müştərini sistemə **daxil edir** (data-entry, "add client" məntiqi, Xero Practice Manager/QBO Accountant-a bənzər).
- Yalnız qeydiyyatdan sonra, əgər müqavilə şərtlərinə görə müştəriyə sistemə birbaşa giriş verilməlidirsə, Company Admin (TaxIQ tərəfindən təyin olunmuş) və ya Client User hesabları yaradılır (bax Bölmə 6).

Bu, aşağıdakı bütün axının dizaynını müəyyən edir: sihirbaz **sadələşdirilmiş marketinq onboarding-i deyil**, **daxili məlumat daxiletmə aləti**dir və sürətli/dəqiq olmalıdır (TaxIQ əməkdaşı bunu gündə bir neçə dəfə edə bilər).

---

## 1. Yeni Müştəri Qeydiyyatı — Sihirbaz (Wizard) Axını

### 1.1. Dizayn prinsipi

Tədqiqat göstərir ki, çoxaddımlı formalarda **progressive disclosure** (mərhələli açıqlama) prinsipi ən effektivdir: istifadəçi bir anda yalnız bir bloklu məlumatla məşğul olur, irəliləyiş göstəricisi görür və "Advanced" seçimlər defolt gizli qalır. TaxIQ-ın "Yeni Müştəri" sihirbazı 6 addımdan ibarətdir, hər addım ayrı komponentdir, `Zustand` ilə addımlar arası vəziyyət saxlanılır, **hər addımda avtomatik draft saxlanılır** (Firestore-da `companyDrafts/{draftId}` kolleksiyasında) ki, əməkdaşın brauzeri qəzalansa belə məlumat itməsin.

### 1.2. Addım-addım struktur

**Addım 1 — Əsas Məlumatlar**
| Sahə | Tip | Qeyd |
|---|---|---|
| Şirkətin adı (qısa) | text, məcburi | Company Switcher-də görünəcək ad |
| Hüquqi adı (tam) | text, məcburi | Fakturalarda/hesabatlarda rəsmi ad |
| VÖEN (Tax ID) | text, məcburi, 10 rəqəm, unikal | Sistemdə eyni VÖEN-lə ikinci Company yaradıla bilməz (validasiya) |
| Hüquqi forma | select | MMC, ASC, Fərdi Sahibkar, Publik Hüquqi Şəxs, s. |
| Ünvan, telefon, e-poçt | text | |
| Rəhbərin adı | text | Sənədlərdə/blank-larda istifadə üçün |

**Addım 2 — Sektor Seçimi**
- Kartlar şəklində sektor seçimi (ikonla): İstehsalat, Pərakəndə Satış, Otelçilik, Xidmət/Konsaltinq, Topdansatış/Distribusiya, Tikinti, Digər.
- Seçim edilən kimi sağ paneldə "Bu sektor üçün defolt tətbiq olunacaq: X modul, Y Hesablar Planı şablonu, Z KPI dəsti" xülasəsi göstərilir (şəffaflıq üçün, istifadəçi nəyin avtomatik quraşdırılacağını əvvəlcədən bilir).
- Bax Bölmə 2 — hər sektorun detallı təsviri.

**Addım 3 — Xidmət Əhatəsi və Modul Aktivləşdirmə**
> **Kritik nüans:** Modul aktivləşdirməsi təkcə sektordan deyil, **TaxIQ ilə həmin müştəri arasındakı konkret xidmət müqaviləsindən** asılıdır. Məsələn, iki retail müştəridən biri TaxIQ-dan yalnız **əmək haqqı hesablama xidməti** ala bilər (yalnız HR+Payroll aktiv), digəri isə **tam mühasibat + HR** ala bilər (bütün modullar aktiv). Ona görə:
- Sektor seçimindən sonra bütün modullar sektor defoltuna uyğun ön-işarələnir (pre-checked), LAKİN əməkdaş bunları **əl ilə dəyişə bilər** (checkbox matrisi: Anbar, Satış, Kassa/Bank, Mühasibat Nüvəsi, IFRS Hesabatlar, HR, Əmək Haqqı, Workflow).
- Dashboard, Rol/Səlahiyyət İdarəetməsi həmişə aktivdir (platform nüvəsi, deaktiv edilə bilməz).
- Hər modul yanında kiçik "?" ikonu ilə izah tooltip-i.

**Addım 4 — Əsas Tənzimləmələr**
| Sahə | Defolt |
|---|---|
| Əsas valyuta | AZN (Fayl 1, Bölmə 8) |
| Fiskal il başlanğıcı | Yanvar (dəyişdirilə bilər — məs. bəzi holdinqlər İyul seçə bilər) |
| Dil (Company defoltu) | AZ |
| Loqo yükləmə | opsional, PDF/Excel export-larda istifadə olunacaq (bax Fayl 6, Blank Dizayneri) |
| Rəng sxemi (brend rəngi) | opsional, hex kod — PDF sənədlərinin başlıq zolağında istifadə olunur |

**Addım 5 — İlkin Company Admin İstifadəçisi**
- Ya mövcud Staff istifadəçisini "Company Admin" rolu ilə təyin et (Fayl 1, `userCompanyAccess`), ya da yeni Client User yarat (əgər müştəri özü sistemə girəcəksə).
- Bu addım **opsional keçilə bilər** ("İndilik keç, sonra əlavə edərəm") — çünki bəzi müştərilərdə TaxIQ əməkdaşları işi tam öz üzərinə götürür, müştərinin sistemə girişinə ehtiyac olmur.

**Addım 6 — Yoxlama və Təsdiq**
- Bütün daxil edilmiş məlumatların xülasəsi bir səhifədə.
- "Yarat" düyməsi basılanda:
  1. `companies/{companyId}` sənədi `status: 'active'` ilə yaradılır.
  2. Seçilmiş sektor şablonunun defolt Hesablar Planı (Fayl 8-ə istinad) həmin Company üçün kopyalanır (`chartOfAccounts` kolleksiyasına, `companyId` ilə).
  3. Defolt Dashboard widget dəsti tətbiq olunur (Fayl 3-ə istinad).
  4. Əgər Addım 5-də istifadəçi təyin olunubsa, müvafiq `userCompanyAccess` sənədi yaradılır və (Client User olarsa) müvəqqəti parol e-poçtla göndərilir (Fayl 1, Bölmə 3.3 axını).
  5. `auditLogs`-a `COMPANY_CREATED` yazılır.
  6. Əməkdaş avtomatik yeni Company-nin Dashboard-una yönləndirilir.

### 1.3. Draft-ların idarəsi

- Sihirbaz istənilən addımda "Sonra davam et" ilə bağlana bilər, `companyDrafts/{draftId}` sənədi saxlanılır (`createdBy`, `lastStep`, bütün doldurulmuş sahələr).
- "Müştərilər" siyahı ekranında ayrıca "Qeydiyyatı Yarımçıq Qalanlar" filtri olur.
- Draft-lar 30 gündən sonra avtomatik silinmə xəbərdarlığı alır (Cloud Scheduler ilə).

---

## 2. Sektor Şablonları (Sector Templates)

### 2.1. Data modeli

```
sectorTemplates/{templateId}
├── code: enum                       // manufacturing | retail | hospitality | services | wholesale_distribution | construction | other
├── name: { az: string, en: string }
├── description: { az: string, en: string }
├── icon: string
├── defaultModulesEnabled: string[]  // Bölmə 2.2-dəki cədvələ uyğun
├── defaultChartOfAccountsTemplateId: string   // Fayl 8-ə istinad
├── defaultDashboardWidgetSetId: string        // Fayl 3-ə istinad
├── departmentPreset: string[]       // sektora uyğun defolt şöbə/dimension adları (bax Bölmə 4)
├── customFieldDefinitions: [{       // bax Bölmə 7
│     fieldKey: string,
│     label: { az, en },
│     type: 'text'|'number'|'date'|'select',
│     appliesToEntity: string,       // "goods" | "employee" | "invoice" s.
│     options: string[] | null
│   }]
├── recommendedKpis: string[]        // Fayl 3-də KPI kataloquna istinad
├── isSystemTemplate: boolean        // true — silinə bilməz, yalnız kopyalanıb fərdiləşdirilə bilər
└── notes: { az, en }                // implementasiya qeydləri, aşağıda hər sektor üçün verilib
```

### 2.2. Modul Aktivləşdirmə Matrisi (Sektor Defoltları)

| Modul | İstehsalat | Retail | Otelçilik | Xidmət/Konsaltinq | Topdansatış | Tikinti | Digər |
|---|---|---|---|---|---|---|---|
| Dashboard / RBAC | ✅ (həmişə) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workflow Management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ (əl ilə) |
| Anbar + Mal/Xidmət | ✅ | ✅ | ✅ (F&B ehtiyatı) | ⬜ | ✅ | ✅ (material) | ⬜ |
| Satış + Faktura | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Kassa/Bank/Xəzinədarlıq | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Mühasibat Nüvəsi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| IFRS Hesabatlar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| HR | ⬜ (opsional) | ⬜ (opsional) | ✅ | ✅ | ⬜ (opsional) | ✅ | ⬜ |
| Əmək Haqqı (Payroll) | ⬜ (opsional) | ⬜ (opsional) | ✅ | ✅ | ⬜ (opsional) | ✅ | ⬜ |

> "Digər/Fərdi" sektorunda **heç bir modul əvvəlcədən aktivləşdirilmir** — əməkdaş tam sərbəst seçim edir. Bu, əvvəlcədən müəyyənləşdirilməmiş biznes modelli müştərilər üçündür.

### 2.3. Sektor-spesifik qeydlər (implementasiya təfərrüatları)

#### 🏭 İstehsalat (Manufacturing)

- **Hesablar Planı fərqi:** "Hazır Məhsul", "Yarımfabrikat", "Xammal" üçün ayrıca anbar/inventar hesabları (Fayl 8-də bu kateqoriyalar üçün ayrıca hesab kodları nəzərdə tutulur).
- **Dəyərləndirmə metodu:** anbar modulunda (Fayl 5) FIFO və Orta Çəkili Qiymət (Weighted Average) metodları dəstəklənməlidir — istehsalat şirkətləri arasında hər ikisi geniş yayılıb, seçim Company tənzimləməsində edilir.
- **Əhəmiyyətli məhdudiyyət (şəffaf şəkildə qeyd olunur):** Bu texniki şərtlər toplusunun cari əhatəsi (10 modul) tam **İstehsalat Resurs Planlaşdırması (MRP)** — Bill of Materials (BOM), İstehsal Sifarişləri (Work Orders), İstehsal Planlaması — funksionallığını əhatə etmir. İlkin versiyada istehsalat müştəriləri üçün Anbar modulu sadə "xammal daxil olması → hazır məhsul çıxışı" səviyyəsində manual əməliyyatlarla dəstəklənir. Tam MRP modulu **gələcək faza** kimi qeyd olunur (bu, Fayl 5-də "Gələcək Genişlənmə" bölməsində təkrarlanacaq).
- Defolt Departments: "İstehsal", "Anbar", "Satış", "İnzibati".

#### 🛍️ Pərakəndə Satış (Retail)

- **Çoxfilial dəstəyi:** hər mağaza ayrı Warehouse/Location kimi modelləşdirilir (Fayl 5).
- **Sürətli Satış rejimi:** Satış modulunda (Fayl 6) `quickSaleModeEnabled: true` bayrağı ilə sadələşdirilmiş kassa-tipli sürətli satış ekranı aktivləşir (məhsul axtarışı/barkod, ödəniş növü seçimi, çap) — bu, tam POS sistemi əvəz etmir, amma pərakəndə üçün gündəlik satış qeydiyyatını asanlaşdırır.
- **Qiymət siyahıları:** müştəri seqmenti/kampaniya üzrə fərqli qiymətlər (Fayl 6-da detallandırılır).
- Defolt Departments: "Mağaza 1", "Mağaza 2" (dinamik, filial sayına görə), "Baş Ofis".

#### 🏨 Otelçilik (Hospitality)

- **Hesablar Planı:** Beynəlxalq **USALI (Uniform System of Accounts for the Lodging Industry)** standartına uyğunlaşdırılmış struktur tövsiyə olunur — Otaq Gəliri (Rooms), Yemək-İçki (F&B), Digər Əməliyyat Departamentləri, Bölüşdürülməmiş Xərclər (Undistributed Operating Expenses) ayrı-ayrı hesab qrupları kimi. Bu, departament-əsaslı Mənfəət-Zərər hesabatının (bax aşağı) əsasını təşkil edir.
- **Departament-əsaslı P&L:** hər departament (Otaq, Restoran, SPA, Bar) üçün ayrıca gəlir/birbaşa xərc hesabatı — Fayl 9-da (IFRS Hesabatlar) "Departament üzrə Mənfəət-Zərər" hesabat tipi kimi əlavə olunacaq, Bölmə 4-dəki `departments` dimension-una əsaslanaraq.
- **Otelçilik KPI-ları (Dashboard, Fayl 3-ə istinad):** RevPAR (Otaq başına gəlir), ADR (Orta Gündəlik Tarif), Doluluq faizi (Occupancy Rate), GOPPAR. Bu göstəricilər hesablanmaq üçün **otaq sayı** və **satılan otaq-gecə** məlumatının sistemə daxil edilməsini tələb edir (sadə manual input sahəsi kimi, Company tənzimləməsində "Ümumi otaq sayı" saxlanılır).
- **Əhəmiyyətli məhdudiyyət (şəffaf qeyd):** TaxIQ **Otel Əmlak İdarəetmə Sistemi (PMS)** deyil — otaq rezervasiyası, qonaq check-in/check-out kimi funksiyalar əhatə dairəsindən kənardadır. TaxIQ hotel üçün **maliyyə/HR arxa ofis qatıdır**; gündəlik otaq gəliri məlumatı ya manual daxil edilir, ya da gələcəkdə PMS-dən (Opera, Cloudbeds, Mews) Excel/CSV import mexanizmi ilə (Fayl 3-ün Excel Framework-ü İMPORT istiqamətində də genişləndirilə bilər) alınır.
- Defolt Departments: "Otaq (Rooms)", "Yemək-İçki (F&B)", "SPA", "Baş İdarəetmə".

#### 💼 Xidmət / Konsaltinq (Services) — **TaxIQ-ın öz Company profili də bu şablondan istifadə edir**

- Anbar modulu defolt deaktivdir (fiziki mal dövriyyəsi yoxdur), lakin "Xidmətlər Kataloqu" (Fayl 5-in "mal və xidmətlər" hissəsi) tam istifadə olunur — hər xidmət bir sətir kimi (saatlıq konsaltinq, aylıq abunə xidməti və s.).
- **Saat-əsaslı fakturalaşdırma əlaqəsi:** əgər HR modulunda (Fayl 10) işçi vaxtının uçotu (tabel) aparılırsa, "hesablanabilir saat" (billable hours) sahəsi əlavə edilə bilər ki, konsaltinq şirkəti müştəriyə saat üzrə faktura yaza bilsin (bu əlaqə Fayl 6 (Satış) və Fayl 10 (Tabel) arasında **könüllü** inteqrasiya nöqtəsi kimi qeyd olunur, məcburi deyil).
- Defolt Departments: "Mühasibat Xidmətləri", "HR Xidmətləri", "Vergi Konsaltinqi", "İnzibati".

#### 📦 Topdansatış / Distribusiya (Wholesale & Distribution)

- İstehsalata bənzər Anbar tələbləri, lakin BOM/istehsal yoxdur — yalnız alış-satış dövriyyəsi.
- Müştəri qrupu üzrə fərqli qiymət siyahıları (B2B tələbi), minimum sifariş miqdarı sahəsi (custom field).
- Defolt Departments: "Satınalma", "Anbar/Logistika", "Satış".

#### 🏗️ Tikinti (Construction)

- Layihə-əsaslı maya dəyəri (job costing) tələbi olduğu qeyd olunur, lakin **tam layihə idarəetmə modulu bu 10 faylın əhatəsindən kənardır**. Departments strukturu "layihə" kimi istifadə edilə bilər (hər tikinti obyekti bir Department/dimension kimi modelləşdirilə bilər — bax Bölmə 4), bununla minimal səviyyədə layihə üzrə xərc ayrılması mümkün olur.
- Defolt Departments: dinamik, hər aktiv tikinti obyekti üçün bir departament yaradılır.

#### ⚙️ Digər / Fərdi (Other/Custom)

- Heç bir defolt tətbiq olunmur. Boş Hesablar Planı ilə başlayır (Fayl 8-də "Boş Şablon" seçimi) və əməkdaş bütün struktur qərarlarını əl ilə verir.

### 2.4. Şablon idarəetmə ekranı (yalnız Super Admin)

- Sektor şablonlarının siyahısı, hər birinin redaktəsi (defolt modul/KPI/hesab planı seçimi).
- Yeni fərdi şablon yaratma (məs. gələcəkdə "Əczaçılıq" sektoru əlavə etmək istənilərsə, mövcud şablondan kopyalayaraq).

---

## 3. Company Profil İdarəetməsi (Qeydiyyatdan Sonra)

Qeydiyyat tamamlandıqdan sonra Company Admin (və ya müvafiq icazəyə malik Staff) **Şirkət Tənzimləmələri** ekranından profili idarə edir. Ekran tab-lar şəklindədir:

| Tab | Məzmun |
|---|---|
| **Ümumi Məlumat** | Addım 1-dəki bütün sahələr, redaktə edilə bilər |
| **Modullar** | Addım 3-dəki checkbox matrisi — istənilən vaxt dəyişdirilə bilər (icazə: `platform.company.settings.edit`); modul söndürüldükdə həmin modulun məlumatları SİLİNMİR, sadəcə naviqasiyadan gizlədilir (yenidən aktivləşdirdikdə məlumat qorunub qalır) |
| **Şöbələr/Dimensiyalar** | Bölmə 4-ə bax |
| **Maliyyə İli** | Fiskal il başlanğıcı, cari açıq dövr, keçmiş dövrlərin "bağlanması" (period lock — bağlanmış dövrə yazı aparıla bilməz, yalnız Chief Accountant `accounting.period.reopen` icazəsi ilə aça bilər) |
| **Brendinq** | Loqo, rəng, PDF/Excel şablonlarında görünəcək başlıq formatı (Fayl 3 və 6-ya istinad) |
| **Valyutalar** | Fayl 1, Bölmə 8-ə istinad, Company-yə xas icazə verilən valyuta siyahısı |
| **İnteqrasiyalar** (gələcək) | e-qaimə (STS) inteqrasiya statusu, bank API açarları (Fayl 7-yə istinad) — bu tab-ın funksionallığı Fayl 6/7-də detallandırılır, burada yalnız yer ayrılır |

---

## 4. Şöbələr / Dimensiyalar (Departments & Cost Centers)

### 4.1. Konsepsiya

Çoxdepartamentli hesabatlıq (xüsusilə Otelçilik və Tikinti üçün vacib, lakin bütün sektorlar üçün faydalıdır) üçün yüngül "dimension" modeli tətbiq olunur — bu, əməliyyat sənədlərinin (jurnal yazıları, fakturalar, işçi qeydləri) əlavə kəsim (cut) ilə təhlil olunmasına imkan verir.

```
departments/{departmentId}
├── companyId: string
├── name: { az: string, en: string }
├── code: string                    // qısa kod, hesabatlarda istifadə üçün
├── parentDepartmentId: string | null   // ierarxiya dəstəyi (məs. "Mağaza 1" → "Retail Filialları")
├── type: enum                      // department | cost_center | project  (Tikinti sektoru üçün 'project')
├── isActive: boolean
├── createdAt, updatedAt: timestamp
```

- Bu kolleksiya **anbar Warehouse (fiziki lokasiya) anlayışından fərqlidir** — Warehouse (Fayl 5) fiziki stok yeri, Department isə mühasibat/HR üçün təşkilati/dəyər kəsimi.
- Digər modullar `departmentId` sahəsini öz sənədlərinə **opsional** əlavə edə bilər (məs. `journalEntries.departmentId`, `employees.departmentId`) — bu, Fayl 8, 9, 10-da müvafiq yerlərdə "opsional dimension sahəsi" kimi istinad ediləcək.
- Şöbələr üzrə hesabat: "Departament üzrə Mənfəət-Zərər" — Fayl 9-da təsvir olunur.

---

## 5. Data İzolyasiyasının Genişləndirilməsi (Company səviyyəsində)

Fayl 1-də təsvir olunan `companyId`-əsaslı izolyasiyaya əlavə olaraq:

- **Company-səviyyəli tam ixrac (Data Export):** Company Admin, müqavilə bitdikdə və ya tələb olunduqda, öz Company-sinin bütün məlumatlarını (bütün modullar üzrə) vahid arxiv (ZIP, içində hər modul üçün Excel faylları + PDF sənədlər) şəklində ixrac edə bilər — icazə: `platform.company.export_all`. Bu, həm müştəri ilə münasibətin bitməsi, həm də daxili audit üçün vacibdir.
- **Company-səviyyəli fəaliyyət tarixçəsi:** Bölmə "Ümumi Məlumat"da "Bu Company-də son fəaliyyətlər" mini-jurnalı (Fayl 1-in `auditLogs`-undan filtrlənmiş görünüş).

---

## 6. Müştəri Statusu və Lifecycle (Client Lifecycle Management)

### 6.1. Statuslar

Fayl 1-də `companies/{companyId}.status` sahəsi `active | suspended | archived` olaraq təyin olunmuşdu; bu sənəd əlavə olaraq `draft` statusunu təqdim edir:

```
draft → active → suspended ⇄ active → archived
```

| Status | Mənası | Giriş qaydası |
|---|---|---|
| `draft` | Qeydiyyat sihirbazı yarımçıqdır | Heç bir istifadəçi (Client User) giriş edə bilməz, yalnız yaradan Staff görür |
| `active` | Normal fəaliyyət | Tam giriş, rol/icazəyə uyğun |
| `suspended` | Müqavilə/ödəniş problemi, müvəqqəti dayandırma | Client User girişi tamamilə bloklanır (login ekranında "Hesabınız müvəqqəti dayandırılıb, TaxIQ ilə əlaqə saxlayın" mesajı); Staff yalnız **oxuma** rejimində görə bilir (yazma əməliyyatları bloklanır) — bu, mübahisəli dövrdə məlumatın dəyişməz qalmasını təmin edir |
| `archived` | Müqavilə tamamilə bitib | Heç bir istifadəçi (Client User daxil) giriş edə bilməz; yalnız Platform Super Admin `platform.company.export_all` icazəsi ilə arxivə baxa/ixrac edə bilər |

### 6.2. Silinmə Qadağası

**Heç bir Company Firestore-dan fiziki silinmir** (`delete` əməliyyatı Security Rules səviyyəsində bloklanır, hətta Super Admin üçün). Bu, mühasibat/hüquqi saxlama tələbləri (adətən 5+ il) və audit trail bütövlüyü üçün məcburi qaydadır. "Silmək" istəyi həmişə `archived` statusuna keçidlə həll olunur.

### 6.3. Status dəyişikliyi ekranı

- Yalnız Platform Super Admin status dəyişə bilər.
- Status dəyişikliyi səbəb sahəsi tələb edir (mətn, `auditLogs`-a yazılır).
- `active → suspended` keçidində sistem avtomatik bütün aktiv sessiyaları etibarsız edir (Firebase Auth `revokeRefreshTokens`).

---

## 7. Fərdi Sahələr (Custom Fields) Mexanizmi

Sektor şablonlarının `customFieldDefinitions` massivi vasitəsilə hər sektor öz spesifik sahələrini gətirir (məs. Retail üçün "Mağaza sahəsi (m²)", İstehsalat üçün "İstehsal sexi kodu"). Bu sahələr generic şəkildə saxlanılır ki, yeni sektor əlavə olunanda kod dəyişikliyi tələb olunmasın:

```
companies/{companyId}
└── customFieldValues: {
      [fieldKey: string]: string | number | boolean
    }
```

UI-da bu sahələr "Ümumi Məlumat" tab-ının aşağı hissəsində "Sektora Xas Məlumatlar" bölməsində avtomatik render olunur (sahə tipinə görə müvafiq input komponenti seçilərək).

---

## 8. Qəbul Meyarları (Acceptance Criteria) — Modul 2

- [ ] Yeni müştəri sihirbazı 6 addımı tam əhatə edir, hər addımda draft avtomatik saxlanılır.
- [ ] Eyni VÖEN ilə ikinci Company yaradılmasına cəhd edildikdə sistem xəbərdarlıq verir və qarşısını alır.
- [ ] Sektor seçimi edildikdə müvafiq defolt modullar, Hesablar Planı və Dashboard widget dəsti düzgün tətbiq olunur.
- [ ] Modul aktivləşdirmə matrisi sektor defoltundan asılı olmayaraq əl ilə tam fərdiləşdirilə bilir.
- [ ] Modul deaktiv edildikdə mövcud məlumat silinmir, yalnız naviqasiyadan gizlədilir; yenidən aktivləşdirmə məlumatı bərpa edir.
- [ ] Şöbələr/Dimensiyalar yaradıla, ierarxiyaya salına bilir və digər modullarda (test məqsədilə ən azı 1 nümunə: jurnal yazısı) seçim kimi görünür.
- [ ] `suspended` statusunda Client User girişi tam bloklanır, Staff yalnız oxuma rejiminə keçir.
- [ ] `archived` Company heç bir Security Rules yolu ilə (UI, birbaşa API) yazıla bilmir.
- [ ] Company silinmə funksiyası UI-da mövcud deyil (yalnız arxivləşdirmə seçimi var).
- [ ] Fərdi sahələr (custom fields) yeni sektor əlavə olunanda kod dəyişikliyi tələb etmədən işləyir.
- [ ] Company-səviyyəli tam data export funksiyası ZIP arxivi generasiya edir.

---

## 9. Digər Modullara İstinadlar

- `sectorTemplates.defaultChartOfAccountsTemplateId` → **Fayl 8** (Mühasibat Nüvəsi) bu ID-yə əsasən konkret hesab kodlarını təyin edəcək.
- `sectorTemplates.defaultDashboardWidgetSetId` → **Fayl 3** bu ID-yə əsasən ilkin widget dəstini quracaq.
- `departments/{departmentId}` → **Fayl 8, 9, 10** öz sənədlərində opsional `departmentId` sahəsi kimi istifadə edəcək; **Fayl 9** "Departament üzrə P&L" hesabatını bu kolleksiya üzərində quracaq.
- Otelçilik RevPAR/ADR/GOPPAR KPI-ları → **Fayl 3**-ün KPI kataloquna daxil ediləcək.
- Retail `quickSaleModeEnabled` bayrağı → **Fayl 6** (Satış modulu) bu bayrağa görə UI-nı fərqləndirəcək.
- Xidmət sektorunun "hesablanabilir saat" konsepsiyası → **Fayl 6** və **Fayl 10** arasında körpü kimi hər iki sənəddə qeyd olunacaq.

**Növbəti fayl:** Modul 3 — Dashboard, Hesabat Fərdiləşdirmə və Universal Excel Export Framework.
