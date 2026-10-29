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
 * C. 0081 — İPTALDE YENİ SON TARİH VE ÖĞRENCİYE HABER
 *    C1. Diyalogda tarih alanı var, varsayılan dolu, GEÇMİŞ TARİH SEÇİLEMEZ.
 *    C2. "Sebep öğrenciye mesaj olarak gönderilir" uyarısı DOKUNMADAN görünür.
 *    C3. Onaylayınca `p_son_tarih` ağa GİDİYOR ve seçilen tarih.
 *    C4. Gönderim listesinde "ek süre verildi · <tarih>" çiziliyor.
 *    C5. Öğrenci kişisel tarihi görüyor ve SINIF TARİHİ GEÇMİŞKEN gönderebiliyor.
 *    C6. 360 px'de taşma yok.
 *
 * D. 0082 — YENİDEN AÇILAN ÖDEVDE FOTOĞRAFI YENİDEN YÜKLEME
 *    D1. Önceki sayfa yoksa seçim HİÇ çizilmiyor (bugünkü ekran).
 *    D2. Varsa iki yol da görünüyor; varsayılan YENİ YÜKLEME.
 *    D3. Yeni yükleme `-d2` yoluna gidiyor (`dosya-url` yükü okunuyor).
 *    D4. "Önceki sayfalarımı kullan" → HİÇ yükleme yok, eski yollar gidiyor.
 *    D5. 360 px'de taşma yok.
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

