/**
 * DÜZENLEMEDE YALNIZ DEĞİŞEN + İŞARETLİ ŞIKTAN CEVAP ANAHTARI
 *
 * Öğretmenin isteği: "Neyi düzenlemek istiyorsam yalnız onu
 * değiştirebilmeliyim" ve "işaretli şıklı cevap anahtarını sistem okusun".
 *
 * A. DÜZENLEME EKRANI (Chromium, taklit RPC, yayındaki derleme `yeni/`)
 *    A1. Yüklü dosyalar GÖRÜNÜR (belge kartı: "Kayıtlı", Görüntüle, Yenisiyle
 *        değiştir, ayrıntı); boş dosya alanı yok. "Görüntüle" imzalı adresi
 *        açıyor.
 *    A2. Yalnız son tarih değişince kayıt yükünde her şey aynen: 51 cevap,
 *        konular, iki dosya yolu, geç teslim.
 *    A3. CEVAP İÇERMEYEN bir anahtar PDF'i kayıtlı 51 cevabı SİLMİYOR
 *        (önceki kusur: `setAnahtar(sonuc.anahtar)` hepsini siliyordu).
 *    A4. Yeni PDF yalnız bulduğu soruları değiştiriyor, değişen ekranda
 *        listeleniyor; "Vazgeç" eski cevapları geri getiriyor.
 *
 * B. GERÇEK PDF'LER (isteğe bağlı — öğretmenin dosyaları depoda DEĞİL:
 *    el yazısı çözümler, kitap soruları). Yol verilirse:
 *      ANAHTAR_PDF_ISARETLI=…/Üslü ve Köklü Çözüm.pdf  (51 soru, pembe kutu)
 *      ANAHTAR_PDF_METIN=…/Çözüm.pdf                    (9 soru, metin)
 *    Ekrandan yüklenip okunuyor: 51'de en az 49 doğru ve HİÇ YANLIŞ YOK;
 *    9'da 9/9.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/anahtar-okuma-denetimi.mjs
 */
import { readFileSync } from 'node:fs';

let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

/** Metin katmanlı en küçük geçerli PDF: her satır Helvetica ile alt alta. */
function kucukPdf(satirlar) {
  const icerik = 'BT /F1 14 Tf 60 780 Td ' +
    satirlar.map((s, i) => `${i ? '0 -24 Td ' : ''}(${s.replace(/[()\\]/g, '')}) Tj`).join(' ') + ' ET';
  const nesneler = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let govde = '%PDF-1.4\n';
  const yerler = [];
  nesneler.forEach((n, i) => { yerler.push(govde.length); govde += `${i + 1} 0 obj\n${n}\nendobj\n`; });
  const xref = govde.length;
  govde += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n` +
    yerler.map((y) => `${String(y).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(govde, 'latin1');
}

const HARFLER = 'ABCDE';
const anahtarUret = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), HARFLER[i % 5]]));

const DETAY = (n, anahtar = anahtarUret(n)) => ({
  id: 'a1', baslik: 'Üslü ve köklü', aciklama: 'Açıklama', tur: 'test', sinif_id: 's1', sinif: '9A',
  son_tarih: '2026-09-30', soru_sayisi: n, gec_teslim: true, sik_sayisi: 5,
  cevap_anahtari: anahtar, konular: { 1: 'Üslü' },
  anahtar_yolu: 'odev/anahtar/eski.pdf', odev_yolu: 'odev/sorular/eski.pdf',
  yayinda: true, gonderim_sayisi: 3, sayfa_limiti: 1,
});

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

async function kur(detay) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript((detay) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }));
    window.__cagrilar = [];
    window.__acilan = [];
    window.open = (u) => { window.__acilan.push(String(u)); return null; };
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      if (url.startsWith('https://depo.sahte/')) {
        window.__cagrilar.push({ ad: 'depo-yukle', govde: url });
        return new Response('{}', { status: 200 });
      }
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__cagrilar.push({ ad: 'dosya-url', govde });
        return json({ imzaliUrl: 'https://depo.sahte/oku/' + govde.yol, gecerlilikSn: 60 });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });
      switch (m[1]) {
        case 'odev_detay': return json(detay);
        case 'siniflar_listesi':
          return json([{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false }]);
        case 'konu_onerileri': return json([]);
        case 'odevler_listesi': return json([]);
        case 'ben_kimim': return json({ id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null });
        case 'odev_dosya_yolu': return json({ yol: govde.p_tur === 'odev' ? detay.odev_yolu : detay.anahtar_yolu });
        case 'odev_guncelle': return json({ durum: 'tamam', yeniden_puanlanan: [] });
        default: return json({});
      }
    };
  }, detay);
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/ogretmen/odevler/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const guncelleme = async (p) => (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'odev_guncelle').at(-1)?.govde;
const kaydet = async (p) => { await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click(); await p.waitForTimeout(500); };

