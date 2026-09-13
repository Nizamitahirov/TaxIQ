import type { AccountType, LocalizedText } from '@/types';

/**
 * Azərbaycan Respublikası Maliyyə Nazirliyinin təsdiq etdiyi, MMUS/IFRS əsaslı
 * rəsmi Hesablar Planı şablonu (08 §1). Sinif (1-9) → Qrup (2 rəqəm) → Sintetik
 * hesab (3 rəqəm). Qrup başlıqları postable deyil; sintetik hesablar postable-dır.
 */
export interface CoaTemplateAccount {
  accountCode: string;
  accountName: LocalizedText;
  accountClass: number;
  accountGroup: string;
  accountType: AccountType;
  normalBalance: 'debit' | 'credit';
  isPostable: boolean;
  /** kontr-hesab (məs. yığılmış amortizasiya) */
  isContra?: boolean;
}

const L = (az: string, en: string): LocalizedText => ({ az, en });

function classMeta(cls: number): { type: AccountType; normal: 'debit' | 'credit' } {
  switch (cls) {
    case 1: case 2: return { type: 'asset', normal: 'debit' };
    case 3: return { type: 'equity', normal: 'credit' };
    case 4: case 5: return { type: 'liability', normal: 'credit' };
    case 6: return { type: 'income', normal: 'credit' };
    case 7: return { type: 'expense', normal: 'debit' };
    case 8: return { type: 'equity', normal: 'credit' };
    case 9: return { type: 'expense', normal: 'debit' };
    default: return { type: 'asset', normal: 'debit' };
  }
}

// Qrup başlıqları (2 rəqəm) — 08 §1.1
const GROUPS: { code: string; name: LocalizedText }[] = [
  { code: '10', name: L('Qeyri-maddi aktivlər', 'Intangible assets') },
  { code: '11', name: L('Torpaq, tikili və avadanlıqlar', 'Property, plant & equipment') },
  { code: '12', name: L('İnvestisiya mülkiyyəti', 'Investment property') },
  { code: '13', name: L('Bioloji aktivlər', 'Biological assets') },
  { code: '15', name: L('İştirak payı investisiyaları', 'Equity investments') },
  { code: '16', name: L('Təxirə salınmış vergi aktivləri', 'Deferred tax assets') },
  { code: '17', name: L('Uzunmüddətli debitor borcları', 'Long-term receivables') },
  { code: '20', name: L('Ehtiyatlar', 'Inventories') },
  { code: '21', name: L('Qısamüddətli debitor borcları', 'Short-term receivables') },
  { code: '22', name: L('Pul vəsaitləri və ekvivalentləri', 'Cash & equivalents') },
  { code: '23', name: L('Sair qısamüddətli maliyyə aktivləri', 'Other short-term financial assets') },
  { code: '30', name: L('Nizamnamə (nominal) kapital', 'Share capital') },
  { code: '33', name: L('Kapital ehtiyatları', 'Capital reserves') },
  { code: '34', name: L('Bölüşdürülməmiş mənfəət (zərər)', 'Retained earnings') },
  { code: '40', name: L('Uzunmüddətli faiz öhdəlikləri', 'Long-term interest liabilities') },
  { code: '43', name: L('Uzunmüddətli kreditor borcları', 'Long-term payables') },
  { code: '50', name: L('Qısamüddətli faiz öhdəlikləri', 'Short-term interest liabilities') },
  { code: '52', name: L('Vergi və sair məcburi ödənişlər', 'Taxes & mandatory payments') },
  { code: '53', name: L('Qısamüddətli kreditor borcları', 'Short-term payables') },
  { code: '60', name: L('Əsas əməliyyat gəliri', 'Operating revenue') },
  { code: '61', name: L('Sair əməliyyat gəlirləri', 'Other operating income') },
  { code: '63', name: L('Maliyyə gəlirləri', 'Financial income') },
  { code: '70', name: L('Satışın maya dəyəri', 'Cost of sales') },
  { code: '71', name: L('Kommersiya xərcləri', 'Commercial expenses') },
  { code: '72', name: L('İnzibati xərclər', 'Administrative expenses') },
  { code: '73', name: L('Sair əməliyyat xərcləri', 'Other operating expenses') },
  { code: '75', name: L('Maliyyə xərcləri', 'Financial expenses') },
  { code: '80', name: L('Ümumi mənfəət (zərər)', 'Gross profit (loss)') },
  { code: '90', name: L('Mənfəət vergisi xərcləri', 'Income tax expense') },
];

