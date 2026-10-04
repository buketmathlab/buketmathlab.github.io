/**
 * EL YAZISI KURALI VE ONAYI (Chromium, taklit RPC)
 *
 * Öğretmen: "Öğrenciye kural ve onay olsun fakat iPad/tabletten açıp soru
 * dosyasının üzerinden de çözmüş olabilir. Bu da bir el yazısı."
 *
 *  E1. Gönderilmemiş ödevde kural kartı: başlık, neden, iki yol (Kâğıt üzerinde /
 *      iPad veya tablet üzerinde — "soruların üzerine kalemle"), kabul edilmeyenler.
 *  E2. Onaysız "Ödevi gönder" → `odev_gonder` ÇAĞRILMIYOR, yükleme yok,
 *      `role="alert"` uyarısı görünüyor; düğme kapalı değil.
 *  E3. Onay işaretlenince uyarı kalkıyor; gönderim gidiyor.
 *  E4. Çok sayfalı yolda (sınır 3) da kart ve onay var.
 *  E5. Gönderilmiş ödevde kart ve onay YOK.
 *  E6. 360 px'de yatay taşma yok.
 *  E7. Karanlık (siyah) fotoğraf: seçilince uyarı, gönderilmiyor; aydınlık
 *      fotoğraf sorunsuz (gerçek olay: 10C'den tamamen siyah bir çözüm).
 *  E8. Saydam zeminli, koyu mürekkepli PNG (tablet çıktısı) kabul ediliyor
 *      ve yüklenen JPEG BEYAZ zeminli — siyaha dönmüyor (gerçek olay:
 *      4 Ekim 20:15, 9. sınıftan tamamı 0 olan 1400×876 çözüm).
 *  E9. Simsiyah sayfalı PDF: uyarı görünüyor, gönderilmiyor.
 *  E10. Yeni sürüm yayındayken öğrencinin eski sekmesi KENDİNİ yeniliyor
 *      (bir kez, döngü yok); teslim ve mesaj ekranında yenilemiyor, şerit
 *      görünüyor; teslim ekranından çıkınca yeniliyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/el-yazisi-denetimi.mjs
 */
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const { default: sharp } = await import('sharp');

let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };
const KOK = 'http://127.0.0.1:8788/yeni/';

// Açık renkli kâğıt: E7'deki karanlık fotoğraf denetimine takılmasın.
const PNG = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#f2efe8' } }).png().toBuffer();
const odev = (id, gonderim) => ({
  id, baslik: 'Açık uçlu ödev', aciklama: null, tur: 'acik', son_tarih: '2099-10-02',
  soru_sayisi: null, gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: 'odev/x/sorular.pdf',
  gonderim, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
});
const ODEVLER = {
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' },
  odevler: [
    odev('a1', null),
    odev('a2', { id: 'g1', zaman: '2026-09-30T10:00:00Z', durum: 'incelemede', dogru: null, yanlis: null,
      bos: null, puan: null, ogretmen_puan: null, ogretmen_yorum: null, cevaplar: null, gecikmeli: false }),
  ],
  dersler: [], okunmamis_mesaj: 0,
};

async function kur(yol, { sinir = 1, en = 390, surum = null } = {}) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  if (surum) {
    await s.route('**/surum.json', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ surum }) }));
  }
  await s.addInitScript(({ ODEVLER, sinir }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogrenci', token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', tur: 'okul', sinif: '9C' } }));
    window.__cagrilar = [];
    window.__yuklenen = 0;
    // Bu sekmede sayfa kaç kez yüklendi (E10: oto-yenileme döngüsü yok).
    sessionStorage.setItem('__yukleme', String(Number(sessionStorage.getItem('__yukleme') ?? 0) + 1));
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      if (url.startsWith('https://depo.sahte/')) {
        window.__yuklenen++;
        if (o?.body instanceof Blob) {
          window.__sonVeri = await new Promise((c) => {
            const f = new FileReader();
            f.onload = () => c(String(f.result).split(',')[1]);
            f.readAsDataURL(o.body);
          });
        }
        return new Response('{}', { status: 200 });
      }
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      if (/functions\/v1\/dosya-url/.test(url)) {
        return json({ imzaliUrl: 'https://depo.sahte/' + govde.yol, jeton: 'j', yol: govde.yol });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });
      switch (m[1]) {
        case 'ogrenci_odevleri': return json(ODEVLER);
        case 'odev_sayfa_siniri': return json(sinir);
        case 'ewalu_mesajlari': return json([]);
        case 'ogrenci_mesajlari': return json({ mesajlar: [], son_gorulme: null, ogretmenler: [] });
        case 'odev_gonder': return json({ id: 'g1', durum: 'incelemede' });
        default: return json({});
      }
    };
  }, { ODEVLER, sinir });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const gonderimler = async (p) => (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'odev_gonder');
