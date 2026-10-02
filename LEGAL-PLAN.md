# TaxIQ — Qanunvericiliyə uyğunluq planı (Vergi + Mühasibatlıq + Əmək)

Mənbə: Azərbaycan Respublikasının 3 əsas məcəlləsi/qanunu
(e-qanun.az/framework/46943, 46948, 46957):
**Vergi Məcəlləsi**, **Mühasibat uçotu haqqında Qanun**, **Əmək Məcəlləsi**.

> Qeyd: dərəcələr, həddlər və müddətlər tez-tez dəyişir — bütün rəqəmlər
> kodda sabit deyil, **konfiqurasiya** kimi saxlanılır və istehsalatdan əvvəl
> taxes.gov.az / DSMF / dövlət mənbələrindən təsdiqlənməlidir.

Status: ✅ var · ⚠️ qismən var · ❌ yoxdur (qurulacaq)

---

## A. VERGİ MƏCƏLLƏSİ — «Vergi: hamısı»

| № | Tələb / proses | Status | Görüləcək iş |
|---|---|---|---|
| A1 | **ƏDV (18%)** — hesablama, bəyannamə, sətir-registr | ✅ | — (XML ixrac da əlavə olundu) |
| A2 | **ƏDV əvəzləşdirmə + ƏDV depozit subhesabı (maddə 175, 177-179)** | ⚠️ | 226/521 ƏDV depozit subledger, əvəzləşdirilən/əvəzləşdirilməyən ayrımı |
| A3 | **Mənfəət vergisi (20%)** — illik | ✅ | — |
| A4 | **Mənfəət vergisi — rüblük cari ödənişlər (avans)** | ❌ | Rüblük avans hesablama (əvvəlki il / cari dövriyyə metodu) + cədvəl |
| A5 | **Gəlir vergisi (muzdlu iş, 14%/25%, 2500 həddi)** | ✅ | — (payroll-da) |
| A6 | **Sadələşdirilmiş vergi (dövriyyədən 2%, maddə 218-220)** | ❌ | Sadələşdirilmiş vergi rejimi: dövriyyə×2%, bəyannamə, rejim seçimi |
| A7 | **Ödəmə mənbəyində vergi — dividend/faiz/icarə/qeyri-rezident (maddə 123-125)** | ⚠️ | Muzdlu işdən başqa withholding (dividend 10%, icarə 14%, qeyri-rezident) |
| A8 | **Əmlak vergisi (hüquqi şəxs, 1%, maddə 197-200)** | ❌ | Əsas vəsaitlərin orta illik dəyərindən əmlak vergisi + bəyannamə |
| A9 | **Torpaq vergisi (maddə 206-210)** | ❌ | Torpaq sahəsi uçotu + vergi hesablama |
| A10 | **Aksizlər (maddə 182-192)** | ❌ | Aksizli mallar üçün aksiz hesablama (sahəyə bağlı, opsional) |
| A11 | **Mikro/kiçik sahibkar güzəştləri (maddə 102.1.30, 106 — mikro 75% azadolma)** | ❌ | Subyekt statusu → mənfəət/gəlir vergisi güzəşti tətbiqi |
| A12 | **ƏDV qeydiyyatı həddi (200.000 AZN) — məcburi/könüllü** | ❌ | 12 aylıq dövriyyə izləmə + qeydiyyat həddi xəbərdarlığı |
| A13 | **e-Qaimə-faktura (STS e-qaimə)** | ⚠️ | Tam axın: e-qaimə nömrəsi, status, XML/formatı (göndəriş infra tələb edir) |
| A14 | **Vergi təqvimi — bəyannamə/ödəniş müddətləri (maddə 149, 151 və s.)** | ❌ | Vergi təqvimi + son tarix xatırlatmaları (hər vergi növü üzrə) |
| A15 | **Cərimə və faizlər (maddə 57-59)** | ❌ | Gecikmə faizi (0.1%/gün) və cərimə hesablayıcısı |
| A16 | **Vergi öhdəlikləri icmalı (vahid hesab)** | ❌ | Şirkət üzrə bütün vergilər üzrə hesablanmış/ödənilmiş icmal paneli |