const TEMEL_GONDERIMLER = {
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

const TEMEL_ODEVLER = {
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' },
  odevler: [{
    id: 'a1', baslik: 'Üslü ve köklü', aciklama: null, tur: 'test', son_tarih: '2099-10-02',
    soru_sayisi: N, gec_teslim: false, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
    gonderim: null, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
  }],
  dersler: [],
  okunmamis_mesaj: 0,
};

/**
 * `gonderimler` / `odevler`: 0081 grupları aynı ekranı BAŞKA veriyle
 * görmek zorunda (ek süre verilmiş satır, sınıf tarihi geçmiş ödev).
 * Kalıbı kopyalamak yerine taklit RPC'ye ne döneceğini söylüyoruz.
 */
async function kur({ oturum, ben, gonderimler, odevler }, yol) {
  const GONDERIMLER = gonderimler ?? TEMEL_GONDERIMLER;
  const OGRENCI_ODEVLERI = odevler ?? TEMEL_ODEVLER;
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
  // 0081: "süresiz açılıyor" yerine "aşağıda seçtiğiniz tarihe kadar".
  // Eski metin ("süre dolmuş olsa bile") artık sınıfın süresini anlatıyor.
  if (!/kayıt altında saklanır/.test(d)
      || !/aşağıda seçtiğiniz tarihe kadar/.test(d)
      || !/sınıfın süresi dolmuş olsa bile/.test(d)
      || !/gecikmeli/.test(d)) {
    bozuk(`uyarı metni eksik: ${d.slice(0, 300)}`);
  } else tamam('uyarı: kayıt saklanır, seçilen tarihe kadar gönderir, gecikmeli kalır');
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

// ---------------------------------------------------------------------------
// C. 0081 — İPTALDE YENİ SON TARİH VE ÖĞRENCİYE HABER
// ---------------------------------------------------------------------------
/** Bugün ve n gün sonrası, `YYYY-AA-GG`. Ekrandaki alanın beklediği biçim. */
const gun = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "25 Ekim 2026" — `iptal-metni.ts`'teki biçimlendiricinin aynısı. */
const GUN_TR = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const gunTr = (iso) => GUN_TR.format(new Date(`${iso}T00:00:00`));

console.log('--- C1/C2/C3. Tarih alanı, sebep uyarısı, p_son_tarih ağa gidiyor ---');
{
  const { b, p } = await kur({ oturum: OGRETMEN_OTURUMU, ben: SAHIP }, '/ogretmen/odevler/a1/gonderimler');
  await p.getByRole('button', { name: 'Gönderimi yeniden aç' }).click();
  await p.waitForTimeout(200);
  const d = p.locator('dialog[open]');

  // C2 — DOKUNMADAN görünüyor. Uyarı yalnız yazdıktan sonra çıksaydı,
  // öğretmen sebebi zaten kendine not diye yazmış olurdu.
  const uyari = d.locator('[data-test="sebep-uyarisi"]');
  if ((await uyari.count()) !== 1) bozuk('sebep uyarısı yok');
  else if (!/öğrenciye mesaj olarak gönderilir/.test(await uyari.innerText())) {
    bozuk(`uyarı metni yanlış: ${await uyari.innerText()}`);
  } else tamam('C2: "sebep öğrenciye mesaj olarak gönderilir" dokunmadan görünüyor');

  // C1 — tarih alanı dolu geliyor ve geçmişe kapalı.
  const tarih = d.locator('input[type="date"]');
  if ((await tarih.count()) !== 1) bozuk('tarih alanı yok');
  else {
    const deger = await tarih.inputValue();
    const min = await tarih.getAttribute('min');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deger) || deger < gun(0)) bozuk(`varsayılan tarih yanlış: ${deger}`);
    else if (min !== gun(0)) bozuk(`min bugün değil: ${min}`);
    else tamam(`C1: tarih alanı dolu (${deger}), min=bugün`);
  }

  // C1b — GEÇMİŞ TARİH ELLE YAZILIRSA ağa gitmiyor. `min` yalnız takvimi
  // kısıtlar; klavyeyle yazılan tarihi durdurmaz.
  await tarih.fill(gun(-3));
  await d.locator('textarea').fill('Boş sayfa gönderilmiş');
  await d.getByRole('button', { name: 'Yeniden aç' }).click();
  await p.waitForTimeout(300);
  if ((await cagrilar(p, 'gonderimi_yeniden_ac')).length > 0) bozuk('GEÇMİŞ TARİH AĞA GİTTİ');
  else if (!/bugünden önce olamaz/.test(await d.innerText())) bozuk('geçmiş tarih hatası görünmüyor');
  else tamam('C1b: geçmiş tarih ağa gitmedi, "bugünden önce olamaz"');

  // C3 — seçilen tarih yükte.
  const secilen = gun(5);
  await tarih.fill(secilen);
  await p.waitForTimeout(150);

  // Önizleme: öğretmen ne gideceğini görüyor.
  const on = d.locator('[data-test="iptal-onizleme"]');
  if ((await on.count()) !== 1) bozuk('iptal önizlemesi yok');
  else {
    const t = await on.innerText();
    const noktali = secilen.split('-').reverse().join('.');
    if (!t.includes('Üslü ve köklü') || !t.includes('Boş sayfa gönderilmiş') || !t.includes(noktali)) {
      bozuk(`önizleme eksik: ${t.slice(0, 160)}`);
    } else tamam('C3a: önizleme ödev adını, sebebi ve tarihi taşıyor');
  }

  await d.getByRole('button', { name: 'Yeniden aç' }).click();
  await p.waitForTimeout(500);
  const c = await cagrilar(p, 'gonderimi_yeniden_ac');
  if (c.length !== 1) bozuk(`çağrı sayısı ${c.length}`);
  else if (c[0].govde.p_son_tarih !== secilen) {
    bozuk(`p_son_tarih yanlış/yok: ${JSON.stringify(c[0].govde)}`);
  } else tamam(`C3: p_son_tarih=${secilen} ağa gitti`);
  await b.close();
}

