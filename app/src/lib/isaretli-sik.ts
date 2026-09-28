/**
 * İşaretli şıktan cevap anahtarı — saf mantık.
 *
 * React yok, DOM yok, PDF kütüphanesi yok. Girdi bir sayfanın piksel
 * dizisi (RGBA) ve metin katmanındaki soru numaraları; çıktı "soru → şık".
 * Böylece doğruluğu birim testiyle ölçülebiliyor (`lib/` ilkesi). Sayfayı
 * çizmek `services/pdf-isaret.ts`'in işi.
 *
 * ## Neden
 *
 * Öğretmenin yeni cevap anahtarı biçiminde ("…Çözüm.pdf", 51 soru) sorular
 * GÖRSEL, doğru şık görselin içinde PEMBE bir kutuyla işaretli. Metin
 * katmanında cevap yok — yalnız "01 UYGULAMA 1 Puan" rozetleri. Metinden
 * okuyan `cevap-anahtari.ts` 0/51 buluyordu; öğretmen 51 şıkkı elle
 * işaretliyordu.
 *
 * ## Nasıl — yapay zekâ YOK, belirlenimci
 *
 * 1. Pembe dolgulu pikseller → bağlı bileşenler → kutu (boyut ve doluluk süzgeci).
 * 2. Kutunun içindeki EN SOLDAKİ harf ("B) 120" → "B") 20×24'lük bir
 *    ızgaraya indirgenir ve A–E şablonlarıyla (`sik-sablonlari.ts`)
 *    kosinüs benzerliğiyle kıyaslanır.
 * 3. Kutu, okuma sırasında kendisinden hemen ÖNCE gelen soru numarasına ait
 *    sayılır (sütun sütun, yukarıdan aşağı).
 *
 * ## Emin olunamayan UYDURULMAZ
 *
 * Benzerlik `EN_AZ_BENZERLIK`'in ya da en iyi iki harfin farkı `EN_AZ_FARK`'ın
 * altındaysa (ör. harfin üstüne el yazısı gelmiş) soru BOŞ kalır; öğretmen
 * ızgarada işaretler. Ölçülen (51 soruluk gerçek PDF): 49 doğru, 1 okunamadı
 * (el yazısı, benzerlik 0.42), 1 işaretsiz; YANLIŞ YOK. Doğru okunanların en
 * düşük benzerliği 0.88, en düşük farkı 0.083.
 */

import { SIK_SABLONLARI, SABLON_EN, SABLON_BOY } from './sik-sablonlari';

export { SABLON_EN, SABLON_BOY };

export type Goruntu = {
  /** RGBA, satır satır. */
  veri: Uint8ClampedArray | Uint8Array;
  genislik: number;
  yukseklik: number;
};

/** Piksel koordinatları, sol üst köşe başlangıç, uçlar dahil. */
export type Kutu = { x0: number; y0: number; x1: number; y1: number };

/** Metin katmanından gelen soru numarası rozeti, piksel koordinatında. */
export type Numara = { no: number; x: number; y: number };

export type Harf = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * En iyi iki harfin benzerlik farkı bunun altındaysa "emin değil".
 * Ölçüm: doğru okunan 49 harfin en düşük farkı 0.083.
 */
export const EN_AZ_FARK = 0.05;

/**
 * Harf sayılmak için en iyi şablona en az benzerlik. Pembe gürültüyü ve
 * üstüne el yazısı binmiş harfi eler. Ölçüm: doğrular ≥0.88, el yazısı 0.42.
 */
export const EN_AZ_BENZERLIK = 0.55;

// -----------------------------------------------------------------------------
// 1. PEMBE KUTULAR
// -----------------------------------------------------------------------------

/**
 * İşaret rengi: açık, hafif kırmızıya çalan pembe. Ölçülen dolgu
 * R≈223 G≈200 B≈198. Kırmızı el yazısı (R≈150, G≈40) çok koyu ve çok doygun
 * olduğu için dışarıda kalıyor; beyaz ve gri de (R−G ≈ 0).
 */
export function pembeMi(r: number, g: number, b: number): boolean {
  return r >= 195 && r <= 245 && g >= 165 && r - g >= 12 && r - g <= 45 && r - b >= 10 && r - b <= 50;
}

