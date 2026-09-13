'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Settings2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listUsers } from '@/lib/firebase/users';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils/format';
import { UserCreateDialog } from './user-create-dialog';
import { UserAccessDialog } from './user-access-dialog';
import type { AppUser, UserType } from '@/types';

const TYPE_LABEL: Record<UserType, string> = {
  platform_super_admin: 'Super Admin', staff: 'Staff (Konsultant)', client_user: 'Müştəri istifadəçisi',
};

export default function UsersPage() {
  const { can, isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const allowed = isSuperAdmin || can('platform.users.manage');
  const [createOpen, setCreateOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<AppUser | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: allowed });

  if (!allowed) {
    return <div><PageHeader title="İstifadəçilər" /><EmptyState title="İcazə yoxdur" description="Bu bölmə üçün 'platform.users.manage' icazəsi lazımdır." /></div>;
  }

  return (
    <div>
      <PageHeader
        title="İstifadəçilər"
        subtitle="Platform, staff və müştəri istifadəçiləri (01 §3.3)"
        action={<div className="flex items-center gap-2">
          <ExportButton filename="istifadeciler" rows={data ?? []} columns={[
            { header: 'Ad', value: (u) => u.displayName ?? '' }, { header: 'E-poçt', value: 'email' },
            { header: 'Tip', value: (u) => TYPE_LABEL[u.userType] ?? u.userType }, { header: 'Status', value: 'status' },
            { header: 'Son giriş', value: (u) => { const t = toMillis(u.lastLoginAt); return t ? formatDateTime(t) : ''; } },
          ]} />
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Yeni istifadəçi</Button>
        </div>}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="İstifadəçi yoxdur" action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> İlk istifadəçini yarat</Button>} />
      ) : (
        <Card className="rounded-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead><TableHead>E-poçt</TableHead><TableHead>Tip</TableHead>
                  <TableHead>Status</TableHead><TableHead>Son giriş</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-medium">{u.displayName || '—'}{u.mustChangePassword && <Badge variant="warning" className="ml-2">parol dəyişməli</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{TYPE_LABEL[u.userType] ?? u.userType}</TableCell>
                    <TableCell><Badge variant={u.status === 'active' ? 'success' : u.status === 'invited' ? 'warning' : 'secondary'}>{u.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(toMillis(u.lastLoginAt))}</TableCell>
                    <TableCell className="text-right">
                      {u.userType !== 'platform_super_admin' && (
                        <Button variant="ghost" size="sm" onClick={() => setAccessUser(u)} title="Şirkət təyinatları">
                          <Settings2 className="h-4 w-4" /> Giriş
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        createdBy={profile?.uid ?? ''}
        onCreated={() => qc.invalidateQueries({ queryKey: ['users'] })}
      />
      <UserAccessDialog user={accessUser} onOpenChange={(o) => !o && setAccessUser(null)} actorUid={profile?.uid ?? ''} />
    </div>
  );
}

function toMillis(ts: unknown): number | null {
  const v = (ts as { toMillis?: () => number })?.toMillis?.();
  return v ?? null;
}
