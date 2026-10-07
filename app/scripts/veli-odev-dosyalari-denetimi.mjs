/**
 * VELİ ÖDEV KARTINDAN SORULAR VE ÇÖZÜM (Chromium, taklit RPC) — 0071
 *
 * Öğretmen veli hesabında ödev kartına dokundu, hiçbir şey açılmadı.
 * Kararı: "Çözüm + soru PDF'i" — veli ikisini de açabilsin, anahtarı asla.
 *
 *  V1. Gönderilmiş ödev: "Soruları aç (PDF)" soru yolunu, "Çözümü aç" tek
 *      sayfalık çözümün yolunu istiyor; sekme imzalı adrese gidiyor.
 *  V2. Üç sayfalık çözüm: "Çözümü aç" sayfa düğmelerini açıyor (1., 2., 3.),
 *      her biri kendi yolunu istiyor.
 *  V3. Gönderilmemiş ödev: yalnız "Soruları aç (PDF)".
 *  V4. 0071 öncesi (alanlar yok): ekran hatasız, düğme yok.
 *  V5. Ekranda "anahtar" yazısı yok; hiçbir istek anahtar yolu istemiyor.
 *  V6. 360 px'de yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/veli-odev-dosyalari-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const IMZALI = KOK + 'surum.json?imzali=1';

const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const satir = (baslik, ek) => ({
  baslik, son_tarih: gun(-3), olusturma: gun(-10), gonderildi: true,
  gonderim_zamani: gun(-4) + 'T20:04:00Z', puan: 74.51, durum: 'puanlandi',
  yanlis_sorular: [5, 6], bos_sorular: [13], konu_analizi: [], kiyas: null, ...ek,
});
const TAM = [
  satir('Üslü sayılar', { odev_yolu: 'odev/us/sorular.pdf', cozum_yollari: ['cozum/us/c.jpg'] }),
  satir('Köklü sayılar', {
    odev_yolu: 'odev/kok/sorular.pdf',
    cozum_yollari: ['cozum/kok/c.jpg', 'cozum/kok/c-2.jpg', 'cozum/kok/c-3.jpg'],
  }),
  { ...satir('Sayı aralıkları', { odev_yolu: 'odev/ara/sorular.pdf', cozum_yollari: [] }),
    son_tarih: gun(2), gonderildi: false, gonderim_zamani: null, puan: null, durum: null,
    yanlis_sorular: [], bos_sorular: [] },
];
const ESKI = TAM.map((r) => {
  const k = { ...r };
  delete k.odev_yolu;
  delete k.cozum_yollari;
  return k;
});

async function kur(odevler, en = 390) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  await s.addInitScript(({ odevler, IMZALI }) => {
    if (location.search.includes('imzali')) return;
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'veli', token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Cihan Deniz', tur: 'okul', sinif: '9B' } }));
    window.__yollar = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__yollar.push(JSON.parse(String(o?.body ?? '{}')).yol);
        return json({ imzaliUrl: IMZALI, gecerlilikSn: 60 });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      if (m[1] === 'veli_paneli') {
        return json({ ogrenci: { ad: 'Cihan Deniz', sinif: '9B', tur: 'okul' }, genel_ortalama: 74.5,
          odevler, mesajlar: [], ogretmenler: [], okunmamis_mesaj: 0, odemeler: [], son_gorulme: null });
      }
      return json({});
    };
  }, { odevler, IMZALI });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/veli/odevler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, s, p };
}
const kart = (p, baslik) => p.locator('div').filter({ has: p.getByText(baslik, { exact: true }) })
  .filter({ has: p.getByRole('button') }).last();
const yollar = (p) => p.evaluate(() => window.__yollar);
async function basVeSekme(s, dugme) {
  const soz = s.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await dugme.click();
  const sekme = await soz;
  if (!sekme) return null;
  await sekme.waitForURL(/imzali=1/, { timeout: 5000 }).catch(() => {});
  const u = sekme.url();
  await sekme.close();
  return u;
}

console.log('--- V1. Gönderilmiş ödev: soru PDF ve tek sayfalık çözüm ---');
const { b, s, p } = await kur(TAM);
{
  const k = kart(p, 'Üslü sayılar');
  const sor = k.getByRole('button', { name: 'Soruları aç (PDF)' });
  const coz = k.getByRole('button', { name: 'Çözümü aç' });
  ((await sor.count()) === 1 && (await coz.count()) === 1 ? tamam : bozuk)('iki düğme var');
  const a1 = await basVeSekme(s, sor);
  const y1 = (await yollar(p)).at(-1);
  (a1 === IMZALI && y1 === 'odev/us/sorular.pdf' ? tamam : bozuk)(`"Soruları aç (PDF)" → ${y1}, sekme ${a1 ? 'açıldı' : 'YOK'}`);
  const a2 = await basVeSekme(s, coz);
  const y2 = (await yollar(p)).at(-1);
  (a2 === IMZALI && y2 === 'cozum/us/c.jpg' ? tamam : bozuk)(`"Çözümü aç" → ${y2}, sekme ${a2 ? 'açıldı' : 'YOK'}`);
}

console.log('--- V2. Üç sayfalık çözüm ---');
{
  const k = kart(p, 'Köklü sayılar');
  const once = (await yollar(p)).length;
  await k.getByRole('button', { name: 'Çözümü aç' }).click();
  await p.waitForTimeout(300);
  const grup = p.getByRole('group', { name: 'Çözüm sayfaları' });
  const adlar = await grup.getByRole('button').allInnerTexts();
  (adlar.join('|') === '1. sayfa|2. sayfa|3. sayfa' ? tamam : bozuk)(`sayfa düğmeleri: ${adlar.join(', ')}`);
  ((await yollar(p)).length === once ? tamam : bozuk)('çözüm düğmesi toplu sekme açmadı');
  for (const [i, y] of [[1, 'cozum/kok/c.jpg'], [3, 'cozum/kok/c-3.jpg']]) {
    const a = await basVeSekme(s, grup.getByRole('button', { name: `${i}. sayfa` }));
    const son = (await yollar(p)).at(-1);
    (a === IMZALI && son === y ? tamam : bozuk)(`${i}. sayfa → ${son}`);
  }
}

console.log('--- V3. Gönderilmemiş ödev ---');
{
  const k = kart(p, 'Sayı aralıkları');
  ((await k.getByRole('button', { name: 'Soruları aç (PDF)' }).count()) === 1 ? tamam : bozuk)('soru düğmesi var');
  ((await k.getByRole('button', { name: 'Çözümü aç' }).count()) === 0 ? tamam : bozuk)('çözüm düğmesi yok');
}

console.log('--- V5. Anahtar yok ---');
{
  const m = await p.evaluate(() => document.body.innerText);
  (!/anahtar/i.test(m) ? tamam : bozuk)('ekranda "anahtar" yazısı yok');
  const y = await yollar(p);
  (!y.some((x) => /anahtar/i.test(x)) ? tamam : bozuk)(`istenen yollar: ${y.join(', ')}`);
}
await b.close();

console.log('--- V4. 0071 öncesi: alan yok ---');
{
  const { b, p } = await kur(ESKI);
  const m = await p.evaluate(() => document.body.innerText);
  (m.includes('Üslü sayılar') ? tamam : bozuk)('ekran açıldı');
  ((await p.getByRole('button', { name: /Soruları aç|Çözümü aç/ }).count()) === 0 ? tamam : bozuk)('düğme yok');
  await b.close();
}

console.log('--- V6. 360 px ---');
{
  const { b, p } = await kur(TAM, 360);
  await p.getByRole('button', { name: 'Çözümü aç' }).nth(1).click();
  await p.waitForTimeout(300);
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (tasma <= 0 ? tamam : bozuk)(`yatay taşma yok (${tasma} px)`);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`VELİ ÖDEV DOSYALARI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('VELİ ÖDEV DOSYALARI DENETİMİ GEÇTİ');
