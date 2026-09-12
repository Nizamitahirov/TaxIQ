# TaxIQ ERP — Modul 5: Anbar İdarəetməsi və Mal/Xidmət Kataloqu

> **Sənəd statusu:** 10 fayldan 5-cisi. Bu sənəd Fayl 2-də sektor üzrə fərqləndirilmiş anbar tələblərinin (istehsalat, retail, otelçilik, topdansatış) **konkret data modelini və əməliyyat məntiqini** təsvir edir. Fayl 6 (Satış) fakturalaşdıqda, Fayl 7 (Kassa/Bank) alış ödənişi apardıqda bu modulun `stockMovements` mexanizmini çağıracaq; Fayl 8 (Mühasibat) isə anbar dəyərini balans hesabatında istifadə edəcək.

---

## 0. Mal (Good) və Xidmət (Service) fərqi

Bir kataloq, iki tip:

| | Mal (Good) | Xidmət (Service) |
|---|---|---|
| Fiziki ehtiyat izlənilirmi? | Bəli (`trackInventory: true`) | Xeyr (`trackInventory: false`) |
| Anbar/Warehouse-a bağlıdır? | Bəli | Xeyr |
| Nümunə | Xammal, hazır məhsul, mağaza malı | Konsaltinq saatı, təmir xidməti, aylıq abunə |

Hər ikisi **eyni `goods` kolleksiyasında** saxlanılır (`type` sahəsi ilə fərqləndirilir) ki, Satış modulu (Fayl 6) fakturaya sətir əlavə edərkən vahid axtarış interfeysindən istifadə etsin.

---

## 1. Mal/Xidmət Kataloqu — Data Modeli

### 1.1. `goods/{goodId}` sənəd sxemi

```
goods/{goodId}
├── companyId: string
├── type: 'good' | 'service'
├── sku: string                       // Company daxilində unikal
├── barcode: string | null            // EAN-13/UPC/Code128, boş ola bilər (xüsusən xidmətlərdə)
├── name: { az: string, en: string }
├── description: { az: string, en: string }
├── categoryId: string | null
├── baseUnit: string                  // "ədəd" | "kg" | "litr" | "m" | "saat" | "gün" s.
├── alternateUnits: [{ unit: string, conversionFactor: number }]   // bax 1.3
├── trackInventory: boolean
├── valuationMethodOverride: 'fifo' | 'weighted_average' | null    // null = Company defoltunu izlə (bax Bölmə 4.3)
├── defaultPurchasePrice: number | null
├── defaultSalePrice: number | null
├── vatRate: number                   // ƏDV faizi, default Azərbaycan standart dərəcəsinə uyğun Company tənzimləməsindən
├── reorderPoint: number | null       // bax Bölmə 5
├── reorderQuantity: number | null
├── imageUrl: string | null
├── isActive: boolean
├── customFieldValues: { [key]: any } // Fayl 2-dəki sektor-spesifik sahələr (məs. İstehsalat üçün "sex kodu")
├── createdAt, updatedAt: timestamp
└── createdBy: string
```

### 1.2. Kateqoriyalar

```
goodCategories/{categoryId}
├── companyId, name: { az, en }, code: string
├── parentCategoryId: string | null   // ierarxiya (məs. "İçkilər" → "Alkoqolsuz İçkilər")
└── isActive: boolean
```

### 1.3. Vahid Ölçü Çevrilməsi (Unit of Measure Conversion)

Bir mal fərqli vahidlərlə alına/satıla bilər (məs. topdan "quti" ilə alınır, pərakəndə "ədəd" ilə satılır). Sistem **bir baza vahidi** (`baseUnit`) saxlayır, bütün ehtiyat hərəkətləri (`stockMovements`) daxili olaraq bu vahidə çevrilərək qeydə alınır:

```
alternateUnits: [
  { unit: "quti", conversionFactor: 12 }   // 1 quti = 12 ədəd (baseUnit)
]
```

UI-da istifadəçi istənilən vahidlə miqdar daxil edə bilər (dropdown ilə vahid seçimi), sistem arxa planda `conversionFactor` ilə `baseUnit`-ə çevirib saxlayır — beləliklə bütün hesablamalar (dəyərləndirmə, qalıq) vahid əsasda aparılır.

### 1.4. Qiymət Siyahıları (Price Lists) — Fayl 2-dəki Retail/Topdansatış tələbi