console.log('--- C4. Gönderim listesinde "ek süre verildi · <tarih>" ---');
{
  const EK = gun(7);
  // İptalden SONRAKİ gerçek durum: satır silindi, öğrenci "Göndermeyenler"e
  // düştü ve ek süresi var. Öğretmen verdiği tarihi burada görmeli.
  const gonderimler = {
    ...TEMEL_GONDERIMLER,
    ozet: { mevcut: 1, gonderen: 0, gecikmeli: 0, puan_bekleyen: 0 },
    satirlar: [{
      ...TEMEL_GONDERIMLER.satirlar[0],
      gonderim_id: null, gonderdi: false, zaman: null, durum: null,
      dogru: null, yanlis: null, bos: null, puan: null, foto_var: false,
      ek_sure: EK,
    }],
  };
  const { b, p } = await kur({ oturum: OGRETMEN_OTURUMU, ben: SAHIP, gonderimler }, '/ogretmen/odevler/a1/gonderimler');
  const etiketler = p.locator('[data-test="ek-sure"]');
  if ((await etiketler.count()) < 1) bozuk('"ek süre verildi" etiketi çizilmedi');
  else {
    const t = await etiketler.first().innerText();
    if (t !== `ek süre verildi · ${gunTr(EK)}`) bozuk(`etiket metni yanlış: "${t}"`);
    else tamam(`C4: "${t}"`);
  }
  // Tarih yoksa hiçbir şey çizilmemeli — boş bir etiket gürültüdür.
  await b.close();
  const yok = await kur({ oturum: OGRETMEN_OTURUMU, ben: SAHIP }, '/ogretmen/odevler/a1/gonderimler');
  if ((await yok.p.locator('[data-test="ek-sure"]').count()) !== 0) bozuk('ek süre yokken etiket çizildi');
  else tamam('C4b: ek süre yokken etiket yok');
  await yok.b.close();
}

console.log('--- C5. Öğrenci: sınıf tarihi GEÇMİŞ, kişisel tarih açık ---');
{
  const EK = gun(6);
  // Tam da öğretmenin olayı: sınıfın tarihi geçti, geç teslim KAPALI,
  // ama bu öğrenciye ek süre verildi. Ekran "Teslim kapandı" derse
  // öğrenci sunucu kabul ederken gönderemediğini sanır.
  const odevler = {
    ...TEMEL_ODEVLER,
    odevler: [{ ...TEMEL_ODEVLER.odevler[0], son_tarih: gun(-5), gec_teslim: false, ek_sure: EK }],
  };
  for (const [ad, yol] of [['liste', '/ogrenci/odevler'], ['teslim ekranı', '/ogrenci/odev/a1']]) {
    const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null, odevler }, yol);
    const k = p.locator('[data-test="ogrenci-ek-sure"]');
    if ((await k.count()) < 1) bozuk(`${ad}: kişisel tarih yazmıyor`);
    else if ((await k.first().innerText()) !== `Sana verilen süre: ${gunTr(EK)}`) {
      bozuk(`${ad}: metin yanlış — "${await k.first().innerText()}"`);
    } else tamam(`${ad}: "Sana verilen süre: ${gunTr(EK)}"`);
    const t = await metin(p);
    if (/Teslim kapandı|Geç teslim kabul edilmiyor/.test(t)) bozuk(`${ad}: kişisel süre açıkken "teslim kapandı" yazıyor`);
    else tamam(`${ad}: "teslim kapandı" yazmıyor`);
    await b.close();
  }
  // Teslim ekranında gönderme yolu GERÇEKTEN açık mı.
  const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null, odevler }, '/ogrenci/odev/a1');
  if ((await p.locator('input[type=file]').count()) === 0) bozuk('kişisel süre açıkken yükleme alanı yok');
  else tamam('C5b: yükleme alanı açık');
  // EKRAN GÖRÜNTÜSÜ BULDU: süre geçmişken çıkan kutu "öğretmenin geç
  // teslime izin veriyor" diyordu — oysa `gec_teslim` KAPALI; izin
  // sınıfa değil, yalnız bu öğrenciye verildi.
  const t2 = await metin(p);
  if (/geç teslime izin veriyor/.test(t2)) bozuk('C5d: ek süreyi sınıfın geç teslim ayarı gibi anlatıyor');
  else if (!/ek süre verdi/.test(t2)) bozuk('C5d: süre geçmişken neden gönderebildiği yazmıyor');
  else tamam('C5d: "öğretmenin sana ... ek süre verdi"');
  await b.close();

  // KİŞİSEL SÜRE DE DOLMUŞSA kapı yine kapalı — ek süre sınırsız değil.
  const dolmus = {
    ...TEMEL_ODEVLER,
    odevler: [{ ...TEMEL_ODEVLER.odevler[0], son_tarih: gun(-9), gec_teslim: false, ek_sure: gun(-2) }],
  };
  const g = await kur({ oturum: OGRENCI_OTURUMU, ben: null, odevler: dolmus }, '/ogrenci/odev/a1');
  if (!/Teslim kapandı|süresi doldu/i.test(await metin(g.p))) bozuk('C5c: ek süre dolmuşken ekran hâlâ açık');
  else tamam('C5c: ek süre dolunca kapı yine kapalı');
  await g.b.close();
}

