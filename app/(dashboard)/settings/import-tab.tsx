'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import {
  IMPORT_ENTITIES, parseSpreadsheet, validateRows, commitImport, loadExistingKeys, downloadTemplate,
  type ImportEntity, type ParsedRow,
} from '@/lib/import/excel-import';
import { logAudit } from '@/lib/firebase/audit';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export function ImportTab() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, profile, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const allowed = isSuperAdmin || can('platform.company.settings.edit');

  const [entityKey, setEntityKey] = useState(IMPORT_ENTITIES[0].key);
  const entity = useMemo(() => IMPORT_ENTITIES.find((e) => e.key === entityKey)!, [entityKey]);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    if (!rows) return null;
    const valid = rows.filter((r) => r.errors.length === 0).length;
    const dup = rows.filter((r) => r.duplicate).length;
    return { total: rows.length, valid, errors: rows.length - valid, dup };
  }, [rows]);

  function reset() { setRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = ''; }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setBusy(true); setRows(null); setFileName(file.name);
    try {
      const { rows: raw } = await parseSpreadsheet(file);
      if (!raw.length) { toast.error(tt('Fayl boşdur və ya oxunmadı', 'File is empty or unreadable')); return; }
      const existing = await loadExistingKeys(entity, companyId);
      setRows(validateRows(entity, raw, existing));
    } catch (err) {
      toast.error(tt('Fayl oxunmadı', 'Could not read file'), err instanceof Error ? err.message : undefined);
    } finally { setBusy(false); }
  }

  async function doImport() {
    if (!rows || !companyId || !profile?.uid) return;
    const ok = rows.filter((r) => r.errors.length === 0);
    if (!ok.length) { toast.error(tt('İdxal ediləcək etibarlı sətir yoxdur', 'No valid rows to import')); return; }
    setImporting(true);
    try {
      const n = await commitImport(entity, ok, { companyId, createdBy: profile.uid });
      await logAudit({ companyId, userId: profile.uid, action: 'DATA_IMPORTED', entityType: entity.collection, entityId: entity.key, after: { count: n } });
      toast.success(tt('İdxal tamamlandı', 'Import complete'), tt(`${n} sətir əlavə edildi`, `${n} rows added`));
      qc.invalidateQueries();
      reset();
    } catch (err) {
      toast.error(tt('İdxal alınmadı', 'Import failed'), err instanceof Error ? err.message : undefined);
    } finally { setImporting(false); }
  }

  if (!allowed) {
    return <Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card>;
  }

  const cols = entity.fields;

  return (
    <div className="space-y-4">
      {/* Varlıq seçimi */}
      <div className="flex flex-wrap gap-2">
        {IMPORT_ENTITIES.map((e) => (
          <Button key={e.key} size="sm" variant={e.key === entityKey ? 'default' : 'outline'}
            onClick={() => { setEntityKey(e.key); reset(); }}>
            {tt(e.az, e.en)}
          </Button>
        ))}
      </div>

      <Card className="rounded-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="h-5 w-5" /></span>
              <div>
                <p className="font-semibold">{tt(entity.az, entity.en)} — {tt('Excel idxal', 'Excel import')}</p>
                <p className="text-xs text-muted-foreground">{tt('Şablonu yüklə, doldur, geri yüklə — sətirlər yoxlanılıb sistemə əlavə olunur.', 'Download the template, fill it, upload it back — rows are validated and added.')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(entity)}><Download className="h-4 w-4" /> {tt('Şablon (.xlsx)', 'Template (.xlsx)')}</Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
              <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {tt('Fayl seç', 'Choose file')}
              </Button>
            </div>
          </div>

          {/* Gözlənilən sütunlar */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {cols.map((f) => (
              <span key={f.key} className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {f.az}{f.required && <span className="text-destructive"> *</span>}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {rows && stats && (
        <Card className="rounded-card">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="truncate text-muted-foreground">{fileName}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {stats.valid} {tt('etibarlı', 'valid')}</span>
                {stats.errors > 0 && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {stats.errors} {tt('xətalı', 'errors')}</span>}
                {stats.dup > 0 && <span className="text-warning">{stats.dup} {tt('təkrar', 'duplicate')}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset}><X className="h-4 w-4" /> {tt('Ləğv et', 'Clear')}</Button>
                <Button size="sm" disabled={importing || stats.valid === 0} onClick={doImport}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {tt(`${stats.valid} sətri idxal et`, `Import ${stats.valid} rows`)}
                </Button>
              </div>
            </div>

            <div className="max-h-[52vh] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-secondary/60">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {cols.map((f) => <TableHead key={f.key} className="whitespace-nowrap text-xs">{f.az}</TableHead>)}
                    <TableHead className="text-xs">{tt('Vəziyyət', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const bad = r.errors.length > 0;
                    return (
                      <TableRow key={r.index} className={bad ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{r.index}</TableCell>
                        {cols.map((f) => <TableCell key={f.key} className="whitespace-nowrap text-xs">{fmt(r.values[f.key])}</TableCell>)}
                        <TableCell className="text-xs">
                          {bad
                            ? <span className="text-destructive">{r.errors.join('; ')}</span>
                            : <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {tt('hazır', 'ready')}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{tt('Yalnız xətasız sətirlər idxal olunur. Təkrarlar (mövcud kod/ad) avtomatik ötürülür.', 'Only error-free rows are imported. Duplicates (existing code/name) are skipped automatically.')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === true) return '✓';
  if (v === false) return '✗';
  if (v == null || v === '') return '—';
  return String(v);
}
