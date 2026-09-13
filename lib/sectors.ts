import type { CompanyModule, LocalizedText, Sector } from '@/types';

/** Sektor üçün fərdi sahə tərifi — 02 §7 */
export interface CustomFieldDef {
  fieldKey: string;
  label: LocalizedText;
  type: 'text' | 'number' | 'date' | 'select';
  appliesToEntity: string;
  options?: string[];
}

export interface SectorTemplate {
  code: Sector;
  name: LocalizedText;
  description: LocalizedText;
  icon: string; // lucide icon adı
  /** Dashboard/RBAC həmişə aktivdir — bura yalnız söndürülə bilən modullar yazılır (02 §2.2) */
  defaultModulesEnabled: CompanyModule[];
  /** İstifadəçinin əl ilə dəyişə biləcəyi modullar (matris) */
  departmentPreset: LocalizedText[];
  recommendedKpis: string[];
  customFieldDefinitions: CustomFieldDef[];
  notes: LocalizedText;
}

const L = (az: string, en: string): LocalizedText => ({ az, en });

/** Söndürülə bilən bütün modullar (matris sütunları) — 02 §2.2 */
export const TOGGLEABLE_MODULES: { key: CompanyModule; label: LocalizedText }[] = [
  { key: 'workflow', label: L('İş axını', 'Workflow') },
  { key: 'warehouse', label: L('Anbar + Mal/Xidmət', 'Warehouse + Goods') },
  { key: 'sales', label: L('Satış + Faktura', 'Sales + Invoicing') },
  { key: 'cashbank', label: L('Kassa/Bank', 'Cash/Bank') },
  { key: 'accounting', label: L('Mühasibat Nüvəsi', 'Accounting Core') },
  { key: 'ifrs', label: L('IFRS Hesabatlar', 'IFRS Reports') },
  { key: 'hr', label: L('HR', 'HR') },
  { key: 'payroll', label: L('Əmək Haqqı', 'Payroll') },
];

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    code: 'manufacturing',
    name: L('İstehsalat', 'Manufacturing'), icon: 'Factory',
    description: L('Xammal → hazır məhsul; FIFO/orta çəkili dəyərləndirmə', 'Raw → finished goods; FIFO/weighted-average'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs'],
    departmentPreset: [L('İstehsal', 'Production'), L('Anbar', 'Warehouse'), L('Satış', 'Sales'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['warehouse.inventory_value', 'accounting.revenue', 'accounting.gross_margin'],
    customFieldDefinitions: [{ fieldKey: 'workshop_code', label: L('İstehsal sexi kodu', 'Workshop code'), type: 'text', appliesToEntity: 'goods' }],
    notes: L('Tam MRP/BOM gələcək fazadır; ilkin versiyada sadə anbar əməliyyatları.', 'Full MRP/BOM is future phase.'),
  },
  {
    code: 'retail',
    name: L('Pərakəndə Satış', 'Retail'), icon: 'Store',
    description: L('Çoxfilial, sürətli satış rejimi, qiymət siyahıları', 'Multi-branch, quick-sale, price lists'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs'],
    departmentPreset: [L('Mağaza 1', 'Store 1'), L('Baş Ofis', 'Head Office')],
    recommendedKpis: ['sales.total_sales', 'sales.avg_invoice', 'warehouse.low_stock'],
    customFieldDefinitions: [{ fieldKey: 'store_area_m2', label: L('Mağaza sahəsi (m²)', 'Store area (m²)'), type: 'number', appliesToEntity: 'department' }],
    notes: L('quickSaleModeEnabled Satış modulunu sadələşdirir (Fayl 6).', 'quickSaleModeEnabled simplifies Sales.'),
  },
  {
    code: 'hospitality',
    name: L('Otelçilik', 'Hospitality'), icon: 'Hotel',
    description: L('USALI struktur, departament P&L, RevPAR/ADR/GOPPAR', 'USALI, departmental P&L, RevPAR/ADR'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Otaq (Rooms)', 'Rooms'), L('Yemək-İçki (F&B)', 'F&B'), L('SPA', 'SPA'), L('Baş İdarəetmə', 'Management')],
    recommendedKpis: ['hospitality.revpar', 'hospitality.adr', 'hospitality.occupancy', 'hospitality.goppar'],
    customFieldDefinitions: [{ fieldKey: 'total_rooms', label: L('Ümumi otaq sayı', 'Total rooms'), type: 'number', appliesToEntity: 'company' }],
    notes: L('TaxIQ PMS deyil — otaq gəliri manual/CSV import ilə daxil edilir.', 'TaxIQ is not a PMS.'),
  },
  {
    code: 'services',
    name: L('Xidmət / Konsaltinq', 'Services / Consulting'), icon: 'Briefcase',
    description: L('Xidmətlər kataloqu, saat-əsaslı fakturalaşdırma (TaxIQ-ın öz profili)', 'Service catalog, billable hours'),
    defaultModulesEnabled: ['workflow', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Mühasibat Xidmətləri', 'Accounting Services'), L('HR Xidmətləri', 'HR Services'), L('Vergi Konsaltinqi', 'Tax Consulting'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['accounting.revenue', 'accounting.dso', 'hr.active_employees'],
    customFieldDefinitions: [],
    notes: L('Anbar defolt deaktivdir; xidmətlər kataloqu istifadə olunur.', 'Warehouse off by default; service catalog used.'),
  },
  {
    code: 'wholesale_distribution',
    name: L('Topdansatış / Distribusiya', 'Wholesale / Distribution'), icon: 'PackageSearch',
    description: L('Alış-satış dövriyyəsi, B2B qiymət siyahıları', 'Trade cycle, B2B price lists'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs'],
    departmentPreset: [L('Satınalma', 'Procurement'), L('Anbar/Logistika', 'Warehouse/Logistics'), L('Satış', 'Sales')],
    recommendedKpis: ['warehouse.inventory_value', 'sales.total_sales', 'accounting.dpo'],
    customFieldDefinitions: [{ fieldKey: 'min_order_qty', label: L('Minimum sifariş miqdarı', 'Min order qty'), type: 'number', appliesToEntity: 'goods' }],
    notes: L('İstehsalata bənzər anbar, lakin BOM/istehsal yoxdur.', 'Warehouse like manufacturing, no BOM.'),
  },
  {
    code: 'construction',
    name: L('Tikinti', 'Construction'), icon: 'HardHat',
    description: L('Layihə-əsaslı maya dəyəri (job costing) — departament = layihə', 'Project-based job costing'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Obyekt 1', 'Project 1')],
    recommendedKpis: ['accounting.revenue', 'accounting.gross_margin'],
    customFieldDefinitions: [],
    notes: L('Hər tikinti obyekti Department/dimension (type: project) kimi.', 'Each site is a project dimension.'),
  },
  {
    code: 'other',
    name: L('Digər / Fərdi', 'Other / Custom'), icon: 'Shapes',
    description: L('Heç bir defolt tətbiq olunmur — tam sərbəst seçim', 'No defaults — fully manual'),
    defaultModulesEnabled: [],
    departmentPreset: [],
    recommendedKpis: [],
    customFieldDefinitions: [],
    notes: L('Boş hesablar planı ilə başlayır.', 'Starts with empty chart of accounts.'),
  },
];

export const SECTOR_MAP: Record<string, SectorTemplate> = Object.fromEntries(
  SECTOR_TEMPLATES.map((s) => [s.code, s]),
);

export const LEGAL_FORMS = ['MMC', 'ASC', 'QSC', 'Fərdi Sahibkar', 'Publik Hüquqi Şəxs', 'Kooperativ', 'Digər'];