console.log('--- C6. 360 px: taşma yok ---');
{
  const EK = gun(7);
  const gonderimler = {
    ...TEMEL_GONDERIMLER,
    satirlar: [{ ...TEMEL_GONDERIMLER.satirlar[0], gecikmeli: true, ek_sure: EK }],
  };
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 900 } });
  await s.addInitScript(({ oturum, ben, GONDERIMLER, OGRENCI_ODEVLERI }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const asil = window.fetch;
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      switch (m[1]) {
        case 'ben_kimim': return json(ben);
        case 'odev_gonderimleri': return json(GONDERIMLER);
        case 'ogrenci_odevleri': return json(OGRENCI_ODEVLERI);
        default: return json({});
      }
    };
  }, { oturum: OGRETMEN_OTURUMU, ben: SAHIP, GONDERIMLER: gonderimler, OGRENCI_ODEVLERI: TEMEL_ODEVLER });
  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/odevler/a1/gonderimler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  // Etiket "Gecikmeli" ile YAN YANA duruyor: dar ekranda ikisi birden
  // satıra sığmazsa kutudan taşar ya da kırpılır.
  const olcu = await p.evaluate(() => {
    const e = document.querySelector('[data-test="ek-sure"]');
    if (!e) return { yok: true };
    return {
      yok: false,
      kirpik: e.scrollWidth > e.clientWidth + 1,
      yatay: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  if (olcu.yok) bozuk('360 px: etiket çizilmedi');
  else if (olcu.kirpik) bozuk('360 px: etiket kırpıldı');
  else if (olcu.yatay) bozuk('360 px: sayfa yatay kayıyor');
  else tamam('C6: 360 px — kırpılma ve yatay kayma yok');
  await p.locator('[data-test="ek-sure"]').first().screenshot({ path: '/tmp/claude-0/0081-ek-sure-360.png' }).catch(() => {});
  await b.close();
}

// ---------------------------------------------------------------------------
// D. 0082 — FOTOĞRAFI YENİDEN YÜKLEME
// ---------------------------------------------------------------------------
const ESKI1 = `cozum/a1/o1.jpg`;
const ESKI2 = `cozum/a1/o1-2.jpg`;

/** Gönderimi yeniden açılmış öğrencinin ödevi: 2. deneme, iki eski sayfa. */
const ACILMIS = {
  ...TEMEL_ODEVLER,
  odevler: [{
    ...TEMEL_ODEVLER.odevler[0],
    deneme_no: 2,
    onceki_sayfalar: [ESKI1, ESKI2],
  }],
};

console.log('--- D1. Önceki sayfa yokken seçim çizilmiyor ---');
{
  const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null }, '/ogrenci/odev/a1');
  if ((await p.locator('[data-test="yukleme-yolu"]').count()) !== 0) {
    bozuk('D1: iptal edilmemiş ödevde seçim çizildi');
  } else if ((await p.locator('input[type=file]').count()) === 0) {
    bozuk('D1: yükleme alanı kayboldu');
  } else tamam('D1: seçim yok, yükleme alanı bugünkü gibi');
  await b.close();
}

