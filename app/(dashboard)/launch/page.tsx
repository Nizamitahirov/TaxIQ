'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, Plus, Loader2, Check, Trash2, Camera, ListChecks, Sparkles, CalendarDays, ImagePlus,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { AREAS, itemsForArea } from '@/lib/areas';
import { usePermittedNavItems } from '@/components/layout/use-nav';
import { listMyTasks, createTask, toggleTask, deleteTask, completionPercent } from '@/lib/firebase/tasks';
import { useAvatarUpload, useCoverUpload } from '@/components/shared/use-avatar-upload';
import { SetupChecklist } from '@/components/shell/setup-checklist';
import type { UserTask } from '@/types';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

const PRIO: Record<UserTask['priority'], { label: string; dot: string }> = {
  high: { label: 'Yüksək', dot: 'bg-rose-500' },
  medium: { label: 'Orta', dot: 'bg-amber-500' },
  low: { label: 'Aşağı', dot: 'bg-emerald-500' },
};

export default function LaunchPage() {
  const { profile, active, isSuperAdmin } = useAuth();
  const firstName = (profile?.displayName ?? 'İstifadəçi').split(' ')[0];
  const now = new Date();
  const greet = now.getHours() < 12 ? 'Sabahınız xeyir' : now.getHours() < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';
  const companyId = active?.companyId;

  const permittedHrefs = new Set(usePermittedNavItems().map((i) => i.href));
  const areas = useMemo(() => AREAS.map((a) => {
    const items = itemsForArea(a.key).filter((i) => permittedHrefs.has(i.href));
    return { ...a, items, landing: items[0]?.href ?? a.landing };
  }).filter((a) => a.items.length > 0), [permittedHrefs]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: tasks } = useQuery({ queryKey: ['myTasks', companyId, profile?.uid], queryFn: () => listMyTasks(companyId!, profile!.uid), enabled: !!companyId && !!profile?.uid });
  const pct = completionPercent(tasks ?? []);
  const openCount = (tasks ?? []).filter((t) => !t.done).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Başlıq */}
      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" /> TaxIQ · İş sahələri
      </div>

      <SetupChecklist />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* SOL — bölmə blokları */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{greet}, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bir iş sahəsi seçin — yalnız ona aid modullar və menyu göstəriləcək.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {areas.map((a) => (
              <Link key={a.key} href={a.landing}
                className="group relative overflow-hidden rounded-3xl p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1"
                style={{ boxShadow: `0 20px 45px -20px ${a.glow}` }}>
                <div className={cn('absolute inset-0 bg-gradient-to-br', a.gradient)} />
                <div aria-hidden className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
                      <a.icon className="h-6 w-6" />
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-bold leading-tight">{a.label}</p>
                  <p className="mt-1 text-sm text-white/80">{a.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {a.items.slice(0, 4).map((it) => (
                      <span key={it.href} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90">{it.labelKey === 'sectorTemplates' ? 'Şablonlar' : LABELS[it.labelKey] ?? it.labelKey}</span>
                    ))}
                    {a.items.length > 4 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90">+{a.items.length - 4}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* SAĞ — profil ring + tapşırıqlar */}
        <aside className="flex min-h-0 flex-col gap-5">
          <ProfileRing name={firstName} roleName={isSuperAdmin ? 'Platform Super Admin' : (active?.roleName ?? 'İstifadəçi')} avatarUrl={profile?.avatarUrl ?? undefined} coverUrl={profile?.coverUrl ?? undefined} percent={pct} openCount={openCount} total={(tasks ?? []).length} />
          <TaskPanel companyId={companyId} uid={profile?.uid} tasks={tasks} />
        </aside>
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard', companies: 'Şirkətlər', clients: 'Müştərilər', users: 'İstifadəçilər', roles: 'Rollar',
  audit: 'Audit', warehouse: 'Anbar', sales: 'Satış', cashbank: 'Kassa/Bank', accounting: 'Mühasibat', ifrs: 'IFRS',
  hr: 'Kadrlar', payroll: 'Əmək haqqı', workflow: 'Workflow', reports: 'Hesabatlar', settings: 'Parametrlər', hse: 'SƏTƏM', tasks: 'Tapşırıqlar',
};

// Default abstract "avatract" mesh gradient (üzlük şəkli yoxdursa)
const DEFAULT_COVER = {
  backgroundColor: '#4f46e5',
  backgroundImage:
    'radial-gradient(at 18% 22%, #818cf8 0px, transparent 55%),' +
    'radial-gradient(at 82% 8%, #a78bfa 0px, transparent 50%),' +
    'radial-gradient(at 92% 82%, #22d3ee 0px, transparent 45%),' +
    'radial-gradient(at 8% 92%, #fb7185 0px, transparent 45%),' +
    'linear-gradient(135deg, #4f46e5, #7c3aed)',
} as const;

// ── Profil + üzlük + tamamlanma ring-i ──
function ProfileRing({ name, roleName, avatarUrl, coverUrl, percent, openCount, total }: {
  name: string; roleName: string; avatarUrl?: string; coverUrl?: string; percent: number; openCount: number; total: number;
}) {
  const avatar = useAvatarUpload();
  const cover = useCoverUpload();
  const R = 52, C = 2 * Math.PI * R;
  const dash = (percent / 100) * C;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <input ref={avatar.inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { avatar.onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cover.inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { cover.onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {/* Üzlük (cover) */}
      <div className="relative h-28">
        {coverUrl
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={coverUrl} alt="Üzlük" className="h-full w-full object-cover" />
          : <div className="h-full w-full" style={DEFAULT_COVER} />}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent" />
        <button type="button" onClick={cover.openPicker} disabled={cover.uploading} title="Üzlük şəklini dəyişdir"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50">
          {cover.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
      </div>

      {/* Gövdə */}
      <div className="px-6 pb-6 text-center">
        <div className="relative mx-auto -mt-16 h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-card" />
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-32 w-32 -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-secondary" />
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" strokeLinecap="round" stroke="url(#ringGrad)" strokeDasharray={`${dash} ${C - dash}`} className="transition-[stroke-dasharray] duration-700" />
            <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
          </svg>
          <button type="button" onClick={avatar.openPicker} disabled={avatar.uploading} title="Profil şəklini dəyişdir"
            className="group absolute inset-[14px] overflow-hidden rounded-full outline-none ring-2 ring-card focus-visible:ring-primary">
            {avatarUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              {avatar.uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
            </span>
          </button>
          <span className="absolute bottom-1 right-1 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] px-2 py-0.5 text-[11px] font-bold text-white shadow-lg ring-2 ring-card">{percent}%</span>
        </div>
        <p className="mt-3 text-lg font-bold">{name}</p>
        <p className="text-xs text-muted-foreground">{roleName}</p>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5 text-primary" />
          {total === 0 ? 'Tapşırıq yoxdur' : `${total - openCount}/${total} tamamlandı · ${openCount} açıq`}
        </div>
      </div>
    </div>
  );
}

// ── Kiçik task management ──
function TaskPanel({ companyId, uid, tasks }: { companyId?: string; uid?: string; tasks?: UserTask[] }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<UserTask['priority']>('medium');
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['myTasks', companyId, uid] });

  async function add() {
    if (!companyId || !uid || !title.trim()) return;
    setBusy(true);
    try { await createTask({ companyId, title, priority, assignedToUid: uid, createdBy: uid }); setTitle(''); setPriority('medium'); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function toggle(t: UserTask) { try { await toggleTask(t); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }
  async function remove(id: string) { try { await deleteTask(id); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }

  const sorted = [...(tasks ?? [])].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="flex min-h-[320px] flex-1 flex-col rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-primary" /> Tapşırıqlarım</h2>
        <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ətraflı <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
      {!companyId ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Tapşırıqlar üçün aktiv şirkət seçin.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Yeni tapşırıq…" className="h-9" />
            <div className="flex gap-2">
              <Select value={priority} onValueChange={(v) => setPriority(v as UserTask['priority'])}>
                <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{(['high', 'medium', 'low'] as const).map((p) => <SelectItem key={p} value={p}><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', PRIO[p].dot)} /> {PRIO[p].label}</span></SelectItem>)}</SelectContent>
              </Select>
              <button onClick={add} disabled={busy || !title.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
            {sorted.length === 0 ? <li className="py-6 text-center text-xs text-muted-foreground">Hələ tapşırıq yoxdur — yuxarıdan əlavə edin.</li> : sorted.map((t) => (
              <li key={t.id} className="group flex items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-secondary/40">
                <button onClick={() => toggle(t)} className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors', t.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary')}>
                  {t.done && <Check className="h-3 w-3" />}
                </button>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIO[t.priority].dot)} />
                <span className={cn('min-w-0 flex-1 truncate text-sm', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
                {t.dueDate && <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{t.dueDate.slice(5)}</span>}
                <button onClick={() => remove(t.id)} className="shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <Link href="/tasks" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            Bütün tapşırıqlar (Lövhə · Siyahı · Hesabat) <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
