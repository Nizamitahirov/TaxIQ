'use client';

import { useState } from 'react';
import { Loader2, Save, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { updateUser } from '@/lib/firebase/users';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';

const TYPE_LABEL: Record<string, string> = {
  platform_super_admin: 'Platform Super Admin', staff: 'Staff (Konsultant)', client_user: 'Müştəri istifadəçisi',
};

export default function ProfilePage() {
  const { profile, active, memberships, refresh } = useAuth();
  const name = profile?.displayName || profile?.email || 'İstifadəçi';
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile?.uid) return;
    if (!displayName.trim()) { toast.error('Ad tələb olunur'); return; }
    setSaving(true);
    try {
      await updateUser(profile.uid, { displayName: displayName.trim(), phone: phone.trim() || null });
      await refresh();
      toast.success('Profil yeniləndi');
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  function applyTheme(next: string) {
    try {
      if (next === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
      else if (next === 'light') { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
      else { localStorage.removeItem('theme'); document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches); }
    } catch { /* ignore */ }
  }
  function setLang(l: string) { document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000`; location.reload(); }

  return (
    <div>
      <PageHeader title="Profil" subtitle="Hesab məlumatları, tərcihlər və əlçatan şirkətlər" />
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sol: kart + prefs */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="rounded-card">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <Avatar className="h-20 w-20 text-2xl">{profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={name} />}<AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div><p className="text-lg font-semibold">{name}</p><p className="text-sm text-muted-foreground">{profile?.email}</p></div>
              <Badge variant="secondary">{TYPE_LABEL[profile?.userType ?? ''] ?? profile?.userType}</Badge>
              {active && <p className="text-xs text-muted-foreground">Aktiv: <span className="font-medium text-foreground">{active.company.name}</span> · {active.roleName}</p>}
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Tərcihlər</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Tema</Label><div className="flex gap-2">{[['light', 'Açıq'], ['dark', 'Tünd'], ['system', 'Sistem']].map(([v, l]) => <Button key={v} variant="outline" size="sm" onClick={() => applyTheme(v)}>{l}</Button>)}</div></div>
              <div className="space-y-2"><Label>Dil</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setLang('az')}>🇦🇿 AZ</Button><Button variant="outline" size="sm" onClick={() => setLang('en')}>🇬🇧 EN</Button></div></div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: redaktə + şirkətlər */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserIcon className="h-4 w-4 text-primary" /> Şəxsi məlumat</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Ad Soyad</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <div className="space-y-2"><Label>E-poçt</Label><Input value={profile?.email ?? ''} disabled /></div>
                <div className="space-y-2"><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." /></div>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Əlçatan şirkətlər və rollar</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {memberships.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Şirkət təyinatı yoxdur</p> : memberships.map((m) => (
                <div key={m.companyId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div><p className="text-sm font-medium">{m.company.name}{m.company.isInternal && ' · Daxili'}</p><p className="text-xs text-muted-foreground">{m.permissions.size} icazə</p></div>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{m.roleName}</Badge>{m.companyId === active?.companyId && <Badge variant="success">Aktiv</Badge>}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
