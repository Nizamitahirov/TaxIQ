# TaxIQ ERP — Modul 8: Mühasibat Uçotu Nüvəsi, Hesablar Planı və Əməliyyat Jurnalları

> **Sənəd statusu:** 10 fayldan 8-cisi. Bu, platformanın **mühasibat "ürəyi"dir** — Fayl 5 (Anbar), Fayl 6 (Satış), Fayl 7 (Kassa/Bank) və Fayl 10 (HR/Əmək Haqqı) bu modula avtomatik jurnal yazıları göndərəcək; Fayl 9 (IFRS Hesabatlar) isə bu moduldakı hesab qalıqlarından bilavasitə qidalanacaq. Hesablar Planı **Azərbaycan Respublikası Maliyyə Nazirliyinin təsdiq etdiyi, Milli Mühasibat Uçotu Standartlarına (MMUS) və IFRS-ə əsaslanan rəsmi struktura** uyğun qurulub.

---

## 1. Hesablar Planı (Chart of Accounts) — Azərbaycan MMUS/IFRS Struktur

### 1.1. Rəsmi Sinif Strukturu

Azərbaycanın rəsmi hesablar planı 9 sintetik sinifdən (bölmədən) ibarətdir, hər sinif daxilində 2-rəqəmli qrup hesabları və 3-rəqəmli sintetik hesablar mövcuddur. TaxIQ bu strukturu **dəyişməz baza şablonu** kimi qəbul edir (Company-lər bunun üzərinə yalnız əlavə subhesab əlavə edə bilər, əsas nömrələməni poza bilməz — qanuni uyğunluq üçün vacibdir):

| Sinif | Ad | Qrup Hesabları (nümunə) |
|---|---|---|
| **1** | Uzunmüddətli Aktivlər | 10 Qeyri-maddi aktivlər · 11 Torpaq, tikili və avadanlıqlar · 12 İnvestisiya mülkiyyəti · 13 Bioloji aktivlər · 14 Təbii sərvətlər · 15 İştirak payı investisiyaları · 16 Təxirə salınmış vergi aktivləri · 17 Uzunmüddətli debitor borcları · 18 Sair uzunmüddətli maliyyə aktivləri · 19 Sair uzunmüddətli aktivlər |
| **2** | Qısamüddətli Aktivlər | 20 Ehtiyatlar · 21 Qısamüddətli debitor borcları · 22 Pul vəsaitləri və ekvivalentləri · 23 Sair qısamüddətli maliyyə aktivləri · 24 Sair qısamüddətli aktivlər |
| **3** | Kapital | 30 Nizamnamə (nominal) kapital · 31 Emissiya gəliri · 32 Geri alınmış kapital · 33 Kapital ehtiyatları · 34 Bölüşdürülməmiş mənfəət (ödənilməmiş zərər) |
| **4** | Uzunmüddətli Öhdəliklər | 40 Faiz xərcləri yaradan öhdəliklər · 41 Qiymətləndirilmiş öhdəliklər · 42 Təxirə salınmış vergi öhdəlikləri · 43 Uzunmüddətli kreditor borcları · 44 Sair uzunmüddətli öhdəliklər |
| **5** | Qısamüddətli Öhdəliklər | 50 Faiz xərcləri yaradan öhdəliklər · 51 Qiymətləndirilmiş öhdəliklər · 52 Vergi və sair məcburi ödənişlər · 53 Qısamüddətli kreditor borcları · 54 Sair qısamüddətli öhdəliklər |
| **6** | Gəlirlər | 60 Əsas əməliyyat gəliri · 61 Sair əməliyyat gəlirləri · 62 Fəaliyyətin dayandırılmasından gəlir · 63 Maliyyə gəlirləri · 64 Fövqəladə gəlirlər |
| **7** | Xərclər | 70 Satışın maya dəyəri · 71 Kommersiya xərcləri · 72 İnzibati xərclər · 73 Sair əməliyyat xərcləri · 74 Fəaliyyətin dayandırılmasından xərc · 75 Maliyyə xərcləri · 76 Fövqəladə xərclər |
| **8** | Mənfəətlər (Zərərlər) | 80 Ümumi mənfəət (zərər) · 81 Asılı/birgə müəssisələrin mənfəətində pay |
| **9** | Mənfəət Vergisi | 90 Cari və təxirə salınmış mənfəət vergisi xərcləri |

