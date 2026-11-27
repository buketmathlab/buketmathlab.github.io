/**
 * VELİ ÇİZELGESİNİN METNİ (0091) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: *"Veli toplantısı var... 1 A4'e 2 öğrenci olsun.
 * Öğrenciyle ilgili sistemdeki tüm veriler yazmalı. Hangi ödev ne zaman
 * verilmiş. Kaç tanesini yapmış yapmamış. Kaç puan almış. O ödevde
 * sınıfının ortalaması kaçmış, o düzeydeki tüm sınıfların ortalaması
 * kaçmış. En çok eksik olduğu konular yazsın."*
 *
 * -----------------------------------------------------------------------------
 * VELİ FİŞİ ZATEN VARDI — BU ONUN AYRINTILI HÂLİ
 *
 * `sinif-yazdirma-metni.ts` (0053) kesilip veliye verilen bir fiş
 * basıyordu: ad, ödev sayıları, iki ortalama, eksik konular. Eksik olan
 * tek şey ÖDEV LİSTESİYDİ. Bu modül onu ekliyor; fişin kendisi duruyor
 * ve öğretmen hangisini basacağını seçiyor.
 *
 * -----------------------------------------------------------------------------
 * DİL — `karne-sozu.ts`İN KURALLARI
 *
 * Çocuğu değil İŞİ işaret ediyor. Sıralama yok. "Yükseliyor / düşüyor"
 * iddiası yok: birkaç ödevden yön çıkarmak ölçemeyeceğimiz bir iddia
 * olurdu ve yanlışsa bir çocuk hakkında yanlış bir cümle kurulmuş olur.
 * `karne-sozu.ts`in `YASAKLI_KELIMELER` listesi burada da ölçülüyor.
 *
 * KIYAS BU MODÜLDE SERBEST — ve bu bir çelişki değil. `karne-sozu.ts`
 * sıralamayı ve "sınıfın" lafını yasaklıyor, çünkü o cümle ÇOCUĞA
 * sesleniyor. Buradaki kıyas öğretmenin açık kararı ("Görünsün") ve
 * 0047'de veli paneline verdiği kararın aynısı: ödev BAZINDA, İSİMSİZ,
 * sıralamasız bir ortalama.
 *
 * -----------------------------------------------------------------------------
 * UYDURMA YOK
 *
 * Gelmeyen her sayı "—" ile yazılıyor, sıfırla değil. Göndermediği bir
 * ödevi "0 puan" diye yazmak, çocuğu yapmadığı bir sınavdan kalmış gibi
 * gösterirdi (`veli_paneli`in "yapılmayan ödevler puanlandırılmaz"
 * kuralı). Süresi dolmamış ödev de "göndermedi" DEĞİL.
 */

import type { CizelgeDurumu, OdevKiyasi, OdevTarihleri } from '@/types/api';

export const CIZELGE_BASLIGI = 'Ödev çizelgesi';
export const YAZDIR_CIZELGE = 'Veli çizelgelerini yazdır';

/** Tablo başlıkları — tek yerde, kâğıtta ve ekranda aynı. */
export const SUTUNLAR = {
  verilis: 'Verildi',
  sonTarih: 'Son teslim',
  odev: 'Ödev',
  durum: 'Durum',
  puan: 'Puanı',
  sinif: 'Sınıf ort.',
  seviye: 'Düzey ort.',
} as const;

const GUN = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/**
 * `YYYY-AA-GG` ya da ISO zaman → "19 Eki". Okunamazsa `null`.
 *
 * Yalnız gün verilmişse yerel gece yarısı kuruluyor:
 * `new Date('2026-10-19')` UTC okunur ve Türkiye'de bir gün geriye
 * kayabilirdi (`odev-tarihleri.ts`in aynı gerekçesi).
 */
export function kisaGun(deger: string | null | undefined): string | null {
  if (!deger) return null;
  const d = new Date(deger.length === 10 ? `${deger}T00:00:00` : deger);
  return Number.isNaN(d.getTime()) ? null : GUN.format(d);
}

/**
 * Ödevin VERİLİŞ günü.
 *
 * 0091 çalıştırılmadıysa `tarihler` hiç gelmiyor ve bu "—" dönüyor:
 * `created_at` TASLAĞIN açıldığı an, veriliş tarihi değil. Uydurmaktansa
 * boş bırakmak doğru (Part VIII).
 */
export function verilisGunu(t: OdevTarihleri | null | undefined): string {
  return kisaGun(t?.verilis) ?? '—';
}

/** Hücredeki durumun insan dili. */
export function durumYazisi(durum: CizelgeDurumu | null | undefined): string {
  switch (durum) {
    case 'gonderdi':
      return 'Gönderildi';
    case 'gondermedi':
      return 'Gönderilmedi';
    // SÜRESİ DOLMAMIŞ ÖDEV "GÖNDERİLMEDİ" DEĞİL. Veliye bugün açık olan
    // bir ödev için "yapmadı" demek haksızlık olurdu.
    case 'suresi_devam':
      return 'Süresi sürüyor';
    // 0064: öğrenci sınıfa bu ödevden SONRA gelmiş. Gelmediği tarihteki
    // ödevden sorumlu tutulamaz.
    case 'kapsam_disi':
      return 'Sınıfa sonra katıldı';
    default:
      return '—';
  }
}

