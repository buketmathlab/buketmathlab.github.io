/**
 * Çözüm fotoğrafı sıkıştırma.
 *
 * NEDEN GEREKLİ: bugünün telefonları 4–12 MB'lık fotoğraf üretiyor. Bucket
 * sınırı 10 MB; üstelik öğrenci çoğu zaman mobil veriyle yüklüyor. Ham
 * fotoğraf hem sınırı aşar hem de dakikalarca sürer.
 *
 * Değerler eski uygulamadan (`index.html:139`) taşındı: 1400 px kenar,
 * JPEG 0.72. Bu ayar bir dönem boyunca gerçek öğrenci fotoğraflarıyla
 * kullanıldı ve el yazısı okunaklı kaldı — deneyerek bulunmuş bir denge,
 * yeniden tahmin etmeye gerek yok.
 *
 * Şeffaflık gerekmediği için çıktı her zaman JPEG: PNG aynı fotoğrafı
 * birkaç katı boyutta saklar.
 */

const EN_BUYUK_KENAR = 1400;
const KALITE = 0.72;

/**
 * Görseli küçültüp JPEG'e çevirir.
 *
 * Sıkıştırma başarısız olursa (bozuk dosya, desteklenmeyen biçim) hata
 * fırlatır — sessizce ham dosyaya düşmez. Ham dosya sınırı aşıp yükleme
 * sırasında anlamsız bir hatayla patlardı; burada söylemek daha dürüst.
 */
export async function gorseliSikistir(dosya: File): Promise<File> {
  const url = URL.createObjectURL(dosya);
  try {
    const img = await new Promise<HTMLImageElement>((cozumle, reddet) => {
      const i = new Image();
      i.onload = () => cozumle(i);
      i.onerror = () => reddet(new Error('Fotoğraf okunamadı. Başka bir dosya deneyin.'));
      i.src = url;
    });

    const oran = Math.min(1, EN_BUYUK_KENAR / Math.max(img.width, img.height));
    const en = Math.round(img.width * oran);
    const boy = Math.round(img.height * oran);

    const tuval = document.createElement('canvas');
    tuval.width = en;
    tuval.height = boy;
    const ctx = tuval.getContext('2d');
    if (!ctx) throw new Error('Fotoğraf işlenemedi. Sayfayı yenileyip tekrar deneyin.');
    ctx.drawImage(img, 0, 0, en, boy);

    const blob = await new Promise<Blob | null>((c) =>
      tuval.toBlob(c, 'image/jpeg', KALITE),
    );
    if (!blob) throw new Error('Fotoğraf işlenemedi. Başka bir dosya deneyin.');

    return new File([blob], 'cozum.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
