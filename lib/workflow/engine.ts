import { serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { listByCompany, createDoc } from '@/lib/firebase/firestore';
import type {
  WorkflowDefinition, WorkflowCondition, WorkflowRun, WorkflowRunStep, WorkflowAction,
} from '@/types';

const nowIso = () => new Date().toISOString();

// ── Şərt qiymətləndirməsi (03 Report Builder ilə eyni operator dəsti, 04 §3) ──
export function evaluateCondition(row: Record<string, unknown>, c: WorkflowCondition): boolean {
  const raw = row[c.field];
  const target = c.value;
  const num = (v: unknown) => Number(v);
  switch (c.operator) {
    case '=': return String(raw ?? '') === String(target ?? '');
    case '!=': return String(raw ?? '') !== String(target ?? '');
    case '>': return num(raw) > num(target);
    case '<': return num(raw) < num(target);
    case '>=': return num(raw) >= num(target);
    case '<=': return num(raw) <= num(target);
    case 'contains': return String(raw ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
    case 'is_empty': return raw == null || raw === '';
    case 'is_not_empty': return !(raw == null || raw === '');
    default: return false;
  }
}

export function evaluateConditions(row: Record<string, unknown>, conds: WorkflowCondition[] | undefined, logic: 'AND' | 'OR' = 'AND'): boolean {
  if (!conds || conds.length === 0) return true;
  return logic === 'OR' ? conds.some((c) => evaluateCondition(row, c)) : conds.every((c) => evaluateCondition(row, c));
}

/** {{context.field}} şablon dəyişənlərini doldurur */
export function renderTemplate(tpl: string, context: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*context\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(context[k] ?? ''));
}

export interface SimResult {
  triggered: boolean;
  steps: WorkflowRunStep[];
  finalStatus: WorkflowRun['status'];
}

/** Bir workflow-u sənəd üzərində simulyasiya edir (yan-effektsiz — «Test Et», 04 §7.3) */
export function simulateWorkflow(def: WorkflowDefinition, entity: Record<string, unknown>): SimResult {
  const steps: WorkflowRunStep[] = [];
  steps.push({ label: `Trigger: ${def.trigger.type}${def.trigger.entityType ? ` (${def.trigger.entityType})` : ''}`, type: 'trigger', result: 'success', at: nowIso() });

  const pass = evaluateConditions(entity, def.conditions, def.conditionLogic ?? 'AND');
  if ((def.conditions ?? []).length > 0) {
    steps.push({ label: `Şərt (${def.conditionLogic ?? 'AND'})`, type: 'condition', result: pass ? 'success' : 'failure', detail: pass ? 'true yolu' : 'false yolu — dayandırıldı', at: nowIso() });
  }
  if (!pass) return { triggered: true, steps, finalStatus: 'completed' };

  if (def.approval) {
    steps.push({ label: `Təsdiq (${def.approval.mode}) → rol: ${def.approval.approverRoleId}`, type: 'approval', result: 'pending', detail: `timeout ${def.approval.timeoutHours ?? 48}s`, at: nowIso() });
    return { triggered: true, steps, finalStatus: 'waiting_approval' };
  }
  for (const a of def.actions ?? []) steps.push(actionStep(a, entity, true));
  return { triggered: true, steps, finalStatus: 'completed' };
}

function actionStep(a: WorkflowAction, entity: Record<string, unknown>, sim: boolean): WorkflowRunStep {
  const label = a.label || a.type;
  switch (a.type) {
    case 'send_notification': return { label: `Bildiriş: ${renderTemplate(String(a.config.titleTemplate ?? ''), entity)}`, type: 'action:notify', result: 'success', at: nowIso() };
    case 'update_field': return { label: `Sahə yenilə: ${a.config.targetField} = ${a.config.newValue}`, type: 'action:update', result: 'success', detail: sim ? 'simulyasiya' : undefined, at: nowIso() };
    case 'create_task': return { label: `Tapşırıq: ${a.config.title}`, type: 'action:task', result: 'success', at: nowIso() };
    case 'generate_document': return { label: `Sənəd generasiyası (${a.config.format ?? 'pdf'})`, type: 'action:doc', result: 'skipped', detail: 'əl ilə export mövcuddur', at: nowIso() };
    default: return { label, type: 'action', result: 'skipped', at: nowIso() };
  }
}

export interface ExecOptions { entityId?: string | null; actorUid?: string | null }

/** Real icra: workflowRuns + approvalTasks + notifications + tasks + update_field yazır (04 §1.4). */
export async function executeWorkflow(def: WorkflowDefinition, entity: Record<string, unknown>, opts: ExecOptions = {}): Promise<void> {
  const db = getDb();
  const history: WorkflowRunStep[] = [{ label: `Trigger: ${def.trigger.type}`, type: 'trigger', result: 'success', at: nowIso() }];

  const pass = evaluateConditions(entity, def.conditions, def.conditionLogic ?? 'AND');
  if ((def.conditions ?? []).length > 0) history.push({ label: `Şərt (${def.conditionLogic ?? 'AND'})`, type: 'condition', result: pass ? 'success' : 'failure', at: nowIso() });

  let status: WorkflowRun['status'] = 'completed';

  // İcra sənədi (əvvəlcədən yaradılır ki, approvalTask ona bağlansın)
  const runRef = doc(db, 'workflowRuns', crypto.randomUUID());
  const base = {
    companyId: def.companyId, workflowId: def.id, workflowName: def.name, workflowVersion: def.version,
    triggeredBy: { type: def.trigger.type, entityType: def.trigger.entityType ?? null, entityId: opts.entityId ?? null, userId: opts.actorUid ?? null },
  };

  if (pass) {
    if (def.approval) {
      status = 'waiting_approval';
      await createDoc('approvalTasks', {
        companyId: def.companyId, workflowRunId: runRef.id, workflowId: def.id, workflowName: def.name,
        approverRoleId: def.approval.approverRoleId, mode: def.approval.mode,
        relatedEntityType: def.trigger.entityType ?? null, relatedEntityId: opts.entityId ?? null,
        title: `${def.name} — təsdiq gözləyir`, createdByUid: opts.actorUid ?? null, status: 'pending',
        dueAt: new Date(Date.now() + (def.approval.timeoutHours ?? 48) * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
        decision: null,
      });
      history.push({ label: `Təsdiq (${def.approval.mode}) → ${def.approval.approverRoleId}`, type: 'approval', result: 'pending', at: nowIso() });
    } else {
      await runActions(def, entity, opts, history);
    }
  }

  await setDoc(runRef, {
    ...base, status, history, completedAt: status === 'completed' ? nowIso() : null,
    startedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

/** Action-ları icra edir (təsdiqdən sonra da çağırılır) */
export async function runActions(def: WorkflowDefinition, entity: Record<string, unknown>, opts: ExecOptions, history: WorkflowRunStep[]): Promise<void> {
  for (const a of def.actions ?? []) {
    try {
      if (a.type === 'send_notification' && opts.actorUid) {
        await createDoc('notifications', {
          userId: opts.actorUid, companyId: def.companyId, type: 'workflow',
          title: renderTemplate(String(a.config.titleTemplate ?? def.name), entity),
          body: renderTemplate(String(a.config.bodyTemplate ?? ''), entity), link: '/workflow', isRead: false,
        });
      } else if (a.type === 'update_field' && def.trigger.entityType && opts.entityId) {
        await updateDoc(doc(getDb(), def.trigger.entityType, opts.entityId), { [String(a.config.targetField)]: a.config.newValue, updatedAt: serverTimestamp() });
      } else if (a.type === 'create_task') {
        await createDoc('workflowTasks', {
          companyId: def.companyId, workflowRunId: null, title: String(a.config.title ?? 'Tapşırıq'),
          assignedToUid: (a.config.assignedToUserId as string) ?? opts.actorUid ?? null,
          dueDate: a.config.dueInDays ? new Date(Date.now() + Number(a.config.dueInDays) * 86_400_000).toISOString().slice(0, 10) : null,
          status: 'open',
        });
      }
      history.push(actionStep(a, entity, false));
    } catch (e) {
      history.push({ label: a.label || a.type, type: 'action', result: 'failure', detail: e instanceof Error ? e.message : 'xəta', at: nowIso() });
    }
  }
}

/**
 * Trigger dispatcher — tətbiq bir sənəd yaradanda/yeniləyəndə çağırılır (client-side, 04 §2).
 * Yalnız aktiv (`status='active'`) və uyğun entityType/trigger-type workflow-ları işə salır.
 * Yan-effekt olmadan uğursuzluqları udur ki, əsas əməliyyat bloklanmasın.
 */
export async function fireWorkflows(
  companyId: string, entityType: string, event: 'on_create' | 'on_update',
  entity: Record<string, unknown>, entityId: string, actorUid?: string | null,
): Promise<void> {
  try {
    const defs = await listByCompany<WorkflowDefinition>('workflowDefinitions', companyId);
    const matches = defs.filter((d) => d.status === 'active' && d.trigger.type === event && d.trigger.entityType === entityType);
    for (const def of matches) {
      try { await executeWorkflow(def, entity, { entityId, actorUid: actorUid ?? null }); } catch { /* bir workflow xətası digərlərini bloklamır */ }
    }
  } catch { /* trigger sorğusu uğursuz olsa əsas əməliyyat davam edir */ }
}