```
priceLists/{priceListId}
├── companyId: string
├── name: string
├── currency: string                  // Fayl 1, Bölmə 8-ə istinad
├── appliesToCustomerGroupIds: string[] | 'all'   // Fayl 6-dakı müştəri qruplarına istinad
├── validFrom, validTo: timestamp | null
├── items: [{ goodId: string, price: number, minQuantity: number | null }]  // minQuantity = topdansatış həcm endirimi üçün
├── isActive: boolean
└── priority: number                  // eyni müştəriyə bir neçə siyahı uyğun gələrsə, ən yüksək prioritetli qazanır
```

Satış zamanı (Fayl 6) sistem müştərinin qrupuna və sifariş miqdarına uyğun ən münasib qiymət siyahısını avtomatik tətbiq edir; heç biri uyğun gəlmirsə `defaultSalePrice` istifadə olunur.

### 1.5. Barkod Skan Funksionallığı

- **Kitabxana:** `html5-qrcode` (açıq-mənbə, brauzer kamerası vasitəsilə EAN-13/Code128/QR skan edir, əlavə native tətbiq tələb etmir — mobil brauzerdə də işləyir, Fayl 1-in mobil responsivlik tələbinə tam uyğundur).
- İstifadə nöqtələri: Mal yaratma formunda ("Skan et" düyməsi ilə barkod sahəsini doldurma), Anbar Qəbulu ekranında (sürətli mal tapma), Retail "Sürətli Satış" rejimində (Fayl 2, Bölmə 2.3-ə istinad), İnventarizasiya zamanı.
- Kamera icazəsi brauzer səviyyəsində soruşulur; icazə verilmədikdə manual axtarış (ad/SKU) alternativ olaraq həmişə mövcuddur.

---

## 2. Anbar (Warehouse) Strukturu

### 2.1. `warehouses/{warehouseId}` sənəd sxemi

```
warehouses/{warehouseId}
├── companyId: string
├── name: { az: string, en: string }
├── code: string
├── type: 'main' | 'store' | 'production' | 'virtual'   // 'virtual' — məs. "Zay Mallar" anbarı, fiziki yer deyil, uçot məqsədli
├── address: string | null
├── isActive: boolean
└── createdAt, updatedAt: timestamp
```

> **Warehouse vs Department fərqi (Fayl 2, Bölmə 4-ün təkrarı, aydınlıq üçün):** `warehouses` — fiziki mal saxlanma yeri (uçot vahidi kimi ehtiyat qalığı üçün); `departments` — mühasibat/HR üçün təşkilati kəsim. Bir mağaza həm bir Warehouse (stok yeri), həm bir Department (xərc mərkəzi) kimi modelləşdirilə bilər — ikisi ayrı sənəd olsa da, adətən paralel yaradılır və `warehouses.linkedDepartmentId` sahəsi ilə könüllü əlaqələndirilir.

### 2.2. Rəf/Zona (opsional, gələcək genişlənmə üçün yer saxlanılır)

İlkin versiyada anbar daxili rəf/zona (bin location) səviyyəsində izləmə **tələb olunmur** — bu, kiçik-orta ölçülü müştərilər üçün artıq mürəkkəblik yaradardı. `warehouses` sənədinə gələcəkdə `binLocations` subcollection əlavə edilə bilər (kod dəyişikliyi minimal olacaq şəkildə sxem açıq saxlanılır).

---

## 3. Ehtiyat Hərəkətləri (Stock Movements) — Davamlı (Perpetual) Uçot Modeli

TaxIQ **davamlı inventar sistemi** (perpetual inventory) tətbiq edir — hər alış, satış, transfer və düzəliş **dərhal** qeydə alınır və qalıqlar real-time yenilənir (dövr sonunda fiziki sayım gözlənilmir, baxmayaraq ki, illik/rüblük inventarizasiya da Bölmə 6-da dəstəklənir).

### 3.1. `stockMovements/{movementId}` sənəd sxemi

```
stockMovements/{movementId}
├── companyId: string
├── warehouseId: string
├── goodId: string
├── movementType: 'purchase_in' | 'sale_out' | 'transfer_out' | 'transfer_in' | 'adjustment_in' | 'adjustment_out' | 'return_in' | 'return_out'
├── quantity: number                  // həmişə baseUnit-də, həmişə müsbət ədəd (istiqamət movementType ilə müəyyənləşir)
├── unitCost: number | null           // yalnız "in" hərəkətlər üçün (alış qiyməti) — dəyərləndirmə üçün istifadə olunur
├── relatedDocumentType: string | null   // "purchaseInvoice" | "salesInvoice" | "stockTransfer" | "stockCount"
├── relatedDocumentId: string | null
├── movementDate: timestamp           // faktiki əməliyyat tarixi (geriyə tarixli ola bilər)
├── note: string | null
├── performedBy: string
└── createdAt: timestamp
```

