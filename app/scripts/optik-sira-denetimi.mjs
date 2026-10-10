/**
 * CEVAP OPTİĞİ SIRASI — YUKARIDAN AŞAĞI (Chromium, taklit RPC)
 *
 * Öğretmen: "Öğrenci cevap optiklerinde numaralandırma yukarıdan aşağıya
 * olsun. Yatay olunca öğrenciler yanlış işaretliyorlar." Kâğıt optik gibi:
 * 1. sütun 1–10, 2. sütun 11–20. Öğretmenin anahtar ızgarası da aynı sıra.
 *
 * Ölçü, her şık satırının EKRANDAKİ konumu (`boundingBox`):
 *  O1. Öğrenci, 800 px, 20 soru: 2 sütun; 2. satır 1.'nin altında ve aynı
 *      sütunda; 11. satır sağ sütunun en üstünde (1. ile aynı hizada);
 *      sütunlar 10 / 10.
 *  O2. 21 soru: sütunlar 11 / 10.
 *  O3. 390 px: tek sütun, 1…20 alt alta.
 *  O4. Öğretmen anahtar ızgarası, 1280 px, 30 soru: 3 sütun, 10 / 10 / 10;
 *      21. satır en sağ sütunun en üstünde.
 *  O5. Yatay taşma yok (360 / 800 / 1280 px).
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/optik-sira-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';
const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

async function ac({ rol, yol, en, soru }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 900 } });
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = {
      ogrenci_odevleri: {
        ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9A', tur: 'okul' }, dersler: [], okunmamis_mesaj: 0,
        odevler: [{ id: 'a1', baslik: 'Sayılar', aciklama: null, tur: 'test', son_tarih: gun(3), soru_sayisi: soru,
          gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null, gonderim: null,
          konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null }],
      },
      odev_sayfa_siniri: 1,
      odev_detay: { id: 'a1', baslik: 'Sayılar', aciklama: null, tur: 'test', sinif_id: 's1', sinif: '9A',
        son_tarih: gun(3), soru_sayisi: soru, gec_teslim: true, sik_sayisi: 5, cevap_anahtari: {}, konular: {},
        anahtar_yolu: null, odev_yolu: null, yayinda: false, gonderim_sayisi: 0, sayfa_limiti: 1 },
      siniflar_listesi: [{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false }],
      ben_kimim: { id: 'g', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null },
      konu_onerileri: [], odevler_listesi: [], ewalu_mesajlari: [],
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript((rol) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9A' } })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p };
}

/** Her sorunun satırının sol-üst köşesi: `[no, x, y]`. */
async function konumlar(p, soru) {
  const k = [];
  for (let no = 1; no <= soru; no++) {
    const li = p.getByRole('button', { name: `${no}. soru, A şıkkı`, exact: true }).locator('xpath=ancestor::li[1]');
    const kutu = await li.boundingBox();
    if (!kutu) { bozuk(`${no}. satır görünmüyor`); return null; }
    k.push([no, Math.round(kutu.x), Math.round(kutu.y)]);
  }
  return k;
}
/** Sütunlar soldan sağa; her biri yukarıdan aşağı soru numaraları. */
function sutunlar(k) {
  const xler = [...new Set(k.map(([, x]) => x))].sort((a, b) => a - b);
  return xler.map((x) => k.filter(([, kx]) => kx === x).sort((a, b) => a[2] - b[2]).map(([no]) => no));
}
const dizi = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i).join(',');
const tasma = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

console.log('--- O1. Öğrenci, 800 px, 20 soru ---');
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', en: 800, soru: 20 });
  const k = await konumlar(p, 20);
  if (k) {
    const s = sutunlar(k);
    (s.length === 2 ? tamam : bozuk)(`2 sütun (${s.length})`);
    (s[0]?.join(',') === dizi(1, 10) && s[1]?.join(',') === dizi(11, 20) ? tamam : bozuk)(
      `sol sütun 1–10, sağ 11–20 (${s.map((c) => c.join(' ')).join(' | ')})`);
    (k[1][1] === k[0][1] && k[1][2] > k[0][2] ? tamam : bozuk)('2. satır 1.nin altında, aynı sütunda');
    (Math.abs(k[10][2] - k[0][2]) <= 1 && k[10][1] > k[0][1] ? tamam : bozuk)(`11. satır sağ sütunun en üstünde (1: y=${k[0][2]}, 11: y=${k[10][2]})`);
  }
  (await tasma(p) <= 0 ? tamam : bozuk)('800 px yatay taşma yok');
  await b.close();
}

console.log('--- O2. 21 soru: 11 / 10 ---');
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', en: 800, soru: 21 });
  const k = await konumlar(p, 21);
  if (k) {
    const s = sutunlar(k);
    (s[0]?.join(',') === dizi(1, 11) && s[1]?.join(',') === dizi(12, 21) ? tamam : bozuk)(
      `sütunlar ${s.map((c) => c.length).join(' / ')}`);
  }
  await b.close();
}

console.log('--- O3. 390 px: tek sütun ---');
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', en: 390, soru: 20 });
  const k = await konumlar(p, 20);
  if (k) {
    const s = sutunlar(k);
    (s.length === 1 && s[0].join(',') === dizi(1, 20) ? tamam : bozuk)(`tek sütun, 1…20 alt alta (${s.length} sütun)`);
  }
  await b.close();
}

console.log('--- O4. Öğretmen anahtar ızgarası, 1280 px, 30 soru ---');
{
  const { b, p } = await ac({ rol: 'ogretmen', yol: '/ogretmen/odevler/a1', en: 1280, soru: 30 });
  const goster = p.getByRole('button', { name: /cevabı göster/ });
  if (await goster.count()) { await goster.click(); await p.waitForTimeout(200); }
  const k = await konumlar(p, 30);
  if (k) {
    const s = sutunlar(k);
    (s.length === 3 ? tamam : bozuk)(`3 sütun (${s.length})`);
    (s.map((c) => c.join(',')).join('|') === [dizi(1, 10), dizi(11, 20), dizi(21, 30)].join('|') ? tamam : bozuk)(
      `1–10 / 11–20 / 21–30 (${s.map((c) => `${c[0]}–${c.at(-1)}`).join(' / ')})`);
    (Math.abs(k[20][2] - k[0][2]) <= 1 ? tamam : bozuk)('21. satır en sağ sütunun en üstünde');
  }
  (await tasma(p) <= 0 ? tamam : bozuk)('1280 px yatay taşma yok');
  await b.close();
}

console.log('--- O5. 360 px taşma ---');
for (const [rol, yol] of [['ogrenci', '/ogrenci/odev/a1'], ['ogretmen', '/ogretmen/odevler/a1']]) {
  const { b, p } = await ac({ rol, yol, en: 360, soru: 20 });
  (await tasma(p) <= 0 ? tamam : bozuk)(`${rol}: 360 px yatay taşma yok`);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`OPTİK SIRA DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('OPTİK SIRA DENETİMİ GEÇTİ');
