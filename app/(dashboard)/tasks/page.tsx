'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, List, LayoutGrid, BarChart3, Loader2, Trash2, CalendarDays, User, Flag,
  CheckCircle2, Circle, Timer, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
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

const PRIO: Record<UserTask['priority'], { label: string; en: string; dot: string; text: string }> = {
  high: { label: 'Yüksək', en: 'High', dot: 'bg-rose-500', text: 'text-rose-500' },
  medium: { label: 'Orta', en: 'Medium', dot: 'bg-amber-500', text: 'text-amber-500' },
  low: { label: 'Aşağı', en: 'Low', dot: 'bg-emerald-500', text: 'text-emerald-500' },
};
const COLUMNS: { key: TaskStatus; label: string; en: string; icon: typeof Circle; tint: string }[] = [
  { key: 'todo', label: 'Görüləcək', en: 'To do', icon: Circle, tint: 'text-muted-foreground' },
  { key: 'in_progress', label: 'İcrada', en: 'In progress', icon: Timer, tint: 'text-amber-500' },
  { key: 'done', label: 'Tamamlandı', en: 'Done', icon: CheckCircle2, tint: 'text-emerald-500' },
];
const initials = (n?: string | null) => (n ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
const isOverdue = (t: UserTask) => t.status !== 'done' && !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);

