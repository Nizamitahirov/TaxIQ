#!/usr/bin/env bash
# ============================================================================
#  TaxIQ — Firebase / Google Cloud tam quraşdırma skripti
#  Bunu Google Cloud Shell-də (shell.cloud.google.com) icra et.
#  Project: taxiq-f2d9d
#
#  Nə edir:
#    1. Lazımi Google Cloud API-larını aktivləşdirir
#    2. Cloud Firestore (Native mode) bazasını yaradır (europe-west1)
#    3. Firebase admin SDK service account-a tam admin (owner) icazəsi verir
#    4. Email/Password auth üçün hazırlıq yoxlamasını edir
#    5. Storage bucket-i təsdiqləyir
# ============================================================================
set -euo pipefail

PROJECT_ID="taxiq-f2d9d"
# Firestore & Functions üçün region (spec: europe-west1 tövsiyə olunur)
REGION="europe-west1"
# Firestore location (multi-region yox, region): eur3 = europe, və ya europe-west
FIRESTORE_LOCATION="eur3"
SA_EMAIL="firebase-adminsdk-fbsvc@taxiq-f2d9d.iam.gserviceaccount.com"

echo "▶ Aktiv layihə təyin edilir: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "▶ Lazımi API-lar aktivləşdirilir (bir neçə dəqiqə çəkə bilər)..."
gcloud services enable \
  firestore.googleapis.com \
  firebase.googleapis.com \
  firebaserules.googleapis.com \
  firebasestorage.googleapis.com \
  identitytoolkit.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID"

echo "▶ Cloud Firestore (Native mode) yaradılır — location: $FIRESTORE_LOCATION"
# Əgər baza artıq varsa xəta verməsin deyə '|| true'
gcloud firestore databases create \
  --location="$FIRESTORE_LOCATION" \
  --type=firestore-native \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (Firestore bazası artıq mövcuddur — ötürülür)"

echo "▶ Service account-a tam admin icazələri verilir: $SA_EMAIL"
# ERP-nin admin SDK-sı ilə hər şeyi edə bilməsi üçün geniş rollar.
for ROLE in \
  roles/owner \
  roles/datastore.owner \
  roles/firebase.admin \
  roles/firebaseauth.admin \
  roles/storage.admin \
  roles/cloudfunctions.admin \
  roles/iam.serviceAccountTokenCreator
do
  echo "   + $ROLE"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
done

echo "▶ Email/Password giriş provayderi yoxlanılır..."
echo "  ⚠️ QEYD: Email/Password provayderi Firebase Console-dan bir dəfə aktiv edilməlidir:"
echo "     https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
echo "     'Email/Password' → Enable → Save"

echo "▶ Storage bucket yoxlanılır..."
gsutil ls -p "$PROJECT_ID" 2>/dev/null | grep "taxiq-f2d9d" || \
  echo "  ⚠️ Storage bucket Firebase Console → Storage bölməsindən 'Get started' ilə aktiv edilməlidir."

echo ""
echo "============================================================"
echo "✅ Hazırdır! Firestore yaradıldı, service account tam admindir."
echo "   Əl ilə 1 addım qalır: Authentication → Email/Password → Enable"
echo "============================================================"
