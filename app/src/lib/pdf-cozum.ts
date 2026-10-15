/**
 * Öğrenci çözümü olarak PDF — saf mantık.
 *
 * Öğretmenin isteği: "PDF de gönderebilsinler." Çözüm alanı yalnız görsel
 * kabul ediyor (depo yolu ve sunucu kuralı `.jpg/.png/.webp`), bu yüzden
 * PDF öğrencinin cihazında görsele çevriliyor ve öyle yükleniyor. Sunucu,
 * depo kuralı, öğretmenin ve velinin çözüm görüntüleyicisi PDF görmüyor.
 *
 * 0078: PDF'İN HER SAYFASI AYRI BİR ÇÖZÜM SAYFASI. Eskiden sayfa sınırı 1
 * olan ödevde sayfalar alt alta tek görsele birleştiriliyordu; öğretmen
 * birleştirmeyi kaldırdı ("ödev kaç sayfaysa öğrenci o kadar sayfa
 * göndersin"). Çizim `services/pdf-gorsel.ts`'te.
 */

/** Sayfa genişliği (piksel). Fotoğraf sıkıştırmasıyla aynı: 1400 px. */
export const PDF_GENISLIK = 1400;

export function pdfMi(dosya: { name: string; type: string }): boolean {
  return dosya.type === 'application/pdf' || /\.pdf$/i.test(dosya.name);
}
