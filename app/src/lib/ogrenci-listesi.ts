/**
 * Yapıştırılan öğrenci listesini çözer.
 *
 * React'siz, DOM'suz: doğrudan test edilebilir (`lib/` ilkesi). Girdi bir
 * metin bloğu, çıktı bir ÖNERİ — hiçbir öğrenci kaydı bu dosyadan doğmuyor,
 * öğretmen önizlemeyi onaylamadan sunucuya tek bir ad gitmiyor
 * (Part XXVIII: çıkarım bir öneridir).
 *
 * PDF YOLU BURAYA BAĞLANDI (0042 turu). `pdfSatirlariniOku`'nun
 * döndürdüğü satırlar `\n` ile birleştirilip bu fonksiyona veriliyor;
 * söz verildiği gibi ikinci bir ayrıştırıcı yazılmadı.
 */

/** Sınıf kodu gibi görünen alan: 9A, 10C, 12B… */
const SINIF_KODU = /^\d{1,2}\s*[A-ZÇĞİÖŞÜ]$/;

/** Satır başındaki sıra numarası: "1", "1.", "12)", "3 -" */
const BAS_NUMARA = /^\d{1,3}\s*[.)\-–]\s*|^\d{1,3}\s+/;

/**
 * e-Okul sınıf listesi satırı: SIRA NO · OKUL NO · AD SOYAD · (SÜTUNLAR…)
 *
 * Gerçek bir listede ölçüldü. Bu kalıp tanınmadığında ad alanı
 * `601 Ali Yılmaz Erkek` diye kaydediliyordu — okul numarası ve cinsiyet
 * adın İÇİNDE.
 *
 * KALIP ARTIK SONDAKİ SÜTUNLARI KENDİ AYIKLAMIYOR. İlk yazımda sondaki
 * cinsiyeti kalıbın kendisi yutuyordu ve `(?:\s+(?:Kız|Erkek))?\s*$`
 * "cinsiyet SATIRIN SONUNDA" varsayıyordu. Öğretmenin listesinde
 * cinsiyetten sonra bir PANSİYON sütunu vardı:
 *
 *   12 615 AYŞE SARI Kız Yatılı      →  ad: "Ayşe Sarı Kız Yatılı"
 *
 * Yalnız yatılı öğrencilerde dolu olduğu için tek bir çocukta göründü ve
 * uzun süre fark edilmedi. Adın nerede bittiğine artık TEK BİR YER karar
 * veriyor: `adiSutunlardanAyir`.
 */
const EOKUL_SATIRI = /^\d{1,3}[\s.)\-–]+(\d{2,6})\s+(.+?)\s*$/u;

/**
 * e-Okul sayfa başlığındaki ŞUBE: "AL - 9. Sınıf / A Şubesi (…) Sınıf Listesi"
 *
 * Ölçüldü: öğretmenin gönderdiği tek dosya ÜÇ şube taşıyordu (9A 27, 9B 30,
 * 9C 30 öğrenci). Başlık okunmasaydı 87 öğrencinin hepsi tek sınıfa
 * eklenirdi — üstelik şubeler arasında numaralar çakıştığı için ortalık
 * "numara tekrarı" uyarısına boğulurdu ve asıl sebep görünmezdi.
 */
const SUBE_BASLIGI = /(\d{1,2})\.\s*sınıf\s*\/\s*([a-zçğıöşü]{1,2})\s*şubesi/u;

/**
 * AD OLMAYAN SÜTUN DEĞERLERİ — Türkçe küçük harfle.
 *
 * e-Okul satırında addan sonra sütunlar geliyor: önce cinsiyet, sonra —
 * okulda pansiyon varsa — yatılılık durumu. İkisi de ad değil.
 *
 * `/i` BAYRAĞI YETMEZ: JavaScript'in ölçüt-duyarsız eşlemesi Türkçe'nin
 * İ/ı çiftini bilmiyor ("KIZ" ile "Kız" eşleşmez). Karşılaştırma
 * `toLocaleLowerCase('tr')` ile yapılıyor.
 */
const CINSIYET_SOZU: ReadonlySet<string> = new Set(['kız', 'erkek']);

