import type { KonuAnalizi } from '@/types/api';

/**
 * Konu karnesinin başındaki TEK cümle.
 *
 * -----------------------------------------------------------------------------
 * CÜMLELER ÖĞRETMENİNDİR — BUNLAR BENİM TASLAĞIM
 *
 * `lib/ewalu-puan.ts`'te olduğu gibi hepsi TEK DOSYADA duruyor; beğenilmezse
 * tek yerden değiştirilir. O turda da taslak yazmış, öğretmen iki cümlemi
 * düzeltmişti (Kural 9: Ewalu'nun kimliği ona ait).
 *
 * -----------------------------------------------------------------------------
 * ÜÇ CÜMLENİN ÜÇÜNDE DE OLMAYAN ŞEYLER — ve nedenleri
 *
 * KIYAS YOK. Ne sınıf ortalaması ne sıralama. Sunucu zaten göndermiyor
 * (`kendi_karnem` sınıf mevcudunu bile taşımıyor); cümle de o kapıyı
 * açmıyor.
 *
 * EĞİLİM İDDİASI YOK. Ne "yükseliyorsun" ne "düşüyorsun". Birkaç ödevden
 * yön çıkarmak ölçemeyeceğim bir iddia olurdu ve o iddia yanlışsa bir
 * çocuk hakkında yanlış bir cümle kurulmuş olur (`Gelisim` bileşeninin
 * taşıdığı aynı kural).
 *
 * ÇOCUĞU DEĞİL İŞİ İŞARET EDİYOR. "Takılmışsın" var, "zayıfsın" yok:
 * biri görevi, öbürü çocuğu tarif eder. `ewalu-puan.ts`'te 0–49 bandında
 * verilen aynı karar.
 *
 * HER CÜMLE BİR SONRAKİ ADIMLA BİTİYOR.
 */

export type KarneSozu = {
  /** Öğrenciye "sen" diye seslenen hâli. */
  ogrenci: string;
  /** Veliye üçüncü tekille anlatan hâli. */
  veli: string;
};

/** Cümlede kıyas ya da eğilim çağrıştıran kelime bulunmamalı (testte ölçülüyor). */
export const YASAKLI_KELIMELER = [
  'ortalama',
  'sıralama',
  'sınıfın',
  'yükseliyor',
  'düşüyor',
  'geriledi',
  'zayıfsın',
  'başarısız',
];

/**
 * Karnenin durumuna göre cümleyi seçer.
 *
 * @param konular  sunucudan gelen konu dökümü (en zayıf başta)
 * @param odevSayisi değerlendirilmiş ödev sayısı
 */
export function karneSozu(konular: KonuAnalizi[], odevSayisi: number): KarneSozu {
  // HENÜZ VERİ YOK. Okullar açılmadan bu ekranların çoğu böyle görünecek.
  // "Eksiğin yok" demek yanlış olurdu — ölçülmüş bir şey yok, o kadar.
  if (odevSayisi === 0 || konular.length === 0) {
    return {
      ogrenci:
        'Henüz değerlendirilmiş ödevin yok. İlk ödevinden sonra burada ne çalışacağını birlikte göreceğiz.',
      veli:
        'Henüz değerlendirilmiş ödev yok. İlk ödevden sonra hangi konulara çalışılacağı burada görünecek.',
    };
  }

  const eksikOlanlar = konular.filter((k) => k.dogru < k.toplam);

  if (eksikOlanlar.length === 0) {
    return {
      ogrenci: 'Bütün konularda tamsın. Bunu sürdürmek de bir iş.',
      veli: 'Bütün konularda tam. Bu tabloyu sürdürmek de bir iş.',
    };
  }

  // SUNUCUNUN SIRASI BOZULMUYOR: en çok eksik olan konu zaten ilk sırada.
  // Burada yeniden sıralasaydık "en zayıf konu" iddiası ekranın kendi
  // listesiyle çelişebilirdi.
  const enZayif = eksikOlanlar[0]!.konu;

  return {
    ogrenci: `En çok ${enZayif} konusunda takılmışsın. Oradan başlayalım.`,
    veli: `En çok ${enZayif} konusunda takılmış. Çalışmaya oradan başlanabilir.`,
  };
}