async function anahtarYukle(p, ad, veri) {
  await p.getByRole('button', { name: 'Cevap anahtarı PDF’i — yenisiyle değiştir' }).click();
  await p.locator('input[type=file]').setInputFiles({ name: ad, mimeType: 'application/pdf', buffer: veri });
  // Okuma bitene kadar ("PDF okunuyor…") bekle.
  await p.waitForFunction(() => !document.body.innerText.includes('PDF okunuyor'), null, { timeout: 120000 });
  await p.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
console.log('--- A1. Yüklü dosyalar görünür, boş dosya alanı yok ---');
{
  const { b, p } = await kur(DETAY(51));
  const m = await metin(p);
  const yuklu = (m.match(/Değiştirmediğiniz sürece bu dosya ödevde aynen kalır/g) ?? []).length;
  if (yuklu !== 2) bozuk(`iki dosya da "Yüklü" görünmeli, görünen ${yuklu}`);
  else tamam('sorular ve anahtar: belge kartı, "Kayıtlı", Görüntüle, Yenisiyle değiştir');
  if ((await p.locator('input[type=file]').count()) !== 0) bozuk('boş dosya alanı hâlâ görünüyor');
  else tamam('"Dosya seçilmedi" diyen boş alan yok');
  if (!m.includes('51 sorunun cevabı kayıtlı') || !m.includes('Öğrencilerin çözeceği sorular')) bozuk('kart ayrıntısı yok');
  else tamam('ayrıntı: "51 sorunun cevabı kayıtlı", "Öğrencilerin çözeceği sorular"');
  if (!m.includes('Yalnız değiştirmek istediğiniz alanı değiştirin')) bozuk('yönlendirme cümlesi yok');
  else tamam('"Yalnız değiştirmek istediğiniz alanı değiştirin" yazıyor');
  await p.getByRole('button', { name: 'Ödev PDF’i (sorular) — dosyayı görüntüle' }).click();
  await p.waitForTimeout(300);
  const acilan = await p.evaluate(() => window.__acilan);
  if (acilan[0] !== 'https://depo.sahte/oku/odev/sorular/eski.pdf') bozuk(`"Aç" yanlış adres: ${acilan}`);
  else tamam('"Görüntüle" kayıtlı soruları imzalı adresle açıyor');
  await b.close();
}

console.log('--- A2. Yalnız son tarih: geri kalan her şey aynen ---');
{
  const d = DETAY(51);
  const { b, p } = await kur(d);
  await p.fill('input[type=date]', '2026-10-15');
  await kaydet(p);
  const g = await guncelleme(p);
  const sorun = [];
  if (g?.p_son_tarih !== '2026-10-15') sorun.push(`tarih ${g?.p_son_tarih}`);
  if (JSON.stringify(g?.p_cevap_anahtari) !== JSON.stringify(d.cevap_anahtari)) sorun.push('anahtar değişti');
  if (g?.p_odev_yolu !== d.odev_yolu || g?.p_anahtar_yolu !== d.anahtar_yolu) sorun.push('dosya yolu değişti');
  if (g?.p_gec_teslim !== true || g?.p_soru_sayisi !== 51 || g?.p_konular?.['1'] !== 'Üslü') sorun.push('diğer alan değişti');
  if (sorun.length) bozuk(`yük: ${sorun.join(', ')}`);
  else tamam('yalnız p_son_tarih değişti; 51 cevap, konular, dosyalar, geç teslim aynen');
  await b.close();
}

console.log('--- A3. Cevap içermeyen anahtar PDF\'i kayıtlı cevapları SİLMİYOR ---');
{
  const d = DETAY(51);
  const { b, p } = await kur(d);
  await anahtarYukle(p, 'bos.pdf', kucukPdf(['Matematik', 'Cevap anahtari yakinda']));
  const m = await metin(p);
  if (!m.includes('51/51 cevap girildi')) bozuk('kayıtlı cevaplar silindi (51/51 yok)');
  else tamam('51/51 cevap duruyor');
  if (!m.includes('Bu PDF’ten cevap okunamadı; kayıtlı cevaplar olduğu gibi duruyor')) bozuk('bilgi kartı yok');
  else tamam('"cevap okunamadı; kayıtlı cevaplar olduğu gibi" deniyor');
  await kaydet(p);
  const g = await guncelleme(p);
  if (JSON.stringify(g?.p_cevap_anahtari) !== JSON.stringify(d.cevap_anahtari)) bozuk('kayıtta anahtar değişti');
  else tamam('kayıt yükünde 51 cevap aynen');
  await b.close();
}

console.log('--- A4. Yeni PDF yalnız bulduğunu değiştirir; değişen listelenir; Vazgeç geri alır ---');
{
  const d = DETAY(5); // 1A 2B 3C 4D 5E
  const { b, p } = await kur(d);
  await anahtarYukle(p, 'duzeltme.pdf', kucukPdf(['CEVAP ANAHTARI', '1-A 2-C']));
  let m = await metin(p);
  if (!m.includes('1 soruda cevap değişti') || !m.includes('2. soru: B → C')) bozuk('değişen cevap listelenmedi');
  else tamam('"1 soruda cevap değişti — 2. soru: B → C"');
  if (!m.includes('5/5 cevap girildi')) bozuk('bulunamayan sorular (3–5) silindi');
  else tamam('PDF\'te olmayan 3, 4, 5 eski cevabını korudu');
  await p.getByRole('button', { name: 'Vazgeç — kayıtlı dosya kalsın' }).click();
  await p.waitForTimeout(200);
  m = await metin(p);
  if (m.includes('soruda cevap değişti')) bozuk('Vazgeç sonrası değişiklik kartı duruyor');
  await kaydet(p);
  const g = await guncelleme(p);
  if (JSON.stringify(g?.p_cevap_anahtari) !== JSON.stringify(d.cevap_anahtari) || g?.p_anahtar_yolu !== d.anahtar_yolu) {
    bozuk(`Vazgeç eski cevapları/dosyayı geri getirmedi: ${JSON.stringify(g?.p_cevap_anahtari)}`);
  } else tamam('Vazgeç: 2. soru yeniden B, yüklü anahtar dosyası aynen');
  await b.close();
}

// ---------------------------------------------------------------------------
// B. GERÇEK PDF'LER — isteğe bağlı
// ---------------------------------------------------------------------------
const GERCEK = [
  {
    ortam: 'ANAHTAR_PDF_ISARETLI', n: 51, enAzDogru: 49,
    // Öğretmenin PDF'indeki pembe kutular, gözle okunmuş. 14 işaretsiz,
    // 42'de harfin üstüne el yazısı binmiş — ikisi de BOŞ kalmalı.
    dogru: 'ACCCCBACCBBDC-BDCBCCDAAEECBBEEBDCDBBCBBEC-DEDADDADB',
  },
  { ortam: 'ANAHTAR_PDF_METIN', n: 9, enAzDogru: 9, dogru: 'DECCCBBED' },
];
for (const g of GERCEK) {
  const yol = process.env[g.ortam];
  console.log(`--- B. Gerçek PDF: ${g.ortam} ---`);
  if (!yol) { console.log(`  (atlandı — ${g.ortam} verilmedi)`); continue; }
  const { b, p } = await kur(DETAY(g.n, {}));
  const t0 = Date.now();
  await anahtarYukle(p, 'gercek.pdf', readFileSync(yol));
  const sure = Date.now() - t0;
  await kaydet(p);
  const a = (await guncelleme(p))?.p_cevap_anahtari ?? {};
  let dogru = 0;
  const yanlis = [];
  for (let i = 1; i <= g.n; i++) {
    const bek = g.dogru[i - 1];
    const bulunan = a[String(i)];
    if (bulunan === undefined) continue;
    if (bulunan === bek) dogru++;
    else yanlis.push(`${i}: ${bulunan} (doğrusu ${bek === '-' ? 'boş' : bek})`);
  }
  if (yanlis.length) bozuk(`YANLIŞ OKUNAN: ${yanlis.join(', ')}`);
  else tamam('yanlış okunan yok');
  if (dogru < g.enAzDogru) bozuk(`${dogru}/${g.n} doğru (en az ${g.enAzDogru})`);
  else tamam(`${dogru}/${g.n} doğru, ${(sure / 1000).toFixed(1)} sn`);
  await b.close();
}

console.log('');
if (hata) { console.log(`ANAHTAR OKUMA DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('ANAHTAR OKUMA DENETİMİ GEÇTİ');
