#!/usr/bin/env node
/**
 * TaxIQ — ilkin seed skripti (01 §3.2).
 *
 * Nə edir:
 *   1. Bootstrap Platform Super Admin yaradır: admin@taxiq.system / admin
 *      (mustChangePassword: true — ilk girişdə parol dəyişikliyi məcburi)
 *   2. Company #1 — TaxIQ-ın öz daxili şirkəti (isInternal: true)
 *   3. Qlobal valyutalar (AZN, USD, EUR, TRY, RUB)
 *
 * İstifadə:
 *   GOOGLE_APPLICATION_CREDENTIALS=./taxiq-service-account.json node scripts/seed.mjs
 *   (və ya service account JSON yolunu SERVICE_ACCOUNT env dəyişəni ilə ver)
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'taxiq-f2d9d';
const ADMIN_EMAIL = 'admin@taxiq.system';
// Firebase Auth minimum 6 simvol parol tələb edir ('admin' 5 simvol qəbul olunmur).
// mustChangePassword: true — istifadəçi ilk girişdə onsuz da dəyişməlidir.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function loadCredential() {
  const path = process.env.SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) {
    console.error('✖ Service account tapılmadı. GOOGLE_APPLICATION_CREDENTIALS və ya SERVICE_ACCOUNT təyin edin.');
    process.exit(1);
  }
  return cert(JSON.parse(readFileSync(path, 'utf8')));
}

initializeApp({ credential: loadCredential(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

async function ensureAdminUser() {
  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log('• Admin auth hesabı artıq var:', user.uid);
  } catch {
    user = await auth.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: 'Platform Admin' });
    console.log('✓ Admin auth hesabı yaradıldı:', user.uid);
  }
  // Custom claims — 01 §2.6
  await auth.setCustomUserClaims(user.uid, {
    userType: 'platform_super_admin',
    platformRole: 'platform_super_admin',
    mustChangePassword: true,
  });
  // Firestore profili
  await db.collection('users').doc(user.uid).set({
    email: ADMIN_EMAIL,
    displayName: 'Platform Admin',
    userType: 'platform_super_admin',
    status: 'active',
    mustChangePassword: true,
    temporaryPasswordIssuedAt: FieldValue.serverTimestamp(),
    homeCompanyId: null,
    accessibleCompanyIds: [],
    preferredLanguage: 'az',
    preferredTheme: 'system',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✓ Admin profili (users/' + user.uid + ') yazıldı');
  return user.uid;
}

async function ensureInternalCompany(adminUid) {
  const ref = db.collection('companies').doc('taxiq-internal');
  const snap = await ref.get();
  if (snap.exists) { console.log('• Daxili şirkət artıq var'); return ref.id; }
  await ref.set({
    name: 'TaxIQ Consulting MMC',
    legalName: 'TaxIQ Consulting MMC',
    taxId: '',
    sector: 'services',
    isInternal: true,
    status: 'active',
    baseCurrency: 'AZN',
    settings: { theme: 'system', language: 'az', fiscalYearStartMonth: 1 },
    // Daxili şirkət (konsaltinq firması özü) bütün modullardan istifadə edir
    modulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    createdBy: adminUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('✓ Company #1 (TaxIQ daxili) yaradıldı');
  return ref.id;
}

async function ensureCurrencies() {
  const currencies = [
    { isoCode: 'AZN', name: { az: 'Azərbaycan manatı', en: 'Azerbaijani manat' }, symbol: '₼', decimalPlaces: 2, isActive: true },
    { isoCode: 'USD', name: { az: 'ABŞ dolları', en: 'US dollar' }, symbol: '$', decimalPlaces: 2, isActive: true },
    { isoCode: 'EUR', name: { az: 'Avro', en: 'Euro' }, symbol: '€', decimalPlaces: 2, isActive: true },
    { isoCode: 'TRY', name: { az: 'Türk lirəsi', en: 'Turkish lira' }, symbol: '₺', decimalPlaces: 2, isActive: true },
    { isoCode: 'RUB', name: { az: 'Rusiya rublu', en: 'Russian ruble' }, symbol: '₽', decimalPlaces: 2, isActive: true },
  ];
  const batch = db.batch();
  for (const c of currencies) batch.set(db.collection('currencies').doc(c.isoCode), c, { merge: true });
  await batch.commit();
  console.log('✓ Valyutalar seed edildi (' + currencies.length + ')');
}

async function main() {
  console.log('▶ TaxIQ seed başlayır — layihə:', PROJECT_ID);
  const adminUid = await ensureAdminUser();
  const companyId = await ensureInternalCompany(adminUid);
  await ensureCurrencies();
  if (process.env.SEED_DEMO === '1') await ensureDemoData(companyId, adminUid);
  console.log(`\n✅ Seed tamamlandı. Giriş: admin / ${ADMIN_PASSWORD} (ilk girişdə parol dəyişdirilməlidir).`);
  console.log('   ⚠️ Firebase Console → Authentication → Email/Password provayderi aktiv olmalıdır!');
  if (process.env.SEED_DEMO !== '1') console.log('   💡 Nümunə data üçün: SEED_DEMO=1 ilə yenidən çalışdır.');
  process.exit(0);
}

/** Opsional nümunə data (SEED_DEMO=1) — UI dərhal dolu görünsün deyə */
async function ensureDemoData(companyId, adminUid) {
  const ts = () => FieldValue.serverTimestamp();
  const exists = await db.collection('customers').where('companyId', '==', companyId).limit(1).get();
  if (!exists.empty) { console.log('• Demo data artıq var — ötürülür'); return; }

  // Vergi konfiqurasiyası (Firestore versiyası)
  await db.collection('payrollTaxConfigs').doc('cfg_2026-01-01').set({
    effectiveFrom: '2026-01-01', effectiveTo: null, minimumWage: 400,
    incomeTaxBrackets: [{ uptoAmount: 2500, rate: 0.14, fixedAmount: 0 }, { uptoAmount: null, rate: 0.25, fixedAmount: 350 }],
    socialInsurance: { employeeBaseRate: 0.03, employeeBaseThreshold: 200, employeeRateAboveThreshold: 0.10, employerRate: 0.22 },
    medicalInsurance: { employeeRateLowerBand: 0.02, lowerBandThreshold: 2500, employeeRateUpperBand: 0.005, employerRateLowerBand: 0.02, employerRateUpperBand: 0.005 },
    unemploymentInsurance: { employeeRate: 0.005, employerRate: 0.005 },
    notes: 'AZ 2026 seed — taxes.gov.az-dan təsdiqlənməlidir', createdAt: ts(),
  }, { merge: true });

  const base = { companyId, createdAt: ts(), updatedAt: ts(), createdBy: adminUid };
  await db.collection('customers').add({ ...base, type: 'legal_entity', name: 'Bakı Retail Group MMC', taxId: '1234567890', defaultCurrency: 'AZN', paymentTermDays: 30, isActive: true });
  await db.collection('vendors').add({ ...base, name: 'Anadolu Təchizat MMC', taxId: '9876543210', defaultCurrency: 'AZN', paymentTermDays: 14, isActive: true });
  await db.collection('warehouses').add({ ...base, name: { az: 'Əsas anbar', en: 'Main warehouse' }, code: 'WH1', type: 'main', isActive: true });
  await db.collection('bankAccounts').add({ ...base, bankName: 'Kapital Bank', accountName: 'Əsas AZN hesabı', iban: 'AZ00KAPI00000000000000000001', currency: 'AZN', currentBalance: 0, isActive: true });
  await db.collection('cashRegisters').add({ ...base, name: 'Baş kassa', currency: 'AZN', currentBalance: 0, isActive: true });
  await db.collection('goods').add({ ...base, type: 'good', sku: 'SKU-001', name: { az: 'Nümunə mal', en: 'Sample good' }, baseUnit: 'ədəd', trackInventory: true, defaultSalePrice: 50, defaultPurchasePrice: 30, vatRate: 18, reorderPoint: 10, isActive: true });
  await db.collection('goods').add({ ...base, type: 'service', sku: 'SRV-001', name: { az: 'Aylıq mühasibatlıq xidməti', en: 'Monthly accounting' }, baseUnit: 'ay', trackInventory: false, defaultSalePrice: 300, vatRate: 18, isActive: true });
  await db.collection('employees').add({ ...base, employeeCode: 'EMP-001', firstName: 'Əli', lastName: 'Məmmədov', position: 'Baş mühasib', baseSalary: 2000, currency: 'AZN', status: 'active', laborContractNotified: true });
  const leaveTypes = [
    { code: 'annual', name: { az: 'Əsas məzuniyyət', en: 'Annual leave' }, paid: true, defaultDays: 21 },
    { code: 'sick', name: { az: 'Xəstəlik vərəqəsi', en: 'Sick leave' }, paid: true, defaultDays: 0 },
    { code: 'unpaid', name: { az: 'Ödənişsiz məzuniyyət', en: 'Unpaid leave' }, paid: false, defaultDays: 0 },
  ];
  for (const t of leaveTypes) await db.collection('leaveTypes').add({ companyId, ...t });
  console.log('✓ Demo data seed edildi (müştəri, təchizatçı, anbar, bank, kassa, 2 mal/xidmət, işçi, məzuniyyət növləri, vergi konfiqurasiyası)');
  console.log('  Qeyd: Hesablar Planını UI-dan "Mühasibat → Hesablar Planını qur" ilə aktivləşdirin.');
}

main().catch((e) => { console.error('✖ Seed xətası:', e); process.exit(1); });
