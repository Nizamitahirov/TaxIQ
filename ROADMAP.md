# TaxIQ — Yol Xəritəsi (A-Z tam funksionallıq planı)

Bu sənəd bir şirkəti sıfırdan sona qədər idarə etmək üçün qalan işləri
fazalarla izləyir. Client-side qurula bilənlər bir-bir əlavə olunur;
infrastruktur (Cloud Functions / xarici API) tələb edənlər ayrıca qeyd olunur.

## ✅ Artıq mövcuddur (bu sessiyada tamamlanan seçmələr)
- Storage təhlükəsizliyi (şirkət-əsaslı), RBAC access-repair, Firestore index-siz sorğular
- Excel idxal (əməkdaş/müştəri/təchizatçı/mal)
- Rəsmi hesabatlar: DSMF formaları + maaş cədvəli + iş vaxtı tabeli (şablon görünüşlü preview)
- İstifadəçi təlimatı səhifəsi (/guide), login yenidizayn, dashboard chart, tab wrap düzəlişi

## Faza 1 — Kritik (bir şirkəti tam A-Z aparmaq)
- [x] **1.1 Vergi bəyannamələri** (`/tax`): ƏDV (çıxış−giriş), ödəmə mənbəyində
      gəlir vergisi, mənfəət vergisi (20%) — real fakturalar/alışlar/payroll/P&L-dən,
      Excel ixrac. ⏳ *Qalan:* e-taxes.gov.az XML formatı + birbaşa göndərmə (API).
- [x] **1.2 Payslip + maaş bank faylı** — payslip çapı (əvvəldən) + IBAN-lı toplu
      maaş ödəniş faylı (Excel, işçi IBAN-larından; IBAN çatışmayanları xəbərdarlıq edir).
- [x] **1.3 Satınalma PO (MVP)** (`/purchase-orders`): sifariş yarat (təchizatçı +
      sətirlər) → təsdiq → mal qəbulu → fakturaya çevirmə (kreditor faktura yaranır).
      ⏳ *Qalan:* miqdar-səviyyəli qismən qəbul və PO↔qəbul↔faktura kəmiyyət uzlaşması.
- [ ] **1.4 ƏDV subledger** (giriş/çıxış ƏDV hesabları, 18% depozit).
- [ ] **1.5 (infra) Cloud Functions fazası** — scheduler (təkrarlanan faktura,
      amortizasiya, overdue, FX revalvasiya), server-yoxlama, bildiriş çatdırılması.

## Faza 2 — Genişləndirmə
- [x] **Büdcə (plan-fakt)** (`/budget`): P&L kateqoriyaları üzrə illik plan;
      fakt IFRS-dən avtomatik; fərq/icra faizi + Excel. ⏳ *Qalan:* xərc mərkəzləri
      (departament) üzrə bölgü, aylıq plan.
- [x] **Satış qaytarması / kredit-not** (`/credit-notes`): rəsmiləşmiş fakturanı
      tam geri qaytarır — əks-yazı (Dt 601+521 / Kt 211) mühasibata düşür, faktura
      bağlanır. ⏳ *Qalan:* qismən kredit-not, çatdırılma sənədi (qaimə).
- [x] **Çox-anbar** (mövcud) **+ partiya/lot + son istifadə tarixi (FEFO)** (`/warehouse` → Lot/Son istifadə tabı): lot qəbulu, FEFO sərf, bitmə xəbərdarlığı.
- [ ] Bank feed (open banking) — indi yalnız fayl idxal/ixrac *(infra: API)*
- [x] **Sənəd idarəetməsi (DMS)** (`/files`): Storage-ə yükləmə, kateqoriya, axtarış, yüklə/sil. ⏳ *Qalan:* ASAN İmza (e-imza) — infra.

