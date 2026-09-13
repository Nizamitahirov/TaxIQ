import { where } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type {
  WorkflowDefinition, PendingApproval, LeaveRequest, PayrollRun, Invoice, PurchaseBill,
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
