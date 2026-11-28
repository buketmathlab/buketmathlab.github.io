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

import { ADRES, fisMetni } from './kod-fisi';
import type { CizelgeDurumu, OdevKiyasi, OdevTarihleri } from '@/types/api';

export const CIZELGE_BASLIGI = 'Ödev çizelgesi';

/**
 * ANTETTEKİ KÜNYE — ders ve öğretmen.
 *
 * İlk yazımda YOKTU ve öğretmen sordu: "Matematik dersi olduğu yazıyor
 * mu?" Yazmıyordu. Kod fişinde bu satır bilerek kaldırılmıştı
 * (`kod-fisi.ts`: "fişi eline alan kimin verdiğini zaten biliyor") ama
 * o gerekçe BURADA GEÇERLİ DEĞİL: kod fişi çocuğa verilen bir giriş
 * kâğıdı, bu ise veliye verilen bir BELGE. Veli toplantısında velinin
 * elinde birkaç öğretmenden kâğıt oluyor; hangisinin hangi ders olduğu
 * sonradan belli olmalı. Okul Yönetimi Bilgilendirmesi belgesinde de
 * aynı sebeple künye var.
 *
 * ÖĞRETMEN ADI SABİT DEĞİL — VE İLK YAZIMDA SABİTTİ.
 *
 * `OGRETMEN = 'Buket Topuzoğlu'` yazıyordu; başka bir öğretmenin sınıfı
 * için basılan kâğıtta da o ad çıkardı. Öğretmenin düzeltmesi: "her
 * diğer öğretmenlerin de dersine giren öğretmen kimse onun adı yazsın.
 * Diğer öğretmenlerin de sistemde sınıfları yazıyor, var kayıtlı."
 *
 * Kayıt gerçekten var: `ogretmen_siniflari` (0033) ve şemadaki kendi
 * yorumu bu cümlenin aynısı — "Hangi öğretmen hangi sınıfa giriyor."
 * `sinif_not_cizelgesi` o adları 0063'ten beri `sinif.ogretmenler`
 * olarak gönderiyor (yönetici önce, sonra ad). Yeni sunucu işi yok.
 *
 * ÖDEVİ VEREN DEĞİL, DERSE GİREN. Öğretmen ikisinin ayrı olduğunu
 * söyledi: "Hepsine ödev gönderiyorum fakat ders işlediğim sınıflar
 * bunlar." Künye `odev.ogretmen`e değil `sinif.ogretmenler`e bakıyor.
 */
export const DERS = 'Matematik';

/**
 * Künye satırı: ders · o sınıfa giren öğretmen(ler).
 *
 * ORTAK SINIFTA HEPSİ YAZILIYOR (öğretmenin kararı): velinin elindeki
 * kâğıt, çocuğun dersine giren bütün öğretmenleri göstersin.
 *
 * KAYIT YOKSA AD UYDURULMUYOR. Dizi boşsa yalnız ders yazıyor; sarkık
 * bir "·" basmak ya da kâğıdı basan öğretmenin adını koymak, veliye
 * doğrulanmamış bir bilgi vermek olurdu (Part VIII).
 */
export function kunyeSatiri(ogretmenler: readonly string[] | undefined | null): string {
  const adlar = Array.isArray(ogretmenler)
    ? ogretmenler
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
    : [];
  return adlar.length === 0 ? DERS : `${DERS} · ${adlar.join(', ')}`;
}

/**
 * VELİ GİRİŞİ — kod, adres ve uygulama kurulumu (öğretmenin isteği:
 * "bu çizelgede veli kodu ve sekizkyal giriş yönlendirmesi yazsın,
 * uygulama olarak nasıl indirilebileceği yazsın").
 *
 * METİN `kod-fisi.ts`TEN GELİYOR, KOPYALANMIYOR. Veli fişiyle çizelge
 * aynı yönergeyi anlatıyor; iki yerde iki türlü yazılsa biri bir gün
 * güncellenir öbürü kalırdı. Adres de oradan (`ADRES`): 0041'de eski
 * adresin 301 ile yönlendiği ölçülmüştü ve tek doğru yer orası.
 *
 * YALNIZ VELİ KODU. Öğrenci kodu bu kâğıda GİRMİYOR — `kod-fisi.ts`in
 * ayrımı: iki kodu tek kâğıda basmak, velinin kanalını çocuğun eline
 * vermek olurdu (veli yazışması ve özel derste ödeme bilgisi oradan
 * görünüyor).
 */
export const GIRIS_BASLIGI = 'Veli girişi';
export const KOD_ETIKETI = fisMetni('veli').kodEtiketi;
export const GIRIS_SATIRLARI = fisMetni('veli').satirlar;
export const KURULUM_BASLIGI = fisMetni('veli').kurulumBasligi;
export const KURULUM = fisMetni('veli').kurulum;
export { ADRES };

