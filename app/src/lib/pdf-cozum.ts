/**
 * Öğrenci çözümü olarak PDF — saf mantık.
 *
 * Öğretmenin isteği: "PDF de gönderebilsinler." Öğrenciler çözümlerini
 * PDF olarak yüklemeye çalışıyor, sistem "Fotoğraf işlenemedi" diyordu:
 * çözüm alanı yalnız görsel kabul ediyor (depo yolu ve sunucu kuralı
 * `.jpg/.png/.webp`).
 *
 * YOL: PDF, öğrencinin cihazında görsele çevriliyor ve öyle yükleniyor.
 * Sunucu, depo kuralı, öğretmenin ve velinin çözüm görüntüleyicisi HİÇ
 * değişmiyor — hepsi zaten görsel bekliyor.
 *
 *  - Sayfa sınırı 1 olan ödevde PDF'in sayfaları ALT ALTA TEK GÖRSELE
 *    birleştiriliyor. Öğrenciler zaten sayfalarını birleştirip tek dosya
 *    gönderiyordu (öğretmen 0054'te söyledi); bu onların yaptığını otomatik
 *    yapıyor.
 *  - Birden fazla sayfaya izin verilen ödevde her PDF sayfası ayrı sayfa.
 *
 * Bu dosya boyut ve yerleşim hesabı; çizim `services/pdf-gorsel.ts`'te.
 */

/** Tek görsele birleştirilebilecek en fazla PDF sayfası. */
export const TEK_GORSEL_EN_FAZLA_SAYFA = 8;

/** Sayfa genişliği (piksel). Fotoğraf sıkıştırmasıyla aynı: 1400 px. */
export const PDF_GENISLIK = 1400;

/**
 * Tuvalin en büyük alanı. iOS Safari 16 777 216 pikselin üstündeki
 * tuvali sessizce boş çiziyor; biraz altında kalınıyor.
 */
export const EN_FAZLA_PIKSEL = 16_000_000;

/** Birleştirilmiş görselde sayfalar arasındaki gri çizgi (piksel). */
export const ARA_CIZGI = 6;

export function pdfMi(dosya: { name: string; type: string }): boolean {
  return dosya.type === 'application/pdf' || /\.pdf$/i.test(dosya.name);
}

export type SayfaYeri = { y: number; en: number; boy: number };
export type TekGorselDuzeni = { en: number; boy: number; sayfalar: SayfaYeri[] };

/**
 * Sayfaları ortak genişlikte alt alta dizer. Toplam alan sınırı aşarsa
 * genişlik orantılı küçülür (sayfalar okunur kalsın diye yükseklik değil
 * alan sınırlanıyor).
 *
 * @param boyutlar Her sayfanın PDF'teki en/boyu (punto) — oran için.
 */
export function tekGorselDuzeni(
  boyutlar: ReadonlyArray<{ en: number; boy: number }>,
  genislik = PDF_GENISLIK,
  enFazlaPiksel = EN_FAZLA_PIKSEL,
): TekGorselDuzeni {
  const oranlar = boyutlar.map((b) => (b.en > 0 ? b.boy / b.en : 1.414));
  const cizgiler = ARA_CIZGI * Math.max(0, boyutlar.length - 1);
  const boyFn = (w: number) => oranlar.reduce((t, o) => t + Math.round(w * o), 0) + cizgiler;

  let en = genislik;
  if (en * boyFn(en) > enFazlaPiksel) {
    en = Math.floor(genislik * Math.sqrt(enFazlaPiksel / (genislik * boyFn(genislik))));
    while (en > 1 && en * boyFn(en) > enFazlaPiksel) en--;
  }

  const sayfalar: SayfaYeri[] = [];
  let y = 0;
  for (const o of oranlar) {
    const boy = Math.round(en * o);
    sayfalar.push({ y, en, boy });
    y += boy + ARA_CIZGI;
  }
  return { en, boy: Math.max(0, y - ARA_CIZGI), sayfalar };
}

/** "PDF'in 3 sayfası tek görsele birleştirildi." */
export function birlesimNotu(sayfaSayisi: number): string | null {
  return sayfaSayisi > 1 ? `PDF'in ${sayfaSayisi} sayfası tek görsele birleştirildi.` : null;
}

export function cokSayfaMetni(sayfaSayisi: number): string {
  return (
    `Bu PDF ${sayfaSayisi} sayfa; tek görsele en fazla ${TEK_GORSEL_EN_FAZLA_SAYFA} sayfa ` +
    'birleştirilebilir. Yalnız çözüm sayfalarını içeren bir PDF seç ya da fotoğraf yükle.'
  );
}
