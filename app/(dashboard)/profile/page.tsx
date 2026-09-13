'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function ProfilePage() {
  const { profile, active, memberships } = useAuth();
  const name = profile?.displayName || profile?.email || 'İstifadəçi';

  return (
    <div>
      <PageHeader title="Profil" subtitle="Hesab məlumatları və əlçatan şirkətlər" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-card lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Avatar className="h-20 w-20 text-2xl"><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <p className="text-lg font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            <Badge variant="secondary">{profile?.userType}</Badge>
          </CardContent>
        </Card>

        <Card className="rounded-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Əlçatan şirkətlər və rollar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {memberships.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Şirkət təyinatı yoxdur</p>
            ) : memberships.map((m) => (
              <div key={m.companyId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">{m.company.name}{m.company.isInternal && ' · Daxili'}</p>
                  <p className="text-xs text-muted-foreground">{m.permissions.size} icazə</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{m.roleName}</Badge>
                  {m.companyId === active?.companyId && <Badge variant="success">Aktiv</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
