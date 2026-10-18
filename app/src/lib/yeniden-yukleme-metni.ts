/**
 * YENİDEN AÇILAN ÖDEVDE İKİ YOL (0082) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmen gönderimi iptal ettiğinde öğrencinin önünde iki durum var ve
 * ikisi de gerçek:
 *
 *   • Çözüm sayfaları kaybolmuş, gönderilen sayfalar boştu → YENİ fotoğraf.
 *   • Fotoğraf iyiydi, cevaplar sisteme boş gitti (0056'nın olayı) →
 *     sayfaları yeniden çekmek gereksiz iş.
 *
 * Öğretmenin kararı: ÖĞRENCİ SEÇSİN. Varsayılan yeni yükleme; "önceki
 * sayfalarımı kullan" ikinci yol.
 *
 * DİL: suçlama yok. "Boş göndermiştin", "yanlış yapmıştın" gibi bir
 * hatırlatma öğrenciye durumu yeniden yaşatırdı; ekran yalnız ne
 * yapabileceğini söylüyor.
 */

export type YuklemeYolu = 'yeni' | 'onceki';

export const SECIM_BASLIGI = 'Çözüm sayfaların';

/** İki seçeneğin etiketi ve altındaki tek satırlık açıklama. */
export const YENI_ETIKET = 'Yeni fotoğraf yükle';
export const YENI_ACIKLAMA = 'Sayfaların fotoğrafını yeniden çek ve ekle.';
export const ONCEKI_ETIKET = 'Önceki sayfalarımı kullan';

/** "3 sayfa" / "1 sayfa" — sayı değişince cümle bozulmasın. */
export function sayfaAdedi(adet: number): string {
  return `${adet} sayfa`;
}

/**
 * İkinci seçeneğin açıklaması. Sayfa sayısı yazıyor ki öğrenci neyi
 * göndereceğini bilsin — "öncekiler" tek başına neyi kapsadığını söylemez.
 */
export function oncekiAciklama(adet: number): string {
  return `Önceki gönderimindeki ${sayfaAdedi(adet)} olduğu gibi gönderilir.`;
}

/** Gönderimden sonraki bildirim — hangi yolun kullanıldığını söylüyor. */
export function gonderildiMetni(yol: YuklemeYolu, adet: number): string {
  return yol === 'onceki'
    ? `Ödevin gönderildi. Önceki ${sayfaAdedi(adet)} kullanıldı.`
    : 'Ödevin gönderildi.';
}

/**
 * Öğrenci "önceki sayfalarımı kullan" derken ne gönderdiğini görebilsin
 * diye sayfa düğmelerinin başlığı: "1. sayfa", "2. sayfa"…
 */
export function oncekiSayfaEtiketi(sira: number): string {
  return `${sira}. sayfa`;
}
