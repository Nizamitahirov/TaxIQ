import { getDocById, setDocById, listByCompany } from './firestore';
import { logAudit } from './audit';
import type { FinancialStatementTemplate } from '@/types';
import type { FinancialStatement } from '@/lib/ifrs/engine';

type StmtType = FinancialStatementTemplate['statementType'];

function tplId(companyId: string, statementType: StmtType): string {
  return `${companyId}_${statementType}`;
}

export async function getStatementTemplate(companyId: string, statementType: StmtType): Promise<FinancialStatementTemplate | null> {
  return getDocById<FinancialStatementTemplate>('financialStatementTemplates', tplId(companyId, statementType));
}

export async function listStatementTemplates(companyId: string): Promise<FinancialStatementTemplate[]> {
  return listByCompany<FinancialStatementTemplate>('financialStatementTemplates', companyId);
}

export async function saveStatementTemplate(
  companyId: string, statementType: StmtType,
  patch: Pick<FinancialStatementTemplate, 'titleOverride' | 'showComparative' | 'renames' | 'hidden'>,
  actorUid: string,
): Promise<void> {
  const id = tplId(companyId, statementType);
  await setDocById('financialStatementTemplates', id, { companyId, statementType, ...patch });
  await logAudit({ companyId, userId: actorUid, action: 'STMT_TEMPLATE_SAVED', entityType: 'financialStatementTemplate', entityId: id, after: { statementType } });
}

/** Şablonu generasiya olunmuş hesabata tətbiq edir (kodsuz fərdiləşdirmə — 09 §9). */
export function applyStatementTemplate(stmt: FinancialStatement, tpl: FinancialStatementTemplate | null | undefined): FinancialStatement {
  if (!tpl) return stmt;
  const hidden = new Set(tpl.hidden ?? []);
  const renames = tpl.renames ?? {};
  return {
    ...stmt,
    title: tpl.titleOverride?.trim() || stmt.title,
    rows: stmt.rows.filter((r) => !hidden.has(r.label)).map((r) => renames[r.label] ? { ...r, label: renames[r.label] } : r),
  };
}
