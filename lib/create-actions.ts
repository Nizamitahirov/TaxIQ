import {
  FileText, UserPlus, BookOpen, Users2, Package, Wallet, Building2, FileSpreadsheet,
  Workflow, HardHat, type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';
import type { AreaKey } from '@/lib/nav';

export interface CreateAction {
  label: string;
  href: string;          // müvafiq modul səhifəsi (yaratma orada açılır)
  module: ModuleKey;
  area: AreaKey;
  icon: LucideIcon;
}

/** Kontekst-həssas "Yarat" əməliyyatları (top bar + ⌘K) */
export const CREATE_ACTIONS: CreateAction[] = [
  { label: 'Yeni faktura', href: '/sales', module: 'sales', area: 'tax', icon: FileText },
  { label: 'Yeni mal / xidmət', href: '/warehouse', module: 'warehouse', area: 'tax', icon: Package },
  { label: 'Yeni ödəniş', href: '/cashbank', module: 'cashbank', area: 'tax', icon: Wallet },
  { label: 'Yeni jurnal yazısı', href: '/accounting', module: 'accounting', area: 'accounting', icon: BookOpen },
  { label: 'Yeni işçi', href: '/hr', module: 'hr', area: 'hr', icon: UserPlus },
  { label: 'Yeni hesabat', href: '/reports', module: 'reports', area: 'reports', icon: FileSpreadsheet },
  { label: 'SƏTƏM sənədi / təlim qeydi', href: '/hse', module: 'hse', area: 'hse', icon: HardHat },
  { label: 'Yeni workflow', href: '/workflow', module: 'workflow', area: 'settings', icon: Workflow },
  { label: 'Yeni istifadəçi', href: '/users', module: 'users', area: 'settings', icon: Users2 },
  { label: 'Yeni müştəri (şirkət)', href: '/companies/new', module: 'companies', area: 'settings', icon: Building2 },
];
