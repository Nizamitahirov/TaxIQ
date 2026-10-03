/**
 * Faylı klient tərəfdə data URL-ə çevirir — Firebase Storage tələb etmədən.
 * Firestore sənəd limiti ~1 MiB olduğundan kiçik fayllar (CV, qoşma) üçün
 * uyğundur; böyük fayllar üçün (etibarlı olduqda) Storage istifadə edilməlidir.
 */
export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

const DEFAULT_MAX = 700_000; // ~0.7 MB — Firestore 1 MiB limitindən ehtiyatlı aşağı

export async function fileToDataUrl(file: File, maxBytes = DEFAULT_MAX): Promise<UploadedFile> {
  if (file.size > maxBytes) {
    const mb = (maxBytes / 1_000_000).toFixed(1);
    throw new Error(`Fayl çox böyükdür (maks. ${mb} MB). Daha kiçik fayl seçin.`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Fayl oxunmadı'));
    reader.readAsDataURL(file);
  });
  return { name: file.name, type: file.type, size: file.size, dataUrl };
}

/** Data URL / URL faylını yeni pəncərədə aç (çap/baxış üçün) */
export function openDataUrl(dataUrl: string): void {
  const w = window.open();
  if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100%" allowfullscreen></iframe>`);
}
