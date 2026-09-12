# TaxIQ ERP — Modul 3: Dashboard, Hesabat Fərdiləşdirmə və Universal Excel Export Framework

> **Sənəd statusu:** 10 fayldan 3-cüsü. Bu sənəd Fayl 1-də qısaca təsvir olunan Dashboard konsepsiyasını tam açır və bütün platformada **"harda cədvəl varsa, orada Excel export olmalıdır"** tələbini yerinə yetirən **vahid, təkrar istifadə oluna bilən çərçivəni** təyin edir. Fayl 5–10-dakı bütün cədvəllər (mal siyahısı, fakturalar, jurnal yazıları, işçi siyahısı və s.) bu sənəddə təsvir olunan `<DataTable>` komponentini və Export mexanizmini istifadə edəcək — hər modulda təkrar yazılmayacaq.

---

## 0. Bu Sənədin Rolu

Üç ayrı, lakin bir-biri ilə sıx bağlı alt-sistem:

1. **Dashboard** — real-time, widget-əsaslı, fərdiləşdirilə bilən vizual xülasə ekranları.
2. **Hesabat Fərdiləşdirmə (Report Builder)** — istifadəçinin özünün sahə/filtr/qruplaşdırma seçərək yaratdığı fərdi hesabatlar (Excel-ə bənzər pivot məntiqi).
3. **Universal Excel Export Framework** — istənilən cədvəldən bir kliklə Excel-ə ixrac, idarəetmə panelindən fərdiləşdirilə bilən şablonlarla.

Hər üçü eyni prinsipə əsaslanır: **metadata-əsaslı (metadata-driven) mühərrik** — yəni yeni hesabat növü və ya yeni export sütunu əlavə etmək üçün kod dəyişikliyi yox, konfiqurasiya (Firestore sənədi) kifayətdir.

---

## 1. Dashboard Memarlığı

### 1.1. Texnoloji seçim

| Komponent | Texnologiya | Səbəb |
|---|---|---|
| Grid/layout mühərriki | **react-grid-layout** | Sənayedə standart, drag-and-drop + resize + responsive breakpoint dəstəyi doğuşdan mövcuddur |
| Qrafiklər | **Recharts** | Fayl 1-də seçilmiş, React-native, tema (dark/light) ilə asan inteqrasiya |
| Real-time data | Firestore `onSnapshot` listener-lər (TanStack Query ilə saxlanılan keş) | Dashboard heç bir manual "yenilə" düyməsi olmadan canlı yenilənir |

### 1.2. Data modeli

```
dashboards/{dashboardId}
├── companyId: string
├── ownerId: string | null        // null = Company-wide paylaşılan dashboard, dolu = fərdi
├── name: { az: string, en: string }
├── isDefaultForRole: string | null   // roleId — bu dashboard həmin rol üçün ilkin defolt kimi göstərilir
├── widgets: [{
│     id: string,
│     type: 'kpi_card' | 'line_chart' | 'bar_chart' | 'donut_chart' | 'table' | 'gauge' | 'alert_list',
│     title: { az, en },
│     dataSource: {
│       kind: 'kpi' | 'report' | 'raw_query',
│       kpiId: string | null,           // bax Bölmə 2
│       reportId: string | null,        // bax Bölmə 3
│       rawQueryConfig: object | null   // sadə hallar üçün birbaşa collection+filter
│     },
│     dateRangeMode: 'this_month' | 'this_quarter' | 'this_year' | 'custom' | 'all_time',
│     layout: { x: number, y: number, w: number, h: number },       // lg breakpoint
│     layoutSm: { x: number, y: number, w: number, h: number }      // mobil breakpoint (avtomatik hesablanır, əl ilə düzəldilə bilər)
│   }]
├── createdAt, updatedAt: timestamp
└── createdBy: string
```

