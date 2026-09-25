'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UploadCloud, Trash2, Download, FileText, Search } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listLibraryDocuments, uploadLibraryDocument, deleteLibraryDocument } from '@/lib/firebase/documents-library';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { DocLibraryCategory, LibraryDocument } from '@/types';

const CATEGORIES: Record<DocLibraryCategory, [string, string]> = {
  contract: ['Müqavilə', 'Contract'], invoice: ['Faktura', 'Invoice'], receipt: ['Qəbz', 'Receipt'],
  certificate: ['Sertifikat', 'Certificate'], legal: ['Hüquqi', 'Legal'], hr: ['HR', 'HR'],
  tax: ['Vergi', 'Tax'], bank: ['Bank', 'Bank'], other: ['Digər', 'Other'],
};
const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function FilesPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('sales.invoice.view') || can('accounting.coa.view') || can('hr.employee.view');
  const canEdit = canView;
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<'all' | DocLibraryCategory>('all');
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['libraryDocuments', companyId], queryFn: () => listLibraryDocuments(companyId!), enabled: canView && !!companyId });
  const rows = useMemo(() => (data ?? []).filter((d) =>
    (cat === 'all' || d.category === cat) && (!q.trim() || d.title.toLocaleLowerCase('az').includes(q.toLocaleLowerCase('az')) || d.fileName.toLowerCase().includes(q.toLowerCase()))
  ), [data, cat, q]);

  async function remove(d: LibraryDocument) {
    if (!confirm(tt('Sənəd silinsin?', 'Delete document?'))) return;
    await deleteLibraryDocument(d, profile?.uid ?? '');
    qc.invalidateQueries({ queryKey: ['libraryDocuments', companyId] });
  }

  if (!companyId) return <div><PageHeader title={tt('Sənəd Kitabxanası', 'Document library')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Sənəd Kitabxanası', 'Document library')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Sənəd Kitabxanası', 'Document library')}
        subtitle={tt('Şirkət sənədlərini yükləyin, saxlayın və axtarın (skan, müqavilə, sertifikat və s.)', 'Upload, store and search company documents (scans, contracts, certificates, etc.)')}
        action={canEdit && <Button onClick={() => setOpen(true)}><UploadCloud className="h-4 w-4" /> {tt('Fayl yüklə', 'Upload file')}</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-64 pl-9" placeholder={tt('Ad və ya fayl üzrə axtar…', 'Search by title or file…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setCat('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${cat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{tt('Hamısı', 'All')}</button>
        {(Object.keys(CATEGORIES) as DocLibraryCategory[]).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs font-medium ${cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{tt(CATEGORIES[c][0], CATEGORIES[c][1])}</button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Sənəd yoxdur', 'No documents')} action={canEdit && <Button onClick={() => setOpen(true)}><UploadCloud className="h-4 w-4" /> {tt('Fayl yüklə', 'Upload file')}</Button>} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Ad', 'Title')}</TableHead><TableHead>{tt('Kateqoriya', 'Category')}</TableHead><TableHead>{tt('Fayl', 'File')}</TableHead><TableHead className="text-right">{tt('Ölçü', 'Size')}</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>{rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium"><span className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /> {d.title}</span></TableCell>
                <TableCell><Badge variant="secondary">{tt(CATEGORIES[d.category][0], CATEGORIES[d.category][1])}</Badge></TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">{d.fileName}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{fmtBytes(d.size)}</TableCell>
                <TableCell><div className="flex gap-1">
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button></a>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => remove(d)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div></TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}

      {open && <UploadDialog companyId={companyId} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ['libraryDocuments', companyId] }); }} />}
    </div>
  );
}

function UploadDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocLibraryCategory>('other');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!file) { toast.error(tt('Fayl seçin', 'Select a file')); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error(tt('Maksimum 25 MB', 'Max 25 MB')); return; }
    setSaving(true);
    try {
      await uploadLibraryDocument({ companyId, title: title.trim() || file.name, category, file, notes: notes.trim() || null, uploadedBy: actorUid });
      toast.success(tt('Fayl yükləndi', 'File uploaded'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Fayl yüklə', 'Upload file')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div onClick={() => fileRef.current?.click()} className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-border p-6 text-center hover:border-primary/50">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm">{file ? file.name : tt('Fayl seçmək üçün klikləyin (maks. 25 MB)', 'Click to choose a file (max 25 MB)')}</p>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
        </div>
        <div className="space-y-1"><Label>{tt('Ad', 'Title')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>{tt('Kateqoriya', 'Category')}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as DocLibraryCategory)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(CATEGORIES) as DocLibraryCategory[]).map((c) => <SelectItem key={c} value={c}>{tt(CATEGORIES[c][0], CATEGORIES[c][1])}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('Qeyd', 'Notes')}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving || !file}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {tt('Yüklə', 'Upload')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
