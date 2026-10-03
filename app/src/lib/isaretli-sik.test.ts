import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  EN_AZ_FARK,
  daireler,
  harfiTani,
  isaretlerdenAnahtar,
  kalemDaireleri,
  kalemHarfiTani,
  kirmiziMi,
  maviMi,
  pembeKutular,
  pembeMi,
  renkliMi,
  sutunlar,
  type Goruntu,
  type HarfSonucu,
  type Kutu,
  type SayfaBulgusu,
} from './isaretli-sik';

/**
 * Kesitler öğretmenin gerçek cevap anahtarından ("…Üslü ve Köklü…
 * Çözüm.pdf"), uygulamanın kendi çizim yoluyla (ölçek ≈3) alındı: yalnız
 * işaret kutusu — soru metni yok. Dosya adı beklenen harfle başlıyor;
 * `x_` ile başlayanlarda harf OKUNMAMALI.
 */
const KESITLER = resolve(__dirname, '__fixtures__/isaretli-sik');

async function oku(dosya: string): Promise<Goruntu> {
  const { data, info } = await sharp(resolve(KESITLER, dosya))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { veri: new Uint8ClampedArray(data), genislik: info.width, yukseklik: info.height };
}

const tamami = (g: Goruntu): Kutu => ({ x0: 0, y0: 0, x1: g.genislik - 1, y1: g.yukseklik - 1 });

describe('harfiTani — gerçek kesitler', () => {
  const dosyalar = readdirSync(KESITLER).filter((d) => d.endsWith('.png'));

  it('kesitler yerinde', () => {
    expect(dosyalar.length).toBeGreaterThanOrEqual(12);
  });

  for (const dosya of dosyalar.filter((d) => !d.startsWith('x_'))) {
    const beklenen = dosya[0];
    it(`${dosya} → ${beklenen}, emin`, async () => {
      const g = await oku(dosya);
      const s = harfiTani(g, tamami(g));
      expect(s.harf).toBe(beklenen);
      expect(s.fark).toBeGreaterThanOrEqual(EN_AZ_FARK);
    });
  }

  it('ÜSTÜNE EL YAZISI BİNMİŞ harfi UYDURMAZ (gerçek PDF\'in 42. sorusu)', async () => {
    const g = await oku('x_el_yazisi.png');
    expect(harfiTani(g, tamami(g)).harf).toBeNull();
  });

  it('pembe gölge (kırmızı çizginin kenarı) harf sayılmaz', async () => {
    const g = await oku('x_pembe_golge.png');
    const s = harfiTani(g, tamami(g));
    expect(s.harf).toBeNull();
    expect(s.aday).toBeNull();
  });

  it('A–D seçildiyse E ADAYI HİÇ DEĞERLENDİRİLMEZ', async () => {
    const g = await oku('E_I_ve_III.png');
    expect(harfiTani(g, tamami(g), 'D').harf).not.toBe('E');
  });
});

/** Beyaz bir sayfa; istenen dikdörtgenler istenen renkte. */
function sayfa(w: number, h: number, boyalar: Array<[Kutu, [number, number, number]]>): Goruntu {
  const veri = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [k, [r, g, b]] of boyalar) {
    for (let y = k.y0; y <= k.y1; y++) {
      for (let x = k.x0; x <= k.x1; x++) {
        const i = (y * w + x) * 4;
        veri[i] = r;
        veri[i + 1] = g;
        veri[i + 2] = b;
      }
    }
  }
  return { veri, genislik: w, yukseklik: h };
}

const PEMBE: [number, number, number] = [223, 200, 198];

describe('pembeKutular', () => {
  it('ölçülen işaret rengi pembe; beyaz, gri, kırmızı mürekkep değil', () => {
    expect(pembeMi(...PEMBE)).toBe(true);
    expect(pembeMi(255, 255, 255)).toBe(false);
    expect(pembeMi(200, 200, 200)).toBe(false);
    expect(pembeMi(150, 40, 40)).toBe(false);
  });

  it('boyut süzgeci: şık kutusu evet; ince çizgi ve sayfa boyu alan hayır', () => {
    const g = sayfa(400, 300, [
      [{ x0: 10, y0: 10, x1: 60, y1: 30 }, PEMBE], // şık kutusu (ölçek 1: 51×21 pt)
      [{ x0: 10, y0: 100, x1: 390, y1: 101 }, PEMBE], // ince çizgi
    ]);
    expect(pembeKutular(g, 1)).toEqual([{ x0: 10, y0: 10, x1: 60, y1: 30 }]);
  });

  it('boyutlar puntoyla: ölçek 3\'te aynı kutu yine bulunur', () => {
    const g = sayfa(300, 150, [[{ x0: 30, y0: 30, x1: 180, y1: 90 }, PEMBE]]);
    expect(pembeKutular(g, 3)).toHaveLength(1);
    // Ölçek 30'da aynı kutu 5×2 punto: çok küçük.
    expect(pembeKutular(g, 30)).toHaveLength(0);
  });
});

