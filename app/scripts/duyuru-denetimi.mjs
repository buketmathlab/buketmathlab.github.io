/**
 * DUYURULAR — ÖĞRETMENDEN ŞUBEYE TEK YÖNLÜ (Chromium, taklit RPC) — 0065
 *
 * Öğretmen: "Acil durumlarda sadece öğretmenlerin tek taraflı bildirimde
 * bulunabileceği bir duyuru panosu oluştur. Sadece hangi sınıfa duyuru
 * yapılacaksa o sınıfın öğrencilerine o duyuru gitsin."
 *
 *  D1. Boş metin ya da şube seçilmeden gönderilemiyor (uyarı, çağrı yok).
 *  D2. Arşivdeki şube seçeneklerde yok; özel ders grubu yalnız sahipte.
 *  D3. Onay penceresi kime gittiğini ve öğrenci sayısını söylüyor
 *      ("9A, 9B — 56 öğrenci … yanıt veremez"); "Gönder" doğru gövdeyle
 *      `duyuru_yayinla` çağırıyor (kırpılmış metin, iki şube).
 *  D4. Gönderilenler listesinde şube başına "23/28 öğrenci gördü";
 *      "Kaldır" onaydan sonra `duyuru_kaldir` çağırıyor.
 *  D5. Öğrenci: Pano'nun EN BAŞINDA Duyurular kartı, öğretmen adı ve
 *      "Yeni" etiketi; yanıt düğmesi/metin alanı YOK; Pano sekmesinde
 *      rozet; açılınca `duyurulari_okudum` çağrılıyor ve rozet düşüyor.
 *  D6. Duyuru yoksa kart çizilmiyor.
 *  D7. 360 px'de iki ekranda da yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/duyuru-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};

const kart = (id, ad, o) => ({ id, ad, seviye: 9, ozel: false, arsiv: false, ogretmenler: [], suresi_dolan: 0,
  son_odev: null, ogrenci_sayisi: 28, odev_sayisi: 0, soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null,
  ortalama: null, ...o });
const SINIFLAR = [kart('s1', '9A'), kart('s2', '9B'), kart('s3', '8C', { arsiv: true }),
  kart('so', 'Özel ders', { ozel: true, seviye: 99, ogrenci_sayisi: 5 })];
const GONDERILEN = [{ id: 'd1', metin: 'Yarın okul tatil.\nDers yok.', zaman: '2026-10-04T11:05:00Z',
  siniflar: [{ id: 's1', ad: '9A', mevcut: 28, goren: 23 }, { id: 's2', ad: '9B', mevcut: 28, goren: 20 }] }];
const OGR_DUYURU = [
  { id: 'd2', metin: 'Servis 15 dakika gecikecek.', zaman: '2026-10-04T05:30:00Z', ogretmen: 'Buket Topuzoğlu', yeni: true },
  { id: 'd1', metin: 'Yarın okul tatil.\nDers yok.', zaman: '2026-10-03T11:05:00Z', ogretmen: 'Buket Topuzoğlu', yeni: false },
];

async function ac({ yol, rol = 'ogretmen', en = 390, sahip = false, duyurular = OGR_DUYURU }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 900 } });
  p.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
  const cagrilar = [];
  let okundu = false;
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const g = JSON.parse(r.request().postData() ?? '{}');
    cagrilar.push({ uc, g });
    if (uc === 'duyurulari_okudum') okundu = true;
    const govde = {
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip, vekalet: false, vekil: null },
      bildirim_sayilari: {}, sinif_kartlari: SINIFLAR, ogretmen_duyurulari: GONDERILEN,
      duyuru_yayinla: { id: 'yeni' }, duyuru_kaldir: { durum: 'tamam' },
      ogrenci_odevleri: { ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '9A', tur: 'okul' }, okunmamis_mesaj: 0,
        okunmamis_duyuru: okundu ? 0 : duyurular.filter((d) => d.yeni).length, odevler: [], dersler: [] },
      ogrenci_duyurulari: duyurular, duyurulari_okudum: { durum: 'tamam' }, ewalu_mesajlari: [],
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript((rol) => localStorage.setItem('sekiz_oturum', JSON.stringify(
    rol === 'ogrenci' ? { rol, token: 't'.repeat(64), ogrenci: { id: 'o1', ad: 'Elif Yıldırım', tur: 'okul', sinif: '9A' } }
      : { rol, token: 't'.repeat(64) })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p, cagrilar };
}
const yayinlar = (c) => c.filter((x) => x.uc === 'duyuru_yayinla');

console.log('--- D1. Boş metin / şubesiz gönderilemiyor ---');
{
  const { b, p, cagrilar } = await ac({ yol: '/ogretmen/duyurular' });
  const gonder = p.getByRole('button', { name: 'Duyuruyu gönder' });
  await gonder.click();
  await p.waitForTimeout(200);
  olc('boş metin: "Duyuru metnini yazın."', (await p.getByRole('alert').allInnerTexts()).some((t) => t.includes('Duyuru metnini yazın.')));
  await p.getByLabel(/^Duyuru/).fill('  Yarın okul tatil.\nDers yok.  ');
  await gonder.click();
  await p.waitForTimeout(200);
  olc('şubesiz: "en az bir şube seçin"', (await p.getByRole('alert').allInnerTexts()).some((t) => t.includes('en az bir şube')));
  olc('onay penceresi açılmadı', (await p.locator('dialog[open]').count()) === 0);
  olc('duyuru_yayinla çağrılmadı', yayinlar(cagrilar).length === 0);

  console.log('--- D2. Şube seçenekleri ---');
  const etiketler = (await p.locator('fieldset label').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  olc('9A ve 9B var', etiketler.some((t) => t.startsWith('9A')) && etiketler.some((t) => t.startsWith('9B')), etiketler.join(' | '));
  olc('arşivdeki 8C yok', !etiketler.some((t) => t.startsWith('8C')), etiketler.join(' | '));
  olc('sahip değilse özel ders grubu yok', !etiketler.some((t) => t.startsWith('Özel ders')), etiketler.join(' | '));

  console.log('--- D3. Onay ve gönderim ---');
  await p.getByRole('button', { name: 'Tümünü seç' }).click();
  await gonder.click();
  await p.waitForTimeout(300);
  const d = p.locator('dialog[open]');
  const dm = (await d.count()) ? await d.innerText() : '';
  olc('onay: "9A, 9B — 56 öğrenci … yanıt veremez"', /9A, 9B — 56 öğrenci\. Öğrenciler bu duyuruya yanıt veremez\. Gönderilsin mi\?/.test(dm), dm);
  olc('onaydan önce çağrı yok', yayinlar(cagrilar).length === 0);
  await d.getByRole('button', { name: 'Gönder' }).click();
  await p.waitForTimeout(500);
  const y = yayinlar(cagrilar);
  olc('duyuru_yayinla bir kez', y.length === 1, String(y.length));
  olc('gövde: kırpılmış metin, iki şube',
    y[0]?.g.p_metin === 'Yarın okul tatil.\nDers yok.' && JSON.stringify(y[0]?.g.p_siniflar) === '["s1","s2"]',
    JSON.stringify(y[0]?.g));
  olc('form temizlendi', (await p.getByLabel(/^Duyuru/).inputValue()) === '');

  console.log('--- D4. Gönderilenler, gören sayısı, kaldır ---');
  const m = await p.locator('main').innerText();
  olc('"9A: 23/28 öğrenci gördü"', m.includes('9A: 23/28 öğrenci gördü'), m.slice(-400));
  olc('"9B: 20/28 öğrenci gördü"', m.includes('9B: 20/28 öğrenci gördü'));
  await p.getByRole('button', { name: 'Kaldır' }).first().click();
  await p.waitForTimeout(200);
  olc('kaldırmadan önce onay', (await p.locator('dialog[open]').count()) === 1 && !cagrilar.some((c) => c.uc === 'duyuru_kaldir'));
  await p.locator('dialog[open]').getByRole('button', { name: 'Kaldır' }).click();
  await p.waitForTimeout(400);
  const k = cagrilar.filter((c) => c.uc === 'duyuru_kaldir');
  olc('duyuru_kaldir d1 ile çağrıldı', k.length === 1 && k[0].g.p_id === 'd1', JSON.stringify(k));
  await b.close();
}

console.log('--- D2b. Sahipte özel ders grubu seçilebiliyor ---');
{
  const { b, p } = await ac({ yol: '/ogretmen/duyurular', sahip: true });
  const etiketler = await p.locator('fieldset label').allInnerTexts();
  olc('özel ders grubu var', etiketler.some((t) => t.includes('Özel ders')), etiketler.join(' | '));
  await b.close();
}

console.log('--- D5. Öğrenci ---');
{
  const { b, p, cagrilar } = await ac({ yol: '/ogrenci', rol: 'ogrenci' });
  const bolum = p.getByRole('region', { name: 'Duyurular' });
  olc('Duyurular kartı var', (await bolum.count()) === 1);
  const ilk = await p.locator('main ul').first().locator(':scope > li').first().innerText();
  olc('listenin EN BAŞINDA', ilk.startsWith('DUYURULAR') || ilk.startsWith('Duyurular'), ilk.slice(0, 60));
  const t = await bolum.innerText();
  olc('öğretmen adı, metin ve "Yeni"', t.includes('Buket Topuzoğlu') && t.includes('Servis 15 dakika gecikecek.') && t.includes('Yeni'), t);
  olc('satır sonu korunuyor', t.includes('Yarın okul tatil.\nDers yok.'));
  olc('yalnız yeni olanda "Yeni"', (t.match(/Yeni/g) ?? []).length === 1, t);
  olc('yanıt alanı ya da düğmesi yok', (await bolum.locator('textarea, input, button').count()) === 0);
  olc('duyurulari_okudum çağrıldı', cagrilar.some((c) => c.uc === 'duyurulari_okudum'));
  await p.waitForTimeout(500);
  const pano = await p.locator('nav').first().locator('a', { hasText: 'Pano' }).first().innerText();
  olc('okuduktan sonra Pano rozeti düştü', !/\d/.test(pano), pano);
  await b.close();
}
{
  // Rozet: okumadan önce (Ödevler sayfasında) Pano sekmesinde sayı var.
  const { b, p } = await ac({ yol: '/ogrenci/odevler', rol: 'ogrenci' });
  const pano = p.locator('nav').first().locator('a', { hasText: 'Pano' }).first();
  const ad = (await pano.innerText()) + ' ' + ((await pano.getAttribute('aria-label')) ?? '');
  olc('Pano sekmesinde rozet "1"', /1/.test(ad), ad);
  await b.close();
}

console.log('--- D6. Duyuru yoksa kart yok ---');
{
  const { b, p } = await ac({ yol: '/ogrenci', rol: 'ogrenci', duyurular: [] });
  olc('kart çizilmedi', (await p.getByRole('region', { name: 'Duyurular' }).count()) === 0);
  await b.close();
}

console.log('--- D7. 360 px ---');
for (const [yol, rol] of [['/ogretmen/duyurular', 'ogretmen'], ['/ogrenci', 'ogrenci']]) {
  const { b, p } = await ac({ yol, rol, en: 360 });
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  olc(`${yol}: yatay taşma yok (${tasma} px)`, tasma <= 0);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`DUYURU DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('DUYURU DENETİMİ GEÇTİ');
