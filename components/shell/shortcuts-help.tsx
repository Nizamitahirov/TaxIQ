'use client';

import { Drawer } from '@/components/ui/drawer';

const GROUPS: { title: string; rows: { keys: string[]; label: string }[] }[] = [
  { title: 'Ümumi', rows: [
    { keys: ['⌘', 'K'], label: 'Komanda paneli / axtarış' },
    { keys: ['C'], label: 'Yarat menyusu' },
    { keys: ['?'], label: 'Bu kömək paneli' },
  ] },
  { title: 'Naviqasiya (g sonra…)', rows: [
    { keys: ['G', 'H'], label: 'Bölmələr (Hub)' },
    { keys: ['G', 'D'], label: 'Dashboard' },
    { keys: ['G', 'S'], label: 'Satış' },
    { keys: ['G', 'A'], label: 'Anbar' },
    { keys: ['G', 'M'], label: 'Mühasibat' },
    { keys: ['G', 'K'], label: 'Kadrlar' },
    { keys: ['G', 'R'], label: 'Hesabatlar (IFRS)' },
    { keys: ['G', 'C'], label: 'Kassa/Bank' },
  ] },
  { title: 'Panel daxilində', rows: [
    { keys: ['↑', '↓'], label: 'Elementlər arası' },
    { keys: ['↵'], label: 'Seç' },
    { keys: ['Esc'], label: 'Bağla' },
  ] },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Klaviatura qısayolları" description="Sürətli naviqasiya üçün">
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <div className="space-y-1.5">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm">
                  <span className="text-foreground/85">{r.label}</span>
                  <span className="flex items-center gap-1">
                    {r.keys.map((k, i) => <kbd key={i} className="min-w-[22px] rounded border border-border bg-secondary px-1.5 py-0.5 text-center text-[11px] font-semibold">{k}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
