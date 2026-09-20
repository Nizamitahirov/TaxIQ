#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  TaxIQ — «Missing or insufficient permissions» tam düzəlişi (Google Cloud Shell)
#
#  Bu skript Cloud Shell-də sizin öz GCP hesabınızla (tam səlahiyyət) işləyir —
#  NƏ service account, NƏ parol, NƏ də repo klonu lazımdır. Hər şey self-contained.
#
#  Nə edir:
#    1. Firestore təhlükəsizlik qaydalarını deploy edir (REST + gcloud token).
#    2. Bütün istifadəçilərin accessibleCompanyIds massivini real təyinatlardan
#       (userCompanyAccess) + client homeCompanyId-dən yenidən qurur (Admin SDK).
#    3. Təsadüfi id-li təyinatları determinik id-yə köçürür.
#    (Opsional) PROMOTE_EMAIL verilsə, həmin hesabı super admin edir.
#
#  İSTİFADƏ (Cloud Shell-də):
#    bash cloud-shell-fix.sh
#    # və ya admin hesabınızın rolunu bərpa etmək üçün:
#    PROMOTE_EMAIL='admin@taxiq.system' bash cloud-shell-fix.sh
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="taxiq-f2d9d"
PROMOTE_EMAIL="${PROMOTE_EMAIL:-}"

echo "▶ TaxIQ giriş bərpası — layihə: $PROJECT"
gcloud config set project "$PROJECT" >/dev/null 2>&1 || true

echo "▶ Hesab: $(gcloud config get-value account 2>/dev/null)   Layihə: $(gcloud config get-value project 2>/dev/null)"

echo "▶ Lazımi API-lər aktivləşdirilir (bir dəfəlik)…"
gcloud services enable firebaserules.googleapis.com firestore.googleapis.com cloudresourcemanager.googleapis.com >/dev/null 2>&1 || \
  echo "  ⚠ API aktivləşdirmə atlandı (icazə ola bilməz) — davam edilir."

TOKEN="$(gcloud auth print-access-token)"
if [ -z "$TOKEN" ]; then
  echo "✗ gcloud token alınmadı. Cloud Shell-də olduğunuzdan və layihəyə çıxışınızdan əmin olun." >&2
  exit 1
fi

WORK="$(mktemp -d)"
cd "$WORK"

