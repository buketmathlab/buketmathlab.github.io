/**
 * DENEME HESABI (Chromium, taklit RPC) — 0073
 *
 * Öğretmenin isteği: gerçek olmayan bir öğrenci ve velisiyle sistemi
 * birebir denemek. Kart Öğretmenler sayfasında, öğretmen ve müdür
 * hesaplarının yanında; yalnız platform sahibinde. Oradan tek tıkla
 * deneme öğrencinin ya da velinin hesabına geçiliyor.
 *
 *  H1. Hesap yok: sınıf seçimi (yalnız okul sınıfları; özel ders ve arşiv
 *      yok) ve "Deneme hesabı oluştur" → `deneme_hesabi_olustur` seçilen
 *      sınıfla çağrılıyor.
 *  H2. Hesap var: sınıf, öğrenci kodu ve veli kodu görünüyor; "Sınıfı
 *      kaydet" yeni sınıfla; "Denemeyi sıfırla" ve "Deneme hesabını sil"
 *      ONAYDAN SONRA çağrılıyor.
 *  H3. Sahip olmayan öğretmen: kart YOK. (Uca yapılan ilk istek, `ben` gelene
 *      kadarki varsayılan-görünür anda; sunucu `_yonetici` ile reddediyor.)
 *  H4. 0073 çalışmamışsa (uç yok): kart bozulmuyor, ne yapılacağını söylüyor.
 *  H5. Öğrenciler listesinde deneme satırında "Deneme" etiketi.
 *  H6. 360 px'de yatay taşma yok.
 *  H7. Tek tıkla giriş: "Öğrenci olarak gir" `giris`i öğrenci koduyla
 *      çağırıyor, öğrenci ekranı açılıyor ve kapatılamayan deneme şeridi
 *      var; "Öğretmen hesabına dön" deneme oturumunu sunucuda kapatıp
 *      (`cikis`, deneme jetonuyla) sahibin jetonuna ve Öğretmenler
 *      sayfasına dönüyor. Aynısı veli için.
 *  H8. Şerit yalnız deneme oturumunda: aynı sekmede gerçek bir öğrenci
 *      oturumunda (başka öğrenci kimliği) şerit YOK.
 *  H9. Ayarlar'da artık kart yok (tek yerde).
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/deneme-hesabi-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';
const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 30 },
  { id: 's10b', ad: '10B', seviye: 10, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 28 },
  { id: 'soz', ad: 'Özel ders', seviye: 99, sube: 'Ö', ozel: true, arsiv: false, ogrenci_sayisi: 3 },
];
const VAR = { var: true, id: 'd1', sinif_id: 's9a', sinif: '9A', ogrenci_kodu: 'DNMOGR42', veli_kodu: 'DNMVEL77' };

const SAHIP_JETONU = 't'.repeat(64);
const OGR_JETONU = 'o'.repeat(64);
const VELI_JETONU = 'v'.repeat(64);
const DENEME_OGR = { id: 'd1', ad: 'Deneme Öğrenci', tur: 'okul', sinif: '9A' };

async function ac({ yol = '/ogretmen/ogretmenler', sahip = true, deneme = { var: false }, ucYok = false, en = 390, oturum = null } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 1000 } });
  const cagrilar = [];
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    let govde = null;
    try { govde = JSON.parse(r.request().postData() ?? 'null'); } catch { /* yok */ }
    cagrilar.push({ uc, govde });
    if (ucYok && uc === 'deneme_hesabi') {
      return r.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.deneme_hesabi(p_token) in the schema cache' }) });
    }
    const yanit = {
      ben_kimim: { id: 't1', ad: sahip ? 'Buket Topuzoğlu' : 'Barış Atmaca', sahip, vekalet: false, vekil: null },
      ogretmenler_listesi: [
        { id: 't1', ad: 'Buket Topuzoğlu', sahip: true, mudur: false, aktif: true, pin_var: true, sinif_sayisi: 2, odev_sayisi: 5, son_gorulme: null, sinif_idler: [] },
        { id: 'm1', ad: 'Ayşe Müdür', sahip: false, mudur: true, aktif: true, pin_var: true, sinif_sayisi: 0, odev_sayisi: 0, son_gorulme: null, sinif_idler: [] }],
      giris: govde?.p_kod === VAR.ogrenci_kodu ? { rol: 'ogrenci', token: OGR_JETONU, ogrenci: DENEME_OGR }
        : govde?.p_kod === VAR.veli_kodu ? { rol: 'veli', token: VELI_JETONU, ogrenci: DENEME_OGR } : { rol: 'yok' },
      ogrenci_odevleri: { ogrenci: DENEME_OGR, odevler: [], dersler: [], okunmamis_mesaj: 0, okunmamis_duyuru: 0 },
      ogrenci_duyurulari: [],
      veli_paneli: { ogrenci: DENEME_OGR, tur: 'okul', onam_gerekli: false, odevler: [], mesajlar: [], ogretmenler: [],
        okunmamis_mesaj: 0, odemeler: [], son_gorulme: null, genel_ortalama: null },
      cikis: null,
      siniflar_listesi: SINIFLAR,
      deneme_hesabi: deneme,
      deneme_hesabi_olustur: VAR, deneme_sinifi_degistir: { ...VAR, sinif_id: 's10b', sinif: '10B' },
      deneme_sifirla: VAR, deneme_hesabi_sil: { var: false },
      ogrenciler_listesi: { toplam: 2, sayfa: 1, toplam_sayfa: 1, kayitlar: [
        { id: 'a', ad: 'Elif Yıldırım', ogrenci_no: '12', tur: 'okul', sinif: '9A', deneme: false },
        { id: 'd1', ad: 'Deneme Öğrenci', ogrenci_no: null, tur: 'okul', sinif: '9A', deneme: true }] },
      bildirim_sayilari: {}, konu_onerileri: [], odevler_listesi: [],
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });
  await p.addInitScript(([o, j]) => {
    // Yalnız ilk açılışta: sonraki gezinmeler uygulamanın yazdığı oturumu korusun.
    if (!sessionStorage.getItem('denetim.basladi')) {
      sessionStorage.setItem('denetim.basladi', '1');
      localStorage.setItem('sekiz_oturum', JSON.stringify(o ?? { rol: 'ogretmen', token: j }));
    }
  }, [oturum ?? null, SAHIP_JETONU]);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p, cagrilar };
}
const kart = (p) => p.locator('div').filter({ has: p.getByRole('heading', { name: 'Deneme hesabı' }) }).last();
const son = (c, uc) => c.filter((x) => x.uc === uc).at(-1);