// Sintetik hesablar (3 rəqəm) — postable
const SYNTHETIC: { code: string; name: LocalizedText; contra?: boolean }[] = [
  { code: '101', name: L('Qeyri-maddi aktivlərin dəyəri', 'Intangible assets cost') },
  { code: '111', name: L('Torpaq, tikili və avadanlıqların dəyəri', 'PPE cost') },
  { code: '112', name: L('PPE üzrə yığılmış amortizasiya', 'Accumulated depreciation'), contra: true },
  { code: '163', name: L('Təxirə salınmış vergi aktivləri', 'Deferred tax assets') },
  { code: '201', name: L('Material ehtiyatları', 'Materials') },
  { code: '202', name: L('İstehsalat məsrəfləri', 'Work in progress') },
  { code: '204', name: L('Hazır məhsul', 'Finished goods') },
  { code: '205', name: L('Mallar', 'Goods') },
  { code: '211', name: L('Alıcıların qısamüddətli debitor borcları', 'Trade receivables') },
  { code: '217', name: L('Verilmiş avanslar', 'Advances given') },
  { code: '221', name: L('Kassa', 'Cash on hand') },
  { code: '223', name: L('Bank hesablaşma hesabları', 'Bank accounts') },
  { code: '226', name: L('ƏDV sub-uçot hesabı', 'VAT deposit account') },
  { code: '301', name: L('Nizamnamə kapitalı', 'Share capital') },
  { code: '341', name: L('Hesabat dövründə xalis mənfəət (zərər)', 'Net profit (loss) of the period') },
  { code: '344', name: L('Keçmiş illər bölüşdürülməmiş mənfəəti', 'Prior years retained earnings') },
  { code: '501', name: L('Qısamüddətli bank kreditləri', 'Short-term bank loans') },
  { code: '521', name: L('Vergi öhdəlikləri', 'Tax liabilities') },
  { code: '522', name: L('Sosial sığorta öhdəlikləri', 'Social insurance liabilities') },
  { code: '531', name: L('Malsatan və podratçılara kreditor borcları', 'Trade payables') },
  { code: '537', name: L('Alınmış avanslar', 'Advances received') },
  { code: '533', name: L('Əməyin ödənişi üzrə işçi heyətinə borclar', 'Payroll liabilities') },
  { code: '601', name: L('Satış', 'Sales revenue') },
  { code: '611', name: L('Sair əməliyyat gəlirləri', 'Other operating income') },
  { code: '631', name: L('Maliyyə gəlirləri (məzənnə fərqi daxil)', 'Financial income (incl. FX)') },
  { code: '701', name: L('Satışın maya dəyəri üzrə xərclər', 'Cost of goods sold') },
  { code: '711', name: L('Kommersiya xərcləri', 'Commercial expenses') },
  { code: '721', name: L('İnzibati xərclər', 'Administrative expenses') },
  { code: '731', name: L('Sair əməliyyat xərcləri', 'Other operating expenses') },
  { code: '751', name: L('Maliyyə xərcləri (məzənnə fərqi daxil)', 'Financial expenses (incl. FX)') },
  { code: '901', name: L('Cari mənfəət vergisi xərci', 'Current income tax expense') },
];

/** Tam şablonu (qrup başlıqları + sintetik hesablar) düzəldir */
export function buildCoaTemplate(): CoaTemplateAccount[] {
  const out: CoaTemplateAccount[] = [];
  for (const g of GROUPS) {
    const cls = Number(g.code[0]);
    const m = classMeta(cls);
    out.push({
      accountCode: g.code, accountName: g.name, accountClass: cls, accountGroup: g.code,
      accountType: m.type, normalBalance: m.normal, isPostable: false,
    });
  }
  for (const a of SYNTHETIC) {
    const cls = Number(a.code[0]);
    const group = a.code.slice(0, 2);
    const m = classMeta(cls);
    out.push({
      accountCode: a.code, accountName: a.name, accountClass: cls, accountGroup: group,
      accountType: m.type,
      normalBalance: a.contra ? (m.normal === 'debit' ? 'credit' : 'debit') : m.normal,
      isPostable: true, isContra: a.contra,
    });
  }
  return out.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
}

export const CLASS_NAMES: Record<number, LocalizedText> = {
  1: L('Uzunmüddətli Aktivlər', 'Non-current Assets'),
  2: L('Qısamüddətli Aktivlər', 'Current Assets'),
  3: L('Kapital', 'Equity'),
  4: L('Uzunmüddətli Öhdəliklər', 'Non-current Liabilities'),
  5: L('Qısamüddətli Öhdəliklər', 'Current Liabilities'),
  6: L('Gəlirlər', 'Income'),
  7: L('Xərclər', 'Expenses'),
  8: L('Mənfəətlər (Zərərlər)', 'Profit (Loss)'),
  9: L('Mənfəət Vergisi', 'Income Tax'),
};
