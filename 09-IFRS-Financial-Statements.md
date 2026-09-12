# TaxIQ ERP — Modul 9: IFRS Maliyyə Hesabatları

> **Sənəd statusu:** 10 fayldan 9-cusu. Bu sənəd Fayl 8-dəki Hesablar Planı və `accountBalances` strukturu üzərində **birbaşa, avtomatik** qurulan IFRS-ə uyğun maliyyə hesabatlarını təsvir edir. Fayl 8-in rəsmi Azərbaycan Hesablar Planı sinifləri (1-9) demək olar ki, birbaşa hesabat sətirlərinə map olunduğu üçün bu modul əlavə məlumat modelindən çox **generasiya məntiqinə (calculation & template engine)** əsaslanır.

---

## 1. IFRS-ə Uyğun Tam Hesabat Dəsti (IAS 1)

**IAS 1 Maliyyə Hesabatlarının Təqdimatı** standartına əsasən tam maliyyə hesabatları dəsti 5 komponentdən ibarətdir:

| № | Komponent | Azərbaycanca | Bu Modulda |
|---|---|---|---|
| 1 | Statement of Financial Position | Maliyyə Vəziyyəti haqqında Hesabat (Balans) | Bölmə 2 |
| 2 | Statement of Profit or Loss and OCI | Mənfəət və Zərər (və Digər Ümumi Gəlir) haqqında Hesabat | Bölmə 3 |
| 3 | Statement of Changes in Equity | Kapitalda Dəyişikliklər haqqında Hesabat | Bölmə 4 |
| 4 | Statement of Cash Flows | Pul Vəsaitlərinin Hərəkəti haqqında Hesabat | Bölmə 5 |
| 5 | Notes | Qeydlər (Uçot Siyasəti və Əlavə Açıqlamalar) | Bölmə 6 |

**⚠️ Gələcəyə hazırlıq qeydi:** IASB-nin **IFRS 18 Financial Statements**-i 2027-ci il yanvarın 1-dən IAS 1-i əvəz edəcək (gəlir cədvəlində yeni məcburi ara-yekunlar: "əməliyyat mənfəəti", "investisiya və maliyyələşdirmə fəaliyyəti üzrə nəticə" kateqoriyaları, həmçinin Pul Vəsaitlərinin Hərəkəti Hesabatında dolayı metodun başlanğıc nöqtəsi kimi "əməliyyat mənfəəti" istifadəsi). Bu səbəbdən hesabat generasiya mühərriki **sərt kodlaşdırılmış sətir strukturu ilə deyil, aşağıda təsvir olunan template-əsaslı** yanaşma ilə qurulur ki, 2027-ci ildə struktur yeniləməsi minimal kod dəyişikliyi ilə mümkün olsun.

---

## 2. Maliyyə Vəziyyəti haqqında Hesabat (Balans)

### 2.1. Struktur — Fayl 8-in Sinif Strukturundan Birbaşa Törəmə

Azərbaycan Hesablar Planının sinif bölgüsü artıq IFRS-in cari/qeyri-cari ayrımına uyğun qurulduğu üçün (Sinif 1 = Uzunmüddətli Aktivlər, Sinif 2 = Qısamüddətli Aktivlər, Sinif 3 = Kapital, Sinif 4 = Uzunmüddətli Öhdəliklər, Sinif 5 = Qısamüddətli Öhdəliklər), balans hesabatı **demək olar ki, birbaşa** bu strukturun cəmlənməsidir:

```
AKTİVLƏR
  Uzunmüddətli Aktivlər (Sinif 1)
    Qeyri-maddi aktivlər (10, net)          = 101 − 102
    Torpaq, tikili və avadanlıqlar (11, net) = 111 − 112
    ... (12-19 qrupları)
  CƏMİ UZUNMÜDDƏTLİ AKTİVLƏR

  Qısamüddətli Aktivlər (Sinif 2)
    Ehtiyatlar (20, net)                     = 201..207 − 208
    Qısamüddətli debitor borcları (21, net)  = 211..217 − 218
    Pul vəsaitləri və ekvivalentləri (22)
    ... (23-24 qrupları)
  CƏMİ QISAMÜDDƏTLİ AKTİVLƏR

CƏMİ AKTİVLƏR

KAPİTAL VƏ ÖHDƏLİKLƏR
  Kapital (Sinif 3)
    Nizamnamə kapitalı (30)
    Kapital ehtiyatları (33)
    Bölüşdürülməmiş mənfəət (34)
  CƏMİ KAPİTAL

  Uzunmüddətli Öhdəliklər (Sinif 4)
  Qısamüddətli Öhdəliklər (Sinif 5)
  CƏMİ ÖHDƏLİKLƏR

CƏMİ KAPİTAL VƏ ÖHDƏLİKLƏR   (= CƏMİ AKTİVLƏR — avtomatik yoxlanılır)
```

