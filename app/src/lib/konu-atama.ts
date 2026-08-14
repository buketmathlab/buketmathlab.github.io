/**
 * Soru → konu eşlemesinin saf mantığı.
 *
 * React'siz ve DOM'suz (`lib/` ilkesi): aralık hesabı sessiz hata üreten
 * bir yerdir — "1–5" yazan öğretmen 5. soruyu da kastediyor, kapalı aralık
 * bir eksik atarsa kimse fark etmez, öğrenci yanlış konuya çalışır. Bu
 * yüzden sınırlar burada, doğrudan test edilebilen bir yerde duruyor.
 *
 * Kayıt biçimi soru BAŞINA (`{1:'Türev', 2:'Türev'}`), aralık olarak değil.
 * Aralık yalnız bir GİRİŞ kolaylığı; saklama biçimi olsaydı tek bir sorunun
 * konusunu değiştirmek aralığı bölmek demek olurdu. Öğretmenin isteği
 * ikisiydi: "aralıkla gireyim, tek soruyu ayrıca değiştirebileyim."
 */

export type Konular = Record<number, string>;

/** Aynı konunun "Türev" ve "türev " diye ikiye bölünmesini engeller. */
export function konuAdiniDuzelt(ad: string): string {
  return ad.trim().replace(/\s+/g, ' ');
}

/**
 * Aralık denetimi. Hata metni doğrudan öğretmene gösteriliyor, bu yüzden
 * "geçersiz aralık" gibi bir şey demiyor — ne yapması gerektiğini söylüyor.
 */
export function araligiDenetle(
  ilk: number,
  son: number,
  konu: string,
  soruSayisi: number,
): string | null {
  if (!konuAdiniDuzelt(konu)) return 'Önce konu adını yazın.';
  if (!Number.isInteger(ilk) || !Number.isInteger(son)) {
    return 'Soru numaraları tam sayı olmalı.';
  }
  if (ilk < 1 || son < 1) return 'Soru numarası 1’den küçük olamaz.';
  if (ilk > soruSayisi || son > soruSayisi) {
    return `Bu ödevde ${soruSayisi} soru var; daha büyük numara giremezsiniz.`;
  }
  if (ilk > son) return 'İlk soru numarası son sorudan büyük olamaz.';
  return null;
}

/**
 * Aralığı atar. KAPALI ARALIK: 1–5 beş soruyu kapsar, beşincisi dahil.
 * Öğretmenin kâğıt üzerindeki "1–5" ifadesiyle aynı anlama gelmeli.
 *
 * Girdiyi değiştirmez; yeni nesne döner (React state'i böyle bekliyor).
 */
export function araligaAta(
  mevcut: Konular,
  ilk: number,
  son: number,
  konu: string,
  soruSayisi: number,
): Konular {
  if (araligiDenetle(ilk, son, konu, soruSayisi)) return mevcut;
  const ad = konuAdiniDuzelt(konu);
  const yeni = { ...mevcut };
  for (let n = ilk; n <= son; n++) yeni[n] = ad;
  return yeni;
}

/** Tek sorunun konusu. Boş metin, o soruyu konusuz bırakmak demektir. */
export function soruyaAta(mevcut: Konular, no: number, konu: string): Konular {
  const yeni = { ...mevcut };
  const ad = konuAdiniDuzelt(konu);
  if (ad) yeni[no] = ad;
  else delete yeni[no];
  return yeni;
}

/** Konusu girilmemiş sorular. Zorunlu değil — uyarı için. */
export function konusuzSorular(konular: Konular, soruSayisi: number): number[] {
  const eksik: number[] = [];
  for (let n = 1; n <= soruSayisi; n++) if (!konular[n]) eksik.push(n);
  return eksik;
}

/** Ekranda gösterilecek konu listesi, ilk göründüğü soru sırasına göre. */
export function konuOzeti(
  konular: Konular,
  soruSayisi: number,
): Array<{ konu: string; sorular: number[] }> {
  const sira: string[] = [];
  const kutu = new Map<string, number[]>();
  for (let n = 1; n <= soruSayisi; n++) {
    const ad = konular[n];
    if (!ad) continue;
    if (!kutu.has(ad)) {
      kutu.set(ad, []);
      sira.push(ad);
    }
    kutu.get(ad)!.push(n);
  }
  return sira.map((konu) => ({ konu, sorular: kutu.get(konu)! }));
}

/**
 * Sunucuya gönderilecek biçim: anahtarlar metin, boşlar hiç yok.
 *
 * `null` DÖNMÜYOR — sunucuda `p_konular = null` "DEĞİŞTİRME" demek
 * (`p_gec_teslim` ile aynı tuzak). Öğretmen bütün konuları sildiyse boş
 * nesne göndermeliyiz ki silme gerçekten kaydedilsin.
 */
export function sunucuyaHazirla(konular: Konular, soruSayisi: number): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (let n = 1; n <= soruSayisi; n++) {
    const ad = konular[n];
    if (ad) cikti[String(n)] = ad;
  }
  return cikti;
}

/** Sunucudan gelen `{"1":"Türev"}` biçimini içeride kullandığımız hâle çevirir. */
export function sunucudanOku(gelen: Record<string, string> | null | undefined): Konular {
  const cikti: Konular = {};
  for (const [k, v] of Object.entries(gelen ?? {})) {
    const n = Number(k);
    const ad = konuAdiniDuzelt(v ?? '');
    if (Number.isInteger(n) && n >= 1 && ad) cikti[n] = ad;
  }
  return cikti;
}