> **Qeyd:** Widget-lər ayrı kolleksiya kimi deyil, `dashboards` sənədinin daxilində **embedded array** kimi saxlanılır — çünki bir dashboard-da adətən 6-15 widget olur, bu ölçüdə array Firestore sənəd limitinə (1MB) heç yaxınlaşmır və hər dəyişiklikdə tək sənəd yazısı kifayət edir (subcollection istifadə etsək hər widget dəyişikliyi ayrı yazı+oxu tələb edərdi).

### 1.3. Widget növləri

| Tip | Təsvir | Nümunə istifadə |
|---|---|---|
| `kpi_card` | Tək ədəd + trend oxu (yuxarı/aşağı, faiz dəyişim) | "Bu ay gəlir: 45,000 ₼ ▲12%" |
| `line_chart` | Zaman sırası | Aylıq gəlir/xərc trendi |
| `bar_chart` | Kateqoriya müqayisəsi | Departament üzrə xərclər |
| `donut_chart` | Nisbət bölgüsü | Xərclərin kateqoriya bölgüsü |
| `table` | Kompakt cədvəl (max 10 sətir, "hamısına bax" linki ilə) | Son 10 ödənilməmiş faktura |
| `gauge` | Hədəfə nisbətən irəliləyiş | Aylıq satış planının icra faizi |
| `alert_list` | Diqqət tələb edən elementlər siyahısı | Vaxtı keçmiş fakturalar, gözləyən təsdiqlər (Fayl 4-ə istinad) |

### 1.4. Rol-əsaslı defolt Dashboard-lar

Fayl 2-də hər `sectorTemplates` sənədində `defaultDashboardWidgetSetId` göstərilir. Yeni Company yaradılanda bu ID-yə uyğun **defolt dashboard dəsti** (adətən 3-4 dashboard: "Ümumi Rəhbərlik", "Mühasibat", "HR", "Satış") avtomatik kopyalanır (`isDefaultForRole` sahəsi ilə uyğun rola bağlanır). İstifadəçi ilk dəfə daxil olanda öz rolu üçün defolt olan dashboard-u görür.

### 1.5. Fərdiləşdirmə axını (icazə: `dashboard.customize`)

1. İstifadəçi "Redaktə rejimi" düyməsinə basır — bütün widget-lərin künclərində drag-handle və resize-handle görünür.
2. "+ Widget əlavə et" düyməsi **Widget Kitabxanası** modalını açır: sol tərəfdə modul üzrə filtrlənən KPI/hesabat siyahısı, sağda canlı önbaxış.
3. Widget əlavə edildikdə boş yerə avtomatik yerləşir (collision detection ilə).
4. Hər widget-in "..." menyusunda: **Tənzimləmələr** (başlıq, tarix aralığı), **Excel-ə ixrac** (Bölmə 4-ə istinad), **Tam ekran**, **Sil**.
5. "Yadda saxla" — yalnız bu addımda Firestore-a yazılır (draft rejimi lokal state-də saxlanılır, təsadüfi dəyişiklik dərhal tətbiq olunmur).
6. "Defolt olaraq bərpa et" — Company-wide defolt dashboard-a qayıdış.

### 1.6. Mobil uyğunlaşma

`react-grid-layout`-un `responsive` rejimi istifadə olunur: `lg` (masaüstü, 12 sütun), `md` (planşet, 6 sütun), `sm` (mobil, 1 sütun — bütün widget-lər tam enlə, ardıcıl sıralanır). Redaktə rejimi yalnız `lg`/`md`-də aktivdir; mobil ekranda dashboard **yalnız baxış rejimindədir** (redaktə masaüstündən edilir) — bu, mobil UX-i sadələşdirir və tələb olunan "mobil responsivlik"i real istifadə ssenarisinə uyğun (mobil = məlumata baxış, masaüstü = konfiqurasiya) təmin edir.

---

## 2. KPI Kataloqu

### 2.1. Data modeli

