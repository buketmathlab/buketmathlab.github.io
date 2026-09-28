/**
 * TEK ÖĞRENCİ EKLERKEN OKUL NUMARASI (Chromium, taklit RPC)
 *
 * Öğretmenin isteği: "Manuel öğrenci eklerken öğrenci numarasını da
 * ekleyebilmeliyim." Sunucu 0042'den beri `p_ogrenci_no` alıyor; alan
 * formda yoktu.
 *
 *  N1. Okul öğrencisinde "Öğrenci numarası" alanı var; özel derste yok.
 *  N2. "0601" yazılınca `ogrenci_ekle` yükünde p_ogrenci_no = "0601"
 *      (METİN: baştaki sıfır korunuyor).
 *  N3. Numarasız eklemede parametre HİÇ gitmiyor (çağrı eskisiyle aynı).
 *  N4. Sınıfta aynı numara varsa UYARI, ekleme yok; "Yine de ekle" ekliyor
 *      (0042 kararı: uyar, engelleme).
 *  N5. Özel ders seçilirse daha önce yazılmış numara gitmiyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/ogrenci-numarasi-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

async function kur() {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(() => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }));
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });
      switch (m[1]) {
        case 'ben_kimim': return json({ id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null });
        case 'siniflar_listesi':
          return json([{ id: 's9c', ad: '9C', seviye: 9, sube: 'C', ozel: false, arsiv: false, ogrenci_sayisi: 1 }]);
        case 'ogrenciler_listesi':
          return json({ toplam: 1, sayfa: 1, toplam_sayfa: 1, kayitlar: [
            { id: 'o1', ad: 'Ali Yılmaz', ogrenci_no: '601', tur: 'okul', sinif_id: 's9c', sinif: '9C', aktif: true },
          ] });
        case 'ogrenci_ekle': return json({ id: 'yeni', ogrenci_no: govde.p_ogrenci_no ?? null, ogrenci_kodu: 'KOD-OGR', veli_kodu: 'KOD-VEL' });
        default: return json({});
      }
    };
  });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Öğrenci ekle', exact: true }).click();
  await p.waitForTimeout(200);
  return { b, p };
}
const d = (p) => p.locator('dialog[open]');
const ekleme = async (p) => (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'ogrenci_ekle');
async function doldur(p, { ad, no, tur = 'okul' }) {
  await d(p).getByLabel('Ad Soyad').fill(ad);
  await d(p).getByLabel('Öğrenci türü').selectOption(tur);
  if (tur === 'okul') {
    await d(p).getByLabel('Sınıf').selectOption('s9c');
    if (no !== undefined) await d(p).getByLabel('Öğrenci numarası').fill(no);
  }
}
const bas = async (p, ad) => { await d(p).getByRole('button', { name: ad, exact: true }).click(); await p.waitForTimeout(400); };

console.log('--- N1. Alan okul öğrencisinde var, özel derste yok ---');
{
  const { b, p } = await kur();
  const okulda = await d(p).getByLabel('Öğrenci numarası').count();
  await d(p).getByLabel('Öğrenci türü').selectOption('ozel');
  const ozelde = await d(p).getByLabel('Öğrenci numarası').count();
  if (okulda !== 1 || ozelde !== 0) bozuk(`okul: ${okulda}, özel: ${ozelde}`);
  else tamam('okulda "Öğrenci numarası" var, özel derste yok');
  await b.close();
}

console.log('--- N2. "0601" metin olarak gidiyor ---');
{
  const { b, p } = await kur();
  await doldur(p, { ad: 'Duru Dilara Aygün', no: '0601' });
  await bas(p, 'Ekle');
  const c = await ekleme(p);
  if (c.length !== 1 || c[0].govde.p_ogrenci_no !== '0601') bozuk(`yük: ${JSON.stringify(c.map((x) => x.govde))}`);
  else tamam('ogrenci_ekle(p_ogrenci_no: "0601")');
  if (!(await p.locator('dialog[open]').innerText()).includes('KOD-OGR')) bozuk('kod diyaloğu çıkmadı');
  else tamam('ardından giriş kodları gösterildi');
  await b.close();
}

console.log('--- N3. Numarasız: parametre hiç gitmiyor ---');
{
  const { b, p } = await kur();
  await doldur(p, { ad: 'Numarasız Öğrenci' });
  await bas(p, 'Ekle');
  const c = await ekleme(p);
  if (c.length !== 1 || 'p_ogrenci_no' in c[0].govde) bozuk(`yük: ${JSON.stringify(c.map((x) => x.govde))}`);
  else tamam('p_ogrenci_no yok — çağrı eskisiyle aynı');
  await b.close();
}

console.log('--- N4. Aynı numara: uyar, engelleme ---');
{
  const { b, p } = await kur();
  await doldur(p, { ad: 'Yeni Öğrenci', no: '601' });
  await bas(p, 'Ekle');
  const m = await d(p).innerText();
  if (!/Bu sınıfta 601 numarası zaten var: Ali Yılmaz/.test(m)) bozuk(`uyarı yok: ${m.slice(0, 200)}`);
  else tamam('"Bu sınıfta 601 numarası zaten var: Ali Yılmaz"');
  if ((await ekleme(p)).length) bozuk('uyarıya rağmen eklendi');
  else tamam('ilk basışta eklenmedi');
  await bas(p, 'Yine de ekle');
  const c = await ekleme(p);
  if (c.length !== 1 || c[0].govde.p_ogrenci_no !== '601') bozuk('"Yine de ekle" eklemedi');
  else tamam('"Yine de ekle" ile eklendi (engel yok)');
  await b.close();
}

console.log('--- N5. Özel ders seçilince yazılmış numara gitmiyor ---');
{
  const { b, p } = await kur();
  await doldur(p, { ad: 'Özel Öğrenci', no: '999' });
  await d(p).getByLabel('Öğrenci türü').selectOption('ozel');
  await bas(p, 'Ekle');
  const c = await ekleme(p);
  if (c.length !== 1 || 'p_ogrenci_no' in c[0].govde || c[0].govde.p_tur !== 'ozel') bozuk(`yük: ${JSON.stringify(c.map((x) => x.govde))}`);
  else tamam('özel ders: numara gitmedi');
  await b.close();
}

console.log('');
if (hata) { console.log(`ÖĞRENCİ NUMARASI DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('ÖĞRENCİ NUMARASI DENETİMİ GEÇTİ');
