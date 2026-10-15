/**
 * ÖĞRENCİ ÇÖZÜMÜ OLARAK PDF (Chromium, taklit RPC, gerçek pdf.js çizimi)
 *
 * Öğretmenin isteği: "PDF de gönderebilsinler." PDF cihazda görsele
 * çevriliyor; depoya JPEG gidiyor, sunucu değişmiyor.
 *
 * 0078: TEK GÖRSELE BİRLEŞTİRME KALKTI. PDF'in her sayfası ayrı bir çözüm
 * sayfası; yeni ödevde öğrenci TAM ödevin sayfa sayısı kadar sayfa gönderir.
 *
 *  P1. Her sayfası zorunlu 3 sayfalık ödev: 3 sayfalık PDF → 3 ayrı JPEG
 *      (1400 px, içerik dolu); sayaç "3 / 3 sayfa eklendi · tamam";
 *      ekranda "birleştir" / "tek görsel" yok; odev_gonder 1 + 2 ek sayfa.
 *  P2. Zorunlu 3: 4 sayfalık PDF → 3 sayfa + "fazladan seçtiğin 1 görsel".
 *  P3. Zorunlu 4: 2 sayfa → "2 sayfa eksik" sayacı; gönder → eksik uyarısı,
 *      HİÇBİR yükleme ve odev_gonder YOK.
 *  P4. Bozuk "PDF" → "PDF okunamadı … fotoğraf olarak yüklemeyi dene".
 *  P5. Eski 1 sayfalık ödev: fotoğraf 1400 px JPEG olarak gidiyor.
 *  P6. Eski 1 sayfalık ödev + 3 sayfalık PDF → birleştirme YOK, yalnız
 *      1. sayfa; 2 görsel için taşma uyarısı.
 *  P7. "Değiştir": zorunlu 3 sayfada 2. sayfa yerinde yenileniyor, sıra
 *      ve sayı bozulmuyor.
 *  P8 (isteğe bağlı) GERÇEK PDF: `COZUM_PDF=…` verilirse her sayfa 10 MB
 *      sınırının altında.
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

async function kur(kural) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ ODEVLER, kural }) => {
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
        case 'odev_sayfa_kurali': return json(kural);
        case 'odev_sayfa_siniri': return json(kural.sayfa);
        case 'ewalu_mesajlari': return json([]);
        case 'odev_gonder': return json({ id: 'g1', durum: 'incelemede' });
        default: return json({});
      }
    };
  }, { ODEVLER, kural });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/ogrenci/odev/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
async function sec(p, ad, veri, tur = 'application/pdf') {
  // "Sayfa ekle" alanı (sr-only "Değiştir" girişleri ayrı, aria-label'lı).
  await p.locator('input[type=file]:not([aria-label])').setInputFiles({ name: ad, mimeType: tur, buffer: veri });
  await p.waitForFunction(() => !/PDF hazırlanıyor|Görseller hazırlanıyor/.test(document.body.innerText), null, { timeout: 60000 });
  await p.waitForTimeout(300);
}
const onayla = async (p) => { const k = p.getByRole('checkbox', { name: /Bu ödevi kendim çözdüm/ }); await k.evaluate((e) => e.scrollIntoView({ block: 'center' })); await k.check(); };
async function gonder(p) {
  await onayla(p);
  const d = p.getByRole('button', { name: 'Ödevi gönder' });
  await d.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await d.click();
  await p.waitForTimeout(1200);
  return {
    yuklenen: await p.evaluate(() => window.__yuklenen),
    gonder: (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'odev_gonder'),
  };
}

const Z3 = { sayfa: 3, tum_sayfalar: true };
const ESKI1 = { sayfa: 1, tum_sayfalar: false };
const birlesimYok = (m, n) => {
  if (/birleştir|tek görsel|tek PDF/i.test(m)) bozuk(`${n}: ekranda birleştirme sözü var`);
  else tamam(`${n}: ekranda "birleştir/tek görsel" yok`);
};

console.log('--- P1. Zorunlu 3: 3 sayfalık PDF → 3 ayrı JPEG ---');
{
  const { b, p } = await kur(Z3);
  birlesimYok(await metin(p), 'boş ekran');
  await sec(p, 'cozum.pdf', pdfUret(3));
  const m = await metin(p);
  if (!m.includes('3 / 3 sayfa eklendi · tamam')) bozuk(`sayaç yok: ${m.slice(-400)}`);
  else tamam('"3 / 3 sayfa eklendi · tamam"');
  birlesimYok(m, 'seçimden sonra');
  const r = await gonder(p);
  if (r.yuklenen.length !== 3 || r.yuklenen.some((x) => x.en !== 1400 || x.tur !== 'image/jpeg' || x.bantlar[0] < 200)) {
    bozuk(`yüklemeler: ${JSON.stringify(r.yuklenen.map((x) => [x.en, x.boy, x.bantlar]))}`);
  } else tamam('3 ayrı JPEG sayfa, 1400 px, içerikleri dolu');
  if (r.gonder.length !== 1 || r.gonder[0].govde.p_ek_sayfa_yollari?.length !== 2 || !/\.jpg$/.test(r.gonder[0].govde.p_foto_yolu)) {
    bozuk('odev_gonder yanlış');
  } else tamam('odev_gonder: 1 + 2 ek sayfa');
  await b.close();
}

console.log('--- P2. Zorunlu 3: 4 sayfalık PDF → 3 sayfa + taşma ---');
{
  const { b, p } = await kur(Z3);
  await sec(p, 'cozum.pdf', pdfUret(4));
  const m = await metin(p);
  if (!m.includes('3 / 3 sayfa eklendi')) bozuk(`3 sayfa eklenmedi: ${m.slice(-400)}`);
  else tamam('3 sayfa eklendi');
  if (!m.includes('Bu ödev 3 sayfa; fazladan seçtiğin 1 görsel eklenmedi.')) bozuk('taşma uyarısı yok');
  else tamam('"fazladan seçtiğin 1 görsel eklenmedi"');
  await b.close();
}

console.log('--- P3. Zorunlu 4: 2 sayfa → eksik, gönderilmiyor ---');
{
  const { b, p } = await kur({ sayfa: 4, tum_sayfalar: true });
  await sec(p, 'cozum.pdf', pdfUret(2));
  let m = await metin(p);
  if (!m.includes('2 / 4 sayfa eklendi · 2 sayfa eksik')) bozuk(`eksik sayacı yok: ${m.slice(-400)}`);
  else tamam('"2 / 4 sayfa eklendi · 2 sayfa eksik"');
  const r = await gonder(p);
  m = await metin(p);
  if (!m.includes('2 sayfa eksik. Ödevi gönderebilmek için her sayfanın çözümünü eklemelisin.')) bozuk('eksik uyarısı yok');
  else tamam('eksik uyarısı gösterildi');
  if (r.yuklenen.length !== 0 || r.gonder.length !== 0) bozuk(`eksikken yükleme/gönderim oldu: ${r.yuklenen.length}/${r.gonder.length}`);
  else tamam('eksikken yükleme ve odev_gonder YOK');
  await b.close();
}

console.log('--- P4. Bozuk PDF ---');
{
  const { b, p } = await kur(Z3);
  await sec(p, 'bozuk.pdf', Buffer.from('bu bir pdf değil'));
  const m = await metin(p);
  if (!/Okunamayan görsel|PDF (okunamadı|açılamadı)/.test(m)) bozuk(`hata yok: ${m.slice(-300)}`);
  else tamam('bozuk PDF için açık hata');
  await b.close();
}

console.log('--- P5. Eski 1 sayfalık ödev: fotoğraf ---');
{
  const { b, p } = await kur(ESKI1);
  const foto = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  await sec(p, 'foto.jpg', foto, 'image/jpeg');
  const m = await metin(p);
  if (!m.includes('1 / 1 sayfa seçildi')) bozuk(`sayaç yok: ${m.slice(-300)}`);
  const r = await gonder(p);
  if (r.yuklenen.length !== 1 || r.yuklenen[0].en !== 1400) bozuk(`fotoğraf: ${JSON.stringify(r.yuklenen)}`);
  else tamam('fotoğraf 1400 px JPEG olarak yüklendi');
  if (r.gonder[0]?.govde.p_ek_sayfa_yollari !== undefined) bozuk('tek sayfada ek sayfa parametresi gitti');
  else tamam('tek sayfada çağrı 0054 öncesiyle aynı');
  await b.close();
}

console.log('--- P6. Eski 1 sayfalık ödev + 3 sayfalık PDF: birleştirme yok ---');
{
  const { b, p } = await kur(ESKI1);
  await sec(p, 'cozum.pdf', pdfUret(3));
  const m = await metin(p);
  if (!m.includes('1 / 1 sayfa seçildi') || !m.includes('2 görsel eklenmedi')) bozuk(`beklenmeyen: ${m.slice(-400)}`);
  else tamam('yalnız 1. sayfa alındı, 2 görsel için uyarı');
  birlesimYok(m, 'eski ödev');
  const r = await gonder(p);
  if (r.yuklenen.length !== 1 || Math.abs(r.yuklenen[0].boy - Math.round(1400 * 842 / 595)) > 2) {
    bozuk(`tek sayfa boyu değil: ${JSON.stringify(r.yuklenen.map((x) => [x.en, x.boy]))}`);
  } else tamam('yüklenen görsel tek sayfa boyunda (birleşik değil)');
  await b.close();
}

console.log('--- P7. "Değiştir": sayfa yerinde yenileniyor ---');
{
  const { b, p } = await kur(Z3);
  await sec(p, 'cozum.pdf', pdfUret(3));
  const yeni = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#000' } })
    .composite([{ input: Buffer.from('<svg width="1400" height="1000"><rect x="0" y="0" width="1400" height="1000" fill="white"/><rect x="100" y="100" width="300" height="300" fill="black"/></svg>') }])
    .jpeg().toBuffer();
  await p.locator('input[aria-label="2. sayfayı değiştir"]').setInputFiles({ name: 'yeni.jpg', mimeType: 'image/jpeg', buffer: yeni });
  await p.waitForTimeout(800);
  const m = await metin(p);
  if (!m.includes('3 / 3 sayfa eklendi · tamam')) bozuk(`değiştirince sayı bozuldu: ${m.slice(-300)}`);
  else tamam('değiştirince sayı 3 / 3 kaldı');
  const r = await gonder(p);
  const boylar = r.yuklenen.map((x) => x.boy);
  if (r.yuklenen.length !== 3 || boylar[1] !== 1000 || boylar[0] === 1000 || boylar[2] === 1000) {
    bozuk(`sıra bozuldu: ${JSON.stringify(boylar)}`);
  } else tamam('yeni görsel 2. sırada, 1. ve 3. sayfa yerinde');
  await b.close();
}

console.log('--- P8. Gerçek PDF (isteğe bağlı) ---');
if (!process.env.COZUM_PDF) console.log('  (atlandı — COZUM_PDF verilmedi)');
else {
  const { b, p } = await kur({ sayfa: 40, tum_sayfalar: false });
  const t0 = Date.now();
  await sec(p, 'gercek.pdf', readFileSync(process.env.COZUM_PDF));
  const sure = Date.now() - t0;
  const r = await gonder(p);
  if (!r.yuklenen.length || r.yuklenen.some((y) => y.boyut > 10 * 1024 * 1024)) bozuk(`gerçek PDF: ${r.yuklenen.length}`);
  else tamam(`gerçek PDF: ${r.yuklenen.length} sayfa, en büyük ${Math.round(Math.max(...r.yuklenen.map((y) => y.boyut)) / 1024)} KB, ${(sure / 1000).toFixed(1)} sn`);
  await b.close();
}

console.log('');
if (hata) { console.log(`PDF ÇÖZÜM DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('PDF ÇÖZÜM DENETİMİ GEÇTİ');
