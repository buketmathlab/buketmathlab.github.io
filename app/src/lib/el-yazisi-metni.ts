/**
 * ÇÖZÜM EL YAZISIYLA — öğrencinin ödev gönderme ekranındaki kural ve onay.
 * React'siz, doğrudan test edilebilir (`ogrenci-cikarma-metni.ts` deseni).
 *
 * Öğretmenin kuralı: çözüm el yazısıyla olmalı. GEÇERLİ ÜÇ YOL var ve
 * hepsi el yazısıdır.
 *
 * -----------------------------------------------------------------------------
 * ÇIKTI ALINMIŞ SORU KÂĞIDI BİRİNCİ SIRADA (öğretmenin isteği)
 *
 * *"Kâğıt üzerinde de boş kâğıt üzerinde olmasın. Çıktı alarak mümkünse
 * eğer. Çıktı alınan kâğıdın üzerinde, yani soruların üzerinde ve
 * soruların altındaki boşlukta çözümlerini yaparlarsa daha iyi olur."*
 *
 * Gerekçe açık: boş kâğıtta soru ile çözüm ayrı düşüyor ve öğretmen hangi
 * çözümün hangi soruya ait olduğunu ayrı bir zihinsel işle kuruyor.
 * Soruların üzerine yazılmış bir kâğıtta o iş kendiliğinden bitmiş oluyor.
 *
 * -----------------------------------------------------------------------------
 * BOŞ KÂĞIT YOLU KALDIRILMADI — ve bu da öğretmenin kararı
 *
 * Türkiye'de her evde yazıcı yok. Boş kâğıdı kaldırmak, yazıcısı olmayan
 * öğrencinin ödev gönderememesi demekti. SON SIRADA duruyor ve SORU
 * NUMARASI kuralıyla birlikte geliyor: numara yazılırsa çıktısı olmayan
 * öğrencinin kâğıdı da okunabilir kalıyor.
 *
 * SIRA ÖĞRETMENİN İKİNCİ DÜZELTMESİ: boş kâğıt ile tablet yer değiştirdi.
 * İlk iki yolun ortak yanı, çözümün SORULARIN ÜZERİNE yazılması — kâğıtta
 * ya da ekranda. Boş kâğıt bu bakımdan ikisinden de ayrı ve en sonda
 * duruyor: yürüyen bir yol, ama tercih edilen değil.
 *
 * ÖĞRETMENİN ÜÇÜNCÜ DÜZELTMESİ: tablet yolu da "Önerilen". İkisi birden
 * önerilen, çünkü ikisi de AYNI ŞEYİ yapıyor — çözüm soruların üzerine
 * yazılıyor. Yalnız çıktıyı önermek, iPad'iyle doğru olanı yapan
 * öğrenciye ikinci sınıf bir yol seçmiş hissi verirdi. Önerilmeyen tek
 * yol boş kâğıt.
 *
 * DÜRÜST SINIR: numara kuralı bir yazılım kısıtı DEĞİL, yazılı bir kural —
 * el yazısı kuralının kendisi gibi. Denetim yazdığını ölçebilir,
 * uygulandığını ölçemez; asıl denetim öğretmenin "yeniden aç" yolu (0056).
 *
 * -----------------------------------------------------------------------------
 * DİL: suçlamadan, öğrenmeye odaklı ("profesyonel ve pedagojik" —
 * öğretmenin isteği). Kural, NEDEN istendiğiyle birlikte veriliyor:
 * öğretmen çözüm yolunu görmek istiyor, çünkü yardımı oradan başlıyor.
 *
 * Onay SAKLANMIYOR: öğrencinin kendine verdiği söz.
 */

export const BASLIK = 'Çözümünü kendi el yazınla teslim et';

export const NEDEN =
  'Çözüm adımların, nasıl düşündüğünü ve nerede desteğe ihtiyaç duyduğunu görmemi sağlar.';

/**
 * BOŞ KÂĞITTA SORU NUMARASI (öğretmenin kararı).
 *
 * Ayrı bir sabit, çünkü iki yerde geçiyor: ikinci yolun metninde ve
 * yükleme ipucunda. Tek kaynak — iki kopya bir gün ayrışırdı.
 */
export const NUMARA_KURALI = 'her çözümün başına soru numarasını yaz';

/**
 * Üç geçerli yol, ÖNERİLEN BİRİNCİ SIRADA.
 *
 * Sıra anlamlı: ekran bu diziyi olduğu gibi çiziyor ve denetim sırayı
 * EKRANDAN okuyor. Diziyi yeniden sıralamak, öğretmenin kararını sessizce
 * geri almak olurdu.
 *
 * Cihaz adı üçüncü yolda açıkça yazılı: iPad'de kalemle çözen öğrenci
 * kuralı kendine karşı okumasın ("Bu da el yazısı sayılır").
 */
export type ElYazisiYolu = {
  baslik: string;
  metin: string;
  /** Öğretmenin önerdiği yol — ekranda ayrıca işaretleniyor. */
  onerilen?: boolean;
  /**
   * Bu yol SORU DOSYASI olmadan yürümüyor.
   *
   * Öğretmen bazı ödevlere soru dosyası eklemiyor (`odev_yolu` null).
   * O ödevde "“Soruları yazdır” ile çıktını al" demek, ekranda olmayan bir
   * düğmeyi göstermek olurdu — ekran görüntüsü alınınca görüldü.
   * `yollariSec` bu yolları ayıklıyor.
   */
  soruDosyasiGerekir?: boolean;
};

export const YOLLAR: ReadonlyArray<ElYazisiYolu> = [
  {
    baslik: 'Çıktı alınmış soru kâğıdında',
    metin:
      '“Soruları yazdır” ile çıktını al, çözümünü soruların üzerine ve altındaki ' +
      'boşluğa yap; kâğıdın net bir fotoğrafını yükle. Soru ile çözümün yan yana durur.',
    onerilen: true,
    soruDosyasiGerekir: true,
  },
  {
    baslik: 'iPad veya tablet üzerinde',
    metin:
      '“Soruları aç (PDF)” ile ödev dosyasını aç, soruların üzerine kalemle çöz; ' +
      'sayfaları kaydedip yükle. Bu da el yazısı sayılır.',
    onerilen: true,
    soruDosyasiGerekir: true,
  },
  {
    baslik: 'Boş kâğıt üzerinde',
    metin: `Yazıcın yoksa boş kâğıda çöz ve ${NUMARA_KURALI}; çözümünün net bir fotoğrafını yükle.`,
  },
];

/**
 * O ÖDEVDE GERÇEKTEN YÜRÜYEN YOLLAR.
 *
 * Öğretmen soru dosyası eklememişse (`odev_yolu` null) ne yazdırılacak
 * bir şey var ne açılacak; o ödevde yalnız boş kâğıt yolu kalıyor.
 * Üçünü birden göstermek, ekranda olmayan iki düğmeyi tarif etmek
 * olurdu — ekran görüntüsü alınınca görüldü ve düzeltildi.
 *
 * SIRA KORUNUYOR: ayıklama yapıyor, yeniden sıralamıyor.
 */
export function yollariSec(soruDosyasiVar: boolean): ReadonlyArray<ElYazisiYolu> {
  return soruDosyasiVar ? YOLLAR : YOLLAR.filter((y) => !y.soruDosyasiGerekir);
}

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
