# TaxIQ ERP — Modul 6: Satış, Hesab-Faktura və Sənəd (Blank) Dizayneri

> **Sənəd statusu:** 10 fayldan 6-cısı. Bu sənəd müştəri idarəetməsini, Kommersiya Təklifi → Satış Sifarişi → Faktura zəncirini (sadələşdirilmiş "quote-to-cash" modeli), Azərbaycanın **e-qaimə-faktura** sisteminə inteqrasiya nöqtəsini və hər Company üçün fərdiləşdirilə bilən **PDF Sənəd (Blank) Dizaynerini** təsvir edir. Faktura yaradıldıqda Fayl 5-in `stockMovements`-i, Fayl 8-in jurnal yazıları avtomatik tetiklənəcək; ödəniş qeydiyyatı isə Fayl 7-də aparılacaq.

---

## 1. Müştəri (Customer) İdarəetməsi

### 1.1. `customers/{customerId}` sənəd sxemi

```
customers/{customerId}
├── companyId: string
├── type: 'individual' | 'legal_entity'
├── name: string                       // fərdi şəxs adı və ya şirkət adı
├── legalName: string | null
├── taxId: string | null               // VÖEN — hüquqi şəxslər üçün məcburi, fərdi şəxslər üçün opsional
├── customerGroupId: string | null     // Fayl 5, Bölmə 1.4-dəki priceLists-ə istinad
├── contactPersons: [{ name: string, phone: string, email: string, position: string }]
├── billingAddress, shippingAddress: string
├── defaultCurrency: string            // Fayl 1, Bölmə 8-ə istinad
├── paymentTermDays: number            // default ödəniş müddəti (məs. 30 gün) — fakturanın `dueDate`-i bundan hesablanır
├── creditLimit: number | null
├── isActive: boolean
├── customFieldValues: { [key]: any }
└── createdAt, updatedAt, createdBy
```

### 1.2. Müştəri Qrupları

```
customerGroups/{groupId}
├── companyId, name: string, description: string
```

Fayl 5-dəki `priceLists.appliesToCustomerGroupIds` bu qruplara istinad edir — məs. "VIP Topdansatış Müştəriləri" qrupu üçün ayrıca güzəştli qiymət siyahısı.

---

## 2. Satış Prosesi — Sadələşdirilmiş "Quote-to-Cash" Modeli

Sənayedə tanınan tam Quote-to-Cash zənciri (Kommersiya Təklifi → Müqavilə → Sifariş → Çatdırılma → Faktura → Ödəniş → Gəlirin Tanınması) TaxIQ-da **könüllü mərhələli** şəkildə tətbiq olunur — kiçik müştərilər birbaşa Faktura yarada bilər, böyük/mürəkkəb satış prosesi olan müştərilər isə tam zənciri istifadə edə bilər:

```
[Kommersiya Təklifi] --(qəbul edildi)--> [Satış Sifarişi] --(hazırdır)--> [Faktura] --(ödənilib)--> [Bağlanıb]
        (opsional)                           (opsional)                    (məcburi)
```

### 2.1. `salesQuotes/{quoteId}` — Kommersiya Təklifi

```
salesQuotes/{quoteId}
├── companyId, quoteNumber: string     // avtomatik ardıcıl nömrələmə, Company daxilində unikal
├── customerId: string
├── issueDate, validUntil: timestamp
├── lineItems: [{ goodId, description, quantity, unit, unitPrice, discountPercent, vatRate, lineTotal }]
├── subtotal, discountTotal, vatTotal, grandTotal: number
├── currency: string
├── status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted_to_order'
├── notes: string | null
├── documentTemplateId: string | null  // bax Bölmə 6
└── createdAt, updatedAt, createdBy
```

- "Qəbul edildi" statusuna keçəndə bir kliklə **Satış Sifarişinə çevrilir** (bütün sətirlər kopyalanır, `sourceQuoteId` ilə əlaqə saxlanılır).

### 2.2. `salesOrders/{orderId}` — Satış Sifarişi

```
salesOrders/{orderId}
├── companyId, orderNumber: string, customerId: string
├── sourceQuoteId: string | null
├── lineItems: [...]                   // eyni struktur
├── fulfillmentWarehouseId: string | null   // Fayl 5-ə istinad, hansı anbardan çatdırılacaq
├── status: 'draft' | 'confirmed' | 'fulfilled' | 'invoiced' | 'cancelled'
└── createdAt, updatedAt, createdBy
```