Ən çox istifadə olunan sintetik hesablardan bəziləri (posting qaydalarında birbaşa istinad ediləcək):

| Kod | Ad | Tip |
|---|---|---|
| 111 | Torpaq, tikili və avadanlıqların dəyəri | Aktiv |
| 112 | ...üzrə yığılmış amortizasiya | Aktiv (kontr-hesab) |
| 201 | Material ehtiyatları | Aktiv |
| 204 | Hazır məhsul | Aktiv |
| 205 | Mallar | Aktiv |
| 211 | Alıcıların və sifarişçilərin qısamüddətli debitor borcları | Aktiv |
| 221 | Kassa | Aktiv |
| 223 | Bank hesablaşma hesabları | Aktiv |
| 226 | ƏDV sub-uçot hesabı (ƏDV depozit hesabı sistemi) | Aktiv |
| 341 | Hesabat dövründə xalis mənfəət (zərər) | Kapital |
| 501 | Qısamüddətli bank kreditləri | Öhdəlik |
| 521 | Vergi öhdəlikləri (ƏDV, mənfəət vergisi s.) | Öhdəlik |
| 522 | Sosial sığorta və təminat üzrə öhdəliklər | Öhdəlik |
| 531 | Malsatan və podratçılara qısamüddətli kreditor borcları | Öhdəlik |
| 533 | Əməyin ödənişi üzrə işçi heyətinə olan borclar | Öhdəlik |
| 601 | Satış | Gəlir |
| 611 | Sair əməliyyat gəlirləri | Gəlir |
| 631 | Maliyyə gəlirləri (məzənnə fərqi daxil) | Gəlir |
| 701 | Satışın maya dəyəri üzrə xərclər | Xərc |
| 711 | Kommersiya xərcləri | Xərc |
| 721 | İnzibati xərclər | Xərc |
| 751 | Maliyyə xərcləri (məzənnə fərqi daxil) | Xərc |

### 1.2. `chartOfAccounts/{accountId}` sənəd sxemi

```
chartOfAccounts/{accountId}
├── companyId: string
├── accountCode: string                // "211", "601" s. — rəsmi struktura uyğun
├── accountName: { az: string, en: string }
├── accountClass: number               // 1-9
├── accountGroup: string               // "20", "60" s.
├── accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
├── normalBalance: 'debit' | 'credit'
├── isSubAccount: boolean              // Company-nin əlavə etdiyi fərdi alt-hesabdır
├── parentAccountId: string | null
├── currency: string | null            // null = baseCurrency, dolu = yalnız bu valyutada əməliyyat aparan ayrıca alt-hesab
├── isActive: boolean
└── isSystemAccount: boolean           // true = rəsmi struktura aiddir, silinə bilməz, yalnız fərdi alt-hesab əlavə edilə bilər
```

### 1.3. Sektor Fərqləri (Fayl 2-yə istinad)

- **Otelçilik:** USALI-uyğun departamental hesabatlıq üçün 601 (Satış) hesabının altında **Company-səviyyəsində fərdi alt-hesablar** yaradılır (məs. 601.1 Otaq Gəliri, 601.2 F&B Gəliri) — bu, rəsmi MMUS strukturunu pozmadan (əsas 3-rəqəmli kod saxlanılır), Fayl 2-dəki `departments` dimension-u ilə **çarpaz istinad** (cross-reference) vasitəsilə departamental P&L imkanı yaradır.
- **İstehsalat:** 201 (Material), 202 (İstehsalat məsrəfləri), 204 (Hazır məhsul) hesabları aktiv istifadə olunur.
- **Xidmət/Konsaltinq:** 20 qrupu (Ehtiyatlar) demək olar ki, istifadə olunmur, əsas fəaliyyət 60/70/72 qrupları arasında cərəyan edir.

