/**
 * Məbləğin Azərbaycan dilində sözlə yazılışı (faktura üçün) — 06 §4.
 * Konvensiya şablona uyğundur: "bir yüz", "bir min", "bir milyon" (aparıcı rəqəm daxil).
 * Nəticə: "Beş min beş yüz manat 00 qəpik" (ilk hərf böyük).
 */
const UNITS = ['', 'bir', 'iki', 'üç', 'dörd', 'beş', 'altı', 'yeddi', 'səkkiz', 'doqquz'];
const TEENS = ['on', 'on bir', 'on iki', 'on üç', 'on dörd', 'on beş', 'on altı', 'on yeddi', 'on səkkiz', 'on doqquz'];
const TENS = ['', 'on', 'iyirmi', 'otuz', 'qırx', 'əlli', 'altmış', 'yetmiş', 'səksən', 'doxsan'];
const SCALES = ['', 'min', 'milyon', 'milyard', 'trilyon'];

/** 0–999 aralığındakı qrupu sözə çevirir */
function groupToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const t = Math.floor(rem / 10);
  const u = rem % 10;
  if (h > 0) parts.push(`${UNITS[h]} yüz`);
  if (t === 1) parts.push(TEENS[u]);
  else {
    if (t > 1) parts.push(TENS[t]);
    if (u > 0) parts.push(UNITS[u]);
  }
  return parts.join(' ');
}

/** Tam ədədi Azərbaycanca sözlə yazır (mənfi olmayan) */
export function integerToWordsAz(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'sıfır';
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const chunks: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const words = groupToWords(g);
    const scale = SCALES[i] ? ` ${SCALES[i]}` : '';
    chunks.push(`${words}${scale}`);
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function capitalize(s: string): string {
  return s.length ? s[0].toLocaleUpperCase('az') + s.slice(1) : s;
}

/**
 * Manat məbləğini sözlə yazır: "Beş min beş yüz manat 00 qəpik".
 * @param amount məbləğ (manatla, qəpik onluq hissə kimi)
 * @param currencyWord əsas valyuta sözü (default "manat")
 * @param subWord xırda vahid sözü (default "qəpik")
 */
export function amountToWordsAz(amount: number, currencyWord = 'manat', subWord = 'qəpik'): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const manat = Math.floor(safe + 1e-9);
  const qepik = Math.round((safe - manat) * 100);
  // yuvarlaqlaşma 100-ə çatarsa manatı artır
  const q = qepik >= 100 ? 0 : qepik;
  const m = qepik >= 100 ? manat + 1 : manat;
  const words = `${integerToWordsAz(m)} ${currencyWord} ${String(q).padStart(2, '0')} ${subWord}`;
  return capitalize(words);
}
