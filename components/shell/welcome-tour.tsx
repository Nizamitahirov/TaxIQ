'use client';

import { useState } from 'react';
import { LayoutGrid, Command, Plus, ListChecks, ArrowRight, ArrowLeft, Sparkles, type LucideIcon } from 'lucide-react';
import { useTT } from '@/lib/i18n/tt';
import { cn } from '@/lib/utils/cn';

interface Step { icon: LucideIcon; title: string; body: string; gradient: string }

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tt = useTT();
  const [i, setI] = useState(0);
  const STEPS: Step[] = [
    { icon: LayoutGrid, title: tt('İş sahələri', 'Workspaces'), body: tt('TaxIQ 5 iş sahəsinə bölünüb — Vergi, Mühasibat, Kadr, Maliyyə hesabatları və Tənzimləmələr. Sol zolaqdan bir kliklə keçid edin; menyu yalnız həmin sahəni göstərir.', 'TaxIQ is split into workspaces — Tax, Accounting, HR, Financial statements and Settings. Switch from the left rail; the menu shows only that workspace.'), gradient: 'from-[#6366f1] to-[#8b5cf6]' },
    { icon: Command, title: tt('Komanda paneli', 'Command palette'), body: tt('⌘K (və ya Ctrl+K) istənilən yerdən açılır — səhifə, əməliyyat və hətta müştəri/faktura/hesab axtarışı. Klaviaturadan çıxmadan hər yerə keçin.', '⌘K (or Ctrl+K) opens anywhere — pages, actions and even customer/invoice/account search. Go anywhere without leaving the keyboard.'), gradient: 'from-[#0ea5e9] to-[#6366f1]' },
    { icon: Plus, title: tt('Sürətli yaratma', 'Quick create'), body: tt('Yuxarıdakı "Yarat" düyməsi (və ya C) cari sahəyə uyğun ən çox istifadə olunan sənədləri təklif edir — faktura, jurnal yazısı, işçi və s.', 'The "Create" button (or C) suggests the most-used documents for the current workspace — invoice, journal entry, employee, etc.'), gradient: 'from-[#059669] to-[#0ea5e9]' },
    { icon: ListChecks, title: tt('Tapşırıqlar və qısayollar', 'Tasks and shortcuts'), body: tt('Hub səhifəsində şəxsi tapşırıqlarınız və tamamlanma faizi var. Bütün klaviatura qısayollarını görmək üçün istənilən vaxt "?" düyməsini basın.', 'The hub shows your personal tasks and completion rate. Press "?" any time to see all keyboard shortcuts.'), gradient: 'from-[#f59e0b] to-[#ef4444]' },
  ];
  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className={cn('relative flex h-40 items-center justify-center bg-gradient-to-br', s.gradient)}>
          <div aria-hidden className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-sm"><s.icon className="h-9 w-9" /></span>
          <span className="absolute left-4 top-4 flex items-center gap-1.5 text-xs font-semibold text-white/90"><Sparkles className="h-3.5 w-3.5" /> {tt('TaxIQ-ə xoş gəldiniz', 'Welcome to TaxIQ')}</span>
        </div>
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {STEPS.map((_, k) => <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-primary' : 'w-1.5 bg-secondary')} />)}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="text-sm font-medium text-muted-foreground hover:text-foreground">{tt('Keç', 'Skip')}</button>
          <div className="flex items-center gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /> {tt('Geri', 'Back')}</button>}
            <button onClick={() => (last ? onClose() : setI(i + 1))} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              {last ? tt('Başlayaq', "Let's start") : tt('Növbəti', 'Next')} {!last && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
