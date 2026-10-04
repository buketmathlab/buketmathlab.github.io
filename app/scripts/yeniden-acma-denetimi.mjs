/**
 * 0056 — GÖNDERİMİ YENİDEN AÇMA + BOŞ CEVAP UYARISI (Chromium, taklit RPC)
 *
 * Olay: öğrencinin cevapları sisteme BOŞ gitti (51 sorudan 51'i boş,
 * 0 puan) ve "gönderim değiştirilemez" kuralı yüzünden elinde yol yoktu.
 *
 * A. ÖĞRETMEN — "Gönderimi yeniden aç"
 *    A1. YALNIZ SAHİPTE (kendi oturumu ya da vekâlet); sıradan öğretmende yok.
 *    A2. Diyalog neyin kalkacağını GÖSTERİYOR (puan, doğru/yanlış/boş) ve
 *        sonuçlarını söylüyor; sebepsiz "Yeniden aç" AĞA GİTMİYOR.
 *    A3. Sebeple: `gonderimi_yeniden_ac` doğru gönderim ve sebeple çağrılıyor,
 *        liste yenileniyor.
 *
 * B. ÖĞRENCİ — boş cevap uyarısı
 *    B0. "Ödevi gönder" sayfa sonunda alt çubuğun ALTINDA KALMIYOR (ölçülen
 *        kusur: alt boşluk 0 px'ti, düğmeye basan alt çubuğa dokunuyordu).
 *    B1. Hiç işaret yokken "Gönder": "51 sorudan 51'i boş. Yine de
 *        gönderilsin mi?" — `odev_gonder` ÇAĞRILMIYOR, yükleme de yok.
 *    B2. "Geri dön, işaretleyeyim" kapatıyor, cevaplar yerinde.
 *    B3. Kısmen boşta "51 sorudan 50'si boş"; "Yine de gönder" gönderiyor
 *        ve işaretlenen cevap yükte.
 *    B4. Hepsi işaretliyse hiçbir şey sorulmuyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/yeniden-acma-denetimi.mjs
 */
import sharp from 'sharp';

let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const N = 51;

const SAHIP = { id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null };
const OGRETMEN = { id: 'x', ad: 'Xeda Ortak', sahip: false, vekalet: false, vekil: null };
const VEKALET = { id: 'x', ad: 'Xeda Ortak', sahip: false, vekalet: true, vekil: { id: 's', ad: 'Buket Topuzoğlu' } };

const GONDERIMLER = {
  odev: { id: 'a1', baslik: 'Üslü ve köklü', tur: 'test', sinif: '9C', son_tarih: '2026-10-02',
          soru_sayisi: N, gec_teslim: false, yayinda: true },
  ozet: { mevcut: 1, gonderen: 1, gecikmeli: 0, puan_bekleyen: 0 },
  konu_ozeti: [],
  satirlar: [{
    ogrenci_id: 'o1', ogrenci: 'Duru Dilara Aygün', gonderim_id: 'g1', gonderdi: true,
    zaman: '2026-09-28T15:51:00Z', gecikmeli: false, durum: 'puanlandi',
    dogru: 0, yanlis: 0, bos: N, puan: 0, ogretmen_puan: null, ogretmen_yorum: null,
    yanlis_sorular: [], bos_sorular: [], foto_var: true, duzeltildi: false, duzeltme_nedeni: null,
  }],
};

const OGRENCI_ODEVLERI = {
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' },
  odevler: [{
    id: 'a1', baslik: 'Üslü ve köklü', aciklama: null, tur: 'test', son_tarih: '2099-10-02',
    soru_sayisi: N, gec_teslim: false, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
    gonderim: null, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
  }],
  dersler: [],
  okunmamis_mesaj: 0,
};

async function kur({ oturum, ben }, yol) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ oturum, ben, GONDERIMLER, OGRENCI_ODEVLERI }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      if (url.startsWith('https://depo.sahte/')) {
        window.__cagrilar.push({ ad: 'depo-yukle' });
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
        case 'ben_kimim': return json(ben);
        case 'odev_gonderimleri': return json(GONDERIMLER);
        case 'ogrenci_odevleri': return json(OGRENCI_ODEVLERI);
        case 'odev_sayfa_siniri': return json(1);
        case 'ewalu_mesajlari': return json([]);
        case 'gonderimi_yeniden_ac': return json({ durum: 'tamam', ogrenci: 'Duru Dilara Aygün', odev: 'Üslü ve köklü' });
        case 'odev_gonder': return json({ id: 'g2', dogru: 1, yanlis: 0, bos: 50, puan: 2 });
        default: return json({});
      }
    };
  }, { oturum, ben, GONDERIMLER, OGRENCI_ODEVLERI });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = async (p, ad) => (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === ad);