```
kpiDefinitions/{kpiId}
├── code: string                    // "finance.dso", "hr.turnover_rate" s.
├── module: string                  // "accounting" | "sales" | "warehouse" | "hr" | "cashbank"
├── name: { az: string, en: string }
├── description: { az: string, en: string }   // hesablama düsturunun izahı
├── unit: 'currency' | 'number' | 'percentage' | 'days' | 'ratio'
├── higherIsBetter: boolean | null  // trend rəngi üçün (yaşıl/qırmızı yuxarı ox)
├── applicableSectors: string[] | 'all'
├── aggregateField: string          // dailyAggregates sənədindəki hansı sahədən oxunur (bax 2.7)
└── icon: string
```

### 2.2. Maliyyə/Mühasibat KPI Kataloqu

| KPI | Düstur | Vahid |
|---|---|---|
| Kassa/Bank Qalığı | Cari qalıq | Valyuta |
| Ümumi Gəlir (dövr üzrə) | Satış jurnalından cəm | Valyuta |
| Ümumi Mənfəət Marjası | (Gəlir − Satılmış Malın Maya Dəyəri) / Gəlir | % |
| Alacaqların Ödəniş Müddəti — **DSO** | (Orta Debitor Borcu / Kredit Satışı) × Dövr günü | Gün |
| Öhdəliklərin Ödəniş Müddəti — **DPO** | (Orta Kreditor Borcu / Satılmış Malın Maya Dəyəri) × Dövr günü | Gün |
| Ehtiyatın Dövriyyə Müddəti — **DIO** | (Orta Ehtiyat / Satılmış Malın Maya Dəyəri) × Dövr günü | Gün |
| Pul Vəsaitlərinin Dövriyyə Dövrü — **CCC** | DIO + DSO − DPO | Gün |
| Cari Likvidlik Əmsalı | Cari Aktivlər / Cari Öhdəliklər | Əmsal |
| Ödənilməmiş Fakturaların Ümumi Məbləği | Açıq status-lu fakturaların cəmi | Valyuta |
| Vaxtı Keçmiş Debitor Borcu | Ödəmə müddəti keçmiş fakturaların cəmi | Valyuta |

### 2.3. Satış KPI Kataloqu

| KPI | Təsvir |
|---|---|
| Dövr üzrə Ümumi Satış | Seçilmiş tarix aralığında yaradılmış fakturaların cəmi |
| Orta Faktura Dəyəri | Ümumi Satış / Faktura Sayı |
| Top 5 Müştəri | Gəlirə görə sıralanmış |
| Yeni Müştəri Sayı | Dövr ərzində yaradılmış müştəri kartları |
| Satış Planının İcrası | Faktiki / Hədəf (əgər Company hədəf təyin edibsə) |

### 2.4. Anbar KPI Kataloqu

| KPI | Təsvir |
|---|---|
| Ümumi Ehtiyat Dəyəri | Bütün anbarlar üzrə cari qiymətləndirmə |
| Ehtiyat Dövriyyə Sürəti (Inventory Turnover) | Satılmış Malın Maya Dəyəri / Orta Ehtiyat |
| Minimum Səviyyədən Aşağı Mallar | Reorder point-dən aşağı düşən mal sayı (Fayl 5-ə istinad) |
| Ən Çox Satılan 10 Mal | Miqdar/dəyərə görə |

### 2.5. HR KPI Kataloqu

| KPI | Təsvir |
|---|---|
| Aktiv İşçi Sayı | `status = active` olan işçilər |
| İşçi Dövriyyəsi (Turnover Rate) | (Dövr ərzində işdən çıxanlar / Orta işçi sayı) × 100 |
| Gözləyən Məzuniyyət Tələbləri | Təsdiq gözləyən sayı (Fayl 4/10-a istinad) |
| Orta İş Stajı | Bütün aktiv işçilər üzrə orta |
| Növbəti 30 Gündə Bitəcək Müqavilələr | Fayl 10-dakı müqavilə tarixlərinə əsasən |

### 2.6. Sektor-spesifik KPI-lar (Fayl 2-yə istinad)

