'use client';

import { useState } from 'react';
import { LayoutGrid, Command, Plus, ListChecks, ArrowRight, ArrowLeft, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Step { icon: LucideIcon; title: string; body: string; gradient: string }
const STEPS: Step[] = [
  { icon: LayoutGrid, title: 'İş sahələri', body: 'TaxIQ 5 iş sahəsinə bölünüb — Vergi, Mühasibat, Kadr, Maliyyə hesabatları və Tənzimləmələr. Sol zolaqdan bir kliklə keçid edin; menyu yalnız həmin sahəni göstərir.', gradient: 'from-[#6366f1] to-[#8b5cf6]' },
  { icon: Command, title: 'Komanda paneli', body: '⌘K (və ya Ctrl+K) istənilən yerdən açılır — səhifə, əməliyyat və hətta müştəri/faktura/hesab axtarışı. Klaviaturadan çıxmadan hər yerə keçin.', gradient: 'from-[#0ea5e9] to-[#6366f1]' },
  { icon: Plus, title: 'Sürətli yaratma', body: 'Yuxarıdakı "Yarat" düyməsi (və ya C) cari sahəyə uyğun ən çox istifadə olunan sənədləri təklif edir — faktura, jurnal yazısı, işçi və s.', gradient: 'from-[#059669] to-[#0ea5e9]' },
  { icon: ListChecks, title: 'Tapşırıqlar və qısayollar', body: 'Hub səhifəsində şəxsi tapşırıqlarınız və tamamlanma faizi var. Bütün klaviatura qısayollarını görmək üçün istənilən vaxt "?" düyməsini basın.', gradient: 'from-[#f59e0b] to-[#ef4444]' },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
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
          <span className="absolute left-4 top-4 flex items-center gap-1.5 text-xs font-semibold text-white/90"><Sparkles className="h-3.5 w-3.5" /> TaxIQ-ə xoş gəldiniz</span>
        </div>
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {STEPS.map((_, k) => <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-primary' : 'w-1.5 bg-secondary')} />)}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="text-sm font-medium text-muted-foreground hover:text-foreground">Keç</button>
          <div className="flex items-center gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /> Geri</button>}
            <button onClick={() => (last ? onClose() : setI(i + 1))} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              {last ? 'Başlayaq' : 'Növbəti'} {!last && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
