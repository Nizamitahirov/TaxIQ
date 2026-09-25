/**
 * Rəsmi 7 rəqəmli fəaliyyət kodları (2775 kod) — şirkət qeydiyyatı üçün.
 * Mənbə: DVX 5 rəqəmli fəaliyyət növləri bazasında yaradılmış 7 rəqəmli kodlar.
 * Böyük JSON (~500 KB) yalnız lazım olduqda dinamik yüklənir (lazy import),
 * ilkin bundle-a təsir etmir.
 */

export interface ActivityCode {
  /** 7 rəqəmli kod */
  code: string;
  /** 7 rəqəmli fəaliyyət növünün adı */
  name: string;
  /** 5 rəqəmli baza kodu (kateqoriya) */
  parentCode: string;
  /** 5 rəqəmli baza fəaliyyət növü */
  parentName: string;
}

interface RawCode { c: string; n: string; p: string; pn: string }

let cache: ActivityCode[] | null = null;

/** Bütün kodları dinamik yükləyir və keşləyir. */
export async function loadActivityCodes(): Promise<ActivityCode[]> {
  if (cache) return cache;
  const mod = await import('./data/activity-codes.json');
  const raw = (mod.default ?? mod) as unknown as RawCode[];
  cache = raw.map((r) => ({ code: r.c, name: r.n, parentCode: r.p, parentName: r.pn }));
  return cache;
}

/** Azərbaycan hərflərini normallaşdırır (İ/ı/ə/ç/ş/ğ/ö/ü) — axtarış üçün. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('az')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ə/g, 'e').replace(/ç/g, 'c').replace(/ş/g, 's')
    .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

/**
 * Kod və ya ad üzrə axtarış. Rəqəmlə başlayan sorğu kod üzrə,
 * digərləri ad/baza-ad üzrə axtarır. `limit` nəticə sayını məhdudlaşdırır.
 */
export async function searchActivityCodes(query: string, limit = 40): Promise<ActivityCode[]> {
  const all = await loadActivityCodes();
  const q = query.trim();
  if (!q) return all.slice(0, limit);
  if (/^\d/.test(q)) {
    const digits = q.replace(/\D/g, '');
    return all.filter((c) => c.code.startsWith(digits) || c.parentCode.startsWith(digits)).slice(0, limit);
  }
  const fq = fold(q);
  return all.filter((c) => fold(c.name).includes(fq) || fold(c.parentName).includes(fq)).slice(0, limit);
}

/** Verilmiş 7 rəqəmli koda görə bir yazı qaytarır. */
export async function findActivityCode(code: string): Promise<ActivityCode | undefined> {
  const all = await loadActivityCodes();
  return all.find((c) => c.code === code);
}
