/**
 * VELİ ADI — VELİLER SINIF LİSTESİ, MESAJLAR, YAZIŞMA (Chromium, taklit RPC)
 *
 * Öğretmenin isteği: sınıf listesinde ve Mesajlar'da öğrencinin yanında
 * velinin adı; ad, velinin onam verirken kendi yazdığı ad (0057).
 *
 *  V1. Veliler/9C: adı olan satırda "Veli: Ayşe Yıldırım"; adsız satırda
 *      "Veli:" yok ve "Onam bekliyor" duruyor.
 *  V2. Mesajlar: Veliler kanalında ad var, Öğrenciler kanalında yok.
 *  V3. Veli yazışması: alt başlıkta "velisi Ayşe Yıldırım ile yazışma",
 *      velinin mesaj balonunda "Ayşe Yıldırım:".
 *  V4. Alan hiç gelmezse (0057 çalışmamış panel) sayfalar bugünkü gibi.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/veli-adi-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const AD = 'Ayşe Yıldırım';

async function kur(yol, { alanYok = false } = {}) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript(({ AD, alanYok }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }));
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    // Eski sunucu taklidi: `veli_adi` anahtarı hiç yok.
    const ad = (deger) => (alanYok ? {} : { veli_adi: deger });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* yok */ }
      switch (m[1]) {
        case 'ben_kimim': return json({ id: 'g1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null });
        case 'bildirim_sayilari': return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
        case 'sinif_velileri':
          return json({ sinif: { id: 's9c', ad: '9C', ozel: false }, veliler: [
            { ogrenci_id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', onam_var: true, veli_kodu_var: true,
              mesaj_sayisi: 2, son_mesaj: '2026-09-29T10:00:00Z', okunmamis: 0, ...ad(AD) },
            { ogrenci_id: 'o2', ad: 'Bora Kaya', tur: 'okul', onam_var: false, veli_kodu_var: true,
              mesaj_sayisi: 0, son_mesaj: null, okunmamis: 0, ...ad(null) },
          ] });
        case 'yazisma_listesi': {
          const veli = govde?.p_kanal === 'veli';
          return json({ kanal: govde?.p_kanal, toplam_okunmamis: 0, gruplar: [
            { sinif_id: 's9c', sinif: '9C', okunmamis: 0, satirlar: [
              { ogrenci_id: 'o1', ad: 'Ada Yıldırım', son_mesaj: '2026-09-29T10:00:00Z', okunmamis: 0,
                ...ad(veli ? AD : null) },
            ] },
          ] });
        }
        case 'mesajlar_ogretmen':
          return json({
            ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9C', ...ad(govde?.p_kanal === 'veli' ? AD : null) },
            kanal: govde?.p_kanal, veli_kodu_var: true,
            mesajlar: [{ kimden: 'veli', metin: 'Merhaba hocam', zaman: '2026-09-29T10:00:00Z' }],
          });
        default: return json({});
      }
    };
  }, { AD, alanYok });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
const satir = (p, ogrenci) => p.locator('li', { hasText: ogrenci }).first().innerText();

console.log('--- V1. Veliler/9C ---');
{
  const { b, p } = await kur('/ogretmen/veliler/sinif/s9c');
  const ada = await satir(p, 'Ada Yıldırım');
  if (!ada.includes(`Veli: ${AD}`)) bozuk(`Ada satırında veli adı yok: ${ada}`);
  else tamam(`"Ada Yıldırım" satırında "Veli: ${AD}"`);
  const bora = await satir(p, 'Bora Kaya');
  if (bora.includes('Veli:') || !bora.includes('Onam bekliyor')) bozuk(`Bora satırı: ${bora}`);
  else tamam('adsız satırda "Veli:" yok, "Onam bekliyor" duruyor');
  await b.close();
}

console.log('--- V2. Mesajlar ---');
{
  const { b, p } = await kur('/ogretmen/mesajlar');
  const ogrenciKanali = await metin(p);
  if (ogrenciKanali.includes('Veli:')) bozuk('öğrenci kanalında veli adı görünüyor');
  else tamam('Öğrenciler kanalında veli adı yok');
  await p.getByRole('tab', { name: 'Veliler' }).click();
  await p.waitForTimeout(500);
  const ada = await satir(p, 'Ada Yıldırım');
  if (!ada.includes(`Veli: ${AD}`)) bozuk(`Veliler kanalında ad yok: ${ada}`);
  else tamam(`Veliler kanalında "Ada Yıldırım" altında "Veli: ${AD}"`);
  await b.close();
}

console.log('--- V3. Veli yazışması ---');
{
  const { b, p } = await kur('/ogretmen/veliler/yazisma/o1');
  const m = await metin(p);
  if (!m.includes(`velisi ${AD} ile yazışma`)) bozuk(`alt başlık: ${m.slice(0, 200)}`);
  else tamam(`"9C · velisi ${AD} ile yazışma"`);
  if (!m.includes(`${AD}:`)) bozuk('mesaj balonunda veli adı yok');
  else tamam(`velinin mesajında "${AD}:"`);
  await b.close();
}

console.log('--- V4. Alan gelmezse (eski sunucu) bugünkü gibi ---');
{
  let { b, p } = await kur('/ogretmen/veliler/sinif/s9c', { alanYok: true });
  let m = await metin(p);
  if (m.includes('Veli:') || !m.includes('Ada Yıldırım')) bozuk(`Veliler/9C: ${m.slice(0, 200)}`);
  else tamam('Veliler/9C: liste geliyor, "Veli:" yok');
  await b.close();
  ({ b, p } = await kur('/ogretmen/veliler/yazisma/o1', { alanYok: true }));
  m = await metin(p);
  if (!m.includes('velisiyle yazışma') || !m.includes('Veli:')) bozuk(`yazışma: ${m.slice(0, 200)}`);
  else tamam('yazışma: "velisiyle yazışma" ve balonda "Veli:"');
  await b.close();
}

console.log('');
if (hata) { console.log(`VELİ ADI DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('VELİ ADI DENETİMİ GEÇTİ');
