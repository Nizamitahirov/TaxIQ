import type { BankFileFormat, PaymentOrderItem } from '@/types';

/** Bank fayl formatında istifadə oluna bilən sahələr (07 §1.2) */
export const BANK_FILE_FIELDS: { key: string; label: string }[] = [
  { key: 'beneficiaryIban', label: 'Benefisiar IBAN' },
  { key: 'beneficiaryName', label: 'Benefisiar adı' },
  { key: 'amount', label: 'Məbləğ' },
  { key: 'purposeText', label: 'Ödəniş təyinatı' },
];

function fieldValue(item: PaymentOrderItem, key: string): string {
  switch (key) {
    case 'beneficiaryIban': return item.beneficiaryIban;
    case 'beneficiaryName': return item.beneficiaryName;
    case 'amount': return item.amount.toFixed(2);
    case 'purposeText': return item.purposeText;
    default: return '';
  }
}

/**
 * Seçilmiş bank format profilinə uyğun toplu ödəniş faylının məzmununu qurur (07 §4.3).
 * Sütun sırası, sabit dəyərlər, ayırıcı və başlıq profildən götürülür.
 * Qeyd: encoding sahəsi bankın tələbini sənədləşdirir; brauzerdə fayl UTF-8 (BOM ilə)
 * generasiya olunur — köhnə bank sistemləri Windows-1254 tələb edərsə, fayl endirildikdən
 * sonra mətn redaktorunda konvertasiya oluna bilər.
 */
export function buildBankFileContent(format: BankFileFormat, items: PaymentOrderItem[]): { content: string; filename: string } {
  const cols = [...format.columns].sort((a, b) => a.order - b.order);
  const rows: string[] = [];
  if (format.includeHeader) rows.push(cols.map((c) => c.fieldKey).join(format.delimiter));
  for (const item of items) {
    rows.push(cols.map((c) => c.staticValue != null && c.staticValue !== '' ? c.staticValue : fieldValue(item, c.fieldKey)).join(format.delimiter));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return { content: rows.join('\r\n'), filename: `${format.bankName.replace(/\s+/g, '-')}-${format.fileType}-${stamp}.${format.fileExtension}` };
}

export function downloadBankFile(format: BankFileFormat, items: PaymentOrderItem[]): void {
  const { content, filename } = buildBankFileContent(format, items);
  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Standart başlanğıc format profili (fərdiləşdirilə bilər) */
export function defaultBankFormat(companyId: string, bankName: string): Omit<BankFileFormat, 'id'> {
  return {
    companyId, bankName, fileType: 'salary_bulk', fileExtension: 'txt', delimiter: ';', encoding: 'UTF-8',
    includeHeader: false,
    columns: [
      { fieldKey: 'beneficiaryIban', order: 1, staticValue: null },
      { fieldKey: 'beneficiaryName', order: 2, staticValue: null },
      { fieldKey: 'amount', order: 3, staticValue: null },
      { fieldKey: 'purposeText', order: 4, staticValue: null },
    ],
    notes: 'Bankın rəsmi Korporativ İnternet Banking təlimatından sütun sırasını təsdiqləyin.',
  };
}
