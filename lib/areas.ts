import { Landmark, BookOpen, Users, BarChart3, Settings2, HardHat, type LucideIcon } from 'lucide-react';
import { NAV_GROUPS, type AreaKey, type NavItem } from './nav';

export interface AreaDef {
  key: AreaKey;
  label: string;      // AZ
  desc: string;       // AZ qısa təsvir
  icon: LucideIcon;
  gradient: string;   // kart fonu (tailwind gradient)
  glow: string;       // kölgə rəngi
  landing: string;    // əsas keçid səhifəsi
}

/** Modul launcher blokları — 5 bölmə */
export const AREAS: AreaDef[] = [
  { key: 'tax', label: 'Vergi uçotu', desc: 'Satış, alış, ƏDV, kassa və bank əməliyyatları', icon: Landmark,
    gradient: 'from-[#6366f1] via-[#7c5cf5] to-[#8b5cf6]', glow: 'rgba(99,102,241,0.45)', landing: '/sales' },
  { key: 'accounting', label: 'Mühasibat uçotu', desc: 'Baş kitab, jurnal, yoxlama balansı, əsas vəsaitlər', icon: BookOpen,
    gradient: 'from-[#059669] via-[#0d9488] to-[#0ea5e9]', glow: 'rgba(13,148,136,0.45)', landing: '/accounting' },
  { key: 'hr', label: 'Kadr uçotu', desc: 'İşçilər, məzuniyyət, əmək haqqı və tabel', icon: Users,
    gradient: 'from-[#f59e0b] via-[#f97316] to-[#ef4444]', glow: 'rgba(249,115,22,0.45)', landing: '/hr' },
  { key: 'reports', label: 'Maliyyə hesabatları', desc: 'IFRS hesabatlar və fərdi hesabat qurucusu', icon: BarChart3,
    gradient: 'from-[#0ea5e9] via-[#3b82f6] to-[#6366f1]', glow: 'rgba(59,130,246,0.45)', landing: '/ifrs' },
  { key: 'hse', label: 'SƏTƏM uçotu', desc: 'Kitabxana, təlim jurnalı, audit və iş icazələri', icon: HardHat,
    gradient: 'from-[#f43f5e] via-[#f97316] to-[#f59e0b]', glow: 'rgba(244,63,94,0.45)', landing: '/hse' },
  { key: 'settings', label: 'Tənzimləmələr', desc: 'Şirkətlər, istifadəçilər, rollar, workflow', icon: Settings2,
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
