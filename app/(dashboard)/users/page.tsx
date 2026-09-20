'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Settings2, UserCog, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listUsers } from '@/lib/firebase/users';
import { resyncAllAccess } from '@/lib/firebase/user-admin';
import { toast } from '@/components/ui/toast';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { TableToolbar } from '@/components/shared/table-toolbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils/format';
import { UserCreateDialog } from './user-create-dialog';
import { UserAccessDialog } from './user-access-dialog';
import { UserManageDialog } from './user-manage-dialog';
import type { AppUser, UserType } from '@/types';

const TYPE_LABEL: Record<UserType, string> = {
  platform_super_admin: 'Super Admin', staff: 'Staff (Konsultant)', client_user: 'Müştəri istifadəçisi',
};
const TYPE_LABEL_EN: Record<UserType, string> = {
  platform_super_admin: 'Super Admin', staff: 'Staff (Consultant)', client_user: 'Client user',
};

export default function UsersPage() {
  const { can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const typeLabel = (t: UserType) => tt(TYPE_LABEL[t] ?? t, TYPE_LABEL_EN[t] ?? t);
  const qc = useQueryClient();
  const allowed = isSuperAdmin || can('platform.users.manage');
  const [createOpen, setCreateOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<AppUser | null>(null);
  const [manageUser, setManageUser] = useState<AppUser | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [resyncing, setResyncing] = useState(false);

  async function resyncAccess() {
    if (!profile?.uid) return;
    setResyncing(true);
    try {
      const res = await resyncAllAccess(profile.uid);
      toast.success(tt('Girişlər sinxronlaşdırıldı', 'Access re-synced'), tt(`${res.users} istifadəçi yeniləndi`, `${res.users} users updated`));
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      toast.error(tt('Sinxronizasiya alınmadı', 'Re-sync failed'), e instanceof Error ? e.message : undefined);
    } finally { setResyncing(false); }
  }

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: allowed });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      if (typeFilter && u.userType !== typeFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (q && !(`${u.displayName ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, typeFilter, statusFilter]);

  if (!allowed) {
    return <div><PageHeader title={tt('İstifadəçilər', 'Users')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} description={tt("Bu bölmə üçün 'platform.users.manage' icazəsi lazımdır.", "The 'platform.users.manage' permission is required for this section.")} /></div>;
  }

  return (
    <div>
      <PageHeader
        title={tt('İstifadəçilər', 'Users')}
        subtitle={tt('Platform, staff və müştəri istifadəçiləri (01 §3.3)', 'Platform, staff and client users (01 §3.3)')}
        action={<div className="flex items-center gap-2">
          <ExportButton filename="istifadeciler" rows={data ?? []} columns={[
            { header: tt('Ad', 'Name'), value: (u) => u.displayName ?? '' }, { header: tt('E-poçt', 'Email'), value: 'email' },
            { header: tt('Tip', 'Type'), value: (u) => typeLabel(u.userType) }, { header: 'Status', value: 'status' },
            { header: tt('Son giriş', 'Last login'), value: (u) => { const t = toMillis(u.lastLoginAt); return t ? formatDateTime(t) : ''; } },
          ]} />
          {isSuperAdmin && (
            <Button variant="outline" onClick={resyncAccess} disabled={resyncing} title={tt('«İcazə yoxdur» xətası verən hesabların giriş massivini bərpa edir', 'Repairs the access array for accounts hitting permission errors')}>
              {resyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {tt('Girişləri sinxronla', 'Re-sync access')}
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni istifadəçi', 'New user')}</Button>
        </div>}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={tt('İstifadəçi yoxdur', 'No users')} action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {tt('İlk istifadəçini yarat', 'Create the first user')}</Button>} />
      ) : (
        <>
          <TableToolbar
            search={search} onSearch={setSearch} searchPlaceholder={tt('Ad və ya e-poçt üzrə axtar…', 'Search by name or email…')}
            count={filtered.length} total={data.length}
            selects={[
              { value: typeFilter, onChange: setTypeFilter, placeholder: tt('Tip', 'Type'), options: (['platform_super_admin', 'staff', 'client_user'] as UserType[]).map((t) => ({ value: t, label: typeLabel(t) })) },
              { value: statusFilter, onChange: setStatusFilter, placeholder: 'Status', options: [
                { value: 'active', label: tt('Aktiv', 'Active') }, { value: 'invited', label: tt('Dəvət edilib', 'Invited') }, { value: 'disabled', label: tt('Deaktiv', 'Disabled') },
              ] },
            ]}
          />
          {filtered.length === 0 ? (
            <EmptyState title={tt('Nəticə yoxdur', 'No results')} description={tt('Filtrləri dəyişin.', 'Adjust the filters.')} />
          ) : (
          <Card className="rounded-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('E-poçt', 'Email')}</TableHead><TableHead>{tt('Tip', 'Type')}</TableHead>
                    <TableHead>Status</TableHead><TableHead>{tt('Son giriş', 'Last login')}</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.displayName || '—'}{u.mustChangePassword && <Badge variant="warning" className="ml-2">{tt('parol dəyişməli', 'must change password')}</Badge>}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{typeLabel(u.userType)}</TableCell>
                      <TableCell><Badge variant={u.status === 'active' ? 'success' : u.status === 'invited' ? 'warning' : 'secondary'}>{u.status === 'active' ? tt('aktiv', 'active') : u.status === 'invited' ? tt('dəvət', 'invited') : tt('deaktiv', 'disabled')}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(toMillis(u.lastLoginAt))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setManageUser(u)} title={tt('İstifadəçini idarə et', 'Manage user')}>
                            <UserCog className="h-4 w-4" /> {tt('İdarə et', 'Manage')}
                          </Button>
                          {u.userType !== 'platform_super_admin' && (
                            <Button variant="ghost" size="sm" onClick={() => setAccessUser(u)} title={tt('Şirkət təyinatları', 'Company assignments')}>
                              <Settings2 className="h-4 w-4" /> {tt('Giriş', 'Access')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </>
      )}

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        createdBy={profile?.uid ?? ''}
        onCreated={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
      <UserAccessDialog user={accessUser} onOpenChange={(o) => !o && setAccessUser(null)} actorUid={profile?.uid ?? ''} />
      <UserManageDialog user={manageUser} onOpenChange={(o) => !o && setManageUser(null)} actorUid={profile?.uid ?? ''} selfUid={profile?.uid ?? ''} />
    </div>
  );
}

function toMillis(ts: unknown): number | null {
  const v = (ts as { toMillis?: () => number })?.toMillis?.();
  return v ?? null;
}
