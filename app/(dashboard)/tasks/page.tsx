'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, List, LayoutGrid, BarChart3, Loader2, Trash2, CalendarDays, User, Flag,
  CheckCircle2, Circle, Timer, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listCompanyTasks, listTeamMembers, createTask, updateTask, setTaskStatus, deleteTask, type TeamMember,
} from '@/lib/firebase/tasks';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import type { TaskStatus, UserTask } from '@/types';

const PRIO: Record<UserTask['priority'], { label: string; dot: string; text: string }> = {
  high: { label: 'Yüksək', dot: 'bg-rose-500', text: 'text-rose-500' },
  medium: { label: 'Orta', dot: 'bg-amber-500', text: 'text-amber-500' },
  low: { label: 'Aşağı', dot: 'bg-emerald-500', text: 'text-emerald-500' },
};
const COLUMNS: { key: TaskStatus; label: string; icon: typeof Circle; tint: string }[] = [
  { key: 'todo', label: 'Görüləcək', icon: Circle, tint: 'text-muted-foreground' },
  { key: 'in_progress', label: 'İcrada', icon: Timer, tint: 'text-amber-500' },
  { key: 'done', label: 'Tamamlandı', icon: CheckCircle2, tint: 'text-emerald-500' },
];
const initials = (n?: string | null) => (n ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
const isOverdue = (t: UserTask) => t.status !== 'done' && !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);