---

## B. MÜHASİBAT UÇOTU HAQQINDA QANUN — «Mühasibatlıq: hamısı»

| № | Tələb / proses | Status | Görüləcək iş |
|---|---|---|---|
| B1 | **İkili yazılış + Hesablar Planı** | ✅ | — |
| B2 | **Maliyyə hesabatları: Balans, M-Z, Pul vəsaiti, Kapital, Qeydlər** | ✅ | — (IFRS engine) |
| B3 | **Subyekt kateqoriyası → uçot standartı seçimi (ictimai/iri/orta/kiçik/mikro)** | ❌ | Kateqoriya təyini + müvafiq hesabat dəsti (tam IFRS / KOM-IFRS / sadələşdirilmiş) |
| B4 | **İlkin sənədlərin məcburi rekvizitləri (maddə 9)** | ⚠️ | Rekvizit yoxlaması (ad, tarix, №, tərəflər, məbləğ, imza) bütün sənədlərdə |
| B5 | **İnventarizasiya (maddə)** | ✅ | — (stocktake) |
| B6 | **Əsas vəsait + amortizasiya (m.114) + qeyri-maddi aktivlər** | ✅ | — |
| B7 | **Maliyyə hesabatlarının təqdim müddəti (illik, dövlət orqanına)** | ❌ | Hesabat təqvimi + son tarix xatırlatması |
| B8 | **Sənədlərin saxlanma müddəti (5 il)** | ⚠️ | DMS-də saxlama siyasəti + arxiv/müddət etiketi |
| B9 | **Hesabatlara qeydlər (notes to FS) — uçot siyasəti açıqlaması** | ⚠️ | Qeydlər bölməsinin genişləndirilməsi (uçot siyasəti, bölgülər) |
| B10 | **Audit tələbi (ictimai əhəmiyyətli subyektlər)** | ❌ | Audit bayrağı + hesabatda audit statusu |
| B11 | **Dövrün bağlanması (ay/il) + yenidən açılış qadağası** | ⚠️ | Dövr kilidi (mövcud) + il bağlanışı jurnalı (601→341 və s.) |

---

## C. ƏMƏK MƏCƏLLƏSİ — «HR: məzuniyyət, əmək haqqı və s. hamısı»

| № | Tələb / proses | Status | Görüləcək iş |
|---|---|---|---|
| C1 | **Əmək müqaviləsi — məcburi şərtlər (maddə 43)** | ⚠️ | Məcburi rekvizitlər + EMAS bildiriş formatı (göndəriş infra) |
| C2 | **Əmək haqqı — min. əmək haqqı, ayda ≥1 ödəniş, hesablaşma vərəqi** | ✅ | Payslip var; min. əmək haqqı yoxlaması əlavə |
| C3 | **Gəlir vergisi + DSMF (sosial 3%/22%, işsizlik 0.5%/0.5%, tibbi 2%/0.5%)** | ✅ | — (konfiqurasiya) |
| C4 | **Əsas məzuniyyət — 21 gün (bəzi hallarda 30)** | ✅ | — |
| C5 | **Əlavə məzuniyyət — iş stajına görə (5/10/15 il → +2/4/6 gün, maddə 116)** | ❌ | Stajdan avtomatik əlavə gün hesablanması |
| C6 | **Sosial məzuniyyətlər — analıq (126 g), uşağa qulluq (3 yaş), tədris** | ⚠️ | Analıq var; uşağa qulluq + tədris + ödənişsiz tam dəst |
| C7 | **Məzuniyyət pulu — orta əmək haqqı (son 12 ay) × günlər** | ❌ | **Orta əmək haqqı mühərriki** + məzuniyyət pulu avtomatik hesablanması |
| C8 | **İş vaxtı — 40 saat/həftə, gündəlik norma, nahar** | ⚠️ | İş vaxtı normaları + tabellə yoxlama |
| C9 | **İş vaxtından artıq (2x), gecə işi (+ əlavə), bayram/istirahət işi (2x)** | ❌ | Overtime/gecə/bayram üstəlik avtomatik hesablanması |
| C10 | **Əmək müqaviləsinə xitam — əsaslar + kompensasiya (maddə 68-77, 77)** | ❌ | Xitam əmri + işdənçıxma müavinəti/kompensasiya hesablanması |
| C11 | **İşçi əmrləri — işə qəbul, xitam, məzuniyyət, ezamiyyət, intizam** | ✅ | — (orders var; intizam/xitam şablonları əlavə) |
| C12 | **Şəxsi iş (personnel file), iş kitabçası məlumatları** | ⚠️ | Şəxsi iş toplusu (sənədlər + əmrlər + müqavilə bir yerdə) |
| C13 | **Tabel (T-13) + davamiyyət** | ✅ | — |
| C14 | **Ştat cədvəli (штатное расписание)** | ❌ | Ştat cədvəli: vəzifə, say, maaş dərəcəsi |
| C15 | **Minimum əmək haqqı / yaşayış minimumu yoxlaması** | ⚠️ | Maaş < min. əmək haqqı xəbərdarlığı |

