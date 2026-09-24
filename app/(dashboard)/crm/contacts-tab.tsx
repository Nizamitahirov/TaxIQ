'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Trash2, Mail, Phone, MessageCircle } from 'lucide-react';
import { listContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/crm';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { TableToolbar } from '@/components/shared/table-toolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { CrmContact } from '@/types';
import type { CrmTabProps } from './page';

export function ContactsTab({ companyId, canEdit, actorUid }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [edit, setEdit] = useState<CrmContact | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['crmContacts', companyId], queryFn: () => listContacts(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['crmContacts', companyId] });

  const fullName = (c: CrmContact) => `${c.firstName} ${c.lastName ?? ''}`.trim();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => !q || `${fullName(c)} ${c.organization ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q));
  }, [data, search]);

  async function remove(c: CrmContact) {
    if (!window.confirm(tt('Kontakt silinsin?', 'Delete contact?'))) return;
    try { await deleteContact(c.id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Əlaqədar şəxslər — lead və müştərilərlə bağlı.', 'Contact persons — linked to leads and customers.')}</p>
        <div className="flex gap-2">
          <ExportButton filename="kontaktlar" rows={data ?? []} columns={[
            { header: tt('Ad', 'Name'), value: (c) => fullName(c) }, { header: tt('Vəzifə', 'Position'), value: (c) => c.position ?? '' },
            { header: tt('Təşkilat', 'Organization'), value: (c) => c.organization ?? '' }, { header: tt('E-poçt', 'Email'), value: (c) => c.email ?? '' }, { header: tt('Telefon', 'Phone'), value: (c) => c.phone ?? '' },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> {tt('Yeni kontakt', 'New contact')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Kontakt yoxdur', 'No contacts')} />
      ) : (
        <>
          <TableToolbar search={search} onSearch={setSearch} searchPlaceholder={tt('Ad, təşkilat, e-poçt…', 'Name, organization, email…')} count={filtered.length} total={(data ?? []).length} />
          {filtered.length === 0 ? <EmptyState title={tt('Nəticə yoxdur', 'No results')} /> : (
            <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Vəzifə / Təşkilat', 'Position / Org')}</TableHead><TableHead>{tt('Əlaqə', 'Contact')}</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{fullName(c)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.position ?? '—'}{c.organization && <span className="block text-xs">{c.organization}</span>}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                          {c.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-500" /> {c.whatsapp}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{canEdit && <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button></div>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </>
      )}

      {edit && <ContactDialog contact={edit === 'new' ? null : edit} companyId={companyId} actorUid={actorUid} onClose={() => setEdit(null)} onSaved={refresh} />}
    </div>
  );
}

function ContactDialog({ contact, companyId, actorUid, onClose, onSaved }: { contact: CrmContact | null; companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [firstName, setFirstName] = useState(contact?.firstName ?? '');
  const [lastName, setLastName] = useState(contact?.lastName ?? '');
  const [position, setPosition] = useState(contact?.position ?? '');
  const [organization, setOrganization] = useState(contact?.organization ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!firstName.trim()) { toast.error(tt('Ad tələb olunur', 'First name is required')); return; }
    setBusy(true);
    try {
      const payload = { companyId, firstName: firstName.trim(), lastName: lastName.trim() || null, position: position.trim() || null, organization: organization.trim() || null, email: email.trim() || null, phone: phone.trim() || null, whatsapp: whatsapp.trim() || null, notes: notes.trim() || null };
      if (contact) await updateContact(contact.id, payload);
      else await createContact({ ...payload, createdBy: actorUid });
      toast.success(contact ? tt('Kontakt yeniləndi', 'Contact updated') : tt('Kontakt əlavə edildi', 'Contact added'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{contact ? tt('Kontaktı redaktə et', 'Edit contact') : tt('Yeni kontakt', 'New contact')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label>{tt('Ad', 'First name')} *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Soyad', 'Last name')}</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Vəzifə', 'Position')}</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Təşkilat', 'Organization')}</Label><Input value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('E-poçt', 'Email')}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Telefon', 'Phone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-2"><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Qeyd', 'Notes')}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
