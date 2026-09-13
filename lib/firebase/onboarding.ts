import { addDoc, collection, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getDb } from './config';
import { createDoc } from './firestore';
import { createDepartment } from './departments';
import { assignUserToCompany } from './user-admin';
import { logAudit } from './audit';
import { SECTOR_MAP } from '@/lib/sectors';
import type { CompanyModule, CompanySettings, Sector } from '@/types';

export interface OnboardingData {
  // Addım 1
  name: string;
  legalName: string;
  taxId: string;
  legalForm: string;
  address: string;
  phone: string;
  email: string;
  directorName: string;
  // Addım 2–3
  sector: Sector;
  modulesEnabled: CompanyModule[];
  // Addım 4
  baseCurrency: string;
  fiscalYearStartMonth: number;
  language: 'az' | 'en';
  brandColor: string;
  totalRooms?: number | null;
  // Addım 5 (opsional)
  assignUserId?: string | null;
  assignRoleId?: string | null;
}

export interface CreateCompanyResult {
  companyId: string;
}

/** Sihirbazın son addımı — şirkət + şöbələr + (opsional) admin təyinatı (02 §1.2 addım 6) */
export async function createCompanyFromOnboarding(
  data: OnboardingData,
  createdBy: string,
  draftId?: string,
): Promise<CreateCompanyResult> {
  const settings: CompanySettings = {
    theme: 'system',
    language: data.language,
    fiscalYearStartMonth: data.fiscalYearStartMonth,
  };

  const companyId = await createDoc('companies', {
    name: data.name.trim(),
    legalName: data.legalName.trim(),
    taxId: data.taxId.trim(),
    legalForm: data.legalForm,
    sector: data.sector,
    sectorTemplateId: data.sector,
    isInternal: false,
    status: 'active',
    baseCurrency: data.baseCurrency,
    address: data.address,
    phone: data.phone,
    email: data.email,
    directorName: data.directorName,
    brandColor: data.brandColor || null,
    totalRooms: data.totalRooms ?? null,
    settings,
    modulesEnabled: data.modulesEnabled,
    customFieldValues: {},
    createdBy,
  });

  // Sektora uyğun defolt şöbələr (02 §4)
  const preset = SECTOR_MAP[data.sector]?.departmentPreset ?? [];
  for (let i = 0; i < preset.length; i++) {
    await createDepartment({
      companyId,
      name: preset[i],
      code: `D${String(i + 1).padStart(2, '0')}`,
      parentDepartmentId: null,
      type: data.sector === 'construction' ? 'project' : 'department',
      isActive: true,
    });
  }

  // Opsional ilkin admin təyinatı (02 §1.2 addım 5)
  if (data.assignUserId && data.assignRoleId) {
    await assignUserToCompany({
      userId: data.assignUserId, companyId, roleId: data.assignRoleId, assignedBy: createdBy,
    });
  }

  await logAudit({
    companyId, userId: createdBy, action: 'COMPANY_CREATED', entityType: 'company', entityId: companyId,
    after: { name: data.name, sector: data.sector, modules: data.modulesEnabled.length },
  });

  // Draft-ı təmizlə
  if (draftId) {
    try { await deleteDoc(doc(getDb(), 'companyDrafts', draftId)); } catch { /* ignore */ }
  }

  return { companyId };
}

/** Draft-ı saxla/yenilə (02 §1.3) */
export async function saveDraft(draftId: string | null, createdBy: string, lastStep: number, data: Partial<OnboardingData>): Promise<string> {
  if (draftId) {
    await setDoc(doc(getDb(), 'companyDrafts', draftId), {
      createdBy, lastStep, data, updatedAt: serverTimestamp(),
    }, { merge: true });
    return draftId;
  }
  const ref = await addDoc(collection(getDb(), 'companyDrafts'), {
    createdBy, lastStep, data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}