/**
 * Kod yoksa giriş bloğu HİÇ ÇİZİLMİYOR.
 *
 * Öğretmen kodları getirmeyi onaylamadıysa, ya da öğrencinin veli kodu
 * yoksa, boş bir "Veli kodunuz:" satırı basmak veliye işe yaramaz bir
 * kâğıt vermek olurdu (`kod-fisi.ts`in "kodu olmayan öğrenci fiş
 * üretmez" kuralının aynısı).
 */
export function girisBloguVarMi(kod: string | null | undefined): boolean {
  return typeof kod === 'string' && kod.trim() !== '';
}
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

/**
 * Kâğıdın kapanış notu — YALNIZ SAYIYI DOĞRU OKUTAN BİLGİ.
 *
 * BİR CÜMLE BİLEREK ÇIKARILDI. Not şöyle başlıyordu: "Sınıf ve düzey
 * ortalamaları isimsizdir; hangi öğrencinin kaç aldığı yazmaz."
 * Öğretmen kaldırttı: "Bu cümleler gereksiz."
 *
 * Haklı, ve sebebi ürünün kendi dil kuralında yazılı: GEREKÇELENDİRME
 * DİLİ YOK. Kâğıtta zaten yalnız o öğrencinin satırları var ve sınıf
 * ile düzey sütunları isimsiz sayılar — kimsenin aklına gelmeyecek bir
 * şüpheyi kâğıdın kendisi uyandırıyordu.
 *
 * GERİ KONMASIN: bir birim testi notun o cümleyi TAŞIMADIĞINI ölçüyor.
 * Kalan iki cümle duruyor, çünkü ikisi de velinin sayıyı yanlış
 * okumasını önleyen gerçek bilgi.
 */
export const CIZELGE_NOTU =
  'Süresi dolmamış ödevler henüz değerlendirmeye girmez. '
  + 'Çalışma kağıtları puanlanmaz.';

/**
 * KÂĞIDIN ÖLÇÜLERİ — hepsi Chromium'da `media: 'print'` ile ölçüldü.
 *
 * Ölçüm `app/scripts/veli-cizelgesi-denetimi.mjs`in C grubunda duruyor ve
 * her koşuda yeniden yapılıyor; buradaki rakamlar o ölçümün sonucudur,
 * hatırlanmış sayılar değil.
 *
 * EN KÖTÜ SATIR 10,17 mm. Bir ödev satırı üç satır metin tutabiliyor:
 * ödev adı, adın altında soru dökümü ("yanlış: 3 · boş: 1") ve durumun
 * altında "gecikmeli". Sabit, satırların HEPSİ bu hâldeyken ölçülüyor —
 * "temsilî" bir satırla ölçmek, kâğıtta taşan bir çizelge demek.
 *
 *   sayfa bütçesi               277 mm   (A4 − 2 × 10 mm kenar)
 *   satır başına               10,17 mm   (2/4/6/8 satırda doğrusal)
 *
 * ÖLÇÜM KÂĞIDIN GENİŞLİĞİNDE YAPILIYOR: 190 mm = 718 px. 1280 px'te
 * ölçmek, kâğıtta saran satırları görmemek demekti; sabitin ilk hâli
 * 8 mm küçük çıkmıştı.
 *
 * ÇİZELGENİN SABİT KISMI GİRİŞ BLOĞUYLA İKİYE KATLIYOR:
 *
 *   kodsuz  57,27 mm   antet, ad, özet, tablo başlığı, konular, notlar
 *   kodlu  107,55 mm   + veli kodu, sekizkyal yönlendirmesi, kurulum
 *
 * Giriş bloğunun kendisi 46,8 mm (kurulum yönergesi tek başına 6 satır).
 * Öğretmen kısaltılmamasını istedi: "Kurulum yönergesi kısaltılmasın."
 *
 * KÂĞIT BAŞINA BİR ÖĞRENCİ — ÖĞRETMENİN KARARI. İlk tasarım koşulluydu
 * (kodsuzsa bir kâğıda iki öğrenci, yarıma 6 ödev); öğretmen o koşulu
 * kaldırdı: "Bir A4 sayfasında sadece bir öğrencinin bilgileri olsun."
 * Böylece yarım bütçesi (137 mm) yerine tam sayfa bütçesi geçerli:
 *
 *   kodsuz  (277 − 57,27)  / 10,17 = 21,6 → 21 satır
 *   kodlu   (277 − 107,55) / 10,17 = 16,7 → 16 satır
 *
 * Kodlu/kodsuz ayrımı DURUYOR, çünkü değişen şey kâğıda kaç öğrenci
 * sığdığı değil, giriş bloğunun yer kaplaması.
 *
 * ESKİ SABİT 8'Dİ VE YANLIŞTI. İlk ölçüm "temsilî" bir fikstürle
 * yapılmıştı: satırların ikisi boş durumdaydı, o yüzden satır başına
 * 6,44 mm çıkmıştı. En kötü hâlde iki yarım 287,4 mm tutuyor, yani A4'ü
 * 10 mm aşıyor. Ders: ölçüm fikstürü TEMSİLÎ değil EN KÖTÜ hâl olmalı.
 *
 * VE MİLİMETRE TEK BAŞINA YETMİYOR. Bu rakamlar DOM'un ölçüsü; kâğıdın
 * kaç sayfa çıktığını söylemiyor. Denetim artık `page.pdf()` ile gerçek
 * SAYFA SAYIYOR — mm'si doğru olan bir çıktının sonunda boş bir kâğıt
 * olduğu ancak öyle görüldü (kabuğun `min-h-dvh`i ve `main`in `pb-28`i
 * gövdeyi 317,5 mm'ye uzatıyordu).
 */
