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
 * ## İkinci biçim: elle çizilmiş KALEM DAİRESİ (mavi ya da kırmızı)
 *
 * Öğretmenin "9. Sınıf Sayılar 117 Soru Çözümlü Cevap Anahtarı" PDF'inde
 * doğru şık pembe kutuyla değil, kalemle çizilmiş bir DAİREYLE işaretli —
 * bazı sayfalarda mavi, bazılarında kırmızı kalem. Çözümler de aynı mavi
 * kalemle yazılmış; dairenin el yazısından ayrılması şuna dayanıyor: daire
 * küçük, yuvarlağa yakın, içi BOŞ bir halka ve İÇİNDE BASILI SİYAH bir şık
 * harfi var (`kalemDaireleri`). Harf tanınırken kalem pikselleri yok
 * sayılıyor (çizgi harfin üstünden geçebiliyor). El yazısındaki "0", "6"
 * gibi halkaların içinde basılı harf yok → elenir.
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

/** Piksel rengine göre evet/hayır (kalem rengi, harf ararken yok sayılan). */
export type PikselSuzgeci = (r: number, g: number, b: number) => boolean;

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
// 1b. MAVİ DAİRELER
// -----------------------------------------------------------------------------

/**
 * Mavi tükenmez kalem. Ölçülen (117 soruluk PDF): R 0–50, G 48–80,
 * B 144–192. Siyah baskı (B−R ≈ 0), sarı fosforlu kalem ve pembe dışarıda.
 */
export function maviMi(r: number, g: number, b: number): boolean {
  return b >= 100 && b - r >= 50 && b - g >= 40;
}

/**
 * Kırmızı kalem. Ölçülen: R 190–240, G ve B 0–30. Pembe işaret kutusu
 * (R−G ≈ 25) ve kenar yumuşatmasının açık pembesi (R−G ≈ 80) dışarıda.
 */
export function kirmiziMi(r: number, g: number, b: number): boolean {
  return r >= 150 && r - g >= 110 && r - b >= 110;
}

/** Herhangi bir kalem rengi. */
export function kalemMi(r: number, g: number, b: number): boolean {
  return maviMi(r, g, b) || kirmiziMi(r, g, b);
}

/**
 * RENKLİ piksel: kanallar arası fark büyük. Kalem dairesinin içinde harf
 * aranırken bunlar yok sayılıyor — basılı şık harfi SİYAH (R≈G≈B), kalem
 * ise her tonuyla renkli. Yalnız `kalemMi`yi dışlamak yetmiyordu:
 * lacivert mürekkebin en koyu yerleri (ör. R 32, G 48, B 96) mavi
 * eşiğinin altında kalıp basılı harf sanılıyordu (117 soruluk PDF'te el
 * yazısındaki bir köşeli parantez "B" okunmuştu).
 */
export function renkliMi(r: number, g: number, b: number): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) > 50;
}

/**
 * Kalem dairesinde harfi kabul etmek için en az benzerlik. Pembe kutudan
 * daha sıkı, çünkü kalem çoğu zaman harfin üstünden geçiyor ve harfin bir
 * kısmı siliniyor. Ölçüm (117 soruluk PDF): yanlış okunanların en
 * yükseği 0.77; eşik bunun üstünde. İstisna: A harfi diğerlerinden çok
 * farklı (fark ≥ 0.3) — orada fark yeterli kanıt.
 */
export const KALEM_EN_AZ_BENZERLIK = 0.75;
/** Kalem dairesinde en iyi iki harfin farkı (pembe kutudaki 0.05'ten sıkı). */
export const KALEM_EN_AZ_FARK = 0.05;
export const KALEM_TEK_BASINA_FARK = 0.3;

/**
 * Elle çizilmiş şık daireleri: mavi ya da kırmızı kalem. Her renk AYRI
 * aranıyor — kırmızı bir daire mavi el yazısına değse bile ikisi tek
 * parça sayılmasın.
 */
export function kalemDaireleri(g: Goruntu, olcek: number): Kutu[] {
  return [...daireler(g, olcek, maviMi), ...daireler(g, olcek, kirmiziMi)];
}

/**
 * Tek renkte şık daireleri: küçük, yuvarlağa yakın, içi boş.
 *
 * Kalem çizgisi kenar yumuşatması yüzünden kesik kesik çıkabiliyor; bu
 * yüzden bileşen kurulurken 2 piksellik boşluklar köprüleniyor.
 *
 * Süzgeçler punto cinsinden (ölçülen daireler 9–14 pt, doluluk ~0.3):
 *  - en ve boy 6–24 pt, en/boy oranı 0.5–2,
 *  - doluluk ≤ 0.5 (halka; dolu bir el yazısı lekesi değil),
 *  - ortadaki bölge neredeyse boş (≤ %15 kalem).
 * El yazısında bu şartları sağlayan halkalar ("0", "6") yine geçebilir;
 * onları `harfiTani`'nın İÇERİDE BASILI HARF araması eliyor.
 */
