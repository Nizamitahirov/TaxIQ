# TaxIQ ERP — Modul 4: Workflow Management (Power Automate Tərzi Avtomatlaşdırma Mühərriki)

> **Sənəd statusu:** 10 fayldan 4-cüsü. Bu sənəd platformanın **"hər şirkət üçün fərqli ssenarilər üzrə fərqli workflow-lar"** tələbini ödəyən, Microsoft Power Automate-ə bənzər vizual, node-əsaslı avtomatlaşdırma mühərrikini təsvir edir. Fayl 1-dəki `sendNotification()` funksiyası və Fayl 3-ün `alert_list` widget-i bu modulla birbaşa əlaqəlidir. Fayl 6 (Satış), Fayl 9 (Hesabatlar) və Fayl 10 (HR) öz təsdiq proseslərini (invoice approval, leave approval) bu mühərrik üzərində quracaq.

---

## 0. Konseptual Əsas

Power Automate-in nüvə modeli **Trigger → Condition → Action** zəncirindən ibarətdir və vizual "canvas" üzərində node-lar birləşdirilərək qurulur. TaxIQ bu modeli **öz Firebase infrastrukturunda** təkrarlayır — xarici Microsoft xidmətindən asılılıq olmadan, tam Company-spesifik, sərbəst fərdiləşdirilə bilən daxili mühərrik kimi.

**Əsas fərq və üstünlük:** Hər Company (müştəri) öz workflow-larını **sıfırdan və ya hazır şablondan** qura bilər — məsələn, bir istehsalat şirkəti 5,000 ₼-dən yuxarı hər satınalma sorğusu üçün 2 pilləli təsdiq tələb edə bilər, halbuki eyni sistemdəki kiçik bir konsaltinq şirkəti heç bir təsdiq zənciri olmadan sadəcə bildiriş əsaslı avtomatlaşdırmalar istifadə edə bilər.

---

## 1. Memarlıq

### 1.1. Texnoloji seçim: Vizual Dizayner

| Komponent | Texnologiya | Səbəb |
|---|---|---|
| Node-əsaslı canvas | **React Flow (@xyflow/react)** | Sənayenin standart açıq-mənbə node-based UI kitabxanası (Stripe, Typeform kimi şirkətlər tərəfindən istifadə olunur), sürükləmə, yaxınlaşdırma, xüsusi node/edge tipləri doğuşdan dəstəklənir |
| Avtomatik yerləşdirmə | **elkjs** (layout engine) | Mürəkkəb workflow-ları avtomatik səliqəli düzmək üçün (istifadəçi əl ilə düzməsə belə) |
| Vəziyyət idarəsi (canvas redaktoru) | Zustand | Node/edge draft vəziyyəti, "Yadda saxla"ya qədər |

### 1.2. İki qat: Dizayn-vaxtı (Design-time) və İcra-vaxtı (Run-time)

1. **Dizayn-vaxtı:** İstifadəçi vizual redaktorda workflow qurur → `workflowDefinitions/{workflowId}` sənədi kimi Firestore-a JSON formatında saxlanılır (aşağıda 1.3).
2. **İcra-vaxtı:** Trigger baş verdikdə sistem yeni `workflowRuns/{runId}` sənədi yaradır və addım-addım icra edir (Bölmə 3).

### 1.3. `workflowDefinitions/{workflowId}` sənəd sxemi

