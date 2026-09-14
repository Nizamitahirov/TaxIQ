import { orderBy } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import type { ReportTemplate } from '@/types';

/** Hesabat/Export şablonları — 03 §3.4: sütun seçimi/adlandırılması/sırası saxlanılır. */
export const listReportTemplates = (companyId: string) =>
  listByCompany<ReportTemplate>('reportTemplates', companyId, [orderBy('createdAt', 'desc')]);

export const createReportTemplate = (d: Omit<ReportTemplate, 'id'>) =>
  createDoc('reportTemplates', d as Record<string, unknown>);

export const updateReportTemplate = (id: string, d: Partial<ReportTemplate>) =>
  updateDocById('reportTemplates', id, d as Record<string, unknown>);

export const deleteReportTemplate = (id: string) => deleteDocById('reportTemplates', id);
