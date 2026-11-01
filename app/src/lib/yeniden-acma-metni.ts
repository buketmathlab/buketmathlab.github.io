/**
 * YENİDEN AÇMANIN GEÇMİŞİ (0090) — React'siz, doğrudan test edilebilir.
 *
 * Gerçek olay: öğretmen "1. Tema Tekrarı"nda bir soruyu düzeltti ve altı
 * öğrencinin gönderimini aynı anda yeniden açtı. Önceki puanları 62.50 ile
 * 100.00 arasındaydı. Yeniden açmak gönderim satırını SİLİYOR (0081), yani
 * o altı öğrenci hem kendi ekranında hem öğretmenin listesinde hem de
 * velisinin ekranında "göndermedi" oldu.
 *
 * Öğretmenin kaygısı: "Velilere, öğrencilerin ödevlerini yapıp
 * yapmadığını belirtirken böyle bir hata varsa çok büyük haksızlık ve
 * güvensizlik oluşur."
 *
 * Hedef cümle:
 *   "Yeniden açıldı — önceki gönderim 75 puan · soruda düzeltme yapıldı
 *    · 31 Ekim 2026"
 *
 * -----------------------------------------------------------------------------
 * TEK CÜMLE ÜÇ EKRANDA
 *
 * `YUKLEME_IPUCU` dersi: aynı şey iki yerde iki türlü yazılırsa bir gün
 * ayrışır. Öğretmen, öğrenci ve veli aynı modülü çağırıyor; aralarındaki
 * TEK fark sebebin yazılıp yazılmaması ve sunucu zaten veliye sebebi
 * göndermiyor.
 *
 * -----------------------------------------------------------------------------
 * VELİYE SEBEP GİTMİYOR — ARAYÜZDE SAKLAMAKLA DEĞİL
 *
 * `sebepGoster: false` bir gizleme değil, bir SÖYLEME kararı: veliye
 * giden veride `neden` alanı HİÇ YOK (`veli_paneli` jsonb'den çıkarıyor).
 * Bayrak, alan bir gün yanlışlıkla gelse bile cümleye girmesin diye var.
 * Part XXI: GÖSTERMEDİĞİNİ GÖNDERME.
 *
 * -----------------------------------------------------------------------------
 * PUAN UYDURULMUYOR
 *
 * Açık uçlu ödev yeniden açılmadan önce puanlanmamışsa `onceki_puan` null.
 * O hâlde cümle "önceki gönderim" deyip orada bitiyor. "0 puan" yazmak
 * öğrenciyi yapmadığı bir şeyden kalmış gibi gösterirdi.
 *
 * -----------------------------------------------------------------------------
 * 0090 ÇALIŞMAMIŞ SUNUCUDA HİÇBİR ŞEY ÇİZİLMİYOR
 *
 * Alan gelmezse bütün cümleler `null` dönüyor ve üç ekran bugünkü hâlinde
 * kalıyor (Part VIII: site ve panel SQL'i birbirinin sırasına bağlı
 * olamaz).
 */

import type { YenidenAcma } from '@/types/api';
import { gunYaz } from './odev-tarihleri';

export const BASLIK = 'Yeniden açıldı';

/** Öğretmenin listesinde "göndermedi" yerine çizilen etiketin başlığı. */
export const OGRETMEN_ETIKETI = 'Yeniden açıldı — göndermesi bekleniyor';

/**
 * Veli ekranındaki açıklama. Velinin sorusu "çocuğum yapmadı mı?" ve
 * cevabı burada: yaptı, öğretmen yeniden göndermesini istedi.
 */
export const VELI_ACIKLAMASI =
  'Ödev gönderilmişti; öğretmen yeniden göndermesini istedi.';

/** Öğrenci ekranındaki açıklama — ne yapması gerektiğini söylüyor. */
export const OGRENCI_ACIKLAMASI =
  'Gönderimin öğretmenin tarafından yeniden açıldı. Çözümünü yeniden gönder.';

/**
 * "Göndermeyenler" bölümünün açıklaması.
 *
 * Bugüne kadar orada sadece "Bu öğrencilerden henüz gönderim yok."
 * yazıyordu ve YENİDEN AÇILMIŞ öğrenci için bu cümle YANLIŞTI — öğretmen
 * tam bu cümleye bakıp veliye ödevin yapılmadığını söyleyecekti.
 *
 * SAYIM DEĞİŞMİYOR, CÜMLE DEĞİŞİYOR: yeniden açılmış öğrenci listeden
 * çıkarılmıyor, çünkü gerçekten yeniden göndermesi bekleniyor ve
 * öğretmenin "göndermeyenlere ek süre ver" akışı (0084) onları hâlâ
 * kapsıyor. Listeden çıkarmak ayrı bir karar ve bu turda yok.
 */
export function gondermeyenlerAciklamasi(acilanSayisi: number): string {
  const taban = 'Bu öğrencilerden henüz gönderim yok.';
  if (acilanSayisi <= 0) return taban;
  const kim =
    acilanSayisi === 1
      ? 'Bir öğrencinin gönderimi'
      : `${acilanSayisi} öğrencinin gönderimi`;
  return `${taban} ${kim} yeniden açıldı — onlar göndermişti.`;
}

