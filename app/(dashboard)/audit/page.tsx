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
import { useTT } from '@/lib/i18n/tt';
import type { AuditLog } from '@/types';

export default function AuditPage() {
  const { can, isSuperAdmin } = useAuth();
  const tt = useTT();
  const allowed = isSuperAdmin || can('platform.audit.view');
  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => listDocs<AuditLog>('auditLogs', [orderBy('timestamp', 'desc')]),
    enabled: allowed,
  });

  if (!allowed) return <div><PageHeader title={tt('Audit jurnalı', 'Audit log')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} description={tt("'platform.audit.view' icazəsi lazımdır.", "The 'platform.audit.view' permission is required.")} /></div>;

  return (
    <div>
      <PageHeader title={tt('Audit jurnalı', 'Audit log')} subtitle={tt('Bütün kritik əməliyyatların dəyişdirilə bilməyən jurnalı (01 §10)', 'An immutable log of all critical operations (01 §10)')}
        action={<ExportButton filename="audit-jurnali" rows={data ?? []} columns={[
          { header: tt('Tarix', 'Date'), value: (l) => { const t = (l.timestamp as { toMillis?: () => number })?.toMillis?.() ?? null; return t ? formatDateTime(t) : ''; } },
          { header: tt('İstifadəçi', 'User'), value: (l) => l.userDisplayName ?? l.userId },
          { header: tt('Əməliyyat', 'Action'), value: 'action' },
          { header: tt('Obyekt tipi', 'Object type'), value: 'entityType' }, { header: tt('Obyekt ID', 'Object ID'), value: 'entityId' },
        ]} />} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={tt('Jurnal boşdur', 'The log is empty')} description={tt('Əməliyyatlar baş verdikcə burada görünəcək.', 'Operations will appear here as they occur.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('İstifadəçi', 'User')}</TableHead><TableHead>{tt('Əməliyyat', 'Action')}</TableHead>
              <TableHead>{tt('Obyekt', 'Object')}</TableHead>
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