- "Yerinə yetirildi" (fulfilled) statusuna keçəndə Fayl 5-in `stockMovements` (`sale_out`) hərəkəti yaradılır.
- Bir kliklə **Fakturaya çevrilir**.

### 2.3. Sadələşdirilmiş axın

Konsaltinq/xidmət sektoru (Fayl 2) kimi sadə satış dövrü olan müştərilər üçün Kommersiya Təklifi/Sifariş addımları **tamamilə keçilə bilər** — "Yeni Faktura" düyməsi birbaşa Faktura yaratma formunu açır, heç bir əvvəlki sənəd tələb olunmur.

---

## 3. Faktura (Invoice) Modulu

### 3.1. `invoices/{invoiceId}` sənəd sxemi

```
invoices/{invoiceId}
├── companyId: string
├── invoiceNumber: string              // avtomatik ardıcıl, Company daxilində unikal, qanuni tələb (boşluqsuz ardıcıllıq)
├── customerId: string
├── sourceOrderId: string | null
├── issueDate: timestamp
├── dueDate: timestamp                 // issueDate + customer.paymentTermDays
├── lineItems: [{
│     goodId: string, description: string, quantity: number, unit: string,
│     unitPrice: number, discountPercent: number, vatRate: number, lineTotal: number
│   }]
├── subtotal, discountTotal, vatTotal, grandTotal: number
├── currency: string, exchangeRateToBaseCurrency: number   // Fayl 1, Bölmə 8
├── amountPaid: number                 // Fayl 7-dəki ödəniş qeydlərindən avtomatik toplanır
├── amountDue: number                  // grandTotal - amountPaid (hesablanan sahə)
├── status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
├── departmentId: string | null        // Fayl 2, Bölmə 4-ə istinad (departament üzrə gəlir hesabatı üçün)
├── warehouseId: string | null         // hansı anbardan mal çıxışı olacaq
├── eInvoice: {                        // bax Bölmə 5
│     submittedToSTS: boolean,
│     stsReferenceNumber: string | null,
│     xmlFileUrl: string | null,
│     submittedAt: timestamp | null
│   }
├── documentTemplateId: string | null  // bax Bölmə 6
├── notes: string | null
└── createdAt, updatedAt, createdBy
```

### 3.2. Status Axını

```
draft → sent → (ödəniş qeydə alındıqca) → partially_paid → paid
                                                ↓ (dueDate keçib, hələ ödənilməyib)
                                             overdue
                    → cancelled (istənilən mərhələdə, icazə ilə)
```

- `overdue` statusu **avtomatik** hesablanır (Cloud Scheduler, hər gün: `dueDate < today AND status IN ['sent','partially_paid']` → `overdue`), əl ilə təyin olunmur.
- `amountPaid`/`amountDue` sahələri Fayl 7-də (Kassa/Bank) bir ödəniş bu fakturaya "tətbiq edildikdə" (`paymentAllocations`) Cloud Function trigger ilə avtomatik yenilənir — Satış modulu özü ödəniş qəbul etmir, yalnız nəticəni əks etdirir.

### 3.3. Faktura yaradılmasının yan-effektləri (avtomatik zəncirvari əməliyyatlar)

Faktura `draft`-dan `sent` statusuna keçəndə (yəni rəsmiləşəndə) aşağıdakılar **avtomatik** baş verir:

1. **Fayl 5-ə:** hər `goodId` üçün (əgər `trackInventory: true`) müvafiq anbardan `sale_out` tipli `stockMovements` yaradılır.
2. **Fayl 8-ə:** standart satış jurnal yazısı avtomatik yaradılır (Debitor Borcları Dt / Satış Gəliri Kt, ƏDV Kt) — konkret hesab kodları Fayl 8-də təyin olunacaq, bu modul yalnız "faktura yaradılanda jurnal yazısı tetiklənir" əlaqəsini müəyyən edir.
3. **Fayl 4-ə (opsional):** əgər Company `grandTotal` üçün təsdiq həddi (approval threshold) quraşdırıbsa, bu addım `sent` statusuna keçmədən əvvəl Approval workflow-unu tələb edə bilər (Fayl 4, Bölmə 7.2-dəki "Faktura Təsdiqi" şablonuna istinad).

### 3.4. Nömrələmə Qaydası

