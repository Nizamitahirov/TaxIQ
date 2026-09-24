'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Building2, SlidersHorizontal } from 'lucide-react';
import { assignUserToCompany, revokeAccess } from '@/lib/firebase/user-admin';
import { AccessOverridesDialog } from './access-overrides-dialog';
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
import { useTT } from '@/lib/i18n/tt';
import type { AppUser, UserCompanyAccess } from '@/types';

export function UserAccessDialog({ user, onOpenChange, actorUid }: {
  user: AppUser | null; onOpenChange: (o: boolean) => void; actorUid: string;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const [companyId, setCompanyId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [overridesFor, setOverridesFor] = useState<UserCompanyAccess | null>(null);

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
    ...SYSTEM_ROLES.filter((r) => r.code !== 'platform_super_admin').map((r) => ({ id: r.code, name: tt(r.name.az, r.name.en) })),
    ...(customRoles ?? []).filter((r) => r.type === 'custom').map((r) => ({ id: r.id, name: r.name })),
  ];

  function refresh() {
    qc.invalidateQueries({ queryKey: ['access', user?.uid] });
    qc.invalidateQueries({ queryKey: ['users'] });
  }

  async function add() {
    if (!user || !companyId || !roleId) { toast.error(tt('Şirkət və rol seçin', 'Select a company and role')); return; }
    if ((access ?? []).some((a) => a.companyId === companyId)) { toast.error(tt('Bu şirkətə artıq təyin olunub', 'Already assigned to this company')); return; }
    setBusy(true);
    try {
      await assignUserToCompany({ userId: user.uid, companyId, roleId, assignedBy: actorUid });
      toast.success(tt('Təyinat əlavə edildi', 'Assignment added'));
      setCompanyId(''); setRoleId(''); refresh();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  async function remove(accessId: string, cId: string) {
    if (!user) return;
    setBusy(true);
    try {
      await revokeAccess({ accessId, userId: user.uid, companyId: cId, revokedBy: actorUid });
      toast.success(tt('Təyinat ləğv edildi', 'Assignment revoked'));
      refresh();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{user?.displayName} — {tt('Şirkət təyinatları', 'Company assignments')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {(access ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{tt('Təyinat yoxdur', 'No assignments')}</p>
            ) : (access ?? []).map((a) => {
              const sysRole = SYSTEM_ROLES.find((r) => r.code === a.roleId);
              return (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                <span className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-primary" /> {companyName(a.companyId)}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{sysRole ? tt(sysRole.name.az, sysRole.name.en) : a.roleId}</Badge>
                  {((a.customPermissionOverrides?.add?.length ?? 0) + (a.customPermissionOverrides?.remove?.length ?? 0)) > 0 && (
                    <Badge variant="outline" title={tt('Fərdi icazə düzəlişləri', 'Custom permission overrides')}>±{(a.customPermissionOverrides?.add?.length ?? 0) + (a.customPermissionOverrides?.remove?.length ?? 0)}</Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} title={tt('Rol və icazələr', 'Role & permissions')} onClick={() => setOverridesFor(a)}><SlidersHorizontal className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" disabled={busy} onClick={() => remove(a.id, a.companyId)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              );
            })}
          </div>

          <div className="rounded-card border border-dashed border-border p-3">
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">{tt('Yeni təyinat', 'New assignment')}</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder={tt('Şirkət', 'Company')} /></SelectTrigger>
                <SelectContent>{(companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder={tt('Rol', 'Role')} /></SelectTrigger>
                <SelectContent>{roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Təyin et', 'Assign')}
            </Button>
          </div>
        </div>
        {overridesFor && (
          <AccessOverridesDialog
            access={overridesFor}
            companyName={companyName(overridesFor.companyId)}
            actorUid={actorUid}
            onClose={() => setOverridesFor(null)}
            onSaved={refresh}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