console.log('--- D2/D3. İki yol görünüyor; yeni yükleme -d2 yoluna gidiyor ---');
{
  const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null, odevler: ACILMIS }, '/ogrenci/odev/a1');
  const secim = p.locator('[data-test="yukleme-yolu"]');
  if ((await secim.count()) !== 1) bozuk('D2: seçim çizilmedi');
  else {
    const t = await secim.innerText();
    if (!/Yeni fotoğraf yükle/.test(t) || !/Önceki sayfalarımı kullan/.test(t)) {
      bozuk(`D2: iki yol görünmüyor: ${t.slice(0, 160)}`);
    } else if (!/2 sayfa/.test(t)) bozuk('D2: önceki sayfa sayısı yazmıyor');
    else tamam('D2: iki yol görünüyor, "2 sayfa" yazıyor');
    // VARSAYILAN YENİ YÜKLEME: iptalin sebebi çoğu zaman sayfaların kendisi.
    const secili = await secim.locator('input[type=radio]').nth(0).isChecked();
    if (!secili) bozuk('D2b: varsayılan "yeni fotoğraf" değil');
    else if ((await p.locator('input[type=file]').count()) === 0) {
      bozuk('D2b: varsayılan yeniyken yükleme alanı yok');
    } else tamam('D2b: varsayılan yeni yükleme, alan açık');
  }

  // D3 — yüklenen sayfa YENİ DENEMENİN yoluna gidiyor. Eski yola gitseydi
  // depo "zaten var" der ve ESKİ fotoğraf gönderilirdi: düzeltilen kusur.
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum.jpg', mimeType: 'image/jpeg', buffer: FOTO });
  await p.waitForTimeout(600);
  await gonderBas(p);
  await p.waitForTimeout(400);
  if ((await p.locator('dialog[open]').count()) > 0) {
    await p.locator('dialog[open]').getByRole('button', { name: 'Yine de gönder' }).click();
    await p.waitForTimeout(800);
  }
  const imza = await cagrilar(p, 'dosya-url');
  if (imza.length === 0) bozuk('D3: hiç yükleme adresi istenmedi');
  else if (imza[0].govde?.yol !== 'cozum/a1/o1-d2.jpg') {
    bozuk(`D3: ESKİ YOLA YÜKLENİYOR — yeni fotoğraf atılır: ${imza[0].govde?.yol}`);
  } else tamam('D3: yükleme cozum/a1/o1-d2.jpg yoluna gitti');
  const g = await cagrilar(p, 'odev_gonder');
  if (g.length !== 1 || g[0].govde.p_foto_yolu !== 'cozum/a1/o1-d2.jpg') {
    bozuk(`D3b: gönderimde yol yanlış: ${JSON.stringify(g.map((x) => x.govde?.p_foto_yolu))}`);
  } else tamam('D3b: odev_gonder yeni yolu taşıyor');
  await b.close();
}