const PANSIYON_SOZU: ReadonlySet<string> = new Set([
  'yatılı',
  'gündüzlü',
  'pansiyonlu',
  'pansiyon',
  'parasız',
  'paralı',
  'burslu',
  'taşımalı',
]);

const SUTUN_SOZU: ReadonlySet<string> = new Set([...CINSIYET_SOZU, ...PANSIYON_SOZU]);

/** Bir alanın TAMAMI sütun değerlerinden mi ibaret ("Kız", "Parasız Yatılı"). */
function sutunDegeriMi(alan: string): boolean {
  const kelimeler = alan.trim().split(/\s+/).filter(Boolean);
  return (
    kelimeler.length > 0 &&
    kelimeler.every((k) => SUTUN_SOZU.has(k.toLocaleLowerCase('tr')))
  );
}

/**
 * ADIN NEREDE BİTTİĞİNE KARAR VEREN TEK YER.
 *
 * Önce ilk CİNSİYET kelimesinde kesiyor: ondan sonrası sütundur ve
 * arkasındaki sütunun adını BİLMEYE GEREK YOK. Öğretmenin listesinde
 * cinsiyetten sonra bir pansiyon sütunu vardı ve
 * `12 615 AYŞE SARI Kız Yatılı` satırı `Ayşe Sarı Kız Yatılı` diye
 * kaydedilmişti; tanımadığımız bir değer gelse de artık kesilir.
 *
 * Sonra sondan, BİLİNEN sütun değerlerini kırpıyor — cinsiyet sütunu
 * olmayan ama pansiyon sütunu olan listeler için.
 *
 * KELİME KELİME çalışıyor, dizgi indeksiyle değil: `toLocaleLowerCase`
 * bazı harflerde uzunluğu değiştirebilir ve indeks kayardı.
 *
 * BİLEREK KABUL EDİLEN SINIR: soyadı tam olarak "Erkek" olan bir
 * öğrencide soyadı kesilir. Satıra bakarak ayırt etmek mümkün değil —
 * sütun mu, soyadı mı, ikisi de aynı kelime. Sonuç ÖNİZLEMEDE görünüyor;
 * öğretmen fark edip düzeltebiliyor.
 */
function adiSutunlardanAyir(ad: string): string {
  const parcalar = ad.trim().split(/\s+/).filter(Boolean);

  const cinsiyet = parcalar.findIndex((k) => CINSIYET_SOZU.has(k.toLocaleLowerCase('tr')));
  const govde = cinsiyet >= 0 ? parcalar.slice(0, cinsiyet) : [...parcalar];

  // Sondan bilinen sütun değerlerini at. Hepsi sütunsa boş dönüyor ve
  // satır "Cinsiyet/pansiyon sütunu" diye atlananlara düşüyor — sessizce
  // bir öğrenci olarak kaydedilmiyor.
  while (govde.length > 0 && SUTUN_SOZU.has(govde[govde.length - 1]!.toLocaleLowerCase('tr'))) {
    govde.pop();
  }

  return govde.join(' ');
}

/**
 * e-Okul listesinin ÖĞRENCİ OLMAYAN satırları.
 *
 * Bunlar elenmeseydi listeye "T.C.", okulun adı, tablo başlığı ve —
 * en kötüsü — **sınıf öğretmeninin ve müdür yardımcısının adı** birer
 * öğrenci olarak girerdi. Ölçüldü: 27 öğrencilik bir listeden 44 "öğrenci"
 * çıkıyordu.
 *
 * Her kalıbın yanında SEBEP var: elenen satır sessizce yok olmuyor,
 * önizlemede sebebiyle birlikte görünüyor ve kararı öğretmen veriyor.
 *
 * KALIPLAR TÜRKÇE KÜÇÜK HARFE GÖRE yazılı; satır da öyle çevrilip
 * karşılaştırılıyor. `/i` bayrağı YETMEZ ve bu ölçüldü: "İSTANBUL
 * VALİLİĞİ" satırı `/Valiliği/i` ile EŞLEŞMEDİ ve bir "öğrenci" olarak
 * listeye girdi. JavaScript'in ölçüt-duyarsız eşlemesi Türkçe'nin İ/ı
 * çiftini bilmiyor; `toLocaleLowerCase('tr')` biliyor.
 */