```
workflowDefinitions/{workflowId}
├── companyId: string
├── name: string
├── description: string
├── status: 'draft' | 'active' | 'inactive'
├── version: number                    // hər "Aktivləşdir" əməliyyatında artır
├── trigger: {
│     type: 'on_create' | 'on_update' | 'scheduled' | 'manual',
│     entityType: string | null,       // "invoices" | "leaveRequests" | "employees" s. — Fayl 3, Bölmə 3.4-dəki reportable entity adları ilə eynidir
│     fieldChangeFilter: string | null,  // yalnız 'on_update' üçün: bu sahə dəyişəndə tetiklənsin (məs. "status")
│     conditionAtTrigger: { field, operator, value } | null,  // trigger anında əlavə şərt (məs. yalnız status == 'submitted' olanda)
│     cron: string | null              // yalnız 'scheduled' üçün, məs. "0 9 1 * *" (hər ayın 1-i, saat 09:00)
│   }
├── nodes: [{
│     id: string,
│     type: 'condition' | 'action' | 'approval' | 'delay' | 'parallel_split' | 'parallel_join' | 'terminate',
│     label: string,
│     config: object,                  // node tipinə görə fərqli struktur, bax Bölmə 2-4
│     position: { x: number, y: number }
│   }]
├── edges: [{
│     id: string,
│     source: string,                  // node id
│     target: string,                  // node id
│     sourceHandle: 'true' | 'false' | 'default' | null,  // condition node-larında şaxələnmə üçün
│     label: string | null
│   }]
├── createdAt, updatedAt: timestamp
└── createdBy: string
```

### 1.4. İcra Mühərriki (Execution Engine) — arxitektura qərarı

Firebase Cloud Functions **stateless** və **vaxt məhdudiyyətli** (maksimum 60 dəq, adətən daha qısa konfiqurasiya olunur) olduğu üçün uzunmüddətli workflow-lar (məs. "2 gün gözlə, sonra eskalasiya et") birbaşa bir funksiya icrası daxilində saxlanıla bilməz. Buna görə **Firestore-əsaslı vəziyyət maşını (state machine) + Cloud Tasks** kombinasiyası istifadə olunur:

1. **Trigger baş verir** → Cloud Function `workflowRuns/{runId}` sənədini `status: 'running'`, `currentNodeId: <trigger-dən-sonrakı-node>` ilə yaradır.
2. **Hər addım ayrı Cloud Function çağırışıdır:** `executeWorkflowStep(runId)` funksiyası cari node-u oxuyur, tipinə görə icra edir, nəticəyə görə `currentNodeId`-i növbəti node-a yeniləyir və **özünü yenidən çağırır** (Cloud Tasks vasitəsilə, dərhal) — beləliklə uzun zəncir bir-birini ardıcıl tetikləyən qısa funksiya çağırışlarına bölünür.
3. **`delay` node-una çatanda:** funksiya özünü dərhal çağırmır, əvəzinə **Cloud Tasks-a gecikmə ilə tapşırıq əlavə edir** (`onTaskDispatched`, `scheduleTime` parametri ilə) — bu, saniyə dəqiqliyi ilə gələcək tarixə planlaşdırma imkanı verir, `workflowRuns.status = 'waiting_delay'` olur.
4. **`approval` node-una çatanda:** funksiya `approvalTasks/{taskId}` sənədi yaradır, bildiriş göndərir (Fayl 1 `sendNotification()`), `workflowRuns.status = 'waiting_approval'` olur və **icra dayanır** — istifadəçi qərar verənə qədər heç bir Cloud Function işləmir (xərcsiz gözləmə). Qərar verildikdə (Bölmə 5) icra davam edir.
5. **Xəta baş verərsə:** `workflowRuns.status = 'failed'`, `history` massivinə xəta detalları yazılır, Company Admin-ə bildiriş gedir.

```
workflowRuns/{runId}
├── workflowId, companyId: string
├── workflowVersion: number             // icra başladığı andakı versiya (dizayn dəyişsə belə davam edən run-lar köhnə versiyada qalır)
├── triggeredBy: { type: string, entityId: string, userId: string | null }
├── status: 'running' | 'waiting_approval' | 'waiting_delay' | 'completed' | 'failed' | 'cancelled'
├── currentNodeId: string | null
├── context: { [key: string]: any }     // trigger sənədinin sahələri + addımlar boyu toplanan dəyişənlər
├── history: [{
│     nodeId: string, nodeType: string, enteredAt: timestamp, exitedAt: timestamp | null,
│     result: 'success' | 'failure' | 'pending', errorMessage: string | null
│   }]
├── startedAt, completedAt: timestamp | null
```

