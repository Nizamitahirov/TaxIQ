# TaxIQ ERP — Modul 7: Kassa, Bank, Xəzinədarlıq və Valyuta Əməliyyatları

> **Sənəd statusu:** 10 fayldan 7-cisi. Bu sənəd pul vəsaitlərinin (nağd və bank) hərəkətini, Fayl 6-dakı fakturalara ödəniş tətbiqini, kreditor (vendor) ödənişlərini, Azərbaycan banklarının **internet-banking bulk/əmək haqqı fayl formatlarını** və çoxvalyuta əməliyyatlarının **IAS 21** uyğun mühasibatlaşdırılmasını təsvir edir. Fayl 10 (HR/Əmək Haqqı) əmək haqqı ödənişlərini bu modulun bank fayl generasiya mexanizmi vasitəsilə həyata keçirəcək.

---

## 1. Bank Hesabları İdarəetməsi

### 1.1. `bankAccounts/{accountId}` sənəd sxemi

```
bankAccounts/{accountId}
├── companyId: string
├── bankName: string                   // "Kapital Bank", "PASHA Bank", "ABB" s.
├── accountName: string                // daxili adlandırma, məs. "Əsas AZN Hesabı"
├── iban: string
├── swiftCode: string | null
├── currency: string                   // Fayl 1, Bölmə 8
├── bankFormatProfileId: string | null // bax Bölmə 1.2
├── currentBalance: number             // denormallaşdırılmış, hər əməliyyatdan sonra yenilənir
├── isActive: boolean
└── createdAt, updatedAt: timestamp
```

### 1.2. Bank Fayl Format Profilləri — Azərbaycan Bankları üçün Fərdiləşdirmə

Hər Azərbaycan bankının korporativ internet-banking sistemi (məs. PASHA Bank Corporate IB, Kapital Bank, ABB) **fərqli fayl formatında** toplu ödəniş/əmək haqqı faylı tələb edir (adətən `.txt` və ya `.csv`, spesifik sütun ardıcıllığı, bəzən Latın əlifbasının Azərbaycan hərfləri — ə, ö, ü, ş, ç, ğ, ı — üçün xüsusi kodlaşdırma tələbi ilə). Bunu sərt kodlaşdırmaq əvəzinə **konfiqurasiya edilə bilən profil** kimi modelləşdiririk:

```
bankFileFormats/{formatId}
├── bankName: string
├── fileType: 'salary_bulk' | 'payment_bulk'
├── fileExtension: 'txt' | 'csv'
├── delimiter: ',' | ';' | '\t'
├── encoding: 'UTF-8' | 'Windows-1254' | 'CP1251'   // bəzi köhnə bank sistemləri fərqli kodlaşdırma tələb edə bilər
├── columns: [{
│     fieldKey: string,        // "beneficiaryIban" | "beneficiaryName" | "amount" | "purposeText" s.
│     order: number,
│     staticValue: string | null,   // bəzi banklar sabit dəyər tələb edir (məs. əməliyyat kodu)
│     dateFormat: string | null
│   }]
└── notes: string              // implementasiya zamanı bankın rəsmi sənədləşməsinə istinad üçün sərbəst mətn
```

**Vacib qeyd (implementasiya üçün):** Hər bankın dəqiq sütun sırası/tələbləri **inteqrasiya zamanı** həmin bankın rəsmi Korporativ İnternet Banking istifadəçi təlimatından təsdiqlənməlidir (banklar bu formatları vaxtaşırı yeniləyir). Bu sənəd strukturu istənilən yeni bank üçün **kod dəyişikliyi olmadan**, yalnız yeni `bankFileFormats` sənədi əlavə etməklə dəstək verilməsini təmin edir.

---

## 2. Kassa (Cash Register / Petty Cash) İdarəetməsi

### 2.1. `cashRegisters/{registerId}` sənəd sxemi

```
cashRegisters/{registerId}
├── companyId: string
├── name: string                       // "Baş Kassa", "Mağaza 1 Kassası" s.
├── departmentId: string | null        // Fayl 2, Bölmə 4-ə istinad
├── currency: string
├── currentBalance: number
├── isActive: boolean
```