### 1.4. Hesablar Planı İdarəetmə Ekranı

- Ağac (tree) görünüşü: Sinif → Qrup → Sintetik Hesab → Alt-hesablar.
- Yeni Company yaradılanda Fayl 2-dəki sektor şablonuna uyğun **tam rəsmi Hesablar Planı avtomatik kopyalanır** (boş, sadəcə struktur).
- Yalnız `isSystemAccount: false` olan (Company-nin əlavə etdiyi) alt-hesablar redaktə/silinə bilər.

---

## 2. İkili Yazılış Mühərriki (Double-Entry Engine)

### 2.1. `journalEntries/{entryId}` sənəd sxemi

```
journalEntries/{entryId}
├── companyId: string
├── entryNumber: string                 // avtomatik ardıcıl, Company daxilində unikal
├── entryDate: timestamp
├── postingPeriodId: string             // bax Bölmə 4
├── sourceType: 'manual' | 'sales_invoice' | 'purchase_bill' | 'payment' | 'cash_transaction' | 'stock_movement' | 'payroll' | 'depreciation' | 'fx_revaluation'
├── sourceDocumentId: string | null
├── description: string
├── lines: [{
│     accountId: string,
│     debit: number,                   // yalnız biri dolu olur, digəri 0
│     credit: number,
│     departmentId: string | null,     // Fayl 2, Bölmə 4-ə istinad
│     currency: string,
│     amountInBaseCurrency: number
│   }]
├── status: 'posted' | 'reversed'
├── reversalOfEntryId: string | null
└── createdAt, createdBy: timestamp/string
```

### 2.2. Balans Yoxlaması — Sistemin Ən Kritik Qaydası

**Heç bir `journalEntries` sənədi `Σ(debit) ≠ Σ(credit)` halında yazıla bilməz.** Bu qayda iki qatda tətbiq olunur:

1. **Frontend:** Manual jurnal yazısı formasında real-time balans göstəricisi ("Balanslaşdırılmayıb: 150.00 ₼ fərq") — "Yadda saxla" düyməsi fərq sıfır olmayana qədər deaktivdir.
2. **Backend (əsl təhlükəsizlik sərhədi):** `journalEntries` kolleksiyasına **birbaşa client yazışı Security Rules səviyyəsində tamamilə qadağandır** (`allow write: if false`). Bütün yazılar yalnız **`postJournalEntry()` adlı Cloud Function callable** vasitəsilə keçir, bu funksiya balansı server tərəfində yoxlayır, uyğun deyilsə xəta qaytarır və heç nə yazmır. Bu, mühasibat sisteminin bütövlüyü üçün ən vacib texniki qərardır.

### 2.3. Avtomatik Jurnal Yazısı Mənbələri (Posting Rules)

```
postingRules/{ruleId}
├── companyId: string | null           // null = bütün Company-lər üçün sistem defoltu
├── eventType: string                  // "invoice_sent" | "purchase_bill_approved" | "payment_received" | "payment_made" | "salary_accrued" | "salary_paid" | "depreciation_run" | "fx_revaluation"
├── linesTemplate: [{
│     accountCodeRef: string,          // "211" (dinamik hesab kodu) və ya "auto:customerReceivable" (konteksdən asılı seçim)
│     side: 'debit' | 'credit',
│     amountSource: string             // "invoice.grandTotal" | "invoice.subtotal" | "invoice.vatTotal" s.
│   }]
└── isActive: boolean
```

**Nümunə — Faktura göndərildikdə (Fayl 6):**

