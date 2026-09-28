/**
 * ÖĞRENCİ ÇÖZÜMÜ OLARAK PDF (Chromium, taklit RPC, gerçek pdf.js çizimi)
 *
 * Öğretmenin isteği: "PDF de gönderebilsinler." PDF cihazda görsele
 * çevriliyor; depoya JPEG gidiyor, sunucu değişmiyor.
 *
 *  P1. Sayfa sınırı 1: 3 sayfalık PDF → TEK JPEG, 1400 px genişlik, boy üç
 *      sayfa kadar; ekranda "PDF'in 3 sayfası tek görsele birleştirildi".
 *      Görselde sayfaların İÇERİĞİ var (her sayfanın kendi bandında koyu
 *      piksel) — boş beyaz bir görsel yüklenmiyor.
 *  P2. Sınır 3: 4 sayfalık PDF → 3 ayrı JPEG sayfa, 4. için taşma uyarısı.
 *  P3. 9 sayfalık PDF (sınır 1) → açık hata, gönderim yok.
 *  P4. Bozuk "PDF" → "PDF okunamadı … fotoğraf olarak yüklemeyi dene".
 *  P5. Fotoğraf eskisi gibi.
 *  P6 (isteğe bağlı) GERÇEK PDF: `COZUM_PDF=…` verilirse tek görsele
 *      çevrilip 10 MB sınırının altında kaldığı ölçülüyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/pdf-cozum-denetimi.mjs
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

/** n sayfalı, her sayfasında kalın bir "SAYFA i" yazan geçerli PDF. */
function pdfUret(n) {
  const nesneler = [];
  const ekle = (govde) => { nesneler.push(govde); return nesneler.length; };
  const katalog = ekle(null);
  const sayfalarNo = ekle(null);
  const font = ekle('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const cocuklar = [];
  for (let i = 1; i <= n; i++) {
    // Sayfanın ortasına büyük yazı ve kalın bir dikdörtgen: çizim ölçülebilsin.
    const icerik = `BT /F1 48 Tf 150 500 Td (SAYFA ${i}) Tj ET 0 g 100 300 400 60 re f`;
    const akim = ekle(`<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`);
    cocuklar.push(ekle(`<< /Type /Page /Parent ${sayfalarNo} 0 R /MediaBox [0 0 595 842] ` +
      `/Contents ${akim} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  nesneler[katalog - 1] = `<< /Type /Catalog /Pages ${sayfalarNo} 0 R >>`;
  nesneler[sayfalarNo - 1] = `<< /Type /Pages /Kids [${cocuklar.map((c) => `${c} 0 R`).join(' ')}] /Count ${n} >>`;
  let g = '%PDF-1.4\n';
  const yer = [];
  nesneler.forEach((o, i) => { yer.push(g.length); g += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = g.length;
  g += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n` +
    yer.map((y) => `${String(y).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${nesneler.length + 1} /Root ${katalog} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(g, 'latin1');
}

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const ODEVLER = {
  ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', sinif: '9C', tur: 'okul' },
  odevler: [{
    id: 'a1', baslik: 'Açık uçlu ödev', aciklama: null, tur: 'acik', son_tarih: '2099-10-02',
    soru_sayisi: null, gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
    gonderim: null, konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
  }],
  dersler: [], okunmamis_mesaj: 0,
};

async function kur(sinir) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ ODEVLER, sinir }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogrenci', token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Duru Dilara Aygün', tur: 'okul', sinif: '9C' } }));
    window.__cagrilar = [];
    window.__yuklenen = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      if (url.startsWith('https://depo.sahte/')) {
        const govde = o?.body;
        const bm = await createImageBitmap(govde);
        // Her sayfa bandında koyu piksel var mı: 1400 genişlikte, A4 oranında bantlar.
        const c = new OffscreenCanvas(bm.width, bm.height);
        const x = c.getContext('2d');
        x.drawImage(bm, 0, 0);
        const bantBoy = Math.round(bm.width * (842 / 595));
        const bantlar = [];
        for (let y0 = 0; y0 + 10 < bm.height; y0 += bantBoy + 6) {
          const d = x.getImageData(0, y0, bm.width, Math.min(bantBoy, bm.height - y0)).data;
          let koyu = 0;
          for (let i = 0; i < d.length; i += 16) if (d[i] < 80) koyu++;
          bantlar.push(koyu);
        }
        window.__yuklenen.push({ url, tur: govde.type, boyut: govde.size, en: bm.width, boy: bm.height, bantlar });
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
        case 'odev_gonder': return json({ id: 'g1', durum: 'incelemede' });
        default: return json({});
      }
    };
  }, { ODEVLER, sinir });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/ogrenci/odev/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
async function sec(p, ad, veri, tur = 'application/pdf') {
  await p.locator('input[type=file]').setInputFiles({ name: ad, mimeType: tur, buffer: veri });
  await p.waitForFunction(() => !/PDF hazırlanıyor|Görseller hazırlanıyor/.test(document.body.innerText), null, { timeout: 60000 });
  await p.waitForTimeout(300);
}
async function gonder(p) {
  const d = p.getByRole('button', { name: 'Ödevi gönder' });
  await d.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await d.click();
  await p.waitForTimeout(1200);
  return {
    yuklenen: await p.evaluate(() => window.__yuklenen),
    gonder: (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'odev_gonder'),
  };
}

console.log('--- P1. Sınır 1: 3 sayfalık PDF → tek görsel ---');
{
  const { b, p } = await kur(1);
  await sec(p, 'cozum.pdf', pdfUret(3));
  const m = await metin(p);
  if (!m.includes("PDF'in 3 sayfası tek görsele birleştirildi")) bozuk(`not yok: ${m.slice(-300)}`);
  else tamam('"PDF\'in 3 sayfası tek görsele birleştirildi"');
  const r = await gonder(p);
  const y = r.yuklenen[0];
  if (r.yuklenen.length !== 1 || y.tur !== 'image/jpeg' || !/\.jpg$/.test(y.url)) bozuk(`yükleme: ${JSON.stringify(r.yuklenen)}`);
  else tamam(`tek JPEG yüklendi (${Math.round(y.boyut / 1024)} KB, ${y.en}×${y.boy})`);
  const bek = 3 * Math.round(1400 * 842 / 595) + 2 * 6;
  if (y.en !== 1400 || Math.abs(y.boy - bek) > 2) bozuk(`boyut ${y.en}×${y.boy}, beklenen 1400×${bek}`);
  else tamam('1400 px genişlik, üç sayfa boyu');
  if (y.bantlar.length !== 3 || y.bantlar.some((k) => k < 200)) bozuk(`sayfa içerikleri çizilmemiş: ${y.bantlar}`);
  else tamam(`her sayfanın içeriği görselde (koyu piksel: ${y.bantlar.join(', ')})`);
  if (r.gonder.length !== 1 || !/\.jpg$/.test(r.gonder[0].govde.p_foto_yolu)) bozuk('odev_gonder yanlış');
  else tamam('odev_gonder: .jpg yolu');
  await b.close();
}

console.log('--- P2. Sınır 3: 4 sayfalık PDF → 3 sayfa + taşma uyarısı ---');
{
  const { b, p } = await kur(3);
  await sec(p, 'cozum.pdf', pdfUret(4));
  const m = await metin(p);
  if (!m.includes('3/3')) bozuk(`3 sayfa eklenmedi: ${m.slice(-400)}`);
  else tamam('3 sayfa eklendi (3/3)');
  if (!/1 (görsel|sayfa)/.test(m) || !/sınır|fazla|eklenmedi|sığmadı/i.test(m)) bozuk('taşma uyarısı yok');
  else tamam('4. sayfa için taşma uyarısı');
  const r = await gonder(p);
  if (r.yuklenen.length !== 3 || r.yuklenen.some((x) => x.en !== 1400 || x.tur !== 'image/jpeg' || x.bantlar[0] < 200)) {
    bozuk(`yüklemeler: ${JSON.stringify(r.yuklenen.map((x) => [x.en, x.boy, x.bantlar]))}`);
  } else tamam('3 ayrı JPEG sayfa, içerikleri dolu');
  if (r.gonder[0]?.govde.p_ek_sayfa_yollari?.length !== 2) bozuk('ek sayfa yolları gitmedi');
  else tamam('odev_gonder: 1 + 2 ek sayfa');
  await b.close();
}

console.log('--- P3. 9 sayfa (sınır 1): açık hata ---');
{
  const { b, p } = await kur(1);
  await sec(p, 'kitap.pdf', pdfUret(9));
  const m = await metin(p);
  if (!/Bu PDF 9 sayfa; tek görsele en fazla 8 sayfa/.test(m)) bozuk(`hata yok: ${m.slice(-300)}`);
  else tamam('"Bu PDF 9 sayfa; tek görsele en fazla 8 sayfa…"');
  await b.close();
}

console.log('--- P4. Bozuk PDF ---');
{
  const { b, p } = await kur(1);
  await sec(p, 'bozuk.pdf', Buffer.from('bu bir pdf değil'));
  const m = await metin(p);
  if (!/PDF (okunamadı|açılamadı).*fotoğraf olarak yüklemeyi dene/.test(m)) bozuk(`hata yok: ${m.slice(-300)}`);
  else tamam('"PDF okunamadı … fotoğraf olarak yüklemeyi dene"');
  await b.close();
}

console.log('--- P5. Fotoğraf eskisi gibi ---');
{
  const { b, p } = await kur(1);
  const foto = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  await sec(p, 'foto.jpg', foto, 'image/jpeg');
  const m = await metin(p);
  if (!m.includes('Fotoğraf hazır') || m.includes('birleştirildi')) bozuk('fotoğraf yolu bozuldu');
  const r = await gonder(p);
  if (r.yuklenen.length !== 1 || r.yuklenen[0].en !== 1400) bozuk(`fotoğraf: ${JSON.stringify(r.yuklenen)}`);
  else tamam('fotoğraf 1400 px JPEG olarak yüklendi');
  await b.close();
}

console.log('--- P6. Gerçek PDF (isteğe bağlı) ---');
if (!process.env.COZUM_PDF) console.log('  (atlandı — COZUM_PDF verilmedi)');
else {
  const { b, p } = await kur(1);
  const t0 = Date.now();
  await sec(p, 'gercek.pdf', readFileSync(process.env.COZUM_PDF));
  const sure = Date.now() - t0;
  const r = await gonder(p);
  const y = r.yuklenen[0];
  if (!y || y.boyut > 10 * 1024 * 1024) bozuk(`gerçek PDF: ${JSON.stringify(y)}`);
  else tamam(`gerçek PDF: ${y.en}×${y.boy}, ${Math.round(y.boyut / 1024)} KB, ${(sure / 1000).toFixed(1)} sn`);
  await b.close();
}

console.log('');
if (hata) { console.log(`PDF ÇÖZÜM DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('PDF ÇÖZÜM DENETİMİ GEÇTİ');