### 2.2. `cashTransactions/{transactionId}` sənəd sxemi

```
cashTransactions/{transactionId}
├── companyId, cashRegisterId: string
├── type: 'cash_in' | 'cash_out'
├── amount: number, currency: string
├── category: 'sales_receipt' | 'expense' | 'owner_contribution' | 'bank_deposit' | 'bank_withdrawal' | 'other'
├── relatedDocumentType, relatedDocumentId: string | null   // məs. "invoice", "purchaseBill"
├── transactionDate: timestamp
├── note: string | null
├── performedBy: string
└── createdAt: timestamp
```

- Bank hesabları kimi, `cashTransactions` da **dəyişməz jurnal** prinsipi ilə işləyir — səhv qeyd əks-yazı ilə düzəldilir.
- Hər əməliyyatdan sonra `cashRegisters.currentBalance` Firestore tranzaksiyası daxilində yenilənir.

### 2.3. Gündəlik Kassa Bağlanışı (Daily Cash Closing)

Retail sektoru (Fayl 2) üçün xüsusilə vacib — gün sonunda kassanın fiziki sayımı sistemdəki qalıqla tutuşdurulur:

```
cashRegisterDailyClosings/{closingId}
├── cashRegisterId, date: timestamp
├── openingBalance, totalCashIn, totalCashOut, systemClosingBalance: number
├── physicallyCountedBalance: number | null
├── variance: number                   // physicallyCountedBalance - systemClosingBalance
├── closedBy: string
└── createdAt: timestamp
```

Fərq həddi aşarsa (Company tənzimləməsində təyin olunan limit) Fayl 4-ün Approval workflow-u tetiklənə bilər (məs. Baş Mühasibin araşdırıb təsdiqləməsi).

---

## 3. Ödəniş Qeydiyyatı (Payments) — Debitor Ödənişləri

### 3.1. `payments/{paymentId}` sənəd sxemi

```
payments/{paymentId}
├── companyId: string
├── direction: 'incoming' | 'outgoing'
├── method: 'cash' | 'bank_transfer' | 'card'
├── sourceAccountRef: { type: 'bank' | 'cash', id: string }   // hansı bank hesabı/kassa
├── counterpartyRef: { type: 'customer' | 'vendor', id: string }
├── amount: number, currency: string, exchangeRateToBaseCurrency: number
├── paymentDate: timestamp
├── allocations: [{ invoiceType: 'salesInvoice' | 'purchaseBill', invoiceId: string, allocatedAmount: number }]
├── unallocatedAmount: number           // amount - allocations cəmi (avans ödəniş halında)
├── status: 'completed' | 'pending' | 'failed' | 'cancelled'
├── note: string | null
└── createdAt, createdBy: timestamp/string
```

### 3.2. Ödəniş Tətbiqi Axını (Payment Allocation)

1. Mühasib "Ödəniş Qeydə Al" düyməsinə basır, müştərini/kreditoru seçir.
2. Sistem həmin tərəfin **açıq (ödənilməmiş) fakturalarının/hesab-fakturalarının** siyahısını göstərir (ən köhnə tarixli əvvəldə).
3. Mühasib ödənişi bir və ya bir neçə faktura üzərinə bölüşdürür (`allocations`) — qalan məbləğ avtomatik "növbəti fakturaya" təklif olunur.
4. Yadda saxlanılanda Cloud Function trigger:
   - Hər `allocations` elementinə uyğun Fayl 6-dakı `invoices.amountPaid`-i artırır və statusu yeniləyir (`partially_paid`/`paid`).
   - Kreditor tərəf üçün eyni məntiq `purchaseBills`-ə tətbiq olunur (bax Bölmə 4).
   - Bank/kassa qalığını müvafiq istiqamətdə yeniləyir.
   - Fayl 8-ə uyğun jurnal yazısı tetiklənməsi üçün əlaqə yaradır.

---

## 4. Satınalma və Kreditor Faktura (Vendor Bills) — Ödəniş üçün zəruri əks tərəf

