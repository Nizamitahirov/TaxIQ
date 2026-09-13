#!/usr/bin/env node
/**
 * TaxIQ — ZƏNGİN demo data generatoru (idempotent-ish).
 * Daxili şirkət (taxiq-internal) üçün 6 aylıq realistik data: Hesablar Planı,
 * müştərilər/təchizatçılar, mal/xidmət + anbar, ~36 faktura (balanslı jurnal yazıları
 * ilə), ödənişlər, kreditor fakturalar, işçilər, payroll dövrü, kassa əməliyyatları.
 *
 * İstifadə: GOOGLE_APPLICATION_CREDENTIALS=./sa.json node scripts/demo-full.mjs
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT = 'taxiq-f2d9d';
const CID = 'taxiq-internal';
const SA = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SERVICE_ACCOUNT;
initializeApp({ credential: cert(JSON.parse(readFileSync(SA, 'utf8'))), projectId: PROJECT });
const db = getFirestore();
const ts = () => FieldValue.serverTimestamp();
const r2 = (n) => Math.round(n * 100) / 100;
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dstr = (d) => d.toISOString().slice(0, 10);

// ── Hesablar Planı (coa-template.ts ilə eyni) ──
const GROUPS = [['10','Qeyri-maddi aktivlər'],['11','Torpaq, tikili və avadanlıqlar'],['20','Ehtiyatlar'],['21','Qısamüddətli debitor borcları'],['22','Pul vəsaitləri'],['30','Nizamnamə kapitalı'],['34','Bölüşdürülməmiş mənfəət'],['50','Qısamüddətli faiz öhdəlikləri'],['52','Vergi öhdəlikləri'],['53','Qısamüddətli kreditor borcları'],['60','Əsas əməliyyat gəliri'],['61','Sair əməliyyat gəlirləri'],['70','Satışın maya dəyəri'],['71','Kommersiya xərcləri'],['72','İnzibati xərclər'],['73','Sair əməliyyat xərcləri'],['90','Mənfəət vergisi']];
const SYN = [['101','Qeyri-maddi aktivlər'],['111','Torpaq, tikili və avadanlıq'],['112','Yığılmış amortizasiya',true],['201','Material ehtiyatları'],['205','Mallar'],['211','Alıcıların debitor borcları'],['221','Kassa'],['223','Bank hesabları'],['226','ƏDV sub-uçot'],['301','Nizamnamə kapitalı'],['341','Xalis mənfəət (dövr)'],['521','Vergi öhdəlikləri'],['522','Sosial sığorta öhdəlikləri'],['531','Malsatanlara kreditor borcları'],['533','Əməyin ödənişi üzrə borc'],['601','Satış'],['611','Sair əməliyyat gəlirləri'],['701','Satışın maya dəyəri'],['711','Kommersiya xərcləri'],['721','İnzibati xərclər'],['731','Sair əməliyyat xərcləri']];
const classMeta = (c) => c<=2?['asset','debit']:c===3?['equity','credit']:c<=5?['liability','credit']:c===6?['income','credit']:c===7?['expense','debit']:c===8?['equity','credit']:['expense','debit'];

async function ensureCoa() {
  const snap = await db.collection('chartOfAccounts').where('companyId','==',CID).limit(1).get();
  const map = {};
  if (!snap.empty) {
    const all = await db.collection('chartOfAccounts').where('companyId','==',CID).get();
    all.forEach((d) => { map[d.data().accountCode] = d.id; });
    console.log('• CoA artıq var:', all.size, 'hesab');
    return map;
  }
  const batch = db.batch();
  const put = (code, name, cls, group, postable, contra) => {
    const [type, normal] = classMeta(cls);
    const ref = db.collection('chartOfAccounts').doc();
    map[code] = ref.id;
    batch.set(ref, { companyId: CID, accountCode: code, accountName: { az: name, en: name }, accountClass: cls, accountGroup: group, accountType: type, normalBalance: contra ? (normal==='debit'?'credit':'debit') : normal, isPostable: postable, isSubAccount: false, parentAccountId: null, currency: null, isActive: true, isSystemAccount: true, createdAt: ts(), updatedAt: ts() });
  };
  for (const [code, name] of GROUPS) put(code, name, Number(code[0]), code, false, false);
  for (const [code, name, contra] of SYN) put(code, name, Number(code[0]), code.slice(0,2), true, contra);
  await batch.commit();
  console.log('✓ CoA quruldu:', Object.keys(map).length, 'hesab');
  return map;
}

let jseq = 0;
async function journal(coa, dateStr, desc, sourceType, lines) {
  jseq++;
  const totalDebit = r2(lines.reduce((s,l)=>s+(l.debit||0),0));
  const totalCredit = r2(lines.reduce((s,l)=>s+(l.credit||0),0));
  const norm = lines.map((l)=>({ accountId: coa[l.code], accountCode: l.code, accountName: l.name||'', debit: r2(l.debit||0), credit: r2(l.credit||0), departmentId: null, currency: 'AZN', amountInBaseCurrency: r2((l.debit||0)-(l.credit||0)) }));
  await db.collection('journalEntries').add({ companyId: CID, entryNumber: `JE-2026-${String(jseq).padStart(5,'0')}`, entryDate: dateStr, entryDateStr: dateStr, postingPeriodId: `${CID}_${dateStr.slice(0,4)}_${dateStr.slice(5,7)}`, sourceType, sourceDocumentId: null, description: desc, lines: norm, totalDebit, totalCredit, status: 'posted', reversalOfEntryId: null, createdBy: 'seed', createdAt: ts() });
}

async function main() {
  console.log('▶ Demo data generatoru — şirkət:', CID);
  const existing = await db.collection('invoices').where('companyId','==',CID).limit(1).get();
  if (!existing.empty) { console.log('⚠️ Fakturalar artıq var — təkrar seed-i dayandırıram (təmiz başlamaq üçün əvvəl silin).'); process.exit(0); }
  const coa = await ensureCoa();
  const base = { companyId: CID, createdAt: ts(), updatedAt: ts(), createdBy: 'seed' };

  // Warehouse, bank, cash
  const whRef = await db.collection('warehouses').add({ ...base, name: { az: 'Əsas anbar', en: 'Main' }, code: 'WH1', type: 'main', isActive: true });
  const bankRef = await db.collection('bankAccounts').add({ ...base, bankName: 'Kapital Bank', accountName: 'Əsas AZN hesabı', iban: 'AZ21NABZ00000000137010001944', currency: 'AZN', currentBalance: 0, isActive: true });
  const cashRef = await db.collection('cashRegisters').add({ ...base, name: 'Baş kassa', currency: 'AZN', currentBalance: 0, isActive: true });

  // Customers
  const custNames = ['Bakı Retail Group MMC','Xəzər Logistika MMC','AtaTech ASC','Günəş Tekstil MMC','Nar Distribution MMC','Zəfər İnşaat MMC','Optimal Market MMC','Kaspian Trade MMC'];
  const customers = [];
  for (let i=0;i<custNames.length;i++) { const ref = await db.collection('customers').add({ ...base, type:'legal_entity', name:custNames[i], taxId:String(1000000000+rand(1,8999999)), defaultCurrency:'AZN', paymentTermDays: pick([14,30,45]), isActive:true }); customers.push({ id: ref.id, name: custNames[i] }); }

  // Vendors + a few approved purchase bills (AP + inventory)
  const vendNames = ['Anadolu Təchizat MMC','MegaOfis MMC','TexnoImport MMC','Logistik Plus MMC','Enerji Xidmət MMC'];
  const vendors = [];
  for (const n of vendNames) { const ref = await db.collection('vendors').add({ ...base, name:n, taxId:String(2000000000+rand(1,8999999)), defaultCurrency:'AZN', paymentTermDays:14, isActive:true }); vendors.push({ id: ref.id, name: n }); }

  // Goods & services
  const goodDefs = [['SKU-01','Ofis kağızı A4','good',6,3.2],['SKU-02','Printer kartricləri','good',45,28],['SKU-03','Noutbuk stend','good',35,20],['SKU-04','USB kabel','good',8,3],['SKU-05','Monitor 24"','good',320,240],['SKU-06','Klaviatura dəsti','good',60,38],['SKU-07','Ofis stulu','good',180,120],['SKU-08','Server rack','good',900,700],['SRV-01','Aylıq mühasibatlıq xidməti','service',300,0],['SRV-02','Vergi konsaltinqi (saat)','service',80,0],['SRV-03','HR outsorsinq (aylıq)','service',250,0],['SRV-04','Audit xidməti','service',1200,0]];
  const goods = [];
  for (const [sku,name,type,sale,cost] of goodDefs) { const ref = await db.collection('goods').add({ ...base, type, sku, name:{az:name,en:name}, baseUnit: type==='service'?'ay':'ədəd', trackInventory: type==='good', valuationMethodOverride:null, defaultPurchasePrice: cost||null, defaultSalePrice: sale, vatRate:18, reorderPoint: type==='good'?rand(5,15):null, isActive:true }); goods.push({ id: ref.id, name, type, sale, cost }); }

  // Stock receipts for goods → inventory value + averageCost
  for (const g of goods.filter((x)=>x.type==='good')) {
    const qty = rand(20,120);
    await db.collection('stockMovements').add({ ...base, warehouseId: whRef.id, warehouseName:'Əsas anbar', goodId:g.id, goodName:g.name, movementType:'purchase_in', quantity:qty, unitCost:g.cost, relatedDocumentType:null, relatedDocumentId:null, movementDate: dstr(new Date(2026,3,rand(1,20))), note:'İlkin qəbul', journalEntryId:null, performedBy:'seed' });
    await db.collection('stockBalances').doc(`${whRef.id}_${g.id}`).set({ companyId:CID, warehouseId:whRef.id, goodId:g.id, quantityOnHand:qty, averageCost:g.cost, totalValue:r2(qty*g.cost), lastMovementAt: ts() });
  }

  // Purchase bills (approved, unpaid) → AP + journal Dt205/Dt226/Kt531
  let apTotal = 0;
  for (let i=0;i<5;i++) {
    const v = pick(vendors); const net = rand(300,2500); const vat = r2(net*0.18); const grand = r2(net+vat);
    const dt = dstr(new Date(2026,rand(3,8),rand(1,25)));
    const ref = await db.collection('purchaseBills').add({ ...base, billNumber:`BILL-2026-${String(i+1).padStart(5,'0')}`, vendorId:v.id, vendorName:v.name, vendorInvoiceReference:`V-${rand(1000,9999)}`, issueDate:dt, dueDate:dstr(new Date(2026,9,rand(1,25))), lineItems:[{description:'Təchizat',quantity:1,unit:'ədəd',unitPrice:net,discountPercent:0,vatRate:18,lineTotal:net}], subtotal:net, vatTotal:vat, grandTotal:grand, amountPaid:0, amountDue:grand, status:'approved', warehouseId:null, journalEntryId:null });
    await journal(coa, dt, `Kreditor faktura BILL-2026-${String(i+1).padStart(5,'0')} — ${v.name}`, 'purchase_bill', [{code:'205',name:'Mallar',debit:net},{code:'226',name:'ƏDV sub-uçot',debit:vat},{code:'531',name:'Kreditor',credit:grand}]);
    apTotal += grand; void ref;
  }

  // Invoices over 6 months
  let bankBal = 0; let invSeq = 0;
  const now = new Date();
  for (let m=5;m>=0;m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth()-m, 1);
    const perMonth = rand(5,8);
    for (let k=0;k<perMonth;k++) {
      invSeq++;
      const cust = pick(customers);
      const nLines = rand(1,3); const items=[]; let subtotal=0;
      for (let l=0;l<nLines;l++){ const g=pick(goods); const q=g.type==='service'?rand(1,4):rand(1,10); const gross=r2(q*g.sale); subtotal=r2(subtotal+gross); items.push({goodId:g.id,description:g.name,quantity:q,unit:g.type==='service'?'ay':'ədəd',unitPrice:g.sale,discountPercent:0,vatRate:18,lineTotal:gross}); }
      const vat=r2(subtotal*0.18); const grand=r2(subtotal+vat);
      const day=rand(1,26); const issue=new Date(monthDate.getFullYear(),monthDate.getMonth(),day); const issueStr=dstr(issue);
      const due=new Date(issue); due.setDate(due.getDate()+30); const dueStr=dstr(due);
      // status paylanması
      const roll=Math.random(); let status, amountPaid=0;
      if (m===0 && roll<0.15) { status='draft'; }
      else if (roll<0.6) { status='paid'; amountPaid=grand; }
      else if (roll<0.75) { status='partially_paid'; amountPaid=r2(grand*0.5); }
      else if (dueStr < dstr(now)) { status='overdue'; }
      else { status='sent'; }
      const invNo=`INV-2026-${String(invSeq).padStart(5,'0')}`;
      const invRef = await db.collection('invoices').add({ ...base, invoiceNumber:invNo, customerId:cust.id, customerName:cust.name, sourceOrderId:null, issueDate:issueStr, dueDate:dueStr, lineItems:items, subtotal, discountTotal:0, vatTotal:vat, grandTotal:grand, currency:'AZN', exchangeRateToBaseCurrency:1, amountPaid, amountDue:r2(grand-amountPaid), status, departmentId:null, warehouseId:null, journalEntryId:null, notes:null });
      if (status!=='draft') {
        await journal(coa, issueStr, `Satış fakturası ${invNo} — ${cust.name}`, 'sales_invoice', [{code:'211',name:'Debitor',debit:grand},{code:'601',name:'Satış',credit:subtotal},{code:'521',name:'ƏDV',credit:vat}]);
      }
      if (amountPaid>0) {
        const payDate=dstr(new Date(issue.getTime()+rand(3,25)*86400000));
        await db.collection('payments').add({ ...base, direction:'incoming', method:'bank_transfer', sourceAccountRef:{type:'bank',id:bankRef.id}, counterpartyRef:{type:'customer',id:cust.id,name:cust.name}, amount:amountPaid, currency:'AZN', exchangeRateToBaseCurrency:1, paymentDate:payDate, allocations:[{invoiceType:'salesInvoice',invoiceId:invRef.id,invoiceNumber:invNo,allocatedAmount:amountPaid}], unallocatedAmount:0, status:'completed', journalEntryId:null, note:null });
        await journal(coa, payDate, `Müştəri ödənişi — ${cust.name}`, 'payment', [{code:'223',name:'Bank',debit:amountPaid},{code:'211',name:'Debitor',credit:amountPaid}]);
        bankBal=r2(bankBal+amountPaid);
        void invSeq;
      }
    }
  }
  await db.collection('companies').doc(CID).set({ invoiceSequence: invSeq }, { merge: true });

  // Cash transactions
  let cashBal=0;
  for (let i=0;i<6;i++){ const inn=Math.random()<0.5; const amt=rand(50,600); const dt=dstr(new Date(now.getFullYear(),now.getMonth()-rand(0,3),rand(1,26)));
    await db.collection('cashTransactions').add({ ...base, cashRegisterId:cashRef.id, type: inn?'cash_in':'cash_out', amount:amt, currency:'AZN', category: inn?'sales_receipt':'expense', transactionDate:dt, note: inn?'Nağd satış':'Ofis xərci', journalEntryId:null, performedBy:'seed' });
    await journal(coa, dt, `Kassa ${inn?'mədaxil':'məxaric'}`, 'cash_transaction', inn?[{code:'221',name:'Kassa',debit:amt},{code:'601',name:'Satış',credit:amt}]:[{code:'711',name:'Kommersiya xərci',debit:amt},{code:'221',name:'Kassa',credit:amt}]);
    cashBal=r2(cashBal+(inn?amt:-amt));
  }

  // Employees
  const empNames=[['Əli','Məmmədov','Baş mühasib',2500],['Nigar','Əliyeva','HR meneceri',1800],['Rəşad','Hüseynov','Mühasib',1400],['Leyla','Quliyeva','Satış meneceri',1600],['Kamran','Vəliyev','Anbardar',1100],['Aysel','Rəhimova','Vergi konsultantı',1900],['Tural','İsmayılov','Auditor',2100],['Günel','Cəfərova','İnzibatçı',1300],['Elvin','Nəbiyev','Konsultant',1500],['Səbinə','Abbasova','Kassir',1000]];
  const emps=[];
  for (let i=0;i<empNames.length;i++){ const [f,l,pos,sal]=empNames[i]; const ref=await db.collection('employees').add({ ...base, employeeCode:`EMP-${String(i+1).padStart(3,'0')}`, firstName:f, lastName:l, position:pos, personalId:`AZE${rand(10000,99999)}`, baseSalary:sal, currency:'AZN', status:'active', laborContractNotified: i%4!==0, bankAccountIban:`AZ${rand(10,99)}KAPI${rand(10000000,99999999)}` }); emps.push({id:ref.id,name:`${f} ${l}`,sal}); }

  // Leave types + a couple requests
  for (const t of [['annual','Əsas məzuniyyət',true,21],['sick','Xəstəlik vərəqəsi',true,0],['unpaid','Ödənişsiz məzuniyyət',false,0]]) await db.collection('leaveTypes').add({ companyId:CID, code:t[0], name:{az:t[1],en:t[1]}, paid:t[2], defaultDays:t[3] });
  for (let i=0;i<3;i++){ const e=pick(emps); const s=new Date(now.getFullYear(),now.getMonth(),rand(1,20)); const en=new Date(s.getTime()+rand(2,7)*86400000); await db.collection('leaveRequests').add({ ...base, employeeId:e.id, employeeName:e.name, leaveTypeId:'annual', leaveTypeName:'Əsas məzuniyyət', startDate:dstr(s), endDate:dstr(en), totalDays:rand(3,7), status: pick(['pending','approved','pending']), reason:null }); }

  // Payroll run (approved) — sadə hesablama
  const lines = emps.map((e)=>{ const gross=e.sal; const tax=r2(gross<=2500?gross*0.14:350+(gross-2500)*0.25); const soc=r2(gross<=200?gross*0.03:200*0.03+(gross-200)*0.10); const med=r2(gross<=2500?gross*0.02:2500*0.02+(gross-2500)*0.005); const un=r2(gross*0.005); const net=r2(gross-tax-soc-med-un); const erSoc=r2(gross*0.22); const erMed=r2(gross*(gross<=2500?0.02:0.005)); const erUn=r2(gross*0.005); return { employeeId:e.id, employeeName:e.name, baseSalary:gross, overtimePay:0, bonuses:0, otherDeductions:0, grossSalary:gross, incomeTax:tax, employeeSocialInsurance:soc, employeeMedicalInsurance:med, employeeUnemploymentInsurance:un, netSalary:net, employerSocialInsurance:erSoc, employerMedicalInsurance:erMed, employerUnemploymentInsurance:erUn, totalEmployerCost:r2(gross+erSoc+erMed+erUn) }; });
  const totalGross=r2(lines.reduce((s,l)=>s+l.grossSalary,0)); const totalNet=r2(lines.reduce((s,l)=>s+l.netSalary,0)); const totalEmployerCost=r2(lines.reduce((s,l)=>s+l.totalEmployerCost,0));
  const pm=now.getMonth()===0?12:now.getMonth(); const py=now.getMonth()===0?now.getFullYear()-1:now.getFullYear();
  const runRef=await db.collection('payrollRuns').add({ ...base, periodMonth:pm, periodYear:py, status:'approved', lines, totalGross, totalNet, totalEmployerCost, taxConfigNote:'AZ 2026 seed', journalEntryId:null, approvedBy:'seed' });
  const totalTax=r2(lines.reduce((s,l)=>s+l.incomeTax,0)); const empC=r2(lines.reduce((s,l)=>s+l.employeeSocialInsurance+l.employeeMedicalInsurance+l.employeeUnemploymentInsurance,0)); const erC=r2(lines.reduce((s,l)=>s+l.employerSocialInsurance+l.employerMedicalInsurance+l.employerUnemploymentInsurance,0));
  await journal(coa, dstr(new Date(py,pm-1,28)), `Əmək haqqı ${py}-${String(pm).padStart(2,'0')}`, 'payroll', [{code:'721',name:'İnzibati xərc',debit:r2(totalGross+erC)},{code:'533',name:'Əməyə borc',credit:totalNet},{code:'521',name:'Vergi',credit:totalTax},{code:'522',name:'Sosial',credit:r2(empC+erC)}]);
  void runRef;

  // Balansları yenilə
  await db.collection('bankAccounts').doc(bankRef.id).set({ currentBalance: bankBal }, { merge: true });
  await db.collection('cashRegisters').doc(cashRef.id).set({ currentBalance: cashBal }, { merge: true });

  // Accounting periods (open)
  for (let m=0;m<7;m++){ const d=new Date(now.getFullYear(),now.getMonth()-m,1); const y=d.getFullYear(); const mo=d.getMonth()+1; const id=`${CID}_${y}_${String(mo).padStart(2,'0')}`; await db.collection('accountingPeriods').doc(id).set({ companyId:CID, fiscalYear:y, periodNumber:mo, periodStart:`${y}-${String(mo).padStart(2,'0')}-01`, periodEnd:`${y}-${String(mo).padStart(2,'0')}-28`, status:'open', createdAt: ts() }, { merge: true }); }

  console.log(`✓ ${invSeq} faktura, ${jseq} jurnal yazısı, ${customers.length} müştəri, ${emps.length} işçi, payroll dövrü, anbar, ödənişlər yaradıldı.`);
  console.log(`  Bank qalığı ~${bankBal} ₼, Kassa ~${cashBal} ₼, AP ~${r2(apTotal)} ₼`);
  console.log('✅ Demo data hazırdır — dashboard və bütün modullar dolu görünəcək.');
  process.exit(0);
}
main().catch((e)=>{ console.error('✖ Xəta:', e); process.exit(1); });
