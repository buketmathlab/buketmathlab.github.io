/**
 * DÜRÜST ÇALIŞMA İLKEMİZ — öğrenci panosunda sabit kart (Chromium, taklit RPC)
 *
 *  D1. Öğrenci Pano: "Yapay değil, kendi zekâm" kartı var (başlık h2, bölüm
 *      başlığa bağlı); üç paragraf ve üç ilke görünüyor (kapanış cümlesi
 *      öğretmenin isteğiyle kaldırıldı).
 *      Başlığın solunda sekizgen içinde okul önündeki Ewalu (96 px, boydan).
 *  D2. Sabit: kartın içinde hiçbir düğme yok (kapatılamaz); sayfa
 *      yenilenince yine orada.
 *  D3. Yeri: "Yaklaşan ödev" ve "Son puanın" kartlarından SONRA.
 *  D4. Hiç ödev yokken de görünüyor.
 *  D5. Veli panosunda YOK.
 *  D6. 360 px'de yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/durustluk-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';
const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const ODEV = {
  id: 'a1', baslik: 'Üslü Sayılar', aciklama: null, tur: 'test', son_tarih: gun(2), soru_sayisi: 20,
  gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null, gonderim: null,
  konu_analizi: [], cevap_anahtari: null, anahtar_yolu: null,
};

async function ac({ rol = 'ogrenci', yol = '/ogrenci', en = 390, odevler = [ODEV] } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 900 } });
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = {
      ogrenci_odevleri: { ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9A', tur: 'okul' }, odevler, dersler: [], okunmamis_mesaj: 0 },
      ogrenci_duyurulari: [],
      veli_paneli: { ogrenci: { ad: 'Ada Yıldırım', sinif: '9A', tur: 'okul' }, odevler: [], mesajlar: [], ogretmenler: [],
        okunmamis_mesaj: 0, odemeler: [], son_gorulme: null, genel_ortalama: null },
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript((rol) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9A' } })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const bolum = (p) => p.getByRole('region', { name: 'Yapay değil, kendi zekâm' });

console.log('--- D1–D3. Öğrenci Pano ---');
{
  const { b, p } = await ac();
  const k = bolum(p);
  ((await k.count()) === 1 ? tamam : bozuk)('kart var (bölüm başlığa bağlı)');
  ((await p.getByRole('heading', { level: 2, name: 'Yapay değil, kendi zekâm' }).count()) === 1 ? tamam : bozuk)('başlık h2');
  const m = (await k.count()) ? await k.innerText() : '';
  for (const [r, ad] of [
    [/çalışma programı/, 'puan → çalışma programı'],
    [/Yapay zekâdan/, 'yapay zekâ'],
    [/eksiklerini gizler/, 'eksiklerini gizler'],
    [/kimse görmezken de doğru olanı/, 'dürüstlük tanımı'],
    [/Ödevlerimi kendi bilgim ve emeğimle yaparım\./, '1. ilke'],
    [/Ödevimi gönderdikten sonra takıldığım soruları çözümlü cevap anahtarından incelerim; anlamadığım yeri öğretmenime sorarım\./, '3. ilke'],
    [/^(?![\s\S]*kusur değil)/, 'kapanış cümlesi yok'],
  ]) (r.test(m) ? tamam : bozuk)(`metinde ${ad}`);
  ((await k.getByRole('listitem').count()) === 3 ? tamam : bozuk)('üç ilke');
  ((await k.getByRole('button').count()) === 0 ? tamam : bozuk)('kartta düğme yok (kapatılamaz)');
  // Öğretmenin isteği: başlığın yanında sekizgen içinde okul önündeki Ewalu.
  const gorsel = k.locator('img[src*="/ewalu/okul-portre-"]');
  ((await gorsel.count()) === 1 ? tamam : bozuk)('başlığın yanında okul önündeki Ewalu (sekizgen)');
  const yan = await p.evaluate(() => {
    const h = document.getElementById('durustluk-baslik');
    const img = h?.parentElement?.querySelector('img[src*="/ewalu/okul-portre-"]');
    if (!h || !img) return null;
    const a = img.getBoundingClientRect(), b = h.getBoundingClientRect();
    return { solunda: a.right <= b.left + 1, hiza: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 20, en: Math.round(a.width) };
  });
  (yan?.solunda && yan?.hiza && yan?.en === 96 ? tamam : bozuk)(`görsel başlığın solunda, aynı hizada, 96 px (${JSON.stringify(yan)})`);

  const sira = await p.evaluate(() => {
    const kart = document.getElementById('durustluk-baslik');
    const metin = (t) => [...document.querySelectorAll('p')].find((e) => e.textContent?.trim() === t);
    const yaklasan = metin('Yaklaşan ödev');
    const sonPuan = metin('Son puanın');
    const once = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { yaklasan: once(yaklasan, kart), sonPuan: once(sonPuan, kart) };
  });
  (sira.yaklasan && sira.sonPuan ? tamam : bozuk)(`"Yaklaşan ödev" ve "Son puanın" kartlarından sonra (${JSON.stringify(sira)})`);

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ((await bolum(p).count()) === 1 ? tamam : bozuk)('yenilemeden sonra yine orada');
  await b.close();
}

console.log('--- D4. Hiç ödev yokken ---');
{
  const { b, p } = await ac({ odevler: [] });
  ((await bolum(p).count()) === 1 ? tamam : bozuk)('ödevsiz panoda da var');
  await b.close();
}

console.log('--- D5. Veli panosunda yok ---');
{
  const { b, p } = await ac({ rol: 'veli', yol: '/veli' });
  ((await bolum(p).count()) === 0 ? tamam : bozuk)('veli panosunda kart yok');
  await b.close();
}

console.log('--- D6. 360 px ---');
{
  const { b, p } = await ac({ en: 360 });
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 ? tamam : bozuk)(`yatay taşma yok (${t} px)`);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`DÜRÜSTLÜK KARTI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('DÜRÜSTLÜK KARTI DENETİMİ GEÇTİ');