const OGRETMEN_OTURUMU = { rol: 'ogretmen', token: 't'.repeat(64) };
const OGRENCI_OTURUMU = { rol: 'ogrenci', token: 't'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', tur: 'okul', sinif: '9C' } };

// ---------------------------------------------------------------------------
console.log('--- A1. "Gönderimi yeniden aç" yalnız sahipte ---');
for (const [ad, ben, olmali] of [['sahip', SAHIP, true], ['vekâlet', VEKALET, true], ['sıradan öğretmen', OGRETMEN, false]]) {
  const { b, p } = await kur({ oturum: OGRETMEN_OTURUMU, ben }, '/ogretmen/odevler/a1/gonderimler');
  const var_ = (await p.getByRole('button', { name: 'Gönderimi yeniden aç' }).count()) > 0;
  if (var_ !== olmali) bozuk(`${ad}: düğme ${var_ ? 'VAR' : 'YOK'}`);
  else tamam(`${ad}: düğme ${olmali ? 'var' : 'yok'}`);
  await b.close();
}

console.log('--- A2/A3. Diyalog gösteriyor, uyarıyor, sebep istiyor; sonra açıyor ---');
{
  const { b, p } = await kur({ oturum: OGRETMEN_OTURUMU, ben: SAHIP }, '/ogretmen/odevler/a1/gonderimler');
  await p.getByRole('button', { name: 'Gönderimi yeniden aç' }).click();
  await p.waitForTimeout(200);
  const d = await p.locator('dialog[open]').innerText();
  if (!/Duru Dilara Aygün bu ödevi baştan gönderebilecek/.test(d) || !/0 doğru, 0 yanlış, 51 boş/.test(d)) {
    bozuk(`diyalog gönderimi göstermiyor: ${d.slice(0, 200)}`);
  } else tamam('diyalog: öğrenci, "0 doğru, 0 yanlış, 51 boş"');
  if (!/kayıt altında saklanır/.test(d) || !/süre dolmuş olsa bile/.test(d)) bozuk('uyarı metni eksik');
  else tamam('uyarı: kayıt altında saklanır, süre dolmuş olsa bile gönderebilir');
  await p.locator('dialog[open]').getByRole('button', { name: 'Yeniden aç' }).click();
  await p.waitForTimeout(300);
  if ((await cagrilar(p, 'gonderimi_yeniden_ac')).length > 0) bozuk('SEBEPSİZ açma ağa gitti');
  else if (!/sebebini yazın/.test(await p.locator('dialog[open]').innerText())) bozuk('sebep hatası görünmüyor');
  else tamam('sebepsiz: ağa gitmedi, "sebebini yazın"');
  const onceki = (await cagrilar(p, 'odev_gonderimleri')).length;
  await p.locator('dialog[open] textarea').fill('Cevaplar sisteme boş kaydedildi');
  await p.locator('dialog[open]').getByRole('button', { name: 'Yeniden aç' }).click();
  await p.waitForTimeout(500);
  const c = await cagrilar(p, 'gonderimi_yeniden_ac');
  if (c.length !== 1 || c[0].govde.p_gonderim !== 'g1' || c[0].govde.p_neden !== 'Cevaplar sisteme boş kaydedildi') {
    bozuk(`yanlış çağrı: ${JSON.stringify(c)}`);
  } else tamam('gonderimi_yeniden_ac(g1, sebep) çağrıldı');
  if ((await cagrilar(p, 'odev_gonderimleri')).length <= onceki) bozuk('liste yenilenmedi');
  else tamam('liste yenilendi');
  if ((await p.locator('dialog[open]').count()) !== 0) bozuk('diyalog kapanmadı');
  await b.close();
}

// ---------------------------------------------------------------------------
const FOTO = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();

async function ogrenciHazir() {
  const r = await kur({ oturum: OGRENCI_OTURUMU, ben: null }, '/ogrenci/odev/a1');
  await r.p.locator('input[type=file]').setInputFiles({ name: 'cozum.jpg', mimeType: 'image/jpeg', buffer: FOTO });
  await r.p.waitForTimeout(600);
  return r;
}
/** Alt gezinme çubuğu ekranın altını kaplıyor: düğmeyi ortaya kaydırıp bas. */
async function bas(l) {
  await l.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await l.click();
}
const onayla = async (p) => { const k = p.getByRole('checkbox', { name: /Bu ödevi kendim çözdüm/ }); await k.evaluate((e) => e.scrollIntoView({ block: 'center' })); await k.check(); };
const gonderBas = async (p) => { await onayla(p); await bas(p.getByRole('button', { name: 'Ödevi gönder' })); await p.waitForTimeout(400); };

console.log('--- B0. "Ödevi gönder" ALT ÇUBUĞUN ALTINDA DEĞİL (sayfa sonunda) ---');
{
  // Önceki kusur: öğrenci/veli kabuğunda `sk-alt-guvenli`, `pb-28`'i eziyordu;
  // sayfanın sonu alt çubuğun altında kalıyordu. Düğmeye basan öğrenci alt
  // çubuğa dokunup sayfadan çıkabiliyor, cevapları kayboluyordu.
  const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null }, '/ogrenci/odev/a1');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(300);
  const ustte = await p.evaluate(() => {
    const d = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Ödevi gönder'));
    if (!d) return 'düğme yok';
    const r = d.getBoundingClientRect();
    for (const y of [r.top + 2, r.top + r.height / 2, r.bottom - 2]) {
      const e = document.elementFromPoint(r.left + r.width / 2, y);
      if (!e || !d.contains(e)) return `y=${Math.round(y)}'de üstte: ${e?.outerHTML.slice(0, 60)}`;
    }
    return 'tamam';
  });
  if (ustte !== 'tamam') bozuk(`"Ödevi gönder" örtülü — ${ustte}`);
  else tamam('sayfa sonunda "Ödevi gönder" tamamen dokunulabilir');
  await b.close();
}