### 2.2. `financialStatementTemplates/{templateId}` — Balans Şablonu

```
financialStatementTemplates/{templateId}
├── companyId: string | null           // null = sistem defoltu, dolu = Company-nin fərdi variasiyası
├── statementType: 'balance_sheet' | 'profit_loss' | 'equity_changes' | 'cash_flow'
├── lineItems: [{
│     lineKey: string,                 // "long_term_assets_total" s.
│     label: { az: string, en: string },
│     level: number,                   // indent səviyyəsi (kateqoriya/alt-kateqoriya/cəmi)
│     accountCodeRanges: string[] | null,  // ["10","11",...,"19"] — hansı Fayl 8 hesab qrupları toplanır
│     formula: string | null,          // "line:gross_profit - line:operating_expenses" — hesablanan sətirlər üçün
│     isSubtotal: boolean,
│     isBold: boolean
│   }]
└── isDefault: boolean
```

Bu şablon strukturu sayəsində 2027-ci il IFRS 18 keçidi zamanı yalnız `lineItems` konfiqurasiyası yenilənəcək, hesablama mühərrikinin özü dəyişməyəcək.

### 2.3. Balans Tənliyinin Avtomatik Yoxlanması

Hesabat generasiya olunanda sistem **`Cəmi Aktivlər = Cəmi Kapital + Cəmi Öhdəliklər`** tənliyini yoxlayır. Fayl 8-dəki `postJournalEntry()`-nin balans zəmanəti (Dt=Kt) səbəbindən bu, nəzəri cəhətdən həmişə düz olmalıdır; uyğunsuzluq aşkarlansa (mümkün deyil, amma qorunma xətti kimi) hesabat "DİQQƏT: Balans Uyğunsuzluğu" xəbərdarlığı ilə qırmızı işarələnir və Baş Mühasibə bildiriş göndərilir.

---

## 3. Mənfəət və Zərər Hesabatı (P&L)

### 3.1. Struktur — Sinif 6, 7, 8, 9-un Kaskadı

```
Satış Gəliri (601) − Qaytarma/Güzəşt (602, 603)              = Xalis Satış
Satışın Maya Dəyəri (701)                                     
                                                               = ÜMUMİ MƏNFƏƏT (Gross Profit)
Kommersiya Xərcləri (711)
İnzibati Xərclər (721)
Sair Əməliyyat Xərcləri (731)
Sair Əməliyyat Gəlirləri (611)                                
                                                               = ƏMƏLİYYAT MƏNFƏƏTİ (Operating Profit)
Maliyyə Gəlirləri (631) — məzənnə fərqi gəliri daxil
Maliyyə Xərcləri (751) — məzənnə fərqi zərəri daxil
                                                               = VERGİDƏN ƏVVƏL MƏNFƏƏT
Mənfəət Vergisi (901, 902)                                    
                                                               = XALİS MƏNFƏƏT (Sinif 8, hesab 801)
```

### 3.2. Departament üzrə P&L (Otelçilik — USALI, Fayl 2/8-ə istinad)

Fayl 8-dəki jurnal yazısı sətirlərində saxlanılan **opsional `departmentId`** sahəsindən istifadə edərək, eyni P&L strukturu **hər departament üçün ayrıca sütun** kimi təkrarlana bilər (məs. Otaq | F&B | SPA | Baş İdarəetmə) — bu, Fayl 2, Bölmə 2.3-də vəd edilən "Departament üzrə Mənfəət-Zərər" hesabatının konkret icrasıdır. Report Builder (Fayl 3) bu funksionallığı `groupBy: ['departmentId']` parametri ilə dəstəkləyir.