Satış modulunun (Fayl 6) güzgü tərəfi kimi, kreditor öhdəliklərinin idarə olunması üçün minimal "Satınalma" konsepsiyası bu modulda təqdim olunur (ayrıca fayl kimi deyil, çünki əsas funksionallığı ödəniş axınına xidmətdir):

### 4.1. `vendors/{vendorId}` sənəd sxemi

```
vendors/{vendorId}
├── companyId: string
├── name: string, taxId: string | null   // VÖEN
├── contactInfo: { phone, email, address }
├── bankDetails: { iban: string, bankName: string }   // ödəniş faylı generasiyası üçün
├── defaultCurrency: string
├── paymentTermDays: number
└── isActive: boolean
```

### 4.2. `purchaseBills/{billId}` sənəd sxemi (Kreditor Faktura)

```
purchaseBills/{billId}
├── companyId, billNumber, vendorId: string
├── vendorInvoiceReference: string      // təchizatçının öz faktura nömrəsi
├── issueDate, dueDate: timestamp
├── lineItems: [{ goodId, quantity, unitCost, vatRate, lineTotal }]   // Fayl 5-ə istinad
├── subtotal, vatTotal, grandTotal: number, currency: string
├── amountPaid, amountDue: number
├── status: 'draft' | 'approved' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
├── warehouseId: string | null          // mal qəbulu hansı anbara
└── createdAt, updatedAt, createdBy
```

- `approved` statusuna keçəndə Fayl 5-in `purchase_in` tipli `stockMovements`-i avtomatik yaradılır (`unitCost` dəyərləndirmə üçün istifadə olunur).
- Böyük məbləğli kreditor fakturalar üçün Fayl 4-ün "Satınalma Sorğusu Təsdiqi" şablonu tətbiq oluna bilər.

### 4.3. Toplu Ödəniş Faylı Generasiyası (Bulk Payment / Salary File Export)

```
paymentOrderBatches/{batchId}
├── companyId, bankAccountId: string
├── batchType: 'vendor_bulk' | 'salary_bulk'    // 'salary_bulk' Fayl 10-dan çağırılacaq
├── items: [{ beneficiaryIban, beneficiaryName, amount, purposeText, sourceRef: { type, id } }]
├── status: 'draft' | 'exported' | 'confirmed'
├── exportedFileUrl: string | null
├── exportedAt: timestamp | null
└── createdBy: string
```

Axın: mühasib ödəniləcək kreditor fakturalarını (və ya Fayl 10-dan gələn əmək haqqı siyahısını) seçir → "Toplu Fayl Yarat" → sistem seçilmiş `bankAccounts.bankFormatProfileId`-ə uyğun faylı (Bölmə 1.2-dəki `bankFileFormats` konfiqurasiyasına əsasən) generasiya edir → mühasib faylı endirib bankın öz internet-banking portalına (məs. PASHA Bank-ın "Əmək Haqqı" bölməsinə) yükləyir (bu, bankdan kənar addımdır — birbaşa API inteqrasiyası hər bank üçün ayrıca müqavilə/sertifikatlaşdırma tələb etdiyi üçün ilkin versiyada fayl-əsaslı yanaşma seçilib, Fayl 6-dakı e-qaimə MVP yanaşması ilə eyni prinsip). Fayl uğurla bankda icra ediləndən sonra mühasib "Təsdiqlə" düyməsi ilə statusu `confirmed` edir, bu da müvafiq `payments` yazılarını avtomatik yaradır.

---

## 5. Bank Çıxarışı İdxalı və Uzlaşdırma (Bank Reconciliation)

### 5.1. Konsepsiya

Sistemdəki qeydlərin (daxili "kitab" — `payments`, `cashTransactions`) bankın özünün göndərdiyi rəsmi çıxarışla **uyğunlaşdırılması** — fərqlərin (bank haqqı, gözlənilməyən əməliyyat) erkən aşkarlanması üçün.

### 5.2. `bankStatementImports/{importId}` və uzlaşdırma