console.log('--- D4. "Önceki sayfalarımı kullan": yükleme yok, eski yollar gidiyor ---');
{
  const { b, p } = await kur({ oturum: OGRENCI_OTURUMU, ben: null, odevler: ACILMIS }, '/ogrenci/odev/a1');
  const secim = p.locator('[data-test="yukleme-yolu"]');
  await secim.locator('input[type=radio]').nth(1).check();
  await p.waitForTimeout(250);
  // Yükleme alanı kapanıyor: öğrenci fotoğraf seçmeyecek.
  if ((await p.locator('input[type=file]').count()) !== 0) {
    bozuk('D4: önceki seçiliyken yükleme alanı hâlâ açık');
  } else tamam('D4: önceki seçilince yükleme alanı kapandı');
  // Öğrenci NEYİ göndereceğini görebilmeli: sayfa düğmeleri çizilmiş ve
  // gerçekten dokunulabilir olmalı (alt çubuk örtmemeli).
  const sayfaDugmeleri = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[data-test="yukleme-yolu"] button')];
    return d.map((x) => {
      x.scrollIntoView({ block: 'center' });
      const r = x.getBoundingClientRect();
      const ust = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { metin: (x.textContent ?? '').trim(), ortulu: !x.contains(ust) };
    });
  });
  if (sayfaDugmeleri.length !== 2) bozuk(`D4a: önceki sayfa düğmeleri ${sayfaDugmeleri.length} tane`);
  else if (sayfaDugmeleri.some((x) => x.ortulu)) bozuk('D4a: sayfa düğmesi örtülü');
  else if (sayfaDugmeleri[0].metin !== '1. sayfa') bozuk(`D4a: etiket yanlış: ${sayfaDugmeleri[0].metin}`);
  else tamam('D4a: "1. sayfa" ve "2. sayfa" çizili ve dokunulabilir');
  await gonderBas(p);
  await p.waitForTimeout(400);
  if ((await p.locator('dialog[open]').count()) > 0) {
    await p.locator('dialog[open]').getByRole('button', { name: 'Yine de gönder' }).click();
    await p.waitForTimeout(800);
  }
  if ((await cagrilar(p, 'dosya-url')).length > 0 || (await cagrilar(p, 'depo-yukle')).length > 0) {
    bozuk('D4b: önceki sayfalar seçiliyken yine de yükleme yapıldı');
  } else tamam('D4b: hiç yükleme yok');
  const g = await cagrilar(p, 'odev_gonder');
  if (g.length !== 1
      || g[0].govde.p_foto_yolu !== ESKI1
      || g[0].govde.p_ek_sayfa_yollari?.[0] !== ESKI2) {
    bozuk(`D4c: eski yollar gönderilmedi: ${JSON.stringify(g.map((x) => x.govde?.p_foto_yolu))}`);
  } else tamam('D4c: odev_gonder önceki iki sayfayı taşıyor');
  await b.close();
}

