/**
 * Cevap anahtarı çıkarma — saf mantık.
 *
 * React yok, DOM yok, PDF kütüphanesi yok. Girdi metin satırları, çıktı bir
 * rapor. Böylece doğruluğu birim testiyle ölçülebiliyor (`lib/` ilkesi).
 *
 * ÇIKTI BİR ÖNERİDİR. Öğretmen onaylamadan hiçbir anahtar yayına gitmez
 * (Part XXVIII). Sunucu da bunu ayrıca zorluyor: `odev_yayinla` eksik
 * anahtarlı ödevi reddediyor.
 *
 * ## Eski algoritmanın düzeltilen kusuru
 *
 * Canlı `index.html:159` tüm PDF metnini tek bir yığın hâline getirip
 * `(\d{1,3})\s*[-–.):]?\s*([A-Ea-e])` deseniyle tarıyordu. Soru metni
 * içeren bir PDF'te bu, şıkları cevap sanıyor:
 *
 *     "1. Aşağıdakilerden hangisi doğrudur? A) 5 B) 6 C) 7"
 *      → 5 → B,  6 → C   (ikisi de yanlış; bunlar şık, cevap değil)
 *
 * Sebep: anahtar satırı "numara sonra harf", soru satırı ise "harf sonra
 * numara" düzenindedir; tek yığında bu ayrım kaybolur.
 *
 * Çözüm iki katmanlı:
 *  1. Metin **satır satır** işlenir (PDF okuyucu satırları y koordinatından
 *     ayırır).
 *  2. Bir satır ancak **büyük ölçüde eşleşmelerden oluşuyorsa** anahtar
 *     satırı sayılır. Yukarıdaki cümlede eşleşmeler karakterlerin ~%9'unu
 *     kaplıyor; düzyazı olduğu böyle anlaşılıyor ve satır atlanıyor.
 */

/** En son geçerli şık. Çoktan seçmeli testler genelde A–D ya da A–E'dir. */
export type SonSecenek = 'D' | 'E';

export type CikarimSecenekleri = {
  soruSayisi: number;
  sonSecenek?: SonSecenek;
};

export type Cikarim = {
  /** Soru numarası → şık. Yalnız güvenilen eşleşmeler. */
  anahtar: Record<number, string>;
  /** Anahtarı bulunan soru numaraları, artan sırada. */
  bulunan: number[];
  /** Bulunamayan soru numaraları, artan sırada. Uydurulmaz, boş bırakılır. */
  eksik: number[];
  /**
   * Aynı soru için farklı şıklar görülen numaralar. İlk görülen kullanılır
   * ama öğretmene "buraya bak" demek için ayrıca bildirilir.
   */
  celiskili: number[];
  /**
   * `numarali`  — soru numaralarıyla eşleşti, güvenilir.
   * `harf-dizisi` — numara bulunamadı, harfler sırayla eşlendi. ZAYIF:
   *                 arayüz bunu açıkça uyarı olarak göstermeli.
   * `bulunamadi` — hiçbir şey çıkarılamadı.
   */
  yontem: 'numarali' | 'harf-dizisi' | 'bulunamadi';
};

/**
 * Bir satırın anahtar satırı sayılması için eşleşmelerin kaplaması gereken
 * en düşük oran. 0.6 deneyerek seçildi: "1) A 2) B 3) C" gibi saf anahtar
 * satırları 1.0'a yakın, soru cümleleri 0.2'nin altında kalıyor.
 */
const EN_AZ_KAPSAMA = 0.6;

function bosluksuzUzunluk(s: string): number {
  return s.replace(/\s+/g, '').length;
}

