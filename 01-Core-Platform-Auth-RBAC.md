# TaxIQ ERP — Modul 1: Əsas Platforma Arxitekturası, Autentifikasiya, Rol və Səlahiyyət İdarəetməsi

> **Sənəd statusu:** 10 fayldan 1-cisi. Bu sənəd bütün digər modulların (Fayl 2–10) üzərində quracağı fundamentdir — multi-tenancy modeli, istifadəçi/rol modeli, təhlükəsizlik qaydaları və UI standartları burada təyin olunur. Digər fayllar bu sənəddəki obyekt adlarına (`companyId`, `users`, `roles`, custom claims s.) istinad edəcək.
>
> **Məqsəd:** Bu sənəd Claude Code-a (və ya istənilən developer komandasına) TaxIQ platformasının nüvəsini kodlaşdırmaq üçün kifayət qədər dəqiq, icra oluna bilən texniki şərtnamə verir.

---

## 0. Platformanın Konseptual Modeli (Mütləq Oxu)

Bu bölmə bütün sənədin əsasını təşkil edir, ona görə ən başda aydınlaşdırılır.

TaxIQ adi "SaaS multi-tenant" platforması deyil — o, **"Mühasibat/HR Konsaltinq Firması Təcrübə İdarəetmə Platforması"** (practice management) modelinə əsaslanır. Bu model qlobal təcrübədə Xero Practice Manager, QuickBooks Online Accountant və Sage Accountants Edition kimi məhsullarda istifadə olunur: konsaltinq firmasının əməkdaşları **bir hesabla bir neçə müştəri şirkəti arasında keçid edərək** onların uçotunu, HR-ını və satışını idarə edirlər.

### 0.1. İki səviyyəli varlıq modeli

1. **Platform səviyyəsi (TaxIQ özü)** — konsaltinq şirkətinin daxili idarəetmə qatı. Burada TaxIQ-ın öz işçiləri, qlobal rollar, bütün müştərilərin siyahısı və platform-səviyyəli tənzimləmələr saxlanılır.
2. **Company (Şirkət Profili) səviyyəsi** — hər bir qeydiyyatdan keçmiş müştəri (istehsalat, retail, otelçilik və s.) TaxIQ daxilində ayrıca **Company** obyekti kimi mövcuddur. **TaxIQ-ın öz konsaltinq biznesi də sistemdə "Company #1" kimi qeydiyyatdan keçir** — bununla "özünün və müştərilərinin bütün işlərini görə bilməsi" tələbi ödənilir.

### 0.2. İstifadəçi tipləri

| Tip | Təsvir | Giriş əhatəsi |
|---|---|---|
| **Platform Super Admin** | TaxIQ-ın IT/rəhbərlik işçiləri. Sistemi idarə edir, bütün Company-ləri yarada/söndürə bilər. | Bütün Company-lərə tam giriş |
| **Staff (Consultant) User** | TaxIQ-ın mühasib/HR mütəxəssis/satış işçiləri. Bir və ya bir neçə Company-yə **təyin olunur** (assignment), hər Company-də fərqli rola malik ola bilər. | Yalnız təyin olunduğu Company-lər arasında keçid (Company Switcher) |
| **Client User** | Müştəri şirkətinin öz əməkdaşı (məs. müştərinin maliyyə direktoru sistemdən öz hesabatlarına baxmaq istəyir). | **Yalnız öz Company-sinə** giriş, digər Company-lərin mövcudluğundan belə xəbərsizdir |

> **Kritik təhlükəsizlik qaydası:** Client User heç vaxt, heç bir halda (UI, API, export) başqa Company-nin adını, ID-sini və ya məlumatını görə bilməməlidir. Bu, aşağıdakı Firestore Security Rules bölməsində texniki səviyyədə təmin olunur.

### 0.3. Company Switcher

Staff istifadəçi daxil olduqdan sonra ekranın yuxarı hissəsində **Company Switcher** (dropdown/command palette, `Cmd+K` qısayolu ilə axtarışla) görür və bir kliklə fəaliyyət göstərdiyi Company-ni dəyişir. Seçilmiş Company `activeCompanyId` kimi sessiya vəziyyətində saxlanılır və bütün sorğular bu ID ilə filtrlənir. Client User üçün bu komponent göstərilmir (onun yalnız 1 Company-si var).

---

## 1. Texnoloji Stek (Qərar və Əsaslandırma)

Tələb: Firebase baza, GitHub repo, Vercel deployment. Bu məhdudiyyətlər daxilində ən uyğun stek:

| Qat | Texnologiya | Səbəb |
|---|---|---|
| Frontend framework | **Next.js 14+ (App Router) + TypeScript** | Vercel-in doğma platforması; SSR/ISR dashboard üçün faydalıdır; Firebase SDK ilə tam uyumludur |
| UI kit | **Tailwind CSS + shadcn/ui** | Sürətli, fərdiləşdirilə bilən, dizayn tokenləri ilə tema (dark/light) idarəsi asandır |
| İkonlar | **lucide-react** | Tutarlı, yüngül SVG ikon toplusu |
| State/Data fetching | **TanStack Query (React Query)** + Zustand (lokal UI state) | Firestore real-time listener-lərlə keş idarəsi |
| Formlar | **React Hook Form + Zod** | Tip-təhlükəsiz validasiya, backend Cloud Function-larda da eyni Zod sxemləri təkrar istifadə oluna bilər |
| Autentifikasiya | **Firebase Authentication** (email/password provider) | Tələb olunan giriş üsulu |
| Verilənlər bazası | **Cloud Firestore** (Native mode) | Tələb olunan baza |
| Server-side məntiq | **Firebase Cloud Functions (2-ci nəsil, Node.js 20, TypeScript)** | Rol təyinatı, custom claims yeniləmə, PDF/Excel generasiya, IFRS hesablama, workflow mühərriki triggerləri |
| Fayl saxlama | **Firebase Cloud Storage** | Loqolar, sənəd şablonları, ixrac olunan fayllar, işçi sənədləri |
| Excel generasiya | **SheetJS (xlsx)** | Bütün cədvəllərdə export tələbi üçün standart kitabxana |
| PDF generasiya (invoice/blank) | **@react-pdf/renderer** (client) və ya **Puppeteer Cloud Function** (server-side, dəqiq WYSIWYG çıxış üçün) | Fərdiləşdirilə bilən blank dizaynı tələbinə görə server-side Puppeteer tövsiyə olunur |
| i18n | **next-intl** | AZ/EN dil seçimi, JSON tərcümə faylları |
| Qrafiklər | **Recharts** | Dashboard KPI qrafikləri |
| CI/CD | **GitHub Actions → Vercel** | Tələb olunan repo/deploy zənciri |
| Monitorinq | **Firebase Crashlytics/Performance (opsional) + Vercel Analytics** | İstehsalat mühiti monitorinqi |

