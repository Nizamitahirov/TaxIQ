#!/usr/bin/env node
/**
 * TaxIQ — test/fake data seeder (CLIENT SDK, super admin ilə).
 * Service account tələb ETMİR — mövcud super admin hesabı ilə giriş edir və
 * Firestore Security Rules çərçivəsində yazır.
 *
 * Nə edir:
 *   • Daxili şirkətə (taxiq-internal) TEST datası əlavə edir:
 *       - Tapşırıqlar (userTasks) — müxtəlif status/prioritet/etiket
 *       - SƏTƏM: təlim növləri, təlim qeydləri (etibarlı/bitir/vaxtı keçib),
 *         auditlər, iş icazələri, kitabxana qovluqları + nümunə sənədlər
 *       - İşçi/müştəri/mal yoxdursa minimal kontekst əlavə edir
 *   • "Databyte MMC" alternativ şirkətini QEYDİYYATA salır (fake data VURMUR).
 *
 * İstifadə:
 *   SEED_EMAIL=admin@taxiq.system SEED_PASSWORD='<parol>' node scripts/seed-fake.mjs
 *   (SEED_EMAIL verilməzsə admin@taxiq.system götürülür.)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

const cfg = {
  apiKey: 'AIzaSyBdmcXZHaX1A9OAGLSX7RQNEw4tbidE4MA', authDomain: 'taxiq-f2d9d.firebaseapp.com',
  projectId: 'taxiq-f2d9d', storageBucket: 'taxiq-f2d9d.firebasestorage.app',
  messagingSenderId: '6836696939', appId: '1:6836696939:web:15da6814c590c1b9367e2e',
};
const CID = 'taxiq-internal';
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const ts = () => serverTimestamp();
const dstr = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); };
const addMonths = (base, m) => { const d = new Date(base + 'T00:00:00'); d.setMonth(d.getMonth() + m); return dstr(d); };
async function countIn(col, companyId = CID) {
  const s = await getDocs(query(collection(db, col), where('companyId', '==', companyId)));
  return s.docs;
}

async function main() {
  const email = process.env.SEED_EMAIL || 'admin@taxiq.system';
  const password = process.env.SEED_PASSWORD;
  if (!password) { console.error('✗ SEED_PASSWORD təyin edilməyib.'); process.exit(1); }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const meDoc = await getDoc(doc(db, 'users', uid));
  const myName = meDoc.exists() ? (meDoc.data().displayName || 'Platform Admin') : 'Platform Admin';
  console.log('✓ Giriş: ', email, 'uid=', uid);

  // ── İşçilər (kontekst) ──
  let employees = (await countIn('employees')).map((d) => ({ id: d.id, ...d.data() }));
  if (employees.length < 3) {
    const names = [['Nigar', 'Əliyeva', 'Mühasib'], ['Kamran', 'Hüseynov', 'Anbardar'], ['Leyla', 'Quliyeva', 'Kadr mütəxəssisi'], ['Rəşad', 'Vəliyev', 'Satış meneceri'], ['Aysel', 'Məmmədova', 'SƏTƏM üzrə mütəxəssis']];
    for (let i = 0; i < names.length; i++) {
      const [f, l, p] = names[i];
      const ref = await addDoc(collection(db, 'employees'), { companyId: CID, employeeCode: `EMP-1${i}0`, firstName: f, lastName: l, position: p, baseSalary: 900 + i * 150, currency: 'AZN', status: 'active', laborContractNotified: i % 2 === 0, createdAt: ts() });
      employees.push({ id: ref.id, firstName: f, lastName: l });
    }
    console.log('✓ İşçilər əlavə edildi:', names.length);
  } else console.log('• İşçilər var:', employees.length);

  // ── Müştərilər / mallar (kontekst, boşdursa) ──
  if ((await countIn('customers')).length === 0) {
    for (const [name, tax] of [['Alfa Trade MMC', '1400111111'], ['Beta Logistics MMC', '1400222222'], ['Gamma Retail MMC', '1400333333'], ['Delta Services MMC', '1400444444']])
      await addDoc(collection(db, 'customers'), { companyId: CID, name, taxId: tax, type: 'company', isActive: true, createdAt: ts() });
    console.log('✓ Müştərilər əlavə edildi');
  }
  if ((await countIn('goods')).length === 0) {
    const goods = [['Mühasibat konsultasiyası', 'SRV-01', 'service'], ['Audit xidməti', 'SRV-02', 'service'], ['A4 kağız (qutu)', 'GD-01', 'good'], ['Toner kartric', 'GD-02', 'good'], ['Noutbuk', 'GD-03', 'good']];
    for (const [n, sku, type] of goods)
      await addDoc(collection(db, 'goods'), { companyId: CID, name: { az: n, en: n }, sku, type, unit: type === 'service' ? 'saat' : 'ədəd', salePrice: type === 'service' ? 80 : 25, isActive: true, valuationMethodOverride: type === 'good' ? 'fifo' : null, createdAt: ts() });
    console.log('✓ Mal/xidmət əlavə edildi');
  }

  // ── Tapşırıqlar ──
  if ((await countIn('userTasks')).length < 6) {
    const teammates = employees.slice(0, 3).map((e) => ({ uid: `emp:${e.id}`, name: `${e.firstName} ${e.lastName}` }));
    const who = [{ uid, name: myName }, ...teammates];
    const seedTasks = [
      ['1-ci rüb ƏDV bəyannaməsini hazırla', 'todo', 'high', addDays(3), ['vergi', 'təcili']],
      ['Yeni müştəri müqaviləsini nəzərdən keçir', 'in_progress', 'medium', addDays(6), ['hüquq']],
      ['Əmək haqqı hesablanmasını təsdiqlə', 'todo', 'high', addDays(1), ['payroll']],
      ['Anbar inventarizasiyası planla', 'todo', 'low', addDays(14), ['anbar']],
      ['IFRS balans hesabatını yoxla', 'in_progress', 'medium', addDays(9), ['hesabat']],
      ['SƏTƏM təlim cədvəlini yenilə', 'todo', 'medium', addDays(5), ['sətəm']],
      ['Debitor borclarını izlə (AR aging)', 'done', 'medium', addDays(-2), ['maliyyə']],
      ['Bank çıxarışını uzlaşdır', 'done', 'low', addDays(-5), ['xəzinə']],
      ['Yeni işçi üçün onboarding sənədləri', 'in_progress', 'high', addDays(2), ['kadr']],
      ['Rüblük idarəetmə hesabatı', 'todo', 'medium', addDays(20), ['hesabat']],
      ['Vendor fakturalarını təsdiqlə', 'done', 'medium', addDays(-1), ['alış']],
      ['Dövr sonu bağlanışını planla', 'todo', 'high', addDays(25), ['mühasibat']],
    ];
    for (let i = 0; i < seedTasks.length; i++) {
      const [title, status, priority, due, labels] = seedTasks[i];
      const asg = who[i % who.length];
      await addDoc(collection(db, 'userTasks'), {
        companyId: CID, title, description: null, status, done: status === 'done', priority,
        dueDate: due, labels, assignedToUid: asg.uid, assigneeName: asg.name,
        createdBy: uid, createdByName: myName, order: Date.now() + i,
        completedAt: status === 'done' ? ts() : null, createdAt: ts(),
      });
    }
    console.log('✓ Tapşırıqlar əlavə edildi:', seedTasks.length);
  } else console.log('• Tapşırıqlar artıq var');

  // ── SƏTƏM: təlim növləri ──
  let types = (await countIn('hseTrainingTypes')).map((d) => ({ id: d.id, ...d.data() }));
  if (types.length === 0) {
    for (const [name, m] of [['Yanğın təhlükəsizliyi', 12], ['İlk tibbi yardım', 24], ['Hündürlükdə iş', 12], ['Elektrik təhlükəsizliyi', 6], ['Ümumi SƏTƏM təlimatı', 12]]) {
      const ref = await addDoc(collection(db, 'hseTrainingTypes'), { companyId: CID, name, validityMonths: m, isActive: true, createdAt: ts() });
      types.push({ id: ref.id, name, validityMonths: m });
    }
    console.log('✓ SƏTƏM təlim növləri əlavə edildi');
  }

  // ── SƏTƏM: təlim qeydləri (etibarlı/bitir/vaxtı keçib qarışıq) ──
  if ((await countIn('hseTrainingRecords')).length === 0) {
    const offsets = [-2, -11, -13, -6, -20]; // ay: son tarixə görə status dəyişir
    let n = 0;
    for (let e = 0; e < Math.min(employees.length, 5); e++) {
      const emp = employees[e];
      for (let t = 0; t < Math.min(types.length, 3); t++) {
        const type = types[(e + t) % types.length];
        const completed = addMonths(dstr(new Date()), offsets[(e + t) % offsets.length]);
        const nextDue = addMonths(completed, type.validityMonths);
        await addDoc(collection(db, 'hseTrainingRecords'), {
          companyId: CID, employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`,
          trainingTypeId: type.id, trainingTypeName: type.name, completedDate: completed,
          validityMonths: type.validityMonths, nextDueDate: nextDue,
          signedDocUrl: null, signedDocPath: null, signedDocUploadedAt: null, note: null,
          createdBy: uid, createdAt: ts(),
        });
        n++;
      }
    }
    console.log('✓ SƏTƏM təlim qeydləri əlavə edildi:', n);
  }

  // ── SƏTƏM: auditlər ──
  if ((await countIn('hseAudits')).length === 0) {
    await addDoc(collection(db, 'hseAudits'), { companyId: CID, title: 'Ofis SƏTƏM auditi (rüblük)', auditDate: addDays(-15), auditor: 'Aysel Məmmədova', area: 'Baş ofis', status: 'completed', findings: [{ description: 'Yanğınsöndürən balonların yoxlanma tarixi keçib', severity: 'high', status: 'open' }, { description: 'Təcili çıxış işarələri kifayət deyil', severity: 'medium', status: 'closed' }], createdBy: uid, createdAt: ts() });
    await addDoc(collection(db, 'hseAudits'), { companyId: CID, title: 'Anbar təhlükəsizlik yoxlanışı', auditDate: addDays(-3), auditor: 'Kamran Hüseynov', area: 'Anbar', status: 'in_progress', findings: [{ description: 'Rəflərin bərkidilməsi zəifdir', severity: 'medium', status: 'open' }], createdBy: uid, createdAt: ts() });
    console.log('✓ SƏTƏM auditləri əlavə edildi');
  }

  // ── SƏTƏM: iş icazələri ──
  if ((await countIn('hseWorkPermits')).length === 0) {
    const permits = [
      ['hot_work', 'Anbar dam örtüyü', 'active', addDays(-1), addDays(2)],
      ['height', 'Fasad təmizliyi (3-cü mərtəbə)', 'approved', addDays(1), addDays(3)],
      ['electrical', 'Server otağı kabel işləri', 'draft', addDays(2), addDays(2)],
      ['confined_space', 'Su çəni təmizliyi', 'closed', addDays(-10), addDays(-8)],
    ];
    let i = 0;
    for (const [type, loc, status, from, to] of permits) {
      i++;
      await addDoc(collection(db, 'hseWorkPermits'), { companyId: CID, permitNumber: `WP-${new Date().getFullYear()}-000${i}`, permitType: type, location: loc, description: null, requestedBy: 'Rəşad Vəliyev', validFrom: from, validTo: to, status, approverUid: status === 'draft' ? null : uid, approvedAt: status === 'draft' ? null : new Date().toISOString(), createdBy: uid, createdAt: ts() });
    }
    console.log('✓ İş icazələri əlavə edildi');
  }

  // ── SƏTƏM: kitabxana qovluqları + nümunə sənəd ──
  if ((await countIn('hseFolders')).length === 0) {
    const folders = ['Təlimatlar', 'Prosedurlar', 'Sertifikatlar', 'Risk qiymətləndirmələri'];
    for (const name of folders) await addDoc(collection(db, 'hseFolders'), { companyId: CID, name, parentId: null, createdBy: uid, createdAt: ts() });
    console.log('✓ SƏTƏM qovluqları əlavə edildi (fayllar UI-dan yüklənə bilər)');
  }

  // ── Databyte MMC — QEYDİYYAT (fake data YOX) ──
  const dbRef = doc(db, 'companies', 'databyte-mmc');
  if (!(await getDoc(dbRef)).exists()) {
    await setDoc(dbRef, {
      name: 'Databyte MMC', legalName: 'Databyte MMC', taxId: '',
      sector: 'services', isInternal: false, status: 'active', baseCurrency: 'AZN',
      settings: { theme: 'system', language: 'az', fiscalYearStartMonth: 1 },
      modulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
      createdBy: uid, createdAt: ts(), updatedAt: ts(),
    });
    console.log('✓ Databyte MMC qeydiyyata salındı (data yoxdur)');
  } else console.log('• Databyte MMC artıq var');

  console.log('\n🎉 Hazırdır.');
  process.exit(0);
}

main().catch((e) => { console.error('✗ Xəta:', e.code || e.message); process.exit(1); });
