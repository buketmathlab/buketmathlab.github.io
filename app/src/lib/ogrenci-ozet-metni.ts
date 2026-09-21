import type { EwaluPoz } from '@/components/brand/ewalu';

/**
 * Öğrenci panosunun ve Ödevlerim ekranının ÜST SATIRI — cümle ve Ewalu pozu.
 *
 * `kod-fisi.ts` / `kod-yenileme-metni.ts` deseninin aynısı: React'siz metin,
 * tek kaynak, doğrudan test edilebilir.
 *
 * -----------------------------------------------------------------------------
 * NEDEN VAR: TEK KOŞUL İKİ AYRI DURUMU ANLATIYORDU
 *
 * Önceki hâlinde ekran `bekleyen === 0` diye tek bir soru soruyordu ve o
 * soru İKİ bambaşka durumu aynı kutuya koyuyordu:
 *
 *   1. Öğretmen henüz hiç ödev yayınlamadı.
 *   2. Öğrenci bütün ödevlerini gönderdi.
 *
 * İkisine de "Bekleyen ödevin yok. Eline sağlık." yazıyordu. Yani hiç ödev
 * verilmemiş bir öğrenci, HİÇBİR ŞEY YAPMADAN tebrik ediliyordu — üstelik
 * yanında kolunu havaya kaldırmış kutlayan bir ayıyla.
 *
 * Öğretmenin sözü: *"Eline sağlık cümlesine gerek yok. Daha pedagojik, daha
 * profesyonel bir şey yazabilirsiniz."* Kararı da onun: durum ikiye ayrıldı.
 *
 * -----------------------------------------------------------------------------
 * POZ CÜMLEYLE AYNI YERDEN GELİYOR — ve bu bilinçli
 *
 * Kusur tam olarak şuradan doğmuştu: cümle bir koşulda, poz bir satır
 * yukarıda AYRI bir koşulda duruyordu. İkisi ayrışabildiği için ayrıştı.
 * Artık tek fonksiyon ikisini birlikte döndürüyor; test de ikisini birlikte
 * ölçüyor, tarayıcı denetimi de.
 *
 * `kesif` uydurulmuş bir seçim değil: `components/brand/ewalu.ts` o pozun
 * yerini zaten "Boş durumlar — henüz ödev yok, henüz mesaj yok" diye
 * tanımlıyor. Katalog doğru pozu söylüyordu, ekran onu kullanmıyordu.
 *
 * `kutlama` ise artık bir İŞİN karşılığı: öğrencinin gerçekten gönderdiği
 * ödevler var ve hepsi gönderilmiş. Ewalu'nun kimliği öğretmenindir
 * (Kural 9); bu eşleme onun bu turdaki kararı.
 *
 * -----------------------------------------------------------------------------
 * ÜÇÜNCÜ CÜMLE DEĞİŞMEDİ
 *
 * "N ödevin seni bekliyor." olduğu gibi duruyor: öğretmen ondan şikâyet
 * etmedi, ne övgü ne gerekçe taşıyor, yalnız sayıyı söylüyor. Bu turda
 * yalnız kusurlu olan değişti.
 */

export type OgrenciOzeti = {
  /** Başlığın (Merhaba <ad> / Ödevlerim) hemen altındaki tek cümle. */
  cumle: string;
  /** Aynı satırdaki Ewalu pozu. */
  poz: EwaluPoz;
};

/**
 * @param odevSayisi öğrenciye görünen TÜM ödevlerin sayısı
 * @param bekleyen   gönderilmemiş ve hâlâ gönderilebilir olanların sayısı
 *
 * Sıra önemli: "hiç ödev yok" sorusu ÖNCE soruluyor. Tersi olsaydı sıfır
 * ödevli öğrenci yine `bekleyen === 0` dalına düşer ve düzeltilen kusur
 * aynen geri gelirdi.
 *
 * Negatif ya da kesirli sayı gelmesi beklenmiyor (ikisi de bir dizinin
 * `length`'i) ama savunmasız okumuyoruz: aşağıdaki karşılaştırmalar
 * `<= 0` ile yazıldığı için bozuk bir değer ekranı boş bırakmaz.
 */
export function ogrenciOzeti(odevSayisi: number, bekleyen: number): OgrenciOzeti {
  if (odevSayisi <= 0) {
    return { cumle: 'Henüz ödev yayınlanmadı.', poz: 'kesif' };
  }
  if (bekleyen <= 0) {
    return { cumle: 'Bütün ödevlerini gönderdin.', poz: 'kutlama' };
  }
  return { cumle: `${bekleyen} ödevin seni bekliyor.`, poz: 'calisma' };
}
