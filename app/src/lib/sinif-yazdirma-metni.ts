/**
 * SINIF ÇIKTISININ METNİ — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: *"Öğrenciler sekmesinde sınıflara tıkladığımda çıkan
 * öğrenci listesi yazdırılabilir olsun istediğim zaman. Okulun adı …
 * olarak ve yazdırdığım tarih olsun çıktıda. Veli toplantı zamanlarında
 * bu çıktıyı aldığında öğrencinin yaptığı yapmadığı ödevler…"*
 *
 * Kâğıt, ekrandan farklı bir sorumluluk taşıyor: elden ele geçiyor,
 * saklanıyor ve söylediği şey sonradan düzeltilemiyor. Bu yüzden
 * cümleleri ayrı bir dosyada ve ölçülü.
 */

/**
 * OKULUN ADI.
 *
 * Öğretmenin yazdığı hâl — giriş ekranındakiyle aynı
 * (`GirisEkrani.tsx`). `SchoolCrest.tsx`'teki `TAM_AD` BİLEREK
 * kullanılmıyor: o dize "Beşiktaş" ile başlıyor ve armanın kendi
 * erişilebilirlik metni; Kural 8 gereği armaya dokunulmuyor. İki ayrı
 * dize, iki ayrı iş.
 */
export const OKUL_ADI = 'Arnavutköy Korkmaz Yiğit Anadolu Lisesi';

/** Çıktının iki bölümü. */
export const LISTE_BASLIGI = 'Sınıf ödev durumu';
export const FIS_BASLIGI = 'Veli bilgi fişi';

export const SAYFA_BASLIGI = 'Yazdır';
export const SAYFA_ACIKLAMASI =
  'Sınıf listesi sizin kullanımınız için; veli fişleri kesilip ailelere verilmek üzere.';

export const GERI = '← Sınıf';

/**
 * TARİH — çıktının üstünde.
 *
 * Öğretmenin isteği: *"yazdırdığım tarih olsun çıktıda."* Sayılar her gün
 * değişiyor; tarihi olmayan bir kâğıt bir ay sonra hangi güne ait
 * olduğunu söylemez.
 *
 * SAAT DE YAZILIYOR: aynı gün içinde ödev teslim edilince sayılar
 * değişiyor. Sabah alınan çıktı ile akşam alınan çıktı farklıysa hangisi
 * daha yeni, kâğıdın kendisi söylesin.
 */
const BICIM = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

export function tarihYazisi(an: Date): string {
  return BICIM.format(an);
}

/**
 * ÖDEV SAYILARI — kâğıtta tam cümleyle.
 *
 * Ekranda "6 ödev · 4 yapıldı · 2 yapılmadı" yeterli, çünkü başlıklar
 * yanında. Kâğıt tek başına okunuyor: veli bu fişi eve götürüp bir hafta
 * sonra bakabilir, o yüzden "verilen" kelimesi yazılı.
 */
export function odevSayilariYazisi(
  verilen: number,
  yapilan: number,
  yapilmayan: number,
): string {
  return `Verilen ödev: ${verilen} · Yapılan: ${yapilan} · Yapılmayan: ${yapilmayan}`;
}

/**
 * ORTALAMA — kâğıtta etiketiyle.
 *
 * `null` (süresi dolmuş hiç ödev yok) ekrandaki cümlenin aynısını
 * söylüyor; sıfır YAZILMIYOR. Dönem başında her fişe "0,0" basmak,
 * henüz ödev vermediğimiz için çocuğu başarısız göstermek olurdu.
 */
export function ortalamaSatiri(ortalama: number | null): string {
  if (ortalama === null || Number.isNaN(ortalama)) return 'Ortalama: henüz ödev yok';
  const sayi = ortalama.toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `Ortalama: ${sayi}`;
}

export const KONU_BASLIGI = 'Üzerinde çalışılacak konular';

/**
 * KONU BAŞLIKLARI — öğretmenin isteği, çoğul.
 *
 * Liste boşken CÜMLE KURULMUYOR, çünkü boşluğun iki ayrı sebebi var ve
 * kâğıt ikisini ayırt edemiyor: o öğrencinin henüz 5 soruluk birikimi
 * olan bir konusu yoktur ya da yanlışı yoktur. Hangisini yazsak
 * öğrencilerin bir kısmı için yanlış olurdu.
 *
 * BAŞLIK BİR EKSİK ETİKETİ DEĞİL: "üzerinde çalışılacak konular" —
 * veliye verilen kâğıt çocuğu nitelemiyor, bir sonraki adımı söylüyor.
 */
export function konuSatiri(konular: readonly string[]): string | null {
  if (konular.length === 0) return null;
  return `${KONU_BASLIGI}: ${konular.join(' · ')}`;
}

/**
 * KÂĞIDIN KENDİ SINIRI, KÂĞIDIN ÜSTÜNDE.
 *
 * Sayıların hangi ödevleri kapsadığını yazmayan bir çıktı, veli
 * toplantısında yanlış okunur: "bu hafta ödev vermedin mi?" Süresi devam
 * eden ödev hiçbir sayıya girmiyor ve bunun sebebi de yazılı.
 */
export const KAPSAM_NOTU =
  'Sayılar ve ortalama, teslim süresi dolmuş ödevleri kapsar; süresi devam eden ' +
  'ödev hiçbir sayıya girmez.';

/**
 * Fişin altındaki tek satır.
 *
 * OKUL ADI BURADA YOK, çünkü fişin KENDİ ANTETİNDE var (mühürle
 * birlikte). İkisi bir aradayken aynı ad fişte iki kez geçiyordu.
 * Kesildikten sonra da nereden geldiğinin belli olması güvencesi
 * duruyor — yalnız yeri değişti.
 */
export function fisAltNotu(sinifAdi: string, an: Date): string {
  return `${sinifAdi} · ${tarihYazisi(an)}`;
}

export const BOS_SINIF = 'Bu sınıfta öğrenci yok; yazdırılacak bir şey de yok.';

/** Ekrandaki düğmeler — hangi bölümün yazdırılacağını seçiyor. */
export const YAZDIR_LISTE = 'Sınıf listesini yazdır';
export const YAZDIR_FIS = 'Veli fişlerini yazdır';
