'use client';

import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface Props {
  title: string;
  /** Başlıqda sağda əlavə element (məs. legend, filter) */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Qrafik üçün konteyner kartı */
export function ChartCard({ title, action, className, children }: Props) {
  return (
    <Card className={cn('rounded-card', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
