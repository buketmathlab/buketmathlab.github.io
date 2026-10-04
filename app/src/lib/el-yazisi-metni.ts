/**
 * ÇÖZÜM EL YAZISIYLA — öğrencinin ödev gönderme ekranındaki kural ve onay.
 * React'siz, doğrudan test edilebilir (`ogrenci-cikarma-metni.ts` deseni).
 *
 * Öğretmenin kuralı: çözüm el yazısıyla olmalı. GEÇERLİ İKİ YOL var:
 * kâğıda kalemle çözmek ya da tablette/iPad'de ödev dosyasını açıp
 * soruların ÜZERİNE kalemle çözmek. İkincisi de el yazısıdır ve metin bunu
 * açıkça söylüyor; tabletle çalışan öğrenci kuralı kendine karşı
 * okumamalı.
 *
 * DİL: suçlamadan, öğrenmeye odaklı ("profesyonel ve pedagojik" —
 * öğretmenin isteği). Kural, NEDEN istendiğiyle birlikte veriliyor:
 * öğretmen çözüm yolunu görmek istiyor, çünkü yardımı oradan başlıyor.
 *
 * Onay SAKLANMIYOR: öğrencinin kendine verdiği söz. Asıl denetim
 * öğretmenin "yeniden aç" yolu (0056).
 */

export const BASLIK = 'Çözümün senin el yazınla olsun';

export const NEDEN =
  'Bu ödevde benim için en değerli şey, soruyu nasıl düşündüğün. Çözüm ' +
  'yolunu görünce nerede zorlandığını anlar, sana o noktada yardım ederim. ' +
  'Yalnız doğru şıkkı bilmek bunu göstermez.';

export const YOLLAR: ReadonlyArray<{ baslik: string; metin: string }> = [
  {
    baslik: 'Kâğıtta',
    metin: 'Soruları kâğıda çöz; çözümünün okunaklı bir fotoğrafını çekip yükle.',
  },
  {
    baslik: 'Tablette',
    metin:
      '“Soruları aç (PDF)” ile ödev dosyasını aç, tablet kalemiyle soruların ' +
      'üzerine çöz. Sayfaları resim ya da PDF olarak kaydedip buraya yükle.',
  },
];

export const KABUL_EDILMEYEN =
  'Bilgisayarda yazılmış, başkasından kopyalanmış ya da yapay zekâya ' +
  'yaptırılmış çözümler kabul edilmez. Böyle bir durumda ödevi yeniden ' +
  'yapmanı isteyebilirim.';

export const ONAY =
  'Bu ödevi kendim çözdüm; çözümüm kendi el yazımla (kâğıtta ya da tablette).';

export const ONAY_EKSIK = 'Göndermeden önce el yazısı onayını işaretle.';

/** Yükleme alanının ipucu: iki yol da geçerli. */
export const YUKLEME_IPUCU =
  'Zorunlu. Kâğıttaki çözümünün fotoğrafı ya da tablette soruların üzerine ' +
  'yazdığın sayfalar (resim ya da PDF). Okunaklı olsun yeter; PDF birden fazla ' +
  'sayfaysa sayfalar tek görselde birleştirilir.';