Faktura nömrələri **boşluqsuz ardıcıl** olmalıdır (mühasibat/vergi tələbi — sıçrayış və ya təkrar nömrə audit zamanı problem yaradır). Sistem `companies/{companyId}.invoiceSequence` sayğacını Firestore tranzaksiyası daxilində artıraraq növbəti nömrəni təyin edir; ləğv edilmiş (`cancelled`) fakturalar nömrəni "yandırır" (boşluq yaradır), silinmir — bu, audit trail bütövlüyü üçündür.

---

## 4. Təkrarlanan Fakturalar (Recurring Invoices)

Xidmət/Konsaltinq sektoru (Fayl 2) üçün xüsusilə vacib — aylıq abunə xidmətləri (məs. TaxIQ-ın öz müştərilərinə aylıq mühasibatlıq xidməti fakturası).

```
recurringInvoiceTemplates/{templateId}
├── companyId, customerId: string
├── lineItemsTemplate: [...]           // eyni struktur, miqdar/qiymət sabit qalır
├── frequency: 'monthly' | 'quarterly' | 'annually'
├── dayOfMonth: number                 // hansı gün avtomatik faktura yaradılsın
├── startDate, endDate: timestamp | null
├── isActive: boolean
└── lastGeneratedInvoiceId: string | null
```

Bu, Fayl 4-ün `scheduled` trigger tipini istifadə edən **daxili sistem workflow-udur** — hər Company öz `recurringInvoiceTemplates`-i üçün ayrıca Fayl 4 workflow-u qurmasına ehtiyac qalmadan, bu funksionallıq Satış modulunun özündə hazır təqdim olunur (sadəlik üçün).

---

## 5. Elektron Qaimə-Faktura (e-qaimə) İnteqrasiya Nöqtəsi

### 5.1. Kontekst

Azərbaycanda ƏDV üzrə qeydiyyatdan keçmiş bütün müəssisələr (və Vergi Məcəlləsinin 218.1.2-ci maddəsində göstərilən digər şəxslər) mal təhvili, iş və xidmətlərə görə **elektron qaimə-faktura (e-qaimə)** təqdim etməyə məcburdur — bu, Dövlət Vergi Xidmətinin (STS) mərkəzləşdirilmiş portalı (e-taxes.gov.az) vasitəsilə, **strukturlaşdırılmış XML formatında**, **gücləndirilmiş elektron imza (ASAN İmza və ya e-İmza)** ilə həyata keçirilir.

### 5.2. MVP Yanaşması (Şəffaf Qeyd)

Tam avtomatik API inteqrasiyası (imza, göndərmə, status sorğusu daxil) STS ilə rəsmi sertifikatlaşdırma və ASAN İmza SDK inteqrasiyası tələb edir — bu, **bu 10 faylın ilkin əhatəsindən kənardadır** və gələcək faza kimi qeyd olunur. İlkin versiyada sistem aşağıdakı **yarı-avtomatlaşdırılmış** axını təmin edir:

1. Faktura `sent` statusuna keçəndə sistem STS-in rəsmi XML sxeminə (`e-qaimə-faktura fayl formatı`) uyğun **XML faylını avtomatik generasiya edir** (Cloud Function, bütün məcburi sahələr: hər iki tərəfin VÖEN-i, mal/xidmət kodları, məbləğlər).
2. Bu XML fayl Cloud Storage-a saxlanılır, mühasib "e-qaimə XML-i endir" düyməsi ilə əldə edir.
3. Mühasib bu faylı **əl ilə** "Elektron Faktura Tərtibatı Proqramı (eFP)" və ya birbaşa e-taxes.gov.az portalı vasitəsilə ASAN İmza ilə imzalayıb göndərir (sistemdən kənar addım).
4. Mühasib STS-dən aldığı təsdiq nömrəsini sistemə əl ilə daxil edir (`invoices.eInvoice.stsReferenceNumber`), sistem statusu "STS-ə təqdim edilib" kimi işarələyir.

### 5.3. Gələcək Faza (Yol Xəritəsi)

STS-in rəsmi API-si və ASAN İmza inteqrasiyası əlçatan olduqda, addım 3-4 avtomatlaşdırıla bilər — `eInvoice` sahə strukturu artıq bu genişlənməyə hazır formada dizayn edilib (kod dəyişikliyi minimal olacaq).

---

## 6. Sənəd (Blank) Dizayneri — PDF Şablon Mühərriki

### 6.1. Tələb

