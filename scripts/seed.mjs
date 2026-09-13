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
const ADMIN_PASSWORD = 'admin';

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
    modulesEnabled: [],
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
  await ensureInternalCompany(adminUid);
  await ensureCurrencies();
  console.log('\n✅ Seed tamamlandı. Giriş: admin / admin (ilk girişdə parol dəyişdirilməlidir).');
  process.exit(0);
}

main().catch((e) => { console.error('✖ Seed xətası:', e); process.exit(1); });
