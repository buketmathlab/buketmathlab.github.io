/**
 * DENEME HESAPLARI (Chromium, taklit RPC) — 0073, 0074
 *
 * Öğretmenin isteği: gerçek olmayan bir öğrenci ve velisiyle sistemi
 * birebir denemek; 0074'ten beri HER DÜZEYE AYRI hesap ve şubeye en
 * baştan beri verilen bütün ödevler açık. Kart Öğretmenler sayfasında,
 * öğretmen ve müdür hesaplarının yanında; yalnız platform sahibinde.
 * Oradan tek tıkla deneme öğrencinin ya da velinin hesabına geçiliyor.
 *
 *  H1. Hesap yok: "Her düzeye oluştur (9, 10, 11, 12)" her düzeyin İLK
 *      şubesiyle `deneme_hesabi_olustur`u çağırıyor; tek şube seçimi
 *      yalnız okul sınıfları (özel ders ve arşiv yok).
 *  H2. İki hesap (9A, 10B): iki satır, kendi kodları; "Kalan düzeylere
 *      oluştur" yalnız 11 ve 12; tek şube seçiminde hesabı olan düzey yok;
 *      sınıf değiştirme seçiminde başka hesabın düzeyi yok; "Sınıfı
 *      kaydet", "Denemeyi sıfırla" ve "Sil" DOĞRU `p_id` ile ve ONAYDAN
 *      SONRA çağrılıyor.
 *  H3. Sahip olmayan öğretmen: kart YOK.
 *  H4. 0074 çalışmamışsa (uç yok): kart bozulmuyor, ne yapılacağını söylüyor.
 *  H5. Öğrenciler listesinde deneme satırında "Deneme" etiketi.
 *  H6. 360 px'de yatay taşma yok.
 *  H7. Tek tıkla giriş: 10B satırındaki "Öğrenci olarak gir" `giris`i
 *      O satırın koduyla çağırıyor, öğrenci ekranı açılıyor ve kapatılamayan
 *      deneme şeridi sınıfıyla var; "Öğretmen hesabına dön" deneme
 *      oturumunu sunucuda kapatıp (`cikis`, deneme jetonuyla) sahibin
 *      jetonuna ve Öğretmenler sayfasına dönüyor. Aynısı veli için.
 *  H8. Şerit yalnız deneme oturumunda: aynı sekmede gerçek bir öğrenci
 *      oturumunda (başka öğrenci kimliği) şerit YOK.
 *  H9. Ayarlar'da kart yok (tek yerde).
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
  { id: 's9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 29 },
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 30 },
  { id: 's10b', ad: '10B', seviye: 10, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 28 },
  { id: 's10c', ad: '10C', seviye: 10, sube: 'C', ozel: false, arsiv: false, ogrenci_sayisi: 27 },
  { id: 's11a', ad: '11A', seviye: 11, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 26 },
  { id: 's12c', ad: '12C', seviye: 12, sube: 'C', ozel: false, arsiv: false, ogrenci_sayisi: 25 },
  { id: 'soz', ad: 'Özel ders', seviye: 12, sube: 'Ö', ozel: true, arsiv: false, ogrenci_sayisi: 3 },
  { id: 's12x', ad: '12X', seviye: 12, sube: 'X', ozel: false, arsiv: true, ogrenci_sayisi: 0 },
];
const H9 = { id: 'd9', sinif_id: 's9a', sinif: '9A', seviye: 9, ogrenci_kodu: 'DNMOGR42', veli_kodu: 'DNMVEL77' };
const H10 = { id: 'd10', sinif_id: 's10b', sinif: '10B', seviye: 10, ogrenci_kodu: 'DNMOGR10', veli_kodu: 'DNMVEL10' };
const IKI = [H9, H10];
// Eski adlar: H7–H9 bunlarla yazıldı. VAR = girişi denenen satır (10B).
const VAR = H10;

const SAHIP_JETONU = 't'.repeat(64);
const OGR_JETONU = 'o'.repeat(64);
const VELI_JETONU = 'v'.repeat(64);
const DENEME_OGR = { id: 'd10', ad: 'Deneme Öğrenci', tur: 'okul', sinif: '10B' };

async function ac({ yol = '/ogretmen/ogretmenler', sahip = true, deneme = [], ucYok = false, en = 390, oturum = null } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 1000 } });
  const cagrilar = [];
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    let govde = null;
    try { govde = JSON.parse(r.request().postData() ?? 'null'); } catch { /* yok */ }
    cagrilar.push({ uc, govde });
    if (ucYok && uc === 'deneme_hesaplari') {
      return r.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.deneme_hesaplari(p_token) in the schema cache' }) });
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
      deneme_hesaplari: deneme,
      deneme_hesabi_olustur: deneme, deneme_sinifi_degistir: deneme,
      deneme_sifirla: deneme, deneme_hesabi_sil: deneme,
      ogrenciler_listesi: { toplam: 2, sayfa: 1, toplam_sayfa: 1, kayitlar: [
        { id: 'a', ad: 'Elif Yıldırım', ogrenci_no: '12', tur: 'okul', sinif: '9A', deneme: false },
        { id: 'd9', ad: 'Deneme Öğrenci', ogrenci_no: null, tur: 'okul', sinif: '9A', deneme: true }] },
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
const kart = (p) => p.locator('div').filter({ has: p.getByRole('heading', { name: 'Deneme hesapları' }) }).last();
// H7: girişi denenen satır (10B). Düğmeler satırın İÇİNDE aranıyor.
const satir = (p, seviye = VAR.seviye) => p.getByRole('region', { name: `${seviye}. sınıf deneme hesabı` });
const son = (c, uc) => c.filter((x) => x.uc === uc).at(-1);
const hepsi = (c, uc) => c.filter((x) => x.uc === uc);

console.log('--- H1. Hesap yok: her düzeye oluştur ---');
{
  const { b, p, cagrilar } = await ac();
  const k = kart(p);
  ((await k.count()) > 0 ? tamam : bozuk)('kart var');
  const secenekler = await k.getByLabel('Ya da tek bir şubede oluşturun').locator('option').allInnerTexts();
  (secenekler.join(',') === '9A,9B,10B,10C,11A,12C' ? tamam : bozuk)(`tek şube seçimi yalnız okul sınıfları, sıralı (${secenekler.join(', ')})`);
  const dugme = k.getByRole('button', { name: /Her düzeye oluştur/ });
  (/\(9, 10, 11, 12\)/.test(await dugme.innerText()) ? tamam : bozuk)(`düğme düzeyleri söylüyor (${(await dugme.innerText()).replace(/\s+/g, ' ')})`);
  await dugme.click();
  await p.waitForTimeout(600);
  const c = hepsi(cagrilar, 'deneme_hesabi_olustur').map((x) => x.govde?.p_sinif).join(',');
  (c === 's9a,s10b,s11a,s12c' ? tamam : bozuk)(`her düzeyin ilk şubesi oluşturuldu (${c})`);
  await b.close();
}

console.log('--- H2. İki hesap: satırlar, kalan düzeyler, sınıf, sıfırla, sil ---');
{
  const { b, p, cagrilar } = await ac({ deneme: IKI });
  const k = kart(p);
  const s9 = satir(p, 9); const s10 = satir(p, 10);
  ((await s9.count()) === 1 && (await s10.count()) === 1 ? tamam : bozuk)('iki satır: 9. ve 10. sınıf');
  const m9 = await s9.innerText(); const m10 = await s10.innerText();
  (/9\. sınıf · 9A/.test(m9) && m9.includes('DNMOGR42') && m9.includes('DNMVEL77') && !m9.includes('DNMOGR10') ? tamam : bozuk)('9A satırı kendi kodlarıyla');
  (/10\. sınıf · 10B/.test(m10) && m10.includes('DNMOGR10') && m10.includes('DNMVEL10') ? tamam : bozuk)('10B satırı kendi kodlarıyla');
  ((await s10.getByRole('button', { name: 'Öğrenci olarak gir' }).count()) === 1
    && (await s10.getByRole('button', { name: 'Veli olarak gir' }).count()) === 1 ? tamam : bozuk)('her satırda kendi giriş düğmeleri');
  const kalan = k.getByRole('button', { name: /Kalan düzeylere oluştur/ });
  (/\(11, 12\)/.test(await kalan.innerText()) ? tamam : bozuk)(`kalan düzeyler yalnız 11 ve 12 (${(await kalan.innerText()).replace(/\s+/g, ' ')})`);
  const tek = await k.getByLabel('Ya da tek bir şubede oluşturun').locator('option').allInnerTexts();
  (tek.join(',') === '11A,12C' ? tamam : bozuk)(`tek şube seçiminde hesabı olan düzey yok (${tek.join(', ')})`);
  const tasi = await s9.getByLabel('9A deneme hesabının sınıfını değiştir').locator('option').allInnerTexts();
  (tasi.join(',') === '9A,9B,11A,12C' ? tamam : bozuk)(`9A taşıma seçiminde 10. sınıf yok (${tasi.join(', ')})`);

  await s9.getByLabel('9A deneme hesabının sınıfını değiştir').selectOption('s9b');
  await s9.getByRole('button', { name: 'Sınıfı kaydet' }).click();
  await p.waitForTimeout(300);
  const d = son(cagrilar, 'deneme_sinifi_degistir')?.govde;
  (d?.p_id === 'd9' && d?.p_sinif === 's9b' ? tamam : bozuk)(`sınıf değiştirme 9A hesabıyla, 9B'ye (${JSON.stringify(d)})`);

  await s10.getByRole('button', { name: 'Denemeyi sıfırla' }).click();
  await p.waitForTimeout(200);
  (!son(cagrilar, 'deneme_sifirla') ? tamam : bozuk)('sıfırla onaysız çağrılmadı');
  const dlg = p.locator('dialog[open]');
  const dm = await dlg.innerText();
  (/10B/.test(dm) && /Gerçek öğrencilere dokunulmaz/.test(dm) && /Öbür deneme hesapları durur/.test(dm) ? tamam : bozuk)('onay penceresi hangi hesap olduğunu ve öbürlerine dokunulmayacağını söylüyor');
  await dlg.getByRole('button', { name: 'Sıfırla' }).click();
  await p.waitForTimeout(300);
  (son(cagrilar, 'deneme_sifirla')?.govde?.p_id === 'd10' ? tamam : bozuk)('onaydan sonra deneme_sifirla, 10B hesabıyla');

  await s9.getByRole('button', { name: 'Sil' }).click();
  await p.waitForTimeout(200);
  (!son(cagrilar, 'deneme_hesabi_sil') ? tamam : bozuk)('sil onaysız çağrılmadı');
  await p.locator('dialog[open]').getByRole('button', { name: 'Sil' }).click();
  await p.waitForTimeout(300);
  (son(cagrilar, 'deneme_hesabi_sil')?.govde?.p_id === 'd9' ? tamam : bozuk)('onaydan sonra deneme_hesabi_sil, 9A hesabıyla');
  await b.close();
}

console.log('--- H3. Sahip olmayan öğretmen ---');
{
  const { b, p } = await ac({ sahip: false });
  ((await p.getByRole('heading', { name: 'Deneme hesapları' }).count()) === 0 ? tamam : bozuk)('kart yok');
  await b.close();
}

console.log('--- H4. 0074 öncesi (uç yok) ---');
{
  const { b, p } = await ac({ ucYok: true });
  (/SQL 0074/.test(await kart(p).innerText()) ? tamam : bozuk)('"SQL 0074 … sonra kullanılabilir" yazıyor');
  await b.close();
}

console.log('--- H5. Öğrenciler listesinde etiket ---');
{
  const { b, p } = await ac({ yol: '/ogretmen/ogrenciler' });
  // Genel liste aramayla açılıyor (sınıf kutusu varsayılan görünüm).
  await p.getByRole('searchbox').or(p.getByPlaceholder(/ara/i)).first().fill('e');
  await p.waitForTimeout(700);
  const sat = p.locator('div').filter({ has: p.getByRole('link', { name: 'Deneme Öğrenci' }) }).last();
  ((await sat.getByText('Deneme', { exact: true }).count()) === 1 ? tamam : bozuk)('deneme satırında "Deneme" etiketi');
  const gercek = p.locator('div').filter({ has: p.getByRole('link', { name: 'Elif Yıldırım' }) }).last();
  ((await gercek.getByText('Deneme', { exact: true }).count()) === 0 ? tamam : bozuk)('gerçek öğrencide etiket yok');
  await b.close();
}

console.log('--- H6. 360 px ---');
{
  for (const deneme of [[], IKI]) {
    const { b, p } = await ac({ deneme, en: 360 });
    const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    (t <= 0 ? tamam : bozuk)(`${deneme.length} hesapla yatay taşma yok (${t} px)`);
    await b.close();
  }
}

for (const [rol, dugme, ekran, jeton] of [
  ['ogrenci', 'Öğrenci olarak gir', '/ogrenci', OGR_JETONU],
  ['veli', 'Veli olarak gir', '/veli', VELI_JETONU],
]) {
  console.log(`--- H7. Tek tıkla giriş: ${rol} ---`);
  const { b, p, cagrilar } = await ac({ deneme: IKI });
  await satir(p).getByRole('button', { name: dugme }).click();
  await p.waitForTimeout(800);
  const g = son(cagrilar, 'giris');
  const beklenenKod = rol === 'ogrenci' ? VAR.ogrenci_kodu : VAR.veli_kodu;
  (g?.govde?.p_kod === beklenenKod ? tamam : bozuk)(`giris ${rol} koduyla (${JSON.stringify(g?.govde ?? null)})`);
  const adres = p.url().split('#')[1];
  (adres === ekran ? tamam : bozuk)(`${ekran} açıldı (${adres})`);
  const ot = await p.evaluate(() => JSON.parse(localStorage.getItem('sekiz_oturum') ?? 'null'));
  (ot?.rol === rol && ot?.token === jeton && ot?.ogrenci?.id === 'd10' ? tamam : bozuk)(`oturum ${rol} jetonuyla`);
  const serit = p.getByRole('status').filter({ hasText: 'Deneme hesabındasınız' });
  ((await serit.count()) === 1 ? tamam : bozuk)('deneme şeridi var');
  (/· 10B/.test(await serit.innerText()) ? tamam : bozuk)('şeritte hangi sınıfın hesabı olduğu yazıyor');
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
  const { b, p } = await ac({ yol: '/ogretmen/ayarlar', deneme: IKI });
  ((await p.getByRole('heading', { name: /Deneme hesap/ }).count()) === 0 ? tamam : bozuk)('Ayarlar\'da kart yok (Öğretmenler sayfasına taşındı)');
  await b.close();
}

console.log('');
if (hata) {
  console.log(`DENEME HESABI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('DENEME HESABI DENETİMİ GEÇTİ');