const MOBILYA: ReadonlyArray<readonly [RegExp, string]> = [
  [/^t\.?\s?c\.?$/u, 'Liste başlığı'],
  [/(?:valiliği|kaymakamlığı|bakanlığı|müdürlüğü)\s*$/u, 'Kurum adı'],
  [/sınıf\s+listesi/u, 'Liste başlığı'],
  // "Sınıf Öğretmeni: …", "Sınıf Müdür Yrd: …", "Sınıf Başkanı:"
  // Bu satırlarda GERÇEK KİŞİ ADLARI var; öğrenci sanılmamalı.
  [/sınıf\s+(?:öğretmeni|müdür|başkan)/u, 'Öğretmen/başkan satırı'],
  [/müdür\s+yrd/u, 'Öğretmen/başkan satırı'],
  [/^s\.?\s?no\b/u, 'Tablo başlığı'],
  [/cinsiyet/u, 'Tablo başlığı'],
  // KALIP DAR TUTULUYOR. İlk yazımda yalnız `/pansiyon/` vardı ve BÜTÜN
  // SATIRDA aranıyordu: pansiyon değeri "Pansiyonlu" olan bir ÖĞRENCİ
  // satırı "tablo başlığı" sanılıp tamamen atılıyordu — çocuk listeye hiç
  // girmiyordu. Bozuk bir addan daha kötüsü, sessizce kaybolan bir
  // öğrencidir. Standart başlık satırı zaten `^s\.?\s?no` ile eleniyor.
  [/pansiyon\s+durumu/u, 'Tablo başlığı'],
  [/öğrenci\s+sayısı/u, 'Altbilgi'],
];

/** Rakam: bir öğrenci adında bulunmaz. Tarih, sayfa no, belge kodu elenir. */
const RAKAM = /\d/u;

/** En az bir harf içeriyor mu (Türkçe harfler dahil). */
const HARF_VAR = /[A-Za-zÇĞİıÖŞÜçğöşü]/;

export type AdSatiri = {
  /** Yapıştırılan satırın ham hâli — önizlemede yan yana gösterilir. */
  ham: string;
  /** Kaydedilecek hâl. */
  ad: string;
  /**
   * Bu satırın ait olduğu şube ("9A") — PDF başlığından okundu, yoksa
   * `null`. Elle yapıştırılan listelerde ve tek şubelik dosyalarda null
   * olması normal; o zaman ekrandan seçilen sınıf kullanılıyor.
   */
  sinif: string | null;
  /**
   * Okul numarası — yoksa `null`.
   *
   * 0042'den önce numara atılıyordu (şemada yeri yoktu) ve adın içinde
   * kalması kusurdu. Artık ayrı alanda. Özel ders öğrencisinde ve elle
   * yazılmış listelerde numara olmaması NORMAL.
   */
  no: string | null;
  /**
   * Numara tekrarı — ad tekrarından AYRI tutuluyor, çünkü ayrı şeyler:
   * aynı adda iki öğrenci olabilir, aynı numarada olmaması beklenir.
   * Yine de ikisi de yalnız UYARI (öğretmenin kararı): tek bir yanlış
   * okunan numara yüzünden bütün sınıf reddedilmemeli.
   */
  noTekrar: 'liste' | 'kayitli' | null;
  /**
   * `liste`   → aynı yapıştırmada bu ad zaten var
   * `kayitli` → o sınıfta bu adda bir öğrenci zaten kayıtlı
   *
   * İkisi de UYARI, engel değil: bir okulda aynı adda iki öğrenci gerçekten
   * olur ve şemada `ad` üzerinde UNIQUE yok. Kararı öğretmen veriyor.
   */
  mukerrer: 'liste' | 'kayitli' | null;
  /**
   * O sınıfta bu adda bir öğrenci ZATEN KAYITLI mı.
   *
   * `mukerrer`den AYRI bir alan, çünkü `mukerrer` tek bir değer taşıyor:
   * aynı ad hem yapıştırmanın içinde tekrar ediyorsa hem de sınıfta
   * kayıtlıysa `'liste'` yazıyor ve kayıtlı olduğu bilgisi kayboluyor.
   * "Kaç öğrenci eşleşecek" sayısı o kayıptan etkilenmemeli — öğretmen
   * kaydetmeden önce ne olacağını buradan okuyor.
   */
  kayitli: boolean;
};

