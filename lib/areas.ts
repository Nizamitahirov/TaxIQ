import { Landmark, BookOpen, Users, BarChart3, Settings2, HardHat, Store, Warehouse, type LucideIcon } from 'lucide-react';
import { NAV_GROUPS, type AreaKey, type NavItem } from './nav';

export interface AreaDef {
  key: AreaKey;
  label: string;      // AZ
  labelEn: string;    // EN
  desc: string;       // AZ qısa təsvir
  descEn: string;     // EN
  icon: LucideIcon;
  gradient: string;   // kart fonu (tailwind gradient)
  glow: string;       // kölgə rəngi
  landing: string;    // əsas keçid səhifəsi
}

/** Modul launcher blokları — məntiqli iş sahələri */
export const AREAS: AreaDef[] = [
  { key: 'sales', label: 'Satış və CRM', labelEn: 'Sales & CRM', desc: 'CRM, satış, qaimə-fakturalar, müqavilələr, kredit/debet notları', descEn: 'CRM, sales, invoices, contracts, credit/debit notes', icon: Store,
    gradient: 'from-[#ed1c24] via-[#f2541b] to-[#ff7a00]', glow: 'rgba(237,28,36,0.42)', landing: '/crm' },
  { key: 'supply', label: 'Təchizat və Anbar', labelEn: 'Supply & Inventory', desc: 'Alış sifarişləri, anbar, istehsal', descEn: 'Purchase orders, warehouse, production', icon: Warehouse,
    gradient: 'from-[#ff7a00] via-[#fb8c00] to-[#f7a81b]', glow: 'rgba(255,122,0,0.42)', landing: '/purchase-orders' },
  { key: 'accounting', label: 'Mühasibat uçotu', labelEn: 'Accounting', desc: 'Baş kitab, jurnal, yoxlama balansı, əsas vəsaitlər', descEn: 'General ledger, journal, trial balance, fixed assets', icon: BookOpen,
    gradient: 'from-[#e11d48] via-[#ed1c24] to-[#f2541b]', glow: 'rgba(225,29,72,0.42)', landing: '/accounting' },
  { key: 'finance', label: 'Maliyyə', labelEn: 'Finance', desc: 'Kassa/bank, IFRS hesabatlar, büdcə, pul axını', descEn: 'Cash/bank, IFRS statements, budget, cash flow', icon: BarChart3,
    gradient: 'from-[#f2541b] via-[#ff7a00] to-[#f7a81b]', glow: 'rgba(242,84,27,0.42)', landing: '/ifrs' },
  { key: 'tax', label: 'Vergi uçotu', labelEn: 'Tax accounting', desc: 'Bəyannamələr, vergi təqvimi, fəaliyyət kodları', descEn: 'Returns, tax calendar, activity codes', icon: Landmark,
    gradient: 'from-[#c4121a] via-[#ed1c24] to-[#f2541b]', glow: 'rgba(196,18,26,0.42)', landing: '/tax' },
  { key: 'hr', label: 'Kadr və Əmək haqqı', labelEn: 'HR & Payroll', desc: 'İşçilər, məzuniyyət, əmək haqqı, tabel, işə qəbul', descEn: 'Employees, leave, payroll, timesheet, recruitment', icon: Users,
    gradient: 'from-[#ff7a00] via-[#f97316] to-[#ed1c24]', glow: 'rgba(249,115,22,0.42)', landing: '/hr' },
  { key: 'hse', label: 'SƏTƏM uçotu', labelEn: 'HSE', desc: 'Kitabxana, təlim jurnalı, audit və iş icazələri', descEn: 'Library, training register, audit and work permits', icon: HardHat,
    gradient: 'from-[#e11d48] via-[#f43f5e] to-[#ff7a00]', glow: 'rgba(244,63,94,0.42)', landing: '/hse' },
  { key: 'settings', label: 'Tənzimləmələr', labelEn: 'Settings', desc: 'Şirkətlər, istifadəçilər, rollar, workflow, alətlər', descEn: 'Companies, users, roles, workflow, tools', icon: Settings2,
    gradient: 'from-[#9a1b1f] via-[#ed1c24] to-[#5b5560]', glow: 'rgba(154,27,31,0.40)', landing: '/settings' },
];

export function areaDef(key: AreaKey): AreaDef | undefined {
  return AREAS.find((a) => a.key === key);
}

/** Bölməyə aid bütün nav elementləri */
export function itemsForArea(area: AreaKey): NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.area === area);
}

/** Cari path hansı bölməyə aiddir (yoxdursa null — hub/dashboard) */
export function areaForPath(path: string): AreaKey | null {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (it.area && (path === it.href || path.startsWith(it.href + '/'))) return it.area;
    }
  }
  return null;
}
