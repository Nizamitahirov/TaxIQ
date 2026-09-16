'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Copy, Check, KeyRound } from 'lucide-react';
import { createUser, type CreateUserResult } from '@/lib/firebase/user-admin';
import { listCompanies } from '@/lib/firebase/companies';
import { listRolesForCompany } from '@/lib/firebase/roles';
import { assignableSystemRoles } from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { UserType } from '@/types';

const TYPES: { value: UserType; label: string; en: string }[] = [
  { value: 'staff', label: 'Staff (Konsultant)', en: 'Staff (Consultant)' },
  { value: 'client_user', label: 'Müştəri istifadəçisi', en: 'Client user' },
  { value: 'platform_super_admin', label: 'Platform Super Admin', en: 'Platform Super Admin' },
];

export function UserCreateDialog({ open, onOpenChange, createdBy, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; createdBy: string; onCreated: () => void;
}) {
  const [displayName, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [userType, setUserType] = useState<UserType>('staff');
  const [companyId, setCompanyId] = useState<string>('');
  const [roleId, setRoleId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateUserResult | null>(null);
  const [copied, setCopied] = useState(false);
  const tt = useTT();

  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: open });
  const { data: roles } = useQuery({
    queryKey: ['roles', companyId || 'none'],
    queryFn: () => listRolesForCompany(companyId || null),
    enabled: open,
  });
  const roleOptions = [
    ...assignableSystemRoles(userType === 'client_user' ? 'client_user' : 'staff').map((r) => ({ id: r.code, name: tt(r.name.az, r.name.en) })),
    ...(roles ?? []).filter((r) => r.type === 'custom').map((r) => ({ id: r.id, name: r.name })),
  ];

  function reset() {
    setName(''); setIdentifier(''); setUserType('staff'); setCompanyId(''); setRoleId('');
    setResult(null); setCopied(false);
  }

  async function submit() {
    if (!displayName.trim() || !identifier.trim()) { toast.error(tt('Ad və e-poçt/istifadəçi adı tələb olunur', 'Name and email/username are required')); return; }
    if (userType === 'client_user' && (!companyId || !roleId)) { toast.error(tt('Müştəri istifadəçisi üçün şirkət və rol seçin', 'Select a company and role for a client user')); return; }
    setSaving(true);
    try {
      const res = await createUser({
        displayName: displayName.trim(), identifier: identifier.trim(), userType,
        companyId: companyId || null, roleId: roleId || null, createdBy,
      });
      setResult(res);
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Xəta', 'Error');
      toast.error(tt('İstifadəçi yaradıla bilmədi', 'Could not create user'), msg.includes('email-already-in-use') ? tt('Bu e-poçt artıq istifadədədir', 'This email is already in use') : msg);
    } finally {
      setSaving(false);
    }
  }

  function copyCreds() {
    if (!result) return;
    navigator.clipboard.writeText(`${result.email} / ${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-success" /> {tt('İstifadəçi yaradıldı', 'User created')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{tt('Müvəqqəti giriş məlumatlarını indi kopyalayın — yalnız bir dəfə göstərilir. İstifadəçi ilk girişdə parolu dəyişməlidir.', 'Copy the temporary credentials now — they are shown only once. The user must change the password on first login.')}</p>
              <div className="rounded-card border border-border bg-secondary/40 p-4 font-mono text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{tt('E-poçt', 'Email')}:</span><span className="font-semibold">{result.email}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{tt('Parol', 'Password')}:</span><span className="font-semibold">{result.tempPassword}</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={copyCreds}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? tt('Kopyalandı', 'Copied') : tt('Məlumatları kopyala', 'Copy credentials')}
              </Button>
            </div>
            <DialogFooter><Button onClick={() => { reset(); onOpenChange(false); }}>{tt('Bağla', 'Close')}</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>{tt('Yeni istifadəçi', 'New user')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>{tt('Tam ad', 'Full name')} *</Label><Input value={displayName} onChange={(e) => setName(e.target.value)} placeholder="Əli Məmmədov" /></div>
              <div className="space-y-2"><Label>{tt('E-poçt / istifadəçi adı', 'Email / username')} *</Label><Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ali@nümunə.az" /></div>
              <div className="space-y-2">
                <Label>{tt('İstifadəçi tipi', 'User type')}</Label>
                <Select value={userType} onValueChange={(v) => { setUserType(v as UserType); setRoleId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tt(t.label, t.en)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {userType !== 'platform_super_admin' && (
                <>
                  <div className="space-y-2">
                    <Label>{tt('Şirkət', 'Company')} {userType === 'client_user' && '*'}</Label>
                    <Select value={companyId} onValueChange={setCompanyId}>
                      <SelectTrigger><SelectValue placeholder={tt('Şirkət seç', 'Select company')} /></SelectTrigger>
                      <SelectContent>{(companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt('Rol', 'Role')} {userType === 'client_user' && '*'}</Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger><SelectValue placeholder={tt('Rol seç', 'Select role')} /></SelectTrigger>
                      <SelectContent>{roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
