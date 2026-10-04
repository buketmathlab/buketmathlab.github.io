/**
 * ÖĞRETMENİN GENEL SAYFASI (Chromium, taklit RPC) — 0065
 *
 * Öğretmen: "Müdürün genel sekmesinde olan bilgiler öğretmenlerin pano
 * sayfasında olsun. Öğretmenlerin Pano sayfasının adı 'genel' olarak
 * değiştirilsin." + "Bugün kartları üstte kalsın fakat daha dar satırlarda
 * gösterilsin."
 *
 *  G1. Öğretmen sekme çubuğunda "Genel" var, "Pano" yok; sayfa başlığı Genel.
 *  G2. Bugün: dört KÜÇÜK KUTU ("kutu içinde daha güzeldi … daha küçük
 *      minimal kutular"): her biri 44–72 px, telefonda ikişerli; kutu
 *      tıklanınca ayrıntıya gidiyor. Son gönderimler TEK SATIR (≤ 52 px).
 *  G3. Okulun genel durumu: müdürün Genel sekmesindeki bölümler (Aylık
 *      gelişim, Sınıf seviyeleri, Şubelerin ortalaması, En çok zorlanılan
 *      konular) ve okul kutucukları `okul_geneli` verisiyle.
 *  G4. "Duyuru yap" bağlantısı duyurular sayfasına gidiyor.
 *  G5. `okul_geneli` ucu yoksa (0065 çalıştırılmamış) özet bölümü hiç
 *      çizilmiyor, Bugün yine görünüyor.
 *  G6. Öğrenci ve velinin sekmesi hâlâ "Pano".
 *  G7. 360 px'de yatay taşma yok.
 *  G8. "Verinizin yedeği" Genel'de YOK, Ayarlar'da VAR (öğretmenin isteği:
 *      "Verinizin yedeği kısmı ayarların içine taşınsın"); sahip olmayan
 *      öğretmenin Ayarlar'ında yine yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/genel-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};

const PANO = {
  ogrenci_sayisi: 40, odev_verilen_ogrenci: 31, acik_odev: 2, bekleyen_degerlendirme: 1, gecikmis_eksik: 3,
  son_gonderimler: [{ ogrenci: 'Elif Yıldırım', odev: 'Üslü sayılar', puan: 80, zaman: '2026-10-01T10:00:00Z',
    gecikmeli: false, sinif: '9A', gonderim_id: 'g1' }],
};
const OZET = (o) => ({ ogrenci_sayisi: 56, odev_sayisi: 12, soru_toplami: 240, soru_sayisiz: 1,
  gonderim_orani: 82, ortalama: 71.4, ...o });
const GENEL = {
  yil_baslangici: '2026-09-01',
  okul: OZET({ sinif_sayisi: 2 }),
  seviyeler: [{ ...OZET({}), seviye: 9, sinif_sayisi: 2,
    eksik_konular: [{ konu: 'Mutlak Değer', toplam: 40, dogru: 18, oran: 45 }] }],
  siniflar: [
    { id: 's1', ad: '9A', seviye: 9, ogrenci_sayisi: 28, odev_sayisi: 6, soru_toplami: 120, gonderim_orani: 85, ortalama: 74.1 },
    { id: 's2', ad: '9B', seviye: 9, ogrenci_sayisi: 28, odev_sayisi: 6, soru_toplami: 120, gonderim_orani: 79, ortalama: 68.7 },
  ],
  aylar: [{ ay: '2026-09-01', odev_sayisi: 8, soru_toplami: 160, gonderim_orani: 80, ortalama: 70 },
          { ay: '2026-10-01', odev_sayisi: 4, soru_toplami: 80, gonderim_orani: 85, ortalama: 73 }],
};

async function ac({ yol, rol = 'ogretmen', en = 390, genelYok = false, sahip = true }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 900 } });
  p.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
  const cagrilar = [];
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    cagrilar.push(uc);
    if (uc === 'okul_geneli' && genelYok) {
      return r.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.okul_geneli(p_token) in the schema cache' }) });
    }
    const govde = {
      ogretmen_panosu: PANO, okul_geneli: GENEL, bildirim_sayilari: {},
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip, vekalet: false, vekil: null },
      ogrenci_odevleri: { ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '9A', tur: 'okul' }, okunmamis_mesaj: 0,
        okunmamis_duyuru: 0, odevler: [], dersler: [] },
      ogrenci_duyurulari: [], ewalu_mesajlari: [], sinif_kartlari: [], ogretmen_duyurulari: [],
      pano_detay: { tur: 'gondermeyen', baslik: 'Göndermeyen öğrenciler', aciklama: '', toplam: 1,
        gruplar: [{ sinif: '9A', ozel: false, satirlar: [{ ad: 'Mehmet Kaya', eksik: 1 }] }] },
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
const sekmeAdlari = (p) => p.locator('nav').first().locator('a').allInnerTexts();

console.log('--- G1. Sekme adı ve başlık ---');
{
  const { b, p } = await ac({ yol: '/ogretmen' });
  const adlar = (await sekmeAdlari(p)).map((t) => t.trim());
  olc('sekmede "Genel" var', adlar.some((t) => t.startsWith('Genel')), adlar.join(' | '));
  olc('sekmede "Pano" yok', !adlar.some((t) => t.startsWith('Pano')), adlar.join(' | '));
  olc('sayfa başlığı "Genel"', (await p.locator('h1').first().innerText()).trim() === 'Genel');

  console.log('--- G2. Küçük Bugün kutuları, tek satır gönderimler ---');
  const satirlar = p.getByRole('main').getByRole('button', { name: /(Ödev verilen öğrenci|Açık ödev|Göndermeyen|Puan bekliyor)$/ });
  olc('dört kutu', (await satirlar.count()) === 4, String(await satirlar.count()));
  const kutular = await satirlar.evaluateAll((l) => l.map((e) => {
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), y: Math.round(r.top), w: Math.round(r.width) };
  }));
  olc('her kutu 44–72 px (küçük ama dokunulabilir)', kutular.every((k) => k.h >= 44 && k.h <= 72), JSON.stringify(kutular));
  olc('telefonda ikişerli (iki sıra)', new Set(kutular.map((k) => k.y)).size === 2, JSON.stringify(kutular));
  olc('kutu çerçeveli', await satirlar.first().evaluate((e) => getComputedStyle(e).borderTopWidth !== '0px'));
  const goster = await satirlar.nth(2).innerText();
  olc('kutuda sayı ve etiket', /3[\s\S]*Göndermeyen/.test(goster), goster);
  const gonderimBoy = await p.getByRole('heading', { name: 'Son gönderimler' })
    .evaluate((h) => Math.round(h.nextElementSibling.querySelector('li').getBoundingClientRect().height));
  olc(`son gönderim tek satır (${gonderimBoy} px ≤ 52)`, gonderimBoy <= 52);

  console.log('--- G3. Okulun genel durumu ---');
  const m = await p.locator('main').innerText();
  for (const parca of ['Okulun genel durumu', 'Aylık gelişim', 'Sınıf seviyeleri', 'Şubelerin ortalaması',
    'En çok zorlanılan konular', '9. sınıfların en çok zorlandığı konular', 'Mutlak Değer', 'Okul ortalaması']) {
    olc(`"${parca}" görünüyor`, m.includes(parca));
  }
  olc('okul kutucukları okul_geneli verisiyle (240 soru)', /Toplam soru\s*240/.test(m), m.slice(0, 400));
  const sira = m.indexOf('Bugün') < m.indexOf('Okulun genel durumu');
  olc('Bugün üstte, okul özeti altında', sira);

  await satirlar.nth(2).click();
  await p.waitForTimeout(400);
  olc('satır ayrıntıya gidiyor', p.url().endsWith('/ogretmen/bugun/gondermeyen'), p.url());

  await b.close();
}

console.log('--- G4. Duyuru yap ---');
{
  const { b, p } = await ac({ yol: '/ogretmen' });
  await p.getByRole('main').getByRole('link', { name: 'Duyuru yap' }).click();
  await p.waitForTimeout(400);
  olc('"Duyuru yap" duyurular sayfasını açıyor', p.url().endsWith('/ogretmen/duyurular'), p.url());
  await b.close();
}

console.log('--- G5. okul_geneli yoksa ---');
{
  const { b, p } = await ac({ yol: '/ogretmen', genelYok: true });
  const m = await p.locator('main').innerText();
  olc('özet bölümü çizilmiyor', !m.includes('Okulun genel durumu'), m.slice(0, 300));
  olc('Bugün yine görünüyor', m.includes('Açık ödev'));
  await b.close();
}

console.log('--- G6. Öğrencide sekme hâlâ "Pano" ---');
{
  const { b, p } = await ac({ yol: '/ogrenci', rol: 'ogrenci' });
  const adlar = (await sekmeAdlari(p)).map((t) => t.trim());
  olc('öğrenci sekmesi "Pano"', adlar.some((t) => t.startsWith('Pano')) && !adlar.some((t) => t.startsWith('Genel')), adlar.join(' | '));
  await b.close();
}

console.log('--- G7. 360 px ---');
{
  const { b, p } = await ac({ yol: '/ogretmen', en: 360 });
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  olc(`yatay taşma yok (${tasma} px)`, tasma <= 0);
  await b.close();
}

console.log('--- G8. Yedek Ayarlar\'da ---');
{
  const { b, p } = await ac({ yol: '/ogretmen' });
  olc('Genel sayfasında yedek kartı yok', !(await p.locator('main').innerText()).includes('Verinizin yedeği'));
  await p.goto(KOK + '/ogretmen/ayarlar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const m = await p.locator('main').innerText();
  olc('Ayarlar\'da "Verinizin yedeği" ve "Yedeği indir"', m.includes('Verinizin yedeği') && m.includes('Yedeği indir'), m.slice(0, 300));
  await b.close();
}
{
  const { b, p } = await ac({ yol: '/ogretmen/ayarlar', sahip: false });
  olc('sahip olmayan öğretmende yedek kartı yok', !(await p.locator('main').innerText()).includes('Verinizin yedeği'));
  await b.close();
}

console.log('');
if (hata) {
  console.log(`GENEL SAYFA DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('GENEL SAYFA DENETİMİ GEÇTİ');