Otelçilik: **RevPAR**, **ADR**, **Doluluq Faizi**, **GOPPAR** — bu KPI-lar yalnız `sector = hospitality` olan Company-lərin KPI seçimində görünür (`applicableSectors: ['hospitality']`).

### 2.7. KPI hesablama mexanizmi (performans strategiyası)

Real-time olaraq minlərlə sənəd üzərində `SUM`/`AVG` hesablamaq performans baxımından səmərəsizdir. Strategiya:

1. **Firestore native aggregation query-ləri** (`count()`, `sum()`, `average()`) sadə, tək-kolleksiyalı KPI-lar üçün birbaşa istifadə olunur (bu funksiyalar server tərəfində hesablanır, bütün sənədləri client-ə çəkmədən).
2. **Mürəkkəb/çox-mənbəli KPI-lar üçün (DSO, CCC və s., bir neçə kolleksiyanın birləşməsini tələb edən) — gündəlik ön-hesablama (precomputed aggregation):**
   ```
   dailyAggregates/{companyId}_{YYYY-MM-DD}
   ├── companyId, date
   ├── revenue, cogs, expenses, netProfit
   ├── cashBalance, arTotal, apTotal, inventoryValue
   ├── averageInventory30d, averageAR30d, averageAP30d
   ├── activeEmployeeCount, newHiresCount, terminationsCount
   └── computedAt: timestamp
   ```
   Bu sənəd **Cloud Function (Cloud Scheduler, hər gecə saat 02:00)** vasitəsilə hesablanır və yenilənir. Dashboard KPI kartları bu sənədi oxuyur — sürətli və miqyaslana bilən.
3. **Gələcək genişlənmə (qeyd olaraq):** Əməliyyat həcmi böyüdükcə (10,000+ sənəd/ay) **"Stream Firestore to BigQuery"** rəsmi Firebase Extension-ı quraşdırılaraq mürəkkəb, ad-hoc analitik sorğular BigQuery üzərində icra edilə bilər — bu, ilkin versiyada tələb olunmur, lakin memarlıq bunu maneəsiz dəstəkləyəcək şəkildə qurulmalıdır (yəni `dailyAggregates` strukturu BigQuery cədvəl sxeminə asanlıqla map oluna bilən formada saxlanılır).

---

## 3. Hesabat Fərdiləşdirmə (Report Builder) Modulu

### 3.1. Konsepsiya: Metadata-əsaslı hesabat mühərriki

Sənaye təcrübəsində sınanmış yanaşma: hesabatlar **kod kimi deyil, konfiqurasiya (metadata) kimi** təyin olunur. Bu yolla developer heç bir yeni hesabat növü üçün kod yazmır — istifadəçi UI-dan sahə, filtr, qruplaşdırma seçir, sistem bunu Firestore sorğusuna (və ya Cloud Function aggregation-a) tərcümə edir.

### 3.2. `reportDefinitions/{reportId}` sənəd sxemi

```
reportDefinitions/{reportId}
├── companyId: string
├── name: string
├── sourceEntity: string             // "invoices" | "employees" | "journalEntries" | "goods" s. (hər modul öz "entity" adını qeydiyyatdan keçirir)
├── selectedFields: string[]         // göstəriləcək sütunlar
├── filters: [{
│     field: string,
│     operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains' | 'between',
│     value: any
│   }]
├── groupBy: string[] | null
├── aggregations: [{ field: string, function: 'sum' | 'avg' | 'count' | 'min' | 'max', label: string }]
├── sortBy: { field: string, direction: 'asc' | 'desc' } | null
├── chartType: 'table' | 'bar' | 'line' | 'donut' | null
├── visibility: 'private' | 'company'   // yalnız yaradan görsün, ya bütün Company
├── schedule: {
│     enabled: boolean,
│     frequency: 'daily' | 'weekly' | 'monthly',
│     dayOfWeek: number | null,        // weekly üçün
│     dayOfMonth: number | null,       // monthly üçün
│     timeOfDay: string,               // "09:00"
│     recipients: string[],            // e-poçt siyahısı
│     format: 'xlsx' | 'pdf'
│   } | null
├── createdAt, updatedAt: timestamp
└── createdBy: string
```

