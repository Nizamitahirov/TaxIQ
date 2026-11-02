/** Birbank-uyğun qrafik rəng palitrası (qırmızı→narıncı əsaslı) */

// Əsas seriya rəngləri — isti liderlik + ayırdedici soyuq aksentlər
export const CHART_COLORS = [
  '#ED1C24', // brand red (primary)
  '#FF7A00', // brand orange
  '#F7A81B', // amber-gold
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#A855F7', // purple
  '#EC4899', // pink
  '#16A37B', // green
];

// Yumşaq/açıq variant (fon, sahə doldurma üçün)
export const CHART_SOFT = [
  '#F8726F', '#FFA64D', '#FBC55A', '#2DD4BF', '#60A5FA', '#C084FC', '#F472B6', '#34D399',
];

// Aging/risk üçün semantik (cari→təhlükə): yaşıl → sarı → narıncı → qırmızı
export const RISK_COLORS = ['#16A37B', '#F7A81B', '#FF7A00', '#F2541B', '#ED1C24'];

export const PRIMARY = '#ED1C24';
export const PRIMARY_SOFT = 'rgba(237,28,36,0.12)';

export function colorAt(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}