**Kritik qayda:** `stockMovements` sənədləri **heç vaxt redaktə edilmir və silinmir** (mühasibat jurnalı kimi dəyişməz qeyd — Fayl 8-dəki əməliyyat jurnalı prinsipi ilə eynidir). Səhv qeydin düzəlişi əks hərəkət (əks-yazı, "reversal") yaradılmaqla edilir.

### 3.2. Cari Qalığın Hesablanması — `stockBalances`

Hər `stockMovements` yazısından sonra Cloud Function trigger (`onStockMovementCreate`) avtomatik **denormallaşdırılmış qalıq sənədini** yeniləyir (real-time sorğu üçün bütün tarixi hərəkətləri toplamaq səmərəsiz olardı):

```
stockBalances/{warehouseId}_{goodId}
├── companyId, warehouseId, goodId: string
├── quantityOnHand: number
├── averageCost: number               // yalnız Weighted Average metodu seçilibsə mənalıdır (bax Bölmə 4)
├── totalValue: number                // quantityOnHand × averageCost (və ya FIFO layer-lərinin cəmi)
└── lastMovementAt: timestamp
```

Bu sənəd Firestore tranzaksiyası (`runTransaction`) daxilində yenilənir ki, eyni anda bir neçə hərəkət baş verərkən (məs. paralel satışlar) qalıq "race condition"a məruz qalmasın.

---

## 4. Dəyərləndirmə Metodları (Inventory Valuation)

### 4.1. Seçim: yalnız FIFO və Orta Çəkili Qiymət (Weighted Average)

> **Vacib qərar:** LIFO (Last-In-First-Out) metodu **tətbiq edilmir**, çünki TaxIQ-ın əsas hesabat çərçivəsi IFRS-dir və **IAS 2 (Inventories) standartı LIFO-nun istifadəsini qadağan edir**. Bu, sistemi lüzumsuz mürəkkəblikdən (istifadə edilə bilməyəcək metodu implementasiya etməkdən) qoruyur və IFRS uyğunluğunu əvvəlcədən təmin edir.

### 4.2. Orta Çəkili Qiymət (Weighted Average / Moving Average)

Hər yeni giriş (`purchase_in`, `adjustment_in`) zamanı orta qiymət real-time yenidən hesablanır:

```
Yeni Orta Qiymət = (Köhnə Miqdar × Köhnə Orta Qiymət + Gələn Miqdar × Gələn Qiymət)
                   ÷ (Köhnə Miqdar + Gələn Miqdar)
```

Çıxış (`sale_out`, `transfer_out`) zamanı bu **cari orta qiymət** Satılmış Malın Maya Dəyəri (COGS) kimi istifadə olunur, `stockBalances.averageCost` sahəsi çıxışdan sonra dəyişmir (yalnız giriş dəyişdirir).

### 4.3. FIFO (First-In-First-Out)

FIFO seçildikdə hər giriş ayrıca **"qat" (layer)** kimi saxlanılır:

```
stockLayers/{layerId}
├── companyId, warehouseId, goodId: string
├── receivedAt: timestamp
├── originalQuantity: number
├── quantityRemaining: number          // çıxışlar bu sahəni azaldır
├── unitCost: number
└── sourceMovementId: string
```

Çıxış baş verəndə sistem **ən erkən `receivedAt`** tarixli, `quantityRemaining > 0` olan qatlardan ardıcıl çıxarır (bir çıxış bir neçə qatı əhatə edə bilər, məs. 100 ədəd sifariş 60 ədədlik köhnə qatdan + 40 ədədlik yeni qatdan çıxarılır, hər ikisinin qiyməti fərqli ola bilər — COGS bu qarışıq dəyərdən hesablanır).

### 4.4. Metod seçimi

- **Company səviyyəsində defolt** (`companies/{companyId}.settings.defaultValuationMethod`) — Fayl 2-dəki sektor şablonunun tövsiyəsinə uyğun ilkin dəyər (İstehsalat: FIFO tövsiyə olunur, xüsusilə xarab olan xammal üçün; Retail/Topdansatış: hər ikisi mümkündür).
- **Mal səviyyəsində override** (`goods.valuationMethodOverride`) — nadir hallar üçün (məs. əksər mallar Weighted Average, lakin tez xarab olan bir kateqoriya FIFO istəyə bilər).
- ⚠️ Metod bir mal üçün **fəal ehtiyat qalığı olduqdan sonra dəyişdirilə bilməz** (sistemdə bu, xəbərdarlıqla bloklanır) — dəyərləndirmə tutarlılığının pozulmaması üçün (IFRS-in "consistency" prinsipi).

