export type CardStyle = 'gradient' | 'minimal';

const KEY = 'taxiq.cardStyle';

/** Launcher bölmə kartlarının görünüşü — rəngli gradient və ya ağ + abstrakt */
export function loadCardStyle(): CardStyle {
  try { return localStorage.getItem(KEY) === 'minimal' ? 'minimal' : 'gradient'; } catch { return 'gradient'; }
}
export function saveCardStyle(style: CardStyle): void {
  try { localStorage.setItem(KEY, style); } catch { /* ignore */ }
}