---

## İCRA PLANI (fazalar)

### Faza 1 — Əmək haqqı & məzuniyyət mühərriki (Əmək Məcəlləsi nüvəsi)
1. **Orta əmək haqqı mühərriki** (son 12 ay) — məzuniyyət pulu, ezamiyyət, xitam kompensasiyası üçün (C7).
2. **Məzuniyyət pulu** avtomatik hesablanması + payrolla inteqrasiya (C7).
3. **Staj-əsaslı əlavə məzuniyyət** (C5) + sosial məzuniyyət növlərinin tam dəsti (C6).
4. **Overtime / gecə / bayram üstəlikləri** (C9) + iş vaxtı normaları (C8).
5. **Xitam + işdənçıxma kompensasiyası** (C10), ştat cədvəli (C14), min. əmək haqqı yoxlaması (C2/C15).

### Faza 2 — Vergi rejimləri və registrlər (Vergi Məcəlləsi)
6. **Sadələşdirilmiş vergi** rejimi (2%) + bəyannamə (A6).
7. **Mikro/kiçik sahibkar güzəştləri** + subyekt statusu (A11, B3).
8. **ƏDV depozit subledger + əvəzləşdirmə** (A2); ƏDV qeydiyyatı həddi izləmə (A12).
9. **Əmlak və torpaq vergisi** (A8, A9); mənfəət vergisi rüblük avans (A4).
10. **Genişləndirilmiş withholding** (dividend/icarə/qeyri-rezident) (A7).

### Faza 3 — Təqvim, icmal və uyğunluq
11. **Vahid vergi təqvimi + xatırlatmalar** (bütün bəyannamə/ödəniş son tarixləri) (A14, B7).
12. **Vergi öhdəlikləri icmal paneli** + cərimə/faiz hesablayıcısı (A15, A16).
13. **İlkin sənəd rekvizit yoxlaması** (B4), **sənəd saxlama siyasəti** (B8), **hesabat qeydləri** (B9).
14. **İl bağlanışı** jurnalı + audit bayrağı (B10, B11).

### Faza 4 — İnfrastruktur (Blaze + API; kod hazırlanır, deploy müştəridə)
15. e-Qaimə & e-taxes XML **birbaşa göndərmə** (A13), EMAS əmək müqaviləsi bildirişi (C1).
16. Cloud Functions **avtomatik cədvəl** (vergi/hesabat son tarix xatırlatmaları, aylıq amortizasiya).

---

## İlk başlanğıc (bu plandan sonra)
Faza 1-dən başlayıram: **orta əmək haqqı mühərriki + məzuniyyət pulu** (Əmək
Məcəlləsinin ən çox istifadə olunan, hazırda çatışmayan hissəsi), sonra
addım-addım yuxarıdakı ardıcıllıqla.
