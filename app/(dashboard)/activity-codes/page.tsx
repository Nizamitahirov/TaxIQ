'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, Hash, ExternalLink, CalendarDays, BookMarked } from 'lucide-react';
import { useTT } from '@/lib/i18n/tt';
import { searchActivityCodes, type ActivityCode } from '@/lib/activity-codes';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Vergi uçotu — rəsmi bağlantılar (Excel: Vahid standartlar, Vergi təqvimi) */
const REFS = [
  { az: 'Vahid standartlar (İFNVS)', en: 'Unified standards (IFNVS)', href: 'https://xidmet.info/vahid-standartlar/ifnvs/', icon: BookMarked },
  { az: 'Vergi təqvimi (taxes.gov.az)', en: 'Tax calendar (taxes.gov.az)', href: 'https://www.taxes.gov.az/az/page/vergi-teqvimi', icon: CalendarDays },
];

export default function ActivityCodesPage() {
  const tt = useTT();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ActivityCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchActivityCodes(q, 100);
      if (!cancelled) { setRows(r); setLoading(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  return (
    <div>
      <PageHeader
        title={tt('Fəaliyyət kodları', 'Activity codes')}
        subtitle={tt('Rəsmi 7 rəqəmli fəaliyyət kodları (2775 kod) — kod və ya ad üzrə axtarın', 'Official 7-digit activity codes (2775) — search by code or name')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {REFS.map((r) => (
          <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:text-primary">
            <r.icon className="h-4 w-4" /> {tt(r.az, r.en)} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt('Kod və ya fəaliyyət adı ilə axtarın…', 'Search by code or activity name…')} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Nəticə yoxdur', 'No results')} />
        : (
          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead className="w-28">{tt('Kod', 'Code')}</TableHead>
              <TableHead>{tt('Fəaliyyət növü', 'Activity')}</TableHead>
              <TableHead>{tt('Baza (5 rəqəmli)', 'Base (5-digit)')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.code}>
                  <TableCell><span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-primary"><Hash className="h-3.5 w-3.5" />{c.code}</span></TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.parentCode} · {c.parentName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div></CardContent></Card>
        )}
      {!loading && rows.length >= 100 && <p className="mt-3 text-xs text-muted-foreground">{tt('İlk 100 nəticə göstərilir — daha dəqiq axtarış üçün kod və ya ad yazın.', 'Showing the first 100 — refine with a code or name.')}</p>}
    </div>
  );
}
