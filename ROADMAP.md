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
- [ ] Çox-anbar / partiya-seriya / son istifadə tarixi (FEFO)
- [ ] Bank feed (open banking) — indi yalnız fayl idxal/ixrac
- [ ] Sənəd idarəetməsi (DMS) + ASAN İmza

## Faza 3 — Yetkinlik
- [ ] CRM e-poçt/SMS göndərişi
- [ ] İşə qəbul / performans / org-struktur
- [x] **Pul vəsaiti proqnozu** (`/cashflow`): 6 aylıq AR daxilolma / AP ödəniş proqnozu, açılış qalığı, kumulyativ qalıq + qrafik
- [ ] Konsolidə (qrup) hesabatlıq
- [ ] Avtomatlaşdırılmış testlər + xəta izləmə (Sentry) + backup

## Qeyd (infrastruktur asılılığı)
Faza 1.5 və bank/e-taxes/e-poçt inteqrasiyaları **Firebase Blaze planı +
Cloud Functions** və müvafiq API açarları tələb edir — kod hazırlana bilər,
amma deploy müştəri mühitində aparılmalıdır.

## Faza 1 — əlavə edilən
- [x] **Amortizasiya cədvəli** (`/depreciation`): əsas vəsaitlər üzrə aylıq köhnəlmə,
      yığılmış/NBV, qalan ay, icra % + 12 aylıq NBV proqnoz qrafiki + Excel.
