'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Play, FileSpreadsheet, Save, ArrowUp, ArrowDown, X, BookMarked } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listByCompany } from '@/lib/firebase/firestore';
import {
  REPORTABLE_ENTITIES, ENTITY_MAP, readField, applyFilters, type ReportFilter, type FilterOp,
} from '@/lib/reports/entities';
import {
  listReportTemplates, createReportTemplate, deleteReportTemplate,
} from '@/lib/firebase/report-templates';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import type { ReportTemplate, ReportTemplateColumn } from '@/types';

const OPS: FilterOp[] = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

export default function ReportsPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const companyId = active?.companyId;
  const canUse = isSuperAdmin || can('reports.builder.use') || can('reports.view');

  const [entityKey, setEntityKey] = useState('invoices');
  const [columns, setColumns] = useState<ReportTemplateColumn[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [ran, setRan] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const entity = ENTITY_MAP[entityKey];
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report', companyId, entityKey],
    queryFn: () => listByCompany<Record<string, unknown>>(entity.collectionPath, companyId!),
    enabled: false,
  });
  const { data: templates } = useQuery({ queryKey: ['reportTemplates', companyId], queryFn: () => listReportTemplates(companyId!), enabled: !!companyId && canUse });

  // key → field metadata (dəyər oxumaq üçün)
  const fieldMap = useMemo(() => Object.fromEntries(entity.fields.map((f) => [f.key, f])), [entity]);
  const rows = useMemo(() => (data ? applyFilters(data, filters, entity.fields) : []), [data, filters, entity]);
  const selectedKeys = new Set(columns.map((c) => c.key));

  function pickEntity(k: string) {
    setEntityKey(k);
    setColumns(ENTITY_MAP[k].fields.slice(0, 5).map((f) => ({ key: f.key, label: f.label.az })));
    setFilters([]); setRan(false);
  }
  function addColumn(key: string) {
    const f = entity.fields.find((x) => x.key === key); if (!f) return;
    setColumns((c) => c.some((x) => x.key === key) ? c.filter((x) => x.key !== key) : [...c, { key, label: f.label.az }]);
  }
  function move(i: number, dir: -1 | 1) {
    setColumns((c) => { const n = [...c]; const j = i + dir; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }
  function rename(i: number, label: string) { setColumns((c) => c.map((x, idx) => idx === i ? { ...x, label } : x)); }
  async function run() {
    if (columns.length === 0) setColumns(entity.fields.slice(0, 5).map((f) => ({ key: f.key, label: f.label.az })));
    await refetch(); setRan(true);
  }
  function loadTemplate(t: ReportTemplate) {
    setEntityKey(t.entity);
    setColumns(t.columns);
    setFilters((t.filters ?? []) as ReportFilter[]);
    setRan(false);
    toast.success('Şablon yükləndi', t.name);
  }

  const outCols = columns.map((c) => ({
    header: c.label,
    value: (row: Record<string, unknown>) => { const f = fieldMap[c.key]; return f ? (readField(row, f) ?? '') : (row[c.key] ?? ''); },
  }));

  if (!companyId) return <div><PageHeader title="Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canUse) return <div><PageHeader title="Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="Hesabatlar" subtitle="Metadata-əsaslı hesabat qurucusu + saxlanan export şablonları (Modul 3 §3)" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Konfiqurasiya */}
        <Card className="rounded-card h-fit"><CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label>Mənbə</Label>
            <Select value={entityKey} onValueChange={pickEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORTABLE_ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{e.label.az}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Mövcud sütunlar (əlavə et) */}
          <div className="space-y-2">
            <Label>Sütun əlavə et</Label>
            <div className="flex flex-wrap gap-1.5">
              {entity.fields.map((f) => {
                const on = selectedKeys.has(f.key);
                return <button key={f.key} onClick={() => addColumn(f.key)} className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors', on ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-secondary')}>{on ? '✓ ' : '+ '}{f.label.az}</button>;
              })}
            </div>
          </div>

          {/* Seçilmiş sütunlar — sıra + adlandırma */}
          {columns.length > 0 && (
            <div className="space-y-2">
              <Label>Sütun sırası və adları</Label>
              <div className="space-y-1.5">
                {columns.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-1 rounded-lg border border-border/60 p-1.5">
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === columns.length - 1} className="text-muted-foreground disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    <Input value={c.label} onChange={(e) => rename(i, e.target.value)} className="h-8 flex-1 text-xs" />
                    <button onClick={() => addColumn(c.key)} className="text-danger"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          <div className="flex gap-2">
            <Button className="flex-1" onClick={run} disabled={isFetching}>{isFetching ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4" />} İşə sal</Button>
            <Button variant="outline" onClick={() => { if (columns.length === 0) { toast.error('Əvvəlcə sütun seçin'); return; } setSaveOpen(true); }} title="Şablon kimi saxla"><Save className="h-4 w-4" /></Button>
          </div>

          {/* Saxlanan şablonlar */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="flex items-center gap-1.5"><BookMarked className="h-3.5 w-3.5" /> Saxlanan şablonlar</Label>
            {(templates ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Hələ şablon yoxdur — konfiqurasiyanı qurub «Saxla» ilə yadda saxlayın.</p> : (
              <div className="space-y-1">
                {(templates ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                    <button onClick={() => loadTemplate(t)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{ENTITY_MAP[t.entity]?.label.az ?? t.entity} · {t.columns.length} sütun{t.shared ? ' · paylaşılıb' : ''}</span>
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={async () => { await deleteReportTemplate(t.id); qc.invalidateQueries({ queryKey: ['reportTemplates', companyId] }); toast.success('Silindi'); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent></Card>

        {/* Nəticə */}
        <Card className="rounded-card"><CardContent className="p-0">
          {!ran ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground">
              <FileSpreadsheet className="h-8 w-8 opacity-50" />
              Mənbə və sütunları seçib «İşə sal» düyməsinə basın. Konfiqurasiyanı export şablonu kimi saxlaya bilərsiniz.
            </div>
          ) : isLoading || isFetching ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border p-4">
                <span className="text-sm text-muted-foreground">{rows.length} nəticə · {columns.length} sütun</span>
                <ExportButton filename={`hesabat-${entityKey}`} rows={rows} columns={outCols} />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>{columns.map((c) => { const f = fieldMap[c.key]; return <TableHead key={c.key} className={f?.type === 'number' ? 'text-right' : ''}>{c.label}</TableHead>; })}</TableRow></TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={columns.length || 1} className="py-8 text-center text-muted-foreground">Nəticə yoxdur</TableCell></TableRow>
                    ) : rows.slice(0, 500).map((row, i) => (
                      <TableRow key={i}>{columns.map((c) => { const f = fieldMap[c.key]; const v = f ? readField(row, f) : row[c.key]; return <TableCell key={c.key} className={cn(f?.type === 'number' && 'text-right tnum')}>{v == null || v === '' ? '—' : String(v)}</TableCell>; })}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent></Card>
      </div>

      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} onSave={async (name, shared) => {
        await createReportTemplate({ companyId, name, entity: entityKey, columns, filters: filters.map((f) => ({ field: f.field, op: f.op, value: String(f.value) })), shared, createdBy: profile?.uid ?? '' });
        qc.invalidateQueries({ queryKey: ['reportTemplates', companyId] });
        toast.success('Şablon saxlanıldı', name);
      }} />
    </div>
  );
}

function SaveTemplateDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (name: string, shared: boolean) => Promise<void> }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setBusy(true);
    try { await onSave(name.trim(), shared); setName(''); onOpenChange(false); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Export şablonu kimi saxla</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Şablon adı</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aylıq satış hesabatı" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Şirkət daxilində paylaş <Badge variant="secondary" className="ml-1">komanda</Badge></label>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