```
bankStatementImports/{importId}
├── companyId, bankAccountId: string
├── fileName: string, importedAt: timestamp
├── statementLines: [{
│     id: string, date: timestamp, description: string, amount: number,
│     matchStatus: 'unmatched' | 'matched' | 'ignored',
│     matchedPaymentId: string | null
│   }]
└── importedBy: string
```

- Mühasib bankın Excel/CSV formatındakı çıxarışını yükləyir (SheetJS ilə oxunur, Fayl 3-ün eyni kitabxanası).
- Sistem **qayda-əsaslı avtomatik uyğunlaşdırma** aparır: məbləğ + tarix (±3 gün tolerantlıq) + (mümkünsə) referens nömrəsi üzrə `payments` kolleksiyasında uyğun yazı axtarır.
- Avtomatik uyğunlaşmayan sətirlər "unmatched" kimi qalır, mühasib əl ilə uyğunlaşdıra (mövcud `payments` yazısı ilə bağlaya) və ya "bu, sistemdə olmayan yeni əməliyyatdır" deyərək yeni `payments`/`cashTransactions` yazısı yarada bilər.
- Uzlaşdırma tamamlandıqda hesabat: neçə sətir avtomatik, neçəsi əl ilə uyğunlaşdırıldı, neçəsi hələ açıqdır.

---

## 6. Çoxvalyuta Əməliyyatları — IAS 21 Uyğunluğu

### 6.1. İlkin Tanınma

Xarici valyutada olan hər əməliyyat (faktura, ödəniş) **əməliyyat tarixindəki məzənnə** ilə əsas valyutaya (`baseCurrency`, Fayl 1) çevrilərək jurnal yazısında qeydə alınır (`exchangeRateToBaseCurrency` sahəsi bu tarixdəki kursu saxlayır — Fayl 1, Bölmə 8-dəki `exchangeRates` kolleksiyasından oxunur).

### 6.2. Realized (Reallaşmış) Məzənnə Fərqi

Faktura bir kursla yaradılıb, ödəniş fərqli kursla aparılırsa, aradakı fərq **realized FX gain/loss** kimi tanınır:

```
Realized FX Fərqi = (Ödəniş tarixindəki kurs − Faktura tarixindəki kurs) × Faktura Məbləği (xarici valyutada)
```

Bu fərq avtomatik Fayl 8-ə uyğun jurnal yazısı (Məzənnə Fərqindən Gəlir/Zərər hesabı) kimi ötürülür.

### 6.3. Unrealized (Reallaşmamış) Məzənnə Fərqi — Dövr Sonu Yenidən Qiymətləndirmə

Mühasibat dövrü bağlanarkən (Fayl 8-dəki period-close prosesi) **hələ ödənilməmiş** xarici valyuta ilə ifadə olunan bütün monetar qələmlər (açıq fakturalar, açıq kreditor borcları, xarici valyuta bank hesabı qalıqları) **dövr sonu (closing) kursu** ilə yenidən qiymətləndirilir:

```
dailyRateSnapshot / periodEndRevaluations/{companyId}_{periodEndDate}
├── companyId, periodEndDate: timestamp
├── revaluedItems: [{
│     itemType: 'invoice' | 'purchaseBill' | 'bankAccount',
│     itemId: string,
│     originalBaseCurrencyValue: number,
│     revaluedBaseCurrencyValue: number,
│     unrealizedGainLoss: number
│   }]
├── totalUnrealizedGainLoss: number
└── generatedAt: timestamp
```

Bu proses **Cloud Function** vasitəsilə avtomatik icra olunur (Fayl 8-in dövr bağlama funksiyasından çağırılır) və müvafiq düzəliş jurnal yazısını yaradır — sonrakı dövrdə bu düzəliş **geri qaytarılır (reversed)** ki, faktiki ödəniş baş verəndə yalnız real fərq final olaraq qalsın (standart mühasibat praktikası).

### 6.4. Company Tənzimləməsi

`companies/{companyId}.settings.fxRateSource`: `'manual'` və ya `'cbar_api'` (Azərbaycan Mərkəzi Bankının rəsmi API-si, Fayl 1, Bölmə 8.2-də təsvir olunub).

---

## 7. Xəzinədarlıq Xülasəsi (Treasury Overview)