console.log('--- B1/B2. Hiç işaret yok: sorar, göndermez; geri dönünce kapanır ---');
{
  const { b, p } = await ogrenciHazir();
  await gonderBas(p);
  const d = (await p.locator('dialog[open]').count()) ? await p.locator('dialog[open]').innerText() : '';
  if (!/51 sorudan 51'i boş\. Yine de gönderilsin mi\?/.test(d)) bozuk(`uyarı çıkmadı: "${d.slice(0, 120)}"`);
  else tamam('"51 sorudan 51\'i boş. Yine de gönderilsin mi?"');
  if ((await cagrilar(p, 'odev_gonder')).length || (await cagrilar(p, 'depo-yukle')).length) bozuk('uyarı açıkken gönderildi/yüklendi');
  else tamam('onaysız: yükleme ve odev_gonder yok');
  await p.locator('dialog[open]').getByRole('button', { name: 'Geri dön, işaretleyeyim' }).click();
  await p.waitForTimeout(200);
  if ((await p.locator('dialog[open]').count()) !== 0 || (await cagrilar(p, 'odev_gonder')).length) bozuk('geri dön kapatmadı ya da gönderdi');
  else tamam('"Geri dön, işaretleyeyim" kapattı, gönderim yok');
  await b.close();
}

console.log('--- B3. Kısmen boş: sayı doğru; "Yine de gönder" gönderir, cevap yükte ---');
{
  const { b, p } = await ogrenciHazir();
  await bas(p.getByRole('button', { name: '1. soru, A şıkkı', exact: true }));
  await p.waitForTimeout(200);
  await gonderBas(p);
  const d = (await p.locator('dialog[open]').count()) ? await p.locator('dialog[open]').innerText() : '';
  if (!/51 sorudan 50'si boş/.test(d)) bozuk(`kısmi uyarı yanlış: "${d.slice(0, 120)}"`);
  else tamam('"51 sorudan 50\'si boş"');
  await p.locator('dialog[open]').getByRole('button', { name: 'Yine de gönder' }).click();
  await p.waitForTimeout(800);
  const c = await cagrilar(p, 'odev_gonder');
  if (c.length !== 1 || c[0].govde.p_cevaplar?.['1'] !== 'A') bozuk(`gönderim yükü yanlış: ${JSON.stringify(c.map((x) => x.govde?.p_cevaplar))}`);
  else tamam('onaydan sonra gönderildi; 1. soru "A" yükte');
  await b.close();
}

console.log('--- B4. Hepsi işaretliyse hiçbir şey sorulmaz ---');
{
  const { b, p } = await ogrenciHazir();
  const adet = N;
  for (let i = 1; i <= N; i++) await bas(p.getByRole('button', { name: `${i}. soru, B şıkkı`, exact: true }));
  await p.waitForTimeout(200);
  const isaretli = (await metin(p)).includes('51/51 soru işaretlendi');
  await gonderBas(p);
  await p.waitForTimeout(600);
  if (!isaretli) bozuk(`51 soru işaretlenemedi (${adet} düğme)`);
  else if ((await p.locator('dialog[open]').count()) !== 0) bozuk('dolu gönderimde uyarı çıktı');
  else if ((await cagrilar(p, 'odev_gonder')).length !== 1) bozuk('dolu gönderim gitmedi');
  else tamam('51/51: sormadan gönderildi');
  await b.close();
}

console.log('');
if (hata) { console.log(`YENİDEN AÇMA DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('YENİDEN AÇMA DENETİMİ GEÇTİ');
