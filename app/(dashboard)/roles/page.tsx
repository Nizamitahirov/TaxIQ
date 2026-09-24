'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ShieldCheck, Lock, Eye, AlertTriangle, Plus, Pencil, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listRolesForCompany, deleteRole } from '@/lib/firebase/roles';
import { listDocs } from '@/lib/firebase/firestore';
import { logAudit } from '@/lib/firebase/audit';
import {
  SYSTEM_ROLES, MODULES, PERMISSIONS, resolveRolePermissions, checkSoD, type ModuleKey,
} from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { RoleFormDialog, type RoleFormSeed } from './role-form-dialog';
import type { Role, UserCompanyAccess } from '@/types';

interface RoleView {
  id: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  permissions: Set<string>;
}

export default function RolesPage() {
  const { can, isSuperAdmin, activeCompanyId, profile } = useAuth();
  const tt = useTT();
  const qc = useQueryClient();
  const allowed = isSuperAdmin || can('platform.roles.manage');
  const [view, setView] = useState<RoleView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [seed, setSeed] = useState<RoleFormSeed | null>(null);
  const [delRole, setDelRole] = useState<RoleView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: customRoles } = useQuery({
    queryKey: ['roles', activeCompanyId],
    queryFn: () => listRolesForCompany(activeCompanyId),
    enabled: allowed,
  });

  if (!allowed) {
    return <div><PageHeader title={tt('Rollar və İcazələr', 'Roles & Permissions')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} description={tt("'platform.roles.manage' icazəsi lazımdır.", "The 'platform.roles.manage' permission is required.")} /></div>;
  }

  const systemViews: RoleView[] = SYSTEM_ROLES.map((r) => ({
    id: r.code, name: tt(r.name.az, r.name.en), description: tt(r.description.az, r.description.en), type: 'system',
    permissions: resolveRolePermissions(r),
  }));
  const customViews: RoleView[] = (customRoles ?? [])
    .filter((r) => r.type === 'custom')
    .map((r: Role) => ({ id: r.id, name: r.name, description: r.description, type: 'custom', permissions: new Set(r.permissions) }));
  const all = [...systemViews, ...customViews];

  function openNew() { setSeed(null); setFormOpen(true); }
  function openEdit(r: RoleView) { setSeed({ id: r.id, name: r.name, description: r.description, permissions: [...r.permissions] }); setFormOpen(true); }
  function openClone(r: RoleView) { setSeed({ name: `${r.name} ${tt('(kopya)', '(copy)')}`, description: r.description, permissions: [...r.permissions] }); setFormOpen(true); }

  async function confirmDelete() {
    if (!delRole) return;
    setDeleting(true);
    try {
      // Bu rola təyin olunmuş istifadəçi varsa bloklanır (01 §4.2)
      const assigned = await listDocs<UserCompanyAccess>('userCompanyAccess', [
        where('roleId', '==', delRole.id), where('status', '==', 'active'),
      ]);
      if (assigned.length > 0) {
        toast.error(tt('Silinə bilməz', 'Cannot delete'), tt(`Bu rola ${assigned.length} istifadəçi təyin olunub — əvvəlcə onları başqa rola köçürün.`, `${assigned.length} user(s) are assigned to this role — reassign them to another role first.`));
        setDelRole(null); return;
      }
      await deleteRole(delRole.id);
      await logAudit({ companyId: activeCompanyId, userId: profile?.uid ?? '', action: 'ROLE_DELETED', entityType: 'role', entityId: delRole.id });
      toast.success(tt('Rol silindi', 'Role deleted'));
      qc.invalidateQueries({ queryKey: ['roles', activeCompanyId] });
      setDelRole(null);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      <PageHeader
        title={tt('Rollar və İcazələr', 'Roles & Permissions')}
        subtitle={tt('Sistem rolları və şirkətə xas fərdi rollar (01 §4, §6)', 'System roles and company-specific custom roles (01 §4, §6)')}
        action={<Button onClick={openNew}><Plus className="h-4 w-4" /> {tt('Yeni rol', 'New role')}</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((r) => {
          const sod = checkSoD([...r.permissions]);
          return (
            <Card key={r.id} className="rounded-card transition-shadow hover:shadow-soft-lg">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                  <Badge variant={r.type === 'system' ? 'secondary' : 'default'}>{r.type === 'system' ? tt('Sistem', 'System') : tt('Fərdi', 'Custom')}</Badge>
                </div>
                <p className="mt-3 font-semibold">{r.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                {sod.length > 0 && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 p-2 text-[11px] text-warning-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {tt(`SoD: yaratma + təsdiqləmə (${sod.length} modul)`, `SoD: create + approve (${sod.length} module(s))`)}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{tt(`${r.permissions.size} icazə`, `${r.permissions.size} permission(s)`)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Matris', 'Matrix')} onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Klonla', 'Clone')} onClick={() => openClone(r)}><Copy className="h-4 w-4" /></Button>
                    {r.type === 'custom' && <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Redaktə', 'Edit')} onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" title={tt('Sil', 'Delete')} onClick={() => setDelRole(r)}><Trash2 className="h-4 w-4" /></Button>
                    </>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> {view?.name} — {tt('İcazə matrisi', 'Permission matrix')}</DialogTitle></DialogHeader>
          {view && <PermissionMatrix permissions={view.permissions} tt={tt} />}
        </DialogContent>
      </Dialog>

      <RoleFormDialog
        open={formOpen} onOpenChange={setFormOpen} seed={seed}
        companyId={activeCompanyId} actorUid={profile?.uid ?? ''}
        onSaved={() => qc.invalidateQueries({ queryKey: ['roles', activeCompanyId] })}
      />

      <ConfirmDialog
        open={!!delRole} onOpenChange={(o) => !o && setDelRole(null)}
        title={tt('Rolu sil', 'Delete role')} description={tt(`"${delRole?.name}" rolunu silmək istədiyinizə əminsiniz?`, `Are you sure you want to delete the "${delRole?.name}" role?`)}
        confirmLabel={tt('Sil', 'Delete')} loading={deleting} onConfirm={confirmDelete}
      />
    </div>
  );
}

function PermissionMatrix({ permissions, tt }: { permissions: Set<string>; tt: (az: string, en: string) => string }) {
  return (
    <div className="space-y-4">
      {MODULES.map((mod) => {
        const perms = PERMISSIONS.filter((p) => p.module === (mod.key as ModuleKey));
        if (perms.length === 0) return null;
        const granted = perms.filter((p) => permissions.has(p.id)).length;
        return (
          <div key={mod.key} className="rounded-card border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{tt(mod.label.az, mod.label.en)}</p>
              <Badge variant={granted > 0 ? 'success' : 'secondary'}>{granted}/{perms.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <span key={p.id} className={`rounded-md px-2 py-0.5 text-[11px] ${permissions.has(p.id) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground line-through opacity-60'}`}>
                  {p.id.split('.').slice(-1)[0]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