---

## 5. Minimum Səviyyə və Sifariş Nöqtəsi Xəbərdarlıqları

- Hər mal üçün `reorderPoint` (minimum səviyyə) və `reorderQuantity` (tövsiyə olunan sifariş miqdarı) təyin edilə bilər.
- `stockBalances.quantityOnHand` bu həddin altına düşdükdə **Cloud Function trigger** avtomatik Fayl 4-ün Workflow mühərrikinə uyğun `on_update` tipli trigger imkanı yaradır (Company özü "Minimum Səviyyə Xəbərdarlığı" workflow-unu quraşdıra bilər — məs. Satınalma Meneceri bildiriş alsın).
- Dashboard-da (Fayl 3) "Minimum Səviyyədən Aşağı Mallar" KPI/widget-i bu sahədən oxuyur.

---

## 6. İnventarizasiya (Stock Take / Physical Count)

### 6.1. Konsepsiya

Davamlı uçot sisteminin dəqiqliyini yoxlamaq üçün dövrü fiziki sayım aparılır (illik audit tələbi, IFRS uyğunluğu üçün də vacibdir).

```
stockCounts/{countId}
├── companyId, warehouseId: string
├── status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
├── countedItems: [{
│     goodId: string,
│     systemQuantity: number,      // sayım başlayanda sistemdəki qalıq (dondurulmuş görüntü)
│     countedQuantity: number | null,
│     variance: number | null      // countedQuantity - systemQuantity
│   }]
├── startedAt, completedAt: timestamp | null
├── countedBy: string
├── approvedBy: string | null      // Fayl 4-ün Approval node-u ilə əlaqələndirilə bilər (fərq həddi aşarsa təsdiq tələb olunsun)
└── createdAt: timestamp
```

### 6.2. Axın

1. Sayım başladılır → sistem cari `stockBalances`-i "dondurulmuş" (`systemQuantity`) olaraq kopyalayır.
2. Anbar işçisi mobil cihazdan (barkod skanla və ya siyahıdan) faktiki sayılan miqdarı daxil edir.
3. Sayım tamamlanır → sistem hər fərq (`variance ≠ 0`) üçün avtomatik `adjustment_in`/`adjustment_out` tipli `stockMovements` yaradır.
4. Əgər ümumi fərqin dəyəri Company-nin təyin etdiyi həddi keçərsə (məs. 500 ₼-dən çox), sistem Fayl 4-dəki Approval workflow-unu tetikləyə bilər (Company Admin bunu quraşdırırsa) — sayım yalnız təsdiqdən sonra "tamamlanmış" sayılır və düzəliş yazıları yaradılır.

---

## 7. Anbarlar Arası Transfer

```
stockTransfers/{transferId}
├── companyId, fromWarehouseId, toWarehouseId: string
├── status: 'pending' | 'in_transit' | 'completed' | 'cancelled'
├── items: [{ goodId: string, quantity: number }]
├── requestedBy: string
├── shippedAt, receivedAt: timestamp | null
└── createdAt: timestamp
```

- Transfer "göndərildi" statusuna keçəndə mənbə anbarda `transfer_out` hərəkəti yaradılır (qalıq azalır).
- Təyinat anbarda "qəbul edildi" təsdiqləndikdə `transfer_in` hərəkəti yaradılır (qalıq artır) — **iki addımlı təsdiq** yolu ilə "yolda olan mal" (goods in transit) vəziyyəti düzgün əks olunur (mal nə mənbədə, nə də təyinatda tam sayılmır, ayrıca "yolda" statusu Dashboard-da göstərilə bilər).
- Böyük məbləğli transferlər üçün Fayl 4-ün Approval workflow-u könüllü tətbiq oluna bilər.

---

## 8. Gələcək Genişlənmə (Şəffaf Qeyd — Fayl 2-nin Təkrarı)

Bu modul **davamlı uçot əsaslı anbar idarəetməsini** tam əhatə edir, lakin aşağıdakılar bu 10 faylın əhatəsindən kənardadır və gələcək faza kimi qeyd olunur:
- Tam İstehsal Resurs Planlaşdırması (MRP): Bill of Materials (BOM), İstehsal Sifarişləri, Avtomatik istehsal xərcinin hesablanması.
- Bin/rəf səviyyəsində dəqiq lokasiya izləmə.
- Seriya/lot nömrəsi ilə izləmə (son istifadə tarixi, geri çağırma — food&beverage/əczaçılıq üçün vacib, lakin ilkin əhatədə yoxdur).

