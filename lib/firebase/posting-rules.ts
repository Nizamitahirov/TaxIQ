import { listByCompany, setDocById, deleteDocById, getDocById } from './firestore';
import { logAudit } from './audit';
import type { PostingRule, PostingRuleLine, PostingEventType } from '@/types';

/**
 * Avtomatik Jurnal Yazısı Mənbələri (Posting Rules) — 08 §2.3.
 * Hər hadisə tipi üçün defolt hesab kodları kod-səviyyəsində təyin olunur;
 * Baş Mühasib icazəsi (`accounting.posting_rules.manage`) ilə hər şirkət
 * üçün fərdiləşdirilə bilər. Konfiqurasiya edilməyibsə defolt tətbiq olunur —
 * yəni mövcud avtomatik yazılar dəyişmədən işləməyə davam edir.
 *
 * Qeyd: bu tam server-side posting mühərriki deyil (Cloud Functions tələb etmir);
 * hər modul (satış/xəzinə/HR) yazını qurarkən `resolvePostingRule` ilə hesab
 * kodlarını həll edir və defolta geri qayıdır.
 */

export const POSTING_EVENT_LABELS: Record<PostingEventType, string> = {
  invoice_sent: 'Faktura göndərildi (Satış)',
  purchase_bill_approved: 'Kreditor faktura təsdiqləndi (Alış)',
  payment_received: 'Ödəniş alındı (Müştəridən)',
  payment_made: 'Ödəniş edildi (Kreditora)',
  salary_accrued: 'Əmək haqqı hesablandı',
  salary_paid: 'Əmək haqqı ödənildi',
  depreciation_run: 'Aylıq amortizasiya',
  fx_revaluation: 'Dövr sonu FX yenidən qiymətləndirmə',
};

/** Amount-source açarlarının insani izahı (redaktə formasında göstərilir) */
export const AMOUNT_SOURCE_LABELS: Record<string, string> = {
  grandTotal: 'Yekun məbləğ',
  subtotal: 'Vergisiz məbləğ',
  vatTotal: 'ƏDV məbləği',
  amount: 'Ödəniş məbləği',
  net: 'Net əmək haqqı',
  incomeTax: 'Gəlir vergisi',
  socialTotal: 'Sosial ayırmalar',
  cogs: 'Maya dəyəri',
  total: 'Cəm',
};

/** Kod-səviyyəli defolt qaydalar — spec §2.3 cədvəlləri ilə eynidir. */
export function defaultPostingRuleLines(eventType: PostingEventType): PostingRuleLine[] {
  switch (eventType) {
    case 'invoice_sent':
      return [
        { role: 'receivable', label: 'Debitor borcu', accountCode: '211', side: 'debit', amountSource: 'grandTotal' },
        { role: 'revenue', label: 'Satış (gəlir)', accountCode: '601', side: 'credit', amountSource: 'subtotal' },
        { role: 'vat', label: 'ƏDV öhdəliyi', accountCode: '521', side: 'credit', amountSource: 'vatTotal' },
      ];
    case 'purchase_bill_approved':
      return [
        { role: 'inventory', label: 'Mallar/Material', accountCode: '205', side: 'debit', amountSource: 'subtotal' },
        { role: 'vatInput', label: 'ƏDV (əvəzləşmə)', accountCode: '226', side: 'debit', amountSource: 'vatTotal' },
        { role: 'payable', label: 'Kreditor borcu', accountCode: '531', side: 'credit', amountSource: 'grandTotal' },
      ];
    case 'payment_received':
      return [
        { role: 'money', label: 'Bank/Kassa', accountCode: '223', side: 'debit', amountSource: 'amount' },
        { role: 'receivable', label: 'Debitor borcu', accountCode: '211', side: 'credit', amountSource: 'amount' },
        { role: 'fxGain', label: 'Məzənnə gəliri', accountCode: '633', side: 'credit', amountSource: 'fx' },
        { role: 'fxLoss', label: 'Məzənnə xərci', accountCode: '733', side: 'debit', amountSource: 'fx' },
      ];
    case 'payment_made':
      return [
        { role: 'payable', label: 'Kreditor borcu', accountCode: '531', side: 'debit', amountSource: 'amount' },
        { role: 'money', label: 'Bank/Kassa', accountCode: '223', side: 'credit', amountSource: 'amount' },
        { role: 'fxGain', label: 'Məzənnə gəliri', accountCode: '633', side: 'credit', amountSource: 'fx' },
        { role: 'fxLoss', label: 'Məzənnə xərci', accountCode: '733', side: 'debit', amountSource: 'fx' },
      ];
    case 'salary_accrued':
      return [
        { role: 'expense', label: 'Əmək haqqı xərci', accountCode: '721', side: 'debit', amountSource: 'total' },
        { role: 'payrollPayable', label: 'İşçi heyətinə borc', accountCode: '533', side: 'credit', amountSource: 'net' },
        { role: 'taxLiability', label: 'Gəlir vergisi öhdəliyi', accountCode: '521', side: 'credit', amountSource: 'incomeTax' },
        { role: 'socialLiability', label: 'Sosial sığorta öhdəliyi', accountCode: '522', side: 'credit', amountSource: 'socialTotal' },
      ];
    case 'salary_paid':
      return [
        { role: 'payrollPayable', label: 'İşçi heyətinə borc', accountCode: '533', side: 'debit', amountSource: 'net' },
        { role: 'money', label: 'Bank/Kassa', accountCode: '223', side: 'credit', amountSource: 'net' },
      ];
    case 'depreciation_run':
      return [
        { role: 'expense', label: 'Amortizasiya xərci', accountCode: '721', side: 'debit', amountSource: 'total' },
        { role: 'accumulated', label: 'Yığılmış amortizasiya', accountCode: '112', side: 'credit', amountSource: 'total' },
      ];
    case 'fx_revaluation':
      return [
        { role: 'fxGain', label: 'Məzənnə gəliri', accountCode: '633', side: 'credit', amountSource: 'fx' },
        { role: 'fxLoss', label: 'Məzənnə xərci', accountCode: '733', side: 'debit', amountSource: 'fx' },
      ];
    default:
      return [];
  }
}

