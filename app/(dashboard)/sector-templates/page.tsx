'use client';

import { useState } from 'react';
import { ShieldAlert, Layers, Check, Info } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SECTOR_TEMPLATES, TOGGLEABLE_MODULES, type SectorTemplate } from '@/lib/sectors';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';

const FIELD_TYPE_LABEL: Record<string, string> = { text: 'Mətn', number: 'Rəqəm', date: 'Tarix', select: 'Siyahı' };
const FIELD_TYPE_LABEL_EN: Record<string, string> = { text: 'Text', number: 'Number', date: 'Date', select: 'List' };

export default function SectorTemplatesPage() {
  const { isSuperAdmin } = useAuth();
  const tt = useTT();
  const [active, setActive] = useState<SectorTemplate['code']>('manufacturing');

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title={tt('Sektor Şablonları', 'Sector Templates')} />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tt('Bu bölmə yalnız Platform Super Admin üçündür.', 'This section is only for the Platform Super Admin.')}</p>
        </CardContent></Card>
      </div>
    );
  }

  const tpl = SECTOR_TEMPLATES.find((s) => s.code === active) ?? SECTOR_TEMPLATES[0];

  return (
    <div>
      <PageHeader title={tt('Sektor Şablonları', 'Sector Templates')} subtitle={tt('Yeni müştəri yaradılanda tətbiq olunan defolt konfiqurasiya (02 §2)', 'Default configuration applied when creating a new client (02 §2)')} />

      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        {tt('Şablonlar kod səviyyəsində təyin olunub (versiya nəzarəti altında). Bu ekran hər sektorun defolt modullarını, şöbələrini, KPI-larını və fərdi sahələrini göstərir — yeni müştəri sihirbazında avtomatik tətbiq olunur.', 'Templates are defined at the code level (under version control). This screen shows each sector\'s default modules, departments, KPIs and custom fields — they are applied automatically in the new-client wizard.')}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sektor siyahısı */}
        <Card className="rounded-card"><CardContent className="p-2">
          <div className="space-y-1">
            {SECTOR_TEMPLATES.map((s) => (
              <button key={s.code} onClick={() => setActive(s.code)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors', s.code === active ? 'bg-primary/10 text-primary' : 'hover:bg-secondary')}>
                <Layers className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{tt(s.name.az, s.name.en)}</span></span>
                {s.defaultModulesEnabled.length > 0 && <Badge variant="secondary">{s.defaultModulesEnabled.length}</Badge>}
              </button>
            ))}
          </div>
        </CardContent></Card>

        {/* Şablon detalları */}
        <div className="space-y-4">
          <Card className="rounded-card"><CardContent className="p-6">
            <h2 className="text-lg font-bold">{tt(tpl.name.az, tpl.name.en)} <span className="text-sm font-normal text-muted-foreground">/ {tt(tpl.name.en, tpl.name.az)}</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">{tt(tpl.description.az, tpl.description.en)}</p>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tt(tpl.notes.az, tpl.notes.en)}</p>
          </CardContent></Card>

          <Card className="rounded-card"><CardContent className="p-6">
            <p className="mb-3 text-sm font-semibold">{tt('Defolt aktiv modullar', 'Default active modules')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOGGLEABLE_MODULES.map((m) => {
                const on = tpl.defaultModulesEnabled.includes(m.key);
                return (
                  <div key={m.key} className={cn('flex items-center justify-between rounded-lg border p-2.5 text-sm', on ? 'border-primary/40 bg-primary/5' : 'border-border/60 text-muted-foreground')}>
                    <span>{tt(m.label.az, m.label.en)}</span>
                    {on ? <Check className="h-4 w-4 text-primary" /> : <span className="text-xs">{tt('əl ilə', 'manual')}</span>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{tt('Dashboard və Rol/Səlahiyyət həmişə aktivdir (platform nüvəsi).', 'Dashboard and Roles/Permissions are always active (platform core).')}</p>
          </CardContent></Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-card"><CardContent className="p-6">
              <p className="mb-3 text-sm font-semibold">{tt('Defolt şöbələr', 'Default departments')}</p>
              {tpl.departmentPreset.length === 0 ? <p className="text-sm text-muted-foreground">{tt('Yoxdur (əl ilə)', 'None (manual)')}</p> : (
                <div className="flex flex-wrap gap-2">{tpl.departmentPreset.map((d, i) => <Badge key={i} variant="secondary">{tt(d.az, d.en)}</Badge>)}</div>
              )}
            </CardContent></Card>
            <Card className="rounded-card"><CardContent className="p-6">
              <p className="mb-3 text-sm font-semibold">{tt('Tövsiyə olunan KPI-lar', 'Recommended KPIs')}</p>
              {tpl.recommendedKpis.length === 0 ? <p className="text-sm text-muted-foreground">{tt('Yoxdur', 'None')}</p> : (
                <div className="flex flex-wrap gap-2">{tpl.recommendedKpis.map((k) => <Badge key={k} variant="secondary" className="font-mono text-[11px]">{k}</Badge>)}</div>
              )}
            </CardContent></Card>
          </div>

          <Card className="rounded-card"><CardContent className="p-6">
            <p className="mb-3 text-sm font-semibold">{tt('Sektora xas sahələr (custom fields)', 'Sector-specific fields (custom fields)')}</p>
            {tpl.customFieldDefinitions.length === 0 ? <p className="text-sm text-muted-foreground">{tt('Bu sektor üçün fərdi sahə təyin olunmayıb.', 'No custom fields are defined for this sector.')}</p> : (
              <div className="space-y-2">
                {tpl.customFieldDefinitions.map((f) => (
                  <div key={f.fieldKey} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-sm">
                    <span><span className="font-medium">{tt(f.label.az, f.label.en)}</span> <span className="font-mono text-xs text-muted-foreground">{f.fieldKey}</span></span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{tt(FIELD_TYPE_LABEL[f.type] ?? f.type, FIELD_TYPE_LABEL_EN[f.type] ?? f.type)}</Badge> {f.appliesToEntity}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
