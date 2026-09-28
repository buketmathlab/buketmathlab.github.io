/**
 * ŞIK HARFİ ŞABLONLARINI ÜRETİR — `npm run sik-sablonlari`
 *
 * `lib/isaretli-sik.ts` pembe kutudaki harfi A–E şablonlarıyla kıyaslıyor.
 * Şablonlar ÇALIŞMA ANINDA değil burada, bir kez üretiliyor ve
 * `src/lib/sik-sablonlari.ts`'e sabit olarak yazılıyor:
 *
 *  - Belirlenimci: öğretmenin iPad'inde, Windows'ta, testte aynı sayılar.
 *    Çalışma anında `fillText` ile çizseydik sonuç cihazın yazı tiplerine
 *    göre değişirdi.
 *  - Birim testi (jsdom, canvas yok) aynı şablonlarla koşuyor.
 *
 * Harfler Chromium'da çizilip `enSoldakiHarf` ile — kutudaki harfin
 * geçtiği AYNI fonksiyonla — ızgaraya indiriliyor; kıyaslanan iki taraf
 * aynı yoldan geçiyor. Yazı tipleri ders kitaplarının şık harflerine
 * yakın olanlar: Helvetica benzeri (FreeSans), Arial benzeri (Liberation
 * Sans), DejaVu ve üç tırnaklı yazı tipi; düz ve kalın.
 *
 * Kullanım:  npm run sik-sablonlari
 */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const BURASI = dirname(fileURLToPath(import.meta.url));
const HEDEF = resolve(BURASI, '../src/lib/sik-sablonlari.ts');

const YAZILAR = [
  'FreeSans', 'bold FreeSans', 'Liberation Sans', 'bold Liberation Sans',
  'DejaVu Sans', 'Liberation Serif', 'FreeSerif', 'DejaVu Serif',
];
const HARFLER = ['A', 'B', 'C', 'D', 'E'];

// `enSoldakiHarf`'i TypeScript kaynağından derleyip al.
const gecici = mkdtempSync(join(tmpdir(), 'sik-'));
const derli = join(gecici, 'isaretli-sik.mjs');
await build({
  entryPoints: [resolve(BURASI, '../src/lib/isaretli-sik.ts')],
  bundle: true, format: 'esm', outfile: derli, logLevel: 'error',
});
const { enSoldakiHarf, SABLON_EN, SABLON_BOY } = await import(pathToFileURL(derli).href);

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
const BOYUT = 160;
const cizimler = await sayfa.evaluate(({ YAZILAR, HARFLER, BOYUT }) => {
  const sonuc = [];
  for (const yazi of YAZILAR) {
    for (const harf of HARFLER) {
      const c = document.createElement('canvas');
      c.width = BOYUT;
      c.height = BOYUT;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff';
      x.fillRect(0, 0, BOYUT, BOYUT);
      x.fillStyle = '#000';
      x.font = `100px ${yazi}`;
      // Şıkta harfin peşinden ")" geliyor; aynı biçimde çiziliyor.
      x.fillText(harf + ')', 12, 125);
      sonuc.push({ yazi, harf, veri: Array.from(x.getImageData(0, 0, BOYUT, BOYUT).data) });
    }
  }
  return sonuc;
}, { YAZILAR, HARFLER, BOYUT });
await tarayici.close();

const satirlar = [];
for (const { yazi, harf, veri } of cizimler) {
  const v = enSoldakiHarf(
    { veri: Uint8ClampedArray.from(veri), genislik: BOYUT, yukseklik: BOYUT },
    { x0: 0, y0: 0, x1: BOYUT - 1, y1: BOYUT - 1 },
  );
  if (!v) throw new Error(`${yazi} ${harf}: harf bulunamadı`);
  // Hücre değeri 0–9'a nicemleniyor: 480 karakterlik bir satır.
  const dizi = Array.from(v, (d) => Math.min(9, Math.round(d * 9))).join('');
  satirlar.push(`  ['${harf}', '${yazi}', '${dizi}'],`);
}
rmSync(gecici, { recursive: true, force: true });

writeFileSync(
  HEDEF,
  `/**
 * ŞIK HARFİ ŞABLONLARI — ÜRETİLDİ, ELLE DEĞİŞTİRMEYİN.
 *
 * Üreten: \`npm run sik-sablonlari\` (app/scripts/sik-sablonlari.mjs).
 * Her satır: harf, yazı tipi, ${SABLON_EN}×${SABLON_BOY} ızgaranın 0–9'a nicemlenmiş
 * hücreleri (hücreye düşen piksellerin harfe ait olma oranı).
 */

export const SABLON_EN = ${SABLON_EN};
export const SABLON_BOY = ${SABLON_BOY};

type SablonHarfi = 'A' | 'B' | 'C' | 'D' | 'E';

const HAM: ReadonlyArray<readonly [SablonHarfi, string, string]> = [
${satirlar.join('\n')}
];

export const SIK_SABLONLARI: ReadonlyArray<{ harf: SablonHarfi; yazi: string; izgara: Float32Array }> =
  HAM.map(([harf, yazi, dizi]) => ({
    harf,
    yazi,
    izgara: Float32Array.from(dizi, (c) => Number(c) / 9),
  }));
`,
);
console.log(`sik-sablonlari.ts yazıldı — ${satirlar.length} şablon`);
