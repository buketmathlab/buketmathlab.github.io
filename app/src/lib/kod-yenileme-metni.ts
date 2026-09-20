/**
 * "Kodumu yenile" kartının METNİ — React'siz, doğrudan test edilebilir.
 *
 * `kod-fisi.ts` deseninin aynısı ve aynı sebeple: öğretmen bir cümleyi
 * beğenmezse tek dosyada değişsin, iki ekrana dağılmış metin aranmasın.
 * Fiş metni bu yüzden altı tur düzeltildi ve her seferinde tek yerden
 * değişti.
 *
 * ÖĞRENCİ VE VELİ AYRI — tek ortak metin yazmak kolay olurdu ama veliye
 * "sen" demek olurdu. Fişte verilen kararın aynısı.
 *
 * ÜÇ CÜMLE BİLEREK BURADA VE HER BİRİNİN BİR SEBEBİ VAR:
 *
 *   1. "Eski kodun bir daha çalışmaz" — BASMADAN ÖNCE söyleniyor.
 *      Öğretmenin sorusu buydu: *"Kaydetmeleri gerektiğini hatırlatıyor
 *      değil mi?"* Geri alınamaz bir işlemi, sonucunu söylemeden
 *      yaptırmak olmaz.
 *
 *   2. "Fişindeki kod da dâhil" — kâğıt güncellenmiyor. Bunu söylememek,
 *      velinin eline aldığı kâğıda güvenip sonra şaşırması demekti.
 *
 *   3. "Not almayı unutursan öğretmenin görebiliyor" — DOĞRU olduğu için
 *      yazılıyor: `ogrenci_kodlari` (0033) kodu saklamıyor, her açılışta
 *      `giris_kodlari`'ndan okuyor; öğretmen yürürlükteki kodu her zaman
 *      görüyor. Panik önleyici bir cümle, ve boş bir teselli değil.
 */

export type YenilemeTuru = 'ogrenci' | 'veli';

export type YenilemeMetni = {
  /** Kartın başlığı. */
  baslik: string;
  /** Kartın açıklaması — düğmeye basmadan önce okunan. */
  aciklama: string;
  /** Düğme. */
  dugme: string;
  /** Onay penceresinin başlığı. */
  onayBasligi: string;
  /**
   * Onay penceresindeki uyarılar. Dizi, çünkü ekranda madde madde
   * çiziliyor ve testte tek tek aranabiliyor.
   */
  onayUyarilari: readonly string[];
  /** Onay penceresinin "evet" düğmesi. */
  onayDugmesi: string;
  /** Sonuç penceresinin başlığı — yeni kodun üstünde. */
  sonucBasligi: string;
  /** Sonuç penceresindeki hatırlatmalar. */
  sonucNotlari: readonly string[];
  /** Sonucu kapatan düğme. */
  kapatDugmesi: string;
};

const OGRENCI: YenilemeMetni = {
  baslik: 'Giriş kodun',
  aciklama: 'Kodunu başkası öğrendiyse yenileyebilirsin.',
  dugme: 'Kodumu yenile',
  onayBasligi: 'Yeni kod alınsın mı?',
  onayUyarilari: [
    'Eski kodun o anda çalışmaz olur — fişindeki kod da dâhil.',
    'Bu kodla başka bir telefondan girilmişse o giriş kapanır.',
    'Yeni kodu bir yere not et.',
  ],
  onayDugmesi: 'Yeni kod al',
  sonucBasligi: 'Yeni kodun',
  sonucNotlari: [
    'Bunu bir yere not et. Eski kodun artık çalışmıyor.',
    'Not almayı unutursan öğretmenin görebiliyor.',
  ],
  kapatDugmesi: 'Tamam, not ettim',
};

const VELI: YenilemeMetni = {
  baslik: 'Giriş kodunuz',
  aciklama: 'Kodunuzu başkası öğrendiyse yenileyebilirsiniz.',
  dugme: 'Kodumu yenile',
  onayBasligi: 'Yeni kod alınsın mı?',
  onayUyarilari: [
    'Eski kodunuz o anda çalışmaz olur — fişteki kod da dâhil.',
    'Bu kodla başka bir telefondan girilmişse o giriş kapanır.',
    'Yeni kodu bir yere not edin.',
  ],
  onayDugmesi: 'Yeni kod al',
  sonucBasligi: 'Yeni kodunuz',
  sonucNotlari: [
    'Bunu bir yere not edin. Eski kodunuz artık çalışmıyor.',
    'Not almayı unutursanız öğretmeniniz görebiliyor.',
  ],
  kapatDugmesi: 'Tamam, not ettim',
};

export function yenilemeMetni(tur: YenilemeTuru): YenilemeMetni {
  return tur === 'ogrenci' ? OGRENCI : VELI;
}