| Hesab | Dt | Kt |
|---|---|---|
| 211 — Alıcıların qısamüddətli debitor borcları | `grandTotal` | |
| 601 — Satış | | `subtotal` |
| 521 — Vergi öhdəlikləri (ƏDV) | | `vatTotal` |

**Nümunə — Satılmış Malın Maya Dəyəri (Fayl 5-in `sale_out` hərəkəti ilə paralel):**

| Hesab | Dt | Kt |
|---|---|---|
| 701 — Satışın maya dəyəri üzrə xərclər | COGS məbləği | |
| 205 — Mallar | | COGS məbləği |

**Nümunə — Kreditor faktura təsdiqləndikdə (Fayl 7):**

| Hesab | Dt | Kt |
|---|---|---|
| 205/201 — Mallar/Material | `subtotal` | |
| 226 — ƏDV sub-uçot hesabı | `vatTotal` | |
| 531 — Malsatan və podratçılara kreditor borcları | | `grandTotal` |

**Nümunə — Ödəniş alındı / edildi (Fayl 7):**

| Ssenari | Dt | Kt |
|---|---|---|
| Müştəridən ödəniş | 223 — Bank | 211 — Debitor borcu |
| Kreditora ödəniş | 531 — Kreditor borcu | 223 — Bank |

**Nümunə — Əmək haqqı hesablandı / ödənildi (Fayl 10):**

| Ssenari | Dt | Kt |
|---|---|---|
| Hesablama | 721/711 — İnzibati/Kommersiya xərci | 533 — İşçi heyətinə borc + 522 — Sosial sığorta öhdəliyi |
| Ödəniş | 533 — İşçi heyətinə borc | 223 — Bank |

Bu cədvəllər `postingRules` konfiqurasiyasının **defolt seed məlumatı** kimi sistemin ilkin quraşdırılmasında yüklənəcək; Baş Mühasib icazəsi ilə (`accounting.posting_rules.manage`) fərdiləşdirilə bilər (məs. bir Company fərqli xərc hesabı istifadə etmək istəyə bilər).

### 2.4. Əl ilə Jurnal Yazısı (Manual Journal Entry)

Baş Mühasib/Mühasib rolu üçün sərbəst jurnal yazısı forması: istənilən sayda sətir (min. 2), hər sətirdə hesab seçimi (axtarışla), Dt/Kt sütunu, departament (opsional). Tipik istifadə: aylıq amortizasiya (əgər avtomatlaşdırılmayıbsa), düzəliş yazıları, açılış qalıqları.

### 2.5. Əks-Yazı (Reversal)

Səhv jurnal yazısı **heç vaxt redaktə/silinmir** — "Əks Yazı Yarat" düyməsi orijinal yazının bütün Dt/Kt-sini tərsinə çevirən yeni sənəd yaradır (`reversalOfEntryId` ilə əlaqələndirilir), bu da audit trail-i bütöv saxlayır.

---

## 3. Baş Kitab (General Ledger) və Yoxlama Balansı

### 3.1. `accountBalances/{companyId}_{accountId}_{periodId}` — Denormallaşdırılmış Qalıq

```
accountBalances/{companyId}_{accountId}_{periodId}
├── companyId, accountId, periodId: string
├── openingBalance: number
├── totalDebit, totalCredit: number
├── closingBalance: number
└── updatedAt: timestamp
```

Hər `journalEntries` yazısından sonra Cloud Function trigger toxunan bütün hesabların bu dövrə aid balansını yeniləyir (Fayl 3-ün KPI strategiyasına bənzər — real-time SUM sorğusu əvəzinə, hadisə-əsaslı ön-hesablama).

### 3.2. Yoxlama Balansı (Trial Balance)

Fayl 3-ün Report Builder mexanizmi üzərində qurulan standart hesabat: bütün hesablar, hər birinin dövr üzrə Dt/Kt cəmi və qalığı — **`Σ(bütün Dt qalıqları) = Σ(bütün Kt qalıqları)`** avtomatik yoxlanılır, uyğunsuzluq olarsa (nəzəri cəhətdən mümkün deyil, əgər Bölmə 2.2 düzgün tətbiq olunubsa) sistem kritik xəbərdarlıq göstərir.

