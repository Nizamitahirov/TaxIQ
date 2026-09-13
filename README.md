# TaxIQ

Çoxmüştərili (multi-tenant) **Mühasibat/HR Konsaltinq Təcrübə İdarəetmə Platforması**.
Konsaltinq firması bir hesabla bir neçə müştəri şirkəti arasında keçid edərək onların
uçotunu, HR-ını və satışını idarə edir (Xero Practice Manager / QuickBooks Online
Accountant modeli).

## Texnoloji stek

- **Next.js 14** (App Router) + **TypeScript**
- **Firebase**: Authentication · Cloud Firestore · Storage
- **Tailwind CSS** + shadcn/ui (Radix) · **Montserrat** şrifti
- **next-intl** (AZ/EN) · **next-themes** tərzi light/dark
- **TanStack Query** · **Recharts** · **SheetJS (xlsx)**

## Hazırkı status (Milestone 1)

**Bütün 10 modul qurulub və `main`-ə merge olunub.**

| Modul | Status | Əsas funksiyalar |
|---|---|---|
| **1. Platform / Auth / RBAC** | ✅ | Multi-tenancy, Company Switcher, istifadəçi+rol idarəetməsi, audit, bildirişlər |
| **2. Müştəri onboarding** | ✅ | 6 addımlı sihirbaz, 7 sektor şablonu, şirkət lifecycle, şöbələr |
| **3. Dashboard / Export** | ✅ | Platform + Şirkət + rol-əsaslı panel, KPI, Excel export framework |
| **4. Workflow** | ✅ | Workflow tərifləri, şablon kitabxanası, birləşdirilmiş təsdiq inbox-u |
| **5. Anbar** | ✅ | Mal/xidmət kataloqu, davamlı uçot, orta çəkili dəyərləndirmə, transfer |
| **6. Satış / Faktura** | ✅ | Müştərilər, fakturalar (→ jurnal), quote→order→invoice, AR aging, çap |
| **7. Kassa / Bank** | ✅ | Bank/kassa, ödənişlər (→ faktura + jurnal), kreditor fakturalar, kassa kitabı |
| **8. Mühasibat nüvəsi** | ✅ | AZ MMUS/IFRS Hesablar Planı, ikili yazılış, trial balance, dövrlər, əsas vəsaitlər |
| **9. IFRS hesabatlar** | ✅ | Balans, Mənfəət-Zərər, Pul axını, Kapital dəyişiklikləri (avtomatik) |
| **10. HR / Payroll** | ✅ | İşçilər, məzuniyyət, versiyalanan vergi konfiqurasiyası, payroll (→ jurnal), payslip |

### Maliyyə axını (uçdan-uca işləyir)
Satış/Anbar/Kassa/HR əməliyyatları → **avtomatik ikili jurnal yazıları (Modul 8)** →
trial balance → **IFRS maliyyə hesabatları (Modul 9)**.

### Cloud Functions tələb edən gələcək fazalar (sənədlənib)
Bəzi funksiyalar spesifikasiyada MVP/gələcək faza kimi qeyd olunub və Firebase Cloud
Functions (Blaze planı) deploy-u tələb edir: workflow avtomatik icra mühərriki
(Firestore triggers + Cloud Tasks), e-qaimə/e-gov API inteqrasiyaları, GrapesJS+Puppeteer
PDF dizayneri, bank çıxarışı uzlaşdırması, gecə KPI/amortizasiya scheduler-ləri, FIFO
qat izləməsi. Hazırkı versiyada bunların funksional client-side alternativləri verilib
(məs. balans yoxlaması postJournalEntry-də, çap window.print ilə, toplu fayl CSV).

## Quraşdırma

```bash
# 1. Asılılıqlar
npm install

# 2. Firebase web config
cp .env.example .env.local   # dəyərlər artıq taxiq-f2d9d üçün doldurulub

# 3. Firebase layihəsini hazırla (bir dəfə, Cloud Shell-də)
#    scripts/taxiq-firebase-setup.sh — Firestore yaradır, API-ları açır, IAM verir
#    Sonra Console → Authentication → Email/Password → Enable

# 4. Bootstrap seed (admin/admin123, Company #1, valyutalar)
GOOGLE_APPLICATION_CREDENTIALS=./taxiq-service-account.json npm run seed

# 5. İşə sal
npm run dev
```

> ⚠️ `taxiq-service-account.json` (Firebase admin SDK açarı) **heç vaxt repoya commit
> edilmir** — `.gitignore`-dadır.

## İlk giriş

- İstifadəçi adı: **admin** · Parol: **admin123**
- İlk girişdən sonra sistem məcburi parol dəyişikliyinə yönləndirir (01 §3.3).

## Deploy

- **Frontend → Vercel** (`NEXT_PUBLIC_FIREBASE_*` environment variables).
- **Rules/Indexes → Firebase**: `firebase deploy --only firestore:rules,firestore:indexes,storage`

## Struktur

```
app/                  Next.js App Router (auth + dashboard route group-ları)
components/            UI primitivləri, layout (sidebar/topbar/company-switcher), charts
lib/firebase/          Firebase client, auth, tenant-scoped firestore, access resolver
lib/rbac/              İcazə kataloqu + sistem rolları (01 §6–7)
lib/dashboard/         KPI yükləyiciləri (03 §2)
types/                 Firestore sənəd tipləri
scripts/seed.mjs       Bootstrap seed
firestore.rules        Multi-tenant security rules (01 §2.7)
```

Spesifikasiyalar repo kökündəki `01-…10-*.md` fayllarındadır.