# ── 1) Firestore qaydaları ──────────────────────────────────────────────────
cat > firestore.rules <<'RULES_EOF'
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isSuperAdmin() {
      return isSignedIn() && userDoc().userType == 'platform_super_admin';
    }

    function hasActiveAccessRecord(companyId) {
      return exists(/databases/$(database)/documents/userCompanyAccess/$(request.auth.uid + '__' + companyId)) &&
        get(/databases/$(database)/documents/userCompanyAccess/$(request.auth.uid + '__' + companyId)).data.status == 'active';
    }

    function hasCompanyAccess(companyId) {
      return isSignedIn() && (
        isSuperAdmin() ||
        (userDoc().accessibleCompanyIds != null && companyId in userDoc().accessibleCompanyIds) ||
        userDoc().homeCompanyId == companyId ||
        hasActiveAccessRecord(companyId)
      );
    }

    function companyIdUnchanged() {
      return request.resource.data.companyId == resource.data.companyId;
    }

    match /platformConfig/{doc} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }

    match /companies/{companyId} {
      allow read: if hasCompanyAccess(companyId);
      allow create: if isSuperAdmin();
      allow update: if isSuperAdmin() || hasCompanyAccess(companyId);
      allow delete: if false;
    }

    match /companyDrafts/{draftId} {
      allow read, write: if isSignedIn() &&
        (isSuperAdmin() || request.auth.uid == resource.data.createdBy || request.auth.uid == request.resource.data.createdBy);
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin());
      allow update: if isSuperAdmin() ||
        (request.auth.uid == uid &&
         request.resource.data.userType == resource.data.userType &&
         request.resource.data.accessibleCompanyIds == resource.data.accessibleCompanyIds);
      allow create, delete: if isSuperAdmin();
    }

    match /userCompanyAccess/{id} {
      allow read: if isSignedIn() && (isSuperAdmin() ||
        resource.data.userId == request.auth.uid ||
        hasCompanyAccess(resource.data.companyId));
      allow write: if isSuperAdmin() || hasCompanyAccess(request.resource.data.companyId);
    }

    match /roles/{roleId} {
      allow read: if isSignedIn();
      allow create: if isSuperAdmin() ||
        (request.resource.data.type == 'custom' && hasCompanyAccess(request.resource.data.companyId));
      allow update, delete: if isSuperAdmin() ||
        (resource.data.type == 'custom' && hasCompanyAccess(resource.data.companyId));
    }

    match /permissions/{permId} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }

    match /currencies/{code} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }

    match /payrollTaxConfigs/{id} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }

    match /auditLogs/{id} {
      allow read: if isSuperAdmin() ||
        (isSignedIn() && resource.data.companyId != null && hasCompanyAccess(resource.data.companyId));
      allow create: if isSignedIn();
      allow update, delete: if false;
    }

    match /notifications/{id} {
      allow read, update: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn();
      allow delete: if isSuperAdmin();
    }

    match /dashboards/{id} {
      allow read: if hasCompanyAccess(resource.data.companyId);
      allow create: if hasCompanyAccess(request.resource.data.companyId);
      allow update, delete: if hasCompanyAccess(resource.data.companyId) && companyIdUnchanged();
    }

    match /dailyAggregates/{id} {
      allow read: if hasCompanyAccess(resource.data.companyId);
      allow write: if isSuperAdmin();
    }

    match /chartOfAccounts/{id} {
      allow read: if isSignedIn() && hasCompanyAccess(resource.data.companyId);
      allow create: if isSignedIn() && hasCompanyAccess(request.resource.data.companyId);
      allow update: if isSignedIn() && hasCompanyAccess(resource.data.companyId) && companyIdUnchanged();
      allow delete: if isSignedIn() && hasCompanyAccess(resource.data.companyId) && resource.data.isSystemAccount == false;
    }

    match /journalEntries/{id} {
      allow read: if isSignedIn() && hasCompanyAccess(resource.data.companyId);
      allow create: if isSignedIn() && hasCompanyAccess(request.resource.data.companyId);
      allow update: if isSignedIn() && hasCompanyAccess(resource.data.companyId) && companyIdUnchanged();
      allow delete: if false;
    }

    match /{collection}/{docId} {
      allow read: if isSignedIn() &&
        resource.data.companyId != null && hasCompanyAccess(resource.data.companyId);
      allow create: if isSignedIn() &&
        request.resource.data.companyId != null && hasCompanyAccess(request.resource.data.companyId);
      allow update: if isSignedIn() &&
        hasCompanyAccess(resource.data.companyId) && companyIdUnchanged();
      allow delete: if isSignedIn() && hasCompanyAccess(resource.data.companyId);
    }
  }
}
RULES_EOF

echo "▶ Firestore qaydaları deploy edilir…"
PROJECT="$PROJECT" TOKEN="$TOKEN" python3 - <<'PY'
import json, os, urllib.request, urllib.error
project = os.environ['PROJECT']; token = os.environ['TOKEN']
hdr = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def call(url, method, body=None, ignore=()):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=hdr, method=method)
    try:
        return urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        if e.code in ignore:
            return None
        detail = e.read().decode('utf-8', 'replace')
        print(f"  ✗ HTTP {e.code} {method} {url}\n    {detail}")
        raise

src = open('firestore.rules').read()
body = {"source": {"files": [{"name": "firestore.rules", "content": src}]}}
name = json.load(call(f"https://firebaserules.googleapis.com/v1/projects/{project}/rulesets", "POST", body))["name"]
print("  ✓ ruleset yaradıldı:", name)

rel_name = f"projects/{project}/releases/cloud.firestore"
release = {"name": rel_name, "rulesetName": name}
# Mövcud release-i sil (varsa) və yenisini yarat — patch qeyri-müəyyənliyindən qaçınmaq üçün
call(f"https://firebaserules.googleapis.com/v1/{rel_name}", "DELETE", ignore=(404,))
call(f"https://firebaserules.googleapis.com/v1/projects/{project}/releases", "POST", release)
print("  ✓ release aktivləşdirildi: cloud.firestore")
PY

# ── 2) Data bərpası (Admin SDK, gcloud token ilə — ADC problemi yoxdur) ──────
echo "▶ İstifadəçi giriş massivləri bərpa edilir…"
npm init -y >/dev/null 2>&1
npm install --no-audit --no-fund firebase-admin@12 >/dev/null 2>&1

cat > repair.mjs <<'JS_EOF'
import admin from 'firebase-admin';

const projectId = process.env.PROJECT;
const token = process.env.TOKEN;
const promoteEmail = (process.env.PROMOTE_EMAIL || '').trim().toLowerCase();