console.log('--- D5. 360 px: taşma yok ---');
{
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 900 } });
  await s.addInitScript(({ oturum, O }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const asil = window.fetch;
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      switch (m[1]) {
        case 'ogrenci_odevleri': return json(O);
        case 'odev_sayfa_siniri': return json(1);
        case 'ewalu_mesajlari': return json([]);
        default: return json({});
      }
    };
  }, { oturum: OGRENCI_OTURUMU, O: ACILMIS });
  const p = await s.newPage();
  await p.goto(KOK + '#/ogrenci/odev/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const olcu = await p.evaluate(() => {
    const e = document.querySelector('[data-test="yukleme-yolu"]');
    if (!e) return { yok: true };
    return {
      yok: false,
      tasan: e.scrollWidth > e.clientWidth + 1,
      yatay: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  if (olcu.yok) bozuk('D5: 360 px: seçim çizilmedi');
  else if (olcu.tasan) bozuk('D5: 360 px: seçim kutudan taşıyor');
  else if (olcu.yatay) bozuk('D5: 360 px: sayfa yatay kayıyor');
  else tamam('D5: 360 px — taşma ve yatay kayma yok');
  await p.locator('[data-test="yukleme-yolu"]').screenshot({ path: '/tmp/claude-0/0082-secim-360.png' }).catch(() => {});
  await b.close();
}

// ---------------------------------------------------------------------------
// E. 0084 — GÖNDERMEYENE EK SÜRE (çoklu seçim)
// ---------------------------------------------------------------------------
/** İki göndermeyen + bir gönderen: kutu yalnız göndermeyenlerde olmalı. */
const EK_SURE_LISTESI = {
  ...TEMEL_GONDERIMLER,
  ozet: { mevcut: 3, gonderen: 1, gecikmeli: 0, puan_bekleyen: 0 },
  satirlar: [
    { ...TEMEL_GONDERIMLER.satirlar[0], ogrenci_id: 'o1', ogrenci: 'Duru Dilara Aygün' },
    {
      ...TEMEL_GONDERIMLER.satirlar[0],
      ogrenci_id: 'o2', ogrenci: 'Elif Naz Yıldırım',
      gonderim_id: null, gonderdi: false, zaman: null, durum: null,
      dogru: null, yanlis: null, bos: null, puan: null, foto_var: false,
    },
    {
      ...TEMEL_GONDERIMLER.satirlar[0],
      ogrenci_id: 'o3', ogrenci: 'Mert Can Demir',
      gonderim_id: null, gonderdi: false, zaman: null, durum: null,
      dogru: null, yanlis: null, bos: null, puan: null, foto_var: false,
    },
  ],
};

console.log('--- E1/E2. Kutu yalnız göndermeyenlerde; seçim yokken düğme kapalı ---');
{
  const { b, p } = await kur(
    { oturum: OGRETMEN_OTURUMU, ben: SAHIP, gonderimler: EK_SURE_LISTESI },
    '/ogretmen/odevler/a1/gonderimler',
  );
  const kutular = p.locator('[data-test="ek-sure-kutusu"]');
  // Listede üç öğrenci var ama yalnız ikisi göndermemiş. Kutu gönderene
  // de çizilseydi öğretmen ona süre verir, sunucu reddederdi.
  if ((await kutular.count()) !== 2) bozuk(`E1: kutu sayısı ${await kutular.count()} (2 olmalı)`);
  else tamam('E1: onay kutusu yalnız göndermeyen iki öğrencide');

  const dugme = p.getByRole('button', { name: /Seçilenlere ek süre ver/ });
  if (!(await dugme.isDisabled())) bozuk('E2: seçim yokken düğme açık');
  else tamam('E2: seçim yokken düğme kapalı');

  // E3 — seçince düğme açılıyor, sayaç çıkıyor, diyalog adları yazıyor.
  await kutular.nth(0).check();
  await kutular.nth(1).check();
  await p.waitForTimeout(200);
  if (await dugme.isDisabled()) bozuk('E3: seçim varken düğme hâlâ kapalı');
  else if (!/2 öğrenci seçildi/.test(await p.locator('[data-test="ek-sure-sayaci"]').innerText())) {
    bozuk('E3: sayaç yanlış');
  } else tamam('E3: iki seçim, "2 öğrenci seçildi"');

  await dugme.click();
  await p.waitForTimeout(250);
  const d = p.locator('dialog[open]');
  const kimler = await d.locator('[data-test="ek-sure-kimler"]').innerText();
  // ADLAR TEK TEK: "2 öğrenciye" deseydi yanlış seçim fark edilmezdi.
  if (!/Elif Naz Yıldırım/.test(kimler) || !/Mert Can Demir/.test(kimler)) {
    bozuk(`E3b: diyalogda adlar yok: ${kimler}`);
  } else tamam('E3b: diyalog seçilen adları yazıyor');

  const tarih = d.locator('input[type="date"]');
  const deger = await tarih.inputValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deger) || deger < gun(0)) bozuk(`E3c: tarih yanlış: ${deger}`);
  else if ((await tarih.getAttribute('min')) !== gun(0)) bozuk('E3c: min bugün değil');
  else tamam(`E3c: tarih dolu (${deger}), min=bugün`);

  // E4 — sebepsiz onay ağa GİTMİYOR; uyarı dokunmadan görünüyor.
  // ÖNCE VARLIĞI SAYILIYOR: eleman yoksa `innerText()` çöküyor ve betik
  // kırmızı ÜRETMEDEN düşüyor — kusur provası bunu gösterdi.
  const uyari = d.locator('[data-test="ek-sure-sebep-uyarisi"]');
  if ((await uyari.count()) !== 1) bozuk('E4: sebep uyarısı çizilmedi');
  else if (!/öğrenciye mesaj olarak gönderilir/.test(await uyari.innerText())) {
    bozuk('E4: sebep uyarısı görünmüyor');
  } else tamam('E4: "sebep öğrenciye mesaj olarak gönderilir" dokunmadan görünüyor');

  await d.getByRole('button', { name: 'Ek süre ver' }).click();
  await p.waitForTimeout(300);
  if ((await cagrilar(p, 'ogrencilere_ek_sure')).length > 0) bozuk('E4b: SEBEPSİZ ÇAĞRI AĞA GİTTİ');
  else tamam('E4b: sebepsiz onay ağa gitmedi');

  // E5 — doğru yük.
  await d.locator('textarea').fill('Rahatsızdınız, sonradan gönderebilirsiniz.');
  await tarih.fill(gun(6));
  await p.waitForTimeout(200);
  const on = d.locator('[data-test="ek-sure-onizleme"]');
  if ((await on.count()) !== 1) bozuk('E5a: önizleme yok');
  else {
    const t = await on.innerText();
    const nokta = gun(6).split('-').reverse().join('.');
    if (!t.includes('Üslü ve köklü') || !t.includes(nokta)) {
      bozuk(`E5a: önizleme eksik: ${t.slice(0, 140)}`);
    } else tamam('E5a: önizleme ödev adını ve tarihi taşıyor');
  }
  await d.getByRole('button', { name: 'Ek süre ver' }).click();
  await p.waitForTimeout(600);
  const c = await cagrilar(p, 'ogrencilere_ek_sure');
  if (c.length !== 1) bozuk(`E5: çağrı sayısı ${c.length}`);
  else if (JSON.stringify(c[0].govde?.p_ogrenci_idler) !== '["o2","o3"]') {
    bozuk(`E5: seçilen öğrenciler yanlış: ${JSON.stringify(c[0].govde?.p_ogrenci_idler)}`);
  } else if (c[0].govde?.p_son_tarih !== gun(6)) {
    bozuk(`E5: tarih yanlış/yok: ${c[0].govde?.p_son_tarih}`);
  } else if (!c[0].govde?.p_neden) bozuk('E5: sebep yükte yok');
  else tamam(`E5: ogrencilere_ek_sure(["o2","o3"], ${gun(6)}, sebep) çağrıldı`);
  await b.close();
}