console.log('--- H1. Hesap yok: oluştur ---');
{
  const { b, p, cagrilar } = await ac();
  const k = kart(p);
  ((await k.count()) > 0 ? tamam : bozuk)('kart var');
  const secenekler = await k.locator('option').allInnerTexts();
  (secenekler.join(',') === '9A,10B' ? tamam : bozuk)(`sınıflar yalnız okul sınıfları (${secenekler.join(', ')})`);
  await k.getByLabel('Deneme öğrencinin sınıfı').selectOption('s10b');
  await k.getByRole('button', { name: 'Deneme hesabı oluştur' }).click();
  await p.waitForTimeout(400);
  const c = son(cagrilar, 'deneme_hesabi_olustur');
  (c?.govde?.p_sinif === 's10b' ? tamam : bozuk)(`deneme_hesabi_olustur p_sinif=10B (${JSON.stringify(c?.govde ?? null)})`);
  await b.close();
}

console.log('--- H2. Hesap var: kodlar, sınıf, sıfırla, sil ---');
{
  const { b, p, cagrilar } = await ac({ deneme: VAR });
  const k = kart(p);
  const m = await k.innerText();
  (/Sınıfı\s*9A/.test(m) && m.includes('DNMOGR42') && m.includes('DNMVEL77') ? tamam : bozuk)('sınıf, öğrenci kodu ve veli kodu görünüyor');
  (/öğrenci koduyla/.test(m) && /veli\s+koduyla/.test(m) ? tamam : bozuk)('nasıl girileceği yazıyor');
  await k.getByLabel('Sınıfını değiştir').selectOption('s10b');
  await k.getByRole('button', { name: 'Sınıfı kaydet' }).click();
  await p.waitForTimeout(300);
  (son(cagrilar, 'deneme_sinifi_degistir')?.govde?.p_sinif === 's10b' ? tamam : bozuk)('sınıf değiştirme 10B ile');

  await k.getByRole('button', { name: 'Denemeyi sıfırla' }).click();
  await p.waitForTimeout(200);
  (!son(cagrilar, 'deneme_sifirla') ? tamam : bozuk)('sıfırla onaysız çağrılmadı');
  const dlg = p.locator('dialog[open]');
  (/Gerçek öğrencilere dokunulmaz/.test(await dlg.innerText()) ? tamam : bozuk)('onay penceresi gerçek öğrencilere dokunulmayacağını söylüyor');
  await dlg.getByRole('button', { name: 'Sıfırla' }).click();
  await p.waitForTimeout(300);
  (son(cagrilar, 'deneme_sifirla') ? tamam : bozuk)('onaydan sonra deneme_sifirla');

  await k.getByRole('button', { name: 'Deneme hesabını sil' }).click();
  await p.waitForTimeout(200);
  await p.locator('dialog[open]').getByRole('button', { name: 'Sil' }).click();
  await p.waitForTimeout(300);
  (son(cagrilar, 'deneme_hesabi_sil') ? tamam : bozuk)('onaydan sonra deneme_hesabi_sil');
  await b.close();
}

