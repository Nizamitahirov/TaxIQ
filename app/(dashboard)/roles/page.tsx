'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Lock, Eye, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listRolesForCompany } from '@/lib/firebase/roles';
import {
  SYSTEM_ROLES, MODULES, PERMISSIONS, resolveRolePermissions, checkSoD, type ModuleKey,
} from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Role } from '@/types';

interface RoleView {
  id: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  permissions: Set<string>;
}

export default function RolesPage() {
  const { can, isSuperAdmin, activeCompanyId } = useAuth();
  const allowed = isSuperAdmin || can('platform.roles.manage');
  const [view, setView] = useState<RoleView | null>(null);

  const { data: customRoles } = useQuery({
    queryKey: ['roles', activeCompanyId],
    queryFn: () => listRolesForCompany(activeCompanyId),
    enabled: allowed,
  });

  if (!allowed) {
    return <div><PageHeader title="Rollar və İcazələr" /><EmptyState title="İcazə yoxdur" description="'platform.roles.manage' icazəsi lazımdır." /></div>;
  }

  // Sistem rolları (kataloqdan) + Firestore-dakı custom rollar
  const systemViews: RoleView[] = SYSTEM_ROLES.map((r) => ({
    id: r.code, name: r.name.az, description: r.description.az, type: 'system',
    permissions: resolveRolePermissions(r),
  }));
  const customViews: RoleView[] = (customRoles ?? [])
    .filter((r) => r.type === 'custom')
    .map((r: Role) => ({ id: r.id, name: r.name, description: r.description, type: 'custom', permissions: new Set(r.permissions) }));
  const all = [...systemViews, ...customViews];

  return (
    <div>
      <PageHeader title="Rollar və İcazələr" subtitle="Sistem rolları və şirkətə xas fərdi rollar (01 §4, §6)" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((r) => {
          const sod = checkSoD([...r.permissions]);
          return (
            <Card key={r.id} className="rounded-card transition-shadow hover:shadow-soft-lg">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                  <Badge variant={r.type === 'system' ? 'secondary' : 'default'}>{r.type === 'system' ? 'Sistem' : 'Fərdi'}</Badge>
                </div>
                <p className="mt-3 font-semibold">{r.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{r.permissions.size} icazə</span>
                  <Button variant="outline" size="sm" onClick={() => setView(r)}><Eye className="h-3.5 w-3.5" /> Matris</Button>
                </div>
                {sod.length > 0 && (
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 p-2 text-[11px] text-warning-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    SoD xəbərdarlığı: həm yaratma, həm təsdiqləmə icazəsi var ({sod.length} modul)
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> {view?.name} — İcazə matrisi</DialogTitle></DialogHeader>
          {view && <PermissionMatrix permissions={view.permissions} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionMatrix({ permissions }: { permissions: Set<string> }) {
  return (
    <div className="space-y-4">
      {MODULES.map((mod) => {
        const perms = PERMISSIONS.filter((p) => p.module === (mod.key as ModuleKey));
        if (perms.length === 0) return null;
        const granted = perms.filter((p) => permissions.has(p.id)).length;
        return (
          <div key={mod.key} className="rounded-card border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{mod.label.az}</p>
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
