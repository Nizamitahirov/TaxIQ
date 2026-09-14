# TaxIQ — Web-App Redizayn Planı

> Məqsəd: TaxIQ-i "səhifələr toplusu"ndan **vahid, davamlı iş mühiti (application shell)** olan
> tam ERP web-tətbiqinə çevirmək. Bu sənəd cari vəziyyəti təhlil edir, məntiq boşluqlarını
> challenge edir və mərhələli redizayn yol xəritəsini müəyyən edir.

Status: **canlı sənəd** · Sahib: Platform komandası · Dil: AZ (UI), sənəd AZ

---

## 1. Prinsiplər (Web-app məntiqi)

1. **Davamlı shell, dəyişən məzmun** — naviqasiya, kontekst (şirkət/dövr), axtarış və
   bildirişlər səhifə keçidlərində *itmir*; yalnız mərkəz paneli dəyişir.
2. **İki səviyyəli naviqasiya** — dar **Area Rail** (5 iş sahəsi ikonları) + kontekstual
   **Sidebar** (aktiv sahənin modulları). Bu, ERP-lərin standart pattern-idir (Linear/Notion/Odoo).
3. **Klaviatura-birinci** — `⌘K`/`Ctrl+K` komanda paneli hər yerə keçid + əməliyyat; `g` prefiksli
   naviqasiya qısayolları.
4. **Kontekst həmişə görünür** — aktiv şirkət, hesabat dövrü, istifadəçi rolu top bar-da sabit.
5. **Əməliyyat, səhifə deyil** — sıx istifadə olunan yaratma/redaktə əməliyyatları **drawer/modal**
   ilə açılır; naviqasiya kontekstini itirmir.
6. **Vahid səhifə şablonu** — hər modul eyni `AppPage` skeleti (başlıq + breadcrumb + əməliyyatlar +
   tablar + məzmun) istifadə edir; vizual tutarlılıq.
7. **Vəziyyətlər birinci sinifdir** — loading / empty / error / no-permission halları hər ekranda
   eyni komponentlərlə.
8. **Cross-modul əlaqə** — sənədlər bir-birinə keçid verir (faktura → müştəri → jurnal yazısı → ödəniş).

---

## 2. Cari vəziyyət (nə var)

- **Shell**: sabit sol `Sidebar` (qruplaşdırılmış nav) + `Topbar` (şirkət switcher, tema, dil,
  bildiriş zəngi, profil menyusu).
- **Hub**: `/launch` — 5 rəngli sahə bloku + profil ring + kiçik task management (sidebarsız).
- **Sahə məntiqi**: nav elementləri `area` ilə teqlənib; modula girəndə sidebar həmin sahəyə filtrlənir.
- **Modullar**: 1–10 tam (auth/RBAC, onboarding, dashboard/report, workflow, anbar, satış, xəzinə,
  mühasibat, IFRS, HR/payroll). Hər səhifə `PageHeader` + `Tabs` istifadə edir.
- **Dizayn sistemi**: periwinkle `#5B5BF5` primary, Montserrat, yumşaq kölgələr, 12px radius,
  light/dark, AZ/EN.

---

## 3. Məntiq boşluqları — challenge

| # | Boşluq | Nəticə | Həll |
|---|--------|--------|------|
| G1 | Modul içindən **sahələr arası sürətli keçid yoxdur** (yalnız sidebar "Bölmələr" linki) | naviqasiya yavaş | **Area Rail** — sabit dar ikon zolağı, bir kliklə sahə dəyişimi |
| G2 | **Komanda paneli yoxdur** (⌘K) | hər şeyə mouse ilə çatmaq | Global `CommandPalette`: naviqasiya + yaratma + axtarış |
| G3 | **Global axtarış yoxdur** | müştəri/faktura/hesab tapmaq üçün modula girmək lazımdır | ⌘K daxilində entity axtarışı (faza 2) |
| G4 | **Breadcrumb yoxdur** | dərin səhifələrdə yer itir | Top bar-da breadcrumb (Sahə → Modul → Alt-səhifə) |
| G5 | **Qlobal "Yarat" (+) yoxdur** | yeni sənəd üçün modula getmək | Top bar-da kontekst-həssas `Create` menyusu |
| G6 | **Bildiriş + təsdiq (approval) inbox** birləşməyib | təsdiq tapşırıqları görünmür | Bildiriş panelində approval tapşırıqları + badge |
| G7 | **Hesabat dövrü konteksti yoxdur** | hansı dövrdəyik bilinmir | Top bar-da dövr seçici (il/ay), qlobal kontekst |
| G8 | **Səhifə şablonu qeyri-tutarlı** | hər səhifə fərqli başlıq/tab strukturu | Vahid `AppPage` komponenti |
| G9 | **Empty/loading vəziyyətləri qeyri-tutarlı** | ilk istifadə qarışıq | Standart `EmptyState`/`LoadingState`/`Forbidden` |
| G10 | **Alış (Procurement) satışın kölgəsində** — purchaseBills xəzinədə | ERP məntiqi zəif | Alış-ı öz konseptual yerində qrupla (Vergi uçotu sahəsi), sənəd axını aydınlaşdır |
| G11 | **Cross-modul keçid azdır** | faktura↔müştəri↔jurnal əlaqəsi əl ilə | Sənəd kartlarında əlaqəli obyektlərə linklər |
| G12 | **Klaviatura qısayolları yoxdur** | güc-istifadəçi üçün yavaş | `g d` (dashboard), `g s` (satış), `⌘K`, `?` (kömək) |
| G13 | **Mobil naviqasiya yalnız hamburger** | area rail mobil yoxdur | Mobil: alt tab-bar (sahələr) + hamburger (modul) |

