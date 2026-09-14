import { where, orderBy } from 'firebase/firestore';
import { listByCompany, getDocById, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import { runActions } from '@/lib/workflow/engine';
import type {
  WorkflowDefinition, WorkflowRun, WorkflowRunStep, ApprovalTask, WorkflowTaskItem,
  PendingApproval, LeaveRequest, PayrollRun, Invoice, PurchaseBill,
} from '@/types';

// ── Workflow tərifləri ───────────────────────────────────────
export const listWorkflows = (companyId: string) => listByCompany<WorkflowDefinition>('workflowDefinitions', companyId);

export async function createWorkflow(d: Omit<WorkflowDefinition, 'id'>): Promise<string> {
  return createDoc('workflowDefinitions', d as Record<string, unknown>);
}
export async function updateWorkflow(id: string, d: Partial<WorkflowDefinition>): Promise<void> {
  return updateDocById('workflowDefinitions', id, d as Record<string, unknown>);
}
export async function deleteWorkflow(id: string): Promise<void> {
  return deleteDocById('workflowDefinitions', id);
}
export async function toggleWorkflow(wf: WorkflowDefinition, actorUid: string): Promise<void> {
  const next = wf.status === 'active' ? 'inactive' : 'active';
  await updateWorkflow(wf.id, { status: next, version: next === 'active' ? wf.version + 1 : wf.version });
  await logAudit({ companyId: wf.companyId, userId: actorUid, action: 'WORKFLOW_TOGGLED', entityType: 'workflowDefinition', entityId: wf.id, after: { status: next } });
}

// ── İcra tarixçəsi (workflowRuns, 04 §8) ────────────────────
export const listWorkflowRuns = (companyId: string) => listByCompany<WorkflowRun>('workflowRuns', companyId, [orderBy('createdAt', 'desc')]);

// ── Təsdiq tapşırıqları (approvalTasks, 04 §5.3) ────────────
export const listApprovalTasks = (companyId: string) => listByCompany<ApprovalTask>('approvalTasks', companyId, [orderBy('createdAt', 'desc')]);
export const listWorkflowTasks = (companyId: string) => listByCompany<WorkflowTaskItem>('workflowTasks', companyId, [orderBy('createdAt', 'desc')]);

/**
 * Təsdiq qərarı — SoD run-time yoxlaması (04 §5.2): istifadəçi öz yaratdığı
 * sənədi təsdiqləyə bilməz. Təsdiqdən sonra qalan action-lar icra olunur.
 */
export async function decideApprovalTask(task: ApprovalTask, approve: boolean, deciderUid: string, comment: string | null): Promise<void> {
  if (approve && task.createdByUid && task.createdByUid === deciderUid) {
    throw new Error('Vəzifələrin ayrılması (SoD): öz yaratdığınız sənədi təsdiqləyə bilməzsiniz.');
  }
  await updateDocById('approvalTasks', task.id, {
    status: approve ? 'approved' : 'rejected',
    decision: { decidedBy: deciderUid, decidedAt: new Date().toISOString(), comment: comment ?? null },
  });

  const run = await getDocById<WorkflowRun>('workflowRuns', task.workflowRunId);
  const def = await getDocById<WorkflowDefinition>('workflowDefinitions', task.workflowId);
  const history: WorkflowRunStep[] = [...(run?.history ?? [])];
  history.push({ label: approve ? 'Təsdiqləndi' : 'Rədd edildi', type: 'approval', result: approve ? 'success' : 'failure', detail: comment ?? undefined, at: new Date().toISOString() });

  if (approve && def) {
    let entity: Record<string, unknown> = {};
    if (task.relatedEntityType && task.relatedEntityId) {
      entity = (await getDocById<Record<string, unknown>>(task.relatedEntityType, task.relatedEntityId)) ?? {};
    }
    await runActions(def, entity, { entityId: task.relatedEntityId ?? null, actorUid: task.createdByUid ?? null }, history);
  }

  await updateDocById('workflowRuns', task.workflowRunId, {
    status: approve ? 'completed' : 'cancelled', history, completedAt: new Date().toISOString(),
  });
  await logAudit({ companyId: task.companyId, userId: deciderUid, action: approve ? 'WORKFLOW_APPROVED' : 'WORKFLOW_REJECTED', entityType: 'approvalTask', entityId: task.id });
}

// ── Birləşdirilmiş təsdiq/tapşırıq inbox (04 §5.3, alert_list) ──
/**
 * Cloud Functions icra mühərriki olmadan, təsdiq gözləyən real elementləri
 * bütün modullardan toplayır (client-side). Avtomatik event-triggered icra
 * (Firestore triggers + Cloud Tasks, 04 §1.4) gələcək Cloud Functions fazasıdır.
 */
export async function aggregatePendingApprovals(companyId: string): Promise<PendingApproval[]> {
  const [leaves, runs, invoices, bills] = await Promise.all([
    listByCompany<LeaveRequest>('leaveRequests', companyId, [where('status', '==', 'pending')]),
    listByCompany<PayrollRun>('payrollRuns', companyId, [where('status', '==', 'calculated')]),
    listByCompany<Invoice>('invoices', companyId, [where('status', '==', 'draft')]),
    listByCompany<PurchaseBill>('purchaseBills', companyId, [where('status', '==', 'draft')]),
  ]);

  const out: PendingApproval[] = [];
  for (const l of leaves) out.push({ kind: 'leave', id: l.id, title: `Məzuniyyət: ${l.employeeName ?? ''}`, subtitle: `${l.leaveTypeName ?? ''} · ${l.totalDays} gün`, link: '/hr' });
  for (const r of runs) out.push({ kind: 'payroll', id: r.id, title: `Əmək haqqı dövrü ${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`, subtitle: `${r.lines.length} işçi təsdiq gözləyir`, amount: r.totalNet, currency: 'AZN', link: '/payroll' });
  for (const inv of invoices) out.push({ kind: 'invoice_draft', id: inv.id, title: `Faktura ${inv.invoiceNumber}`, subtitle: `${inv.customerName ?? ''} · rəsmiləşdirmə gözləyir`, amount: inv.grandTotal, currency: inv.currency, link: '/sales' });
  for (const b of bills) out.push({ kind: 'bill_draft', id: b.id, title: `Kreditor faktura ${b.billNumber}`, subtitle: `${b.vendorName ?? ''} · təsdiq gözləyir`, amount: b.grandTotal, currency: b.currency, link: '/cashbank' });
  return out;
}

export { where };