export default function TasksPage() {
  const qc = useQueryClient();
  const tt = useTT();
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

  async function move(id: string, status: TaskStatus) { try { await setTaskStatus(id, status); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } }
  async function remove(id: string) { if (!window.confirm(tt('Tapşırıq silinsin?', 'Delete task?'))) return; try { await deleteTask(id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } }

  if (!companyId) return <div><PageHeader title={tt('Tapşırıqlar', 'Tasks')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title={tt('Tapşırıqlar', 'Tasks')} subtitle={`${active?.company.name} · ${tt('Komanda tapşırıq idarəetməsi', 'Team task management')}`}
        action={<Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {tt('Yeni tapşırıq', 'New task')}</Button>} />

      {/* Alət paneli */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {([['board', LayoutGrid, tt('Lövhə', 'Board')], ['list', List, tt('Siyahı', 'List')], ['report', BarChart3, tt('Hesabat', 'Report')]] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tt('Axtar…', 'Search…')} className="pl-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{tt('Bütün status', 'All statuses')}</SelectItem>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{tt(c.label, c.en)}</SelectItem>)}</SelectContent></Select>
        <Select value={fPrio} onValueChange={setFPrio}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{tt('Bütün prioritet', 'All priorities')}</SelectItem>{(['high', 'medium', 'low'] as const).map((p) => <SelectItem key={p} value={p}>{tt(PRIO[p].label, PRIO[p].en)}</SelectItem>)}</SelectContent></Select>
        <Select value={fAssignee} onValueChange={setFAssignee}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{tt('Hamı', 'Everyone')}</SelectItem><SelectItem value="me">{tt('Mənə təyin', 'Assigned to me')}</SelectItem>{(members ?? []).map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select>
        <ExportButton filename="tapsiriqlar" rows={filtered} columns={[
          { header: tt('Başlıq', 'Title'), value: 'title' }, { header: 'Status', value: (t) => tt(COLUMNS.find((c) => c.key === t.status)?.label ?? t.status, COLUMNS.find((c) => c.key === t.status)?.en ?? t.status) },
          { header: tt('Prioritet', 'Priority'), value: (t) => tt(PRIO[t.priority].label, PRIO[t.priority].en) }, { header: tt('Təyin', 'Assignee'), value: (t) => t.assigneeName ?? '' }, { header: tt('Bitmə', 'Due'), value: 'dueDate' },
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
  const tt = useTT();
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
              <span className="text-sm font-semibold">{tt(col.label, col.en)}</span>
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
              {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{tt('Boş', 'Empty')}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List ──
function ListView({ tasks, onOpen, onDelete, onMove }: { tasks: UserTask[]; onOpen: (t: UserTask) => void; onDelete: (id: string) => void; onMove: (id: string, s: TaskStatus) => void }) {
  const tt = useTT();
  if (tasks.length === 0) return <EmptyState title={tt('Tapşırıq yoxdur', 'No tasks')} description={tt('Filtri dəyişin və ya yeni tapşırıq əlavə edin.', 'Change the filter or add a new task.')} />;
  return (
    <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 text-left">{tt('Tapşırıq', 'Task')}</th><th className="px-4 py-2.5 text-left">{tt('Təyin', 'Assignee')}</th><th className="px-4 py-2.5 text-left">{tt('Prioritet', 'Priority')}</th><th className="px-4 py-2.5 text-left">{tt('Bitmə', 'Due')}</th><th className="px-4 py-2.5 text-left">Status</th><th></th>
        </tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="group cursor-pointer border-b border-border/40 hover:bg-secondary/40" onClick={() => onOpen(t)}>
              <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className={cn('h-2 w-2 shrink-0 rounded-full', PRIO[t.priority].dot)} /><span className={cn('font-medium', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span></div></td>
              <td className="px-4 py-2.5 text-muted-foreground">{t.assigneeName ?? '—'}</td>
              <td className="px-4 py-2.5"><span className={PRIO[t.priority].text}>{tt(PRIO[t.priority].label, PRIO[t.priority].en)}</span></td>
              <td className={cn('px-4 py-2.5', isOverdue(t) ? 'font-semibold text-danger' : 'text-muted-foreground')}>{t.dueDate ?? '—'}</td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                <Select value={t.status} onValueChange={(v) => onMove(t.id, v as TaskStatus)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{tt(c.label, c.en)}</SelectItem>)}</SelectContent>
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
  const tt = useTT();
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
        {tile(tt('Ümumi', 'Total'), total, 'bg-violet-500/12 text-violet-600', BarChart3)}
        {tile(tt('Tamamlanma', 'Completion'), `${pct}%`, 'bg-emerald-500/12 text-emerald-600', CheckCircle2)}
        {tile(tt('İcrada', 'In progress'), inProg, 'bg-amber-500/12 text-amber-600', Timer)}
        {tile(tt('Gecikmiş', 'Overdue'), overdue, 'bg-rose-500/12 text-rose-600', AlertTriangle)}
      </div>
      <Card className="rounded-card"><CardContent className="p-5">
        <h3 className="mb-3 text-sm font-bold">{tt('Üzv üzrə bölgü', 'By member')}</h3>
        {byAssignee.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{tt('Məlumat yoxdur', 'No data')}</p> : (
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
  const tt = useTT();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<UserTask['priority']>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [assignee, setAssignee] = useState(task?.assignedToUid ?? uid);
  const [labels, setLabels] = useState((task?.labels ?? []).join(', '));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error(tt('Başlıq daxil edin', 'Enter a title')); return; }
    const member = members.find((m) => m.uid === assignee);
    const assigneeName = member?.name ?? (assignee === uid ? (selfName || tt('Mən', 'Me')) : null);
    const labelArr = labels.split(',').map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      if (task) {
        await updateTask(task.id, { title: title.trim(), description: description || null, status, done: status === 'done', priority, dueDate: dueDate || null, labels: labelArr, assignedToUid: assignee, assigneeName });
      } else {
        await createTask({ companyId, title, description: description || null, status, priority, dueDate: dueDate || null, labels: labelArr, assignedToUid: assignee, assigneeName, createdBy: uid, createdByName: selfName || null });
      }
      toast.success(task ? tt('Tapşırıq yeniləndi', 'Task updated') : tt('Tapşırıq yaradıldı', 'Task created'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Drawer open onClose={onClose} title={task ? tt('Tapşırığı redaktə et', 'Edit task') : tt('Yeni tapşırıq', 'New task')}
      footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>{tt('Ləğv et', 'Cancel')}</Button><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></div>}>
      <div className="space-y-4">
        <div className="space-y-2"><Label>{tt('Başlıq', 'Title')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tt('Nə edilməlidir?', 'What needs to be done?')} /></div>
        <div className="space-y-2"><Label>{tt('Təsvir', 'Description')}</Label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={tt('Detallar…', 'Details…')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{tt(c.label, c.en)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{tt('Prioritet', 'Priority')}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as UserTask['priority'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['high', 'medium', 'low'] as const).map((p) => <SelectItem key={p} value={p}><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', PRIO[p].dot)} /> {tt(PRIO[p].label, PRIO[p].en)}</span></SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {tt('Təyin edilən', 'Assignee')}</Label>
            <Select value={assignee} onValueChange={setAssignee}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{members.length === 0 ? <SelectItem value={uid}>{selfName || tt('Mən', 'Me')}</SelectItem> : members.map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {tt('Bitmə tarixi', 'Due date')}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>{tt('Etiketlər (vergüllə)', 'Labels (comma-separated)')}</Label><Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder={tt('məs. maliyyə, təcili', 'e.g. finance, urgent')} /></div>
      </div>
    </Drawer>
  );
}