/**
 * Sayfadaki pembe işaret kutuları.
 *
 * @param olcek Punto başına piksel (sayfa hangi ölçekte çizildi). Boyut
 *              süzgeçleri puntoyla tanımlı: çizim ölçeğinden bağımsız.
 */
export function pembeKutular(g: Goruntu, olcek: number): Kutu[] {
  const { veri, genislik: W, yukseklik: H } = g;
  const maske = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (pembeMi(veri[i * 4]!, veri[i * 4 + 1]!, veri[i * 4 + 2]!)) maske[i] = 1;
  }

  const kutular: Kutu[] = [];
  const yigin: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (maske[i] !== 1) continue;
    maske[i] = 2;
    yigin.push(i);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, sayi = 0;
    while (yigin.length > 0) {
      const j = yigin.pop()!;
      const x = j % W;
      const y = (j - x) / W;
      sayi++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && maske[j - 1] === 1) { maske[j - 1] = 2; yigin.push(j - 1); }
      if (x < W - 1 && maske[j + 1] === 1) { maske[j + 1] = 2; yigin.push(j + 1); }
      if (y > 0 && maske[j - W] === 1) { maske[j - W] = 2; yigin.push(j - W); }
      if (y < H - 1 && maske[j + W] === 1) { maske[j + W] = 2; yigin.push(j + W); }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // Boyut: en küçük işaret yalnız "B)" etrafında (~11×12 pt), en büyüğü
    // bir satırlık şık ("E) I, II ve III"). Doluluk: kutunun içindeki
    // yazı pembeyi deliyor; yalnız kenar çizgisi olan bir çerçeve de 0.2
    // civarında kalıyor.
    if (
      w >= 7 * olcek && h >= 6 * olcek &&
      w <= 260 * olcek && h <= 60 * olcek &&
      sayi / (w * h) > 0.2
    ) {
      kutular.push({ x0, y0, x1, y1 });
    }
  }
  return kutular;
}

// -----------------------------------------------------------------------------
// 2. HARF TANIMA
// -----------------------------------------------------------------------------

/**
 * Bölgedeki en soldaki harfi `SABLON_EN × SABLON_BOY` ızgarasına indirger.
 * Her hücre: hücreye düşen piksellerin harfe ait olan oranı (0–1).
 *
 * Şablon üretimi (`scripts/sik-sablonlari.mjs`) de BU fonksiyonu kullanıyor;
 * kıyaslanan iki şey aynı yoldan geçiyor.
 */
export function enSoldakiHarf(g: Goruntu, k: Kutu, koyuEsigi = 128): Float32Array | null {
  const w = k.x1 - k.x0 + 1;
  const h = k.y1 - k.y0 + 1;
  if (w < 3 || h < 3) return null;
  const koyu = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((k.y0 + y) * g.genislik + (k.x0 + x)) * 4;
      const l = 0.3 * g.veri[i]! + 0.59 * g.veri[i + 1]! + 0.11 * g.veri[i + 2]!;
      if (l < koyuEsigi) koyu[y * w + x] = 1;
    }
  }

  // 8-komşu bağlı bileşenler.
  const etiket = new Int32Array(w * h);
  const bilesenler: Array<{ e: number; x0: number; y0: number; x1: number; y1: number; n: number }> = [];
  const yigin: number[] = [];
  let e = 0;
  for (let i = 0; i < w * h; i++) {
    if (!koyu[i] || etiket[i]) continue;
    e++;
    etiket[i] = e;
    yigin.push(i);
    let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
    while (yigin.length > 0) {
      const j = yigin.pop()!;
      const x = j % w;
      const y = (j - x) / w;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          if (koyu[q] && !etiket[q]) {
            etiket[q] = e;
            yigin.push(q);
          }
        }
      }
    }
    bilesenler.push({ e, x0, y0, x1, y1, n });
  }
  if (bilesenler.length === 0) return null;

  // Harf, yazının boyuna yakın ve bölgenin sol kenarına YAPIŞMAYAN en
  // soldaki bileşen. Küçük noktalar (gürültü) ve kesirlerin çizgisi elenir.
  const enBoy = Math.max(...bilesenler.map((c) => c.y1 - c.y0 + 1));
  const harf = bilesenler
    .filter((c) => c.y1 - c.y0 + 1 >= 0.45 * enBoy && c.n >= 8 && c.x0 > 0)
    .sort((a, z) => a.x0 - z.x0)[0];
  if (!harf) return null;

  const hw = harf.x1 - harf.x0 + 1;
  const hh = harf.y1 - harf.y0 + 1;
  const v = new Float32Array(SABLON_EN * SABLON_BOY);
  for (let gy = 0; gy < SABLON_BOY; gy++) {
    const ya = Math.floor((gy * hh) / SABLON_BOY);
    const yb = Math.max(ya + 1, Math.ceil(((gy + 1) * hh) / SABLON_BOY));
    for (let gx = 0; gx < SABLON_EN; gx++) {
      const xa = Math.floor((gx * hw) / SABLON_EN);
      const xb = Math.max(xa + 1, Math.ceil(((gx + 1) * hw) / SABLON_EN));
      let s = 0;
      let t = 0;
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          t++;
          if (etiket[(harf.y0 + y) * w + (harf.x0 + x)] === harf.e) s++;
        }
      }
      v[gy * SABLON_EN + gx] = t > 0 ? s / t : 0;
    }
  }
  return v;
}

