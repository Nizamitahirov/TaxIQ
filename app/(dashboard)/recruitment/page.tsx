'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Briefcase, Users2, Star } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listVacancies, createVacancy, setVacancyStatus, deleteVacancy, listCandidates, createCandidate, setCandidateStage, deleteCandidate } from '@/lib/firebase/recruitment';
import { listDepartments } from '@/lib/firebase/departments';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { VacancyStatus, CandidateStage, Vacancy, Candidate } from '@/types';

const VAC_STATUS: Record<VacancyStatus, [string, string]> = { open: ['Açıq', 'Open'], on_hold: ['Gözləmədə', 'On hold'], closed: ['Bağlı', 'Closed'], filled: ['Dolduruldu', 'Filled'] };
const STAGES: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const STAGE_LABEL: Record<CandidateStage, [string, string]> = { applied: ['Müraciət', 'Applied'], screening: ['İlkin baxış', 'Screening'], interview: ['Müsahibə', 'Interview'], offer: ['Təklif', 'Offer'], hired: ['İşə götürüldü', 'Hired'], rejected: ['İmtina', 'Rejected'] };

export default function RecruitmentPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');

  if (!companyId) return <div><PageHeader title={tt('İşə qəbul', 'Recruitment')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('İşə qəbul', 'Recruitment')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('İşə qəbul', 'Recruitment')} subtitle={tt('Vakansiyalar və namizəd axını', 'Vacancies and candidate pipeline')} />
      <Tabs defaultValue="vacancies">
        <TabsList>
          <TabsTrigger value="vacancies"><Briefcase className="mr-1.5 h-4 w-4" /> {tt('Vakansiyalar', 'Vacancies')}</TabsTrigger>
          <TabsTrigger value="candidates"><Users2 className="mr-1.5 h-4 w-4" /> {tt('Namizədlər', 'Candidates')}</TabsTrigger>
        </TabsList>
        <TabsContent value="vacancies"><VacanciesTab companyId={companyId} /></TabsContent>
        <TabsContent value="candidates"><CandidatesTab companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function VacanciesTab({ companyId }: { companyId: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can('hr.employee.view');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['vacancies', companyId], queryFn: () => listVacancies(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['vacancies', companyId] });

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni vakansiya', 'New vacancy')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Vakansiya yoxdur', 'No vacancies')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Vəzifə', 'Title')}</TableHead><TableHead>{tt('Şöbə', 'Department')}</TableHead><TableHead className="text-right">{tt('Say', 'Headcount')}</TableHead><TableHead>{tt('Açılıb', 'Opened')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>{data.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.title}</TableCell>
                <TableCell className="text-muted-foreground">{v.departmentName ?? '—'}</TableCell>
                <TableCell className="text-right tnum">{v.headcount}</TableCell>
                <TableCell className="text-muted-foreground">{v.openedDate}</TableCell>
                <TableCell>{canEdit ? (
                  <Select value={v.status} onValueChange={(s) => setVacancyStatus(v, s as VacancyStatus, profile?.uid ?? '').then(refresh)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(VAC_STATUS) as VacancyStatus[]).map((s) => <SelectItem key={s} value={s}>{tt(VAC_STATUS[s][0], VAC_STATUS[s][1])}</SelectItem>)}</SelectContent></Select>
                ) : <Badge variant="secondary">{tt(VAC_STATUS[v.status][0], VAC_STATUS[v.status][1])}</Badge>}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteVacancy(v, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <VacancyDialog companyId={companyId} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function VacancyDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId) });
  const [f, setF] = useState({ title: '', departmentId: '', headcount: '1', employmentType: '', location: '', salaryRange: '', description: '', openedDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  async function save() {
    if (!f.title.trim()) { toast.error(tt('Vəzifə adı lazımdır', 'Title required')); return; }
    setSaving(true);
    try {
      const dep = (departments ?? []).find((d) => d.id === f.departmentId);
      await createVacancy({
        companyId, title: f.title.trim(), departmentId: f.departmentId || null, departmentName: dep ? dep.name.az : null,
        headcount: Number(f.headcount) || 1, employmentType: f.employmentType || null, location: f.location || null,
        salaryRange: f.salaryRange || null, description: f.description || null, status: 'open', openedDate: f.openedDate, createdBy: actorUid,
      });
      toast.success(tt('Vakansiya yaradıldı', 'Vacancy created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{tt('Yeni vakansiya', 'New vacancy')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Vəzifə *', 'Title *')}</Label><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Şöbə', 'Department')}</Label>
          <Select value={f.departmentId} onValueChange={(v) => set({ departmentId: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('İşçi sayı', 'Headcount')}</Label><Input type="number" value={f.headcount} onChange={(e) => set({ headcount: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('İş tipi', 'Employment type')}</Label><Input value={f.employmentType} onChange={(e) => set({ employmentType: e.target.value })} placeholder={tt('tam ştat…', 'full-time…')} /></div>
        <div className="space-y-1"><Label>{tt('Yer', 'Location')}</Label><Input value={f.location} onChange={(e) => set({ location: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Maaş aralığı', 'Salary range')}</Label><Input value={f.salaryRange} onChange={(e) => set({ salaryRange: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Açılma tarixi', 'Opened date')}</Label><Input type="date" value={f.openedDate} onChange={(e) => set({ openedDate: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Təsvir', 'Description')}</Label><Input value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function CandidatesTab({ companyId }: { companyId: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can('hr.employee.view');
  const [open, setOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | CandidateStage>('all');
  const { data, isLoading } = useQuery({ queryKey: ['candidates', companyId], queryFn: () => listCandidates(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['candidates', companyId] });
  const rows = useMemo(() => (data ?? []).filter((c) => stageFilter === 'all' || c.stage === stageFilter), [data, stageFilter]);

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStageFilter('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${stageFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{tt('Hamısı', 'All')}</button>
          {STAGES.map((s) => <button key={s} onClick={() => setStageFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${stageFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{tt(STAGE_LABEL[s][0], STAGE_LABEL[s][1])}</button>)}
        </div>
        {canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni namizəd', 'New candidate')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Namizəd yoxdur', 'No candidates')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Ad Soyad', 'Full name')}</TableHead><TableHead>{tt('Vakansiya', 'Vacancy')}</TableHead><TableHead>{tt('Əlaqə', 'Contact')}</TableHead><TableHead>{tt('Reytinq', 'Rating')}</TableHead><TableHead>{tt('Mərhələ', 'Stage')}</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>{rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{c.vacancyTitle ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.email ?? ''}{c.phone ? ` · ${c.phone}` : ''}</TableCell>
                <TableCell>{c.rating ? <span className="flex items-center gap-0.5 text-amber-500">{c.rating}<Star className="h-3.5 w-3.5 fill-current" /></span> : '—'}</TableCell>
                <TableCell>{canEdit ? (
                  <Select value={c.stage} onValueChange={(s) => setCandidateStage(c, s as CandidateStage, profile?.uid ?? '').then(refresh)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{tt(STAGE_LABEL[s][0], STAGE_LABEL[s][1])}</SelectItem>)}</SelectContent></Select>
                ) : <Badge variant="secondary">{tt(STAGE_LABEL[c.stage][0], STAGE_LABEL[c.stage][1])}</Badge>}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteCandidate(c, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <CandidateDialog companyId={companyId} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function CandidateDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: vacancies } = useQuery({ queryKey: ['vacancies', companyId], queryFn: () => listVacancies(companyId) });
  const [f, setF] = useState({ fullName: '', vacancyId: '', email: '', phone: '', source: '', rating: '', appliedDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  async function save() {
    if (!f.fullName.trim()) { toast.error(tt('Ad Soyad lazımdır', 'Full name required')); return; }
    setSaving(true);
    try {
      const vac = (vacancies ?? []).find((v) => v.id === f.vacancyId);
      await createCandidate({
        companyId, fullName: f.fullName.trim(), vacancyId: f.vacancyId || null, vacancyTitle: vac?.title ?? null,
        email: f.email || null, phone: f.phone || null, source: f.source || null, stage: 'applied',
        rating: f.rating ? Number(f.rating) : null, appliedDate: f.appliedDate, resumeUrl: null, notes: null, createdBy: actorUid,
      });
      toast.success(tt('Namizəd əlavə edildi', 'Candidate added'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Yeni namizəd', 'New candidate')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Ad Soyad *', 'Full name *')}</Label><Input value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Vakansiya', 'Vacancy')}</Label>
          <Select value={f.vacancyId} onValueChange={(v) => set({ vacancyId: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{(vacancies ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('E-poçt', 'Email')}</Label><Input value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Telefon', 'Phone')}</Label><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Mənbə', 'Source')}</Label><Input value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder={tt('LinkedIn, tövsiyə…', 'LinkedIn, referral…')} /></div>
        <div className="space-y-1"><Label>{tt('Reytinq (1–5)', 'Rating (1–5)')}</Label><Input type="number" min={1} max={5} value={f.rating} onChange={(e) => set({ rating: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