---

## 2. Trigger Növləri

| Trigger tipi | Təsvir | Nümunə |
|---|---|---|
| `on_create` | Müəyyən kolleksiyada yeni sənəd yaradılanda | Yeni faktura yaradıldıqda avtomatik bildiriş |
| `on_update` | Mövcud sənəd yenilənəndə (opsional: yalnız konkret sahə dəyişəndə) | İşçinin `status` sahəsi "terminated"a dəyişəndə HR checklist başlasın |
| `scheduled` | Cron ifadəsi ilə təkrarlanan | Hər ayın 1-i saat 09:00-da aylıq hesabatı generasiya et və göndər |
| `manual` | İstifadəçi konkret bir sənəd üzərində "Workflow Başlat" düyməsinə basaraq | Mühasib bir fakturaya baxaraq əl ilə "Təsdiq üçün göndər" workflow-unu tetikləyir |

**Texniki icra:** Hər `entityType` üçün **əvvəlcədən deploy olunmuş** bir Firestore trigger Cloud Function-u mövcuddur (`onInvoiceWrite`, `onLeaveRequestWrite`, `onEmployeeWrite` s. — Fayl 3, Bölmə 3.4-dəki qeydiyyatdan keçmiş entity siyahısı ilə üst-üstə düşür). Bu funksiya yazılan sənədin `companyId`-sinə uyğun **aktiv** (`status = 'active'`) workflow tərifləri arasında uyğun gələnləri Firestore sorğusu ilə tapır və hər uyğun workflow üçün yeni `workflowRuns` sənədi yaradır.

---

## 3. Condition (Şərt) Node-u

```json
{
  "type": "condition",
  "config": {
    "field": "totalAmount",
    "operator": ">",
    "value": 5000,
    "valueType": "number"
  }
}
```

- Operatorlar: `=`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `in`, `is_empty`, `is_not_empty` — Fayl 3-ün Report Builder filtr modeli ilə **eyni operator dəsti** istifadə olunur (kod təkrarının qarşısı alınır, ortaq `evaluateCondition()` köməkçi funksiyası).
- Bir Condition node-unun **iki çıxışı** var: `true` və `false` (canvas-da yaşıl/qırmızı rənglə fərqləndirilir), hər biri fərqli edge-ə bağlanır.
- Bir neçə şərtin **VƏ/VƏ YA** ilə birləşdirilməsi: `config.conditions: [...]` massivi + `config.logic: 'AND' | 'OR'` — mürəkkəb şərtlər üçün.

---

## 4. Action (Əməliyyat) Node-ları

| Action tipi | Config parametrləri | Təsvir |
|---|---|---|
| `send_notification` | `{ recipientType: 'user'\|'role'\|'trigger_creator', recipientId, titleTemplate, bodyTemplate }` | Fayl 1-in in-app bildiriş sistemini çağırır |
| `send_email` | `{ recipientEmails[], subjectTemplate, bodyTemplate }` | Xarici e-poçt (Resend/SendGrid) |
| `update_field` | `{ targetField, newValue }` | Trigger sənədinin özündəki sahəni yeniləyir (məs. `status: 'approved'`) |
| `create_task` | `{ assignedToUserId, title, dueInDays }` | Sistem daxilində "Tapşırıq" yaradır (sadə TODO obyekti, Dashboard-un `alert_list` widget-ində görünür) |
| `webhook_call` | `{ url, method, headers, bodyTemplate }` | Xarici sistemə HTTP çağırış (gələcək inteqrasiyalar üçün, məs. bank API) — **diqqət:** yalnız Company Admin tərəfindən əlavə oluna bilər, URL whitelisting tövsiyə olunur |
| `generate_document` | `{ templateId, format: 'pdf'\|'xlsx' }` | Fayl 3/6-dakı export/blank mühərrikini çağırır |

