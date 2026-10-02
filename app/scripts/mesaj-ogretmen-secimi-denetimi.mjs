/**
 * VELİ/ÖĞRENCİ MESAJINDA ÖĞRETMEN SEÇİMİ (Chromium, taklit RPC) — 0058
 *
 * Olay: başka öğretmenin sınıfındaki veli mesaj gönderemedi ("Birden çok
 * öğretmeniniz var…"). Öğretmenin kararı: veli kime yazacağını seçsin.
 *
 *  S1. Veli, iki öğretmen: iki ad da düğme; açılışta en son yazışılan
 *      seçili; yalnız onun mesajları görünüyor; diğerine geçince
 *      yalnız onunkiler.
 *  S2. Gönder: `mesaj_gonder` yükünde p_ogretmen_id = seçilen öğretmen.
 *  S3. Öğretmen değişince yazılmış ama gönderilmemiş metin silinir
 *      (yanlış kişiye gitmesin).
 *  S4. Tek öğretmen: seçici yok, "Kime: Buket Topuzoğlu", yükte kimlik.
 *  S5. Eski sunucu (liste yok): bugünkü ekran, yükte p_ogretmen_id YOK.
 *  S6. Öğrenci de aynı: seçici + yükte kimlik.
 *  S7. 280 px'de uzun adlarla yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/mesaj-ogretmen-secimi-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const BARIS = { id: 'b-1', ad: 'Barış Atmaca' };
const BUKET = { id: 's-1', ad: 'Buket Topuzoğlu' };
const MESAJLAR = [
  { kimden: 'veli', metin: 'Barış Bey merhaba', zaman: '2026-09-28T10:00:00Z', ogretmen_id: BARIS.id, ogretmen: BARIS.ad },
  { kimden: 'ogretmen', metin: 'Buket Hanım yazdı', zaman: '2026-09-29T10:00:00Z', ogretmen_id: BUKET.id, ogretmen: BUKET.ad },
];

async function kur({ rol, ogretmenler, mesajlar = MESAJLAR, en = 390 }) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  await s.addInitScript(({ rol, ogretmenler, mesajlar }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
      ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9C' } }));
    window.__yukler = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const ek = ogretmenler ? { ogretmenler } : {};
    const kimden = rol === 'veli' ? 'veli' : 'ogrenci';
    const liste = mesajlar.map((m) => (m.kimden === 'veli' ? { ...m, kimden } : m));
    window.fetch = async (u, o) => {
      const m = String(typeof u === 'string' ? u : u.url).match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      switch (m[1]) {
        case 'mesaj_gonder': window.__yukler.push(govde); return json({ durum: 'tamam' });
        case 'okundu_isaretle': return json({ durum: 'tamam' });
        case 'veli_paneli':
          return json({ ogrenci: { ad: 'Ada Yıldırım', sinif: '9C', tur: 'okul' }, okunmamis_mesaj: 1,
            genel_ortalama: null, odevler: [], mesajlar: liste, odemeler: [], son_gorulme: '2026-09-28T12:00:00Z', ...ek });
        case 'ogrenci_mesajlari': return json({ mesajlar: liste, son_gorulme: '2026-09-28T12:00:00Z', ...ek });
        case 'ogrenci_odevleri': return json({ ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9C', tur: 'okul' }, odevler: [], dersler: [], okunmamis_mesaj: 0 });
        default: return json({});
      }
    };
  }, { rol, ogretmenler, mesajlar });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + (rol === 'veli' ? '/veli/mesajlar' : '/ogrenci/mesajlar'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
const yukler = (p) => p.evaluate(() => window.__yukler);
const dugme = (p, ad) => p.getByRole('button', { name: new RegExp(`^${ad}`) });
async function yazGonder(p, yazi) {
  await p.locator('textarea').fill(yazi);
  await p.getByRole('button', { name: 'Gönder', exact: true }).click();
  await p.waitForTimeout(400);
}

console.log('--- S1–S3. Veli, iki öğretmen ---');
{
  const { b, p } = await kur({ rol: 'veli', ogretmenler: [BARIS, BUKET] });
  let m = await metin(p);
  const sira = m.indexOf(BARIS.ad) < m.indexOf(BUKET.ad);
  if ((await dugme(p, BARIS.ad).count()) !== 1 || (await dugme(p, BUKET.ad).count()) !== 1 || !sira) {
    bozuk(`iki öğretmen düğmesi yok ya da sıra yanlış: ${m.slice(0, 300)}`);
  } else tamam('"Barış Atmaca" ve "Buket Topuzoğlu" düğmeleri, sınıf öğretmeni önce');
  if (!m.includes('Hangi öğretmenle yazışmak istiyorsunuz?')) bozuk('seçim sorusu yok');
  if ((await dugme(p, BUKET.ad).getAttribute('aria-pressed')) !== 'true' || !m.includes('Buket Hanım yazdı') || m.includes('Barış Bey merhaba')) {
    bozuk('açılışta en son yazışılan (Buket) seçili değil ya da yazışmalar karışık');
  } else tamam('açılışta en son yazışılan öğretmen seçili; yalnız onun mesajları');
  if (!m.includes('Kime: Buket Topuzoğlu')) bozuk('"Kime:" satırı yok');

  await dugme(p, BARIS.ad).click();
  await p.waitForTimeout(200);
  m = await metin(p);
  if (!m.includes('Barış Bey merhaba') || m.includes('Buket Hanım yazdı') || !m.includes('Kime: Barış Atmaca')) {
    bozuk(`Barış'a geçince yazışma ayrışmadı: ${m.slice(0, 400)}`);
  } else tamam('Barış seçilince yalnız Barış yazışması, "Kime: Barış Atmaca"');

  await yazGonder(p, 'Barış Bey, ödev hakkında');
  const y = await yukler(p);
  if (y.length !== 1 || y[0].p_ogretmen_id !== BARIS.id) bozuk(`yük: ${JSON.stringify(y)}`);
  else tamam(`mesaj_gonder(p_ogretmen_id: "${BARIS.id}")`);

  await p.locator('textarea').fill('Gönderilmemiş taslak');
  await dugme(p, BUKET.ad).click();
  await p.waitForTimeout(200);
  if ((await p.locator('textarea').inputValue()) !== '') bozuk('öğretmen değişince taslak kutuda kaldı');
  else tamam('öğretmen değişince yazılmış taslak siliniyor');
  await b.close();
}

console.log('--- S4. Tek öğretmen ---');
{
  const { b, p } = await kur({ rol: 'veli', ogretmenler: [BUKET], mesajlar: [MESAJLAR[1]] });
  const m = await metin(p);
  if (m.includes('Hangi öğretmenle') || !m.includes('Kime: Buket Topuzoğlu')) bozuk(`tek öğretmen: ${m.slice(0, 300)}`);
  else tamam('seçici yok, "Kime: Buket Topuzoğlu"');
  await yazGonder(p, 'Merhaba');
  const y = await yukler(p);
  if (y.length !== 1 || y[0].p_ogretmen_id !== BUKET.id) bozuk(`yük: ${JSON.stringify(y)}`);
  else tamam('yükte p_ogretmen_id var');
  await b.close();
}

console.log('--- S5. Eski sunucu (liste yok) ---');
{
  const { b, p } = await kur({ rol: 'veli', ogretmenler: undefined, mesajlar: MESAJLAR.map(({ ogretmen_id, ogretmen, ...r }) => r) });
  const m = await metin(p);
  if (m.includes('Kime:') || !m.includes('Öğretmene mesaj')) bozuk(`eski ekran değişti: ${m.slice(0, 300)}`);
  else tamam('bugünkü ekran ("Öğretmene mesaj")');
  await yazGonder(p, 'Merhaba');
  const y = await yukler(p);
  if (y.length !== 1 || 'p_ogretmen_id' in y[0]) bozuk(`yük: ${JSON.stringify(y)}`);
  else tamam('yükte p_ogretmen_id YOK (eski uç tanımaz)');
  await b.close();
}

console.log('--- S6. Öğrenci, iki öğretmen ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', ogretmenler: [BARIS, BUKET] });
  const m = await metin(p);
  if (!m.includes('Hangi öğretmeninle yazışmak istiyorsun?')) bozuk(`öğrenci seçicisi yok: ${m.slice(0, 300)}`);
  else tamam('öğrencide de seçici');
  await dugme(p, BARIS.ad).click();
  await yazGonder(p, 'Hocam soru');
  const y = await yukler(p);
  if (y.length !== 1 || y[0].p_ogretmen_id !== BARIS.id) bozuk(`yük: ${JSON.stringify(y)}`);
  else tamam('öğrencinin mesajı seçtiği öğretmene');
  await b.close();
}

console.log('--- S7. 280 px, uzun adlar ---');
{
  const UZUN = [{ id: 'u1', ad: 'Muhammed Mustafa Abdurrahmanoğlu' }, { id: 'u2', ad: 'Ayşegül Karamustafaoğlu Topuzoğlu' }];
  const { b, p } = await kur({ rol: 'veli', ogretmenler: UZUN, mesajlar: [], en: 280 });
  const r = await p.evaluate(() => ({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  if (r.sw > r.W) bozuk(`yatay taşma: ${r.sw} > ${r.W}`);
  else tamam('280 px\'de taşma yok');
  await b.close();
}

console.log('');
if (hata) { console.log(`MESAJ ÖĞRETMEN SEÇİMİ DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('MESAJ ÖĞRETMEN SEÇİMİ DENETİMİ GEÇTİ');
