'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';
import { searchActivityCodes, findActivityCode, type ActivityCode } from '@/lib/activity-codes';

interface Props {
  code?: string | null;
  name?: string | null;
  onSelect: (code: string | null, name: string | null) => void;
}

/** Rəsmi 7 rəqəmli fəaliyyət kodu seçimi — kod və ya ad üzrə axtarış (lazy). */
export function ActivityCodePicker({ code, name, onSelect }: Props) {
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ActivityCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState<string>(name ?? '');
  const boxRef = useRef<HTMLDivElement>(null);

  // Seçilmiş kodun adını (yalnız kod verilibsə) doldur
  useEffect(() => {
    if (code && !name) { findActivityCode(code).then((c) => c && setLabel(c.name)); }
    else setLabel(name ?? '');
  }, [code, name]);

  // Debounced axtarış
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchActivityCodes(q, 40);
      if (!cancelled) { setResults(r); setLoading(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  // Kənara klikdə bağla
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (c: ActivityCode) => { onSelect(c.code, c.name); setLabel(c.name); setOpen(false); setQ(''); };
  const clear = () => { onSelect(null, null); setLabel(''); };

  return (
    <div className="relative" ref={boxRef}>
      {code ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">{code}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <button type="button" onClick={clear} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title={tt('Təmizlə', 'Clear')}><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={q}
            placeholder={tt('Kod və ya fəaliyyət adı ilə axtarın…', 'Search by code or activity name…')}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          />
        </div>
      )}

      {open && !code && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {tt('Axtarılır…', 'Searching…')}</div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{tt('Nəticə yoxdur', 'No results')}</div>
          ) : (
            results.map((c) => (
              <button key={c.code} type="button" onClick={() => pick(c)}
                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary">
                <span className="mt-0.5 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{c.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{c.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.parentCode} · {c.parentName}</span>
                </span>
                {code === c.code && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