Template mətnlərində (`titleTemplate`, `bodyTemplate`) `{{context.fieldName}}` sintaksisi ilə run-vaxtı dəyərlər yerləşdirilə bilər (məs. `"{{context.customerName}} üçün faktura təsdiq gözləyir"`).

---

## 5. Approval (Təsdiq) Node-u — Ən Kritik Node Tipi

### 5.1. Konfiqurasiya

```json
{
  "type": "approval",
  "config": {
    "approvalMode": "single" ,
    "approvers": [{ "type": "role", "id": "chief_accountant_role_id" }],
    "timeoutHours": 48,
    "onTimeout": "escalate",
    "escalateTo": { "type": "user", "id": "company_admin_uid" },
    "allowComment": true,
    "rejectAction": "update_field_and_stop"
  }
}
```

| Sahə | İzah |
|---|---|
| `approvalMode` | `single` (tək təsdiqçi), `sequential` (ardıcıl — 1-ci təsdiqləyəndən sonra 2-ci görür), `parallel` (paralel — hamısına eyni anda göndərilir, hamısı təsdiqləməlidir) |
| `approvers` | İstifadəçi ID-si və ya **Rol ID-si** (rol seçilibsə, həmin Company-də bu rola malik BÜTÜN istifadəçilərə bildiriş gedir, ilk cavab verən qəbul olunur — "single" rejimində) |
| `timeoutHours` | Neçə saat ərzində cavab gəlməzsə eskalasiya/avtomatik rədd olunsun |
| `onTimeout` | `escalate` (başqa şəxsə yönləndir) və ya `auto_reject` və ya `auto_approve` (nadir hallarda istifadə olunur) |
| `escalateTo` | Eskalasiya ediləcək şəxs/rol |

### 5.2. Vəzifələrin Ayrılması (Segregation of Duties) yoxlaması

Sistem workflow icrası zamanı **`approvers` siyahısının trigger sənədini yaradan istifadəçini əhatə edib-etmədiyini yoxlayır** — əgər eyni şəxsdirsə (məs. mühasib öz yaratdığı fakturanı özü təsdiqləyə bilməsin), sistem avtomatik siyahıdan həmin şəxsi çıxarır və qalan təsdiqçilərə yönləndirir (əgər siyahı boşalarsa, Company Admin-ə fallback). Bu, Fayl 1, Bölmə 6.3-dəki SoD prinsipinin **run-time icra qatıdır** (Fayl 1-dəki xəbərdarlıq isə dizayn-vaxtı, rol qurarkəndir).

### 5.3. `approvalTasks/{taskId}` sənəd sxemi

```
approvalTasks/{taskId}
├── workflowRunId, companyId, nodeId: string
├── assignedTo: { type: 'user'|'role', id: string }
├── relatedEntityType, relatedEntityId: string    // istifadəçiyə "nəyi təsdiqləyir" göstərmək üçün
├── status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired'
├── dueAt: timestamp                              // timeoutHours-dan hesablanır
├── decision: { decidedBy: string, decidedAt: timestamp, comment: string | null } | null
├── createdAt: timestamp
```

- Bu kolleksiya Fayl 3-ün `alert_list` widget-i tərəfindən birbaşa oxunur ("Sizin təsdiqinizi gözləyən 3 element var").
- Timeout yoxlaması: Cloud Scheduler + Cloud Function hər 15 dəqiqədən bir `dueAt < now() AND status == 'pending'` olan tapşırıqları tapıb eskalasiya məntiqini tetikləyir.

### 5.4. Təsdiq/Rədd ekranı (Client tərəf)

- Bildirişə klikləyəndə istifadəçi birbaşa əlaqəli sənədə (faktura, məzuniyyət tələbi s.) yönləndirilir, səhifənin yuxarısında **"✅ Təsdiqlə" / "❌ Rədd et"** düymələri (şərh sahəsi ilə) sabit banner kimi görünür.
- Sequential approval-da 2-ci təsdiqçi 1-ci təsdiqləyənə qədər heç bir bildiriş almır (Power Automate-in "sequential" pattern-i ilə eyni məntiq).

