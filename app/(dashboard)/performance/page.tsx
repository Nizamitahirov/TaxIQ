'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Gauge, Star } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listPerformanceReviews, createPerformanceReview, setPerformanceStatus, deletePerformanceReview, weightedScore } from '@/lib/firebase/performance';
import { listEmployees } from '@/lib/firebase/hr';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { PerformanceStatus, PerformanceCriterion, PerformanceReview } from '@/types';

const STATUS: Record<PerformanceStatus, [string, string]> = { draft: ['Layihə', 'Draft'], submitted: ['Təqdim edilib', 'Submitted'], acknowledged: ['Təsdiqlənib', 'Acknowledged'] };
const DEFAULT_CRITERIA: PerformanceCriterion[] = [
  { title: 'İş keyfiyyəti', weight: 30, score: 3 },
  { title: 'Məhsuldarlıq', weight: 30, score: 3 },
  { title: 'Komanda işi', weight: 20, score: 3 },
  { title: 'Təşəbbüskarlıq', weight: 20, score: 3 },
];

function scoreColor(s: number): string { return s >= 4 ? 'text-emerald-600' : s >= 3 ? 'text-amber-600' : 'text-rose-600'; }

export default function PerformancePage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const canEdit = canView;
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['performanceReviews', companyId], queryFn: () => listPerformanceReviews(companyId!), enabled: canView && !!companyId });
  const refresh = () => qc.invalidateQueries({ queryKey: ['performanceReviews', companyId] });

  if (!companyId) return <div><PageHeader title={tt('Performans', 'Performance')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Performans', 'Performance')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Performans qiymətləndirmə', 'Performance reviews')} subtitle={tt('İşçilərin çəkili meyarlar üzrə qiymətləndirilməsi', 'Weighted-criteria employee evaluations')}
        action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni qiymətləndirmə', 'New review')}</Button>} />

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Qiymətləndirmə yoxdur', 'No reviews')} action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni qiymətləndirmə', 'New review')}</Button>} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Dövr', 'Period')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Qiymətləndirən', 'Reviewer')}</TableHead><TableHead className="text-right">{tt('Ümumi bal', 'Overall')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>{data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employeeName}</TableCell>
                <TableCell className="text-muted-foreground">{r.period}</TableCell>
                <TableCell className="text-muted-foreground">{r.reviewDate}</TableCell>
                <TableCell className="text-muted-foreground">{r.reviewerName ?? '—'}</TableCell>
                <TableCell className="text-right"><span className={`flex items-center justify-end gap-0.5 font-bold ${scoreColor(r.overallScore)}`}>{r.overallScore.toFixed(2)}<Star className="h-3.5 w-3.5 fill-current" /></span></TableCell>
                <TableCell>{canEdit ? (
                  <Select value={r.status} onValueChange={(s) => setPerformanceStatus(r, s as PerformanceStatus, profile?.uid ?? '').then(refresh)}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(STATUS) as PerformanceStatus[]).map((s) => <SelectItem key={s} value={s}>{tt(STATUS[s][0], STATUS[s][1])}</SelectItem>)}</SelectContent></Select>
                ) : <Badge variant="secondary">{tt(STATUS[r.status][0], STATUS[r.status][1])}</Badge>}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deletePerformanceReview(r, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}

      {open && <ReviewDialog companyId={companyId} actorUid={profile?.uid ?? ''} reviewerName={profile?.displayName ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function ReviewDialog({ companyId, actorUid, reviewerName, onClose, onSaved }: { companyId: string; actorUid: string; reviewerName: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [criteria, setCriteria] = useState<PerformanceCriterion[]>(DEFAULT_CRITERIA.map((c) => ({ ...c })));
  const [strengths, setStrengths] = useState(''); const [improvements, setImprovements] = useState('');
  const [saving, setSaving] = useState(false);
  const setCrit = (i: number, p: Partial<PerformanceCriterion>) => setCriteria((cs) => cs.map((c, j) => j === i ? { ...c, ...p } : c));
  const overall = weightedScore(criteria);
  const totalW = criteria.reduce((s, c) => s + (c.weight || 0), 0);

  async function save() {
    const emp = (employees ?? []).find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    setSaving(true);
    try {
      await createPerformanceReview({
        companyId, employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`, period: period.trim(), reviewDate,
        reviewerId: actorUid, reviewerName: reviewerName || null, criteria: criteria.filter((c) => c.title.trim()),
        strengths: strengths.trim() || null, improvements: improvements.trim() || null, status: 'draft', createdBy: actorUid,
      });
      toast.success(tt('Qiymətləndirmə yaradıldı', 'Review created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle>{tt('Yeni performans qiymətləndirməsi', 'New performance review')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-1"><Label>{tt('İşçi *', 'Employee *')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Dövr', 'Period')}</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026 / 2026-H1" /></div>
          <div className="space-y-1"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></div>
        </div>
        <div>
          <Label>{tt('Meyarlar (çəki % · bal 1–5)', 'Criteria (weight % · score 1–5)')}</Label>
          <div className="mt-1 space-y-2">
            {criteria.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_70px_auto] gap-2">
                <Input value={c.title} onChange={(e) => setCrit(i, { title: e.target.value })} />
                <Input type="number" value={c.weight} onChange={(e) => setCrit(i, { weight: Number(e.target.value) })} />
                <Input type="number" min={1} max={5} value={c.score} onChange={(e) => setCrit(i, { score: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600" onClick={() => setCriteria((cs) => cs.length > 1 ? cs.filter((_, j) => j !== i) : cs)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setCriteria((cs) => [...cs, { title: '', weight: 0, score: 3 }])}><Plus className="h-3.5 w-3.5" /> {tt('Meyar', 'Criterion')}</Button>
            <span className="text-sm">{tt('Çəki cəmi', 'Total weight')}: <b className={totalW === 100 ? 'text-emerald-600' : 'text-amber-600'}>{totalW}%</b> · {tt('Ümumi bal', 'Overall')}: <b className={scoreColor(overall)}>{overall.toFixed(2)}</b></span>
          </div>
        </div>
        <div className="space-y-1"><Label>{tt('Güclü tərəflər', 'Strengths')}</Label><Input value={strengths} onChange={(e) => setStrengths(e.target.value)} /></div>
        <div className="space-y-1"><Label>{tt('İnkişaf sahələri', 'Areas to improve')}</Label><Input value={improvements} onChange={(e) => setImprovements(e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