### 3.3. Report Builder UI axını

1. **Mənbə seçimi:** "Hansı məlumat üzərində hesabat qurmaq istəyirsiniz?" — açılan siyahı (Fakturalar, İşçilər, Jurnal Yazıları, Anbar Hərəkətləri s., hər modul özünü qeydiyyata alır — bax 3.4).
2. **Sahə seçimi:** sol tərəfdə mövcud sahələrin siyahısı (checkbox), sağa "sürüklə" və ya "+" ilə seçilmiş sütunlar panelinə əlavə et.
3. **Filtr qurma:** "+ Filtr əlavə et" — sahə, operator, dəyər seçimi (tarix sahələri üçün date-picker, select sahələr üçün dropdown).
4. **Qruplaşdırma/Cəmləmə (opsional):** "Qrupla:" dropdown (məs. "Müştəriyə görə") + "Cəmlə:" (məs. "Məbləğ → Sum").
5. **Sıralama:** sütun + istiqamət.
6. **Canlı önbaxış:** hər dəyişiklikdən sonra sağ paneldə cədvəl/qrafik önbaxışı avtomatik yenilənir (debounce 500ms).
7. **Saxlama:** ad ver, görünürlük seç (Yalnız Mən / Bütün Company), "Yadda saxla".
8. **Planlaşdırma (opsional):** "Planlaşdırılmış Göndəriş" toggle-i açılır → tezlik, saat, alıcı e-poçtları, format (Excel/PDF).

### 3.4. Modul-registrasiya mexanizmi

Hər biznes modulu (Fayl 5-10) öz "hesabat edilə bilən" (reportable) sahələrini bir konfiqurasiya obyekti kimi qeydiyyata alır:

```ts
registerReportableEntity({
  entityKey: 'invoices',
  label: { az: 'Fakturalar', en: 'Invoices' },
  collectionPath: 'invoices',
  fields: [
    { key: 'invoiceNumber', label: {az:'Faktura №', en:'Invoice No'}, type: 'string' },
    { key: 'customerName', label: {az:'Müştəri', en:'Customer'}, type: 'string' },
    { key: 'totalAmount', label: {az:'Məbləğ', en:'Amount'}, type: 'number' },
    { key: 'issueDate', label: {az:'Tarix', en:'Date'}, type: 'date' },
    { key: 'status', label: {az:'Status', en:'Status'}, type: 'enum', options: [...] },
  ]
});
```

Bu, sistemin **genişlənə bilən** olmasını təmin edir — Fayl 5-10 implementasiya olunanda hər biri bu registrasiyanı əlavə edəcək, Report Builder avtomatik onları tanıyacaq (kod dəyişikliyi Report Builder-in özündə tələb olunmadan).

### 3.5. İcra məhdudiyyətləri (şəffaf qeyd)

Firestore relational join dəstəkləmədiyi üçün **çox-kolleksiyalı** (məs. "Faktura + Müştəri + Satış Meneceri" birləşməsi) hesabatlar tətbiq səviyyəsində (Cloud Function-da, əlaqəli sənədləri ardıcıl oxuyaraq) həll olunur, birbaşa Firestore query ilə deyil. Bu səbəbdən mürəkkəb çox-mənbəli fərdi hesabatlar Cloud Function callable funksiyası (`generateCustomReport`) vasitəsilə server tərəfində icra olunur, nəticə frontend-ə hazır JSON kimi qaytarılır.

---

## 4. Universal Excel Export Framework

### 4.1. Prinsip

Platformada istifadə olunan **vahid `<DataTable>` React komponenti** hər zaman sağ üst küncdə **"Excel-ə İxrac"** düyməsinə malikdir (Fayl 5-10-dakı bütün cədvəllər bu komponentdən istifadə edəcək — anbar siyahısı, fakturalar, jurnal yazıları, işçi siyahısı, məzuniyyət tələbləri, əmək haqqı cədvəli və s.).

