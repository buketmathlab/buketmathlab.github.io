/**
 * Velinin adı — öğretmen ekranlarında (0057).
 *
 * Ad, velinin onam verirken KENDİ yazdığı ad; sunucu en son yazılanı
 * döndürüyor. Onam vermemiş velide ya da 0057 çalıştırılmamış panelde ad
 * yok: o zaman hiçbir şey uydurulmuyor, satır çizilmiyor.
 */

/** Boş ya da gelmemiş ad → null. */
export function veliAdi(ad: string | null | undefined): string | null {
  const temiz = ad?.trim() ?? '';
  return temiz.length > 0 ? temiz : null;
}

/** Listelerde öğrenci adının altındaki satır: "Veli: Ayşe Yıldırım". */
export function veliSatiri(ad: string | null | undefined): string | null {
  const a = veliAdi(ad);
  return a ? `Veli: ${a}` : null;
}

/** Veli yazışma ekranının alt başlığındaki kısım. */
export function veliYazismasiEtiketi(ad: string | null | undefined): string {
  const a = veliAdi(ad);
  return a ? `velisi ${a} ile yazışma` : 'velisiyle yazışma';
}