---

## 9. Excel Export Nöqtələri (Fayl 3-ə istinad)

Fayl 3-ün Universal Export Framework-ü aşağıdakı cədvəllərdə tətbiq olunacaq:
- [ ] Mal/Xidmət Kataloqu (bütün sahələr, qiymət, ehtiyat statusu daxil)
- [ ] Cari Anbar Qalıqları (`stockBalances`, anbar üzrə filtrlənə bilən)
- [ ] Ehtiyat Hərəkətləri Tarixçəsi (`stockMovements`, tarix aralığı və hərəkət tipi filtri ilə)
- [ ] İnventarizasiya Nəticələri (fərqlərlə birlikdə)
- [ ] Anbarlar Arası Transfer Siyahısı

---

## 10. Qəbul Meyarları (Acceptance Criteria) — Modul 5

- [ ] Mal/Xidmət kataloqunda hər iki tip (`good`/`service`) düzgün idarə olunur, xidmətlərdə anbar sahələri gizlədilir.
- [ ] Vahid çevrilməsi (məs. "quti" ↔ "ədəd") bütün hərəkətlərdə düzgün tətbiq olunur.
- [ ] Qiymət siyahıları müştəri qrupuna və sifariş miqdarına görə düzgün seçilir.
- [ ] Barkod skan funksiyası mobil brauzerdə kamera icazəsi ilə işləyir, uğursuz olduqda manual axtarışa keçid mövcuddur.
- [ ] `stockMovements` yazıldıqdan sonra `stockBalances` tranzaksiya təhlükəsizliyi ilə (race condition olmadan) dərhal yenilənir.
- [ ] Weighted Average metodu seçilmiş malda hər giriş orta qiyməti düzgün yenidən hesablayır.
- [ ] FIFO metodu seçilmiş malda çıxış ən erkən qatdan başlayaraq düzgün ardıcıllıqla azaldılır və qarışıq COGS düzgün hesablanır.
- [ ] Fəal qalığı olan malın dəyərləndirmə metodu dəyişdirilməyə cəhd edildikdə sistem bloklayır və xəbərdarlıq göstərir.
- [ ] Minimum səviyyədən aşağı düşən mal Dashboard-da və (quraşdırılıbsa) Workflow bildirişində görünür.
- [ ] İnventarizasiya prosesi fərqləri düzgün hesablayır və müvafiq düzəliş hərəkətlərini avtomatik yaradır.
- [ ] Anbarlar arası transfer "yolda" vəziyyətini düzgün əks etdirir (heç bir anbarda ikiqat sayılmır, heç birində itmir).
- [ ] Bütün cədvəllərdə Excel export mövcuddur və düzgün işləyir.

---

## 11. Digər Modullara İstinadlar

- Fayl 2, Bölmə 4 (`departments`) ↔ `warehouses.linkedDepartmentId` (opsional əlaqə).
- Fayl 3, Bölmə 3.4 → `goods`, `stockBalances`, `stockMovements` özlərini "reportable entity" kimi qeydiyyata alacaq.
- Fayl 4 (Workflow) → minimum səviyyə xəbərdarlığı, böyük fərqli inventarizasiya təsdiqi, böyük transfer təsdiqi bu modulun trigger nöqtələrini istifadə edəcək.
- Fayl 6 (Satış) → hər fakturada seçilən mal `sale_out` hərəkəti yaradacaq, qiymət siyahılarından (Bölmə 1.4) istifadə edəcək.
- Fayl 7 (Kassa/Bank) → alış ödənişi tamamlandıqda `purchase_in` hərəkəti yaradılacaq.
- Fayl 8 (Mühasibat) → `stockBalances.totalValue` balans hesabatında "Ehtiyatlar" sətrinə mənbə olacaq, hər `stockMovements` uyğun jurnal yazısı (Anbar Dt / Kreditor Kt və s.) yaradacaq.
- Fayl 9 (IFRS) → IAS 2 uyğunluğu (LIFO-nun istifadə edilməməsi) bu modulda artıq təmin olunub, IAS 2-nin digər tələbləri (aşağı dəyər/bazar qiyməti müqayisəsi) Fayl 9-da qeyd olunacaq.

**Növbəti fayl:** Modul 6 — Satış, Hesab-Faktura və Sənəd (Blank) Dizayneri.