/** "75" / puan yoksa "—". Göndermediği ödev 0 YAZILMIYOR. */
export function puanYazisi(puan: number | string | null | undefined): string {
  if (puan === null || puan === undefined || puan === '') return '—';
  const n = typeof puan === 'number' ? puan : Number(puan);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

/**
 * Ödev başına sınıf ortalaması.
 *
 * `_odev_kiyasi`in kapıları burada da görünüyor: süresi dolmamış ödevde,
 * çalışma kağıdında ve özel derste kıyas YOK ve "—" yazılıyor.
 */
export function sinifOrtalamasi(k: OdevKiyasi | null | undefined): string {
  if (!k || k.durum !== 'hazir') return '—';
  return puanYazisi(k.sinif?.ortalama ?? null);
}

/**
 * Düzey (tüm şubeler) ortalaması.
 *
 * Ödev tek şubeye verilmişse sunucu bu alanı null döndürüyor —
 * öğretmenin kuralı: *"diğer şubelere verilmemişse sadece ödevin
 * verildiği sınıf ortalaması alınsın."* O hâlde "—" yazılıyor.
 */
export function seviyeOrtalamasi(k: OdevKiyasi | null | undefined): string {
  if (!k || k.durum !== 'hazir' || !k.seviye) return '—';
  return puanYazisi(k.seviye.ortalama ?? null);
}

/** Düzey sütununun başlığı: "9. sınıflar" varsa onu yazıyor. */
export function seviyeBasligi(kiyaslar: readonly (OdevKiyasi | null | undefined)[]): string {
  for (const k of kiyaslar) {
    if (k && k.durum === 'hazir' && k.seviye?.ad) return k.seviye.ad;
  }
  return SUTUNLAR.seviye;
}

/**
 * Gecikmeli teslim işareti — puanın yanında, onun YERİNE değil.
 *
 * 0081'in kararının kâğıt hâli: ek süre gecikme damgasını silmiyor,
 * yanında duruyor. Kayıt dürüst kalıyor.
 */
export function gecikmeIsareti(gecikmeli: boolean | null | undefined): string | null {
  return gecikmeli === true ? 'gecikmeli' : null;
}

/**
 * Hangi soruların yanlış ve boş olduğu — YALNIZ NUMARA (Kural 6).
 *
 * Şık da cevap anahtarı da yok; sunucu da göndermiyor. Numara "hangi
 * soruda takıldı" der, şık göndermek anahtara doğru bir adım olurdu.
 * Boş liste gelirse satır hiç çizilmiyor.
 */
export function soruDokumu(
  yanlis: readonly number[] | null | undefined,
  bos: readonly number[] | null | undefined,
): string | null {
  const parcalar: string[] = [];
  if (yanlis && yanlis.length > 0) parcalar.push(`yanlış: ${yanlis.join(', ')}`);
  if (bos && bos.length > 0) parcalar.push(`boş: ${bos.join(', ')}`);
  return parcalar.length === 0 ? null : parcalar.join(' · ');
}

/**
 * Çizelgenin alt notu — kâğıt tek başına kaldığında da neyi anlattığı
 * belli olsun.
 */
export function cizelgeAltNotu(sinifAdi: string, an: Date): string {
  const t = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(an);
  return `${sinifAdi} · ${t} tarihinde hazırlandı.`;
}

export const CIZELGE_NOTU =
  'Sınıf ve düzey ortalamaları isimsizdir; hangi öğrencinin kaç aldığı '
  + 'yazmaz. Süresi dolmamış ödevler henüz değerlendirmeye girmez. '
  + 'Çalışma kağıtları puanlanmaz.';

/**
 * Bir yarım A4'e kaç ödev satırı sığıyor.
 *
 * Yirmi ödevi yarım A4'e sığdırmak mümkün değil. Sessizce kırpmak yerine
 * çizelge bir sonraki yarıma taşıyor.
 *
 * SAYI GERÇEKTEN ÖLÇÜLDÜ — ve ilk yazımda 12 YAZIYORDU. O rakam tahmindi
 * ve yorumunda "ölçüldü" yazıyordu; `veli-cizelgesi-denetimi.mjs`in A4
 * ölçümü 12 satırda iki çizelgenin 323,1 mm tuttuğunu, yani A4'ü 46 mm
 * AŞTIĞINI gösterdi. İki ölçümden (8 satır → 271,6 mm; 12 satır →
 * 323,1 mm) türetilen gerçek rakamlar:
 *
 *   satır başına        6,44 mm
 *   çizelgenin sabiti  82,8 mm  (antet, ad, özet, tablo başlığı, notlar)
 *   yarım başına bütçe 137 mm   ((277 − 3) / 2)
 *   → sığan satır      (137 − 82,8) / 6,44 ≈ 8,4
 *
 * 8 seçiliyor: 8,4'ün üstüne çıkmak kâğıtta sessiz bir taşma demek ve bu
 * kâğıt veliye gidiyor. Denetim en kötü hâli (tam 8 satır) ölçüyor.
 *
 * SONUCU: ödev sayısı 8'i geçen sınıfta bir öğrencinin çizelgesi birden
 * çok yarıma taşıyor, yani A4 başına iki öğrenci garantisi yalnız
 * 8 ödeve kadar geçerli. Bu, gizlenecek değil SÖYLENECEK bir sınır.
 */
export const YARIMA_SIGAN_SATIR = 8;

export function parcalaraBol<T>(satirlar: readonly T[]): T[][] {
  if (satirlar.length === 0) return [[]];
  const parcalar: T[][] = [];
  for (let i = 0; i < satirlar.length; i += YARIMA_SIGAN_SATIR) {
    parcalar.push(satirlar.slice(i, i + YARIMA_SIGAN_SATIR));
  }
  return parcalar;
}

/** İkinci ve sonraki yarımların başlığı — kâğıt karışmasın. */
export function devamBasligi(ad: string, sira: number, toplam: number): string {
  return toplam <= 1 ? ad : `${ad} — ${sira}/${toplam}`;
}
