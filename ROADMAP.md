# TaxIQ — Yol Xəritəsi (çatışmayanlar)

Bu sənəd sistem analizindən çıxan boşluqları və status­larını izləyir.

## ✅ Bu iterasiyada həll olundu
- **Storage təhlükəsizliyi** — `storage.rules` artıq şirkət-əsaslıdır (əvvəl istənilən
  giriş etmiş istifadəçi bütün faylları oxuya bilirdi). Deploy: `cloud-shell-fix.sh`.
- **Excel idxal** — Tənzimləmələr → «Excel idxal»: əməkdaş, müştəri, təchizatçı,
  mal/xidmət Excel-dən yüklənir (şablon + preview + doğrulama + təkrar yoxlaması).
- **RBAC drift** — determinik `userCompanyAccess` id + qayda `exists()` yoxlaması +
  super-admin resync aləti.

## 🔴 İnfrastruktur tələb edir (Firebase Blaze planı + Functions)
Bunlar client-side həll oluna bilməz; server (Cloud Functions/Scheduler) lazımdır:
- **Planlaşdırılmış işlər** — təkrarlanan fakturalar, overdue statusu, aylıq
  amortizasiya, FX yenidənqiymətləndirmə, planlaşdırılmış workflow-lar (`cron`).
- **Server-side yoxlama** — ikili-yazı balansı, SoD, posting-rules, dövr kilidi,
  login lockout məntiqinin serverdə məcburiləşdirilməsi.
- **Bildiriş çatdırılması** — e-poçt/push/SMS (hazırda yalnız tətbiqdaxili).
- **Audit imza zənciri** — dəyişməzliyin server-tərəfi təsdiqi.

## 🟡 Funksional (planlaşdırıla bilər)
- **Vergi bəyannamələri** — ƏDV / mənfəət / muzdlu iş vergisi e-taxes formatında
  generasiya; dövlət portallarına (e-taxes, DSMF, ASAN) göndərmə/inteqrasiya.
- **Satınalma (PO)** — Satınalma Sifarişi, mal qəbulu, üçtərəfli uzlaşma.
- **Payroll** — bank toplu ödəniş faylı + işçi payslip PDF.
- **Büdcə & xərc mərkəzləri** — plan-fakt hesabatı.
- **CRM göndəriş** — kampaniya e-poçt/SMS inteqrasiyası.

## ⚙️ Keyfiyyət / DevOps
- **Testlər** — vergi/payroll, ikili-yazı, FIFO üçün unit testlər (jest/vitest yoxdur).
- **Xəta izləmə** — Sentry və ya oxşar.
- **Avtomatik backup** — planlaşdırılmış Firestore ixracı.
