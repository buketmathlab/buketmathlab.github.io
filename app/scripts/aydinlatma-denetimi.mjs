/**
 * KVKK AYDINLATMA METNİ (Chromium)
 *
 *  K1. `/yeni/aydinlatma/` oturumsuz açılıyor; veri sorumlusu, haklar,
 *      İsviçre barındırma ve başvuru yolu yazıyor; sunucuya (Supabase)
 *      HİÇ istek gitmiyor.
 *  K2. Giriş ekranında "Aydınlatma metni" bağlantısı bu sayfaya gidiyor.
 *  K3. Veli onam ekranında aydınlatma metni bağlantısı var (yeni sekme).
 *  K4. Yazdırma: "Yazdır" düğmesi kâğıtta yok, imza bloğu var; A4 PDF.
 *  K5. 360 px'de yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/aydinlatma-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const b = await chromium.launch();

console.log('--- K1. Oturumsuz, sunucusuz ---');
{
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const istekler = [];
  p.on('request', (r) => { if (/supabase/.test(r.url())) istekler.push(r.url()); });
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + 'aydinlatma/', { waitUntil: 'networkidle' });
  const m = await p.locator('main').innerText();
  (/Veri sorumlusu[\s\S]*Arnavutköy Korkmaz Yiğit Anadolu Lisesi Müdürlüğü/.test(m) ? tamam : bozuk)('veri sorumlusu okul müdürlüğü');
  (/Haklarınız \(KVKK madde 11\)/.test(m) && /düzeltilmesini/.test(m) ? tamam : bozuk)('haklar');
  (/İsviçre/.test(m) && /yurt dışına aktarım/.test(m) ? tamam : bozuk)('barındırma ve aktarım dürüstçe');
  (/okul numarası/.test(m) && /Okul müdürü salt izleme/.test(m) ? tamam : bozuk)('öğrenci numarası ve müdür erişimi yazıyor');
  (istekler.length === 0 ? tamam : bozuk)(`sunucuya istek yok (${istekler.length})`);
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  console.log('--- K4. Yazdırma ---');
  await p.emulateMedia({ media: 'print' });
  ((await p.getByRole('button', { name: 'Yazdır' }).evaluateAll((e) => e.filter((x) => x.offsetParent !== null).length)) === 0 ? tamam : bozuk)('Yazdır düğmesi kâğıtta yok');
  (/Onaylayan \(Okul Müdürü\)/.test(await p.locator('article').innerText()) ? tamam : bozuk)('imza bloğu kâğıtta');
  const pdf = await p.pdf({ format: 'A4', printBackground: true });
  (pdf.length > 15000 ? tamam : bozuk)(`A4 PDF (${Math.round(pdf.length / 1024)} KB)`);
  await p.close();

  console.log('--- K5. 360 px ---');
  const p2 = await b.newPage({ viewport: { width: 360, height: 800 } });
  await p2.goto(KOK + 'aydinlatma/', { waitUntil: 'networkidle' });
  const t2 = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 && t2 <= 0 ? tamam : bozuk)(`yatay taşma yok (390: ${t}, 360: ${t2})`);
  await p2.close();
}

console.log('--- K2. Giriş ekranı bağlantısı ---');
{
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  await p.route('**/rest/v1/rpc/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await p.goto(KOK, { waitUntil: 'networkidle' });
  const a = p.getByRole('link', { name: 'Aydınlatma metni' });
  ((await a.getAttribute('href')) === '/yeni/aydinlatma/' ? tamam : bozuk)('giriş ekranında bağlantı');
  await p.close();
}

console.log('--- K3. Onam ekranı bağlantısı ---');
{
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const OGR = { id: 'o1', ad: 'Örnek Öğrenci', tur: 'okul', sinif: '9A' };
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = uc === 'veli_paneli' ? { onam_gerekli: true, ogrenci: OGR } : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'veli', token: 'v'.repeat(64), ogrenci: o })), OGR);
  await p.goto(KOK + '#/veli', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const a = p.getByRole('link', { name: 'KVKK aydınlatma metnini' });
  ((await a.count()) === 1 && (await a.getAttribute('target')) === '_blank' ? tamam : bozuk)('onam ekranında bağlantı (yeni sekme)');
  await p.close();
}

await b.close();
console.log('');
if (hata) {
  console.log(`AYDINLATMA DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('AYDINLATMA DENETİMİ GEÇTİ');
