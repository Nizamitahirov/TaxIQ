'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Info } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listUsers } from '@/lib/firebase/users';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils/format';
import type { UserType } from '@/types';

const TYPE_LABEL: Record<UserType, string> = {
  platform_super_admin: 'Super Admin', staff: 'Staff (Konsultant)', client_user: 'Müştəri istifadəçisi',
};

export default function UsersPage() {
  const { can, isSuperAdmin } = useAuth();
  const allowed = isSuperAdmin || can('platform.users.manage');
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: allowed });

  if (!allowed) {
    return <div><PageHeader title="İstifadəçilər" /><EmptyState title="İcazə yoxdur" description="Bu bölmə üçün 'platform.users.manage' icazəsi lazımdır." /></div>;
  }

  return (
    <div>
      <PageHeader title="İstifadəçilər" subtitle="Platform, staff və müştəri istifadəçiləri" />
      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Yeni istifadəçi yaradılması Firebase Auth hesabı + müvəqqəti parol tələb edir və Cloud Function (admin SDK) vasitəsilə edilir (01 §3.3) — bu funksiya növbəti mərhələdə qoşulur.
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="İstifadəçi yoxdur" />
      ) : (
        <Card className="rounded-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead><TableHead>E-poçt</TableHead><TableHead>Tip</TableHead>
                  <TableHead>Status</TableHead><TableHead>Son giriş</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toMillis(ts: unknown): number | null {
  const v = (ts as { toMillis?: () => number })?.toMillis?.();
  return v ?? null;
}
