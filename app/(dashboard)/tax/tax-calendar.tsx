'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { upcomingDeadlines, type CompanyTaxProfile } from '@/lib/tax/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTT } from '@/lib/i18n/tt';

export function TaxCalendar({ defaultVatPayer, stored }: { defaultVatPayer: boolean; stored?: { regime?: string; vatRegistered?: boolean; ownsProperty?: boolean; ownsLand?: boolean } }) {
  const tt = useTT();
  const [profile, setProfile] = useState<CompanyTaxProfile>({
    vatPayer: stored?.vatRegistered ?? defaultVatPayer,
    simplifiedPayer: stored?.regime === 'simplified',
    hasEmployees: true,
    ownsProperty: stored?.ownsProperty ?? false,
    ownsLand: stored?.ownsLand ?? false,
  });
  const deadlines = upcomingDeadlines(profile, new Date(), 6);

  const toggle = (k: keyof CompanyTaxProfile) => setProfile((p) => ({ ...p, [k]: !p[k] }));
  const CHECKS: { k: keyof CompanyTaxProfile; az: string; en: string }[] = [
    { k: 'simplifiedPayer', az: 'Sadələşdirilmiş', en: 'Simplified' },
    { k: 'vatPayer', az: 'ƏDV ödəyicisi', en: 'VAT payer' },
    { k: 'hasEmployees', az: 'İşçiləri var', en: 'Has employees' },
    { k: 'ownsProperty', az: 'Əmlak', en: 'Property' },
    { k: 'ownsLand', az: 'Torpaq', en: 'Land' },
  ];

  return (
    <Card className="rounded-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> {tt('Vergi təqvimi — yaxınlaşan son tarixlər', 'Tax calendar — upcoming deadlines')} <Badge variant="secondary">{tt('6 ay', '6 mo')}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          {CHECKS.map((c) => (
            <label key={c.k} className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!profile[c.k]} onChange={() => toggle(c.k)} /> {tt(c.az, c.en)}
            </label>
          ))}
        </div>
        {deadlines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tt('Seçilmiş profil üçün öhdəlik yoxdur.', 'No obligations for the selected profile.')}</p>
        ) : (
          <ul className="divide-y">
            {deadlines.map((d, i) => {
              const urgent = d.daysUntil <= 7, soon = d.daysUntil <= 21;
              return (
                <li key={`${d.kind}-${i}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{tt(d.name.az, d.name.en)}</p>
                    <p className="text-xs text-muted-foreground">{d.periodLabel} · {d.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-medium">{d.dueDate}</p>
                    <Badge variant={urgent ? 'destructive' : soon ? 'warning' : 'secondary'} className="mt-0.5">
                      {d.daysUntil === 0 ? tt('bu gün', 'today') : tt(`${d.daysUntil} gün`, `${d.daysUntil} days`)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