/** Satırdaki "numara → şık" çiftleri. Kapsama oranı da hesaplanır. */
function satirdakiCiftler(satir: string, sonSecenek: SonSecenek) {
  // Ayraç isteğe bağlı: "1A", "1.A", "1) A", "1 - A" hepsi geçerli.
  const desen = new RegExp(
    `(\\d{1,3})\\s*[-–—.:)\\]]?\\s*([A-${sonSecenek}a-${sonSecenek.toLowerCase()}])` +
      // Şıkkın peşinden harf gelmemeli: "12 Bir" ya da "3 CEVAP" eşleşmesin.
      `(?![A-Za-zÇĞİIÖŞÜçğıöşü])`,
    'g',
  );

  const ciftler: Array<{ no: number; sik: string }> = [];
  let kapsanan = 0;
  let m: RegExpExecArray | null;
  while ((m = desen.exec(satir)) !== null) {
    kapsanan += bosluksuzUzunluk(m[0]!);
    ciftler.push({ no: Number.parseInt(m[1]!, 10), sik: m[2]!.toUpperCase() });
  }

  const toplam = bosluksuzUzunluk(satir);
  return { ciftler, oran: toplam === 0 ? 0 : kapsanan / toplam };
}

/**
 * Numara bulunamadığında son çare: metindeki şık harflerini sırayla eşle.
 * Yalnız harf sayısı soru sayısına **tam eşitse** uygulanır — fazlaysa
 * hangi harfin hangi soruya ait olduğu belirsizdir ve tahmin etmeyiz.
 */
function harfDizisinden(
  satirlar: readonly string[],
  soruSayisi: number,
  sonSecenek: SonSecenek,
): Record<number, string> | null {
  const izin = new RegExp(`[^A-${sonSecenek}]`, 'g');
  const harfler = satirlar.join(' ').toUpperCase().replace(izin, '');
  if (harfler.length !== soruSayisi) return null;

  const anahtar: Record<number, string> = {};
  for (let i = 1; i <= soruSayisi; i++) anahtar[i] = harfler[i - 1]!;
  return anahtar;
}

/**
 * Metinden cevap anahtarı çıkarır.
 *
 * @param girdi Satır dizisi ya da satır sonlarıyla ayrılmış tek metin.
 */
export function anahtariCikar(
  girdi: string | readonly string[],
  { soruSayisi, sonSecenek = 'E' }: CikarimSecenekleri,
): Cikarim {
  const gecerliSayi = Number.isInteger(soruSayisi) && soruSayisi >= 1;

  /**
   * Hiçbir şey çıkarılamadığında dönen sonuç. `eksik` BOŞ DEĞİL: hiçbir
   * cevap bulunamadıysa soruların tamamı eksiktir. Boş bırakmak arayüzde
   * "eksik yok" gibi okunur ve öğretmen eksik anahtarla yayınlamaya
   * çalışırdı — sunucu reddederdi ama hata geç ve kafa karıştırıcı olurdu.
   */
  const bos = (): Cikarim => ({
    anahtar: {},
    bulunan: [],
    eksik: gecerliSayi ? Array.from({ length: soruSayisi }, (_, i) => i + 1) : [],
    celiskili: [],
    yontem: 'bulunamadi',
  });

  if (!gecerliSayi) return bos();

  const satirlar = (typeof girdi === 'string' ? girdi.split(/\r?\n/) : girdi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const anahtar: Record<number, string> = {};
  const celiskili = new Set<number>();

  for (const satir of satirlar) {
    const { ciftler, oran } = satirdakiCiftler(satir, sonSecenek);
    // Düzyazı satırı: eşleşmeler satırın küçük bir bölümünü kaplıyor.
    // Soru metnindeki şıklar buradan eleniyor.
    if (oran < EN_AZ_KAPSAMA) continue;

    for (const { no, sik } of ciftler) {
      if (no < 1 || no > soruSayisi) continue;
      const mevcut = anahtar[no];
      if (mevcut === undefined) {
        anahtar[no] = sik;
      } else if (mevcut !== sik) {
        celiskili.add(no);
      }
    }
  }

  let yontem: Cikarim['yontem'] = 'numarali';

  if (Object.keys(anahtar).length === 0) {
    const dizi = harfDizisinden(satirlar, soruSayisi, sonSecenek);
    if (dizi === null) return bos();
    Object.assign(anahtar, dizi);
    yontem = 'harf-dizisi';
  }

  const bulunan: number[] = [];
  const eksik: number[] = [];
  for (let i = 1; i <= soruSayisi; i++) {
    (anahtar[i] === undefined ? eksik : bulunan).push(i);
  }

  return {
    anahtar,
    bulunan,
    eksik,
    celiskili: [...celiskili].sort((a, b) => a - b),
    yontem,
  };
}
