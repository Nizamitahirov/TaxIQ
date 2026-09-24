import { serverTimestamp } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById, getDocById } from './firestore';
import { createCustomer, createQuote } from './sales';
import { logAudit } from './audit';
import { defaultProbability } from '@/lib/crm/pipeline';
import type {
  Lead, Opportunity, CrmContact, Campaign, CrmActivity,
  LeadStatus, OpportunityStage, CrmActivityType, CrmEntityType, DocLineItem,
} from '@/types';

// ── Sıralama (composite index tələb etməmək üçün client-side) ──
const ts = (v: unknown) => (v && typeof v === 'object' && 'seconds' in (v as Record<string, unknown>) ? (v as { seconds: number }).seconds * 1000 : 0);
const byRecent = <T extends { createdAt?: unknown }>(a: T, b: T) => ts(b.createdAt) - ts(a.createdAt);

/** Ardıcıl nömrə generatoru (L-0001, O-0001, ...) — companyId üzrə say + 1 */
async function nextNumber(companyId: string, collection: string, prefix: string): Promise<string> {
  const rows = await listByCompany<{ id: string }>(collection, companyId);
  return `${prefix}-${String(rows.length + 1).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────
//  Leads
// ─────────────────────────────────────────────────────────────
export async function listLeads(companyId: string): Promise<Lead[]> {
  return (await listByCompany<Lead>('crmLeads', companyId)).sort(byRecent);
}
export async function getLead(id: string): Promise<Lead | null> { return getDocById<Lead>('crmLeads', id); }

export async function createLead(input: Omit<Lead, 'id' | 'leadNumber' | 'status'> & { status?: LeadStatus }): Promise<string> {
  const leadNumber = await nextNumber(input.companyId, 'crmLeads', 'L');
  const id = await createDoc('crmLeads', {
    ...input, leadNumber, status: input.status ?? 'new',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logAudit({ companyId: input.companyId, userId: input.createdBy ?? '', action: 'CRM_LEAD_CREATED', entityType: 'lead', entityId: id, after: { name: input.name } });
  return id;
}
export async function updateLead(id: string, patch: Partial<Lead>): Promise<void> {
  await updateDocById('crmLeads', id, { ...patch, updatedAt: serverTimestamp() } as Record<string, unknown>);
}
export async function deleteLead(id: string): Promise<void> { await deleteDocById('crmLeads', id); }

// ─────────────────────────────────────────────────────────────
//  Opportunities (pipeline)
// ─────────────────────────────────────────────────────────────
export async function listOpportunities(companyId: string): Promise<Opportunity[]> {
  return (await listByCompany<Opportunity>('crmOpportunities', companyId)).sort(byRecent);
}
export async function getOpportunity(id: string): Promise<Opportunity | null> { return getDocById<Opportunity>('crmOpportunities', id); }

export async function createOpportunity(input: Omit<Opportunity, 'id' | 'opportunityNumber' | 'probability'> & { probability?: number }): Promise<string> {
  const opportunityNumber = await nextNumber(input.companyId, 'crmOpportunities', 'O');
  const probability = input.probability ?? defaultProbability(input.stage);
  const id = await createDoc('crmOpportunities', {
    ...input, opportunityNumber, probability,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logAudit({ companyId: input.companyId, userId: input.createdBy ?? '', action: 'CRM_OPPORTUNITY_CREATED', entityType: 'opportunity', entityId: id, after: { title: input.title, amount: input.amount } });
  return id;
}
export async function updateOpportunity(id: string, patch: Partial<Opportunity>): Promise<void> {
  await updateDocById('crmOpportunities', id, { ...patch, updatedAt: serverTimestamp() } as Record<string, unknown>);
}
export async function deleteOpportunity(id: string): Promise<void> { await deleteDocById('crmOpportunities', id); }

/** Mərhələni dəyiş — ehtimalı sinxronlaşdırır, won/lost-da bağlayır, aktivlik yazır */
export async function setOpportunityStage(opp: Opportunity, stage: OpportunityStage, actorUid: string, actorName?: string, reason?: string): Promise<void> {
  const closing = stage === 'won' || stage === 'lost';
  await updateDocById('crmOpportunities', opp.id, {
    stage, probability: defaultProbability(stage),
    ...(closing ? { closedAt: serverTimestamp(), closeReason: reason ?? null } : {}),
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    companyId: opp.companyId, type: 'stage_change', entityType: 'opportunity', entityId: opp.id,
    entityLabel: opp.title, subject: `${opp.stage} → ${stage}`, body: reason ?? null,
    ownerUid: actorUid, ownerName: actorName ?? null, createdBy: actorUid, createdByName: actorName ?? null,
  });
  await logAudit({ companyId: opp.companyId, userId: actorUid, action: 'CRM_OPPORTUNITY_STAGE', entityType: 'opportunity', entityId: opp.id, before: { stage: opp.stage }, after: { stage } });
}

// ─────────────────────────────────────────────────────────────
//  Contacts
// ─────────────────────────────────────────────────────────────
export async function listContacts(companyId: string): Promise<CrmContact[]> {
  return (await listByCompany<CrmContact>('crmContacts', companyId)).sort(byRecent);
}
export async function createContact(input: Omit<CrmContact, 'id'>): Promise<string> {
  return createDoc('crmContacts', { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function updateContact(id: string, patch: Partial<CrmContact>): Promise<void> {
  await updateDocById('crmContacts', id, { ...patch, updatedAt: serverTimestamp() } as Record<string, unknown>);
}
export async function deleteContact(id: string): Promise<void> { await deleteDocById('crmContacts', id); }

// ─────────────────────────────────────────────────────────────
//  Campaigns
// ─────────────────────────────────────────────────────────────
export async function listCampaigns(companyId: string): Promise<Campaign[]> {
  return (await listByCompany<Campaign>('crmCampaigns', companyId)).sort(byRecent);
}
export async function createCampaign(input: Omit<Campaign, 'id'>): Promise<string> {
  return createDoc('crmCampaigns', { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<void> {
  await updateDocById('crmCampaigns', id, { ...patch, updatedAt: serverTimestamp() } as Record<string, unknown>);
}
export async function deleteCampaign(id: string): Promise<void> { await deleteDocById('crmCampaigns', id); }

// ─────────────────────────────────────────────────────────────
//  Activities (polimorfik tarixçə)
// ─────────────────────────────────────────────────────────────
export async function logActivity(input: Omit<CrmActivity, 'id'>): Promise<string> {
  return createDoc('crmActivities', { ...input, createdAt: serverTimestamp() });
}
export async function listActivities(companyId: string): Promise<CrmActivity[]> {
  return (await listByCompany<CrmActivity>('crmActivities', companyId)).sort(byRecent);
}
export async function listActivitiesFor(companyId: string, entityType: CrmEntityType, entityId: string): Promise<CrmActivity[]> {
  return (await listActivities(companyId)).filter((a) => a.entityType === entityType && a.entityId === entityId);
}
export async function toggleActivityDone(a: CrmActivity): Promise<void> {
  await updateDocById('crmActivities', a.id, { done: !a.done });
}
export async function deleteActivity(id: string): Promise<void> { await deleteDocById('crmActivities', id); }

// ─────────────────────────────────────────────────────────────
//  Çevirmələr (cross-module) — Satış modulu ilə bağ
// ─────────────────────────────────────────────────────────────

/** Lead → Müştəri (Satış modulu). Mövcud müştəri yaradır və lead-i bağlayır. */
export async function convertLeadToCustomer(lead: Lead, baseCurrency: string, actorUid: string): Promise<string> {
  const customerId = await createCustomer({
    companyId: lead.companyId,
    type: 'legal_entity',
    name: lead.name,
    taxId: null,
    defaultCurrency: lead.currency ?? baseCurrency,
    paymentTermDays: 30,
    isActive: true,
    createdBy: actorUid,
  } as Parameters<typeof createCustomer>[0]);
  await updateLead(lead.id, { status: 'converted', convertedToCustomerId: customerId });
  await logActivity({ companyId: lead.companyId, type: 'status_change', entityType: 'lead', entityId: lead.id, entityLabel: lead.name, subject: 'Müştəriyə çevrildi', ownerUid: actorUid, createdBy: actorUid });
  await logAudit({ companyId: lead.companyId, userId: actorUid, action: 'CRM_LEAD_TO_CUSTOMER', entityType: 'lead', entityId: lead.id, after: { customerId } });
  return customerId;
}

/** Lead → Satış imkanı (pipeline). Lead-i imkana bağlayır. */
export async function convertLeadToOpportunity(
  lead: Lead,
  params: { title?: string; amount: number; currency: string; stage?: OpportunityStage; expectedCloseDate?: string | null; customerId?: string | null },
  actorUid: string,
  actorName?: string,
): Promise<string> {
  const oppId = await createOpportunity({
    companyId: lead.companyId,
    title: params.title ?? lead.name,
    customerId: params.customerId ?? lead.convertedToCustomerId ?? null,
    customerName: lead.name,
    leadId: lead.id,
    stage: params.stage ?? 'qualification',
    amount: params.amount,
    currency: params.currency,
    expectedCloseDate: params.expectedCloseDate ?? null,
    source: lead.source,
    ownerUid: lead.ownerUid ?? actorUid,
    ownerName: lead.ownerName ?? actorName ?? null,
    campaignId: lead.campaignId ?? null,
    createdBy: actorUid,
  });
  await updateLead(lead.id, { status: 'converted', convertedToOpportunityId: oppId });
  await logAudit({ companyId: lead.companyId, userId: actorUid, action: 'CRM_LEAD_TO_OPPORTUNITY', entityType: 'lead', entityId: lead.id, after: { oppId } });
  return oppId;
}

/** Satış imkanı → Kommersiya təklifi (Satış modulu). Müştəri bağı tələb olunur. */
export async function opportunityToQuote(
  opp: Opportunity,
  params: { lineItems: Omit<DocLineItem, 'lineTotal'>[]; issueDate?: string; validUntil?: string | null },
  actorUid: string,
): Promise<string> {
  if (!opp.customerId) throw new Error('Əvvəlcə imkanı müştəri ilə əlaqələndirin');
  const quoteId = await createQuote({
    companyId: opp.companyId,
    customerId: opp.customerId,
    customerName: opp.customerName ?? '',
    issueDate: params.issueDate ?? new Date().toISOString().slice(0, 10),
    validUntil: params.validUntil ?? undefined,
    currency: opp.currency,
    lineItems: params.lineItems,
    createdBy: actorUid,
  });
  await updateOpportunity(opp.id, { wonQuoteId: quoteId, stage: opp.stage === 'qualification' || opp.stage === 'needs_analysis' ? 'proposal' : opp.stage, probability: defaultProbability('proposal') });
  await logActivity({ companyId: opp.companyId, type: 'note', entityType: 'opportunity', entityId: opp.id, entityLabel: opp.title, subject: 'Təklif yaradıldı (Satış)', ownerUid: actorUid, createdBy: actorUid });
  await logAudit({ companyId: opp.companyId, userId: actorUid, action: 'CRM_OPPORTUNITY_TO_QUOTE', entityType: 'opportunity', entityId: opp.id, after: { quoteId } });
  return quoteId;
}