console.log('--- E6. 360 px: taşma yok ---');
{
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 900 } });
  await s.addInitScript(({ oturum, ben, G }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const asil = window.fetch;
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      if (m[1] === 'ben_kimim') return json(ben);
      if (m[1] === 'odev_gonderimleri') return json(G);
      return json({});
    };
  }, { oturum: OGRETMEN_OTURUMU, ben: SAHIP, G: EK_SURE_LISTESI });
  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/odevler/a1/gonderimler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const olcu = await p.evaluate(() => {
    const k = document.querySelector('[data-test="ek-sure-kutusu"]');
    if (!k) return { yok: true };
    const r = k.getBoundingClientRect();
    return {
      yok: false,
      // Dokunma hedefi 44 px'in altına düşmemeli: etiketin tamamı tıklanır.
      kucuk: (k.closest('label')?.getBoundingClientRect().height ?? 0) < 44,
      yatay: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      disarida: r.left < 0 || r.right > document.documentElement.clientWidth,
    };
  });
  if (olcu.yok) bozuk('E6: 360 px: kutu çizilmedi');
  else if (olcu.kucuk) bozuk('E6: 360 px: dokunma hedefi 44 px altında');
  else if (olcu.yatay) bozuk('E6: 360 px: sayfa yatay kayıyor');
  else if (olcu.disarida) bozuk('E6: 360 px: kutu ekran dışında');
  else tamam('E6: 360 px — kutu 44 px, taşma ve yatay kayma yok');
  await b.close();
}

console.log('');
if (hata) { console.log(`YENİDEN AÇMA DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('YENİDEN AÇMA DENETİMİ GEÇTİ');
