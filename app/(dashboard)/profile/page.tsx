'use client';

import { useState } from 'react';
import { Loader2, Save, User as UserIcon, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useAvatarUpload } from '@/components/shared/use-avatar-upload';
import { updateUser } from '@/lib/firebase/users';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';

const TYPE_LABEL: Record<string, string> = {
  platform_super_admin: 'Platform Super Admin', staff: 'Staff (Konsultant)', client_user: 'Müştəri istifadəçisi',
};
const TYPE_LABEL_EN: Record<string, string> = {
  platform_super_admin: 'Platform Super Admin', staff: 'Staff (Consultant)', client_user: 'Client user',
};

export default function ProfilePage() {
  const { profile, active, memberships, refresh } = useAuth();
  const tt = useTT();
  const { inputRef, uploading, openPicker, onFile, removeAvatar } = useAvatarUpload();
  const name = profile?.displayName || profile?.email || tt('İstifadəçi', 'User');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile?.uid) return;
    if (!displayName.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      await updateUser(profile.uid, { displayName: displayName.trim(), phone: phone.trim() || null });
      await refresh();
      toast.success(tt('Profil yeniləndi', 'Profile updated'));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
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
      <PageHeader title={tt('Profil', 'Profile')} subtitle={tt('Hesab məlumatları, tərcihlər və əlçatan şirkətlər', 'Account details, preferences and accessible companies')} />
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sol: kart + prefs */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="rounded-card">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={openPicker} disabled={uploading} title={tt('Şəkli dəyişdir', 'Change photo')} className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <Avatar className="h-20 w-20 text-2xl">{profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={name} />}<AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </span>
              </button>
              <div><p className="text-lg font-semibold">{name}</p><p className="text-sm text-muted-foreground">{profile?.email}</p></div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={openPicker} disabled={uploading}><Camera className="h-3.5 w-3.5" /> {profile?.avatarUrl ? tt('Dəyişdir', 'Change') : tt('Şəkil əlavə et', 'Add photo')}</Button>
                {profile?.avatarUrl && <Button variant="ghost" size="sm" onClick={removeAvatar} disabled={uploading} className="text-danger"><Trash2 className="h-3.5 w-3.5" /> {tt('Sil', 'Delete')}</Button>}
              </div>
              <Badge variant="secondary">{tt(TYPE_LABEL[profile?.userType ?? ''] ?? profile?.userType ?? '', TYPE_LABEL_EN[profile?.userType ?? ''] ?? profile?.userType ?? '')}</Badge>
              {active && <p className="text-xs text-muted-foreground">{tt('Aktiv', 'Active')}: <span className="font-medium text-foreground">{active.company.name}</span> · {active.roleName}</p>}
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">{tt('Tərcihlər', 'Preferences')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>{tt('Tema', 'Theme')}</Label><div className="flex gap-2">{[['light', tt('Açıq', 'Light')], ['dark', tt('Tünd', 'Dark')], ['system', tt('Sistem', 'System')]].map(([v, l]) => <Button key={v} variant="outline" size="sm" onClick={() => applyTheme(v)}>{l}</Button>)}</div></div>
              <div className="space-y-2"><Label>{tt('Dil', 'Language')}</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setLang('az')}>🇦🇿 AZ</Button><Button variant="outline" size="sm" onClick={() => setLang('en')}>🇬🇧 EN</Button></div></div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ: redaktə + şirkətlər */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserIcon className="h-4 w-4 text-primary" /> {tt('Şəxsi məlumat', 'Personal information')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>{tt('Ad Soyad', 'Full name')}</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <div className="space-y-2"><Label>{tt('E-poçt', 'Email')}</Label><Input value={profile?.email ?? ''} disabled /></div>
                <div className="space-y-2"><Label>{tt('Telefon', 'Phone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." /></div>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">{tt('Əlçatan şirkətlər və rollar', 'Accessible companies and roles')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {memberships.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{tt('Şirkət təyinatı yoxdur', 'No company assignments')}</p> : memberships.map((m) => (
                <div key={m.companyId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div><p className="text-sm font-medium">{m.company.name}{m.company.isInternal && tt(' · Daxili', ' · Internal')}</p><p className="text-xs text-muted-foreground">{tt(`${m.permissions.size} icazə`, `${m.permissions.size} permission(s)`)}</p></div>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{m.roleName}</Badge>{m.companyId === active?.companyId && <Badge variant="success">{tt('Aktiv', 'Active')}</Badge>}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