Bu modulun məlumatları Fayl 3-ün Dashboard-unda aşağıdakı widget-lərə mənbə olur:
- Bütün bank hesabları + kassaların ümumi qalığı (valyuta üzrə qruplaşdırılmış).
- Növbəti 30 gündə ödənilməli kreditor öhdəlikləri (`purchaseBills.dueDate`-ə əsasən) — sadə Cash Flow Forecast.
- Uzlaşdırılmamış bank çıxarışı sətirlərinin sayı (diqqət tələb edən element kimi `alert_list`-də).

---

## 8. Excel Export Nöqtələri (Fayl 3-ə istinad)

- [ ] Bank Hesabları və Qalıqları
- [ ] Kassa Əməliyyatları (tarix/kateqoriya filtri ilə)
- [ ] Gündəlik Kassa Bağlanışları
- [ ] Ödənişlər Siyahısı (daxil olan/çıxan, tətbiq olunma detalları ilə)
- [ ] Kreditor Fakturaları (Vendor Bills) Siyahısı
- [ ] Bank Uzlaşdırma Hesabatı
- [ ] Məzənnə Fərqi Hesabatı (realized/unrealized)

---

## 9. Qəbul Meyarları (Acceptance Criteria) — Modul 7

- [ ] Bank hesabı və kassa qalıqları hər əməliyyatdan sonra tranzaksiya-təhlükəsiz yenilənir.
- [ ] Ödəniş bir və ya bir neçə fakturaya bölüşdürülə bilir, `amountPaid`/`amountDue` Fayl 6/Bölmə 4-də düzgün əks olunur.
- [ ] Toplu ödəniş/əmək haqqı faylı seçilmiş bankın formatına dəqiq uyğun generasiya olunur (sütun sırası, kodlaşdırma, fayl uzantısı).
- [ ] Yeni bank formatı kod dəyişikliyi olmadan, yalnız yeni `bankFileFormats` konfiqurasiyası ilə əlavə oluna bilir.
- [ ] Bank çıxarışı idxal edildikdə avtomatik uyğunlaşdırma alqoritmi düzgün işləyir, uyğunsuz sətirlər aydın işarələnir.
- [ ] Xarici valyuta fakturasının ödənişi zamanı realized FX gain/loss düzgün hesablanır və jurnala ötürülür.
- [ ] Dövr sonu yenidən qiymətləndirmə (unrealized FX) düzgün icra olunur və növbəti dövrdə geri qaytarılır.
- [ ] Gündəlik kassa bağlanışında fərq həddi aşdıqda müvafiq xəbərdarlıq/workflow tetiklənir.
- [ ] Bütün siyahı ekranlarında Excel export mövcuddur.

---

## 10. Digər Modullara İstinadlar

- Fayl 1, Bölmə 8 (`exchangeRates`, `fxRateSource`) → bu modulun bütün çoxvalyuta hesablamalarının mənbəyidir.
- Fayl 4 (Workflow) → böyük kassa fərqi, böyük kreditor ödənişi təsdiqi bu modulun trigger nöqtələrindən istifadə edəcək.
- Fayl 5 (Anbar) → `purchaseBills.approved` statusu `purchase_in` stok hərəkətini tetikləyir.
- Fayl 6 (Satış) → `payments.allocations` Fayl 6-dakı `invoices.amountPaid/status` sahələrini yeniləyir.
- Fayl 8 (Mühasibat) → bütün `payments`, `cashTransactions`, `purchaseBills` avtomatik jurnal yazıları yaradacaq; realized/unrealized FX fərqləri Fayl 8-in "Məzənnə Fərqindən Gəlir/Zərər" hesabına yönləndiriləcək.
- Fayl 10 (HR/Əmək Haqqı) → əmək haqqı ödənişləri bu modulun `paymentOrderBatches` (`batchType: 'salary_bulk'`) mexanizmini birbaşa çağıracaq.

**Növbəti fayl:** Modul 8 — Mühasibat Uçotu Nüvəsi və Əməliyyat Jurnalları (Hesablar Planı, İkili Yazılış Mühərriki).
