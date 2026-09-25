/**
 * BİLDİRİM CÜMLELERİ — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: *"her mesajda, ödev verildiğinde, ödev teslimi
 * yaklaştığında, ödev sonucu açıklandığında öğrenciye bildirim gitsin."*
 *
 * -----------------------------------------------------------------------------
 * `zamanYazisi` BURADA YENİDEN YAZILMIYOR
 *
 * 0048'de `mesaj-listesi-metni.ts`'te yazıldı ve takvim günü inceliğini
 * (bu sabah 01:00 "bugün", dün 23:00 "dün") orada çözdük. İkinci bir
 * kopya, iki listenin aynı anı iki farklı cümleyle yazması demekti.
 *
 * -----------------------------------------------------------------------------
 * İKİ SES: ÖĞRENCİYE "SEN", VELİYE "SİZ"
 *
 * Aynı olay iki kişiye farklı cümleyle söyleniyor. "Öğretmeninden yeni
 * mesaj" ile "Öğretmeninizden yeni mesaj" arasındaki fark küçük görünür
 * ama veliye çocuk diliyle yazmak ürünün ciddiyetini düşürür.
 *
 * -----------------------------------------------------------------------------
 * ÜRÜN DİLİ: ÖVGÜ YOK, GEREKÇE YOK, ETİKET YOK
 *
 * Hiçbir cümle çocuğu nitelemiyor ve hiçbir cümle "acele et" demiyor.
 * `bildirim-metni.test.ts` bunu `yasakKaliplariBul` ile ölçüyor.
 */
import { zamanYazisi } from './mesaj-listesi-metni';

export type BildirimTuru = 'mesaj' | 'odev' | 'teslim' | 'sonuc';
export type BildirimRolu = 'ogrenci' | 'veli';

export type BildirimSatiriMetni = {
  tur: BildirimTuru;
  baslik: string | null;
};

/**
 * ÖDEV ADI OLMAYAN SATIR.
 *
 * `baslik` sunucudan boş gelebilir (mesaj satırlarında zaten null).
 * Cümle "Yeni ödev: " diye yarım bitmesin diye bu sözcük konuyor.
 */
const ADSIZ_ODEV = 'Ödev';

function odevAdi(baslik: string | null): string {
  const t = (baslik ?? '').trim();
  return t === '' ? ADSIZ_ODEV : t;
}

/**
 * Bildirim satırının cümlesi.
 *
 * TESLİM CÜMLESİ EMİR KİPİNDE DEĞİL: "Köklü Sayılar ödevinin teslimi
 * yarın" — "yetiştir", "acele et" ya da "unutma" demiyor. Öğretmenin dil
 * kuralı: gerçeği söyle, baskı kurma.
 *
 * SONUÇ CÜMLESİ PUANI SÖYLEMİYOR: "değerlendirildi". Puanı bildirim
 * satırında yazmak, listeye göz atan herkesin (aynı telefona bakan bir
 * kardeşin) onu görmesi demekti; öğrenci puanı ödevin kendi ekranında
 * görüyor.
 */
export function bildirimMetni(satir: BildirimSatiriMetni, rol: BildirimRolu): string {
  const ad = odevAdi(satir.baslik);
  switch (satir.tur) {
    case 'mesaj':
      return rol === 'veli' ? 'Öğretmeninizden yeni mesaj' : 'Öğretmeninden yeni mesaj';
    case 'odev':
      return `Yeni ödev: ${ad}`;
    case 'teslim':
      return `${ad} ödevinin teslimi yarın`;
    case 'sonuc':
      return `${ad} değerlendirildi`;
  }
}

/** Satırın sağındaki göreli zaman — 0048'in yazısı, ikinci kopya yok. */
export function bildirimZamani(zaman: string | null | undefined, simdi?: Date): string {
  return simdi ? zamanYazisi(zaman, simdi) : zamanYazisi(zaman);
}

export const SAYFA_BASLIGI = 'Bildirimler';

/**
 * BOŞ DURUM — BEKLENTİ YARATMIYOR.
 *
 * "Henüz bildirim yok" yeterli; "yakında gelecek" demek ürünün
 * veremeyeceği bir söz olurdu.
 */
export const BOS_BASLIK = 'Henüz bildirim yok';
export const BOS_ACIKLAMA =
  'Yeni ödev, mesaj ve değerlendirme sonuçları burada görünür.';

/**
 * ZİLİN ERİŞİLEBİLİRLİK ADI.
 *
 * Rozet bir sayı çiziyor ama ekran okuyucu için sayı tek başına
 * anlamsız; ad sayıyı da taşıyor.
 */
export function zilEtiketi(yeni: number): string {
  return yeni > 0 ? `Bildirimler — ${yeni} yeni` : 'Bildirimler';
}

/**
 * LİSTENİN ALTINDAKİ DÜRÜST SINIR.
 *
 * Uygulama içi bildirim, uygulama açılmadıkça görünmez. Bunu yazmamak,
 * öğrencinin "bana haber gelir" diye beklemesine yol açardı. Telefon
 * bildirimi ayrı bir iş ve bugün yok.
 */
export const SINIR_NOTU =
  'Bildirimler uygulamayı açtığınızda görünür; telefona ayrıca bildirim gönderilmez.';

/** Listenin kapsadığı süre — sunucudaki 30 günlük sınırın karşılığı. */
export const KAPSAM_NOTU = 'Son 30 günün bildirimleri listelenir.';
