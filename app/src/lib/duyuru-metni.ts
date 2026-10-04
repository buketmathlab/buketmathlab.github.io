/**
 * DUYURULAR (0065) — metinler ve küçük hesaplar, React'siz ve test edilebilir.
 *
 * Öğretmenin isteği: "Acil durumlarda sadece öğretmenlerin tek taraflı
 * bildirimde bulunabileceği bir duyuru panosu oluştur. Sadece hangi sınıfa
 * duyuru yapılacaksa o sınıfın öğrencilerine o duyuru gitsin."
 *
 * Sınırlar sunucuyla AYNI (`duyuru_yayinla`): 1–1000 karakter, en az bir
 * şube. Ekran bunları önceden söylüyor; asıl kapı sunucuda.
 */

export const DUYURU_SINIRI = 1000;

export const SAYFA_ACIKLAMASI =
  'Seçtiğiniz şubelerin öğrencilerine tek yönlü duyuru. Öğrenciler yanıt veremez; veliler görmez.';

export const BOS_METIN = 'Duyuru metnini yazın.';
export const UZUN_METIN = `Duyuru en çok ${DUYURU_SINIRI} karakter olabilir.`;
export const SUBE_YOK = 'Duyurunun gideceği en az bir şube seçin.';

/** Sunucunun kırptığı gibi: baştaki/sondaki boşluk ve satır sonları. */
export function duyuruMetni(ham: string): string {
  return ham.replace(/^[\s]+|[\s]+$/g, '');
}

/** Form hatası; yoksa null. Sırası: metin, sonra şube. */
export function formHatasi(ham: string, subeSayisi: number): string | null {
  const m = duyuruMetni(ham);
  if (m.length === 0) return BOS_METIN;
  if (m.length > DUYURU_SINIRI) return UZUN_METIN;
  if (subeSayisi === 0) return SUBE_YOK;
  return null;
}

const SAYI = new Intl.NumberFormat('tr-TR');

/** "9A, 9B — 56 öğrenci" */
export function aliciOzeti(subeler: ReadonlyArray<{ ad: string; ogrenci_sayisi: number }>): string {
  const toplam = subeler.reduce((t, s) => t + s.ogrenci_sayisi, 0);
  return `${subeler.map((s) => s.ad).join(', ')} — ${SAYI.format(toplam)} öğrenci`;
}

/** Gönderim onayının sorusu: kime gidecek, geri dönüşü yok. */
export function onaySorusu(ozet: string): string {
  return `${ozet}. Öğrenciler bu duyuruya yanıt veremez. Gönderilsin mi?`;
}

/** Şube başına ulaşma: "9A: 23/28 öğrenci gördü" */
export function gorenMetni(ad: string, goren: number, mevcut: number): string {
  return `${ad}: ${SAYI.format(goren)}/${SAYI.format(mevcut)} öğrenci gördü`;
}

const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

/** "4 Ekim 14:05" — İstanbul saatiyle. */
export function duyuruZamani(iso: string): string {
  return ZAMAN.format(new Date(iso));
}