/** "75 puan" / puan yoksa `null`. */
export function oncekiPuanMetni(bilgi: YenidenAcma | null | undefined): string | null {
  const p = bilgi?.onceki_puan;
  if (p === null || p === undefined) return null;
  const sayi = typeof p === 'number' ? p : Number(p);
  if (!Number.isFinite(sayi)) return null;
  // 100.00 → "100", 62.50 → "62,5". Sunucu `numeric` döndürüyor ve
  // "62.5 puan" Türkçe bir ekranda yanlış ayraçla yazılmış olurdu.
  return `${sayi.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} puan`;
}

/**
 * "önceki gönderim 75 puan" — puan yoksa yalnız "önceki gönderim".
 *
 * Puan olmasa da bu parça yazılıyor: asıl bilgi "GÖNDERDİ" ve o, puandan
 * bağımsız.
 */
export function oncekiGonderimMetni(
  bilgi: YenidenAcma | null | undefined,
): string | null {
  if (!bilgi?.zaman) return null;
  const p = oncekiPuanMetni(bilgi);
  return p === null ? 'önceki gönderim' : `önceki gönderim ${p}`;
}

/**
 * Sebebin cümle içindeki hâli.
 *
 * Cümle "·" ile ayrılmış parçalardan kuruluyor, yani sebep CÜMLENİN
 * ORTASINDA duruyor. Bu yüzden sondaki nokta atılıyor ve ilk harf
 * küçültülüyor — öğretmenin onayladığı hedef cümle böyle:
 * "… · soruda düzeltme yapıldı · 31 Ekim 2026".
 *
 * TÜRKÇE: "İ" harfi `toLowerCase()` ile "i̇" (i + birleşen nokta) oluyor;
 * `toLocaleLowerCase('tr')` doğru harfi veriyor (0041'in dersi, orada da
 * `lower()` "İ"yi bozmuştu).
 *
 * BAŞ HARFİ KÜÇÜLTÜLMEYEN HÂL: ilk kelime tamamen büyük harfse
 * ("PDF bozuk geldi") kısaltmadır ve bozulmuyor.
 */
function sebepParcasi(neden: string | null | undefined): string | null {
  const s = (neden ?? '').trim().replace(/[.!…]+$/u, '');
  if (s === '') return null;
  const ilkKelime = s.split(/\s+/u)[0] ?? '';
  const kisaltma =
    ilkKelime.length > 1 && ilkKelime === ilkKelime.toLocaleUpperCase('tr');
  if (kisaltma) return s;
  return s.slice(0, 1).toLocaleLowerCase('tr') + s.slice(1);
}

export type SatirSecenek = {
  /**
   * Sebep cümleye girsin mi. VELİDE `false` — sunucu sebebi hiç
   * göndermiyor, bu bayrak ikinci kat.
   */
  sebepGoster: boolean;
};

/**
 * Üç ekranın tek cümlesi:
 *   "Yeniden açıldı — önceki gönderim 75 puan · soruda düzeltme yapıldı
 *    · 31 Ekim 2026"
 *
 * Velide sebep parçası yok:
 *   "Yeniden açıldı — önceki gönderim 75 puan · 31 Ekim 2026"
 *
 * Alan gelmezse (0090 çalışmamış) `null`.
 */
export function yenidenAcmaSatiri(
  bilgi: YenidenAcma | null | undefined,
  secenek: SatirSecenek,
): string | null {
  if (!bilgi?.zaman) return null;
  const parcalar: string[] = [];
  const onceki = oncekiGonderimMetni(bilgi);
  if (onceki !== null) parcalar.push(onceki);
  if (secenek.sebepGoster) {
    const s = sebepParcasi(bilgi.neden);
    if (s !== null) parcalar.push(s);
  }
  const g = gunYaz(bilgi.zaman);
  if (g !== null) parcalar.push(g);
  return parcalar.length === 0 ? BASLIK : `${BASLIK} — ${parcalar.join(' · ')}`;
}

/**
 * "Yeni son tarih: 12 Kasım 2026" — yeniden açarken verilen kişisel
 * tarih. 0056 döneminde açılmış gönderimlerde tarih yok ve `null` dönüyor
 * (`_tarihsiz_yeniden_acildi` sunucuda tam bunu ayırt ediyor).
 *
 * Öğretmenin listesinde bu cümle YAZILMIYOR: orada 0081'in `ek_sure`
 * etiketi zaten aynı tarihi söylüyor ve iki kez yazmak gürültü olurdu.
 */
export function yeniTarihMetni(bilgi: YenidenAcma | null | undefined): string | null {
  const g = gunYaz(bilgi?.yeni_son_tarih);
  return g === null ? null : `Yeni son tarih: ${g}`;
}

/**
 * Öğretmenin listesinde satırın durumu.
 *
 * `gonderdi` false iken `yeniden_acma` DOLUYSA öğrenci göndermemiş
 * değil: gönderdi ve öğretmen yeniden açtı. Panelde elle sorguladığımız
 * `yeniden-acilan-bekleyenler.sql` listesi tam bu ayrımdı; artık ekranda.
 *
 *   'bekliyor'  → yeniden açıldı, henüz yeniden göndermedi
 *   'gonderdi'  → yeniden açıldı ve yeniden gönderdi (geçmiş yine yazılıyor)
 *   null        → yeniden açılmamış; ekran bugünkü hâlinde
 */
export function ogretmenDurumu(
  gonderdi: boolean,
  bilgi: YenidenAcma | null | undefined,
): 'bekliyor' | 'gonderdi' | null {
  if (!bilgi?.zaman) return null;
  return gonderdi ? 'gonderdi' : 'bekliyor';
}
