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
  { key: 'crm', label: L('CRM (Satış pipeline)', 'CRM (Sales pipeline)') },
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
    defaultModulesEnabled: ['workflow', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
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
    code: 'catering',
    name: L('İctimai İaşə', 'Catering / Food Service'), icon: 'UtensilsCrossed',
    description: L('Restoran/kafe — reseptlər, porsiya maya dəyəri, sürətli satış', 'Restaurant/café — recipes, portion costing, quick sale'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Mətbəx', 'Kitchen'), L('Zal / Servis', 'Dining / Service'), L('Bar', 'Bar'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['sales.total_sales', 'sales.avg_invoice', 'accounting.gross_margin', 'warehouse.low_stock'],
    customFieldDefinitions: [{ fieldKey: 'seat_count', label: L('Oturacaq sayı', 'Seat count'), type: 'number', appliesToEntity: 'department' }],
    notes: L('Xammal → hazır yemək (sadə resept/BOM); sürətli satış rejimi tövsiyə olunur.', 'Raw → prepared dish (simple recipe/BOM); quick-sale mode recommended.'),
  },
  {
    code: 'agriculture',
    name: L('Kənd Təsərrüfatı', 'Agriculture'), icon: 'Sprout',
    description: L('Bitkiçilik/heyvandarlıq — sahə/sürü uçotu, məhsul yığımı, mövsümilik', 'Crop/livestock — field & herd tracking, harvest, seasonality'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('İstehsal (Sahə)', 'Production (Field)'), L('Anbar', 'Warehouse'), L('Satış', 'Sales'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['warehouse.inventory_value', 'accounting.revenue', 'accounting.gross_margin'],
    customFieldDefinitions: [
      { fieldKey: 'field_area_ha', label: L('Sahə (hektar)', 'Field area (ha)'), type: 'number', appliesToEntity: 'department' },
      { fieldKey: 'crop_type', label: L('Bitki/heyvan növü', 'Crop/livestock type'), type: 'text', appliesToEntity: 'goods' },
    ],
    notes: L('Bioloji aktivlər (IAS 41) sadələşdirilmiş qaydada; mövsümi maya dəyəri toplanması.', 'Biological assets (IAS 41) simplified; seasonal cost accumulation.'),
  },
  {
    code: 'transport',
    name: L('Nəqliyyat / Logistika', 'Transport / Logistics'), icon: 'Truck',
    description: L('Yük/sərnişin daşıma — avtopark, reys uçotu, yanacaq və CMR', 'Freight/passenger — fleet, trip logs, fuel & CMR'),
    defaultModulesEnabled: ['workflow', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Avtopark', 'Fleet'), L('Logistika', 'Logistics'), L('Satış', 'Sales'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['accounting.revenue', 'accounting.gross_margin', 'accounting.dso'],
    customFieldDefinitions: [
      { fieldKey: 'vehicle_plate', label: L('Nəqliyyat vasitəsi (nömrə)', 'Vehicle plate'), type: 'text', appliesToEntity: 'department' },
      { fieldKey: 'route', label: L('Marşrut', 'Route'), type: 'text', appliesToEntity: 'sales' },
    ],
    notes: L('Nəqliyyat vasitələri əsas vəsait kimi; yanacaq/təmir xərcləri layihə/reys ölçüsü ilə izlənir.', 'Vehicles as fixed assets; fuel/repair tracked by trip dimension.'),
  },
  {
    code: 'education',
    name: L('Təhsil', 'Education'), icon: 'GraduationCap',
    description: L('Məktəb/kurs/universitet — tələbə, təlim haqqı, dövrə əsaslı gəlir', 'School/course/university — students, tuition, period-based revenue'),
    defaultModulesEnabled: ['workflow', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Tədris', 'Academic'), L('Qeydiyyat', 'Registration'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['accounting.revenue', 'accounting.dso', 'hr.active_employees'],
    customFieldDefinitions: [
      { fieldKey: 'program_name', label: L('Proqram / Kurs', 'Program / Course'), type: 'text', appliesToEntity: 'sales' },
      { fieldKey: 'student_count', label: L('Tələbə sayı', 'Student count'), type: 'number', appliesToEntity: 'department' },
    ],
    notes: L('Təlim haqqı gələcək dövrlərə aid olduqda təxirə salınmış gəlir (deferred revenue) kimi tanınır.', 'Tuition for future periods recognised as deferred revenue.'),
  },
  {
    code: 'rental_leasing',
    name: L('İcarə / Lizinq', 'Rental / Leasing'), icon: 'KeyRound',
    description: L('Əmlak/avadanlıq icarəsi — müqavilə qrafiki, dövri fakturalaşdırma', 'Property/equipment rental — contract schedule, recurring invoicing'),
    defaultModulesEnabled: ['workflow', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs'],
    departmentPreset: [L('İcarə İdarəetməsi', 'Rental Management'), L('Baş Ofis', 'Head Office')],
    recommendedKpis: ['accounting.revenue', 'accounting.dso', 'sales.total_sales'],
    customFieldDefinitions: [
      { fieldKey: 'asset_ref', label: L('İcarə obyekti', 'Rented asset'), type: 'text', appliesToEntity: 'sales' },
      { fieldKey: 'contract_end', label: L('Müqavilə bitmə tarixi', 'Contract end date'), type: 'date', appliesToEntity: 'sales' },
    ],
    notes: L('IFRS 16 icarə uçotu sadələşdirilmiş; dövri (aylıq) faktura qrafiki tövsiyə olunur.', 'IFRS 16 lease accounting simplified; recurring monthly invoicing recommended.'),
  },
  {
    code: 'tourism',
    name: L('Turizm / Səyahət', 'Tourism / Travel'), icon: 'Plane',
    description: L('Turagentlik — tur paketləri, rezervasiya, komissiya gəliri', 'Travel agency — tour packages, bookings, commission revenue'),
    defaultModulesEnabled: ['workflow', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Satış / Rezervasiya', 'Sales / Booking'), L('Operatorluq', 'Operations'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['sales.total_sales', 'accounting.revenue', 'accounting.gross_margin'],
    customFieldDefinitions: [
      { fieldKey: 'destination', label: L('İstiqamət', 'Destination'), type: 'text', appliesToEntity: 'sales' },
      { fieldKey: 'pax_count', label: L('Turist sayı', 'Pax count'), type: 'number', appliesToEntity: 'sales' },
    ],
    notes: L('Komissiya əsaslı gəlirdə yalnız xalis marja tanınır (agent vs prinsipal — IFRS 15).', 'Commission-based revenue recognises net margin (agent vs principal — IFRS 15).'),
  },
  {
    code: 'public_sector',
    name: L('İctimai Sektor / QHT', 'Public Sector / NGO'), icon: 'Landmark',
    description: L('Büdcə təşkilatı/QHT — smeta, qrant/maliyyələşmə, təyinatlı xərc', 'Budget entity/NGO — estimates, grants, earmarked spending'),
    defaultModulesEnabled: ['workflow', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Maliyyə', 'Finance'), L('Layihələr / Qrantlar', 'Projects / Grants'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['accounting.revenue', 'accounting.gross_margin'],
    customFieldDefinitions: [
      { fieldKey: 'funding_source', label: L('Maliyyələşmə mənbəyi', 'Funding source'), type: 'text', appliesToEntity: 'department' },
      { fieldKey: 'budget_line', label: L('Smeta maddəsi', 'Budget line'), type: 'text', appliesToEntity: 'accounting' },
    ],
    notes: L('Smeta/büdcə uçotu önəmlidir; qrant/təyinatlı vəsaitlər ayrıca ölçü (dimension) ilə izlənir.', 'Estimate/budget accounting is central; grants tracked as a separate dimension.'),
  },
  {
    code: 'medical',
    name: L('Tibb / Klinika', 'Medical / Clinic'), icon: 'Stethoscope',
    description: L('Klinika/apteek — xidmət+dərman uçotu, sığorta hesablaşmaları', 'Clinic/pharmacy — service + drug tracking, insurance settlements'),
    defaultModulesEnabled: ['workflow', 'warehouse', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll'],
    departmentPreset: [L('Qəbul / Reqistratura', 'Reception'), L('Müalicə', 'Treatment'), L('Aptek / Anbar', 'Pharmacy / Warehouse'), L('İnzibati', 'Administrative')],
    recommendedKpis: ['sales.total_sales', 'accounting.revenue', 'accounting.dso', 'warehouse.low_stock'],
    customFieldDefinitions: [
      { fieldKey: 'service_category', label: L('Xidmət kateqoriyası', 'Service category'), type: 'text', appliesToEntity: 'sales' },
      { fieldKey: 'insurer', label: L('Sığorta şirkəti', 'Insurer'), type: 'text', appliesToEntity: 'sales' },
    ],
    notes: L('Dərman anbarı (partiya/son istifadə tarixi) + xidmət kataloqu; sığorta debitor kimi izlənir.', 'Drug inventory (lot/expiry) + service catalog; insurers tracked as receivables.'),
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