### 4.2. Texniki icra

| Ssenari | Yanaşma |
|---|---|
| Kiçik/orta data (≤ 5,000 sətir) | **Client-side** generasiya: `SheetJS (xlsx)` kitabxanası brauzerdə birbaşa `.xlsx` faylı yaradır, əlavə server sorğusu tələb olunmur — sürətlidir |
| Böyük data (> 5,000 sətir) və ya brendinq/mürəkkəb formatlaşdırma tələb olunan hallar | **Server-side (Cloud Function)** generasiyası: eyni SheetJS kitabxanası Node.js mühitində, nəticə Cloud Storage-a yazılır, imzalanmış müvəqqəti link (signed URL, 1 saat etibarlı) frontend-ə qaytarılır |
| Planlaşdırılmış hesabatlar (Bölmə 3.3) | Həmişə server-side, nəticə həm Cloud Storage-a saxlanılır, həm e-poçtla göndərilir |

### 4.3. Export Şablonlarının İdarəetməsi (Tələb olunan "Fərdiləşdirmə üçün İdarəetmə Hissəsi")

```
exportTemplates/{templateId}
├── companyId: string
├── entityType: string              // "invoices" | "employees" | "journalEntries" s. — Bölmə 3.4-dəki entityKey ilə eynidir
├── name: string
├── isDefault: boolean              // hər entityType üçün yalnız 1 defolt ola bilər
├── columns: [{
│     field: string,
│     headerLabel: { az: string, en: string },
│     order: number,
│     width: number | null,         // Excel sütun eni (opsional)
│     numberFormat: string | null,  // "#,##0.00" kimi Excel format kodu
│     isVisible: boolean
│   }]
├── includeCompanyLogo: boolean
├── includeCompanyHeader: boolean   // Company adı, VÖEN, ünvan sənədin yuxarı hissəsində
├── headerText: string | null       // fərdi başlıq mətni
├── footerText: string | null       // məs. "Hazırladı: TaxIQ Consulting"
├── freezeHeaderRow: boolean
├── createdAt, updatedAt: timestamp
└── createdBy: string
```

**Export Şablonları İdarəetmə Ekranı** (icazə: `platform.export_templates.manage`):
- Hər `entityType` üçün mövcud şablonların siyahısı.
- Yeni şablon yaratma: sütun seçimi (checkbox + sürüklə-sırala), hər sütun üçün başlıq mətnini fərdiləşdirmə (məs. "totalAmount" sahəsini Excel-də "Ümumi Məbləğ (AZN)" kimi göstərmək), say formatı seçimi.
- "Bu şablonu defolt et" düyməsi.
- Önbaxış: nümunə 3 sətirlik data ilə Excel görünüşünün canlı simulyasiyası.
- İstifadəçi export düyməsinə basanda, əgər birdən çox şablon varsa, kiçik dropdown ilə hansı şablonla ixrac etmək istədiyini seçir (defolt əvvəlcədən seçilib).

### 4.4. Dil-uyğunluq

Export zamanı sütun başlıqları **istifadəçinin cari interfeys dilinə** (Fayl 1, Bölmə 7.3) uyğun avtomatik seçilir (`headerLabel.az` və ya `headerLabel.en`), status kimi enum dəyərlər də tərcümə lüğətindən keçirilir (məs. `paid` → "Ödənilib" / "Paid").

### 4.5. PDF ilə əlaqə

Excel Export Framework-i cədvəl-tipli məlumatlar üçündür. Sənəd-tipli çıxışlar (fakturalar, əmək haqqı vərəqələri, əmək müqaviləsi) üçün ayrıca **PDF Blank Dizayneri** Fayl 6-da tam təsvir olunacaq — orada WYSIWYG dizayn редактор olacaq (sadə sütunlu cədvəldən fərqli, tam səhifə tərtibatı).

