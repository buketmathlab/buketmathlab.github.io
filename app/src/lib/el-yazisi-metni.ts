/**
 * ÇÖZÜM EL YAZISIYLA — öğrencinin ödev gönderme ekranındaki kural ve onay.
 * React'siz, doğrudan test edilebilir (`ogrenci-cikarma-metni.ts` deseni).
 *
 * Öğretmenin kuralı: çözüm el yazısıyla olmalı. GEÇERLİ İKİ YOL var:
 * kâğıda kalemle çözmek ya da iPad/tablette ödev dosyasını açıp
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

export const BASLIK = 'Çözümünü kendi el yazınla teslim et';

export const NEDEN =
  'Çözüm adımların, nasıl düşündüğünü ve nerede desteğe ihtiyaç duyduğunu görmemi sağlar.';

/** İki geçerli yol. Cihaz adı açıkça yazılı: iPad'de kalemle çözen öğrenci
 *  kuralı kendine karşı okumasın ("Bu da el yazısı sayılır"). */
export const YOLLAR: ReadonlyArray<{ baslik: string; metin: string }> = [
  {
    baslik: 'Kâğıt üzerinde',
    metin: 'Soruları kâğıda kalemle çöz; çözümünün net bir fotoğrafını yükle.',
  },
  {
    baslik: 'iPad veya tablet üzerinde',
    metin:
      '“Soruları aç (PDF)” ile ödev dosyasını aç, soruların üzerine kalemle çöz; ' +
      'sayfaları kaydedip yükle. Bu da el yazısı sayılır.',
  },
];

/** Kabul edilmeyen, CİHAZA göre değil YAZIM BİÇİMİNE göre tarif ediliyor:
 *  "bilgisayarda yazılmış" iPad'de kalemle yazanı yanıltabiliyordu
 *  (öğretmenin uyarısı). "Klavyeyle yazılmış" her cihazda aynı anlamda. */
export const KABUL_EDILMEYEN =
  'Klavyeyle yazılmış, başkasından alınmış ya da yapay zekâyla hazırlanmış ' +
  'bir çözüm gönderirsen ödevin kabul edilmez.';

export const ONAY =
  'Bu ödevi kendim çözdüm; çözüm kendi el yazımdır. ' +
  'Aksi durumda ödevimin kabul edilmeyeceğini biliyorum.';

export const ONAY_EKSIK = 'Ödevi göndermek için onay kutusunu işaretle.';

/** Yükleme alanının ipucu: iki yol da geçerli. */
export const YUKLEME_IPUCU =
  'Zorunlu. Kâğıttaki çözümünün fotoğrafı ya da iPad/tablette çözdüğün ' +
  'sayfalar (görsel veya PDF). Birden çok sayfalı PDF tek görselde birleştirilir.';