export type AtlananSatir = { satir: number; ham: string; sebep: string };

export type ListeOzeti = {
  satirlar: AdSatiri[];
  /**
   * Dosyada geçen şubeler, göründükleri sırada ("9A", "9B", "9C").
   * Boşsa dosya şube taşımıyor demektir.
   */
  siniflar: string[];
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
    .filter(
      (a) =>
        a !== '' &&
        !/^\d+$/.test(a) &&
        !SINIF_KODU.test(a) &&
        // SÜTUN DEĞERLERİ ELENMELİ. Elenmeseydi tek adlı bir öğrencide
        // ("Ali", 3 harf) en uzun alan "Erkek" (5 harf) — pansiyonlu bir
        // okulda "Yatılı" (6 harf) — olur ve öğrencinin adı o sütun
        // değeri diye kaydedilirdi.
        !sutunDegeriMi(a) &&
        HARF_VAR.test(a),
    );
  if (alanlar.length === 0) return null;
  return alanlar.reduce((en, a) => (a.length > en.length ? a : en));
}

export function listeyiCoz(
  metin: string,
  secenek: {
    duzelt: boolean;
    /** Tek sınıflı kullanım — dosya şube taşımıyorsa. */
    kayitliAdlar?: string[];
    kayitliNolar?: string[];
    /**
     * ŞUBE BAŞINA zaten kayıtlı olanlar: `{ '9A': { adlar, nolar }, … }`.
     *
     * Üç şubelik bir dosyada tek bir liste kullanmak yanlış olurdu: 9B'de
     * kayıtlı bir numara 9A'daki satır için "zaten kayıtlı" sayılırdı ve
     * öğretmen olmayan bir çakışmayı kovalardı.
     */
    kayitliSube?: Record<string, { adlar?: string[]; nolar?: string[] }>;
  } = {
    duzelt: false,
  },
): ListeOzeti {
  const satirlar: AdSatiri[] = [];
  const atlanan: AtlananSatir[] = [];

  /** Kapsam ('' = şubesiz) → o kapsamda zaten kayıtlı ad/numara kümeleri. */
  const kayitliKapsam = new Map<string, { ad: Set<string>; no: Set<string> }>();
  kayitliKapsam.set('', {
    ad: new Set((secenek.kayitliAdlar ?? []).map(karsilastirmaAnahtari)),
    no: new Set((secenek.kayitliNolar ?? []).filter(Boolean)),
  });
  for (const [sube, k] of Object.entries(secenek.kayitliSube ?? {})) {
    kayitliKapsam.set(sube, {
      ad: new Set((k.adlar ?? []).map(karsilastirmaAnahtari)),
      no: new Set((k.nolar ?? []).filter(Boolean)),
    });
  }

  // TEKRAR DENETİMİ ŞUBE BAŞINA. Anahtarın başına şube konuyor: 9A'daki
  // 617 ile 9B'deki 617 ÇAKIŞMA DEĞİL, iki ayrı öğrencinin numarası.
  // Genel bir küme kullansaydık üç şubelik bir dosya baştan aşağı yanlış
  // uyarı verir ve gerçek çakışmalar o gürültünün içinde kaybolurdu.
  const gorulen = new Set<string>();
  const gorulenNo = new Set<string>();
  const siniflar: string[] = [];
  let suSinif: string | null = null;

  let buyukSayisi = 0;
  let harfliSayisi = 0;

  const hamSatirlar = metin.split(/\r?\n/);

  hamSatirlar.forEach((hamSatir, i) => {
    const sira = i + 1;
    const kirpik = hamSatir.trim();
    if (kirpik === '') return; // Boş satır bir hata değil, sadece boşluk.

    // TEK BAŞINA SÜTUN DEĞERİ. Öğretmenin fark ettiği kusur: sütun ayrı
    // satıra düştüğünde "Kız"/"Erkek" birer öğrenci sanılıyordu. Aynısı
    // pansiyon sütunu için de geçerli — "Yatılı" diye bir öğrenci olmaz.
    if (sutunDegeriMi(kirpik)) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Cinsiyet/pansiyon sütunu' });
      return;
    }

    const kucuk = kirpik.toLocaleLowerCase('tr');

    // ŞUBE BAŞLIĞI. Mobilya elemesinden ÖNCE bakılıyor, çünkü bu satır
    // hem elenecek (öğrenci değil) hem de OKUNACAK: ardından gelen
    // öğrenciler bu şubeye ait.
    const sube = SUBE_BASLIGI.exec(kucuk);
    if (sube) {
      suSinif = `${Number(sube[1])}${sube[2]!.toLocaleUpperCase('tr')}`;
      if (!siniflar.includes(suSinif)) siniflar.push(suSinif);
      atlanan.push({ satir: sira, ham: kirpik, sebep: `Şube başlığı (${suSinif})` });
      return;
    }

    // LİSTE MOBİLYASI: başlık, kurum adı, tablo başlığı, altbilgi ve
    // öğretmen/başkan satırları. Sonuncusu en tehlikelisiydi — içindeki
    // gerçek kişi adı öğrenci olarak kaydedilirdi.
    const mobilya = MOBILYA.find(([kalip]) => kalip.test(kucuk));
    if (mobilya) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: mobilya[1] });
      return;
    }

    const secilen = adAlaniniSec(kirpik);
    if (secilen === null) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Harf içermiyor' });
      return;
    }

    // e-Okul satırıysa adı ve NUMARAYI ayrı ayrı al: sıra no atılır, okul
    // no kendi alanına gider, sondaki cinsiyet sütunu da atılır. Kalıp
    // tutmazsa eski yol işler ve numara null kalır.
    const eslesme = EOKUL_SATIRI.exec(secilen);
    const okulNo = eslesme?.[1] ?? null;
    const eokul = eslesme?.[2];

    // Sıra numarasını at, adı sütunlardan ayır, iç boşlukları teke indir.
    const temiz = adiSutunlardanAyir(eokul ?? secilen.replace(BAS_NUMARA, '')).replace(
      /\s+/g,
      ' ',
    );

    // Geriye hiçbir şey kalmadıysa satırın tamamı sütun değeriydi.
    // SESSİZCE ATILMIYOR: sebebiyle birlikte önizlemede görünüyor.
    if (temiz === '') {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Cinsiyet/pansiyon sütunu' });
      return;
    }

    if (!HARF_VAR.test(temiz)) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Harf içermiyor' });
      return;
    }
    if (temiz.length < 2) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Çok kısa' });
      return;
    }
    // ADLARDA RAKAM OLMAZ. Tarih, sayfa numarası, belge kodu ve okul
    // numarası ayıklanmamış satırlar buradan eleniyor — ad alanına
    // sızmasınlar. Elenen satır önizlemede sebebiyle görünüyor.
    if (RAKAM.test(temiz)) {
      atlanan.push({ satir: sira, ham: kirpik, sebep: 'Rakam içeriyor' });
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

    // Kapsam anahtarı: şube + değer. Şube yoksa tek kümede toplanıyorlar
    // (eski davranış).
    const kapsam = suSinif ?? '';

    const kayitliBu = kayitliKapsam.get(kapsam);

    const kayitli = kayitliBu?.ad.has(anahtar) ?? false;
    let mukerrer: AdSatiri['mukerrer'] = null;
    if (gorulen.has(`${kapsam}|${anahtar}`)) mukerrer = 'liste';
    else if (kayitli) mukerrer = 'kayitli';
    gorulen.add(`${kapsam}|${anahtar}`);

    let noTekrar: AdSatiri['noTekrar'] = null;
    if (okulNo !== null) {
      if (gorulenNo.has(`${kapsam}|${okulNo}`)) noTekrar = 'liste';
      else if (kayitliBu?.no.has(okulNo)) noTekrar = 'kayitli';
      gorulenNo.add(`${kapsam}|${okulNo}`);
    }

    satirlar.push({
      ham: kirpik,
      ad,
      no: okulNo,
      sinif: suSinif,
      mukerrer,
      kayitli,
      noTekrar,
    });
  });

  return {
    satirlar,
    siniflar,
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