Faktura, Kommersiya Təklifi, Müqavilə kimi rəsmi sənədlərin **hər Company üçün fərdi dizaynla** (loqo, rənglər, sahə düzülüşü) çap edilə bilməsi.

### 6.2. Texnoloji seçim

| Komponent | Texnologiya | Səbəb |
|---|---|---|
| Vizual dizayn redaktoru | **GrapesJS** | Yetkin, açıq-mənbə HTML/CSS drag-and-drop builder (e-poçt/sənəd şablonları üçün sənayedə geniş istifadə olunur), təmiz HTML+CSS çıxışı verir — proprietary format yaratmır |
| PDF render | **Puppeteer (Cloud Function)** | Fayl 1-də seçilmiş — GrapesJS-in çıxardığı HTML-i headless Chrome ilə dəqiq (WYSIWYG-ə tam uyğun) PDF-ə çevirir |

### 6.3. `documentTemplates/{templateId}` sənəd sxemi

```
documentTemplates/{templateId}
├── companyId: string
├── type: 'invoice' | 'quote' | 'order' | 'contract' | 'payslip' | 'employment_contract'
├── name: string
├── htmlContent: string                // GrapesJS-dən export olunan HTML+CSS (merge-tag-larla birlikdə)
├── pageSize: 'A4' | 'Letter'
├── isDefault: boolean                 // hər `type` üçün yalnız 1 defolt
├── createdAt, updatedAt, createdBy
```

### 6.4. Merge-Tag Sistemi

Şablon daxilində aşağıdakı sintaksislə dinamik dəyərlər yerləşdirilir (Handlebars-a bənzər sadə template mühərriki, Cloud Function-da server-side render olunur):

```html
<h1>{{company.name}}</h1>
<img src="{{company.logoUrl}}" />
<p>Faktura №: {{invoice.invoiceNumber}} | Tarix: {{invoice.issueDate}}</p>
<p>Müştəri: {{customer.name}} | VÖEN: {{customer.taxId}}</p>
<table>
  {{#each lineItems}}
  <tr>
    <td>{{this.description}}</td>
    <td>{{this.quantity}}</td>
    <td>{{this.unitPrice}}</td>
    <td>{{this.lineTotal}}</td>
  </tr>
  {{/each}}
</table>
<p>Ümumi: {{invoice.grandTotal}} {{invoice.currency}}</p>
```

Hər sənəd tipi (`type`) üçün mövcud merge-tag-ların siyahısı GrapesJS redaktorunun sağ panelində "Sahələr" bölməsində göstərilir — istifadəçi kod yazmadan, sürükləyərək əlavə edir.

### 6.5. Dizayner Ekranı — Funksional Tələblər

- Şablon siyahısı (tip üzrə filtrlənə bilən).
- "Yeni Şablon" → boş A4 kətan və ya hazır başlanğıc şablonlarından biri (TaxIQ tərəfindən hazırlanmış 2-3 nümunə dizayn hər tip üçün).
- Canvas üzərində: loqo yükləmə (drag-drop), mətn blokları, cədvəl komponenti (line items üçün xüsusi "Təkrarlanan Cədvəl" bloku), rəng/şrift seçimi (**Montserrat şrifti defolt təklif olunur, lakin sənəd tipi üçün istisnaən başqa şrift seçilə bilər** — çünki rəsmi sənədlər bəzən korporativ brend şriftini tələb edə bilər).
- Canlı önbaxış: nümunə data ilə (fake müştəri, 3 sətir) PDF önbaxışı.
- "Defolt et" düyməsi.
- Versiya tarixçəsi (əvvəlki dizaynlara qayıtmaq mümkündür).

### 6.6. Çap/Göndərmə axını

Faktura ekranında "PDF Yüklə" düyməsi → `generateDocumentPdf(invoiceId, templateId)` Cloud Function çağırılır → nəticə Cloud Storage-a yazılır, imzalanmış link qaytarılır → brauzerdə yüklənir və ya birbaşa "E-poçtla Göndər" (Fayl 1-in e-poçt inteqrasiyasından istifadə edərək müştəriyə PDF əlavəli məktub).

---

## 7. Endirimlər (Discounts)

