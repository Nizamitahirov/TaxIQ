/**
 * Dashboard fərdiləşdirmə — 03 §5: istifadəçi widget-ləri göstərib/gizlədə və
 * sıralaya bilir; dəyişiklik «Yadda saxla»dan sonra qalıcılaşır (istifadəçi + şirkət
 * üzrə localStorage). Cloud Function tələb etmədən cihazlar arası olmadan işləyir.
 */
export interface DashItem { key: string; label: string }

/** Sıralana/gizlədilə bilən qrafik widget-ləri (aşağı qrafik şəbəkəsi) */
export const DASH_CHART_WIDGETS: DashItem[] = [
  { key: 'revenueTrend', label: 'Gəlir trendi və kümulyativ' },
  { key: 'collection', label: 'Yığım faizi (collection)' },
  { key: 'statusDist', label: 'Faktura statusu' },
  { key: 'aging', label: 'Debitor yaş analizi' },
  { key: 'topCustomers', label: 'Top müştərilər (qrafik)' },
  { key: 'summary', label: 'İcmal' },
];

/** Yalnız göstər/gizlə edilən tam-en bölmələr */
export const DASH_SECTIONS: DashItem[] = [
  { key: 'alerts', label: 'Xəbərdarlıqlar' },
  { key: 'recentInvoices', label: 'Son fakturalar' },
];

export interface DashConfig {
  order: string[];   // qrafik widget açarlarının sırası
  hidden: string[];  // gizlədilmiş açarlar (həm qrafik, həm bölmə)
}

const DEFAULT: DashConfig = { order: DASH_CHART_WIDGETS.map((w) => w.key), hidden: [] };

function keyFor(uid: string, companyId: string): string {
  return `taxiq_dash_${uid || 'anon'}_${companyId}`;
}

export function loadDashConfig(uid: string, companyId: string): DashConfig {
  try {
    const raw = localStorage.getItem(keyFor(uid, companyId));
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<DashConfig>;
    const known = new Set(DASH_CHART_WIDGETS.map((w) => w.key));
    // Yeni əlavə olunan widget-ləri də sona qat, naməlumları at
    const order = (parsed.order ?? []).filter((k) => known.has(k));
    for (const w of DASH_CHART_WIDGETS) if (!order.includes(w.key)) order.push(w.key);
    return { order, hidden: parsed.hidden ?? [] };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveDashConfig(uid: string, companyId: string, cfg: DashConfig): void {
  try { localStorage.setItem(keyFor(uid, companyId), JSON.stringify(cfg)); } catch { /* ignore */ }
}

export const isHidden = (cfg: DashConfig, key: string) => cfg.hidden.includes(key);
export const orderedCharts = (cfg: DashConfig) => cfg.order.filter((k) => !cfg.hidden.includes(k));
