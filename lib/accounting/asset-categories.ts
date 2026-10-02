import type { LocalizedText } from '@/types';

const L = (az: string, en: string): LocalizedText => ({ az, en });

/**
 * Əsas vəsait kateqoriyaları və illik amortizasiya normaları —
 * Azərbaycan Respublikası Vergi Məcəlləsi, maddə 114.3.
 * Vergi uçotunda metod = azalan qalıq (reducing balance); göstərilən faizlər
 * illik MAKSİMUM normadır (mühasibat/IFRS üçün dəyişdirilə bilər).
 */
export interface AssetCategory {
  key: string;
  name: LocalizedText;
  /** İllik maksimum norma (%) — Vergi Məcəlləsi m.114.3 */
  taxRate: number;
  /** Tövsiyə olunan default metod */
  defaultMethod: 'straight_line' | 'reducing_balance';
}

export const AZ_ASSET_CATEGORIES: AssetCategory[] = [
  { key: 'buildings', name: L('Binalar, tikililər və qurğular (m.114.3.1)', 'Buildings & constructions'), taxRate: 7, defaultMethod: 'reducing_balance' },
  { key: 'machinery', name: L('Maşınlar və avadanlıq (m.114.3.2)', 'Machinery & equipment'), taxRate: 20, defaultMethod: 'reducing_balance' },
  { key: 'computers', name: L('Yüksək texnologiyalı hesablama texnikası (m.114.3.2-1)', 'High-tech computing equipment'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'vehicles', name: L('Nəqliyyat vasitələri (m.114.3.3)', 'Vehicles'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'working_animals', name: L('İş heyvanları (m.114.3.4)', 'Working animals'), taxRate: 20, defaultMethod: 'reducing_balance' },
  { key: 'geological', name: L('Geoloji-kəşfiyyat və hasilata hazırlıq xərcləri (m.114.3.5)', 'Geological exploration & extraction prep.'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'intangible', name: L('Qeyri-maddi aktivlər (m.114.3.6)', 'Intangible assets'), taxRate: 10, defaultMethod: 'straight_line' },
  { key: 'other', name: L('Digər əsas vəsaitlər (m.114.3.7)', 'Other fixed assets'), taxRate: 20, defaultMethod: 'reducing_balance' },
];

export const ASSET_CATEGORY_MAP: Record<string, AssetCategory> = Object.fromEntries(
  AZ_ASSET_CATEGORIES.map((c) => [c.key, c]),
);

/** Default kateqoriya — ən çox rast gəlinən "Digər əsas vəsaitlər" (20%). */
export const DEFAULT_ASSET_CATEGORY = 'other';
