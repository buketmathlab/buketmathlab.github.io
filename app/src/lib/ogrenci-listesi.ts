/**
 * Yapıştırılan öğrenci listesini çözer.
 *
 * React'siz, DOM'suz: doğrudan test edilebilir (`lib/` ilkesi). Girdi bir
 * metin bloğu, çıktı bir ÖNERİ — hiçbir öğrenci kaydı bu dosyadan doğmuyor,
 * öğretmen önizlemeyi onaylamadan sunucuya tek bir ad gitmiyor
 * (Part XXVIII: çıkarım bir öneridir).
 *
 * PDF YOLU DA BURAYA BAĞLANACAK. Metin katmanlı e-Okul PDF'i geldiğinde
 * `pdfSatirlariniOku`'nun döndürdüğü satırlar `\n` ile birleştirilip aynı
 * fonksiyona verilecek; ikinci bir ayrıştırıcı yazılmayacak.
 */

/** Sınıf kodu gibi görünen alan: 9A, 10C, 12B… */
const SINIF_KODU = /^\d{1,2}\s*[A-ZÇĞİÖŞÜ]$/;

/** Satır başındaki sıra numarası: "1", "1.", "12)", "3 -" */
const BAS_NUMARA = /^\d{1,3}\s*[.)\-–]\s*|^\d{1,3}\s+/;

/** En az bir harf içeriyor mu (Türkçe harfler dahil). */
const HARF_VAR = /[A-Za-zÇĞİıÖŞÜçğöşü]/;

export type AdSatiri = {
  /** Yapıştırılan satırın ham hâli — önizlemede yan yana gösterilir. */
  ham: string;
  /** Kaydedilecek hâl. */
  ad: string;
  /**
   * `liste`   → aynı yapıştırmada bu ad zaten var
   * `kayitli` → o sınıfta bu adda bir öğrenci zaten kayıtlı
   *
   * İkisi de UYARI, engel değil: bir okulda aynı adda iki öğrenci gerçekten
   * olur ve şemada `ad` üzerinde UNIQUE yok. Kararı öğretmen veriyor.
   */
  mukerrer: 'liste' | 'kayitli' | null;
};

export type AtlananSatir = { satir: number; ham: string; sebep: string };

export type ListeOzeti = {
  satirlar: AdSatiri[];
  /** Okunamayan satırlar — SESSİZCE atılmıyor, ham hâliyle gösteriliyor. */
  atlanan: AtlananSatir[];
  /**
   * Girdinin çoğunluğu BÜYÜK HARF mi. e-Okul listeleri böyle geliyor;
   * düzeltme kutusunun varsayılanı bu ölçüme göre açılıyor — tahmine göre
   * değil.
   */
  cogunlukBuyuk: boolean;
};

/**
 * Türkçe kurallarıyla ad düzeltme.
 *
 * BU FONKSİYONUN VARLIK SEBEBİ ÖLÇÜLMÜŞ BİR TUZAK. JavaScript'in düz
 * `toLowerCase()`'i "ALİ"yi `"Ali̇"` yapıyor: `i` harfinin ARDINA ayrı bir
 * BİRLEŞEN NOKTA (U+0307) ekliyor. Ölçüldü — "ALİ YILMAZ IŞIK ÖZTÜRK"
 * düz yolla 23 karakter, Türkçe yolla 22:
 *
 *   toLowerCase()           → "ali̇ yilmaz işik öztürk"   ✗
 *   toLocaleLowerCase('tr') → "ali yılmaz ışık öztürk"   ✓
 *
 * Ekranda neredeyse aynı görünüyor. Ama arama tutmaz, sıralama bozulur ve
 * bir çocuğun adı sessizce bozuk kaydedilir. Ayrıca `I` harfi düz yolla
 * `i` oluyor — "IŞIK" adı "Işik" diye kaydedilirdi.
 */
export function adiDuzelt(ad: string): string {
  return ad
    .split(' ')
    .map((kelime) =>
      // Tireli adlar da parça parça büyütülüyor: "ALİ-VELİ" → "Ali-Veli".
      kelime
        .split('-')
        .map((p) =>
          p.length === 0 ? p : p.charAt(0).toLocaleUpperCase('tr') + p.slice(1).toLocaleLowerCase('tr'),
        )
        .join('-'),
    )
    .join(' ');
}

