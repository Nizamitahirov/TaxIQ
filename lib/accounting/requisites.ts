/**
 * İlkin uçot sənədlərinin məcburi rekvizitləri.
 * «Mühasibat uçotu haqqında» Qanun, maddə 9 — ilkin sənəd aşağıdakı
 * rekvizitləri əhatə etməlidir. Rekvizit siyahısı konfiqurasiya kimi
 * saxlanılır və sənəd növünə görə genişləndirilə bilər.
 */

export type RequisiteKey =
  | 'documentName' | 'documentNumber' | 'documentDate'
  | 'parties' | 'description' | 'measurement' | 'amount'
  | 'responsiblePerson' | 'signature';

export interface RequisiteDef {
  key: RequisiteKey;
  name: { az: string; en: string };
}

/** m.9 — ilkin sənədin məcburi rekvizitləri */
export const MANDATORY_REQUISITES: RequisiteDef[] = [
  { key: 'documentName', name: { az: 'Sənədin adı', en: 'Document name' } },
  { key: 'documentNumber', name: { az: 'Sənədin nömrəsi', en: 'Document number' } },
  { key: 'documentDate', name: { az: 'Tərtib edilmə tarixi', en: 'Date of issue' } },
  { key: 'parties', name: { az: 'Tərəflərin adı (VÖEN)', en: 'Parties (TIN)' } },
  { key: 'description', name: { az: 'Təsərrüfat əməliyyatının məzmunu', en: 'Transaction description' } },
  { key: 'measurement', name: { az: 'Ölçü vahidi və miqdarı', en: 'Unit & quantity' } },
  { key: 'amount', name: { az: 'Dəyər (məbləğ)', en: 'Amount' } },
  { key: 'responsiblePerson', name: { az: 'Məsul şəxsin vəzifəsi', en: 'Responsible person' } },
  { key: 'signature', name: { az: 'İmza', en: 'Signature' } },
];

/** Sənəd obyektində bir rekvizitin dolu olub-olmadığını yoxlayan tip */
export type RequisiteValues = Partial<Record<RequisiteKey, unknown>>;

const isFilled = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v;
  return true;
};

export interface RequisiteCheck {
  valid: boolean;
  missing: RequisiteDef[];
  present: RequisiteKey[];
  completeness: number; // 0–1
}

/** Verilmiş sənədin məcburi rekvizitlərini yoxlayır (m.9) */
export function checkRequisites(values: RequisiteValues, required: RequisiteDef[] = MANDATORY_REQUISITES): RequisiteCheck {
  const missing: RequisiteDef[] = [];
  const present: RequisiteKey[] = [];
  for (const def of required) {
    if (isFilled(values[def.key])) present.push(def.key);
    else missing.push(def);
  }
  return {
    valid: missing.length === 0,
    missing,
    present,
    completeness: required.length ? present.length / required.length : 1,
  };
}

/**
 * Faktura/qaimə kimi satış sənədini rekvizit yoxlamasına uyğunlaşdırır.
 * (ümumi sahə adlarından istifadə edir — sistemdəki müxtəlif sənədlərə şamil olunur)
 */
export function invoiceToRequisites(doc: {
  invoiceNumber?: string; issueDate?: string; customerName?: string;
  lineItems?: unknown[]; grandTotal?: number; createdBy?: string;
}): RequisiteValues {
  return {
    documentName: 'Elektron qaimə-faktura',
    documentNumber: doc.invoiceNumber,
    documentDate: doc.issueDate,
    parties: doc.customerName,
    description: doc.lineItems,
    measurement: doc.lineItems,
    amount: doc.grandTotal,
    responsiblePerson: doc.createdBy,
    signature: doc.createdBy, // elektron imza = yaradan
  };
}
