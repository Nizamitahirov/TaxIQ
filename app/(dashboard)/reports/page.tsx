'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Play, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listByCompany } from '@/lib/firebase/firestore';
import {
  REPORTABLE_ENTITIES, ENTITY_MAP, readField, applyFilters, type ReportFilter, type FilterOp,
} from '@/lib/reports/entities';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

const OPS: FilterOp[] = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

export default function ReportsPage() {
  const { active, can, isSuperAdmin } = useAuth();
  const companyId = active?.companyId;
  const canUse = isSuperAdmin || can('reports.builder.use') || can('reports.view');

  const [entityKey, setEntityKey] = useState('invoices');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [ran, setRan] = useState(false);

  const entity = ENTITY_MAP[entityKey];
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report', companyId, entityKey],
    queryFn: () => listByCompany<Record<string, unknown>>(entity.collectionPath, companyId!),
    enabled: false,
  });

  const cols = useMemo(() => entity.fields.filter((f) => selectedFields.includes(f.key)), [entity, selectedFields]);
  const rows = useMemo(() => (data ? applyFilters(data, filters, entity.fields) : []), [data, filters, entity]);

  function pickEntity(k: string) {
    setEntityKey(k);
    setSelectedFields(ENTITY_MAP[k].fields.slice(0, 5).map((f) => f.key));
    setFilters([]); setRan(false);
  }
  function toggleField(k: string) { setSelectedFields((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]); }
  async function run() { if (selectedFields.length === 0) { setSelectedFields(entity.fields.slice(0, 5).map((f) => f.key)); } await refetch(); setRan(true); }

  if (!companyId) return <div><PageHeader title="Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canUse) return <div><PageHeader title="Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="Hesabatlar" subtitle="Metadata-əsaslı hesabat qurucusu (Modul 3 §3) — kod yazmadan" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Konfiqurasiya */}
        <Card className="rounded-card h-fit"><CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label>Mənbə</Label>
            <Select value={entityKey} onValueChange={pickEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORTABLE_ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{e.label.az}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sütunlar</Label>
            <div className="flex flex-wrap gap-1.5">
              {entity.fields.map((f) => {
                const on = selectedFields.includes(f.key);
                return <button key={f.key} onClick={() => toggleField(f.key)} className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors', on ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-secondary')}>{f.label.az}</button>;
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Filtrlər</Label><Button variant="ghost" size="sm" onClick={() => setFilters((f) => [...f, { field: entity.fields[0].key, op: '=', value: '' }])}><Plus className="h-3.5 w-3.5" /> Əlavə et</Button></div>
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-1">
                <Select value={f.field} onValueChange={(v) => setFilters((arr) => arr.map((x, idx) => idx === i ? { ...x, field: v } : x))}>
                  <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{entity.fields.map((fld) => <SelectItem key={fld.key} value={fld.key}>{fld.label.az}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={f.op} onValueChange={(v) => setFilters((arr) => arr.map((x, idx) => idx === i ? { ...x, op: v as FilterOp } : x))}>
                  <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-8 w-24 text-xs" value={f.value} onChange={(e) => setFilters((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setFilters((arr) => arr.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={run} disabled={isFetching}>{isFetching ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4" />} Hesabatı işə sal</Button>
        </CardContent></Card>

        {/* Nəticə */}
        <Card className="rounded-card"><CardContent className="p-0">
          {!ran ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground">
              <FileSpreadsheet className="h-8 w-8 opacity-50" />
              Mənbə və sütunları seçib «Hesabatı işə sal» düyməsinə basın.
            </div>
          ) : isLoading || isFetching ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border p-4">
                <span className="text-sm text-muted-foreground">{rows.length} nəticə</span>
                <ExportButton filename={`hesabat-${entityKey}`} rows={rows}
                  columns={cols.map((c) => ({ header: c.label.az, value: (row: Record<string, unknown>) => { const v = readField(row, c); return v ?? ''; } }))} />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key} className={c.type === 'number' ? 'text-right' : ''}>{c.label.az}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={cols.length || 1} className="py-8 text-center text-muted-foreground">Nəticə yoxdur</TableCell></TableRow>
                    ) : rows.slice(0, 500).map((row, i) => (
                      <TableRow key={i}>{cols.map((c) => { const v = readField(row, c); return <TableCell key={c.key} className={cn(c.type === 'number' && 'text-right tnum')}>{v == null || v === '' ? '—' : String(v)}</TableCell>; })}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