---

## 4. Hədəf İnformasiya Arxitekturası

```
App Shell
├── Area Rail (dar, sabit, sol)        ← Hub, Dashboard, + 5 sahə ikonu, aşağıda profil/tənzimləmə
├── Sidebar (kontekstual, sol)          ← aktiv sahənin modulları (rail seçiminə görə)
├── Top Bar (sabit, üst)
│   ├── Breadcrumb (Sahə → Modul → Səhifə)
│   ├── Global Search / ⌘K açar
│   ├── Company Switcher · Period seçici
│   └── Create (+) · Theme · Dil · Bildiriş · Profil
└── Main (dəyişən məzmun)
    └── AppPage: başlıq + əməliyyatlar + tablar + məzmun
```

**Sahələr (Area) → modullar:**

- **Vergi uçotu** — Satış, Alış, Anbar, Kassa/Bank
- **Mühasibat uçotu** — Hesablar planı, Jurnal, Yoxlama balansı, Dövrlər, Əsas vəsaitlər, Posting qaydaları
- **Kadr uçotu** — İşçilər, Məzuniyyət/Tabel, Əmək haqqı
- **Maliyyə hesabatları** — IFRS hesabatlar, Hesabat qurucusu
- **Tənzimləmələr** — Şirkətlər, İstifadəçilər, Rollar, Workflow, Audit, Parametrlər

---

## 5. Komponent spesifikasiyaları

### 5.1 Area Rail (`components/layout/area-rail.tsx`)
- Genişlik ~64px; sabit; yuxarıda TaxIQ nişanı → Hub (`/launch`).
- Element: Dashboard + 5 sahə ikonu (aktiv sahə vurğulanır, gradient ilə).
- Aşağıda: profil avatarı (menyu), tənzimləmə.
- Tooltip ilə etiketlər; mobil-də gizli (alt tab-bar əvəz edir).

### 5.2 Command Palette (`components/shell/command-palette.tsx`)
- `⌘K`/`Ctrl+K` açır; fuzzy axtarış.
- Bölmələr: **Naviqasiya** (bütün icazəli səhifələr), **Yarat** (yeni faktura/işçi/jurnal…),
  **Sahələr**, (faza 2) **Nəticələr** (müştəri/faktura axtarışı).
- Klaviatura ilə tam idarə (↑↓ Enter Esc).

### 5.3 Breadcrumbs (`components/shell/breadcrumbs.tsx`)
- Path-dən avtomatik: sahə etiketi → modul etiketi → (alt-səhifə).
- Hər səviyyə klik oluna bilir.

### 5.4 Create menu (`components/shell/create-menu.tsx`)
- Kontekst-həssas: aktiv sahə/modula görə ən uyğun yaratma əməliyyatları üstdə.
- İcazə ilə filtrlənir.

### 5.5 AppPage (`components/shared/app-page.tsx`)
- Props: `title`, `breadcrumb?`, `actions?`, `tabs?`, `children`.
- Bütün modul səhifələri buna keçir (mərhələli).

### 5.6 Period Context (`components/providers/period-provider.tsx`)
- Qlobal seçilmiş il/ay; IFRS, dashboard, hesabatlar oradan oxuyur.

---

## 6. Klaviatura qısayolları

| Qısayol | Əməliyyat |
|---------|-----------|
| `⌘K` / `Ctrl K` | Komanda paneli |
| `g` sonra `d` | Dashboard |
| `g` sonra `h` | Hub (Bölmələr) |
| `g` sonra `s` | Satış · `a` Anbar · `m` Mühasibat · `k` Kadrlar · `r` Hesabatlar |
| `c` | Kontekst-yaratma (Create) |
| `?` | Qısayol kömək paneli |

---

## 7. Vəziyyət komponentləri

- `LoadingState` — mərkəzləşdirilmiş spinner + skelet.
- `EmptyState` — ikon + başlıq + təsvir + (opsional) CTA.
- `Forbidden` — icazə yoxdur, hansı icazə lazım olduğunu göstərir.
- `ErrorState` — xəta + "yenidən cəhd".

---

## 8. Mərhələli yol xəritəsi

- **Faza 1 (bu redizayn)** — App shell: Area Rail + kontekstual Sidebar, Command Palette (⌘K),
  Breadcrumbs, Create menyusu, klaviatura qısayolları, top bar yenilənməsi. Launcher hub saxlanılır.
- **Faza 2** — Global entity axtarışı (⌘K nəticələri), Period context bar, Approvals inbox
  bildiriş panelində, cross-modul keçid linkləri.
- **Faza 3** — Detail drawer pattern-i (sənəd redaktəsi modal/drawer), saved views (cədvəl
  filtrləri), sıxlıq (density) tənzimləməsi, mobil alt tab-bar.
- **Faza 4** — Onboarding tur, boş-şirkət ilk-qurulma sihirbazı shell-də, in-app kömək (`?`).

---

## 9. Qeyri-funksional

- **Performans**: shell komponentləri client-side, kod-bölünmə; ağır sorğular TanStack Query cache.
- **Əlçatanlıq**: fokus idarəsi (palette/drawer), ARIA, klaviatura tam dəstəyi.
- **Tema**: bütün yeni komponentlər light/dark token-lərdən istifadə edir (hardcoded rəng yox, sahə
  gradient-ləri istisna).
- **Server-siz**: bütün redizayn tamamilə client-side; Cloud Functions tələb etmir (mövcud arxitektura).
