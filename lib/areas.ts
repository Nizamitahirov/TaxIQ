import { Landmark, BookOpen, Users, BarChart3, Settings2, HardHat, type LucideIcon } from 'lucide-react';
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

/** Modul launcher blokları — 5 bölmə */
export const AREAS: AreaDef[] = [
  { key: 'tax', label: 'Vergi uçotu', labelEn: 'Tax accounting', desc: 'Satış, alış, ƏDV, kassa və bank əməliyyatları', descEn: 'Sales, purchases, VAT, cash and bank', icon: Landmark,
    gradient: 'from-[#6366f1] via-[#7c5cf5] to-[#8b5cf6]', glow: 'rgba(99,102,241,0.45)', landing: '/sales' },
  { key: 'accounting', label: 'Mühasibat uçotu', labelEn: 'Accounting', desc: 'Baş kitab, jurnal, yoxlama balansı, əsas vəsaitlər', descEn: 'General ledger, journal, trial balance, fixed assets', icon: BookOpen,
    gradient: 'from-[#059669] via-[#0d9488] to-[#0ea5e9]', glow: 'rgba(13,148,136,0.45)', landing: '/accounting' },
  { key: 'hr', label: 'Kadr uçotu', labelEn: 'HR & Payroll', desc: 'İşçilər, məzuniyyət, əmək haqqı və tabel', descEn: 'Employees, leave, payroll and timesheet', icon: Users,
    gradient: 'from-[#f59e0b] via-[#f97316] to-[#ef4444]', glow: 'rgba(249,115,22,0.45)', landing: '/hr' },
  { key: 'reports', label: 'Maliyyə hesabatları', labelEn: 'Financial statements', desc: 'IFRS hesabatlar və fərdi hesabat qurucusu', descEn: 'IFRS statements and custom report builder', icon: BarChart3,
    gradient: 'from-[#0ea5e9] via-[#3b82f6] to-[#6366f1]', glow: 'rgba(59,130,246,0.45)', landing: '/ifrs' },
  { key: 'hse', label: 'SƏTƏM uçotu', labelEn: 'HSE', desc: 'Kitabxana, təlim jurnalı, audit və iş icazələri', descEn: 'Library, training register, audit and work permits', icon: HardHat,
    gradient: 'from-[#f43f5e] via-[#f97316] to-[#f59e0b]', glow: 'rgba(244,63,94,0.45)', landing: '/hse' },
  { key: 'settings', label: 'Tənzimləmələr', labelEn: 'Settings', desc: 'Şirkətlər, istifadəçilər, rollar, workflow', descEn: 'Companies, users, roles, workflow', icon: Settings2,
    gradient: 'from-[#8b5cf6] via-[#6366f1] to-[#334155]', glow: 'rgba(100,116,139,0.4)', landing: '/settings' },
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
