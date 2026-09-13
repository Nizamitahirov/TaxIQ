'use client';

import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listDocs } from '@/lib/firebase/firestore';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils/format';
import type { AuditLog } from '@/types';

export default function AuditPage() {
  const { can, isSuperAdmin } = useAuth();
  const allowed = isSuperAdmin || can('platform.audit.view');
  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => listDocs<AuditLog>('auditLogs', [orderBy('timestamp', 'desc')]),
    enabled: allowed,
  });

  if (!allowed) return <div><PageHeader title="Audit jurnalı" /><EmptyState title="İcazə yoxdur" description="'platform.audit.view' icazəsi lazımdır." /></div>;

  return (
    <div>
      <PageHeader title="Audit jurnalı" subtitle="Bütün kritik əməliyyatların dəyişdirilə bilməyən jurnalı (01 §10)"
        action={<ExportButton filename="audit-jurnali" rows={data ?? []} columns={[
          { header: 'Tarix', value: (l) => { const t = (l.timestamp as { toMillis?: () => number })?.toMillis?.() ?? null; return t ? formatDateTime(t) : ''; } },
          { header: 'İstifadəçi', value: (l) => l.userDisplayName ?? l.userId },
          { header: 'Əməliyyat', value: 'action' },
          { header: 'Obyekt tipi', value: 'entityType' }, { header: 'Obyekt ID', value: 'entityId' },
        ]} />} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Jurnal boşdur" description="Əməliyyatlar baş verdikcə burada görünəcək." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tarix</TableHead><TableHead>İstifadəçi</TableHead><TableHead>Əməliyyat</TableHead>
              <TableHead>Obyekt</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.slice(0, 200).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime((log.timestamp as { toMillis?: () => number })?.toMillis?.() ?? null)}</TableCell>
                  <TableCell>{log.userDisplayName ?? log.userId}</TableCell>
                  <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{log.entityType}/{log.entityId.slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
