import type { Lead, LeadSource, Opportunity, OpportunityStage } from '@/types';

/** Pipeline mərhələləri — sıra, standart ehtimal və rəng (ERPNext-üstü model) */
export interface StageDef {
  key: OpportunityStage;
  az: string;
  en: string;
  /** standart bağlanma ehtimalı (%) */
  probability: number;
  /** açıq mərhələ (pipeline-də göstərilir) */
  open: boolean;
  tint: string; // tailwind text rəng sinfi
  bar: string;  // tailwind bg rəng sinfi
}

export const STAGES: StageDef[] = [
  { key: 'qualification', az: 'İxtisaslaşma', en: 'Qualification', probability: 10, open: true, tint: 'text-sky-500', bar: 'bg-sky-500' },
  { key: 'needs_analysis', az: 'Ehtiyac təhlili', en: 'Needs analysis', probability: 30, open: true, tint: 'text-indigo-500', bar: 'bg-indigo-500' },
  { key: 'proposal', az: 'Təklif', en: 'Proposal', probability: 55, open: true, tint: 'text-violet-500', bar: 'bg-violet-500' },
  { key: 'negotiation', az: 'Danışıqlar', en: 'Negotiation', probability: 80, open: true, tint: 'text-amber-500', bar: 'bg-amber-500' },
  { key: 'won', az: 'Uğurlu (qazanıldı)', en: 'Won', probability: 100, open: false, tint: 'text-emerald-500', bar: 'bg-emerald-500' },
  { key: 'lost', az: 'İtirildi', en: 'Lost', probability: 0, open: false, tint: 'text-rose-500', bar: 'bg-rose-500' },
];

export const STAGE_MAP: Record<OpportunityStage, StageDef> = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<OpportunityStage, StageDef>;
export const OPEN_STAGES = STAGES.filter((s) => s.open);

/** Mərhələyə görə standart ehtimal */
export function defaultProbability(stage: OpportunityStage): number {
  return STAGE_MAP[stage]?.probability ?? 0;
}

/** Çəkili proqnoz (weighted forecast) — açıq imkanlar üzrə amount × probability */
export function weightedForecast(opps: Opportunity[]): number {
  return opps
    .filter((o) => STAGE_MAP[o.stage]?.open)
    .reduce((s, o) => s + (o.amount || 0) * (o.probability ?? defaultProbability(o.stage)) / 100, 0);
}

/** Açıq pipeline dəyəri (çəkisiz) */
export function openPipelineValue(opps: Opportunity[]): number {
  return opps.filter((o) => STAGE_MAP[o.stage]?.open).reduce((s, o) => s + (o.amount || 0), 0);
}

/** Uğur nisbəti — won / (won + lost) */
export function winRate(opps: Opportunity[]): number {
  const won = opps.filter((o) => o.stage === 'won').length;
  const lost = opps.filter((o) => o.stage === 'lost').length;
  const total = won + lost;
  return total === 0 ? 0 : Math.round((won / total) * 100);
}

/** Funnel — mərhələ üzrə say və dəyər */
export function funnel(opps: Opportunity[]): { stage: StageDef; count: number; value: number }[] {
  return STAGES.map((stage) => {
    const rows = opps.filter((o) => o.stage === stage.key);
    return { stage, count: rows.length, value: rows.reduce((s, o) => s + (o.amount || 0), 0) };
  });
}

const SOURCE_SCORE: Record<LeadSource, number> = {
  referral: 30, partner: 25, inbound: 22, campaign: 18, website: 15, event: 15, social: 12, cold_call: 8, other: 5,
};

/**
 * Lead qiymətləndirmə (0–100) — mənbə, təmas məlumatlarının tamlığı,
 * təxmini dəyər və status əsasında sadə heuristik bal.
 */
export function scoreLead(lead: Pick<Lead, 'source' | 'email' | 'phone' | 'estimatedValue' | 'status' | 'industry'>): number {
  let s = SOURCE_SCORE[lead.source] ?? 5;
  if (lead.email) s += 15;
  if (lead.phone) s += 15;
  if (lead.industry) s += 8;
  const v = lead.estimatedValue ?? 0;
  if (v > 0) s += Math.min(20, Math.round(v / 5000)); // hər 5000 üçün +1, maks +20
  if (lead.status === 'contacted') s += 5;
  if (lead.status === 'qualified') s += 12;
  return Math.max(0, Math.min(100, s));
}
