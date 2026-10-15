/**
 * ANONİM ANKET (Chromium, taklit RPC) — 0076
 *
 *  A1. Öğrenci: anket açıkken panoda davet kartı; "Ankete katıl" anket
 *      sayfasını açıyor; 7 madde (fieldset+legend); bütün maddeler
 *      yanıtlanmadan Gönder kapalı; gönderim `anket_yanitla`ya m1–m7 ve
 *      görüşle gidiyor; "Teşekkür ederiz".
 *  A2. Veli: 5 madde. A3. Öğretmen: Panoda davet, 5 madde.
 *  A4. Katıldıysa ya da anket kapalıysa davet YOK; "Şimdi değil" gizliyor.
 *  A5. Proje raporu (müdür): "Paydaş görüşleri"; n < 5 grupta "Henüz
 *      yeterli yanıt yok"; yeterli grupta dağılım metni (payda ile).
 *  A6. Sahip Ayarlar: "Anketi aç" `anket_ac_kapat`ı p_acik=true ile çağırıyor.
 *  A7. 360 px'de taşma yok; ankette ad/sınıf/kod alanı yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/anket-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';
const OGR = { id: 'o1', ad: 'Örnek Öğrenci', tur: 'okul', sinif: '9A' };
const DURUM = (rol, ek = {}) => ({ acik: true, anket: '2026-2027-1', rol, madde_sayisi: rol === 'ogrenci' ? 7 : 5, katildi: false, deneme: false, ...ek });
const SONUC = [{
  anket: '2026-2027-1', baslik: '2026-2027 1. dönem SEKİZ görüş anketi', acik: false, esik: 5,
  gruplar: [
    { rol: 'ogrenci', katilim: 12, yanit: 12, yeterli: true,
      maddeler: Array.from({ length: 7 }, (_, i) => ({ madde: `m${i + 1}`, dagilim: [1, 1, 2, 4, 4], ortalama: 3.75 })),
      gorusler: ['Daha çok konu testi olsun.'] },
    { rol: 'veli', katilim: 3, yanit: 3, yeterli: false, maddeler: [], gorusler: [] },
    { rol: 'ogretmen', katilim: 2, yanit: 2, yeterli: false, maddeler: [], gorusler: [] },
  ],
}];

async function ac({ rol, yol, durum, en = 390 }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 1000 } });
  const cagrilar = [];
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    let govde = null;
    try { govde = JSON.parse(r.request().postData() ?? 'null'); } catch { /* yok */ }
    cagrilar.push({ uc, govde });
    const yanit = {
      anket_durumu: durum, anket_yanitla: { kaydedildi: true }, anket_sonuclari: SONUC,
      anket_ac_kapat: SONUC,
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null },
      ogrenci_odevleri: { ogrenci: OGR, odevler: [], dersler: [], okunmamis_mesaj: 0, okunmamis_duyuru: 0 },
      ogrenci_duyurulari: [],
      veli_paneli: { ogrenci: OGR, tur: 'okul', onam_gerekli: false, odevler: [], mesajlar: [], ogretmenler: [],
        okunmamis_mesaj: 0, odemeler: [], son_gorulme: null, genel_ortalama: null },
      ogretmen_panosu: { odev_verilen_ogrenci: 0, acik_odev: 0, bekleyen_degerlendirme: 0, gecikmis_eksik: 0, son_gonderimler: [] },
      okul_geneli: { yil_baslangici: '2026-09-01', okul: { sinif_sayisi: 0, ogrenci_sayisi: 0, odev_sayisi: 0, soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null, ortalama: null }, seviyeler: [], siniflar: [], aylar: [] },
      mudur_paneli: { ad: 'Ayşe Kaya', yil_baslangici: '2026-09-01', okul: { sinif_sayisi: 0, ogrenci_sayisi: 0, odev_sayisi: 0, soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null, ortalama: null }, seviyeler: [], siniflar: [], aylar: [], ogretmenler: [] },
      proje_raporu: null, bildirim_sayilari: {}, siniflar_listesi: [], duyurular_ogretmen: [], ogretmen_duyurulari: [],
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });
  await p.addInitScript(([rl, o]) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: rl, token: 't'.repeat(64), ...(rl === 'ogrenci' || rl === 'veli' ? { ogrenci: o } : {}) }));
  }, [rol, OGR]);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { b, p, cagrilar };
}
const davet = (p) => p.getByRole('heading', { name: /Kısa anket — 2 dakika, isimsiz/ });

