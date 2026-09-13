import type { LocalizedText, WorkflowDefinition } from '@/types';

const L = (az: string, en: string): LocalizedText => ({ az, en });

export interface WorkflowTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  category: 'finance' | 'hr' | 'sales' | 'general';
  applicableSectors: 'all' | string[];
  /** workflowDefinitions-ə kopyalanacaq ilkin struktur */
  seed: Omit<WorkflowDefinition, 'id' | 'companyId' | 'version' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status' | 'name' | 'description' | 'category'>;
}

/** Sistem workflow şablonları (04 §7.2) */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'invoice_approval_threshold',
    name: L('Faktura Təsdiqi (Məbləğ Həddi ilə)', 'Invoice Approval (Amount Threshold)'),
    description: L('Müəyyən məbləğdən yuxarı fakturalar Baş Mühasib təsdiqi tələb edir', 'Invoices above a threshold require Chief Accountant approval'),
    category: 'finance', applicableSectors: 'all',
    seed: {
      trigger: { type: 'on_create', entityType: 'invoices' },
      conditions: [{ field: 'grandTotal', operator: '>', value: 5000 }], conditionLogic: 'AND',
      approval: { approverRoleId: 'chief_accountant', mode: 'single', timeoutHours: 48 },
      actions: [{ type: 'update_field', config: { targetField: 'status', newValue: 'approved' }, label: 'Status=approved' }],
    },
  },
  {
    id: 'leave_approval',
    name: L('Məzuniyyət Tələbi Təsdiqi', 'Leave Request Approval'),
    description: L('Məzuniyyət tələbi birbaşa rəhbərə təsdiqə gedir', 'Leave request goes to direct manager'),
    category: 'hr', applicableSectors: 'all',
    seed: {
      trigger: { type: 'on_create', entityType: 'leaveRequests' },
      approval: { approverRoleId: 'hr_manager', mode: 'sequential', timeoutHours: 72 },
      actions: [{ type: 'send_notification', config: { recipientType: 'trigger_creator', titleTemplate: 'Məzuniyyət tələbiniz cavablandırıldı' }, label: 'Bildiriş' }],
    },
  },
  {
    id: 'employee_onboarding',
    name: L('Yeni İşçi Onboarding Checklist', 'New Employee Onboarding'),
    description: L('Yeni işçi üçün IT hesabı, sənəd toplama tapşırıqları + 3 gün sonra xatırlatma', 'IT/document tasks + reminder'),
    category: 'hr', applicableSectors: 'all',
    seed: {
      trigger: { type: 'on_create', entityType: 'employees' },
      actions: [
        { type: 'create_task', config: { title: 'IT hesabı yarat', dueInDays: 1 }, label: 'IT tapşırığı' },
        { type: 'create_task', config: { title: 'Sənədləri topla', dueInDays: 2 }, label: 'Sənəd tapşırığı' },
      ],
    },
  },
  {
    id: 'overdue_invoice_alert',
    name: L('Vaxtı Keçmiş Faktura Xəbərdarlığı', 'Overdue Invoice Alert'),
    description: L('Gündəlik: ödəmə müddəti keçmiş fakturalar üçün Satış Menecerinə bildiriş', 'Daily alert for overdue invoices'),
    category: 'sales', applicableSectors: 'all',
    seed: {
      trigger: { type: 'scheduled', cron: '0 9 * * *' },
      conditions: [{ field: 'status', operator: '=', value: 'overdue' }], conditionLogic: 'AND',
      actions: [{ type: 'send_notification', config: { recipientType: 'role', recipientId: 'sales_manager', titleTemplate: 'Vaxtı keçmiş fakturalar var' }, label: 'Bildiriş' }],
    },
  },
  {
    id: 'purchase_two_step',
    name: L('Satınalma Sorğusu Təsdiqi (2 Pilləli)', 'Purchase Approval (2-step)'),
    description: L('Departament Rəhbəri → Baş Mühasib ardıcıl təsdiqi', 'Dept manager → Chief Accountant sequential'),
    category: 'finance', applicableSectors: ['manufacturing', 'wholesale_distribution'],
    seed: {
      trigger: { type: 'on_create', entityType: 'purchaseBills' },
      approval: { approverRoleId: 'chief_accountant', mode: 'sequential', timeoutHours: 48 },
      actions: [{ type: 'update_field', config: { targetField: 'status', newValue: 'approved' }, label: 'Status=approved' }],
    },
  },
];

export const WORKFLOW_TEMPLATE_MAP = Object.fromEntries(WORKFLOW_TEMPLATES.map((t) => [t.id, t]));
