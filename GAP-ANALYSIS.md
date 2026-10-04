# TaxIQ — Dərin uyğunsuzluq analizi (2 siyahı)

Mənbə: repoya yüklənmiş 3 məcəllə (**Vergi**, **Əmək**, **Gömrük**) + platformanın
mövcud kodunun sətir-sətir təhlili. Hər bənddə mümkün olduqda `fayl:sətir`
sübutu göstərilib.

İşarələr: ❌ tamamilə yox · ◐ natamam (var, amma yarımçıq) · 🔌 infrastruktur
(Blaze/dövlət API) tələb edir · 📌 sübut yoxlanıb · ❓ təsdiq tələb edir.

---

## ✅ HƏLL EDİLDİ (bu iş sessiyası)

- **Namizəd → İşçi** çevrilməsi + CV yükləmə (data-URL) — Recruitment dead-end-ləri
- **Əlavə məzuniyyət** (staj) balansa avtomatik (m.116); **məzuniyyət pulu** jurnala (m.140)
- **Overtime/gecə/bayram** mühərriki payrola qoşuldu (m.164–166)
- **Org hesabat xətti** (`managerId`) + **Ştat cədvəli** (C14)
- **Nav məntiqi** — CRM Vergidən çıxarıldı, 8 məntiqli iş sahəsi
- **Yeni logo** (adaptiv) + favicon
- **Gömrük modulu** — bütöv (bəyannamə, gömrük dəyəri, rüsum+ƏDV+aksiz, 6 rejim) [G1–G9]
- **İl bağlanışı** sihirbazı (B11) · **Mikro ×2 amortizasiya** (m.114.3-2)
- **Vergi profili** (rejim/ƏDV/kateqoriya) [A6 bayraq, B3] · **Əmlak/torpaq reyestrləri** [A8,A9]
- **Mənfəət rüblük avans** UI (m.151) · **Tabel norma yoxlaması** (m.89)
- **FS qeydləri** — subyekt kateqoriyası + audit statusu bölmələri (B9, B10)
- **Vəzifə kataloqu** — işçi formasında ştat cədvəlindən avtomatik tamamlama (#8)

Bütün kod-tərəfli gap bəndləri bağlandı. Qalan yalnız 🔌 **infrastruktur**:
e-Qaimə / e-taxes / EMAS / DSMF real göndəriş — kod hazırdır, Blaze + dövlət API
açarları + deploy müştəri tərəfindədir.

---

# SİYAHI 1 — ÇATIŞMAYANLAR (platformada tamamilə yoxdur)

## A. GÖMRÜK MƏCƏLLƏSİ — bütöv modul yoxdur ❌

Platformada **gömrük modulu ümumiyyətlə yoxdur** (`app/(dashboard)/` siyahısında
heç bir gömrük səhifəsi yoxdur). Gömrük Məcəlləsinin əsas tələbləri:

| № | Tələb | Vəziyyət | Görüləcək iş |
|---|---|---|---|
| G1 | **Gömrük bəyannaməsi (GB/İDBB)** — maddə 111 və s. (kodda 100+ istinad) | ❌ | İdxal/ixrac bəyannaməsi obyekti, sətirlər, status axını |
| G2 | **Gömrük dəyəri** (maddə ~160) — 6 qiymətləndirmə metodu | ❌ | Gömrük dəyəri hesablayıcısı (əməliyyat dəyəri + əlavələr) |
| G3 | **Gömrük ödənişləri** — gömrük rüsumu + idxal ƏDV (18%) + aksiz + yığım | ❌ | İdxalda ödəniş paketi hesablayıcısı; Vergi ilə inteqrasiya |
| G4 | **Gömrük rejimləri** — idxal, ixrac, tranzit, müvəqqəti idxal, gömrük anbarı, emal | ❌ | Rejim seçimi + hər rejimə uyğun öhdəlik/azadolma |
| G5 | **ETN/HS kodları** (Əmtəə Nomenklaturası) | ❌ | HS kod kataloqu + məhsula bağlama (fəaliyyət kodlarına bənzər) |
| G6 | **Müvəqqəti idxal** (maddə ~190) — qismən ödəniş rejimi | ❌ | Müddət + qismən rüsum (aylıq 3%) izləmə |
| G7 | **Tranzit** (46 istinad) — təminat/zəmanət | ❌ | Tranzit bəyannaməsi + zəmanət məbləği |
| G8 | **Gömrük broker / nümayəndə** | ❌ | Broker rekvizitləri + vəkalət |
| G9 | **İdxal ƏDV əvəzləşdirməsi** — gömrükdə ödənilən ƏDV-nin əvəzləşməsi | ❌ | İdxal ƏDV → ƏDV depozit/əvəzləşmə registri (A2 ilə bağlı) |

> Qeyd: Gömrük rüsumu dərəcələri «Gömrük tarifi haqqında» Qanun + Nazirlər
> Kabineti qərarları ilə müəyyən olunur (məcəllədə deyil) — dərəcə cədvəli
> konfiqurasiya kimi saxlanmalıdır.

## B. VERGİ MƏCƏLLƏSİ — qalan boşluqlar

| № | Tələb | Vəziyyət | Görüləcək iş |
|---|---|---|---|
| A2 | **ƏDV depozit subhesabı + əvəzləşmə registri** (m.175, 177-179) | ❌ | 226/521 ƏDV depozit subledger, əvəzləşən/əvəzləşməyən ayrımı |
| A10 | **Aksizlər** (m.182-192) | ❌ | Aksizli mallar siyahısı + aksiz hesablama (gömrük G3 ilə əlaqəli) |
| — | **Torpaq vergisi zona tarif cədvəli** (m.206-210) | ◐ | Mühərrik var (`landTax`), amma zona/kateqoriya tarif cədvəli yox |
| — | **Əmlak/torpaq vergisi registrləri** | ❌ | Əsas vəsait→əmlak vergisi və torpaq sahəsi reyestri (hesablama var, uçot yox) |

## C. MÜHASİBAT UÇOTU — qalan boşluqlar

| № | Tələb | Vəziyyət | Görüləcək iş |
|---|---|---|---|
| B3 | **Subyekt kateqoriyası → uçot standartı** (mikro/kiçik/orta/iri/ictimai) | ❌ | Şirkətə kateqoriya + müvafiq hesabat dəsti (tam IFRS / KOM / sadələşdirilmiş) |
| B8 | **Sənədlərin saxlanma müddəti (5 il)** | ❌ | DMS-də arxiv/müddət siyasəti + bitmə xəbərdarlığı |
| B9 | **Hesabatlara qeydlər (notes to FS) + uçot siyasəti** | ❌ | Qeydlər bölməsi + uçot siyasəti açıqlaması |
| B10 | **Audit tələbi (ictimai əhəmiyyətli subyektlər)** | ❌ | Audit bayrağı + hesabatda audit statusu |
| B11 | **İl bağlanışı jurnalı** (601/7xx→341→344) | ❌ | Dövr/il bağlanışı sihirbazı (təhlükəsiz: təklif göstər, avtomatik post etmə) |
| B7 | **Maliyyə hesabatlarının təqdim tarixi** | ◐ | Vergi təqvimində illik tarix var; ayrıca FS təqdim xatırlatması yox |

## D. ƏMƏK MƏCƏLLƏSİ — qalan boşluqlar

| № | Tələb | Vəziyyət | Görüləcək iş |
|---|---|---|---|
| C14 | **Ştat cədvəli (штатное расписание)** | ❌ | Vəzifə + say + maaş dərəcəsi reyestri (kodda heç bir istinad yoxdur 📌) |
| C8 | **İş vaxtı normaları ilə tabel yoxlaması** | ◐ | Normalar `AZ_LABOUR_RULES`-da var; tabellə avtomatik müqayisə yox |
| C1 | **EMAS — əmək müqaviləsi real bildirişi** 🔌 | ◐ | Yalnız əl ilə bayraq+nömrə (`employees-tab.tsx:214`); real e-gov göndəriş yox |
| — | **DSMF müavinətləri** (analıq, uşağa qulluq) hesablanması | ❌ | Sosial sığorta müavinətləri DSMF bazası ilə hesablanmır |

---

# SİYAHI 2 — NATAMAM (var, amma yarımçıq / dead-end axınlar)

## 1. Təşkilati struktur (`org/page.tsx`) ◐ 📌
- **Yalnız oxunur** — şöbə→işçi ağacı; redaktə yox, çıxış (export/çap) yox.
- **Rəhbərlik xətti yoxdur** — `Employee`-də `managerId`/`reportsTo` yoxdur, ona
  görə «kim kimə hesabat verir» qurulmur; yalnız `departmentId` üzrə qruplaşma var.
- **Vəzifə kataloqu yox** — `position` sərbəst mətndir (`employees-tab.tsx:204`).
- **Ştat cədvəli ilə müqayisə yox** — faktiki say vs təsdiqlənmiş say göstərilmir.

## 2. İşə qəbul (`recruitment/page.tsx`) ◐ 📌
- **«İşə götürüldü» namizəd işçiyə çevrilmir** — `setCandidateStage('hired')` yalnız
  statusu dəyişir; `createEmployee` çağırılmır (axın dead-end).
- **CV yüklənmir** — `resumeUrl: null` həmişə sabit (`:183`); fayl input yoxdur.
- **Vakansiya doldurulması struktura bağlanmır** — `status:'filled'` ştat cədvəli və
  ya headcount azalması ilə əlaqələnmir.
- **Müsahibə təqvimi / təklif məktubu yoxdur** — mərhələlər var, amma planlaşdırma yox.

## 3. e-Qaimə & e-taxes (`sales.ts:239`, `tax/page.tsx`) ◐ 🔌 📌
- **Yalnız işarələmə** — `markEInvoiceSubmitted` sadəcə bayraq + STS nömrəsini əl ilə
  yazır; real STS/e-taxes göndərişi yoxdur.
- **XML ixrac var, ötürülmə yox** — `lib/tax/xml.ts` fayl yaradır, amma XSD təsdiqi
  və birbaşa təqdimat yoxdur.

## 4. Fayl/sənəd yükləmələri (DMS, `files`, CV, qoşmalar) ◐ 🔌 📌
- **Firebase Storage-dan asılıdır** (`storage.ts` `uploadFile`) — loqo data-URL-a
  keçirildi, amma qalan yükləmələr Storage-dadır; səhv konfiqurasiyada «sonsuz
  fırlanma» riski (loqo ilə eyni kök səbəb) deployed mühitdə qalır.

## 5. Əmək haqqı (`payroll`, `hr.ts`) ◐ 📌
- **Overtime/gecə/bayram mühərriki payrola qoşulmayıb** — Faza 1-də
  `overtimePay`/`nightPremium`/`holidayWorkPay` funksiyaları var, amma
  `calculatePayrollRun` yalnız xam `overtimePay` rəqəmini `PayrollAdjustment`-dən
  alır (`hr.ts`); avtomatik saatdan hesablama UI-da yoxdur.
- **Məzuniyyət pulu jurnal/payrola avtomatik düşmür** — `calcEmployeeLeavePay`
  hesablayır, amma jurnal yazısı və ya payrol sətri yaratmır.
- **DSMF e-bəyannaməsi yalnız ixracdır** — real göndəriş yox (🔌).

## 6. Məzuniyyət (`hr.ts`, `calculators-tab.tsx`) ◐ 📌
- **Əlavə məzuniyyət günləri balansa avtomatik düşmür** — kalkulyatorda
  `totalLeaveEntitlement` hesablanır, amma `LeaveBalance`-a staj/uşaq əlavəsi
  avtomatik yazılmır (`ensureLeaveBalance` yalnız `defaultDays` istifadə edir).

## 7. Sadələşdirilmiş vergi (`az-taxes.ts`, kalkulyator) ◐ 📌
- **Şirkətdə rejim bayrağı yoxdur** — `simplifiedTax` kalkulyator işləyir, amma
  şirkət profilində «sadələşdirilmiş ödəyici» bayrağı yoxdur; Vergi↔sadələşdirilmiş
  keçid və bəyannamə generasiyası yoxdur (yalnız təqvim profilində manual seçim).

## 8. Əmlak/torpaq vergisi ◐ 📌
- Hesablama mühərriki (`propertyTax`, `landTax`) və kalkulyatorlar var, amma
  **əsas vəsaitlərdən avtomatik əmlak vergisi bazası** və **torpaq sahəsi reyestri**
  yoxdur; bəyannamə və jurnal inteqrasiyası yoxdur.

## 9. Amortizasiya (`automation`, `accounting.ts`) ◐ ❓
- **Mikro ×2 əmsalı qoşulmayıb** — `microDepreciationRate` (m.114.3-2) mühərrikdə
  var, amma `runDepreciation` onu tətbiq etmir.
- **Vergi vs mühasibat amortizasiyası paralel aparılmır** — yalnız bir norma izlənir.

## 10. CRM (`crm/*`) ✅ (tam — qeyd)
- Lead → Müştəri və Lead → Opportunity çevrilməsi **tam qurulub**
  (`crm.ts:132/150` + `leads-tab.tsx:74/237`). Bu bənd analiz zamanı yoxlanıb və
  natamam DEYİL — siyahıda şəffaflıq üçün saxlanılır.

## 11. Büdcə (`budget`) ◐ ❓
- Aylıq/şöbə plan vs faktiki IFRS-dən gəlir, amma **kənarlaşma xəbərdarlığı /
  təsdiqi** yoxdur.

## 12. Konsolidasiya (`consolidated`) ◐ ❓
- Qrup hesabatı var, amma **şirkətlərarası (intercompany) eliminasiya** tam deyil —
  təsdiq tələb edir.

## 13. Vergi bəyannamələri — mənfəət rüblük avans ◐
- `profitAdvancePriorYear` mühərrikdə var, amma **Vergi səhifəsində rüblük avans
  cədvəli/bəyannaməsi** UI-da göstərilmir.

## 14. Tapşırıqlar / İş axını (`tasks`, `workflow`) ◐ ❓
- İş axını builder + test var, amma **tətbiq triggerləri məhdud**, SoD qismən;
  tapşırıqlar sənəd/təsdiqlərlə tam bağlanmır — təsdiq tələb edir.

---

## İcra prioriteti (tövsiyə)

1. **Dead-end axınları bağla (tez qazanc):** namizəd→işçi, CV yükləmə (data-URL),
   əlavə məzuniyyətin balansa düşməsi, overtime mühərrikinin payrola qoşulması.
2. **Ştat cədvəli + org `managerId`** — HR nüvəsini tamamlayır (C14 + org chart).
3. **Gömrük modulu** — bəyannamə + gömrük dəyəri + idxal ƏDV/aksiz (Vergi ilə).
4. **Mühasibat tamamlama:** il bağlanışı, FS qeydləri, subyekt kateqoriyası, arxiv.
5. **İnfrastruktur (🔌):** e-Qaimə/e-taxes/EMAS real göndəriş, Storage əvəzinə
   etibarlı yükləmə — Blaze + API, deploy müştəridə.
