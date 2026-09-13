'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Building2 } from 'lucide-react';
import { assignUserToCompany, revokeAccess } from '@/lib/firebase/user-admin';
import { listAccessForUser } from '@/lib/firebase/users';
import { listCompanies } from '@/lib/firebase/companies';
import { listRolesForCompany } from '@/lib/firebase/roles';
import { SYSTEM_ROLES } from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { AppUser } from '@/types';

export function UserAccessDialog({ user, onOpenChange, actorUid }: {
  user: AppUser | null; onOpenChange: (o: boolean) => void; actorUid: string;
}) {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [busy, setBusy] = useState(false);

  const open = !!user;
  const { data: access } = useQuery({
    queryKey: ['access', user?.uid],
    queryFn: () => listAccessForUser(user!.uid),
    enabled: open,
  });
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: open });
  const { data: customRoles } = useQuery({ queryKey: ['roles', companyId || 'none'], queryFn: () => listRolesForCompany(companyId || null), enabled: open });

  const companyName = (id: string) => companies?.find((c) => c.id === id)?.name ?? id;
  const roleOptions = [
    ...SYSTEM_ROLES.filter((r) => r.code !== 'platform_super_admin').map((r) => ({ id: r.code, name: r.name.az })),
    ...(customRoles ?? []).filter((r) => r.type === 'custom').map((r) => ({ id: r.id, name: r.name })),
  ];

  function refresh() {
    qc.invalidateQueries({ queryKey: ['access', user?.uid] });
    qc.invalidateQueries({ queryKey: ['users'] });
  }

  async function add() {
    if (!user || !companyId || !roleId) { toast.error('Şirkət və rol seçin'); return; }
    if ((access ?? []).some((a) => a.companyId === companyId)) { toast.error('Bu şirkətə artıq təyin olunub'); return; }
    setBusy(true);
    try {
      await assignUserToCompany({ userId: user.uid, companyId, roleId, assignedBy: actorUid });
      toast.success('Təyinat əlavə edildi');
      setCompanyId(''); setRoleId(''); refresh();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  async function remove(accessId: string, cId: string) {
    if (!user) return;
    setBusy(true);
    try {
      await revokeAccess({ accessId, userId: user.uid, companyId: cId, revokedBy: actorUid });
      toast.success('Təyinat ləğv edildi');
      refresh();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{user?.displayName} — Şirkət təyinatları</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {(access ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Təyinat yoxdur</p>
            ) : (access ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                <span className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-primary" /> {companyName(a.companyId)}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{SYSTEM_ROLES.find((r) => r.code === a.roleId)?.name.az ?? a.roleId}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" disabled={busy} onClick={() => remove(a.id, a.companyId)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-dashed border-border p-3">
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Yeni təyinat</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Şirkət" /></SelectTrigger>
                <SelectContent>{(companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>{roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Təyin et
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