### 4.6. Bütün modullarda tələb olunan export nöqtələrinin siyahısı (icra checklist-i, Fayl 5-10 üçün)

Bu siyahı hər növbəti fayl yazılanda yoxlanılacaq — hər bənd öz cədvəlində Export düyməsinə malik olmalıdır:
- [ ] Fayl 5: Anbar Qalıqları, Mal/Xidmət Kataloqu, Anbar Hərəkətləri Tarixçəsi
- [ ] Fayl 6: Fakturalar Siyahısı, Müştərilər Siyahısı, Satış Sifarişləri
- [ ] Fayl 7: Kassa Əməliyyatları, Bank Hesabatları, Ödəniş Tapşırıqları
- [ ] Fayl 8: Əməliyyat Jurnalı, Hesablar Planı, Debitor/Kreditor Balansları
- [ ] Fayl 9: Bütün IFRS hesabatları (əlavə olaraq PDF formatında da)
- [ ] Fayl 10: İşçi Siyahısı, Məzuniyyət Tarixçəsi, Tabel, Əmək Haqqı Cədvəli, Ödəniş Siyahısı

---

## 5. Qəbul Meyarları (Acceptance Criteria) — Modul 3

- [ ] Dashboard widget-ləri drag-and-drop ilə yerdəyişdirilir, ölçüsü dəyişdirilir, dəyişiklik yalnız "Yadda saxla"dan sonra qalıcılaşır.
- [ ] Yeni Company yaradılanda sektora uyğun defolt dashboard-lar avtomatik quraşdırılır (Fayl 2 ilə inteqrasiya).
- [ ] `dailyAggregates` sənədi hər gecə düzgün hesablanır və Dashboard KPI kartları bu mənbədən oxuyur (canlı ağır sorğu aparmır).
- [ ] Report Builder-də istifadəçi heç bir developer köməyi olmadan yeni fərdi hesabat yarada, saxlaya, paylaşa bilir.
- [ ] Planlaşdırılmış hesabat düzgün tezlikdə, düzgün formatda, göstərilən alıcılara e-poçtla göndərilir.
- [ ] İstənilən `<DataTable>` istifadə edən ekranda Excel export düyməsi mövcuddur və işləkdir.
- [ ] Export Şablonları idarəetmə ekranından sütun seçimi/adlandırılması/sırası fərdiləşdirilə bilir və bu, real export nəticəsinə əks olunur.
- [ ] Export nəticəsi istifadəçinin seçdiyi dilə uyğun başlıqlarla gəlir.
- [ ] Mobil ekranda dashboard-lar baxış rejimində tam oxunaqlıdır (redaktə mobil-də deaktivdir).

---

## 6. Digər Modullara İstinadlar

- Fayl 2-dəki `sectorTemplates.defaultDashboardWidgetSetId` → bu faylda təsvir olunan `dashboards` strukturuna map olunur.
- Fayl 2-dəki `departments` (dimension) → Report Builder-də filtr/qruplaşdırma sahəsi kimi avtomatik mövcud olacaq.
- Fayl 4 (Workflow) → `alert_list` widget-i və gözləyən təsdiqlər KPI-ı Workflow modulunun məlumatlarını istifadə edəcək.
- Fayl 5–10 → hər biri öz "reportable entity"-lərini Bölmə 3.4-dəki mexanizmlə qeydiyyata alacaq və öz cədvəllərində `<DataTable>` + Export düyməsini istifadə edəcək (Bölmə 4.6-dakı checklist).
- Fayl 9 (IFRS Hesabatlar) — həm bu faylın Excel Export Framework-ündən, həm də ayrıca PDF generasiya mexanizmindən (rəsmi hesabat formatı üçün) istifadə edəcək.

**Növbəti fayl:** Modul 4 — Workflow Management (Power Automate tərzi trigger-condition-action mühərriki, hər şirkət üçün fərqli ssenarilər, təsdiq zəncirləri).