/**
 * KALEM DAİRESİ — öğretmenin "9. Sınıf Sayılar 117 Soru" cevap anahtarından
 * kesitler (ölçek 3): mavi ya da kırmızı kalemle çizilmiş daire, etrafında
 * 12 punto pay. `x_` ile başlayanlarda harf OKUNMAMALI:
 *  - x_el_yazisi_halka: el yazısındaki "[" — eskiden "B" okunuyordu,
 *  - x_C_kayik_daire_*: daire "C)"nin sağına kaymış — eskiden "D" okunuyordu.
 */
const KALEM = resolve(KESITLER, 'kalem');
async function kalemOku(dosya: string): Promise<Goruntu> {
  const { data, info } = await sharp(resolve(KALEM, dosya)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { veri: new Uint8ClampedArray(data), genislik: info.width, yukseklik: info.height };
}

describe('kalem dairesi — gerçek kesitler', () => {
  const dosyalar = readdirSync(KALEM).filter((d) => d.endsWith('.png'));

  it('kesitler yerinde', () => {
    expect(dosyalar.length).toBeGreaterThanOrEqual(10);
  });

  for (const dosya of dosyalar.filter((d) => !d.startsWith('x_'))) {
    const beklenen = dosya[0];
    it(`${dosya} → daire bulunur, ${beklenen} emin`, async () => {
      const g = await kalemOku(dosya);
      const harfler = kalemDaireleri(g, 3)
        .map((k) => kalemHarfiTani(g, k).harf)
        .filter((h) => h !== null);
      expect(harfler).toEqual([beklenen]);
    });
  }

  for (const dosya of dosyalar.filter((d) => d.startsWith('x_'))) {
    it(`${dosya} → hiçbir harf EMİN okunmaz`, async () => {
      const g = await kalemOku(dosya);
      const harfler = kalemDaireleri(g, 3).map((k) => kalemHarfiTani(g, k).harf);
      expect(harfler.filter((h) => h !== null)).toEqual([]);
    });
  }
});

describe('kalem renkleri ve daire süzgeci', () => {
  it('ölçülen renkler: mavi ve kırmızı kalem evet; siyah, sarı, pembe hayır', () => {
    expect(maviMi(16, 48, 176)).toBe(true);
    expect(kirmiziMi(224, 0, 0)).toBe(true);
    for (const [r, g, b] of [[0, 0, 0], [60, 60, 60], [255, 230, 150], [223, 200, 198]] as const) {
      expect(maviMi(r, g, b) || kirmiziMi(r, g, b)).toBe(false);
    }
  });

  it('renkli: lacivert mürekkebin koyu yeri de renkli, siyah baskı değil', () => {
    expect(renkliMi(32, 48, 96)).toBe(true);
    expect(renkliMi(20, 20, 25)).toBe(false);
  });

  /** Ölçek 1'de (x0,y0)'dan başlayan, `boy` puntoluk, `kalinlik` kalın halka. */
  function halka(g: Goruntu, x0: number, y0: number, boy: number, kalinlik: number, renk: [number, number, number]) {
    const c = boy / 2;
    for (let y = 0; y < boy; y++) {
      for (let x = 0; x < boy; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        if (d <= c && d >= c - kalinlik) {
          const i = ((y0 + y) * g.genislik + (x0 + x)) * 4;
          g.veri[i] = renk[0];
          g.veri[i + 1] = renk[1];
          g.veri[i + 2] = renk[2];
        }
      }
    }
  }

  it('içi boş halka daire; dolu leke, çok küçük ve çok büyük halka değil', () => {
    const MAVI: [number, number, number] = [16, 48, 176];
    const g = sayfa(200, 60, [[{ x0: 60, y0: 10, x1: 72, y1: 22 }, MAVI]]); // dolu leke
    halka(g, 10, 10, 13, 2, MAVI); // şık dairesi
    halka(g, 100, 10, 4, 1, MAVI); // nokta
    halka(g, 120, 5, 40, 2, MAVI); // büyük çember (çizim)
    expect(daireler(g, 1, maviMi)).toEqual([{ x0: 10, y0: 10, x1: 22, y1: 22 }]);
  });

  it('içinde basılı harf olmayan halka (el yazısı "0") harf vermez', () => {
    const g = sayfa(60, 60, []);
    halka(g, 20, 20, 13, 2, [16, 48, 176]);
    const [k] = daireler(g, 1, maviMi);
    expect(k).toBeDefined();
    expect(kalemHarfiTani(g, k!).aday).toBeNull();
  });
});

const emin = (harf: 'A' | 'B' | 'C' | 'D' | 'E'): HarfSonucu => ({ harf, aday: harf, benzerlik: 0.9, fark: 0.2 });
const supheli = (aday: 'A' | 'B' | 'C' | 'D' | 'E'): HarfSonucu => ({ harf: null, aday, benzerlik: 0.6, fark: 0.01 });
const kutu = (x: number, y: number): Kutu => ({ x0: x, y0: y, x1: x + 20, y1: y + 10 });

describe('isaretlerdenAnahtar — kutuyu soruya bağlama', () => {
  // İki sütunlu sayfa: sol sütun numaraları x=60, sağ x=306 (ölçek 1).
  const sayfa1: SayfaBulgusu = {
    sayfa: 1,
    olcek: 1,
    numaralar: [
      { no: 1, x: 60, y: 100 },
      { no: 2, x: 60, y: 400 },
      { no: 3, x: 306, y: 100 },
    ],
    kutular: [
      { kutu: kutu(80, 200), sonuc: emin('A') }, // 1
      { kutu: kutu(250, 450), sonuc: emin('C') }, // sol sütunun sağında (E şıkkı) → yine 2
      { kutu: kutu(330, 50), sonuc: emin('D') }, // sağ sütunun en üstü → 2'nin devamı
      { kutu: kutu(330, 200), sonuc: emin('B') }, // 3
    ],
  };

  it('sütun sütun, yukarıdan aşağı okuma sırası', () => {
    const s = isaretlerdenAnahtar([sayfa1], 5);
    expect(s.anahtar[1]).toBe('A');
    expect(s.anahtar[3]).toBe('B');
    // 2 için iki FARKLI emin harf (C ve D): hangisi bilinemez → öğretmen seçer.
    expect(s.anahtar[2]).toBeUndefined();
    expect(s.eminDegil).toEqual([2]);
  });

  it('sayfanın başındaki kutu önceki sayfanın son sorusuna ait', () => {
    const sayfa2: SayfaBulgusu = {
      sayfa: 2,
      olcek: 1,
      numaralar: [{ no: 4, x: 60, y: 300 }],
      kutular: [
        { kutu: kutu(80, 50), sonuc: emin('E') }, // 3'ün devamı
        { kutu: kutu(80, 350), sonuc: emin('C') }, // 4
      ],
    };
    const tek = { ...sayfa1, kutular: [] };
    const s = isaretlerdenAnahtar([tek, sayfa2], 5);
    expect(s.anahtar).toEqual({ 3: 'E', 4: 'C' });
  });

  it('aynı kutunun kenarı ve dolgusu (aynı harf) tek cevap', () => {
    const b: SayfaBulgusu = {
      sayfa: 1,
      olcek: 1,
      numaralar: [{ no: 1, x: 60, y: 10 }],
      kutular: [
        { kutu: kutu(80, 50), sonuc: emin('E') },
        { kutu: kutu(81, 51), sonuc: emin('E') },
        { kutu: kutu(81, 51), sonuc: supheli('E') },
      ],
    };
    const s = isaretlerdenAnahtar([b], 1);
    expect(s.anahtar).toEqual({ 1: 'E' });
    expect(s.eminDegil).toEqual([]);
  });

  it('yalnız emin olunamayan kutu → soru boş, "emin değil"', () => {
    const b: SayfaBulgusu = {
      sayfa: 1,
      olcek: 1,
      numaralar: [{ no: 1, x: 60, y: 10 }],
      kutular: [{ kutu: kutu(80, 50), sonuc: supheli('B') }],
    };
    const s = isaretlerdenAnahtar([b], 1);
    expect(s.anahtar).toEqual({});
    expect(s.eminDegil).toEqual([1]);
    expect(s.isaretli).toBe(1);
  });

  it('harfsiz pembe alan ve numarasız kutu hiçbir soruya yazılmaz', () => {
    const b: SayfaBulgusu = {
      sayfa: 1,
      olcek: 1,
      numaralar: [{ no: 1, x: 60, y: 300 }],
      kutular: [
        { kutu: kutu(80, 50), sonuc: emin('A') }, // hiçbir numaradan sonra değil
        { kutu: kutu(80, 350), sonuc: { harf: null, aday: null, benzerlik: 0, fark: 0 } },
      ],
    };
    const s = isaretlerdenAnahtar([b], 1);
    expect(s.anahtar).toEqual({});
    expect(s.isaretli).toBe(0);
  });

  it('soru sayısının dışındaki numara yok sayılır', () => {
    const b: SayfaBulgusu = {
      sayfa: 1,
      olcek: 1,
      numaralar: [{ no: 1, x: 60, y: 10 }, { no: 99, x: 60, y: 100 }],
      kutular: [{ kutu: kutu(80, 150), sonuc: emin('D') }],
    };
    expect(isaretlerdenAnahtar([b], 5).anahtar).toEqual({ 1: 'D' });
  });

  it('sütunlar: yakın x\'ler tek sütun', () => {
    expect(sutunlar([{ no: 1, x: 60, y: 0 }, { no: 2, x: 62, y: 0 }, { no: 3, x: 306, y: 0 }], 1)).toEqual([60, 306]);
    expect(sutunlar([{ no: 1, x: 60, y: 0 }], 1)).toEqual([60]);
  });
});