### 3.3. Digər Ümumi Gəlir (Other Comprehensive Income — OCI)

TaxIQ-ın hədəf müştəri profili (KOB səviyyəli istehsalat/retail/otelçilik/xidmət şirkətləri) üçün OCI maddələri (yenidənqiymətləndirmə artımı, xarici törəmə müəssisə tərcümə fərqləri) nadir haldır, lakin struktur **gələcək genişlənmə üçün hazır saxlanılır** — `financialStatementTemplates` daxilində `oci_section` adlı boş bölmə mövcuddur, ehtiyac yarandıqda doldurulacaq.

---

## 4. Kapitalda Dəyişikliklər haqqında Hesabat (Statement of Changes in Equity)

### 4.1. Struktur

Sinif 3-ün (Kapital) hər komponenti üzrə dövr ərzindəki hərəkətin **üzləşdirilməsi (reconciliation)**:

| | Nizamnamə Kapitalı (30) | Kapital Ehtiyatları (33) | Bölüşdürülməmiş Mənfəət (34) | Cəmi |
|---|---|---|---|---|
| Dövrün əvvəlinə qalıq | ... | ... | ... | ... |
| Dövrün xalis mənfəəti | | | +XXX | +XXX |
| Elan edilmiş dividendlər | | | −XXX | −XXX |
| Kapital artımı | +XXX | | | +XXX |
| Yenidənqiymətləndirmə (əgər var) | | +XXX | | +XXX |
| **Dövrün sonuna qalıq** | ... | ... | ... | ... |

Bu hesabat Fayl 8-dəki `accountBalances`-in Sinif 3 hesabları üzrə **dövr əvvəli/sonu qalıqlarının fərqi** və dövr ərzindəki müvafiq jurnal yazılarının (dividend elanı, kapital artırımı) filtrlənməsi ilə avtomatik qurulur.

---

## 5. Pul Vəsaitlərinin Hərəkəti haqqında Hesabat (Cash Flow Statement)

### 5.1. Metod Seçimi: Dolayı Metod (Indirect Method)

IAS 7 həm birbaşa (direct), həm dolayı (indirect) metodu qəbul edir. TaxIQ **dolayı metodu defolt seçir**, çünki bu, mövcud mühasibat qeydlərindən (Fayl 8) **avtomatik hesablana bilən** yeganə üsuldur (birbaşa metod ayrıca "pul əsaslı" əməliyyat kateqoriyalarının izlənməsini tələb edir ki, bu, gündəlik mühasibat işini artırardı). Bu, həm də praktikada ən geniş yayılmış üsuldur.

### 5.2. Hesablama Alqoritmi

```
Əməliyyat Fəaliyyəti:
  Xalis Mənfəət (P&L-dən)
  + Amortizasiya (qeyri-pul xərci, Fayl 8, Bölmə 5-dən)
  +/− Reallaşmamış Məzənnə Fərqi (qeyri-pul, Fayl 7, Bölmə 6.3-dən)
  −/+ Debitor Borclarındakı Dəyişiklik (21 hesabının dövr fərqi)
  −/+ Ehtiyatlardakı Dəyişiklik (20 hesabının dövr fərqi)
  +/− Kreditor Borclarındakı Dəyişiklik (53 hesabının dövr fərqi)
  = ƏMƏLİYYAT FƏALİYYƏTİNDƏN XALİS PUL VƏSAİTİ

İnvestisiya Fəaliyyəti:
  − Əsas Vəsaitlərin Alınması (Sinif 1 hesablarının artımı, Fayl 8 Fixed Assets-dən)
  + Əsas Vəsaitlərin Satışından Daxilolma (Fayl 8, Bölmə 5.4)
  = İNVESTİSİYA FƏALİYYƏTİNDƏN XALİS PUL VƏSAİTİ

Maliyyələşdirmə Fəaliyyəti:
  + Yeni Kreditlər (40/50 hesablarının artımı)
  − Kredit Ödənişləri (40/50 hesablarının azalması)
  + Kapital Qoyuluşu (30 hesabının artımı)
  − Ödənilmiş Dividendlər (34 hesabından çıxış)
  = MALİYYƏLƏŞDİRMƏ FƏALİYYƏTİNDƏN XALİS PUL VƏSAİTİ

PUL VƏSAİTLƏRİNİN XALİS DƏYİŞİKLİYİ = yuxarıdakı 3 cəminin cəmi
+ Dövrün Əvvəlinə Pul Qalığı (22 hesabı)
= DÖVRÜN SONUNA PUL QALIĞI  (Fayl 8-dəki 22 hesabının faktiki qalığı ilə YOXLANILIR)
```