## Faza 3 — Yetkinlik
- [ ] CRM e-poçt/SMS göndərişi *(infra: e-poçt/SMS API)*
- [x] **İşə qəbul** (`/recruitment`): vakansiyalar + namizəd axını (mərhələlər, reytinq).
- [x] **Performans** (`/performance`): çəkili meyarlar üzrə qiymətləndirmə (1–5).
- [x] **Pul vəsaiti proqnozu** (`/cashflow`): 6 aylıq AR daxilolma / AP ödəniş proqnozu, açılış qalığı, kumulyativ qalıq + qrafik
- [x] **Konsolidə (qrup) hesabatlıq** (`/consolidated`): çoxşirkətli IFRS P&L/Balans birləşdirmə + Excel. ⏳ *Qalan:* intercompany eliminasiya.
- [ ] Avtomatlaşdırılmış testlər + xəta izləmə (Sentry) + backup

## Qalan çatışmayanlar (yalnız infrastruktur tələb edir — bu mühitdə deploy olunmur)
- **Cloud Functions scheduler** (təkrarlanan faktura, aylıq amortizasiya, overdue, FX revalvasiya avtomatik) — Blaze planı.
- **e-taxes.gov.az XML birbaşa göndərmə** (bəyannamələr artıq hesablanır, ixrac olunur; API göndərmə qalır).
- **Bank open-banking feed** (hazırda fayl idxal/ixrac var).
- **CRM e-poçt/SMS göndərişi** və **ASAN İmza e-imza** — xarici API açarları.
- **CI/backup/Sentry** — pipeline müştəri mühitində qurulur.

## Qeyd (infrastruktur asılılığı)
Faza 1.5 və bank/e-taxes/e-poçt inteqrasiyaları **Firebase Blaze planı +
Cloud Functions** və müvafiq API açarları tələb edir — kod hazırlana bilər,
amma deploy müştəri mühitində aparılmalıdır.

## Faza 1 — əlavə edilən
- [x] **Amortizasiya cədvəli** (`/depreciation`): əsas vəsaitlər üzrə aylıq köhnəlmə,
      yığılmış/NBV, qalan ay, icra % + 12 aylıq NBV proqnoz qrafiki + Excel.

## Platforma qeydlərinə (Excel) əsasən əlavə edilən
- [x] **8 yeni sektor şablonu**: İctimai İaşə, Kənd təsərrüfatı, Nəqliyyat/Logistika,
      Təhsil, İcarə/Lizinq, Turizm, İctimai Sektor/QHT, Tibb/Klinika — sektora uyğun
      defolt modullar, şöbələr, KPI-lar və fərdi sahələrlə.
- [x] **Rəsmi fəaliyyət kodları** (2775 ədəd, 7 rəqəmli): şirkət qeydiyyatında
      axtarışlı seçim (`ActivityCodePicker`) — sihirbaz + şirkət redaktəsi.
- [x] **Müqavilələr** (`/contracts`): mərkəzi reyestr (növ/tərəf/müddət/dəyər/status,
      bitmə xəbərdarlığı).
- [x] **Debit-notlar** (`/debit-notes`): alış qaytarması — kreditor fakturanın tam
      əks-yazısı (Dt 531 / Kt 205 +226).
- [x] **Sənədlər hub** (`/documents`): Malların təhvil-verilmə qaiməsi (fakturadan),
      CMR (yerli+beynəlxalq), Remittance advice — hamısı A4 çap şablonu ilə.
- [x] **İstehsal** (`/production`): reseptlər (BOM) + istehsal sifarişləri,
      tamamlananda maya dəyəri kapitallaşdırılır (Dt 204 / Kt 201 +533 +731).
- [x] **Qeyri-maddi aktivlər** (`/intangibles`): IAS 38 amortizasiya (Dt 721 / Kt 101),
      qeyri-müəyyən müddətli qudvil, aylıq konsolidasiya.
- ⏳ *Qeyd:* GRN (malların təhvil-alınması) PO qəbul axını ilə örtülür;
      Vergi bəyannamələri artıq `/tax` modulundadır (qeydlərdə bu vərəq boş idi).
