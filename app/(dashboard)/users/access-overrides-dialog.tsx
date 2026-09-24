'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { getRole, listRolesForCompany } from '@/lib/firebase/roles';
import { updateAccessAssignment } from '@/lib/firebase/user-admin';
import {
  MODULES, PERMISSIONS, SYSTEM_ROLE_MAP, SYSTEM_ROLES, resolveRolePermissions, type ModuleKey,
} from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';
import type { Role, UserCompanyAccess } from '@/types';

async function basePermsForRole(roleId: string): Promise<Set<string>> {
  const sys = SYSTEM_ROLE_MAP[roleId];
  if (sys) return resolveRolePermissions(sys);
  const role = await getRole(roleId);
  return role ? resolveRolePermissions(role as Role) : new Set<string>();
}

export function AccessOverridesDialog({ access, companyName, onClose, onSaved, actorUid }: {
  access: UserCompanyAccess; companyName: string; onClose: () => void; onSaved: () => void; actorUid: string;
}) {
  const tt = useTT();
  const [roleId, setRoleId] = useState(access.roleId);
  const [effective, setEffective] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: customRoles } = useQuery({ queryKey: ['roles', access.companyId], queryFn: () => listRolesForCompany(access.companyId) });
  const { data: base, isLoading } = useQuery({ queryKey: ['rolebase', roleId], queryFn: () => basePermsForRole(roleId) });

  const roleOptions = useMemo(() => [
    ...SYSTEM_ROLES.filter((r) => r.code !== 'platform_super_admin').map((r) => ({ id: r.code, name: tt(r.name.az, r.name.en) })),
    ...(customRoles ?? []).filter((r) => r.type === 'custom').map((r) => ({ id: r.id, name: r.name })),
  ], [customRoles, tt]);

  // Rol dəyişəndə və ya baza yüklənəndə effektiv dəsti qur: baza ∪ add − remove
  useEffect(() => {
    if (!base) return;
    const roleChanged = roleId !== access.roleId;
    const eff = new Set(base);
    if (!roleChanged) {
      for (const a of access.customPermissionOverrides?.add ?? []) eff.add(a);
      for (const r of access.customPermissionOverrides?.remove ?? []) eff.delete(r);
    }
    setEffective(eff);
  }, [base, roleId, access]);

  function toggle(id: string) {
    setEffective((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    if (!base) return;
    const add = [...effective].filter((p) => !base.has(p));
    const remove = [...base].filter((p) => !effective.has(p));
    setSaving(true);
    try {
      await updateAccessAssignment({
        accessId: access.id, userId: access.userId, companyId: access.companyId,
        roleId, customPermissionOverrides: { add, remove }, actorUid,
      });
      toast.success(tt('İcazələr yeniləndi', 'Permissions updated'),
        add.length || remove.length ? tt(`+${add.length} / −${remove.length} override`, `+${add.length} / −${remove.length} overrides`) : undefined);
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  const addCount = base ? [...effective].filter((p) => !base.has(p)).length : 0;
  const removeCount = base ? [...base].filter((p) => !effective.has(p)).length : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> {companyName} — {tt('Rol və icazələr', 'Role & permissions')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tt('Rol', 'Role')}</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{tt('Rolun standart icazələri baza kimi götürülür. Aşağıda fərdi olaraq icazə əlavə edə və ya çıxara bilərsiniz (override).', 'The role\'s default permissions are the baseline. Below you can add or remove individual permissions (overrides).')}</p>
          </div>

          {isLoading || !base ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {MODULES.map((mod) => {
                const perms = PERMISSIONS.filter((p) => p.module === (mod.key as ModuleKey));
                if (perms.length === 0) return null;
                const granted = perms.filter((p) => effective.has(p.id)).length;
                return (
                  <div key={mod.key} className="rounded-card border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{tt(mod.label.az, mod.label.en)}</p>
                      <Badge variant={granted > 0 ? 'success' : 'secondary'}>{granted}/{perms.length}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => {
                        const on = effective.has(p.id);
                        const inBase = base.has(p.id);
                        const isOverride = on !== inBase;
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            title={p.id + (isOverride ? (on ? '  (+override)' : '  (−override)') : '')}
                            className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors ring-1',
                              on ? 'bg-primary/15 text-primary ring-primary/30' : 'bg-muted text-muted-foreground ring-transparent hover:bg-secondary',
                              isOverride && (on ? 'ring-success/60' : 'ring-danger/50 line-through'))}
                          >
                            {p.id.split('.').slice(-1)[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">{tt(`Override: +${addCount} / −${removeCount}`, `Overrides: +${addCount} / −${removeCount}`)}</span>
          <Button variant="outline" onClick={onClose} disabled={saving}>{tt('Ləğv et', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving || isLoading}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