Son sətir Fayl 8-in 22 saylı hesab qrupunun (Pul vəsaitləri) faktiki dövr sonu qalığı ilə **çarpaz yoxlanılır** — uyğunsuzluq aşkarlansa hesabat xəbərdarlıqla işarələnir (adətən hesablama düsturunda buraxılmış bir "qeyri-pul" maddəsinin göstəricisi olur).

---

## 6. Qeydlər (Notes to Financial Statements)

### 6.1. Uçot Siyasəti Bölməsi

```
accountingPolicyStatements/{companyId}
├── companyId: string
├── sections: [{
│     title: { az, en },
│     content: { az, en }              // sərbəst mətn, zəngin redaktor (rich text)
│   }]
└── updatedAt, updatedBy
```

Standart bölmələr (defolt mətn şablonu, Company redaktə edə bilər): "Hesabatın Hazırlanma Əsası", "Ehtiyatların Dəyərləndirilməsi" (Fayl 5-dəki seçilmiş metoda avtomatik istinad — FIFO/Weighted Average), "Əsas Vəsaitlərin Amortizasiyası" (Fayl 8-dəki seçilmiş metoda istinad), "Xarici Valyuta Əməliyyatları" (Fayl 7-yə istinad).

### 6.2. Əlavə Açıqlamalar (Avtomatik Generasiya)

- **Əsas Vəsaitlər Hərəkət Cədvəli:** açılış dəyəri, əlavələr, silinmələr, yığılmış amortizasiya, bağlanış net dəyəri (Fayl 8-in `fixedAssets`-dən avtomatik).
- **Debitor/Kreditor Yaş Analizi:** Fayl 6/7-dəki Aging Report-un təkrar istifadəsi.
- **Əlaqəli Tərəflərlə Əməliyyatlar (Related Party):** əgər Company öz törəmə/əlaqəli müəssisələrini `customers`/`vendors`-da xüsusi işarələyibsə (`isRelatedParty: true` əlavə sahə), bu əməliyyatlar ayrıca siyahılanır — IAS 24 tələbi.

---

## 7. Hesabat Generasiya Mühərriki

### 7.1. Ümumi Axın

1. İstifadəçi "Hesabat Yarat" ekranında: hesabat tipi, dövr (ay/rüb/il), **müqayisəli dövr** (IAS 1 tələbi — əvvəlki ilin eyni dövrü avtomatik təklif olunur) seçir.
2. Cloud Function `generateFinancialStatement(companyId, statementType, periodId, comparativePeriodId)` çağırılır.
3. Funksiya müvafiq `financialStatementTemplates`-i oxuyur, hər `lineItem` üçün Fayl 8-in `accountBalances`-dən məbləği toplayır (həm cari, həm müqayisəli dövr üçün).
4. Nəticə strukturlaşdırılmış JSON kimi qaytarılır, frontend-də cədvəl şəklində göstərilir (iki sütun: Cari Dövr | Əvvəlki Dövr, faiz dəyişimi ilə).

### 7.2. Format və İxrac

- **Ekranda baxış:** Montserrat şrifti ilə, rəsmi hesabat görünüşündə (başlıq: Company adı, VÖEN, hesabat dövrü, valyuta).
- **Excel İxracı:** Fayl 3-ün Universal Export Framework-ü, xüsusi "Maliyyə Hesabatı" export şablonu ilə (sətirlər arasında boşluq/qalınlıq qorunur, sadə cədvəl kimi düzülmür).
- **PDF İxracı:** Fayl 6-dakı Puppeteer mühərriki ilə, rəsmi imza/möhür sahəsi olan formada (Baş Mühasib, Rəhbər).

