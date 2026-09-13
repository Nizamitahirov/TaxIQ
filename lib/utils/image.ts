/**
 * Şəkli klient tərəfdə kiçildib data URL-ə çevirir — 01 §2.4 (avatarUrl).
 * Firebase Storage tələb etmədən profil şəkli: kvadrat kəsim + JPEG sıxılma.
 * Nəticə Firestore sənədində saxlanacağı üçün ~1MB limitindən aşağı olmalıdır.
 */
export async function resizeImageToDataUrl(
  file: File,
  size = 256,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Yalnız şəkil faylı seçin');
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  // Mərkəzdən kvadrat kəsim
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Şəkil emalı mümkün olmadı');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  let out = canvas.toDataURL('image/jpeg', quality);
  // Firestore sənəd limiti ~1MB; ehtiyat üçün böyükdürsə daha da sıx
  if (out.length > 900_000) out = canvas.toDataURL('image/jpeg', 0.6);
  if (out.length > 900_000) {
    throw new Error('Şəkil çox böyükdür, daha kiçik şəkil seçin');
  }
  return out;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Fayl oxunmadı'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Şəkil yüklənmədi'));
    img.src = src;
  });
}
