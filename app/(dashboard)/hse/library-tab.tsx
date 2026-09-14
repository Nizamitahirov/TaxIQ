'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Folder, FolderPlus, Upload, Search, FileText, FileImage, File as FileIcon, Loader2, Trash2, Download, ChevronRight, Home,
} from 'lucide-react';
import {
  listHseFolders, listHseDocuments, createHseFolder, deleteHseFolder, uploadHseDocument, deleteHseDocument,
} from '@/lib/firebase/hse';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import type { HseDocument, HseFolder } from '@/types';

const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const iconFor = (mime: string) => mime.includes('pdf') ? FileText : mime.startsWith('image/') ? FileImage : FileIcon;

export function LibraryTab({ companyId, uid, canEdit, canDelete }: { companyId: string; uid: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<HseDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: folders } = useQuery({ queryKey: ['hseFolders', companyId], queryFn: () => listHseFolders(companyId) });
  const { data: docs, isLoading } = useQuery({ queryKey: ['hseDocs', companyId], queryFn: () => listHseDocuments(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['hseDocs', companyId] }); qc.invalidateQueries({ queryKey: ['hseFolders', companyId] }); };

  const searching = q.trim().length > 0;
  const subFolders = (folders ?? []).filter((f) => (f.parentId ?? null) === folderId);
  const visibleDocs = useMemo(() => {
    const list = docs ?? [];
    if (searching) return list.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()) || d.fileName.toLowerCase().includes(q.trim().toLowerCase()));
    return list.filter((d) => (d.folderId ?? null) === folderId);
  }, [docs, folderId, q, searching]);

  const crumbs = useMemo(() => {
    const path: HseFolder[] = [];
    let cur = folderId;
    const map = new Map((folders ?? []).map((f) => [f.id, f]));
    while (cur) { const f = map.get(cur); if (!f) break; path.unshift(f); cur = f.parentId ?? null; }
    return path;
  }, [folderId, folders]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) await uploadHseDocument({ companyId, folderId, file, uid });
      toast.success('Yükləndi', `${files.length} fayl`);
      refresh();
    } catch (e) { toast.error('Yükləmə xətası', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function newFolder() {
    const name = window.prompt('Qovluq adı:');
    if (!name?.trim()) return;
    try { await createHseFolder(companyId, name, folderId, uid); toast.success('Qovluq yaradıldı'); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
  }
  async function removeDoc(d: HseDocument) {
    if (!window.confirm(`"${d.name}" silinsin?`)) return;
    try { await deleteHseDocument(d); toast.success('Silindi'); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
  }
  async function removeFolder(f: HseFolder) {
    const childDocs = (docs ?? []).filter((d) => d.folderId === f.id).length;
    const childFolders = (folders ?? []).filter((x) => x.parentId === f.id).length;
    if (childDocs + childFolders > 0) { toast.error('Qovluq boş deyil', 'Əvvəlcə içindəkiləri silin/köçürün'); return; }
    if (!window.confirm(`"${f.name}" qovluğu silinsin?`)) return;
    try { await deleteHseFolder(f.id); toast.success('Silindi'); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fayl axtar…" className="pl-9" />
        </div>
        {canEdit && <Button variant="outline" size="sm" onClick={newFolder}><FolderPlus className="h-4 w-4" /> Qovluq</Button>}
        {canEdit && <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Fayl yüklə</Button>}
      </div>

      {!searching && (
        <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
          <button onClick={() => setFolderId(null)} className="flex items-center gap-1 hover:text-foreground"><Home className="h-3.5 w-3.5" /> Kitabxana</button>
          {crumbs.map((f) => <span key={f.id} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" /><button onClick={() => setFolderId(f.id)} className="hover:text-foreground">{f.name}</button></span>)}
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {!searching && subFolders.map((f) => (
            <Card key={f.id} className="rounded-card transition-shadow hover:shadow-soft-lg">
              <CardContent className="flex items-center gap-3 p-3">
                <button onClick={() => setFolderId(f.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600"><Folder className="h-5 w-5" /></span>
                  <span className="truncate font-medium">{f.name}</span>
                </button>
                {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => removeFolder(f)}><Trash2 className="h-4 w-4" /></Button>}
              </CardContent>
            </Card>
          ))}
          {visibleDocs.map((d) => {
            const Icon = iconFor(d.mimeType);
            return (
              <Card key={d.id} className="rounded-card transition-shadow hover:shadow-soft-lg">
                <CardContent className="flex items-center gap-3 p-3">
                  <button onClick={() => setViewing(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fmtSize(d.size)} · {d.mimeType.split('/')[1] ?? d.mimeType}</span>
                    </span>
                  </button>
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary" title="Endir"><Download className="h-4 w-4" /></a>
                  {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => removeDoc(d)}><Trash2 className="h-4 w-4" /></Button>}
                </CardContent>
              </Card>
            );
          })}
          {subFolders.length === 0 && visibleDocs.length === 0 && (
            <EmptyState title={searching ? 'Nəticə yoxdur' : 'Bu qovluq boşdur'} description={canEdit ? 'Fayl yükləyin və ya qovluq yaradın.' : 'Fayl yoxdur.'} />
          )}
        </div>
      )}

      {viewing && <FileViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function FileViewer({ doc, onClose }: { doc: HseDocument; onClose: () => void }) {
  const isPdf = doc.mimeType.includes('pdf');
  const isImg = doc.mimeType.startsWith('image/');
  return (
    <Drawer open onClose={onClose} title={doc.name} description={`${fmtSize(doc.size)} · ${doc.fileName}`} width="lg"
      footer={<a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><Download className="h-4 w-4" /> Endir / yeni pəncərədə aç</a>}>
      {isPdf ? (
        <iframe src={doc.url} title={doc.name} className="h-[calc(100vh-180px)] w-full rounded-lg border border-border" />
      ) : isImg ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={doc.url} alt={doc.name} className="mx-auto max-h-[calc(100vh-180px)] rounded-lg border border-border" />
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <FileIcon className="h-10 w-10" />
          <p className="text-sm">Bu fayl tipi brauzerdə göstərilə bilmir. Endirərək açın.</p>
        </div>
      )}
    </Drawer>
  );
}