/**
 * ANTETTEKİ MASKOT — öğretmenin isteği.
 *
 * "Ödev çizelgesinde Ewalu maskotunun da görüntüsü olsun... arkasında
 * okul adı gözüken resim." Kullanılan görsel var olan `okul` pozu;
 * karaktere dokunulmuyor (Kural 9).
 *
 * KÂĞITTAKİ BOYU ARMANIN BOYUNU AŞMIYOR (14 mm). Antetin yüksekliğini
 * arma belirliyor; maskot onun altında kaldığı sürece çizelgeye BİR
 * MİLİMETRE bile eklemiyor ve sayfaya sığan ödev satırı düşmüyor.
 * Büyütmek doğrudan ödev satırından yiyor: 14 mm'nin üstündeki her
 * 10,17 mm bir ödev satırı demek.
 *
 * Ekranda 180 px: kâğıt ölçüsü CSS'te (`.sk-cizelge-maskot`), armanın
 * `sk-fis-muhru` ile yaptığının aynısı.
 */
export const MASKOT_EKRAN_PX = 180;
export const MASKOT_KAGIT_MM = 14;
export const ARMA_KAGIT_MM = 14;

export const SATIR_MM = 10.17;
export const SABIT_MM = { kodsuz: 57.27, kodlu: 107.55 } as const;
export const TAM_BUTCE_MM = 277;

/**
 * Bir A4'e sığan ödev satırı. Kâğıt başına her zaman BİR öğrenci.
 *
 * Ölçüldü: kodsuz 21,6 → 21; kodlu 16,7 → 16.
 *
 * SAYI TASARIM TURUNDA ARTTI. Öğretmen "kâğıdın arka planı beyaz olsun,
 * modern ve seçkin tasarla" dedi; kâğıttan kalkan kutu çerçevesi (yarım
 * düzenden kalmıştı, artık kesilecek yer yok) ve ad ile sınıfın aynı
 * satıra alınması sabit kısmı 17,6 mm küçülttü. Yani tasarım ödev
 * satırı YEMEDİ, kodsuzda iki kodluda bir satır KAZANDIRDI.
 */
export const SIGAN_SATIR = { kodsuz: 21, kodlu: 16 } as const;

/**
 * Bir kâğıda kaç ödev satırı ve ekranda ne yazacağı.
 *
 * `kodlu` = öğretmen veli kodlarını basmayı onayladı; giriş bloğu
 * sayfanın 46,8 mm'sini alıyor, o yüzden satır sayısı düşüyor.
 */
export function kagitDuzeni(kodlu: boolean): { siganSatir: number; aciklama: string } {
  return kodlu
    ? {
      siganSatir: SIGAN_SATIR.kodlu,
      aciklama:
          'Her öğrenci için ayrı bir A4. Kesmeye gerek yok, kâğıdı doğrudan '
          + 'veliye verin. Veli kodu basıldığı için sayfaya '
          + `${SIGAN_SATIR.kodlu} ödev satırı sığıyor.`,
    }
    : {
      siganSatir: SIGAN_SATIR.kodsuz,
      aciklama:
          'Her öğrenci için ayrı bir A4. Kesmeye gerek yok, kâğıdı doğrudan '
          + `veliye verin. Sayfaya ${SIGAN_SATIR.kodsuz} ödev satırı sığıyor.`,
    };
}

/**
 * Ödev satırlarını kâğıda sığan parçalara böler.
 *
 * Sessizce kırpmıyor: taşan satırlar bir sonraki parçaya geçiyor ve
 * parçalar `devamBasligi` ile numaralanıyor.
 */
export function parcalaraBol<T>(
  satirlar: readonly T[],
  sigan: number = SIGAN_SATIR.kodsuz,
): T[][] {
  const adim = Number.isFinite(sigan) && sigan >= 1 ? Math.floor(sigan) : SIGAN_SATIR.kodsuz;
  if (satirlar.length === 0) return [[]];
  const parcalar: T[][] = [];
  for (let i = 0; i < satirlar.length; i += adim) {
    parcalar.push(satirlar.slice(i, i + adim));
  }
  return parcalar;
}

/** İkinci ve sonraki parçaların başlığı — kâğıt karışmasın. */
export function devamBasligi(ad: string, sira: number, toplam: number): string {
  return toplam <= 1 ? ad : `${ad} — ${sira}/${toplam}`;
}
