'use client';

import { Drawer } from '@/components/ui/drawer';
import { useTT } from '@/lib/i18n/tt';

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tt = useTT();
  const groups: { title: string; rows: { keys: string[]; label: string }[] }[] = [
    { title: tt('Ümumi', 'General'), rows: [
      { keys: ['⌘', 'K'], label: tt('Komanda paneli / axtarış', 'Command palette / search') },
      { keys: ['C'], label: tt('Yarat menyusu', 'Create menu') },
      { keys: ['?'], label: tt('Bu kömək paneli', 'This help panel') },
    ] },
    { title: tt('Naviqasiya (g sonra…)', 'Navigation (g then…)'), rows: [
      { keys: ['G', 'H'], label: tt('Bölmələr (Hub)', 'Workspaces (Hub)') },
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'S'], label: tt('Satış', 'Sales') },
      { keys: ['G', 'A'], label: tt('Anbar', 'Warehouse') },
      { keys: ['G', 'M'], label: tt('Mühasibat', 'Accounting') },
      { keys: ['G', 'K'], label: tt('Kadrlar', 'HR') },
      { keys: ['G', 'R'], label: tt('Hesabatlar (IFRS)', 'Reports (IFRS)') },
      { keys: ['G', 'C'], label: tt('Kassa/Bank', 'Cash/Bank') },
    ] },
    { title: tt('Panel daxilində', 'Inside a panel'), rows: [
      { keys: ['↑', '↓'], label: tt('Elementlər arası', 'Between items') },
      { keys: ['↵'], label: tt('Seç', 'Select') },
      { keys: ['Esc'], label: tt('Bağla', 'Close') },
    ] },
  ];

  return (
    <Drawer open={open} onClose={onClose} title={tt('Klaviatura qısayolları', 'Keyboard shortcuts')} description={tt('Sürətli naviqasiya üçün', 'For quick navigation')}>
      <div className="space-y-5">
        {groups.map((g) => (
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
