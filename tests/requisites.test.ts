import { describe, it, expect } from 'vitest';
import { checkRequisites, invoiceToRequisites, MANDATORY_REQUISITES } from '@/lib/accounting/requisites';

describe('primary-document requisites — Accounting Law Art.9', () => {
  it('flags a fully-populated document as valid', () => {
    const full = Object.fromEntries(MANDATORY_REQUISITES.map((r) => [r.key, 'x']));
    const c = checkRequisites(full);
    expect(c.valid).toBe(true);
    expect(c.missing).toHaveLength(0);
    expect(c.completeness).toBe(1);
  });
  it('lists missing requisites', () => {
    const c = checkRequisites({ documentName: 'Faktura', documentNumber: '', documentDate: '2026-01-01' });
    expect(c.valid).toBe(false);
    expect(c.missing.some((m) => m.key === 'documentNumber')).toBe(true);
    expect(c.present).toContain('documentName');
  });
  it('treats 0, empty string, empty array as missing', () => {
    const c = checkRequisites({ amount: 0, description: [], parties: '   ' });
    expect(c.present).toHaveLength(0);
  });
  it('maps an invoice to requisites and validates it', () => {
    const inv = invoiceToRequisites({ invoiceNumber: 'INV-1', issueDate: '2026-01-10', customerName: 'ABC MMC', lineItems: [{}], grandTotal: 118, createdBy: 'u1' });
    const c = checkRequisites(inv);
    expect(c.valid).toBe(true);
  });
  it('an invoice with no number/total is incomplete', () => {
    const inv = invoiceToRequisites({ issueDate: '2026-01-10', customerName: 'ABC MMC', lineItems: [], grandTotal: 0 });
    const c = checkRequisites(inv);
    expect(c.valid).toBe(false);
    expect(c.completeness).toBeLessThan(1);
  });
});
