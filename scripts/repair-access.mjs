#!/usr/bin/env node
/**
 * TaxIQ — Giriş icazələrinin bərpası (CLIENT SDK, super admin ilə).
 * Service account tələb ETMİR — mövcud super admin hesabı ilə giriş edir.
 *
 * «Missing or insufficient permissions» xətasının kök səbəbi: biznes sənədlərinə
 * yazı Firestore qaydalarında users/{uid}.accessibleCompanyIds massivinə bağlıdır.
 * Bu massiv əsl mənbə olan `userCompanyAccess` təyinatları ilə uyğunsuz düşəndə
 * (drift, köhnə data, əl ilə redaktə) yazı rədd olunur, oxu isə boş kolleksiyalarda
 * keçir. Bu skript hər ikisini yenidən uyğunlaşdırır.
 *
 * Nə edir (hamısı super admin bypass-ı ilə, artıq deploy olunmuş qaydalar altında):
 *   1. Giriş edən super admin-in ÖZ profilində userType='platform_super_admin'
 *      olduğunu təsdiqləyir (yanlışdırsa düzəldir).
 *   2. Bütün istifadəçiləri gəzir; hər biri üçün accessibleCompanyIds massivini
 *      aktiv `userCompanyAccess` sənədlərindən + client homeCompanyId-dən yenidən qurur.
 *   3. Təsadüfi id-li təyinat sənədlərini determinik id-yə (`${uid}__${companyId}`)
 *      köçürür (yeni qaydaların exists() yoxlaması üçün); köhnəni superseded edir.
 *   4. Hesabat çap edir.
 *
 * İstifadə:
 *   SEED_EMAIL=admin@taxiq.system SEED_PASSWORD='<super-admin-parol>' node scripts/repair-access.mjs
 *   (SEED_EMAIL verilməzsə admin@taxiq.system götürülür.)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

const cfg = {
  apiKey: 'AIzaSyBdmcXZHaX1A9OAGLSX7RQNEw4tbidE4MA', authDomain: 'taxiq-f2d9d.firebaseapp.com',
  projectId: 'taxiq-f2d9d', storageBucket: 'taxiq-f2d9d.firebasestorage.app',
  messagingSenderId: '6836696939', appId: '1:6836696939:web:15da6814c590c1b9367e2e',
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const accessId = (uid, companyId) => `${uid}__${companyId}`;

async function main() {
  const email = process.env.SEED_EMAIL || 'admin@taxiq.system';
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error('✗ SEED_PASSWORD təyin edilməyib. İstifadə:');
    console.error("  SEED_EMAIL=admin@taxiq.system SEED_PASSWORD='<parol>' node scripts/repair-access.mjs");
    process.exit(1);
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const meUid = cred.user.uid;
  console.log('✓ Giriş:', email, 'uid=', meUid);

  // 1) Super admin öz profili düzgündürmü?
  const meRef = doc(db, 'users', meUid);
  const meSnap = await getDoc(meRef);
  if (!meSnap.exists()) {
    await setDoc(meRef, {
      email, displayName: 'Platform Admin', userType: 'platform_super_admin',
      status: 'active', mustChangePassword: false, homeCompanyId: null,
      accessibleCompanyIds: [], preferredLanguage: 'az', preferredTheme: 'system',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    console.log('✓ Super admin profili YARADILDI (yox idi).');
  } else if (meSnap.data().userType !== 'platform_super_admin') {
    await updateDoc(meRef, { userType: 'platform_super_admin', updatedAt: serverTimestamp() });
    console.log('✓ Super admin userType DÜZƏLDİLDİ (əvvəl:', meSnap.data().userType, ').');
  } else {
    console.log('• Super admin profili qaydasındadır.');
  }

  // 2) Bütün istifadəçilər + bütün aktiv təyinatlar
  const usersSnap = await getDocs(collection(db, 'users'));
  const accessSnap = await getDocs(query(collection(db, 'userCompanyAccess'), where('status', '==', 'active')));

  // uid → [{id, companyId, data}]
  const byUser = new Map();
  for (const d of accessSnap.docs) {
    const data = d.data();
    if (!data.userId || !data.companyId) continue;
    if (!byUser.has(data.userId)) byUser.set(data.userId, []);
    byUser.get(data.userId).push({ id: d.id, companyId: data.companyId, data });
  }

  let repaired = 0, migrated = 0;
  for (const u of usersSnap.docs) {
    const uid = u.id;
    const ud = u.data();
    if (ud.userType === 'platform_super_admin') continue; // bypass — massiv lazım deyil

    const recs = byUser.get(uid) ?? [];
    const ids = new Set();
    for (const r of recs) {
      ids.add(r.companyId);
      // Determinik id-yə köçürmə
      const wanted = accessId(uid, r.companyId);
      if (r.id !== wanted) {
        await setDoc(doc(db, 'userCompanyAccess', wanted), { ...r.data }, { merge: true });
        await updateDoc(doc(db, 'userCompanyAccess', r.id), { status: 'superseded', updatedAt: serverTimestamp() });
        migrated++;
      }
    }
    if (ud.userType === 'client_user' && ud.homeCompanyId) ids.add(ud.homeCompanyId);

    const current = Array.isArray(ud.accessibleCompanyIds) ? ud.accessibleCompanyIds : [];
    const list = [...ids];
    const changed = current.length !== list.length || list.some((x) => !current.includes(x));
    if (changed) {
      await updateDoc(doc(db, 'users', uid), { accessibleCompanyIds: list, updatedAt: serverTimestamp() });
      repaired++;
      console.log(`  ↻ ${ud.email ?? uid}: [${current.join(', ')}] → [${list.join(', ')}]`);
    }
  }

  console.log('────────────────────────────────────────');
  console.log(`✓ Bitdi. İstifadəçi massivi bərpa: ${repaired}, təyinat id-si köçürüldü: ${migrated}`);
  console.log('İndi tətbiqdə Tabel/Məzuniyyət və digər əməliyyatlar işləməlidir.');
  process.exit(0);
}

main().catch((e) => { console.error('✗ Xəta:', e?.message || e); process.exit(1); });
