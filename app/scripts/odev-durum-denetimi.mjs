/**
 * ÖDEVLER SEKMESİ — DURUM ETİKETİ VE İKİ ORTALAMA (Chromium, taklit RPC) — 0064
 *
 * Öğretmen: "Ödevler sekmesinde ödev teslim süresi dolan ödevler 'yayında'
 * yazmasın. Ödev ortalamasını gösterirken 'sınıfın tamamı (göndermeyenler
 * dahil)' ve 'yalnız gönderenler' şeklinde yazılsın."
 *
 *  Ö1. Taslak → "Taslak"; süresi süren → "Yayında"; süresi dolan → "Süresi
 *      doldu" (o kartta "Yayında" YOK).
 *  Ö2. Filtreler: "Yayında" süresi dolanı göstermiyor; "Süresi dolan" yalnız
 *      onu gösteriyor.
 *  Ö3. Ortalama: iki satır, öğretmenin sözcükleriyle ve Türkçe ondalıkla.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/odev-durum-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};
const gun = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};
const odev = (id, baslik, yayinda, sonTarih, ortTum = null, ortYapan = null) => ({
  id, baslik, aciklama: null, tur: 'test', sinif_id: 's1', sinif: '9A', sinif_ozel: false,
  son_tarih: sonTarih, soru_sayisi: 10, gec_teslim: true, sik_sayisi: 5, yayinda,
  olusturma: '2026-09-01T10:00:00Z', kardesler: null, odev_pdf_var: false, anahtar_pdf_var: false,
  gonderim_sayisi: 3, gec_gonderim_sayisi: 0, sinif_mevcudu: 4,
  ortalama_yapan: ortYapan, ortalama_tum: ortTum,
});
const ODEVLER = [
  odev('d1', 'Taslak ödev', false, gun(5)),
  odev('d2', 'Süren ödev', true, gun(3)),
  odev('d3', 'Biten ödev', true, gun(-2), 62.5, 83.3),
];

const b = await chromium.launch();
const s = await b.newPage({ viewport: { width: 390, height: 900 } });
s.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
await s.route('**/rest/v1/rpc/*', (r) => {
  const uc = r.request().url().split('/').pop().split('?')[0];
  const g = JSON.parse(r.request().postData() ?? '{}');
  const govde =
    uc === 'odevler_listesi'
      ? ODEVLER.filter((o) => g.p_yayinda === null || g.p_yayinda === undefined || o.yayinda === g.p_yayinda)
      : uc === 'siniflar_listesi'
        ? [{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 4 }]
        : {};
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
});
await s.addInitScript(() =>
  localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) })),
);
await s.goto(KOK + '/ogretmen/odevler', { waitUntil: 'networkidle' });
await s.waitForTimeout(500);

const kart = (baslik) =>
  s.locator('div').filter({ has: s.getByRole('button', { name: baslik, exact: true }) }).filter({ hasText: 'Son tarih' }).last();

console.log('--- Ö1. Durum etiketleri ---');
olc('taslak: "Taslak"', (await kart('Taslak ödev').innerText()).includes('Taslak'));
const suren = await kart('Süren ödev').innerText();
olc('süren: "Yayında"', suren.includes('Yayında'), suren);
const biten = await kart('Biten ödev').innerText();
olc('süresi dolan: "Süresi doldu"', biten.includes('Süresi doldu'), biten);
olc('süresi dolan kartta "Yayında" yok', !biten.includes('Yayında'), biten);

console.log('--- Ö3. İki ortalama ---');
olc('"Sınıfın tamamı (göndermeyenler dahil)" 62,5', /Sınıfın tamamı \(göndermeyenler dahil\)\s*62,5/.test(biten), biten);
olc('"Yalnız gönderenler" 83,3', /Yalnız gönderenler\s*83,3/.test(biten), biten);

console.log('--- Ö2. Filtreler ---');
await s.getByRole('button', { name: 'Yayında', exact: true }).click();
await s.waitForTimeout(500);
let m = await s.locator('main').innerText();
olc('"Yayında" filtresi: süren var, biten yok', m.includes('Süren ödev') && !m.includes('Biten ödev'), m.slice(0, 300));
await s.getByRole('button', { name: 'Süresi dolan', exact: true }).click();
await s.waitForTimeout(500);
m = await s.locator('main').innerText();
olc('"Süresi dolan" filtresi: yalnız biten', m.includes('Biten ödev') && !m.includes('Süren ödev') && !m.includes('Taslak ödev'), m.slice(0, 300));

await b.close();
console.log('');
if (hata) {
  console.log(`ÖDEV DURUM DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('ÖDEV DURUM DENETİMİ GEÇTİ');
