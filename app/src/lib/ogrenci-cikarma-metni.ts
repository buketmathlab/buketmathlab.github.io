/**
 * ÖĞRENCİ ÇIKARMA EKRANININ METNİ — React'siz, doğrudan test edilebilir.
 *
 * NEDEN AYRI DOSYA: bu ekranın cümleleri bir VAAT taşıyor. "Silinmez"
 * diyoruz ve gerçekten silmiyoruz; "geri alınamaz" diyoruz ve gerçekten
 * geri alınamıyor. Bir vaadin doğruluğu ölçülebilmeli — bileşenin içine
 * gömülü bir dize ölçülemez.
 *
 * `kod-yenileme-metni.ts` ve `sinif-ozet-metni.ts` deseninin aynısı.
 */

export const BASLIK = 'Öğrenci çıkarma';

/**
 * EKRANIN NE YAPTIĞI, GİRİŞTE.
 *
 * Öğretmen bu ekrana nadiren gelecek ve geldiğinde geri alınamaz bir iş
 * yapacak. Ne olduğunu düğmeye basmadan önce bilmeli.
 */
export const ACIKLAMA =
  'Çıkarılan öğrenci listelerden düşer ve giriş kodları iptal edilir. ' +
  'Ödevleri, gönderimleri ve puanları silinmez; kayıtlarda kalır.';

/**
 * DÜRÜST SINIR — UYGULAMADA GERİ ALMA YOK.
 *
 * Bunu yazmak hoş değil ama gizlemek daha kötü olurdu: öğretmen, geri
 * alabileceğini sanarak basarsa hata onun değil ürünün olur. Kayıt
 * veritabanında duruyor, yani kurtarılabilir bir durum — ama öğretmenin
 * kendi başına yapabileceği bir iş değil ve cümle tam olarak bunu
 * söylüyor.
 */
export const GERI_ALMA_YOK =
  'Bu işlemin uygulama içinde geri alma yolu yoktur. Öğrenciyi yeniden ' +
  'eklerseniz yeni bir kayıt açılır; eski ödev geçmişi o yeni kayda ' +
  'bağlanmaz.';

export const ARAMA_ETIKETI = 'Öğrenci ara';
export const ARAMA_YERTUTUCU = 'Ad ile ara…';

export const BOS_BASLIK = 'Öğrenci bulunamadı';
export const BOS_ACIKLAMA = 'Aradığınız adla eşleşen aktif bir öğrenci yok.';

export const CIKAR_DUGMESI = 'Çıkar';
export const ONAY_DUGMESI = 'Evet, çıkar';
export const ONAY_BASLIGI = 'Öğrenci listeden çıkarılsın mı?';

/**
 * Onay metni — ADI GEÇİYOR.
 *
 * Uzun bir listede yanlış satıra basmak kolay. Onay penceresi kimin
 * çıkarılacağını adıyla söylemezse, onay bir güvence değil bir
 * formaliteye dönüşür.
 */
export function onayAciklamasi(ad: string): string {
  return (
    `${ad} listeden çıkarılacak ve giriş kodları iptal edilecek. ` +
    'Geçmiş ödevleri ve notları silinmez, kayıtlarda kalır. ' +
    'Bu işlem geri alınamaz.'
  );
}

/** İşlem bittiğinde verilen haber. */
export function basariMetni(ad: string): string {
  return `${ad} listeden çıkarıldı.`;
}

/** Ayarlar'daki kartın metni — buraya nereden gelindiğinin tek kaynağı. */
export const KART_BASLIGI = 'Öğrenci çıkarma';
export const KART_ACIKLAMASI =
  'Okuldan ayrılan ya da yanlışlıkla eklenen öğrenciyi listeden çıkarın.';
export const KART_DUGMESI = 'Çıkarma ekranını aç';
