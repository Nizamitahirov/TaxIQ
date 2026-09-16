'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, KeyRound, Mail, ShieldOff, ShieldCheck } from 'lucide-react';
import {
  updateUserAdmin, setUserStatus, requirePasswordChange, sendUserPasswordReset,
} from '@/lib/firebase/user-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { AppUser, UserStatus, UserType } from '@/types';

const TYPES: { value: UserType; az: string; en: string }[] = [
  { value: 'staff', az: 'Staff (Konsultant)', en: 'Staff (Consultant)' },
  { value: 'client_user', az: 'Müştəri istifadəçisi', en: 'Client user' },
  { value: 'platform_super_admin', az: 'Platform Super Admin', en: 'Platform Super Admin' },
];

export function UserManageDialog({ user, onOpenChange, actorUid, selfUid }: {
  user: AppUser | null; onOpenChange: (o: boolean) => void; actorUid: string; selfUid: string;
}) {
  const tt = useTT();
  const qc = useQueryClient();
  const open = !!user;
  const isSelf = user?.uid === selfUid;
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [userType, setUserType] = useState<UserType>(user?.userType ?? 'staff');
  const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active');
  const [busy, setBusy] = useState(false);

  // user dəyişəndə state-i sıfırla
  const [key, setKey] = useState('');
  const k = (user?.uid ?? '') + (open ? '1' : '0');
  if (k !== key && open && user) {
    setKey(k);
    setDisplayName(user.displayName ?? '');
    setPhone(user.phone ?? '');
    setUserType(user.userType);
    setStatus(user.status);
  }

  function invalidate() { qc.invalidateQueries({ queryKey: ['users'] }); }

  async function save() {
    if (!user) return;
    if (!displayName.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setBusy(true);
    try {
      await updateUserAdmin({ userId: user.uid, patch: { displayName: displayName.trim(), phone: phone.trim() || null, userType }, actorUid });
      if (status !== user.status) await setUserStatus({ userId: user.uid, status, actorUid });
      toast.success(tt('İstifadəçi yeniləndi', 'User updated'));
      invalidate(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  async function requireChange() {
    if (!user) return;
    setBusy(true);
    try { await requirePasswordChange(user.uid, actorUid); toast.success(tt('Növbəti girişdə parol dəyişmə tələb olunacaq', 'Password change will be required on next login')); invalidate(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  async function sendReset() {
    if (!user) return;
    setBusy(true);
    try { await sendUserPasswordReset(user.email, user.uid, actorUid); toast.success(tt('Parol sıfırlama e-poçtu göndərildi', 'Password reset email sent'), user.email); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{user.displayName || user.email} — {tt('İstifadəçini idarə et', 'Manage user')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>{tt('Ad Soyad', 'Full name')}</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Telefon', 'Phone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." /></div>
            <div className="space-y-2">
              <Label>{tt('İstifadəçi tipi', 'User type')}</Label>
              <Select value={userType} onValueChange={(v) => setUserType(v as UserType)} disabled={isSelf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tt(t.az, t.en)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as UserStatus)} disabled={isSelf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tt('Aktiv', 'Active')}</SelectItem>
                  <SelectItem value="invited">{tt('Dəvət edilib', 'Invited')}</SelectItem>
                  <SelectItem value="disabled">{tt('Deaktiv', 'Disabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isSelf && <p className="rounded-lg bg-warning/10 p-2.5 text-xs text-warning-foreground">{tt('Öz hesabınızın tipini və ya statusunu dəyişə bilməzsiniz.', 'You cannot change your own account type or status.')}</p>}

          <div className="rounded-card border border-dashed border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> {tt('Təhlükəsizlik', 'Security')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={requireChange} disabled={busy}>
                {user.mustChangePassword ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4" />}
                {tt('Parol dəyişməyi tələb et', 'Require password change')}
              </Button>
              <Button variant="outline" size="sm" onClick={sendReset} disabled={busy}><Mail className="h-4 w-4" /> {tt('Sıfırlama e-poçtu göndər', 'Send reset email')}</Button>
              {user.mustChangePassword && <Badge variant="warning">{tt('parol dəyişməli', 'must change password')}</Badge>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tt('Bağla', 'Close')}</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
