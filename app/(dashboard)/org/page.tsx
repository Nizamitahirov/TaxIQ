'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Building2, User, Users2, Network, GitBranch } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listDepartments } from '@/lib/firebase/departments';
import { listEmployees } from '@/lib/firebase/hr';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import type { Department, Employee } from '@/types';

interface Node { dept: Department; children: Node[]; employees: Employee[] }
interface EmpNode { emp: Employee; reports: EmpNode[] }

export default function OrgPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const [view, setView] = useState<'department' | 'reporting'>('department');

  const { data: departments, isLoading: dl } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId!), enabled: canView && !!companyId });
  const { data: employees, isLoading: el } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId!), enabled: canView && !!companyId });

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

  const { roots, unassigned, totalEmp } = useMemo(() => {
    const depts = (departments ?? []).filter((d) => d.isActive !== false);
    const emps = (employees ?? []).filter((e) => e.status === 'active');
    const empByDept = new Map<string, Employee[]>();
    for (const e of emps) { const k = e.departmentId ?? '__none'; if (!empByDept.has(k)) empByDept.set(k, []); empByDept.get(k)!.push(e); }
    const nodeById = new Map<string, Node>();
    for (const d of depts) nodeById.set(d.id, { dept: d, children: [], employees: empByDept.get(d.id) ?? [] });
    const roots: Node[] = [];
    for (const d of depts) {
      const node = nodeById.get(d.id)!;
      if (d.parentDepartmentId && nodeById.has(d.parentDepartmentId)) nodeById.get(d.parentDepartmentId)!.children.push(node);
      else roots.push(node);
    }
    return { roots, unassigned: empByDept.get('__none') ?? [], totalEmp: emps.length };
  }, [departments, employees]);

  if (!companyId) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;
  if (dl || el) return <div><PageHeader title={tt('Təşkilati struktur', 'Org structure')} /><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></div>;

  const tabBtn = (v: typeof view, icon: React.ReactNode, label: string) => (
    <button onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{icon}{label}</button>
  );

  return (
    <div>
      <PageHeader title={tt('Təşkilati struktur', 'Org structure')} subtitle={tt(`${departments?.length ?? 0} şöbə · ${totalEmp} aktiv işçi`, `${departments?.length ?? 0} departments · ${totalEmp} active employees`)}
        action={<div className="flex gap-2">{tabBtn('department', <Building2 className="h-4 w-4" />, tt('Şöbə üzrə', 'By department'))}{tabBtn('reporting', <GitBranch className="h-4 w-4" />, tt('Hesabat xətti', 'Reporting line'))}</div>} />
      {view === 'department' ? (
        roots.length === 0 && unassigned.length === 0 ? (
          <EmptyState title={tt('Struktur boşdur', 'Structure is empty')} description={tt('Şirkət → Şöbələr və HR → İşçilər bölmələrindən əlavə edin', 'Add via Company → Departments and HR → Employees')} />
        ) : (
          <div className="space-y-4">
            {roots.map((n) => <TreeNode key={n.dept.id} node={n} level={0} tt={tt} />)}
            {unassigned.length > 0 && (
              <Card className="rounded-card border-dashed"><CardContent className="p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Users2 className="h-4 w-4" /> {tt('Şöbəsiz işçilər', 'Unassigned employees')} ({unassigned.length})</p>
                <div className="flex flex-wrap gap-2">{unassigned.map((e) => <EmpChip key={e.id} e={e} />)}</div>
              </CardContent></Card>
            )}
          </div>
        )
      ) : (
        reporting.length === 0 ? (
          <EmptyState title={tt('Hesabat xətti yoxdur', 'No reporting line')} description={tt('HR → İşçilər-də «Birbaşa rəhbər» təyin edin', 'Set "Reports to" on employees in HR → Employees')} />
        ) : (
          <div className="space-y-3">{reporting.map((n) => <EmpTreeNode key={n.emp.id} node={n} level={0} />)}</div>
        )
      )}
    </div>
  );
}

function EmpTreeNode({ node, level }: { node: EmpNode; level: number }) {
  return (
    <div className={level > 0 ? 'ml-5 border-l border-border pl-5' : ''}>
      <Card className="rounded-card"><CardContent className="flex items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{node.emp.firstName} {node.emp.lastName}</p>
          <p className="text-xs text-muted-foreground">{node.emp.position ?? '—'}{node.reports.length > 0 ? ` · ${node.reports.length} tabe` : ''}</p>
        </div>
      </CardContent></Card>
      {node.reports.length > 0 && <div className="mt-3 space-y-3">{node.reports.map((c) => <EmpTreeNode key={c.emp.id} node={c} level={level + 1} />)}</div>}
    </div>
  );
}

function TreeNode({ node, level, tt }: { node: Node; level: number; tt: (az: string, en: string) => string }) {
  return (
    <div className={level > 0 ? 'ml-5 border-l border-border pl-5' : ''}>
      <Card className="rounded-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tt(node.dept.name.az, node.dept.name.en)}</p>
              <p className="text-xs text-muted-foreground">{node.dept.code} · {node.dept.type === 'project' ? tt('Layihə', 'Project') : node.dept.type === 'cost_center' ? tt('Xərc mərkəzi', 'Cost center') : tt('Şöbə', 'Department')} · {node.employees.length} {tt('işçi', 'staff')}</p>
            </div>
          </div>
          {node.employees.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{node.employees.map((e) => <EmpChip key={e.id} e={e} />)}</div>}
        </CardContent>
      </Card>
      {node.children.length > 0 && <div className="mt-3 space-y-3">{node.children.map((c) => <TreeNode key={c.dept.id} node={c} level={level + 1} tt={tt} />)}</div>}
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