function kosinus(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i]! * b[i]!;
    aa += a[i]! * a[i]!;
    bb += b[i]! * b[i]!;
  }
  return aa === 0 || bb === 0 ? 0 : ab / Math.sqrt(aa * bb);
}

export type HarfSonucu = {
  /** Emin olunan harf; emin olunamadıysa null. */
  harf: Harf | null;
  /** En iyi aday — emin olunmasa da (öğretmene "bakın" demek için). */
  aday: Harf | null;
  benzerlik: number;
  /** En iyi iki harfin benzerlik farkı. */
  fark: number;
};

/** Kutudaki şıkkın harfi. `sonSecenek` 'D' ise E adayı hiç değerlendirilmez. */
export function harfiTani(g: Goruntu, k: Kutu, sonSecenek: 'D' | 'E' = 'E'): HarfSonucu {
  const v = enSoldakiHarf(g, k);
  const bos: HarfSonucu = { harf: null, aday: null, benzerlik: 0, fark: 0 };
  if (!v) return bos;

  const izinli = sonSecenek === 'D' ? 'ABCD' : 'ABCDE';
  const puan = new Map<Harf, number>();
  for (const s of SIK_SABLONLARI) {
    if (!izinli.includes(s.harf)) continue;
    const p = kosinus(v, s.izgara);
    if (p > (puan.get(s.harf) ?? -1)) puan.set(s.harf, p);
  }
  const sira = [...puan.entries()].sort((a, z) => z[1] - a[1]);
  if (sira.length < 2) return bos;
  const [[aday, benzerlik], [, ikinci]] = sira as [[Harf, number], [Harf, number]];
  const fark = benzerlik - ikinci;
  const emin = benzerlik >= EN_AZ_BENZERLIK && fark >= EN_AZ_FARK;
  return { harf: emin ? aday : null, aday: benzerlik >= EN_AZ_BENZERLIK ? aday : null, benzerlik, fark };
}

// -----------------------------------------------------------------------------
// 3. KUTUYU SORUYA BAĞLAMA
// -----------------------------------------------------------------------------

/** Aynı sütundan sayılmak için numara x'leri arasındaki en büyük fark (punto). */
const SUTUN_TOLERANSI = 40;

/**
 * Sayfadaki soru numaralarının sütun başlangıçları (piksel x), artan sırada.
 * Tek sütunlu sayfada tek değer.
 */
export function sutunlar(numaralar: readonly Numara[], olcek: number): number[] {
  const xler = [...numaralar.map((n) => n.x)].sort((a, z) => a - z);
  const sonuc: number[] = [];
  for (const x of xler) {
    const son = sonuc[sonuc.length - 1];
    if (son === undefined || x - son > SUTUN_TOLERANSI * olcek) sonuc.push(x);
  }
  return sonuc;
}

