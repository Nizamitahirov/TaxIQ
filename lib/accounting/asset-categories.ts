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
  { key: 'buildings', name: L('Binalar, tikililər və qurğular', 'Buildings & constructions'), taxRate: 7, defaultMethod: 'reducing_balance' },
  { key: 'machinery', name: L('Maşınlar, avadanlıq və hesablama texnikası', 'Machinery, equipment & computers'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'vehicles', name: L('Nəqliyyat vasitələri', 'Vehicles'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'working_animals', name: L('İş heyvanları', 'Working animals'), taxRate: 20, defaultMethod: 'reducing_balance' },
  { key: 'geological', name: L('Geoloji-kəşfiyyat və hasilata hazırlıq xərcləri', 'Geological exploration & extraction prep.'), taxRate: 25, defaultMethod: 'reducing_balance' },
  { key: 'other', name: L('Digər əsas vəsaitlər', 'Other fixed assets'), taxRate: 20, defaultMethod: 'reducing_balance' },
];

export const ASSET_CATEGORY_MAP: Record<string, AssetCategory> = Object.fromEntries(
  AZ_ASSET_CATEGORIES.map((c) => [c.key, c]),
);

/** Default kateqoriya — ən çox rast gəlinən "Digər əsas vəsaitlər" (20%). */
export const DEFAULT_ASSET_CATEGORY = 'other';