export const POSTING_EVENT_TYPES: PostingEventType[] = [
  'invoice_sent', 'purchase_bill_approved', 'payment_received', 'payment_made',
  'salary_accrued', 'salary_paid', 'depreciation_run', 'fx_revaluation',
];

function ruleId(companyId: string, eventType: PostingEventType): string {
  return `${companyId}_${eventType}`;
}

/** Şirkətin saxlanmış override-larını qaytarır (yalnız fərdiləşdirilmişlər). */
export async function listPostingRules(companyId: string): Promise<PostingRule[]> {
  return listByCompany<PostingRule>('postingRules', companyId);
}

/**
 * Bir hadisə üçün effektiv qaydanı qaytarır: şirkət override-ı varsa (aktivdirsə)
 * onu, əks halda kod-səviyyəli defoltu. Nəticə həmişə etibarlıdır.
 */
export async function resolvePostingRule(companyId: string, eventType: PostingEventType): Promise<PostingRule> {
  const stored = await getDocById<PostingRule>('postingRules', ruleId(companyId, eventType));
  if (stored && stored.isActive && stored.lines?.length) return stored;
  return { id: ruleId(companyId, eventType), companyId, eventType, lines: defaultPostingRuleLines(eventType), isActive: true };
}

/** Qayda sətirlərindən verilmiş rol üçün hesab kodunu qaytarır (fallback ilə). */
export function codeFor(rule: PostingRule, role: string, fallback: string): string {
  return rule.lines.find((l) => l.role === role)?.accountCode ?? fallback;
}

/** Şirkət üçün override yadda saxlayır (upsert). */
export async function savePostingRule(companyId: string, eventType: PostingEventType, lines: PostingRuleLine[], actorUid: string): Promise<void> {
  const id = ruleId(companyId, eventType);
  await setDocById('postingRules', id, { companyId, eventType, lines, isActive: true });
  await logAudit({ companyId, userId: actorUid, action: 'POSTING_RULE_SAVED', entityType: 'postingRule', entityId: id, after: { eventType } });
}

/** Override-ı silir — defolta qayıdır. */
export async function resetPostingRule(companyId: string, eventType: PostingEventType, actorUid: string): Promise<void> {
  const id = ruleId(companyId, eventType);
  await deleteDocById('postingRules', id);
  await logAudit({ companyId, userId: actorUid, action: 'POSTING_RULE_RESET', entityType: 'postingRule', entityId: id, after: { eventType } });
}
