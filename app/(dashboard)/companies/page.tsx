'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listCompanies } from '@/lib/firebase/companies';
import { createDoc } from '@/lib/firebase/firestore';
import { logAudit } from '@/lib/firebase/audit';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { Sector } from '@/types';

const SECTORS: { value: Sector; label: string }[] = [
  { value: 'manufacturing', label: 'İstehsalat' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospitality', label: 'Otelçilik' },
  { value: 'services', label: 'Xidmət' },
  { value: 'trade', label: 'Ticarət' },
  { value: 'construction', label: 'Tikinti' },
  { value: 'other', label: 'Digər' },
];

export default function CompaniesPage() {
  const { isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: isSuperAdmin });

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Şirkətlər" />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bu bölmə yalnız Platform Super Admin üçündür.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Şirkətlər"
        subtitle="Bütün müştəri şirkətləri və TaxIQ-ın öz profili (Company #1)"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Yeni şirkət</Button></DialogTrigger>
            <CompanyForm uid={profile?.uid ?? ''} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['platform-metrics'] }); }} />
          </Dialog>
        }
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Şirkət yoxdur" description="İlk müştəri şirkətini yaradın." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="rounded-card transition-shadow hover:shadow-soft-lg">
              <CardContent className="flex items-start gap-3 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.isInternal && <Building2 className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.taxId ? `VÖEN ${c.taxId}` : '—'} · {c.baseCurrency}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'warning' : 'secondary'}>{c.status}</Badge>
                    <span className="text-xs text-muted-foreground">{SECTORS.find((s) => s.value === c.sector)?.label ?? c.sector}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyForm({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [sector, setSector] = useState<Sector>('services');
  const [baseCurrency, setBaseCurrency] = useState('AZN');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error('Şirkət adı tələb olunur'); return; }
    setSaving(true);
    try {
      const id = await createDoc('companies', {
        name: name.trim(), legalName: legalName.trim(), taxId: taxId.trim(),
        sector, baseCurrency, status: 'active', isInternal: false,
        settings: { theme: 'system', language: 'az', fiscalYearStartMonth: 1 },
        modulesEnabled: [], createdBy: uid,
      });
      await logAudit({ companyId: id, userId: uid, action: 'COMPANY_CREATED', entityType: 'company', entityId: id, after: { name } });
      toast.success('Şirkət yaradıldı');
      onDone();
    } catch (e) {
      toast.error('Xəta', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Yeni şirkət</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Ad *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bakı Retail Group" /></div>
        <div className="space-y-2"><Label>Hüquqi ad</Label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>VÖEN</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          <div className="space-y-2"><Label>Əsas valyuta</Label><Input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} maxLength={3} /></div>
        </div>
        <div className="space-y-2">
          <Label>Sektor</Label>
          <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SECTORS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button>
      </DialogFooter>
    </DialogContent>
  );
}