---

## 4. Mühasibat Dövrü İdarəetməsi (Period Management)

### 4.1. `accountingPeriods/{periodId}` sənəd sxemi

```
accountingPeriods/{periodId}
├── companyId: string
├── fiscalYear: number, periodNumber: number   // 1-12 (aylıq dövrlər)
├── periodStart, periodEnd: timestamp
├── status: 'open' | 'closed'
├── closedBy: string | null, closedAt: timestamp | null
```

### 4.2. Dövrün Bağlanması (Period Close) — Addım-addım Proses

Baş Mühasib "Dövrü Bağla" düyməsinə basanda sistem ardıcıl yoxlama/əməliyyat aparır (checklist UI ilə):

1. ✅ Bütün `draft` statuslu fakturalar/kreditor fakturalar rəsmiləşdirilib mi? (xəbərdarlıq, məcburi deyil)
2. ✅ Bank uzlaşdırması (Fayl 7) tamamlanıb mı?
3. ⚙️ **Amortizasiya yazıları** avtomatik generasiya edilir (Bölmə 5.3).
4. ⚙️ **Xarici valyuta yenidən qiymətləndirməsi** avtomatik icra edilir (Fayl 7, Bölmə 6.3).
5. 🔒 Dövr `status: 'closed'` olur — bu tarixdən sonra **heç bir yeni jurnal yazısı bu dövrün tarixinə yazıla bilməz** (`postJournalEntry()` funksiyası dövr statusunu yoxlayır, bağlıdırsa rədd edir).
6. Yalnız `accounting.period.reopen` icazəsinə malik istifadəçi (adətən yalnız Baş Mühasib/Company Admin) dövrü yenidən aça bilər — bu əməliyyat mütləq səbəb tələb edir və `auditLogs`-a yüksək prioritetlə yazılır.

---

## 5. Əsas Vəsaitlər (Fixed Assets) Reyestri

### 5.1. `fixedAssets/{assetId}` sənəd sxemi

```
fixedAssets/{assetId}
├── companyId: string
├── assetName: string
├── assetAccountId: string             // 111, 121 s. — Bölmə 1-ə istinad
├── acquisitionDate: timestamp, acquisitionCost: number
├── depreciationMethod: 'straight_line' | 'reducing_balance'
├── usefulLifeMonths: number
├── residualValue: number
├── reducingBalanceRate: number | null // yalnız 'reducing_balance' üçün
├── accumulatedDepreciation: number    // denormallaşdırılmış cari məbləğ
├── netBookValue: number               // acquisitionCost - accumulatedDepreciation
├── departmentId: string | null
├── status: 'active' | 'fully_depreciated' | 'disposed'
├── disposalDate: timestamp | null, disposalProceeds: number | null
└── createdAt, updatedAt: timestamp
```

### 5.2. Amortizasiya Metodları (IAS 16 uyğun)

- **Xətti Metod (Straight-Line):** `Aylıq Amortizasiya = (acquisitionCost − residualValue) / usefulLifeMonths`
- **Azalan Qalıq Metodu (Reducing Balance):** `Aylıq Amortizasiya = netBookValue × (reducingBalanceRate / 12)`

### 5.3. Aylıq Avtomatik Amortizasiya

Cloud Scheduler (hər ayın son günü) → bütün `status: 'active'` aktivlər üzrə amortizasiya hesablanır → hər aktiv üçün ayrı-ayrı deyil, **bir konsolidasiya edilmiş jurnal yazısı** (hesab qrupu üzrə cəmlənmiş) yaradılır → `fixedAssets.accumulatedDepreciation`/`netBookValue` yenilənir. `netBookValue` residual dəyərə çatanda status avtomatik `fully_depreciated` olur.