export function daireler(g: Goruntu, olcek: number, renk: PikselSuzgeci): Kutu[] {
  const { veri, genislik: W, yukseklik: H } = g;
  const maske = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (renk(veri[i * 4]!, veri[i * 4 + 1]!, veri[i * 4 + 2]!)) maske[i] = 1;
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
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (maske[q] === 1) {
            maske[q] = 2;
            yigin.push(q);
          }
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w < 6 * olcek || h < 6 * olcek || w > 24 * olcek || h > 24 * olcek) continue;
    if (w / h < 0.5 || w / h > 2) continue;
    if (sayi / (w * h) > 0.5) continue;

    // Orta bölge (ortadaki %40 × %40) boş olmalı: halka.
    const ox0 = x0 + Math.round(w * 0.3);
    const ox1 = x1 - Math.round(w * 0.3);
    const oy0 = y0 + Math.round(h * 0.3);
    const oy1 = y1 - Math.round(h * 0.3);
    let orta = 0;
    let ortaKalem = 0;
    for (let y = oy0; y <= oy1; y++) {
      for (let x = ox0; x <= ox1; x++) {
        orta++;
        const k = (y * W + x) * 4;
        if (renk(veri[k]!, veri[k + 1]!, veri[k + 2]!)) ortaKalem++;
      }
    }
    if (orta === 0 || ortaKalem / orta > 0.15) continue;

    kutular.push({ x0, y0, x1, y1 });
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
export function enSoldakiHarf(
  g: Goruntu,
  k: Kutu,
  koyuEsigi = 128,
  haric?: PikselSuzgeci,
  /** Verilirse yalnız MERKEZİ bu kutunun içinde kalan bileşen harf sayılır. */
  merkez?: Kutu,
): Float32Array | null {
  const w = k.x1 - k.x0 + 1;
  const h = k.y1 - k.y0 + 1;
  if (w < 3 || h < 3) return null;
  const koyu = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((k.y0 + y) * g.genislik + (k.x0 + x)) * 4;
      const r = g.veri[i]!;
      const gr = g.veri[i + 1]!;
      const b = g.veri[i + 2]!;
      const l = 0.3 * r + 0.59 * gr + 0.11 * b;
      if (l < koyuEsigi && !haric?.(r, gr, b)) koyu[y * w + x] = 1;
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
  const icinde = (c: { x0: number; y0: number; x1: number; y1: number }) => {
    if (!merkez) return true;
    // ")" gibi İNCE işaretler harf değil: büyütülünce D'nin sağ yarısına
    // benziyordu ve "C)" çevresindeki daire D okunuyordu. A–E'nin en/boy
    // oranı ~0.6–1.1.
    const oran = (c.x1 - c.x0 + 1) / (c.y1 - c.y0 + 1);
    if (oran < 0.45 || oran > 1.6) return false;
    const mx = k.x0 + (c.x0 + c.x1) / 2;
    const my = k.y0 + (c.y0 + c.y1) / 2;
    return mx >= merkez.x0 && mx <= merkez.x1 && my >= merkez.y0 && my <= merkez.y1;
  };
  const harf = bilesenler
    .filter((c) => c.y1 - c.y0 + 1 >= 0.45 * enBoy && c.n >= 8 && c.x0 > 0 && icinde(c))
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
  if (!v) return { harf: null, aday: null, benzerlik: 0, fark: 0 };
  return harfiPuanla(v, sonSecenek);
}

/** Izgarayı A–E şablonlarıyla kıyaslar (pembe kutu eşikleriyle). */
function harfiPuanla(v: Float32Array, sonSecenek: 'D' | 'E'): HarfSonucu {
  const bos: HarfSonucu = { harf: null, aday: null, benzerlik: 0, fark: 0 };
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

/**
 * Kalem dairesindeki şıkkın harfi.
 *
 * Harf dairenin kutusundan biraz TAŞABİLİYOR (dar çizilmiş daire, ör.
 * "C)" etrafında): arama alanı her yandan dairenin yarısı kadar
 * genişletiliyor, ama yalnız MERKEZİ dairenin içinde kalan bileşen harf
 * sayılıyor — yandaki şıkkın harfi karışmasın. Renkli pikseller (kalem)
 * yok sayılıyor. Emin olmak için `KALEM_EN_AZ_BENZERLIK` gerekiyor.
 */
export function kalemHarfiTani(
  g: Goruntu,
  daire: Kutu,
  sonSecenek: 'D' | 'E' = 'E',
): HarfSonucu {
  const w = daire.x1 - daire.x0 + 1;
  const h = daire.y1 - daire.y0 + 1;
  const arama: Kutu = {
    x0: Math.max(0, daire.x0 - Math.round(w / 2)),
    y0: Math.max(0, daire.y0 - Math.round(h / 2)),
    x1: Math.min(g.genislik - 1, daire.x1 + Math.round(w / 2)),
    y1: Math.min(g.yukseklik - 1, daire.y1 + Math.round(h / 2)),
  };
  // Merkez payı YOK: denendi, daire yandaki şık METNİNE taşınca metindeki
  // bir harf ("C) A < C < B" içindeki A) yüksek benzerlikle seçildi.
  const v = enSoldakiHarf(g, arama, 128, renkliMi, daire);
  const bos: HarfSonucu = { harf: null, aday: null, benzerlik: 0, fark: 0 };
  if (!v) return bos;
  const sonuc = harfiPuanla(v, sonSecenek);
  const emin =
    sonuc.aday !== null &&
    sonuc.fark >= KALEM_EN_AZ_FARK &&
    (sonuc.benzerlik >= KALEM_EN_AZ_BENZERLIK || sonuc.fark >= KALEM_TEK_BASINA_FARK);
  return { ...sonuc, harf: emin ? sonuc.aday : null };
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