admin.initializeApp({
  projectId,
  credential: { getAccessToken: async () => ({ access_token: token, expires_in: 3300 }) },
});
const db = admin.firestore();
const accessId = (uid, cid) => `${uid}__${cid}`;
const arrEq = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const [usersSnap, accessAllSnap, companiesSnap] = await Promise.all([
  db.collection('users').get(),
  db.collection('userCompanyAccess').get(),
  db.collection('companies').get(),
]);

// ── DİAQNOSTİKA: canlı vəziyyəti çap et ──────────────────────────────────
const companyName = new Map(companiesSnap.docs.map((c) => [c.id, (c.data().name || '')]));
console.log('\n═══════════ CANLI VƏZİYYƏT (diaqnostika) ═══════════');
console.log(`Şirkətlər (${companiesSnap.size}):`);
for (const c of companiesSnap.docs) console.log(`  • ${c.id}  «${companyName.get(c.id)}»  status=${c.data().status ?? '?'}`);
console.log(`\nİstifadəçilər (${usersSnap.size}):`);
for (const u of usersSnap.docs) {
  const d = u.data();
  console.log(`  • ${d.email ?? u.id}  type=${d.userType ?? '?'}  home=${d.homeCompanyId ?? '—'}  access=[${(d.accessibleCompanyIds ?? []).join(', ')}]  status=${d.status ?? '?'}`);
}
console.log(`\nTəyinatlar userCompanyAccess (${accessAllSnap.size}):`);
for (const a of accessAllSnap.docs) {
  const d = a.data();
  console.log(`  • id=${a.id}  user=${d.userId}  company=${d.companyId}  role=${d.roleId ?? '?'}  status=${d.status ?? '?'}`);
}
console.log('════════════════════════════════════════════════════\n');

const accessSnap = { docs: accessAllSnap.docs.filter((d) => d.data().status === 'active'), forEach(fn){ this.docs.forEach(fn); } };

const byUser = new Map();
accessSnap.forEach((d) => {
  const x = d.data();
  if (!x.userId || !x.companyId) return;
  if (!byUser.has(x.userId)) byUser.set(x.userId, []);
  byUser.get(x.userId).push({ id: d.id, companyId: x.companyId, data: x });
});

let repaired = 0, migrated = 0, promoted = 0;
for (const u of usersSnap.docs) {
  const uid = u.id;
  const ud = u.data();
  const email = (ud.email || '').toLowerCase();

  // Opsional: admin hesabını super admin et
  if (promoteEmail && email === promoteEmail && ud.userType !== 'platform_super_admin') {
    await db.collection('users').doc(uid).update({ userType: 'platform_super_admin', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`  ★ ${email} → platform_super_admin`);
    promoted++;
    continue;
  }
  if (ud.userType === 'platform_super_admin') continue; // bypass — massiv lazım deyil

  const recs = byUser.get(uid) ?? [];
  const ids = new Set();
  for (const r of recs) {
    ids.add(r.companyId);
    const wanted = accessId(uid, r.companyId);
    if (r.id !== wanted) {
      await db.collection('userCompanyAccess').doc(wanted).set({ ...r.data }, { merge: true });
      await db.collection('userCompanyAccess').doc(r.id).update({ status: 'superseded', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      migrated++;
    }
  }
  if (ud.userType === 'client_user' && ud.homeCompanyId) ids.add(ud.homeCompanyId);

  const current = Array.isArray(ud.accessibleCompanyIds) ? ud.accessibleCompanyIds : [];
  const list = [...ids];
  if (!arrEq(current, list)) {
    await db.collection('users').doc(uid).update({ accessibleCompanyIds: list, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    repaired++;
    console.log(`  ↻ ${email || uid}: [${current.join(', ')}] → [${list.join(', ')}]`);
  }
}

console.log('────────────────────────────────────────');
console.log(`✓ Bitdi. Massiv bərpa: ${repaired}, təyinat köçürüldü: ${migrated}, super admin edildi: ${promoted}`);
process.exit(0);
JS_EOF

PROJECT="$PROJECT" TOKEN="$TOKEN" PROMOTE_EMAIL="$PROMOTE_EMAIL" node repair.mjs

echo ""
echo "✅ Tamamlandı. İndi tətbiqdə Tabel/Məzuniyyət və digər əməliyyatlar işləməlidir."
echo "   (Tətbiqi yenidən deploy etmək lazım deyil — dəyişiklik dərhal qüvvədədir.)"
cd / && rm -rf "$WORK"