const kutu = (p) => p.getByRole('checkbox', { name: /Bu ödevi kendim çözdüm/ });
const kart = (p) => p.getByRole('region', { name: 'Çözümünü kendi el yazınla teslim et' });
async function bas(p) {
  const d = p.getByRole('button', { name: 'Ödevi gönder' });
  await d.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await d.click();
  await p.waitForTimeout(1000);
}

console.log('--- E1. Kural kartı: neden, iki yol, kabul edilmeyenler ---');
const { b, p } = await kur('/ogrenci/odev/a1');
{
  if ((await kart(p).count()) !== 1) bozuk('kural kartı yok');
  else {
    const k = await kart(p).innerText();
    const bek = [
      [/nasıl düşündüğünü/, 'neden'],
      [/Kâğıt üzerinde/, 'kâğıt yolu'],
      [/iPad veya tablet üzerinde/, 'iPad/tablet yolu'],
      [/soruların üzerine kalemle çöz/, 'soruların üzerine kalemle'],
      [/Bu da el yazısı sayılır/, 'iPad/tablet de el yazısı'],
      [/Klavyeyle yazılmış/, 'klavyeyle yazılmış kabul edilmez'],
      [/yapay zekâ/, 'yapay zekâ kabul edilmez'],
      [/ödevin kabul edilmez/, 'sonuç: "ödevin kabul edilmez"'],
    ];
    for (const [r, ad] of bek) (r.test(k) ? tamam : bozuk)(`kartta ${ad}`);
  }
  // Kart, yükleme alanından ÖNCE okunsun.
  const sira = await p.evaluate(() => {
    const k = document.getElementById('el-yazisi-baslik');
    const f = document.querySelector('input[type=file]');
    return !!k && !!f && !!(k.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  (sira ? tamam : bozuk)('kart yükleme alanının üstünde');
}

console.log('--- E2. Onaysız gönderme: sunucuya gitmez, uyarı çıkar ---');
{
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForTimeout(500);
  const etiket = await p.locator('label').filter({ has: kutu(p) }).innerText();
  (/Aksi durumda ödevimin kabul edilmeyeceğini biliyorum/.test(etiket) ? tamam : bozuk)('onay metni: "Aksi durumda ödevimin kabul edilmeyeceğini biliyorum."');
  if (await kutu(p).isChecked()) bozuk('onay kutusu baştan işaretli');
  else tamam('onay kutusu baştan boş');
  const dugme = p.getByRole('button', { name: 'Ödevi gönder' });
  (await dugme.isDisabled() ? bozuk : tamam)('düğme kapatılmamış (öğrenci eksiği görsün)');
  await bas(p);
  if ((await gonderimler(p)).length) bozuk('ONAYSIZ odev_gonder ÇAĞRILDI');
  else tamam('onaysız: odev_gonder çağrılmadı');
  if (await p.evaluate(() => window.__yuklenen)) bozuk('onaysız dosya yüklendi');
  else tamam('onaysız: dosya da yüklenmedi');
  const uyari = p.getByRole('alert').filter({ hasText: 'onay kutusunu işaretle' });
  if ((await uyari.count()) !== 1) bozuk('uyarı görünmüyor');
  else tamam('"Ödevi göndermek için onay kutusunu işaretle." (role=alert)');
  const tanim = await kutu(p).getAttribute('aria-describedby');
  (tanim === 'el-yazisi-uyari' ? tamam : bozuk)('kutu uyarıya aria-describedby ile bağlı');
}

console.log('--- E3. Onaylı gönderme gider ---');
{
  await kutu(p).check();
  if (await p.getByRole('alert').filter({ hasText: 'onay kutusunu işaretle' }).count()) bozuk('işaretleyince uyarı kalkmadı');
  else tamam('işaretleyince uyarı kalktı');
  await bas(p);
  const g = await gonderimler(p);
  if (g.length !== 1) bozuk(`onaylı gönderim: ${g.length} çağrı`);
  else tamam('onaylı: odev_gonder bir kez çağrıldı');
  // Onay SAKLANMIYOR: gövdede yeni alan yok.
  const anahtarlar = Object.keys(g[0]?.govde ?? {}).filter((a) => /onay|el_yazi/i.test(a));
  (anahtarlar.length ? bozuk : tamam)(`odev_gonder gövdesinde onay alanı yok${anahtarlar.length ? `: ${anahtarlar}` : ''}`);
  await b.close();
}

console.log('--- E4. Çok sayfalı yol (sınır 3) ---');
{
  const { b, p } = await kur('/ogrenci/odev/a1', { sinir: 3 });
  const m = await metin(p);
  if (!m.includes('sayfa')) bozuk('çok sayfalı ekran çizilmedi');
  ((await kart(p).count()) === 1 ? tamam : bozuk)('kural kartı var');
  ((await kutu(p).count()) === 1 ? tamam : bozuk)('onay kutusu var');
  await b.close();
}

console.log('--- E5. Gönderilmiş ödevde kart ve onay yok ---');
{
  const { b, p } = await kur('/ogrenci/odev/a2');
  ((await kart(p).count()) === 0 ? tamam : bozuk)('kural kartı yok');
  ((await kutu(p).count()) === 0 ? tamam : bozuk)('onay kutusu yok');
  await b.close();
}

console.log('--- E6. 360 px ---');
{
  const { b, p } = await kur('/ogrenci/odev/a1', { en: 360 });
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (tasma <= 0 ? tamam : bozuk)(`yatay taşma yok (${tasma} px)`);
  await b.close();
}

console.log('--- E7. Karanlık fotoğraf ---');
{
  // Gerçek olaydaki gibi: 1400×1050, parlaklık 0–13 arası kamera gürültüsü.
  const en = 1400, boy = 1050, ham = Buffer.alloc(en * boy * 3);
  for (let i = 0; i < ham.length; i++) ham[i] = (i * 7919) % 14;
  const siyah = await sharp(ham, { raw: { width: en, height: boy, channels: 3 } }).jpeg().toBuffer();
  const kagit = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#e8e4dc' } }).jpeg().toBuffer();

  const { b, p } = await kur('/ogrenci/odev/a1');
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum.jpg', mimeType: 'image/jpeg', buffer: siyah });
  await p.waitForTimeout(800);
  const m = await metin(p);
  (/Fotoğraf çok karanlık; çözümün okunmuyor\. Aydınlık bir ortamda yeniden çekip yükle\./.test(m) ? tamam : bozuk)('siyah fotoğrafta uyarı görünüyor');
  await kutu(p).check();
  await bas(p);
  if ((await gonderimler(p)).length || (await p.evaluate(() => window.__yuklenen))) bozuk('SİYAH FOTOĞRAF GÖNDERİLDİ');
  else tamam('siyah fotoğraf gönderilmedi, yüklenmedi');
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum2.jpg', mimeType: 'image/jpeg', buffer: kagit });
  await p.waitForTimeout(800);
  if (/çok karanlık/.test(await metin(p))) bozuk('aydınlık fotoğrafta uyarı kalmış');
  await bas(p);
  ((await gonderimler(p)).length === 1 ? tamam : bozuk)('aydınlık fotoğraf gönderildi');
  await b.close();
}

console.log('--- E8. Saydam zeminli tablet çıktısı (koyu mürekkep) ---');
{
  const en = 1400, boy = 876;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${en}" height="${boy}">` +
    `<text x="100" y="300" font-size="120" font-family="sans-serif" fill="#1a1a1a">x² + 3x = 10</text>` +
    `<path d="M100 500 L1200 500" stroke="#1a1a1a" stroke-width="8"/></svg>`;
  const saydam = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(saydam).stats();
  if (meta.isOpaque) bozuk('test görseli saydam değil');
  const { b, p } = await kur('/ogrenci/odev/a1');
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum.png', mimeType: 'image/png', buffer: saydam });
  await p.waitForTimeout(800);
  if (/çok karanlık/.test(await metin(p))) bozuk('saydam zeminli çözüm KARANLIK sayıldı');
  else tamam('saydam zeminli çözüm kabul edildi');
  await kutu(p).check();
  await bas(p);
  ((await gonderimler(p)).length === 1 ? tamam : bozuk)('gönderildi');
  const veri = await p.evaluate(() => window.__sonVeri);
  if (!veri) bozuk('yüklenen veri yakalanamadı');
  else {
    const st = await sharp(Buffer.from(veri, 'base64')).stats();
    const ort = st.channels.slice(0, 3).reduce((t, c) => t + c.mean, 0) / 3;
    const enKoyu = Math.min(...st.channels.slice(0, 3).map((c) => c.min));
    (ort > 200 ? tamam : bozuk)(`yüklenen JPEG beyaz zeminli (ortalama parlaklık ${ort.toFixed(0)})`);
    (enKoyu < 80 ? tamam : bozuk)(`mürekkep görünüyor (en koyu ${enKoyu})`);
  }
  await b.close();
}

console.log('--- E9. Simsiyah sayfalı PDF ---');
{
  const icerik = '0 g 0 0 595 842 re f';
  const nesne = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>',
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
  ];
  let g = '%PDF-1.4\n';
  const yer = [];
  nesne.forEach((o, i) => { yer.push(g.length); g += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = g.length;
  g += `xref\n0 ${nesne.length + 1}\n0000000000 65535 f \n` +
    yer.map((y) => `${String(y).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${nesne.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  const pdf = Buffer.from(g, 'latin1');
  const { b, p } = await kur('/ogrenci/odev/a1');
  await p.locator('input[type=file]').setInputFiles({ name: 'cozum.pdf', mimeType: 'application/pdf', buffer: pdf });
  await p.waitForTimeout(2500);
  (/Fotoğraf çok karanlık; çözümün okunmuyor/.test(await metin(p)) ? tamam : bozuk)('siyah PDF sayfasında uyarı görünüyor');
  await kutu(p).check();
  await bas(p);
  if ((await gonderimler(p)).length || (await p.evaluate(() => window.__yuklenen))) bozuk('SİYAH PDF GÖNDERİLDİ');
  else tamam('siyah PDF gönderilmedi, yüklenmedi');
  await b.close();
}

console.log('--- E10. Eski sekme kendini yeniliyor (öğrenci) ---');
{
  const YENI = 'denetim-yeni-surum';
  const yukleme = (p) => p.evaluate(() => Number(sessionStorage.getItem('__yukleme')));
  {
    const { b, p } = await kur('/ogrenci', { surum: YENI });
    await p.waitForTimeout(2500);
    (p.url().includes(`s=${YENI}`) ? tamam : bozuk)(`Pano: kendiliğinden yenilendi (${p.url().split('/yeni/')[1]})`);
    const n = await yukleme(p);
    (n === 2 ? tamam : bozuk)(`yalnız bir kez yenilendi, döngü yok (${n} yükleme)`);
    ((await p.getByText('Yeni sürüm hazır.').count()) === 1 ? tamam : bozuk)('yenilemeden sonra hâlâ eskiyse şerit görünüyor');
    await b.close();
  }
  for (const yol of ['/ogrenci/odev/a1', '/ogrenci/mesajlar']) {
    const { b, p } = await kur(yol, { surum: YENI });
    await p.waitForTimeout(1500);
    const n = await yukleme(p);
    (n === 1 && !p.url().includes('s=') ? tamam : bozuk)(`${yol}: yenilemedi (${n} yükleme)`);
    ((await p.getByText('Yeni sürüm hazır.').count()) === 1 ? tamam : bozuk)(`${yol}: şerit görünüyor`);
    if (yol === '/ogrenci/odev/a1') {
      await p.evaluate(() => { location.hash = '#/ogrenci/odevler'; });
      await p.waitForTimeout(2000);
      (p.url().includes(`s=${YENI}`) ? tamam : bozuk)('teslim ekranından çıkınca yenilendi');
    }
    await b.close();
  }
}

console.log('');
if (hata) {
  console.log(`EL YAZISI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('EL YAZISI DENETİMİ GEÇTİ');
