'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Star, Eye, FileCode } from 'lucide-react';
import {
  listDocumentTemplates, createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate, setDefaultTemplate,
} from '@/lib/firebase/sales';
import { renderTemplate, DEFAULT_INVOICE_TEMPLATE, INVOICE_MERGE_TAGS } from '@/lib/sales/document-template';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import type { DocumentTemplate } from '@/types';

const SAMPLE = {
  company: { name: 'TaxIQ Consulting MMC', legalName: 'TaxIQ Consulting MMC', taxId: '1234567890', address: 'Bakı', phone: '+994 12 000 00 00', brandColor: '#5B5BF5', logoUrl: '' },
  customer: { name: 'Nümunə Müştəri MMC', taxId: '9876543210', address: 'Gəncə' },
  invoice: { invoiceNumber: 'INV-2026-00001', issueDate: '2026-01-15', dueDate: '2026-02-14', currency: 'AZN', subtotal: '1 000,00 AZN', vatTotal: '180,00 AZN', grandTotal: '1 180,00 AZN' },
  lineItems: [
    { description: 'Mühasibat xidməti', quantity: 1, unit: 'ay', unitPrice: '600,00 AZN', vatRate: 18, lineTotal: '600,00 AZN' },
    { description: 'HR konsaltinq', quantity: 2, unit: 'saat', unitPrice: '200,00 AZN', vatRate: 18, lineTotal: '400,00 AZN' },
  ],
};

interface TabProps { companyId: string; canCreate: boolean; actorUid: string }

export function TemplatesTab({ companyId, canCreate, actorUid }: TabProps) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<DocumentTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['documentTemplates', companyId], queryFn: () => listDocumentTemplates(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['documentTemplates', companyId] });

  async function makeDefault(t: DocumentTemplate) { await setDefaultTemplate(companyId, t); toast.success('Defolt təyin edildi'); refresh(); }
  async function remove(t: DocumentTemplate) { await deleteDocumentTemplate(t.id); toast.success('Silindi'); refresh(); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Merge-tag əsaslı sənəd şablonları — hər Company öz loqo/rəngi ilə faktura çap edir (06 §6).</p>
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Yeni şablon</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Şablon yoxdur" description="Standart faktura şablonundan başlayın." action={canCreate ? <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Yeni şablon</Button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((t) => (
            <Card key={t.id} className="rounded-card"><CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileCode className="h-5 w-5" /></span>
                {t.isDefault && <Badge variant="success"><Star className="mr-1 h-3 w-3" /> defolt</Badge>}
              </div>
              <p className="mt-3 font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.type}</p>
              {canCreate && <div className="mt-3 flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => { setEdit(t); setOpen(true); }}>Redaktə</Button>
                {!t.isDefault && <Button variant="ghost" size="sm" onClick={() => makeDefault(t)}><Star className="h-3.5 w-3.5" /> Defolt</Button>}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>}
            </CardContent></Card>
          ))}
        </div>
      )}
      {canCreate && open && <TemplateEditor companyId={companyId} actorUid={actorUid} edit={edit} onClose={() => setOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function TemplateEditor({ companyId, actorUid, edit, onClose, onSaved }: { companyId: string; actorUid: string; edit: DocumentTemplate | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(edit?.name ?? 'Faktura şablonu');
  const [html, setHtml] = useState(edit?.htmlContent ?? DEFAULT_INVOICE_TEMPLATE);
  const [preview, setPreview] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setSaving(true);
    try {
      if (edit) { await updateDocumentTemplate(edit.id, { name: name.trim(), htmlContent: html }); toast.success('Yeniləndi'); }
      else { await createDocumentTemplate({ companyId, type: 'invoice', name: name.trim(), htmlContent: html, isDefault: false, createdBy: actorUid }); toast.success('Şablon yaradıldı'); }
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? 'Şablonu redaktə et' : 'Yeni faktura şablonu'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}><Eye className="h-4 w-4" /> {preview ? 'Kodu göstər' : 'Önbaxış'}</Button>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-[11px] text-muted-foreground">
            <span className="font-semibold">Merge-tag-lar: </span>{INVOICE_MERGE_TAGS.join(' · ')}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">HTML şablon</Label>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={20} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Canlı önbaxış (nümunə data)</Label>
              <div className="h-[26rem] overflow-auto rounded-md border border-border bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: renderTemplate(html, SAMPLE) }} />
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} Yadda saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