### 5.4. Aktivin Silinməsi (Disposal)

Aktiv satılanda/silinəndə: Dt Yığılmış Amortizasiya (112) + Dt/Kt Pul vəsaiti (əgər satılıbsa) / Kt Aktivin dəyəri (111), fərq "Sair əməliyyat gəliri/xərci" (611/731) kimi tanınır.

---

## 6. Excel Export Nöqtələri (Fayl 3-ə istinad)

- [ ] Hesablar Planı (tam ağac strukturu ilə)
- [ ] Əməliyyat Jurnalı (tarix, mənbə tipi, hesab filtrləri ilə)
- [ ] Yoxlama Balansı (Trial Balance)
- [ ] Baş Kitab (konkret hesab üzrə bütün hərəkətlər)
- [ ] Əsas Vəsaitlər Reyestri (amortizasiya cədvəli ilə)
- [ ] Debitor/Kreditor Balansları (yaş analizi ilə birlikdə, Fayl 6/7-yə əlavə)

---

## 7. Qəbul Meyarları (Acceptance Criteria) — Modul 8

- [ ] Yeni Company yaradılanda Fayl 2-dəki sektora uyğun tam rəsmi Hesablar Planı avtomatik köçürülür.
- [ ] `journalEntries` yalnız `postJournalEntry()` Cloud Function vasitəsilə yazıla bilir, birbaşa client yazışı bloklanır.
- [ ] Balanslaşdırılmamış (`Σdebit ≠ Σcredit`) heç bir jurnal yazısı sistemə düşmür.
- [ ] Fayl 5/6/7/10-dan gələn hər hadisə `postingRules`-a uyğun düzgün hesablara avtomatik yazılır.
- [ ] Bağlanmış dövrə yeni yazı aparılmağa cəhd edildikdə sistem bloklayır və aydın xəta mesajı göstərir.
- [ ] Dövrün yenidən açılması yalnız müvafiq icazə ilə mümkündür və yüksək prioritetli audit qeydi yaradır.
- [ ] Amortizasiya hər ay avtomatik hesablanır, hər iki metod (xətti/azalan qalıq) düzgün nəticə verir.
- [ ] Aktiv tam amortizasiya olunduqda statusu avtomatik dəyişir.
- [ ] Yoxlama Balansı həmişə balanslaşdırılmış nəticə göstərir (Dt cəmi = Kt cəmi).
- [ ] Bütün cədvəllərdə Excel export mövcuddur.

---

## 8. Digər Modullara İstinadlar

- Fayl 2, Bölmə 4 (`departments`) → jurnal yazısı sətirlərində departamental kəsim üçün istifadə olunur (Otelçilik departamental P&L-i üçün əsasdır).
- Fayl 3 → Trial Balance, Baş Kitab hesabatları Report Builder üzərində qurulur.
- Fayl 5 → `sale_out`/`purchase_in` stok hərəkətləri COGS və mal alışı jurnal yazılarını tetikləyir.
- Fayl 6 → faktura `sent` statusu satış jurnal yazısını tetikləyir.
- Fayl 7 → ödənişlər, kassa əməliyyatları, FX yenidən qiymətləndirməsi bu modula jurnal yazısı göndərir.
- Fayl 9 (IFRS Hesabatlar) → **birbaşa bu modulun `accountBalances` və `chartOfAccounts` strukturundan** Maliyyə Vəziyyəti (Balans) və Mənfəət-Zərər hesabatlarını quracaq — hesab sinifləri (1-9) birbaşa hesabat sətirlərinə map olunacaq.
- Fayl 10 (HR/Əmək Haqqı) → əmək haqqı hesablanması/ödənişi jurnal yazılarını bu modula göndərəcək.

**Növbəti fayl:** Modul 9 — IFRS Maliyyə Hesabatları (Maliyyə Vəziyyəti, Mənfəət-Zərər, Pul Vəsaitlərinin Hərəkəti, Kapitalda Dəyişikliklər).