function sutunu(x: number, basliklar: readonly number[], olcek: number): number {
  // Kutunun solundaki (biraz tolerans) en sağdaki sütun başlangıcı.
  let s = 0;
  basliklar.forEach((b, i) => {
    if (x >= b - 10 * olcek) s = i;
  });
  return s;
}

export type SayfaBulgusu = {
  sayfa: number;
  kutular: Array<{ kutu: Kutu; sonuc: HarfSonucu }>;
  numaralar: Numara[];
  olcek: number;
};

export type IsaretCikarimi = {
  anahtar: Record<number, Harf>;
  /** Emin olunamayan ya da iki farklı işaret taşıyan sorular. Boş bırakılır. */
  eminDegil: number[];
  /** İşaret kutusu bulunan soru sayısı (emin olunsun olunmasın). */
  isaretli: number;
};

/**
 * Bütün sayfaların bulgularını soru → şık anahtarına çevirir.
 *
 * Kutu, OKUMA SIRASINDA kendisinden hemen önce gelen numaraya ait:
 * sayfa → sütun → yukarıdan aşağı. Sayfanın ya da sütunun başındaki bir
 * kutu (soru bir önceki sütundan/sayfadan taşmış) böylece doğru soruya düşer.
 */
export function isaretlerdenAnahtar(bulgular: readonly SayfaBulgusu[], soruSayisi: number): IsaretCikarimi {
  type Yer = { sayfa: number; sutun: number; y: number };
  const once = (a: Yer, z: Yer) =>
    a.sayfa !== z.sayfa ? a.sayfa < z.sayfa : a.sutun !== z.sutun ? a.sutun < z.sutun : a.y < z.y;

  const numaraYerleri: Array<Yer & { no: number }> = [];
  for (const b of bulgular) {
    const bas = sutunlar(b.numaralar, b.olcek);
    for (const n of b.numaralar) {
      if (n.no < 1 || n.no > soruSayisi) continue;
      numaraYerleri.push({ sayfa: b.sayfa, sutun: sutunu(n.x, bas, b.olcek), y: n.y, no: n.no });
    }
  }

  const harfler = new Map<number, Set<Harf>>();
  // Emin olunamayan kutuların en iyi adayları, soru başına.
  const suphe = new Map<number, Set<Harf>>();
  for (const b of bulgular) {
    const bas = sutunlar(b.numaralar, b.olcek);
    for (const { kutu, sonuc } of b.kutular) {
      if (!sonuc.aday) continue; // harf yok: pembe ama şık değil
      const yer: Yer = { sayfa: b.sayfa, sutun: sutunu(kutu.x0, bas, b.olcek), y: kutu.y0 };
      let sahibi: (Yer & { no: number }) | undefined;
      for (const n of numaraYerleri) {
        if (once(n, yer) && (!sahibi || once(sahibi, n))) sahibi = n;
      }
      if (!sahibi) continue;
      const hedef = sonuc.harf ? harfler : suphe;
      const s = hedef.get(sahibi.no) ?? new Set<Harf>();
      s.add(sonuc.harf ?? sonuc.aday);
      hedef.set(sahibi.no, s);
    }
  }

  const anahtar: Record<number, Harf> = {};
  const eminDegil = new Set<number>();
  for (const no of new Set([...harfler.keys(), ...suphe.keys()])) {
    const emin = harfler.get(no) ?? new Set<Harf>();
    const supheli = suphe.get(no) ?? new Set<Harf>();
    const [tek] = emin;
    // Tek bir emin harf var ve şüpheli kutular (ör. aynı kutunun kenarı)
    // başka bir harfe işaret etmiyor → cevap. İki farklı harf, ya da yalnız
    // şüpheli kutu → öğretmen seçer.
    if (emin.size === 1 && tek && [...supheli].every((h) => h === tek)) anahtar[no] = tek;
    else eminDegil.add(no);
  }
  const isaretli = new Set([...harfler.keys(), ...suphe.keys()]).size;
  return { anahtar, eminDegil: [...eminDegil].sort((a, z) => a - z), isaretli };
}