export default function TasksPage() {
  const qc = useQueryClient();
  const { active, profile } = useAuth();
  const companyId = active?.companyId;
  const uid = profile?.uid ?? '';
  const [view, setView] = useState<'list' | 'board' | 'report'>('board');
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fPrio, setFPrio] = useState<string>('all');
  const [fAssignee, setFAssignee] = useState<string>('all');
  const [editing, setEditing] = useState<UserTask | 'new' | null>(null);

  const { data: tasks, isLoading } = useQuery({ queryKey: ['companyTasks', companyId], queryFn: () => listCompanyTasks(companyId!), enabled: !!companyId });
  const { data: members } = useQuery({ queryKey: ['teamMembers', companyId, (tasks ?? []).length], queryFn: () => listTeamMembers(companyId!, profile, tasks ?? []), enabled: !!companyId });
  const refresh = () => qc.invalidateQueries({ queryKey: ['companyTasks', companyId] });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (tasks ?? []).filter((t) =>
      (!s || t.title.toLowerCase().includes(s) || (t.description ?? '').toLowerCase().includes(s)) &&
      (fStatus === 'all' || t.status === fStatus) &&
      (fPrio === 'all' || t.priority === fPrio) &&
      (fAssignee === 'all' || (fAssignee === 'me' ? t.assignedToUid === uid : t.assignedToUid === fAssignee)));
  }, [tasks, q, fStatus, fPrio, fAssignee, uid]);

  async function move(id: string, status: TaskStatus) { try { await setTaskStatus(id, status); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }
  async function remove(id: string) { if (!window.confirm('Tapşırıq silinsin?')) return; try { await deleteTask(id); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }

  if (!companyId) return <div><PageHeader title="Tapşırıqlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="Tapşırıqlar" subtitle={`${active?.company.name} · Komanda tapşırıq idarəetməsi`}
        action={<Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Yeni tapşırıq</Button>} />

      {/* Alət paneli */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {([['board', LayoutGrid, 'Lövhə'], ['list', List, 'Siyahı'], ['report', BarChart3, 'Hesabat']] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Axtar…" className="pl-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Bütün status</SelectItem>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select>
        <Select value={fPrio} onValueChange={setFPrio}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Bütün prioritet</SelectItem>{(['high', 'medium', 'low'] as const).map((p) => <SelectItem key={p} value={p}>{PRIO[p].label}</SelectItem>)}</SelectContent></Select>
        <Select value={fAssignee} onValueChange={setFAssignee}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Hamı</SelectItem><SelectItem value="me">Mənə təyin</SelectItem>{(members ?? []).map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select>
        <ExportButton filename="tapsiriqlar" rows={filtered} columns={[
          { header: 'Başlıq', value: 'title' }, { header: 'Status', value: (t) => COLUMNS.find((c) => c.key === t.status)?.label ?? t.status },
          { header: 'Prioritet', value: (t) => PRIO[t.priority].label }, { header: 'Təyin', value: (t) => t.assigneeName ?? '' }, { header: 'Bitmə', value: 'dueDate' },
        ]} />
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : view === 'board' ? <BoardView tasks={filtered} onMove={move} onOpen={setEditing} onDelete={remove} />
        : view === 'list' ? <ListView tasks={filtered} onOpen={setEditing} onDelete={remove} onMove={move} />
        : <ReportView tasks={tasks ?? []} members={members ?? []} />}

      {editing && <TaskDrawer task={editing === 'new' ? null : editing} companyId={companyId} uid={uid} selfName={profile?.displayName ?? ''} members={members ?? []}
        onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

// ── Board (Kanban) ──
function BoardView({ tasks, onMove, onOpen, onDelete }: { tasks: UserTask[]; onMove: (id: string, s: TaskStatus) => void; onOpen: (t: UserTask) => void; onDelete: (id: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }} onDragLeave={() => setOver((o) => o === col.key ? null : o)}
            onDrop={() => { if (dragId) onMove(dragId, col.key); setDragId(null); setOver(null); }}
            className={cn('rounded-2xl border border-border bg-secondary/30 p-2.5 transition-colors', over === col.key && 'ring-2 ring-primary/40')}>
            <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
              <col.icon className={cn('h-4 w-4', col.tint)} />
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="ml-auto rounded-full bg-background px-2 text-xs font-medium text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                  onClick={() => onOpen(t)}
                  className={cn('group cursor-pointer rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:shadow-soft-lg', dragId === t.id && 'opacity-50')}>
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('h-2 w-2 shrink-0 translate-y-1.5 rounded-full', PRIO[t.priority].dot)} />
                    <span className={cn('min-w-0 flex-1 text-sm font-medium', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} className="text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {(t.labels ?? []).length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.labels!.map((l) => <span key={l} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{l}</span>)}</div>}
                  <div className="mt-2.5 flex items-center gap-2">
                    {t.dueDate && <span className={cn('flex items-center gap-1 text-[11px]', isOverdue(t) ? 'font-semibold text-danger' : 'text-muted-foreground')}><CalendarDays className="h-3 w-3" />{t.dueDate.slice(5)}</span>}
                    {t.assigneeName && <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-[10px] font-bold text-white" title={t.assigneeName}>{initials(t.assigneeName)}</span>}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Boş</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List ──
function ListView({ tasks, onOpen, onDelete, onMove }: { tasks: UserTask[]; onOpen: (t: UserTask) => void; onDelete: (id: string) => void; onMove: (id: string, s: TaskStatus) => void }) {
  if (tasks.length === 0) return <EmptyState title="Tapşırıq yoxdur" description="Filtri dəyişin və ya yeni tapşırıq əlavə edin." />;
  return (
    <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 text-left">Tapşırıq</th><th className="px-4 py-2.5 text-left">Təyin</th><th className="px-4 py-2.5 text-left">Prioritet</th><th className="px-4 py-2.5 text-left">Bitmə</th><th className="px-4 py-2.5 text-left">Status</th><th></th>
        </tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="group cursor-pointer border-b border-border/40 hover:bg-secondary/40" onClick={() => onOpen(t)}>
              <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className={cn('h-2 w-2 shrink-0 rounded-full', PRIO[t.priority].dot)} /><span className={cn('font-medium', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span></div></td>
              <td className="px-4 py-2.5 text-muted-foreground">{t.assigneeName ?? '—'}</td>
              <td className="px-4 py-2.5"><span className={PRIO[t.priority].text}>{PRIO[t.priority].label}</span></td>
              <td className={cn('px-4 py-2.5', isOverdue(t) ? 'font-semibold text-danger' : 'text-muted-foreground')}>{t.dueDate ?? '—'}</td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                <Select value={t.status} onValueChange={(v) => onMove(t.id, v as TaskStatus)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </td>
              <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}><button onClick={() => onDelete(t.id)} className="text-muted-foreground/60 hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardContent></Card>
  );
}

// ── Report ──
function ReportView({ tasks, members }: { tasks: UserTask[]; members: TeamMember[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProg = tasks.filter((t) => t.status === 'in_progress').length;
  const overdue = tasks.filter(isOverdue).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const byAssignee = members.map((m) => {
    const mine = tasks.filter((t) => t.assignedToUid === m.uid);
    return { name: m.name, total: mine.length, done: mine.filter((t) => t.status === 'done').length };
  }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);

  const tile = (label: string, value: number | string, tint: string, Icon: typeof CheckCircle2) => (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3"><span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
        <div><p className="text-2xl font-bold tnum">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tile('Ümumi', total, 'bg-violet-500/12 text-violet-600', BarChart3)}
        {tile('Tamamlanma', `${pct}%`, 'bg-emerald-500/12 text-emerald-600', CheckCircle2)}
        {tile('İcrada', inProg, 'bg-amber-500/12 text-amber-600', Timer)}
        {tile('Gecikmiş', overdue, 'bg-rose-500/12 text-rose-600', AlertTriangle)}
      </div>
      <Card className="rounded-card"><CardContent className="p-5">
        <h3 className="mb-3 text-sm font-bold">Üzv üzrə bölgü</h3>
        {byAssignee.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Məlumat yoxdur</p> : (
          <div className="space-y-3">
            {byAssignee.map((a) => {
              const p = a.total ? Math.round((a.done / a.total) * 100) : 0;
              return (
                <div key={a.name}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{a.name}</span><span className="text-muted-foreground">{a.done}/{a.total} · {p}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]" style={{ width: `${p}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

// ── Yaratma / redaktə drawer ──
function TaskDrawer({ task, companyId, uid, selfName, members, onClose, onSaved }: {
  task: UserTask | null; companyId: string; uid: string; selfName: string; members: TeamMember[];
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<UserTask['priority']>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [assignee, setAssignee] = useState(task?.assignedToUid ?? uid);
  const [labels, setLabels] = useState((task?.labels ?? []).join(', '));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error('Başlıq daxil edin'); return; }
    const member = members.find((m) => m.uid === assignee);
    const assigneeName = member?.name ?? (assignee === uid ? (selfName || 'Mən') : null);
    const labelArr = labels.split(',').map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      if (task) {
        await updateTask(task.id, { title: title.trim(), description: description || null, status, done: status === 'done', priority, dueDate: dueDate || null, labels: labelArr, assignedToUid: assignee, assigneeName });
      } else {
        await createTask({ companyId, title, description: description || null, status, priority, dueDate: dueDate || null, labels: labelArr, assignedToUid: assignee, assigneeName, createdBy: uid, createdByName: selfName || null });
      }
      toast.success(task ? 'Tapşırıq yeniləndi' : 'Tapşırıq yaradıldı');
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Drawer open onClose={onClose} title={task ? 'Tapşırığı redaktə et' : 'Yeni tapşırıq'}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Ləğv et</Button><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Yadda saxla</Button></div>}>
      <div className="space-y-4">
        <div className="space-y-2"><Label>Başlıq</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nə edilməlidir?" /></div>
        <div className="space-y-2"><Label>Təsvir</Label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Detallar…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Prioritet</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as UserTask['priority'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['high', 'medium', 'low'] as const).map((p) => <SelectItem key={p} value={p}><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', PRIO[p].dot)} /> {PRIO[p].label}</span></SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Təyin edilən</Label>
            <Select value={assignee} onValueChange={setAssignee}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{members.length === 0 ? <SelectItem value={uid}>{selfName || 'Mən'}</SelectItem> : members.map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Bitmə tarixi</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>Etiketlər (vergüllə)</Label><Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="məs. maliyyə, təcili" /></div>
      </div>
    </Drawer>
  );
}