console.log('--- H3. Sahip olmayan öğretmen ---');
{
  const { b, p, cagrilar } = await ac({ sahip: false });
  ((await p.getByRole('heading', { name: 'Deneme hesabı' }).count()) === 0 ? tamam : bozuk)('kart yok');
  void cagrilar;
  await b.close();
}

console.log('--- H4. 0073 öncesi (uç yok) ---');
{
  const { b, p } = await ac({ ucYok: true });
  (/SQL 0073/.test(await kart(p).innerText()) ? tamam : bozuk)('"SQL 0073 … sonra kullanılabilir" yazıyor');
  await b.close();
}

console.log('--- H5. Öğrenciler listesinde etiket ---');
{
  const { b, p } = await ac({ yol: '/ogretmen/ogrenciler' });
  // Genel liste aramayla açılıyor (sınıf kutusu varsayılan görünüm).
  await p.getByRole('searchbox').or(p.getByPlaceholder(/ara/i)).first().fill('e');
  await p.waitForTimeout(700);
  const satir = p.locator('div').filter({ has: p.getByRole('link', { name: 'Deneme Öğrenci' }) }).last();
  ((await satir.getByText('Deneme', { exact: true }).count()) === 1 ? tamam : bozuk)('deneme satırında "Deneme" etiketi');
  const gercek = p.locator('div').filter({ has: p.getByRole('link', { name: 'Elif Yıldırım' }) }).last();
  ((await gercek.getByText('Deneme', { exact: true }).count()) === 0 ? tamam : bozuk)('gerçek öğrencide etiket yok');
  await b.close();
}

console.log('--- H6. 360 px ---');
{
  const { b, p } = await ac({ deneme: VAR, en: 360 });
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 ? tamam : bozuk)(`yatay taşma yok (${t} px)`);
  await b.close();
}

