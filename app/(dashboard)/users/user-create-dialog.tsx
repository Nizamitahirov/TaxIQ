'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Copy, Check, KeyRound } from 'lucide-react';
import { createUser, type CreateUserResult } from '@/lib/firebase/user-admin';
import { listCompanies } from '@/lib/firebase/companies';
import { listRolesForCompany } from '@/lib/firebase/roles';
import { SYSTEM_ROLES } from '@/lib/rbac/permissions';
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
import type { UserType } from '@/types';

const TYPES: { value: UserType; label: string }[] = [
  { value: 'staff', label: 'Staff (Konsultant)' },
  { value: 'client_user', label: 'Müştəri istifadəçisi' },
  { value: 'platform_super_admin', label: 'Platform Super Admin' },
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

  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: open });
  const { data: roles } = useQuery({
    queryKey: ['roles', companyId || 'none'],
    queryFn: () => listRolesForCompany(companyId || null),
    enabled: open,
  });
  const roleOptions = [
    ...SYSTEM_ROLES.filter((r) => r.code !== 'platform_super_admin').map((r) => ({ id: r.code, name: r.name.az })),
    ...(roles ?? []).filter((r) => r.type === 'custom').map((r) => ({ id: r.id, name: r.name })),
  ];

  function reset() {
    setName(''); setIdentifier(''); setUserType('staff'); setCompanyId(''); setRoleId('');
    setResult(null); setCopied(false);
  }

  async function submit() {
    if (!displayName.trim() || !identifier.trim()) { toast.error('Ad və e-poçt/istifadəçi adı tələb olunur'); return; }
    if (userType === 'client_user' && (!companyId || !roleId)) { toast.error('Müştəri istifadəçisi üçün şirkət və rol seçin'); return; }
    setSaving(true);
    try {
      const res = await createUser({
        displayName: displayName.trim(), identifier: identifier.trim(), userType,
        companyId: companyId || null, roleId: roleId || null, createdBy,
      });
      setResult(res);
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Xəta';
      toast.error('İstifadəçi yaradıla bilmədi', msg.includes('email-already-in-use') ? 'Bu e-poçt artıq istifadədədir' : msg);
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
            <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-success" /> İstifadəçi yaradıldı</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Müvəqqəti giriş məlumatlarını indi kopyalayın — yalnız bir dəfə göstərilir. İstifadəçi ilk girişdə parolu dəyişməlidir.</p>
              <div className="rounded-card border border-border bg-secondary/40 p-4 font-mono text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">E-poçt:</span><span className="font-semibold">{result.email}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Parol:</span><span className="font-semibold">{result.tempPassword}</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={copyCreds}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Kopyalandı' : 'Məlumatları kopyala'}
              </Button>
            </div>
            <DialogFooter><Button onClick={() => { reset(); onOpenChange(false); }}>Bağla</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Yeni istifadəçi</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Tam ad *</Label><Input value={displayName} onChange={(e) => setName(e.target.value)} placeholder="Əli Məmmədov" /></div>
              <div className="space-y-2"><Label>E-poçt / istifadəçi adı *</Label><Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ali@nümunə.az" /></div>
              <div className="space-y-2">
                <Label>İstifadəçi tipi</Label>
                <Select value={userType} onValueChange={(v) => setUserType(v as UserType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {userType !== 'platform_super_admin' && (
                <>
                  <div className="space-y-2">
                    <Label>Şirkət {userType === 'client_user' && '*'}</Label>
                    <Select value={companyId} onValueChange={setCompanyId}>
                      <SelectTrigger><SelectValue placeholder="Şirkət seç" /></SelectTrigger>
                      <SelectContent>{(companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rol {userType === 'client_user' && '*'}</Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger><SelectValue placeholder="Rol seç" /></SelectTrigger>
                      <SelectContent>{roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