---

## 6. Digər Node Tipləri

| Node | Config | Təsvir |
|---|---|---|
| `delay` | `{ durationMinutes: number }` və ya `{ untilDate: 'context.fieldName' }` | Cloud Tasks ilə planlaşdırılan gecikmə |
| `parallel_split` / `parallel_join` | `{ branches: [nodeId, nodeId, ...] }` | Bir neçə qol paralel işə düşür, hamısı bitəndə `parallel_join`-da birləşir (Power Automate-in Parallel Branch pattern-i) |
| `terminate` | `{ finalStatus: 'completed'\|'cancelled', message: string }` | Workflow-un son node-u |

---

## 7. Hər Company üçün Fərqli Ssenarilər — Şablon Kitabxanası

### 7.1. `workflowTemplates/{templateId}` — Sistem şablonları (bütün Company-lər üçün ortaq kataloq)

```
workflowTemplates/{templateId}
├── name: { az, en }
├── description: { az, en }
├── applicableSectors: string[] | 'all'   // Fayl 2-dəki sektor kodları
├── category: 'finance' | 'hr' | 'sales' | 'general'
├── definitionSnapshot: object            // workflowDefinitions.nodes/edges/trigger strukturunun hazır nümunəsi
└── icon: string
```

Company Admin **"+ Yeni Workflow"** düyməsinə basanda iki seçim görür: **"Sıfırdan qur"** (boş canvas) və ya **"Şablondan başla"** (kataloqdan seçim, sonra tam fərdiləşdirmə imkanı ilə canvas-a yüklənir).

### 7.2. Hazır Şablon Nümunələri

| Şablon | Sektor | Axın qısaca |
|---|---|---|
| **Faktura Təsdiqi (Məbləğ Həddi ilə)** | Bütün | `on_create` (invoices) → Condition (məbləğ > həddi) → true: Approval (Chief Accountant) → Action (status='approved') / false: Action (avtomatik təsdiq) |
| **Məzuniyyət Tələbi Təsdiqi** | Bütün | `on_create` (leaveRequests) → Approval (birbaşa rəhbər, sequential) → Action (HR modulunda balansı azalt, Fayl 10) |
| **Yeni İşçi Onboarding Checklist** | Bütün | `on_create` (employees) → Action (IT-ə tapşırıq: "Hesab yarat") + Action (HR-a tapşırıq: "Sənədləri topla") paralel → Delay (3 gün) → Action (rəhbərə xatırlatma) |
| **Vaxtı Keçmiş Faktura Xəbərdarlığı** | Bütün | `scheduled` (gündəlik) → Condition (ödəniş müddəti keçmiş fakturalar varmı) → Action (Satış Menecerinə bildiriş) |
| **Satınalma Sorğusu Təsdiqi (2 Pilləli)** | İstehsalat, Topdansatış | `on_create` (purchaseRequests) → Approval (Departament Rəhbəri) → Approval (Baş Mühasib) → Action (status='approved') |
| **Departament Xərc Təsdiqi** | Otelçilik | `on_create` (əlaqəli jurnal yazısı, departamentə görə) → Condition (departament üzrə aylıq büdcə aşılıbmı) → Approval (Baş Mühasib) |

### 7.3. Workflow Dizayner UI — funksional tələblər

- Sol panel: Node Palitrası (kateqoriya üzrə qruplaşdırılmış: Trigger, Şərt, Əməliyyat, Təsdiq, Gecikmə).
- Mərkəz: Canvas (zoom, pan, mini-map).
- Sağ panel: seçilmiş node-un konfiqurasiya forması (dinamik, node tipinə görə dəyişir).
- Üst panel: **"Test Et" (Simulate)** düyməsi — real yan-effekt (bildiriş göndərmə, sənəd yeniləmə) olmadan, nümunə data ilə hansı yolun icra olunacağını canvas üzərində rəngləyərək göstərir (yaşıl = icra olunan yol, boz = icra olunmayan).
- **"Aktivləşdir/Deaktiv et"** toggle-i — deaktiv workflow trigger-ə cavab vermir, lakin давам edən mövcud run-lar təsirlənmir.
- Versiya tarixçəsi: hər "Aktivləşdir" əməliyyatı yeni versiya yaradır, əvvəlki versiyalara baxmaq/bərpa etmək mümkündür.