**Repo strukturu tövsiyəsi (monorepo, pnpm workspaces):**
```
taxiq/
├── apps/
│   └── web/                 # Next.js tətbiqi (Vercel-ə deploy olunur)
├── functions/                # Firebase Cloud Functions (TypeScript)
├── packages/
│   ├── shared-types/         # Firestore sənəd tipləri, Zod sxemləri (həm web, həm functions istifadə edir)
│   └── ui/                   # Paylaşılan React komponentləri (shadcn əsaslı)
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

**Branch strategiyası:** `main` (production, Vercel production deploy) ← `develop` (staging Firebase layihəsi ilə) ← `feature/*` branch-ləri (Vercel preview deploy). **İki ayrı Firebase layihəsi** olmalıdır: `taxiq-staging` və `taxiq-production` — test məlumatları heç vaxt real müştəri məlumatları ilə qarışmamalıdır.

---

## 2. Çoxmüştərili (Multi-Tenant) Data Arxitekturası

### 2.1. Firestore struktur prinsipi: "Flat + companyId"

Tədqiqata əsasən (Firebase rəsmi tövsiyələri və multi-tenant SaaS təcrübəsi), **nested subcollection** modeli (`companies/{id}/invoices/{id}`) əvəzinə **flat top-level collection + `companyId` sahəsi** modeli seçilir. Səbəb:
- Platform Super Admin-in bütün müştərilər üzrə keçid sorğuları (məs. "bütün Company-lərdə ödənilməmiş fakturalar") sadə query ilə mümkündür (`collection group` mürəkkəbliyi olmadan).
- Security Rules daha sadədir: hər sənəddə tək `companyId == token.companyId` yoxlaması kifayətdir.
- Composite index idarəsi asanlaşır.

**Əsas top-level kolleksiyalar (Modul 1 üçün):**

| Kolleksiya | Təsvir | Əsas sahələr |
|---|---|---|
| `platformConfig/{singleton}` | Platform-səviyyəli qlobal tənzimləmələr | `defaultLanguage`, `supportedLanguages[]`, `maintenanceMode` |
| `companies/{companyId}` | Hər müştəri (və TaxIQ-ın özü) üçün bir sənəd | bax 2.3 |
| `users/{uid}` | Bütün istifadəçilər (Staff, Client, Super Admin) — `uid` Firebase Auth UID-i ilə eynidir | bax 2.4 |
| `userCompanyAccess/{autoId}` | Staff↔Company təyinat cədvəli (many-to-many, rol ilə birlikdə) | bax 2.5 |
| `roles/{roleId}` | Sistem və fərdi rollar | bax Bölmə 6 |
| `permissions/{permId}` | Bütün mövcud icazələrin kataloqu (statik seed data) | bax Bölmə 7 |
| `auditLogs/{autoId}` | Bütün kritik əməliyyatların jurnalı | bax Bölmə 12 |
| `notifications/{autoId}` | Bildirişlər | bax Bölmə 11 |

Digər modullardakı bütün biznes sənədləri (invoices, journalEntries, employees və s.) da eyni prinsiplə **hər sənəddə məcburi `companyId` sahəsi** ilə saxlanılacaq (Fayl 2–10-da detallandırılır).

### 2.2. İzolyasiya təminatı (Data Isolation Guarantee)

1. **Frontend səviyyəsi:** Bütün Firestore sorğuları mütləq `.where('companyId', '==', activeCompanyId)` filtri ilə qurulur; heç bir sorğu bu filtrsiz yazılmır (lint qaydası/code review checklist ilə məcburiləşdirilir).
2. **Backend (Security Rules) səviyyəsi:** Frontend filtrindən asılı olmayaraq, Firestore Security Rules səviyyəsində hər `read`/`write` üçün `companyId` uyğunluğu yoxlanılır — bu, "əsl" təhlükəsizlik sərhədidir, frontend filtri sadəcə UX rahatlığıdır.
3. **Cloud Functions səviyyəsi:** Callable funksiyalar həmişə `context.auth.token`-dən gələn icazələri yoxlayır, request body-dən gələn `companyId`-ə etibar etmir (spoofing qarşısı).

### 2.3. `companies/{companyId}` sənəd sxemi

```
companies/{companyId}
├── name: string                     // "TaxIQ Consulting MMC" / "Bakı Retail Group"
├── legalName: string
├── taxId (VÖEN): string
├── sector: string                   // enum: manufacturing | retail | hospitality | services | trade | construction | other
├── sectorTemplateId: string         // Fayl 2-də təsvir olunan sektor şablonuna istinad
├── isInternal: boolean              // true olan YEGANƏ sənəd — TaxIQ-ın öz şirkəti
├── status: enum                     // active | suspended | archived
├── baseCurrency: string             // ISO 4217, default "AZN"
├── logoUrl: string
├── address, phone, email: string
├── settings: {
│     theme: 'light' | 'dark' | 'system',
│     language: 'az' | 'en',
│     fiscalYearStartMonth: number
│   }
├── modulesEnabled: string[]         // Fayl 2-də detallı — hansı modullar bu Company üçün aktivdir
├── createdAt, updatedAt: timestamp
└── createdBy: string (uid)
```

### 2.4. `users/{uid}` sənəd sxemi

```
users/{uid}
├── email: string
├── displayName: string
├── userType: enum                   // platform_super_admin | staff | client_user
├── status: enum                     // active | invited | disabled
├── mustChangePassword: boolean      // ilk giriş məcburi parol dəyişikliyi üçün
├── temporaryPasswordIssuedAt: timestamp | null
├── homeCompanyId: string | null     // client_user üçün MƏCBURİ (yalnız 1 company), staff üçün null
├── accessibleCompanyIds: string[]   // DENORMALLAŞDIRILMIŞ sahə — Security Rules-da sürətli yoxlama üçün (bax 2.6)
├── preferredLanguage: 'az' | 'en'
├── preferredTheme: 'light' | 'dark' | 'system'
├── avatarUrl: string | null
├── phone: string | null
├── lastLoginAt: timestamp
├── createdAt, updatedAt: timestamp
└── createdBy: string (uid)
```

### 2.5. `userCompanyAccess/{autoId}` — Staff↔Company↔Rol təyinatı

```
userCompanyAccess/{autoId}
├── userId: string
├── companyId: string
├── roleId: string                   // bax Bölmə 6
├── customPermissionOverrides: {     // opsional, spesifik icazə əlavə/çıxarma
│     add: string[],                 // permission ID-lər
│     remove: string[]
│   }
├── departmentScope: string[] | null // opsional data-scoping (məs. yalnız "HR" şöbəsi məlumatlarını görsün)
├── assignedAt: timestamp
├── assignedBy: string (uid)
└── status: enum                     // active | revoked
```

> **Niyə ayrı kolleksiya, `users` sənədinin içində array yox?** Bir Staff onlarla Company-yə təyin oluna bilər və hər təyinatın öz rolu, tarixçəsi, ləğv tarixi ola bilər — bu, ayrıca sənəd kimi modelləşdirilməlidir ki, audit və hesabatlıq mümkün olsun. `accessibleCompanyIds` isə sürətli təhlükəsizlik yoxlaması üçün `users` sənədində saxlanılan **denormallaşdırılmış keş massividir** və hər `userCompanyAccess` dəyişikliyində Cloud Function trigger ilə avtomatik yenilənir.

### 2.6. Firebase Auth Custom Claims

Firebase custom claims ölçü məhdudiyyətinə (≈1000 bayt) malikdir, ona görə **bütün Company siyahısı claims-də saxlanılmır**. Claims yalnız minimal, tez-tez yoxlanılan məlumatı daşıyır:

```json
{
  "userType": "staff",
  "platformRole": "consultant",
  "mustChangePassword": false
}
```

Company-spesifik icazə yoxlaması Security Rules daxilində `get()` çağırışı ilə `users/{uid}.accessibleCompanyIds` massivinə baxaraq həyata keçirilir (aşağıda 2.7-də nümunə). Claims hər dəfə `userCompanyAccess` dəyişəndə **deyil**, yalnız `userType`/`platformRole` dəyişəndə Cloud Function vasitəsilə yenilənir (`setCustomUserClaims`), çünki claims dəyişikliyi istifadəçinin token-ini məcburi yeniləməyi tələb edir (client tərəfdə `getIdToken(true)`).

### 2.7. Firestore Security Rules — nümunə (bazis şablon)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return isSignedIn() && request.auth.token.platformRole == 'platform_super_admin';
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function hasCompanyAccess(companyId) {
      return isSignedIn() &&
             (isSuperAdmin() || companyId in userDoc().accessibleCompanyIds);
    }

    // Nümunə: fakturalar kolleksiyası (istənilən biznes kolleksiyası eyni nümunəni izləyir)
    match /invoices/{invoiceId} {
      allow read: if hasCompanyAccess(resource.data.companyId);
      allow create: if hasCompanyAccess(request.resource.data.companyId)
                    && hasPermission('sales.invoice.create');
      allow update: if hasCompanyAccess(resource.data.companyId)
                    && hasPermission('sales.invoice.edit')
                    && request.resource.data.companyId == resource.data.companyId; // companyId dəyişdirilə bilməz
      allow delete: if hasCompanyAccess(resource.data.companyId)
                    && hasPermission('sales.invoice.delete');
    }

    function hasPermission(permId) {
      // Bölmə 7-də detallandırılan icazə yoxlama funksiyası:
      // roles/{roleId}.permissions massivində permId-in olub-olmadığını yoxlayır
      let access = get(/databases/$(database)/documents/userCompanyAccess/$(activeAccessDocId())).data;
      let role = get(/databases/$(database)/documents/roles/$(access.roleId)).data;
      return isSuperAdmin() || permId in role.permissions || permId in access.customPermissionOverrides.add;
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin() ||
                    resource.data.homeCompanyId in userDoc().accessibleCompanyIds);
      allow write: if isSuperAdmin() || hasPermission('platform.users.manage');
    }

    match /companies/{companyId} {
      allow read: if hasCompanyAccess(companyId);
      allow write: if isSuperAdmin() || hasPermission('platform.company.settings.edit');
    }
  }
}
```

> **Qeyd:** Real implementasiyada `hasPermission()` funksiyasının aktiv Company kontekstini necə əldə etdiyi (`activeAccessDocId()`) dəqiqləşdirilməlidir — praktikada bunun ən sadə yolu client tərəfdə cari sorğuya `activeCompanyId`-i həmişə ötürmək və rule daxilində `request.resource.data.companyId` ilə uyğunlaşdırmaqdır. Developer bu hissəni implementasiya zamanı Firestore-un rule performans limitlərinə (rule başına maksimum 10 `get()` çağırışı) uyğun optimallaşdırmalıdır — mümkünsə `accessibleCompanyIds` birbaşa istifadə edilməli, `hasPermission` üçün isə icazələri custom claims-ə **Company-spesifik** kiçik alt-toplu kimi (yalnız `activeCompanyId` üçün) request zamanı ötürmək variantı da nəzərdən keçirilə bilər (performans testindən sonra qərar).

---

## 3. Autentifikasiya və Giriş Axını

### 3.1. Giriş forması

- Sahələr: **E-poçt** və **Parol** (tələb olunduğu kimi).
- "Şifrəni unutmusunuz?" linki → Firebase Auth `sendPasswordResetEmail`.
- Uğursuz cəhd limiti: 5 ardıcıl səhv cəhddən sonra 15 dəqiqəlik müvəqqəti kilidlənmə (Cloud Function + Firestore `loginAttempts/{email}` sənədi ilə izlənilir, Firebase Auth-un öz mexanizmi tam kifayət etmədiyi üçün əlavə qat).
- Uğurlu giriş → `users/{uid}.lastLoginAt` yenilənir, `auditLogs`-a `LOGIN_SUCCESS` yazılır.

### 3.2. İlkin sistem admini (bootstrap)

- Sistem ilk dəfə deploy olunanda **seed script** (Cloud Function və ya birdəfəlik admin SDK skripti) vasitəsilə bir **Platform Super Admin** yaradılır:
  - İstifadəçi adı: `admin` → daxili olaraq `admin@taxiq.system` sintetik e-poçtuna map olunur (Firebase Auth e-poçt formatı tələb etdiyi üçün).
  - İlkin parol: `admin`
  - `mustChangePassword: true` ilə yaradılır — **ilk girişdən dərhal sonra sistem parolu məcburi dəyişdirməyə yönləndirir**, əks halda heç bir səhifəyə giriş verilmir.
  - ⚠️ **Təhlükəsizlik qeydi:** `admin`/`admin` yalnız ilkin quraşdırma üçündür. İstehsalat mühitinə keçmədən əvvəl bu hesabın parolu mütləq dəyişdirilməli və mümkünsə real e-poçt ünvanına bağlanmalıdır. Bu addım deploy checklist-inə daxil edilməlidir (bax Bölmə 15).

### 3.3. Yeni istifadəçi yaradılması (Staff və ya Client User)

1. Səlahiyyətli istifadəçi (Super Admin və ya `platform.users.manage` icazəsi olan Staff) **User Management** ekranından yeni istifadəçi yaradır: Ad, Soyad, E-poçt, İstifadəçi Tipi, (əgər Client User-dirsə) Company, Rol.
2. Sistem Cloud Function vasitəsilə:
   - Firebase Auth-da yeni istifadəçi yaradır, təsadüfi **müvəqqəti parol** generasiya edir (min. 10 simvol, böyük/kiçik hərf + rəqəm + xüsusi simvol qarışığı).
   - `users/{uid}` sənədini `mustChangePassword: true` ilə yaradır.
   - Əgər Staff-dirsə və Company təyinatı edilibsə, müvafiq `userCompanyAccess` sənədini yaradır.
   - Müvəqqəti giriş məlumatlarını **yaradan istifadəçiyə ekranda bir dəfə göstərir** (kopyalama düyməsi ilə) VƏ eyni zamanda yeni istifadəçinin e-poçtuna avtomatik e-poçt göndərir (Firebase Extensions "Trigger Email" və ya SendGrid/Resend inteqrasiyası).
3. Yeni istifadəçi ilk dəfə e-poçt + müvəqqəti parol ilə daxil olur.
4. Sistem `mustChangePassword == true` olduğunu görür → istifadəçini **"Yeni Parol Təyin Et"** ekranına yönləndirir (bu ekrandan başqa heç bir marşruta keçid mümkün deyil — route guard middleware ilə təmin olunur).
5. İstifadəçi yeni parolu iki dəfə daxil edir (minimum tələblər: 8+ simvol, ən az 1 böyük hərf, 1 rəqəm) → Firebase Auth `updatePassword` çağırılır, `mustChangePassword: false` olur, istifadəçi əsas Dashboard-a yönləndirilir.

### 3.4. Sessiya idarəetməsi

- Firebase Auth ID token-lər 1 saat etibarlıdır, SDK avtomatik yeniləyir.
- "Məni xatırla" seçimi ilə uzunmüddətli sessiya (Firebase persistence: `local` vs `session`).
- İstifadəçi profil ayarlarından aktiv sessiyaları görüb məcburi çıxış edə bilər (opsional, gələcək faza).

---

## 4. Rol İdarəetməsi (Role Management) Modulu

### 4.1. Konsepsiya

Rol = icazələr toplusunun adlandırılmış paketidir. Rollar **iki səviyyəlidir**:

1. **Sistem Rolları (built-in, silinə bilməz, lakin kopyalanıb fərdiləşdirilə bilər):**

| Rol | Təsvir |
|---|---|
| Platform Super Admin | Bütün sistemə tam giriş, Company yaratma/söndürmə |
| Company Admin | Bir Company daxilində tam səlahiyyət (istifadəçi idarəetməsi daxil) |
| Chief Accountant (Baş Mühasib) | Mühasibat, IFRS hesabatlar, kassa/bank — tam giriş; HR-a yalnız oxuma |
| Accountant (Mühasib) | Əməliyyat jurnalı, faktura, kassa — yaratma/redaktə, hesabatlara yalnız oxuma |
| HR Manager | HR modulu tam giriş, digər modullara giriş yoxdur |
| Sales Manager | Satış, faktura, müştəri kataloqu tam giriş |
| Warehouse Operator | Anbar modulu tam giriş, digərlərinə giriş yoxdur |
| Viewer (Yalnız Baxış) | Bütün icazə verilmiş modullarda yalnız oxuma, heç bir yazma |

2. **Fərdi Rollar (custom):** Hər Company öz ehtiyacına uyğun yeni rol yarada bilər (məs. "Anbar + Satış Nəzarətçisi") — mövcud sistem rolundan **kopyalayaraq** və ya sıfırdan icazə seçərək.

### 4.2. Rol İdarəetməsi ekranının funksional tələbləri

- Rolların siyahısı (cədvəl: Ad, Tip [Sistem/Fərdi], Bu rola təyin olunmuş istifadəçi sayı, Yaradılma tarixi).
- "Yeni Rol Yarat" — sıfırdan və ya mövcud roldan kopyalayaraq.
- Rol redaktə ekranı: sol tərəfdə modul siyahısı (Anbar, Satış, HR, Mühasibat və s.), sağda hər modul üçün checkbox matrisi (bax Bölmə 7 — Access Management ilə birləşir).
- Rol silinməsi: yalnız fərdi rollar silinə bilər və yalnız həmin rola heç bir istifadəçi təyin olunmayıbsa; əks halda sistem xəbərdarlıq göstərir və "əvvəlcə istifadəçiləri başqa rola köçürün" tələb edir.
- Rol tarixçəsi/audit: kim, nə vaxt, hansı icazəni əlavə/çıxarıb.

### 4.3. `roles/{roleId}` sənəd sxemi

```
roles/{roleId}
├── name: string
├── description: string
├── type: enum                  // system | custom
├── companyId: string | null    // system rollar üçün null (bütün Company-lər üçün şablon), custom üçün konkret companyId
├── clonedFromRoleId: string | null
├── permissions: string[]       // permission ID-lərin siyahısı, bax Bölmə 7
├── isDefaultForNewClientUser: boolean
├── createdAt, updatedAt: timestamp
└── createdBy: string (uid)
```

---

## 5. Dashboard Modulu (Əsas Konsepsiya)

> Ətraflı widget builder, KPI kataloqu və fərdiləşdirmə mexanizmi **Fayl 3**-də verilir. Burada yalnız Dashboard-un platforma daxilindəki yeri və əsas tələblər təsvir olunur.

### 5.1. Üç Dashboard səviyyəsi

1. **Platform Dashboard** (yalnız Super Admin) — bütün Company-lər üzrə ümumi metrikalar: aktiv müştəri sayı, ümumi istifadəçi sayı, sistem sağlamlığı, son fəaliyyətlər.
2. **Company Dashboard** (Staff/Client User, aktiv Company kontekstində) — seçilmiş Company-nin maliyyə/əməliyyat KPI-ları: gəlir, xərc, kassa qalığı, ödənilməmiş fakturalar, HR göstəriciləri (aktiv işçi sayı, gözləyən məzuniyyət tələbləri).
3. **Rol-əsaslı default Dashboard** — hər rol ilk dəfə daxil olanda ona uyğun defolt widget dəsti göstərilir (məs. HR Manager → işçi/məzuniyyət widget-ləri; Mühasib → kassa/bank widget-ləri).

### 5.2. Minimum tələblər

- Real-time yenilənmə (Firestore listener-lərlə, səhifə yenilənmədən).
- Tarix aralığı filtri (bu ay, bu rüb, bu il, fərdi aralıq).
- Mobil ekranda widget-lər tək sütuna keçir (bax Bölmə 9.4).
- Hər widget-in sağ üst küncündə "..." menyu: Excel-ə ixrac, tam ekran, widget-i sil (fərdiləşdirmə).

---

## 6. Səlahiyyət İdarəetməsi (Access Management) Modulu

Rol İdarəetməsi "kim hansı paketə malikdir"-i, Access Management isə **"paketin daxilində konkret nə var"**-ı və **əlavə məhdudiyyətləri** idarə edir.

### 6.1. İcazə modeli: Modul × Əməliyyat matrisi

Hər icazə `{modul}.{alt-modul}.{əməliyyat}` formatında ID-yə malikdir. Əməliyyat tipləri bütün modullar üçün ümumidir:

| Əməliyyat kodu | Mənası |
|---|---|
| `view` | Görmə/oxuma |
| `create` | Yeni qeyd yaratma |
| `edit` | Mövcud qeydi dəyişdirmə |
| `delete` | Silmə |
| `approve` | Təsdiqləmə (workflow ilə əlaqəli, bax Fayl 4) |
| `export` | Excel/PDF ixracı |
| `print` | Çap/blank generasiyası |
| `manage_settings` | Modulun tənzimləmələrini dəyişmə |

**Nümunə permission kataloqu (ilkin seed, digər modullar əlavə olunduqca genişlənəcək):**

```
platform.users.manage
platform.roles.manage
platform.company.settings.edit
sales.invoice.view / create / edit / delete / approve / export / print
sales.customer.view / create / edit / delete
warehouse.stock.view / create / edit / delete / export
accounting.journal.view / create / edit / approve / export
accounting.reports.ifrs.view / export
hr.employee.view / create / edit / delete
hr.employee.salary.view          // AYRICA icazə — həssas maaş məlumatı üçün
hr.leave.view / create / approve
payroll.run.view / create / approve / export
cashbank.transaction.view / create / approve
workflow.designer.manage
dashboard.customize
```

### 6.2. Sahə-səviyyəli (field-level) məhdudiyyət nümunəsi

Bəzi sahələr rol icazəsindən asılı olmayaraq əlavə qorunma tələb edir — ən tipik nümunə **əmək haqqı məbləği**dir. Sistem bunu ayrıca `hr.employee.salary.view` icazəsi ilə idarə edir: `hr.employee.view` icazəsi olan, lakin `hr.employee.salary.view` icazəsi olmayan istifadəçi işçi kartını görür, amma maaş sahəsi UI-da `•••••` kimi maskalanır və API cavabında da tam çıxarılır (backend-də filtrlənir, sadəcə frontend-də gizlədilmir).

### 6.3. Vəzifələrin Ayrılması (Segregation of Duties — SoD)

Maliyyə nəzarəti üçün mühüm tələb: eyni istifadəçi **eyni əməliyyatı həm yarada, həm təsdiqləyə bilməməlidir** (fırıldaq riskinin azaldılması, qlobal audit standartı). Sistem bu qaydanı rol konfiqurasiyasında **xəbərdarlıq** şəklində tətbiq edir: əgər bir rola həm `*.create` həm `*.approve` icazəsi eyni modulda verilirsə, Rol Redaktə ekranı sarı xəbərdarlıq göstərir: *"Bu rol həm yaratma, həm təsdiqləmə icazəsinə malikdir — daxili nəzarət prinsipinə zidd ola bilər."* (Bloklama deyil, xəbərdarlıq — çünki kiçik şirkətlərdə tək mühasib ola bilər).

### 6.4. Access Management ekranının funksional tələbləri

- Rol seçimi → sağda modul-əsaslı akkordeon (hər modul açılıb-bağlanır), hər əməliyyat üçün checkbox.
- "Hamısını seç / heç birini seçmə" düymələri modul səviyyəsində.
- Dəyişikliklər "Yadda saxla" düyməsinə basılana qədər tətbiq olunmur, dəyişiklik olduqda "Yadda saxlanılmamış dəyişikliklər var" xəbərdarlığı.
- Konkret istifadəçi üçün rol-üstü fərdi icazə əlavəsi/çıxarılması (`customPermissionOverrides`) — nadir hallar üçün (məs. bir mühasibə müvəqqəti əlavə icazə).
- **İcazə Audit Jurnalı:** kim, nə vaxt, hansı icazəni, hansı rolda dəyişib — geri qaytarıla bilən tarixçə.

---

## 7. Qlobal UI/UX Standartları

### 7.1. Şrift

- **Bütün platformada, istisnasız olaraq Montserrat şrifti istifadə olunur** (başlıqlar, mətn, düymələr, cədvəllər, PDF/Excel export şablonları daxil olmaqla).
- Google Fonts-dan `next/font/google` vasitəsilə yüklənir (performans üçün `font-display: swap`, yalnız istifadə olunan çəkilər: 400, 500, 600, 700, 800).
- Tailwind konfiqurasiyasında `fontFamily.sans = ['Montserrat', 'sans-serif']` olaraq təyin olunur ki, bütün komponentlər defolt olaraq bu şrifti istifadə etsin.

### 7.2. Tema: Light / Dark rejim

- İki tema: **Light** və **Dark**, əlavə olaraq **System** (əməliyyat sisteminin tərcihinə uyğunlaşma) seçimi.
- Tema seçimi `next-themes` kitabxanası ilə idarə olunur, CSS dəyişənləri (`--background`, `--foreground`, `--primary` və s.) vasitəsilə shadcn/ui dizayn token sistemi istifadə olunur.
- İstifadəçi seçimi `users/{uid}.preferredTheme` sahəsində saxlanılır və hər cihazda sinxronlaşır.
- Bütün fərdi komponentlər (qrafiklər, badge-lər, status rəngləri) hər iki temada oxunaqlı olmalıdır (kontrast nisbəti WCAG AA standartına uyğun, minimum 4.5:1).

### 7.3. Dil seçimi: Azərbaycan / İngilis

- `next-intl` ilə tam i18n arxitekturası: `/az/...` və `/en/...` marşrut prefiksləri.
- Tərcümə faylları modul-əsaslı ayrılır: `messages/az/common.json`, `messages/az/hr.json`, `messages/az/sales.json` və s. (Fayl 2-10 hər biri öz tərcümə açarlarını əlavə edəcək).
- İstifadəçi dil seçimi `users/{uid}.preferredLanguage` sahəsində saxlanılır.
- **Company-səviyyəli defolt dil** də mövcuddur (`companies/{id}.settings.language`) — yeni istifadəçi əlavə olunanda bu defolt tətbiq olunur.
- Tarix/rəqəm/valyuta formatları dilə uyğun lokallaşdırılır (`Intl.NumberFormat`, `Intl.DateTimeFormat`) — məs. AZ üçün `1 234,56 ₼`, EN üçün `1,234.56 AZN`.
- **Vacib qeyd:** Excel export və PDF blank şablonları da seçilmiş dilə uyğun generasiya olunmalıdır (sütun başlıqları, statuslar və s. tərcümə olunur).

### 7.4. Mobil Responsivlik

- Breakpoint strategiyası (Tailwind defolt): `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`.
- Naviqasiya: masaüstündə sol sidebar, mobil/planşetdə alt "bottom navigation" və ya açılan hamburger menyu.
- Cədvəllər (data table) mobil ekranda üfüqi scroll və ya "kart görünüşü"nə (hər sətir bir kart) transformasiya olunur — hər modulda konkret data table komponenti bu iki rejimi dəstəkləməlidir.
- Dashboard widget-ləri mobil ekranda tək sütuna yığılır (bax 5.2).
- Formlar mobil ekranda tam en (full-width) sahələrlə göstərilir, çoxaddımlı formlar (məs. müştəri qeydiyyatı) step-indicator ilə mobil-dost formada təqdim olunur.
- Toxunma hədəfləri (butonlar, checkbox-lar) minimum 44×44px ölçüsündə (mobil accessibility standartı).

### 7.5. Accessibility (əlavə tövsiyə)

- Bütün interaktiv elementlərdə klaviatura ilə naviqasiya mümkün olmalıdır.
- shadcn/ui komponentləri Radix UI əsaslı olduğu üçün ARIA dəstəyi doğuşdan mövcuddur — bu üstünlük qorunmalıdır.

---

## 8. Valyuta İdarəetməsi (Currency Management) — Əsas Tənzimləmələr

> Tam multi-currency əməliyyat məntiqi (məzənnə tarixçəsi, konvertasiya, mənfəət/zərər fərqləri) Fayl 7 və Fayl 8-də əməliyyat səviyyəsində detallandırılır. Burada yalnız **platform-səviyyəli əsas struktur** verilir.

### 8.1. `currencies` kolleksiyası (qlobal, bütün Company-lər üçün ortaq siyahı)

```
currencies/{isoCode}          // məs. "AZN", "USD", "EUR", "TRY", "RUB"
├── isoCode: string
├── name: { az: string, en: string }
├── symbol: string             // "₼", "$", "€"
├── decimalPlaces: number      // default 2
└── isActive: boolean
```

### 8.2. Company-səviyyəli tənzimləmə

- Hər Company qeydiyyat zamanı **əsas valyuta** (`baseCurrency`, default `AZN`) təyin edir — bu, bütün mühasibat və IFRS hesabatlarının aparıldığı valyutadır.
- Company Admin **İcazə verilən əməliyyat valyutaları** siyahısını tənzimləyə bilər (məs. fakturaları həm AZN, həm USD-də kəsmək istəyən şirkət üçün).
- Məzənnələr üçün mənbə seçimi: **Manual daxiletmə** (mühasib gündəlik/aylıq kurs daxil edir) və ya **Avtomatik** (Azərbaycan Mərkəzi Bankının rəsmi API-si ilə gündəlik sinxronizasiya, Cloud Scheduler ilə hər gün saat 09:00-da). Hər iki rejim dəstəklənir, Company səviyyəsində seçilir.
- Məzənnə tarixçəsi `exchangeRates/{companyId}_{date}_{fromCurrency}_{toCurrency}` formatında saxlanılır ki, keçmiş tarixli əməliyyatlar həmin günün kursu ilə uzlaşdırıla bilsin.

---

## 9. Bildiriş Sistemi (Notifications)

- **In-app bildirişlər:** zəng ikonu, oxunmamış say göstəricisi, real-time Firestore listener (`notifications` kolleksiyası, `{userId, companyId, type, title, body, link, isRead, createdAt}`).
- **E-poçt bildirişləri:** kritik hadisələr üçün (yeni istifadəçi yaradılması, workflow təsdiq tələbi, ödəniş vaxtı yaxınlaşması) — Firebase Trigger Email extension və ya Resend/SendGrid API vasitəsilə Cloud Function-dan göndərilir.
- Bildiriş növləri həm platform (Fayl 1) həm digər modullar (Fayl 4-ün Workflow mühərriki, Fayl 10-un məzuniyyət təsdiqi və s.) tərəfindən trigger olunur — ümumi `sendNotification(userId, type, payload)` Cloud Function köməkçisi bütün modullar tərəfindən istifadə olunur.
- İstifadəçi Profil ayarlarından bildiriş kanallarını (in-app/email) növ üzrə aça/bağlaya bilər.

---

## 10. Audit Log və Fəaliyyət Tarixçəsi

Bütün kritik yazma əməliyyatları (`create`, `update`, `delete`, `approve`, giriş/çıxış, icazə dəyişikliyi) mərkəzi `auditLogs` kolleksiyasına yazılır:

```
auditLogs/{autoId}
├── companyId: string | null      // platform-səviyyəli hadisələr üçün null
├── userId: string
├── userDisplayName: string       // denormallaşdırılmış, sürətli göstərim üçün
├── action: string                // "INVOICE_CREATED", "ROLE_PERMISSION_CHANGED", "LOGIN_SUCCESS" və s.
├── entityType: string            // "invoice", "user", "role" və s.
├── entityId: string
├── before: map | null            // dəyişiklikdən əvvəlki vəziyyət (update/delete üçün)
├── after: map | null             // dəyişiklikdən sonrakı vəziyyət
├── ipAddress: string
├── userAgent: string
└── timestamp: timestamp
```

- Bu jurnal **dəyişdirilə/silinə bilməz** (Security Rules-da yalnız Cloud Function service account-a yazma icazəsi, istifadəçilərə yalnız `read` icazəsi verilir, hətta Super Admin belə silə bilməz).
- Company Admin öz Company-sinin audit jurnalını görə bilər (icazə: `platform.audit.view`); Platform Super Admin bütün jurnalı görür.
- UI-da filtrlənə bilən cədvəl: istifadəçi, tarix aralığı, əməliyyat növü, modul üzrə.

---

## 11. Funksional Olmayan Tələblər (Non-Functional Requirements)

| Kateqoriya | Tələb |
|---|---|
| **Performans** | Dashboard ilkin yüklənmə < 2san (Vercel Edge + Next.js ISR/streaming); Firestore sorğularında pagination (default 25 sətir), sonsuz siyahılardan qaçınmaq |
| **Miqyaslanma** | Firestore composite index-lər hər yeni sorğu nümunəsi üçün əvvəlcədən planlaşdırılmalı (`firestore.indexes.json` versiyalanır) |
| **Təhlükəsizlik** | Bütün trafik HTTPS; Firebase App Check aktiv (bot/skript hücumlarının qarşısını almaq üçün); Firestore Security Rules 100% test coverage (Firebase Emulator Suite ilə) |
| **Backup/Bərpa** | Firestore-un gündəlik avtomatik export-u ayrı Cloud Storage bucket-ə (Cloud Scheduler + Firestore Export API), 30 günlük saxlama |
| **Availability** | Firebase/Vercel SLA-larına etibar; kritik Cloud Function-lar üçün retry mexanizmi |
| **Brauzer dəstəyi** | Son 2 versiya: Chrome, Edge, Safari, Firefox; mobil Safari/Chrome |
| **Loqlaşdırma** | Bütün Cloud Function xətaları Cloud Logging-ə, kritik xətalar üçün Slack/E-poçt xəbərdarlığı (opsional inteqrasiya) |
| **Məlumatın saxlanma yeri** | Firebase layihəsi `europe-west1` (Belçika) və ya ən yaxın uyğun region seçilməli — Azərbaycan qanunvericiliyinə uyğun məlumat lokasiyası tələbləri olarsa, bu qərar hüquqi məsləhətlə yenidən yoxlanılmalıdır |

---

## 12. GitHub / Vercel Deployment Strategiyası

### 12.1. Repo və Branch qaydaları

- Tək monorepo (`taxiq/`), yuxarıda 1-ci bölmədə göstərilən struktur.
- `main` branch → yalnız Pull Request vasitəsilə, minimum 1 review tələb olunur (GitHub Branch Protection).
- Hər PR açıldıqda Vercel avtomatik **Preview Deployment** yaradır — QA bu linkdə test edir.
- `main`-ə merge → avtomatik **Production Deployment**.
- `develop` branch (əgər istifadə olunursa) → Staging Firebase layihəsinə bağlı ayrı Vercel environment.

### 12.2. Environment Variables idarəsi

- Firebase konfiqurasiyası (`apiKey`, `projectId` və s.) — public açardır, Vercel Environment Variables-da saxlanılır (`NEXT_PUBLIC_FIREBASE_*`).
- Həssas açarlar (Firebase Admin SDK service account, e-poçt provayder API açarı) — **yalnız** Cloud Functions mühitində (`firebase functions:config:set` və ya Secret Manager), heç vaxt frontend bundle-a düşməməlidir.
- `.env.example` faylı repo-da saxlanılır, real `.env` `.gitignore`-dadır.

### 12.3. CI Pipeline (GitHub Actions)

Hər PR üçün:
1. `pnpm install`
2. `pnpm lint` + `pnpm typecheck`
3. `pnpm test` (unit testlər)
4. Firebase Emulator Suite ilə Security Rules testləri
5. Vercel preview build (Vercel öz GitHub inteqrasiyası ilə avtomatik)

`main`-ə merge zamanı əlavə olaraq: `firebase deploy --only firestore:rules,functions` (Firebase CLI GitHub Action vasitəsilə).

---

## 13. Qəbul Meyarları (Acceptance Criteria) — Modul 1

- [ ] İlkin `admin`/`admin` hesabı işləyir və ilk girişdə məcburi parol dəyişikliyinə yönləndirir.
- [ ] Yeni istifadəçi yaradıldıqda müvəqqəti parol həm ekranda göstərilir, həm e-poçtla göndərilir, ilk girişdə parol dəyişikliyi məcburidir.
- [ ] Staff istifadəçi 2+ Company-yə təyin edildikdə Company Switcher düzgün işləyir və hər Company-də fərqli rol/icazə tətbiq olunur.
- [ ] Client User yalnız öz Company-sini görür — heç bir API cavabında, heç bir Excel export-da başqa Company-nin datası sızmır (Security Rules avtomatlaşdırılmış testlərlə yoxlanılıb).
- [ ] Rol yaratma/redaktə/kopyalama tam işləkdir, icazə matrisi UI-dan idarə olunur.
- [ ] `hr.employee.salary.view` icazəsi olmayan istifadəçi maaş məlumatını heç bir formada görmür.
- [ ] Bütün UI Montserrat şrifti ilə göstərilir, Light/Dark rejim keçidi ani və tutarlıdır.
- [ ] AZ/EN dil keçidi bütün ekranlarda (o cümlədən Excel/PDF export başlıqlarında) işləyir.
- [ ] Mobil ekranda (375px eni) bütün əsas ekranlar istifadə oluna bilir, üfüqi scroll problemi yoxdur.
- [ ] Audit jurnalı bütün kritik əməliyyatları qeyd edir və heç bir rol tərəfindən silinə bilmir.
- [ ] Firestore Security Rules Emulator testlərinin 100%-i keçir.

---

## 14. Digər Modullara İstinadlar

Bu sənəddə təyin olunan aşağıdakı obyektlərə Fayl 2–10-da istinad ediləcək:
- `companies/{companyId}` və `companyId` sahəsi — **bütün** biznes sənədlərində məcburidir.
- `users/{uid}`, `userCompanyAccess`, `roles`, permission ID formatı (`{modul}.{alt-modul}.{əməliyyat}`).
- `hasCompanyAccess()` və `hasPermission()` Security Rules funksiyaları — hər yeni kolleksiya üçün təkrar istifadə olunacaq.
- Montserrat/Dark-Light/AZ-EN/Mobil standartları — **istisnasız bütün modullarda** tətbiq olunur, təkrar izah edilməyəcək.
- `sendNotification()` köməkçi funksiyası — Fayl 4 (Workflow) və Fayl 10 (HR) tərəfindən istifadə olunacaq.
- `auditLogs` strukturu — bütün modullar öz əməliyyatlarını buraya yazacaq.

**Növbəti fayl:** Modul 2 — Müştəri (Tenant) Qeydiyyatı və Profil İdarəetməsi (sektor şablonları: istehsalat, retail, otelçilik və s.).
