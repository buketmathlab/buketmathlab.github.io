/**
 * ÖDEVİN TARİHLERİ (0085) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: "Ödevleri verdiğim tarih de ödevin üzerinde yazsın
 * geriye dönüp baktığımda. Yani VERİLİŞ TARİHİ ve SON TESLİM TARİHİ
 * yazsın. Eğer teslim tarihinde UZATMA yaptıysam o ekstra belirtilsin."
 *
 * Kararları: tarihleri öğrenci ve veli de görsün; hem ödev sayfasında hem
 * listede yazsın. Dört ekranın hepsi bu modülü kullanıyor — biri
 * "uzatıldı" derken öbürü susamaz.
 *
 * -----------------------------------------------------------------------------
 * ÖNE ALMA DA YAZILIYOR
 *
 * Sunucu `yon` alanında iki yön döndürüyor. Yalnız uzatmayı yazmak,
 * öğrencinin elindeki sürenin sessizce kısaldığı tek durum olurdu.
 * Ekranda ikisi de var.
 *
 * -----------------------------------------------------------------------------
 * 0085 ÇALIŞMAMIŞ SUNUCUDA HİÇBİR ŞEY ÇİZİLMİYOR
 *
 * `tarihler` alanı gelmezse (panelde SQL henüz çalışmadıysa) bu modülün
 * cümleleri `null` dönüyor ve ekran bugünkü hâlinde kalıyor. Tarih
 * UYDURULMUYOR: `created_at` ile veriliş tarihi aynı şey değil ve ikisini
 * karıştırmak öğretmene yanlış bir gün söylemek olurdu.
 */

import type { OdevTarihleri } from '@/types/api';

const GUN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** `YYYY-MM-DD` ya da ISO zaman → "19 Ekim 2026". Okunamazsa `null`. */
export function gunYaz(deger: string | null | undefined): string | null {
  if (!deger) return null;
  // Yalnız gün verilmişse yerel gece yarısı: `new Date('2026-10-19')` UTC
  // okunur ve Türkiye'de bir gün geriye kayabilirdi.
  const d = new Date(deger.length === 10 ? `${deger}T00:00:00` : deger);
  return Number.isNaN(d.getTime()) ? null : GUN.format(d);
}

export const VERILIS_ETIKETI = 'Verildi';
export const SON_TESLIM_ETIKETI = 'Son teslim';

/** "Verildi: 19 Ekim 2026" — taslakta (veriliş yok) `null`. */
export function verilisMetni(t: OdevTarihleri | null | undefined): string | null {
  const g = gunYaz(t?.verilis);
  return g === null ? null : `${VERILIS_ETIKETI}: ${g}`;
}

/** "Son teslim: 5 Kasım 2026". `yedek`: 0085 çalışmamışsa ödevin kendi tarihi. */
export function sonTeslimMetni(
  t: OdevTarihleri | null | undefined,
  yedek?: string | null,
): string | null {
  const g = gunYaz(t?.son_tarih ?? yedek);
  return g === null ? null : `${SON_TESLIM_ETIKETI}: ${g}`;
}

/**
 * Liste kartının tek satırı: "Verildi: 19 Ekim 2026 · Son teslim: 5 Kasım 2026".
 *
 * Taslakta yalnız son teslim yazılıyor. `tarihler` hiç gelmezse `yedek`
 * ile yine son teslim yazılıyor — liste bugünkü hâlinden geriye gitmiyor.
 */
export function tarihSatiri(
  t: OdevTarihleri | null | undefined,
  yedek?: string | null,
): string | null {
  const parcalar = [verilisMetni(t), sonTeslimMetni(t, yedek)].filter(
    (p): p is string => p !== null,
  );
  return parcalar.length === 0 ? null : parcalar.join(' · ');
}

/** Listedeki kısa işaret: "uzatıldı" / "öne alındı". Değişmemişse `null`. */
export function uzatmaEtiketi(t: OdevTarihleri | null | undefined): string | null {
  if (t?.yon === 'uzatildi') return 'uzatıldı';
  if (t?.yon === 'one_alindi') return 'öne alındı';
  return null;
}

/**
 * Ödev sayfasındaki tam cümle:
 * "Son teslim tarihi uzatıldı: 1 Kasım 2026 → 5 Kasım 2026".
 *
 * Birden fazla kez değiştiyse kaç kez olduğu da yazılıyor; ilk tarih yine
 * İLK olanıdır (ara tarih değil), sunucu öyle döndürüyor.
 */
export function uzatmaMetni(t: OdevTarihleri | null | undefined): string | null {
  const etiket = uzatmaEtiketi(t);
  if (etiket === null) return null;
  const ilk = gunYaz(t?.ilk_son_tarih);
  const son = gunYaz(t?.son_tarih);
  if (ilk === null || son === null) return null;
  const kez = (t?.degisiklik ?? 0) > 1 ? ` (${t?.degisiklik} kez değiştirildi)` : '';
  return `Son teslim tarihi ${etiket}: ${ilk} → ${son}${kez}`;
}