---

## 8. Audit və Monitorinq

- **Workflow İcra Tarixçəsi ekranı:** bütün `workflowRuns` siyahısı (filtr: workflow adı, status, tarix aralığı), hər sətirdə "Detallara bax" → `history` massivinin vizual timeline görünüşü.
- Uğursuz (`failed`) run-lar qırmızı işarələnir, Company Admin-ə avtomatik bildiriş.
- Bütün workflow yaratma/dəyişiklik/aktivləşdirmə əməliyyatları Fayl 1-in `auditLogs`-una yazılır.
- Excel export (Fayl 3-ün Universal Export Framework-ü) `workflowRuns` cədvəlində də mövcuddur.

---

## 9. Qəbul Meyarları (Acceptance Criteria) — Modul 4

- [ ] Vizual dizaynerdə node-lar sürüklənə, birləşdirilə, konfiqurasiya edilə bilir.
- [ ] `on_create`/`on_update` trigger-ləri müvafiq kolleksiyada dəyişiklik olduqda düzgün workflow-ları tetikləyir, yalnız uyğun `companyId`-ə aid olanları.
- [ ] Condition node-u həqiqi/yalan yollarını düzgün ayırır, VƏ/VƏ YA məntiqi işləyir.
- [ ] Approval node-u sequential/parallel rejimlərində düzgün işləyir, timeout-dan sonra eskalasiya baş verir.
- [ ] Eyni istifadəçi öz yaratdığı sənədi özü təsdiqləyə bilmir (SoD run-time yoxlaması işləkdir).
- [ ] Delay node-u Cloud Tasks vasitəsilə dəqiq planlaşdırılmış vaxtda davam edir, funksiya "asılı" qalmır.
- [ ] "Test Et" rejimi heç bir real bildiriş/dəyişiklik yaratmadan icra yolunu düzgün göstərir.
- [ ] Şablon kitabxanasından workflow yaratmaq və sonra fərdiləşdirmək mümkündür.
- [ ] Bütün workflow icraları `workflowRuns`-da tam tarixçə ilə izlənilir və Excel-ə ixrac oluna bilir.
- [ ] Deaktiv edilmiş workflow yeni trigger-lərə cavab vermir, lakin davam edən run-lar tamamlanır.

---

## 10. Digər Modullara İstinadlar

- `sendNotification()` (Fayl 1) → bütün `send_notification` action node-ları tərəfindən çağırılır.
- `alert_list` widget (Fayl 3) → `approvalTasks` kolleksiyasından oxuyur.
- Fayl 1, Bölmə 6.3 (SoD xəbərdarlığı, dizayn-vaxtı) ↔ bu faylın Bölmə 5.2-si (SoD yoxlaması, icra-vaxtı) — ikisi tamamlayıcıdır.
- Fayl 6 (Satış) → "Faktura Təsdiqi" workflow-u faktura statusunu idarə edəcək, `invoices.status` sahəsinin dəyişməsi bu modul vasitəsilə baş verəcək.
- Fayl 9 (IFRS Hesabatlar) → "Aylıq Hesabat Generasiyası" scheduled workflow-u Fayl 3-ün `generateCustomReport`/export mühərrikini çağıracaq.
- Fayl 10 (HR) → "Məzuniyyət Təsdiqi" və "Yeni İşçi Onboarding" workflow-ları bu modulun approval/action node-larından istifadə edəcək, nəticə HR-ın öz kolleksiyalarına (`leaveRequests`, `employees`) yazılacaq.

**Növbəti fayl:** Modul 5 — Anbar İdarəetməsi və Mal/Xidmət Kataloqu.