- Sətir səviyyəsində faiz endirimi (`discountPercent`) — Bölmə 3.1-də artıq mövcuddur.
- Faktura səviyyəsində ümumi endirim (opsional əlavə sahə, `overallDiscountPercent`) — böyük sifarişlərdə tək-tək sətir dəyişmək əvəzinə.
- Promosion kodları/kampaniyalar — **bu 10 faylın əhatəsindən kənarda saxlanılır** (B2B mühasibat/HR konsaltinq platforması üçün prioritet deyil, e-commerce xüsusiyyətidir).

---

## 8. Debitor Borcları İzləmə (AR Aging)

Fayl 3-ün DSO/Cari Debitor Borcu KPI-larının mənbəyi məhz bu modulun `invoices` kolleksiyasıdır. Əlavə olaraq bu modul özündə **"Yaş Analizi" (Aging Report)** cədvəli təqdim edir:

| Müştəri | 0-30 gün | 31-60 gün | 61-90 gün | 90+ gün | Ümumi |
|---|---|---|---|---|---|
| (hər müştəri sətir) | ... | ... | ... | ... | ... |

Bu cədvəl Fayl 3-ün Report Builder mexanizmi ilə (qruplaşdırma: müştəri, şərti sütunlar: `dueDate`-ə əsasən gün fərqi) qurulur, əlavə xüsusi kod tələb etmir.

---

## 9. Excel Export Nöqtələri (Fayl 3-ə istinad)

- [ ] Fakturalar Siyahısı (status, tarix, məbləğ filtrləri ilə)
- [ ] Müştərilər Siyahısı
- [ ] Kommersiya Təklifləri və Satış Sifarişləri Siyahısı
- [ ] Debitor Borcları Yaş Analizi (Aging Report)
- [ ] Təkrarlanan Faktura Şablonları

---

## 10. Qəbul Meyarları (Acceptance Criteria) — Modul 6

- [ ] Kommersiya Təklifi → Satış Sifarişi → Faktura zəncirində hər addım bir kliklə növbəti sənədə çevrilir, sətirlər düzgün kopyalanır.
- [ ] Kiçik müştərilər üçün birbaşa Faktura yaratma (aralıq addımlarsız) mümkündür.
- [ ] Faktura `sent` statusuna keçəndə anbar hərəkəti (Fayl 5) və jurnal yazısı (Fayl 8) avtomatik yaradılır.
- [ ] Faktura nömrələri boşluqsuz ardıcıllıqla artır, ləğv edilmiş fakturalar nömrəni "yandırır", silinmir.
- [ ] `overdue` statusu gündəlik avtomatik yenilənir.
- [ ] Təkrarlanan faktura şablonu təyin olunmuş gündə avtomatik yeni faktura yaradır.
- [ ] e-qaimə XML faylı STS sxeminə uyğun düzgün generasiya olunur (VÖEN, mal kodları, məbləğlər daxil).
- [ ] Sənəd Dizayneri ilə yaradılmış fərdi şablon PDF-də dəqiq WYSIWYG nəticə verir, merge-tag-lar düzgün doldurulur.
- [ ] Hər Company öz loqo/rəng sxemi ilə fərqli görünüşdə faktura çap edə bilir.
- [ ] AR Aging hesabatı düzgün gün aralıqlarına görə borcları qruplaşdırır.
- [ ] Bütün siyahı ekranlarında Excel export mövcuddur.

---

## 11. Digər Modullara İstinadlar

- Fayl 4 (Workflow) → "Faktura Təsdiqi (Məbləğ Həddi ilə)" şablonu bu modulun `invoices.status` keçidini idarə edir; təkrarlanan faktura generasiyası Fayl 4-ün `scheduled` trigger konsepsiyasından ilhamlanır (daxili sadələşdirilmiş versiya).
- Fayl 5 (Anbar) → hər faktura sətri `goodId`-ə istinad edir, `stockMovements`/`priceLists` bu modul tərəfindən oxunur/yazılır.
- Fayl 7 (Kassa/Bank) → ödəniş qeydiyyatı və `invoices.amountPaid` yenilənməsi orada baş verəcək, bu fayl yalnız nəticəni göstərir.
- Fayl 8 (Mühasibat) → hər faktura üçün standart satış jurnal yazısının konkret hesab kodları orada təyin olunacaq.
- Fayl 3 (Dashboard/Export) → DSO, Debitor Borcu, Satış KPI-ları bu modulun `invoices` kolleksiyasından qidalanır.

**Növbəti fayl:** Modul 7 — Kassa, Bank, Xəzinədarlıq və Valyuta Əməliyyatları.