for (const [rol, dugme, ekran, jeton] of [
  ['ogrenci', 'Öğrenci olarak gir', '/ogrenci', OGR_JETONU],
  ['veli', 'Veli olarak gir', '/veli', VELI_JETONU],
]) {
  console.log(`--- H7. Tek tıkla giriş: ${rol} ---`);
  const { b, p, cagrilar } = await ac({ deneme: VAR });
  await kart(p).getByRole('button', { name: dugme }).click();
  await p.waitForTimeout(800);
  const g = son(cagrilar, 'giris');
  const beklenenKod = rol === 'ogrenci' ? VAR.ogrenci_kodu : VAR.veli_kodu;
  (g?.govde?.p_kod === beklenenKod ? tamam : bozuk)(`giris ${rol} koduyla (${JSON.stringify(g?.govde ?? null)})`);
  const adres = p.url().split('#')[1];
  (adres === ekran ? tamam : bozuk)(`${ekran} açıldı (${adres})`);
  const ot = await p.evaluate(() => JSON.parse(localStorage.getItem('sekiz_oturum') ?? 'null'));
  (ot?.rol === rol && ot?.token === jeton && ot?.ogrenci?.id === 'd1' ? tamam : bozuk)(`oturum ${rol} jetonuyla`);
  const serit = p.getByRole('status').filter({ hasText: 'Deneme hesabındasınız' });
  ((await serit.count()) === 1 ? tamam : bozuk)('deneme şeridi var');
  ((await serit.getByRole('button', { name: /kapat|×/i }).count()) === 0 ? tamam : bozuk)('şerit kapatılamıyor');
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 ? tamam : bozuk)(`${rol} ekranında yatay taşma yok (${t} px)`);

  // Yenileme sonrası da şerit duruyor (oto-yenileme sayfayı yeniden yükler).
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ((await serit.count()) === 1 ? tamam : bozuk)('sayfa yenilenince şerit duruyor');

  const once = cagrilar.length;
  await serit.getByRole('button', { name: 'Öğretmen hesabına dön' }).click();
  await p.waitForTimeout(800);
  const c = cagrilar.slice(once).find((x) => x.uc === 'cikis');
  (c?.govde?.p_token === jeton ? tamam : bozuk)('deneme oturumu sunucuda kapatıldı (cikis, deneme jetonu)');
  const ot2 = await p.evaluate(() => JSON.parse(localStorage.getItem('sekiz_oturum') ?? 'null'));
  (ot2?.rol === 'ogretmen' && ot2?.token === SAHIP_JETONU ? tamam : bozuk)('sahibin oturumu geri geldi');
  (p.url().split('#')[1] === '/ogretmen/ogretmenler' ? tamam : bozuk)(`Öğretmenler sayfasına dönüldü (${p.url().split('#')[1]})`);
  const depo = await p.evaluate(() => [sessionStorage.getItem('sekiz.sahip_jetonu'), sessionStorage.getItem('sekiz.deneme_ogrenci')]);
  (depo[0] === null && depo[1] === null ? tamam : bozuk)('dönüş kayıtları silindi');
  ((await p.getByText('Deneme hesabındasınız').count()) === 0 ? tamam : bozuk)('öğretmen ekranında şerit yok');
  await b.close();
}

console.log('--- H8. Gerçek öğrencide şerit yok ---');
{
  const { b, p } = await ac({ yol: '/ogrenci', oturum: { rol: 'ogrenci', token: OGR_JETONU, ogrenci: { ...DENEME_OGR, id: 'gercek', ad: 'Elif Yıldırım' } } });
  await p.evaluate(() => { sessionStorage.setItem('sekiz.deneme_ogrenci', 'd1'); });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ((await p.getByText('Deneme hesabındasınız').count()) === 0 ? tamam : bozuk)('başka öğrencinin oturumunda şerit yok');
  await b.close();
}

console.log('--- H9. Ayarlar ---');
{
  const { b, p } = await ac({ yol: '/ogretmen/ayarlar', deneme: VAR });
  ((await p.getByRole('heading', { name: 'Deneme hesabı' }).count()) === 0 ? tamam : bozuk)('Ayarlar\'da kart yok (Öğretmenler sayfasına taşındı)');
  await b.close();
}

console.log('');
if (hata) {
  console.log(`DENEME HESABI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('DENEME HESABI DENETİMİ GEÇTİ');