/** Karşılaştırma için normalleştirme — "ALİ  YILMAZ" ile "Ali Yılmaz" aynı sayılsın. */
function karsilastirmaAnahtari(ad: string): string {
  return ad.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

/**
 * Sekmeli bir satırdan adı seçer.
 *
 * Excel'den yapıştırma "1⇥123456⇥ALİ YILMAZ⇥9A" gibi geliyor. Sayı olan,
 * boş olan ve sınıf kodu gibi görünen alanlar eleniyor; kalanların EN
 * UZUNU ad kabul ediliyor. Tek alan varsa zaten o.
 */
function adAlaniniSec(ham: string): string | null {
  const alanlar = ham
    .split('\t')
    .map((a) => a.trim())
    .filter((a) => a !== '' && !/^\d+$/.test(a) && !SINIF_KODU.test(a) && HARF_VAR.test(a));
  if (alanlar.length === 0) return null;
  return alanlar.reduce((en, a) => (a.length > en.length ? a : en));
}

export function listeyiCoz(
  metin: string,
  secenek: { duzelt: boolean; kayitliAdlar?: string[] } = { duzelt: false },
): ListeOzeti {
  const satirlar: AdSatiri[] = [];
  const atlanan: AtlananSatir[] = [];

  const kayitli = new Set((secenek.kayitliAdlar ?? []).map(karsilastirmaAnahtari));
  const gorulen = new Set<string>();

  let buyukSayisi = 0;
  let harfliSayisi = 0;

  const hamSatirlar = metin.split(/\r?\n/);

  hamSatirlar.forEach((hamSatir, i) => {
    const sira = i + 1;
    const kirpik = hamSatir.trim();
    if (kirpik === '') return; // Boş satır bir hata değil, sadece boşluk.

    const secilen = adAlaniniSec(kirpik);
    if (secilen === null) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Harf içermiyor' });
      return;
    }

    // Sıra numarası at, iç boşlukları teke indir.
    const temiz = secilen.replace(BAS_NUMARA, '').replace(/\s+/g, ' ').trim();

    if (!HARF_VAR.test(temiz)) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Harf içermiyor' });
      return;
    }
    if (temiz.length < 2) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Çok kısa' });
      return;
    }
    // Sunucudaki sınırın aynısı (0024). Burada söylemek, 40 satırı
    // gönderip tek satır yüzünden hepsinin reddedilmesinden iyi.
    if (temiz.length > 100) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: '100 karakterden uzun' });
      return;
    }

    harfliSayisi += 1;
    if (temiz === temiz.toLocaleUpperCase('tr')) buyukSayisi += 1;

    const ad = secenek.duzelt ? adiDuzelt(temiz) : temiz;
    const anahtar = karsilastirmaAnahtari(ad);

    let mukerrer: AdSatiri['mukerrer'] = null;
    if (gorulen.has(anahtar)) mukerrer = 'liste';
    else if (kayitli.has(anahtar)) mukerrer = 'kayitli';
    gorulen.add(anahtar);

    satirlar.push({ ham: kirpik, ad, mukerrer });
  });

  return {
    satirlar,
    atlanan,
    // Eşik %80: e-Okul listeleri tamamen büyük harf gelir, elle yazılmış
    // bir listede araya birkaç büyük harfli ad karışabilir. Tek bir
    // "ALİ" yüzünden bütün listeyi dönüştürmek istemiyoruz.
    cogunlukBuyuk: harfliSayisi > 0 && buyukSayisi / harfliSayisi > 0.8,
  };
}

/**
 * Kod listesini CSV'ye çevirir.
 *
 * UTF-8 BOM ŞART. BOM'suz bir CSV'yi Excel Windows-1254 sanıp açıyor ve
 * "Çobanoğlu" → "Ãobanoğlu" oluyor. Öğretmen bu dosyayı bilgisayarda açıp
 * yazdıracak; adların bozuk çıkması onu elle düzeltmeye zorlardı.
 *
 * Ayraç NOKTALI VİRGÜL: Türkçe Excel'de ondalık ayracı virgül olduğu için
 * varsayılan liste ayracı `;`. Virgülle ayırsaydık her şey tek sütuna
 * düşerdi.
 */
export function kodlariCsv(
  kayitlar: Array<{ ad: string; ogrenci_kodu: string; veli_kodu: string }>,
  sinifAdi: string,
): string {
  const kacir = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const satirlar = [
    ['Sınıf', 'Ad Soyad', 'Öğrenci kodu', 'Veli kodu'].map(kacir).join(';'),
    ...kayitlar.map((k) =>
      [sinifAdi, k.ad, k.ogrenci_kodu, k.veli_kodu].map(kacir).join(';'),
    ),
  ];
  return '﻿' + satirlar.join('\r\n') + '\r\n';
}