for (const [rol, yol, madde] of [['ogrenci', '/ogrenci', 7], ['veli', '/veli', 5], ['ogretmen', '/ogretmen', 5]]) {
  console.log(`--- A1–A3. ${rol} ---`);
  const { b, p, cagrilar } = await ac({ rol, yol, durum: DURUM(rol) });
  ((await davet(p).count()) === 1 ? tamam : bozuk)('panoda davet kartı');
  await p.getByRole('link', { name: 'Ankete katıl' }).click();
  await p.waitForTimeout(600);
  (p.url().endsWith(`${yol}/anket`) ? tamam : bozuk)(`anket sayfası açıldı (${p.url().split('#')[1]})`);
  const gruplar = p.locator('fieldset');
  ((await gruplar.count()) === madde ? tamam : bozuk)(`${madde} madde (fieldset)`);
  ((await p.locator('fieldset legend').count()) === madde ? tamam : bozuk)('her maddenin legend\'ı var');
  const gonder = p.getByRole('button', { name: 'Gönder' });
  ((await gonder.isDisabled()) ? tamam : bozuk)('yanıtsızken Gönder kapalı');
  const metin = await p.locator('main').innerText();
  (!/\b(Ad|Adınız|Sınıfınız|Kodunuz)\s*:/.test(metin) && (await p.locator('input[type=text]').count()) === 0 ? tamam : bozuk)('ad/sınıf/kod alanı yok');
  for (let i = 0; i < madde; i++) {
    await gruplar.nth(i).locator('label').nth((i % 5)).click();
  }
  await p.getByLabel(/isteğe bağlı/).fill('Örnek görüş');
  ((await gonder.isEnabled()) ? tamam : bozuk)('bütün maddeler yanıtlanınca Gönder açık');
  if (rol === 'ogrenci') {
    const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    (t <= 0 ? tamam : bozuk)(`anket sayfası 390 px taşma yok (${t} px)`);
  }
  await gonder.click();
  await p.waitForTimeout(500);
  const g = cagrilar.filter((c) => c.uc === 'anket_yanitla').at(-1)?.govde?.p_cevaplar ?? {};
  const beklenen = Object.fromEntries(Array.from({ length: madde }, (_, i) => [`m${i + 1}`, (i % 5) + 1]));
  (JSON.stringify(g) === JSON.stringify({ ...beklenen, acik: 'Örnek görüş' }) ? tamam : bozuk)(`gövde doğru (${JSON.stringify(g)})`);
  (/Teşekkür ederiz/.test(await p.locator('main').innerText()) ? tamam : bozuk)('teşekkür ekranı');
  await b.close();
}

console.log('--- A4. Davet görünmemeli ---');
for (const [ad, durum] of [['katıldı', DURUM('ogrenci', { katildi: true })], ['kapalı', { acik: false }]]) {
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci', durum });
  ((await davet(p).count()) === 0 ? tamam : bozuk)(`${ad}: davet yok`);
  await b.close();
}
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci', durum: DURUM('ogrenci') });
  await p.getByRole('button', { name: 'Şimdi değil' }).click();
  await p.waitForTimeout(200);
  ((await davet(p).count()) === 0 ? tamam : bozuk)('"Şimdi değil" kartı gizledi');
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ((await davet(p).count()) === 0 ? tamam : bozuk)('yenilenince de gizli (bu cihazda)');
  await b.close();
}

console.log('--- A5. Proje raporu: paydaş görüşleri ---');
{
  const { b, p } = await ac({ rol: 'mudur', yol: '/mudur/rapor', durum: { acik: false } });
  const m = await p.locator('main').innerText();
  (/Paydaş görüşleri/.test(m) ? tamam : bozuk)('bölüm var');
  (/Veli anketi[\s\S]*Henüz yeterli yanıt yok \(en az 5\)/.test(m) ? tamam : bozuk)('n<5 grupta "henüz yeterli yanıt yok"');
  (/Ortalama 3,75 \/ 5 · katılıyorum ve tamamen katılıyorum: %67 \(8\/12\)/.test(m) ? tamam : bozuk)(`yeterli grupta dağılım metni payda ile (${(m.match(/Ortalama[^\n]*/) ?? [''])[0]})`);
  ((await p.getByRole('button', { name: /Anketi (aç|kapat)/ }).count()) === 0 ? tamam : bozuk)('müdürde aç/kapat düğmesi yok');
  await b.close();
}

console.log('--- A6. Sahip: aç/kapat ---');
{
  const { b, p, cagrilar } = await ac({ rol: 'ogretmen', yol: '/ogretmen/ayarlar', durum: { acik: false } });
  await p.getByRole('button', { name: 'Anketi aç' }).click();
  await p.waitForTimeout(400);
  const c = cagrilar.filter((x) => x.uc === 'anket_ac_kapat').at(-1)?.govde;
  (c?.p_acik === true && c?.p_anket === '2026-2027-1' ? tamam : bozuk)(`anket_ac_kapat p_acik=true (${JSON.stringify(c)})`);
  await b.close();
}

console.log('--- A7. 360 px ---');
{
  const { b, p } = await ac({ rol: 'veli', yol: '/veli/anket', durum: DURUM('veli'), en: 360 });
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 ? tamam : bozuk)(`veli anket sayfası 360 px taşma yok (${t} px)`);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`ANKET DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('ANKET DENETİMİ GEÇTİ');
