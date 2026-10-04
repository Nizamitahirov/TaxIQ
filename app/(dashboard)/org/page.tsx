'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Building2, User, Users2, GitBranch, Plus, Trash2, Network } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listDepartments, createDepartment, deleteDepartment } from '@/lib/firebase/departments';
import { listEmployees, updateEmployee } from '@/lib/firebase/hr';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { Department, Employee } from '@/types';

interface DeptNode { dept: Department; children: DeptNode[]; employees: Employee[] }
interface EmpNode { emp: Employee; reports: EmpNode[] }

export default function OrgPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const canEdit = isSuperAdmin || can('hr.employee.create') || can('hr.employee.view');
  const qc = useQueryClient();

  const { data: departments, isLoading: dl } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId!), enabled: canView && !!companyId });
  const { data: employees, isLoading: el } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId!), enabled: canView && !!companyId });
  const refreshDept = () => qc.invalidateQueries({ queryKey: ['departments', companyId] });
  const refreshEmp = () => qc.invalidateQueries({ queryKey: ['employees', companyId] });

  const { roots, unassigned, totalEmp } = useMemo(() => {
    const depts = (departments ?? []).filter((d) => d.isActive !== false);
    const emps = (employees ?? []).filter((e) => e.status === 'active');
    const empByDept = new Map<string, Employee[]>();
    for (const e of emps) { const k = e.departmentId ?? '__none'; if (!empByDept.has(k)) empByDept.set(k, []); empByDept.get(k)!.push(e); }
    const nodeById = new Map<string, DeptNode>();
    for (const d of depts) nodeById.set(d.id, { dept: d, children: [], employees: empByDept.get(d.id) ?? [] });
    const roots: DeptNode[] = [];
    for (const d of depts) {
      const node = nodeById.get(d.id)!;
      if (d.parentDepartmentId && nodeById.has(d.parentDepartmentId)) nodeById.get(d.parentDepartmentId)!.children.push(node);
      else roots.push(node);
    }
    return { roots, unassigned: empByDept.get('__none') ?? [], totalEmp: emps.length };
  }, [departments, employees]);

  const reporting = useMemo(() => {
    const emps = (employees ?? []).filter((e) => e.status === 'active');
    const byId = new Map<string, EmpNode>();
    for (const e of emps) byId.set(e.id, { emp: e, reports: [] });
    const roots: EmpNode[] = [];
    for (const e of emps) {
      const node = byId.get(e.id)!;
      if (e.managerId && byId.has(e.managerId) && e.managerId !== e.id) byId.get(e.managerId)!.reports.push(node);
      else roots.push(node);
    }
    return roots;
  }, [employees]);

  const activeEmps = (employees ?? []).filter((e) => e.status === 'active');

  async function setManager(emp: Employee, managerId: string | null) {
    const mgr = managerId ? activeEmps.find((m) => m.id === managerId) : null;
    try {
      await updateEmployee(emp.id, { managerId: managerId, managerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : null });
      toast.success(tt('Yeniləndi', 'Updated')); refreshEmp();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  if (!companyId) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;
  if (dl || el) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></div>;

  return (
    <div>
      <PageHeader title={tt('Təşkilati struktur', 'Org structure')} subtitle={tt(`${departments?.length ?? 0} şöbə · ${totalEmp} aktiv işçi`, `${departments?.length ?? 0} departments · ${totalEmp} active employees`)} />
      <Tabs defaultValue="reporting">
        <TabsList className="mb-4">
          <TabsTrigger value="reporting"><GitBranch className="mr-1.5 h-4 w-4" />{tt('Hesabat xətti', 'Reporting line')}</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="mr-1.5 h-4 w-4" />{tt('Şöbələr', 'Departments')}</TabsTrigger>
          <TabsTrigger value="tree"><Network className="mr-1.5 h-4 w-4" />{tt('Struktur ağacı', 'Structure tree')}</TabsTrigger>
        </TabsList>

        {/* Hesabat xətti — vizuallaşdırma + rəhbər təyini */}
        <TabsContent value="reporting">
          <p className="mb-3 text-sm text-muted-foreground">{tt('Hər işçi üçün birbaşa rəhbəri seçin — ağac avtomatik qurulur.', 'Pick each employee’s direct manager — the tree builds automatically.')}</p>
          {reporting.length === 0 ? <EmptyState title={tt('İşçi yoxdur', 'No employees')} />
            : <div className="space-y-3">{reporting.map((n) => <EmpTreeNode key={n.emp.id} node={n} level={0} all={activeEmps} canEdit={canEdit} onSetManager={setManager} tt={tt} seen={new Set()} />)}</div>}
        </TabsContent>

        {/* Şöbələr — əlavə/sil */}
        <TabsContent value="departments">
          <DepartmentManager companyId={companyId} departments={departments ?? []} actorUid={profile?.uid ?? ''} canEdit={canEdit} onChanged={refreshDept} />
        </TabsContent>

        {/* Struktur ağacı — şöbə → işçi */}
        <TabsContent value="tree">
          {roots.length === 0 && unassigned.length === 0 ? (
            <EmptyState title={tt('Struktur boşdur', 'Structure is empty')} description={tt('«Şöbələr» tabından şöbə əlavə edin, HR → İşçilər-də işçi təyin edin', 'Add departments in the Departments tab, assign staff in HR → Employees')} />
          ) : (
            <div className="space-y-4">
              {roots.map((n) => <DeptTreeNode key={n.dept.id} node={n} level={0} tt={tt} />)}
              {unassigned.length > 0 && (
                <Card className="rounded-card border-dashed"><CardContent className="p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Users2 className="h-4 w-4" /> {tt('Şöbəsiz işçilər', 'Unassigned')} ({unassigned.length})</p>
                  <div className="flex flex-wrap gap-2">{unassigned.map((e) => <EmpChip key={e.id} e={e} />)}</div>
                </CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepartmentManager({ companyId, departments, actorUid, canEdit, onChanged }: { companyId: string; departments: Department[]; actorUid: string; canEdit: boolean; onChanged: () => void }) {
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function del(d: Department) {
    if (!confirm(tt('Şöbə silinsin?', 'Delete department?'))) return;
    setBusyId(d.id);
    try { await deleteDepartment(d.id); toast.success(tt('Silindi', 'Deleted')); onChanged(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Şöbələri burada idarə edin — alt şöbə üçün ana şöbə seçin.', 'Manage departments here — pick a parent for sub-departments.')}</p>
        {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni şöbə', 'New department')}</Button>}
      </div>
      {departments.length === 0 ? <EmptyState title={tt('Şöbə yoxdur', 'No departments')} />
        : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <Card key={d.id} className="rounded-card"><CardContent className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="font-medium">{d.name.az}</p>
                  <p className="text-xs text-muted-foreground">{d.code}{d.parentDepartmentId ? ` · ${tt('alt şöbə', 'sub')}` : ''} · {d.type === 'project' ? tt('Layihə', 'Project') : d.type === 'cost_center' ? tt('Xərc mərkəzi', 'Cost center') : tt('Şöbə', 'Dept')}</p>
                </div>
                {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" disabled={busyId === d.id} onClick={() => del(d)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </CardContent></Card>
            ))}
          </div>}
      {open && <DeptDialog companyId={companyId} departments={departments} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />}
    </div>
  );
}

function DeptDialog({ companyId, departments, onClose, onSaved }: { companyId: string; departments: Department[]; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({ name: '', code: '', parentDepartmentId: '', type: 'department' as Department['type'] });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.name.trim()) { toast.error(tt('Ad lazımdır', 'Name required')); return; }
    setSaving(true);
    try {
      await createDepartment({ companyId, name: { az: f.name.trim(), en: f.name.trim() }, code: f.code.trim() || f.name.slice(0, 3).toUpperCase(), parentDepartmentId: f.parentDepartmentId || null, type: f.type, isActive: true });
      toast.success(tt('Şöbə yaradıldı', 'Department created')); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Yeni şöbə', 'New department')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Ad *', 'Name *')}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Kod', 'Code')}</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder={tt('avtomatik', 'auto')} /></div>
        <div className="space-y-1"><Label>{tt('Növ', 'Type')}</Label>
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as Department['type'] })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="department">{tt('Şöbə', 'Department')}</SelectItem><SelectItem value="cost_center">{tt('Xərc mərkəzi', 'Cost center')}</SelectItem><SelectItem value="project">{tt('Layihə', 'Project')}</SelectItem></SelectContent></Select></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Ana şöbə', 'Parent department')}</Label>
          <Select value={f.parentDepartmentId || 'none'} onValueChange={(v) => setF({ ...f, parentDepartmentId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder={tt('Yoxdur', 'None')} /></SelectTrigger>
            <SelectContent><SelectItem value="none">{tt('Yoxdur (əsas)', 'None (root)')}</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function EmpTreeNode({ node, level, all, canEdit, onSetManager, tt, seen }: { node: EmpNode; level: number; all: Employee[]; canEdit: boolean; onSetManager: (e: Employee, m: string | null) => void; tt: (az: string, en: string) => string; seen: Set<string> }) {
  if (seen.has(node.emp.id)) return null; // dövr mühafizəsi (A↔B rəhbərlik)
  const nextSeen = new Set(seen).add(node.emp.id);
  return (
    <div className={level > 0 ? 'ml-5 border-l-2 border-border/60 pl-5' : ''}>
      <Card className="rounded-card"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{node.emp.firstName} {node.emp.lastName}</p>
            <p className="text-xs text-muted-foreground">{node.emp.position ?? '—'}{node.reports.length > 0 ? ` · ${node.reports.length} ${tt('tabe', 'reports')}` : ''}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{tt('Rəhbər:', 'Manager:')}</span>
            <Select value={node.emp.managerId || 'none'} onValueChange={(v) => onSetManager(node.emp, v === 'none' ? null : v)}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder={tt('Yoxdur', 'None')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tt('Yoxdur (ən üst)', 'None (top)')}</SelectItem>
                {all.filter((m) => m.id !== node.emp.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent></Card>
      {node.reports.length > 0 && <div className="mt-3 space-y-3">{node.reports.map((c) => <EmpTreeNode key={c.emp.id} node={c} level={level + 1} all={all} canEdit={canEdit} onSetManager={onSetManager} tt={tt} seen={nextSeen} />)}</div>}
    </div>
  );
}

function DeptTreeNode({ node, level, tt }: { node: DeptNode; level: number; tt: (az: string, en: string) => string }) {
  return (
    <div className={level > 0 ? 'ml-5 border-l border-border pl-5' : ''}>
      <Card className="rounded-card"><CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{tt(node.dept.name.az, node.dept.name.en)}</p>
            <p className="text-xs text-muted-foreground">{node.dept.code} · {node.employees.length} {tt('işçi', 'staff')}</p>
          </div>
        </div>
        {node.employees.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{node.employees.map((e) => <EmpChip key={e.id} e={e} />)}</div>}
      </CardContent></Card>
      {node.children.length > 0 && <div className="mt-3 space-y-3">{node.children.map((c) => <DeptTreeNode key={c.dept.id} node={c} level={level + 1} tt={tt} />)}</div>}
    </div>
  );
}

function EmpChip({ e }: { e: Employee }) {
  return (
    <span className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-sm">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-3.5 w-3.5" /></span>
      <span className="font-medium">{e.firstName} {e.lastName}</span>
      {e.position && <span className="text-xs text-muted-foreground">· {e.position}</span>}
    </span>
  );
}
