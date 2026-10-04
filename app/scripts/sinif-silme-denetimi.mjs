/**
 * BOŞ SINIFI SİLME (Chromium, taklit RPC) — 0068
 *
 * Öğretmen: "Platform sahibi olarak sınıfı silemiyor muyum?" Kararı: yalnız
 * hiç öğrencisi ve ödevi olmayan sınıf silinebilsin.
 *
 *  S1. Sahip: boş kartta (9D) "Sil" var; dolu kartta (9A) ve özel grupta yok.
 *  S2. "Sil" → onay penceresi ("9D silinsin mi? … geri alınamaz");
 *      "Vazgeç" çağrı yapmıyor; "Sil" `sinif_sil`'i 9D kimliğiyle çağırıyor
 *      ve liste yenileniyor.
 *  S3. Sahip olmayan öğretmende "Sil" hiç yok.
 *  S4. 360 px'de yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sinif-silme-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};
const kart = (id, ad, o = {}) => ({ id, ad, seviye: 9, ozel: false, arsiv: false, ogretmenler: [], suresi_dolan: 0,
  son_odev: null, ogrenci_sayisi: 28, odev_sayisi: 4, soru_toplami: 80, soru_sayisiz: 0, gonderim_orani: 80,
  ortalama: 70, ...o });
const KARTLAR = [kart('s9a', '9A'), kart('s9d', '9D', { ogrenci_sayisi: 0, odev_sayisi: 0, soru_toplami: 0,
  gonderim_orani: null, ortalama: null }), kart('soz', 'Özel ders', { ozel: true, seviye: 99, ogrenci_sayisi: 0, odev_sayisi: 0 })];

async function ac({ sahip = true, en = 390 } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 900 } });
  p.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
  const cagrilar = [];
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    cagrilar.push({ uc, g: JSON.parse(r.request().postData() ?? '{}') });
    const govde = {
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip, vekalet: false, vekil: null },
      bildirim_sayilari: {}, sinif_kartlari: KARTLAR, sinif_sil: { durum: 'tamam', ad: '9D' },
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript(() => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) })));
  await p.goto(KOK + '/ogretmen/siniflar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p, cagrilar };
}
const kartOf = (p, ad) => p.locator('main li').filter({ has: p.getByText(ad, { exact: true }) }).first();
const silSayisi = (k) => k.getByRole('button', { name: 'Sil', exact: true }).count();

console.log('--- S1/S2. Sahip ---');
{
  const { b, p, cagrilar } = await ac();
  olc('boş 9D kartında "Sil" var', (await silSayisi(kartOf(p, '9D'))) === 1);
  olc('dolu 9A kartında "Sil" yok', (await silSayisi(kartOf(p, '9A'))) === 0);
  olc('özel grupta "Sil" yok', (await p.getByRole('button', { name: 'Sil', exact: true }).count()) === 1);

  await kartOf(p, '9D').getByRole('button', { name: 'Sil', exact: true }).click();
  await p.waitForTimeout(200);
  const d = p.locator('dialog[open]');
  const dm = (await d.count()) ? await d.innerText() : '';
  olc('onay: "9D silinsin mi? … geri alınamaz"', dm.includes('9D silinsin mi?') && dm.includes('geri alınamaz'), dm);
  await d.getByRole('button', { name: 'Vazgeç' }).click();
  await p.waitForTimeout(200);
  olc('vazgeçince sinif_sil çağrılmadı', !cagrilar.some((c) => c.uc === 'sinif_sil'));

  await kartOf(p, '9D').getByRole('button', { name: 'Sil', exact: true }).click();
  await p.waitForTimeout(200);
  const once = cagrilar.filter((c) => c.uc === 'sinif_kartlari').length;
  await p.locator('dialog[open]').getByRole('button', { name: 'Sil', exact: true }).click();
  await p.waitForTimeout(500);
  const sil = cagrilar.filter((c) => c.uc === 'sinif_sil');
  olc('sinif_sil 9D kimliğiyle bir kez', sil.length === 1 && sil[0].g.p_id === 's9d', JSON.stringify(sil.map((c) => c.g.p_id)));
  olc('liste yenilendi', cagrilar.filter((c) => c.uc === 'sinif_kartlari').length > once);
  olc('"9D silindi" bildirimi', (await p.locator('body').innerText()).includes('9D silindi'));
  await b.close();
}

console.log('--- S3. Sahip olmayan öğretmen ---');
{
  const { b, p } = await ac({ sahip: false });
  olc('"Sil" hiç yok', (await p.getByRole('button', { name: 'Sil', exact: true }).count()) === 0);
  await b.close();
}

console.log('--- S4. 360 px ---');
{
  const { b, p } = await ac({ en: 360 });
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  olc(`yatay taşma yok (${tasma} px)`, tasma <= 0);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`SINIF SİLME DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('SINIF SİLME DENETİMİ GEÇTİ');
