/**
 * SORU KAĞIDI VE CEVAP ANAHTARI 20 MB (Chromium, taklit RPC) — 0059
 *
 * Öğretmenin isteği: "Soru kağıdı ve cevap anahtarı olarak 20 MB
 * yükleyebileyim." Sınır 10 MB'tı.
 *
 *  B1. 15 MB soru kağıdı: kabul; kaydedince depoya gerçekten yükleniyor
 *      ve `odev_guncelle` yeni yolu alıyor.
 *  B2. 25 MB soru kağıdı: SEÇERKEN reddediliyor ("En fazla 20 MB"),
 *      kaydedince yükleme yok.
 *  B3. 25 MB cevap anahtarı: "En fazla 20 MB" uyarısı.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/odev-pdf-boyut-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const MB = 1024 * 1024;
const pdf = (mb) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(Math.round(mb * MB) - 9, 0x20)]);

const DETAY = {
  id: 'a1', baslik: 'Üslü ve köklü', aciklama: 'Açıklama', tur: 'test', sinif_id: 's1', sinif: '9A',
  son_tarih: '2026-12-30', soru_sayisi: 5, gec_teslim: true, sik_sayisi: 5,
  cevap_anahtari: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }, konular: {},
  anahtar_yolu: 'odev/anahtar/eski.pdf', odev_yolu: 'odev/sorular/eski.pdf',
  yayinda: true, gonderim_sayisi: 0, sayfa_limiti: 1,
};

async function kur() {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript((detay) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }));
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      if (url.startsWith('https://depo.sahte/')) {
        window.__cagrilar.push({ ad: 'depo-yukle', govde: url, boyut: o?.body?.size ?? null });
        return new Response('{}', { status: 200 });
      }
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__cagrilar.push({ ad: 'dosya-url', govde });
        return json({ imzaliUrl: 'https://depo.sahte/yukle/' + govde.yol, jeton: 'j', yol: govde.yol });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });
      switch (m[1]) {
        case 'odev_detay': return json(detay);
        case 'siniflar_listesi': return json([{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false }]);
        case 'konu_onerileri': case 'odevler_listesi': return json([]);
        case 'ben_kimim': return json({ id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null });
        case 'odev_guncelle': return json({ durum: 'tamam', yeniden_puanlanan: [] });
        default: return json({});
      }
    };
  }, DETAY);
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/ogretmen/odevler/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const cagrilar = (p) => p.evaluate(() => window.__cagrilar);
const metin = (p) => p.evaluate(() => document.body.innerText);
async function sorularSec(p, mb) {
  await p.getByRole('button', { name: 'Ödev PDF’i (sorular) — yenisiyle değiştir' }).click();
  await p.locator('input[type=file]').setInputFiles({ name: `sorular-${mb}mb.pdf`, mimeType: 'application/pdf', buffer: pdf(mb) });
  await p.waitForTimeout(800);
}
const kaydet = async (p) => { await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click(); await p.waitForTimeout(1200); };

console.log('--- B1. 15 MB soru kağıdı kabul ve yükleniyor ---');
{
  const { b, p } = await kur();
  await sorularSec(p, 15);
  if (/En fazla \d+ MB/.test(await metin(p))) bozuk('15 MB reddedildi');
  await kaydet(p);
  const c = await cagrilar(p);
  const yukleme = c.find((x) => x.ad === 'depo-yukle' && /sorular\.pdf/.test(x.govde));
  const guncelle = c.filter((x) => x.ad === 'odev_guncelle').at(-1)?.govde;
  if (!yukleme) bozuk(`depoya yükleme yok: ${JSON.stringify(c.map((x) => x.ad))}`);
  else if (!guncelle || !/sorular\.pdf$/.test(guncelle.p_odev_yolu ?? '') || guncelle.p_odev_yolu === DETAY.odev_yolu) {
    bozuk(`odev_guncelle yeni yolu almadı: ${JSON.stringify(guncelle)}`);
  } else tamam(`15 MB yüklendi, odev_guncelle(p_odev_yolu: "${guncelle.p_odev_yolu}")`);
  await b.close();
}

console.log('--- B2. 25 MB soru kağıdı seçerken reddediliyor ---');
{
  const { b, p } = await kur();
  await sorularSec(p, 25);
  const m = await metin(p);
  if (!m.includes('En fazla 20 MB yükleyebilirsiniz')) bozuk(`uyarı yok: ${m.slice(0, 300)}`);
  else tamam('"Dosya çok büyük (25.0 MB). En fazla 20 MB yükleyebilirsiniz."');
  if ((await cagrilar(p)).some((x) => x.ad === 'depo-yukle')) bozuk('reddedilen dosya yüklendi');
  else tamam('yükleme yapılmadı');
  await b.close();
}

console.log('--- B3. 25 MB cevap anahtarı ---');
{
  const { b, p } = await kur();
  await p.getByRole('button', { name: 'Cevap anahtarı PDF’i — yenisiyle değiştir' }).click();
  await p.locator('input[type=file]').setInputFiles({ name: 'anahtar-25mb.pdf', mimeType: 'application/pdf', buffer: pdf(25) });
  await p.waitForTimeout(800);
  const m = await metin(p);
  if (!m.includes('En fazla 20 MB yükleyebilirsiniz')) bozuk(`uyarı yok: ${m.slice(0, 300)}`);
  else tamam('anahtar: "En fazla 20 MB" uyarısı');
  await b.close();
}

console.log('');
if (hata) { console.log(`ÖDEV PDF BOYUT DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('ÖDEV PDF BOYUT DENETİMİ GEÇTİ');
