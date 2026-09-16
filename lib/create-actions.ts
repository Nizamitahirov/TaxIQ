import {
  FileText, UserPlus, BookOpen, Users2, Package, Wallet, Building2, FileSpreadsheet,
  Workflow, HardHat, ListChecks, Target, type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';
import type { AreaKey } from '@/lib/nav';

export interface CreateAction {
  label: string;
  labelEn: string;
  href: string;          // müvafiq modul səhifəsi (yaratma orada açılır)
  module: ModuleKey;
  area: AreaKey;
  icon: LucideIcon;
}

/** Kontekst-həssas "Yarat" əməliyyatları (top bar + ⌘K) */
export const CREATE_ACTIONS: CreateAction[] = [
  { label: 'Yeni lead (CRM)', labelEn: 'New lead (CRM)', href: '/crm', module: 'crm', area: 'tax', icon: Target },
  { label: 'Yeni faktura', labelEn: 'New invoice', href: '/sales', module: 'sales', area: 'tax', icon: FileText },
  { label: 'Yeni mal / xidmət', labelEn: 'New good / service', href: '/warehouse', module: 'warehouse', area: 'tax', icon: Package },
  { label: 'Yeni ödəniş', labelEn: 'New payment', href: '/cashbank', module: 'cashbank', area: 'tax', icon: Wallet },
  { label: 'Yeni jurnal yazısı', labelEn: 'New journal entry', href: '/accounting', module: 'accounting', area: 'accounting', icon: BookOpen },
  { label: 'Yeni işçi', labelEn: 'New employee', href: '/hr', module: 'hr', area: 'hr', icon: UserPlus },
  { label: 'Yeni hesabat', labelEn: 'New report', href: '/reports', module: 'reports', area: 'reports', icon: FileSpreadsheet },
  { label: 'SƏTƏM sənədi / təlim qeydi', labelEn: 'HSE document / training', href: '/hse', module: 'hse', area: 'hse', icon: HardHat },
  { label: 'Yeni tapşırıq', labelEn: 'New task', href: '/tasks', module: 'dashboard', area: 'settings', icon: ListChecks },
  { label: 'Yeni workflow', labelEn: 'New workflow', href: '/workflow', module: 'workflow', area: 'settings', icon: Workflow },
  { label: 'Yeni istifadəçi', labelEn: 'New user', href: '/users', module: 'users', area: 'settings', icon: Users2 },
  { label: 'Yeni müştəri (şirkət)', labelEn: 'New client (company)', href: '/companies/new', module: 'companies', area: 'settings', icon: Building2 },
];
