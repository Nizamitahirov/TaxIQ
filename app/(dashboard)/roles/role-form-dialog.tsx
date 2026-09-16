'use client';

import { useState } from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { createRole, updateRole } from '@/lib/firebase/roles';
import { logAudit } from '@/lib/firebase/audit';
import { MODULES, PERMISSIONS, checkSoD, type ModuleKey } from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';

export interface RoleFormSeed {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}

export function RoleFormDialog({ open, onOpenChange, seed, companyId, actorUid, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** mövcud rolu redaktə/klonlamaq üçün ilkin dəyərlər (id varsa redaktə, yoxdursa yeni/klon) */
  seed?: RoleFormSeed | null;
  companyId: string | null;
  actorUid: string;
  onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(seed?.permissions ?? []));
  const [saving, setSaving] = useState(false);

  // seed dəyişəndə state-i sıfırla (dialog yenidən açılanda)
  const [seedKey, setSeedKey] = useState('');
  const key = (seed?.id ?? 'new') + (open ? '1' : '0');
  if (key !== seedKey && open) {
    setSeedKey(key);
    setName(seed?.name ?? '');
    setDescription(seed?.description ?? '');
    setSelected(new Set(seed?.permissions ?? []));
  }

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleModule(mod: ModuleKey, on: boolean) {
    const modPerms = PERMISSIONS.filter((p) => p.module === mod).map((p) => p.id);
    setSelected((prev) => {
      const n = new Set(prev);
      modPerms.forEach((id) => on ? n.add(id) : n.delete(id));
      return n;
    });
  }

  const sod = checkSoD([...selected]);

  async function save() {
    if (!name.trim()) { toast.error(tt('Rol adı tələb olunur', 'Role name is required')); return; }
    setSaving(true);
    try {
      const perms = [...selected];
      if (seed?.id) {
        await updateRole(seed.id, { name: name.trim(), description, permissions: perms });
        await logAudit({ companyId, userId: actorUid, action: 'ROLE_PERMISSION_CHANGED', entityType: 'role', entityId: seed.id, after: { permissions: perms.length } });
        toast.success(tt('Rol yeniləndi', 'Role updated'));
      } else {
        const id = await createRole({
          name: name.trim(), description, type: 'custom', companyId,
          clonedFromRoleId: null, permissions: perms, createdBy: actorUid,
        });
        await logAudit({ companyId, userId: actorUid, action: 'ROLE_CREATED', entityType: 'role', entityId: id, after: { name, permissions: perms.length } });
        toast.success(tt('Rol yaradıldı', 'Role created'));
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{seed?.id ? tt('Rolu redaktə et', 'Edit role') : tt('Yeni rol', 'New role')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>{tt('Ad', 'Name')} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anbar + Satış Nəzarətçisi" /></div>
            <div className="space-y-2"><Label>{tt('Təsvir', 'Description')}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>

          {sod.length > 0 && (
            <div className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{tt(`Vəzifələrin Ayrılması (SoD) xəbərdarlığı: bu rol həm yaratma, həm təsdiqləmə icazəsinə malikdir (${sod.length} modulda) — daxili nəzarət prinsipinə zidd ola bilər (01 §6.3).`, `Segregation of Duties (SoD) warning: this role has both create and approve permissions (in ${sod.length} module(s)) — this may conflict with the internal control principle (01 §6.3).`)}</span>
            </div>
          )}

          <div className="space-y-3">
            {MODULES.map((mod) => {
              const perms = PERMISSIONS.filter((p) => p.module === (mod.key as ModuleKey));
              if (perms.length === 0) return null;
              const granted = perms.filter((p) => selected.has(p.id)).length;
              const allOn = granted === perms.length;
              return (
                <div key={mod.key} className="rounded-card border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">{tt(mod.label.az, mod.label.en)}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={granted > 0 ? 'success' : 'secondary'}>{granted}/{perms.length}</Badge>
                      <button className="text-xs font-medium text-primary hover:underline" onClick={() => toggleModule(mod.key as ModuleKey, !allOn)}>
                        {allOn ? tt('Heç biri', 'None') : tt('Hamısı', 'All')}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => {
                      const on = selected.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggle(p.id)}
                          title={p.id}
                          className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors', on ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-secondary')}
                        >
                          {p.id.split('.').slice(-1)[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">{tt(`${selected.size} icazə seçilib`, `${selected.size} permission(s) selected`)}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tt('Ləğv et', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