---

## 8. Konsolidasiya (Gələcək Genişlənmə — Şəffaf Qeyd)

Əgər gələcəkdə bir müştərinin bir neçə hüquqi Company-si (törəmə müəssisələri) TaxIQ daxilində olsa və konsolidə edilmiş maliyyə hesabatı tələb olunsa (IFRS 10 — Consolidated Financial Statements), bu, **bu 10 faylın əhatəsindən kənardadır**. Data modeli (`companies` arasında `parentCompanyId` əlavəsi ilə) gələcəkdə bunu dəstəkləyə bilər, lakin konsolidasiya məntiqi (əlaqəli tərəflərin elimə edilməsi, azlıq payı hesablanması) ayrıca layihə kimi planlaşdırılmalıdır.

---

## 9. Excel/PDF Export Nöqtələri

- [ ] Maliyyə Vəziyyəti haqqında Hesabat (Balans) — cari + müqayisəli dövr
- [ ] Mənfəət və Zərər Hesabatı — cari + müqayisəli dövr, departament kəsimi ilə (opsional)
- [ ] Kapitalda Dəyişikliklər haqqında Hesabat
- [ ] Pul Vəsaitlərinin Hərəkəti haqqında Hesabat
- [ ] Uçot Siyasəti və Qeydlər (PDF-ə əlavə bölmə kimi)
- [ ] Əsas Vəsaitlər Hərəkət Cədvəli

---

## 10. Qəbul Meyarları (Acceptance Criteria) — Modul 9

- [ ] Balans hesabatında Cəmi Aktivlər = Cəmi Kapital + Cəmi Öhdəliklər həmişə bərabərdir.
- [ ] P&L hesabatı Ümumi Mənfəət → Əməliyyat Mənfəəti → Vergidən Əvvəl Mənfəət → Xalis Mənfəət kaskadını düzgün göstərir.
- [ ] Kapitalda Dəyişikliklər Hesabatı hər komponent üçün açılış/bağlanış qalıqlarını dövr hərəkəti ilə düzgün üzləşdirir.
- [ ] Pul Vəsaitlərinin Hərəkəti Hesabatının son sətri (dövr sonu pul qalığı) Fayl 8-dəki faktiki 22 saylı hesab qalığı ilə tam üst-üstə düşür.
- [ ] Departament üzrə P&L (Otelçilik) düzgün departament kəsimi ilə işləyir.
- [ ] Müqayisəli dövr (əvvəlki il) avtomatik təklif olunur və hər iki dövr yan-yana göstərilir.
- [ ] Uçot Siyasəti bölməsi Fayl 5/7/8-dəki seçilmiş metodlara avtomatik istinad edir (əl ilə uyğunsuzluq riski aradan qalxır).
- [ ] Excel/PDF ixracları rəsmi hesabat formatına uyğundur (sadə cədvəl deyil, iyerarxik struktur qorunur).
- [ ] Hesabat şablonu (`financialStatementTemplates`) kod dəyişikliyi olmadan yenilənə bilir (IFRS 18 keçidi ssenarisi test edilir).

---

## 11. Digər Modullara İstinadlar

- Fayl 8 → bu modulun **yeganə məlumat mənbəyidir** (`chartOfAccounts`, `accountBalances`, `fixedAssets`).
- Fayl 2, Bölmə 4 (`departments`) → departament üzrə P&L üçün.
- Fayl 3 → Excel export, hesabat generasiya mühərrikinin ümumi Report Builder infrastrukturundan (metadata-driven) faydalanması.
- Fayl 5 → Ehtiyatların dəyərləndirmə metodu Uçot Siyasəti bölməsinə avtomatik əks olunur.
- Fayl 6/7 → Aging Report-lar Qeydlər bölməsində təkrar istifadə olunur; FX gain/loss Maliyyə Gəlir/Xərc sətirlərinə daxil olur.

**Növbəti fayl:** Modul 10 — HR və Əmək Haqqı (Payroll) Modulu (işə qəbul/çıxış, məzuniyyət, tabel, əmək haqqı hesablanması, ödənişlər).
