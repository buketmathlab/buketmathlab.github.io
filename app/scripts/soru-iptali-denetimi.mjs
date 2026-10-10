/**
 * SORU İPTALİ (Chromium, taklit RPC) — 0072
 *
 * Gerçek olay: 65 soruluk testte 8. ve 35. soruların şıkları baskıda
 * çıkmadı. Öğretmenin kararı: değerlendirme dışı (63 üzerinden), aynı
 * ödevin bütün şubelerinde.
 *
 *  İ1. Öğretmen: "Soru iptal et" → "8, 35" + sebep → onay penceresi
 *      "8 ve 35. sorular 10A, 10B şubelerinde … 63 soru üzerinden".
 *      "İptal et" → `sorulari_iptal_et` doğru gövdeyle; rapor şube şube,
 *      elle düzeltilmiş puan uyarısı görünüyor.
 *  İ2. Hatalı giriş ("8, 66", sebepsiz) → uyarı; RPC ÇAĞRILMIYOR.
 *  İ3. İptal edilmiş soru: listede "8. soru · iptal", "64 soru üzerinden";
 *      "Geri al" → `soru_iptalini_geri_al` p_soru 8. Anahtar ızgarasında
 *      8. satır "İptal edildi", şık düğmesi YOK.
 *  İ4. Öğrenci sonuç ekranı: "8 ve 35. sorular iptal edildi; puanın 63
 *      soru üzerinden hesaplandı."; cevap listesinde "iptal edildi",
 *      "doğrusu IPTAL" gibi bir yazı YOK.
 *  İ5. 360 px'de yatay taşma yok (öğretmen ve öğrenci).
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/soru-iptali-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';
const gun = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const H = ['A', 'B', 'C', 'D', 'E'];
const anahtar = (iptal = []) =>
  Object.fromEntries(Array.from({ length: 65 }, (_, i) => {
    const no = i + 1;
    return [String(no), iptal.includes(no) ? `IPTAL:${H[no % 5]}` : H[no % 5]];
  }));

const RAPOR = {
  durum: 'tamam', sorular: [8, 35],
  subeler: [
    { sinif: '10A', odev_id: 'a1', yeniden_puanlanan: 3, ortalama_once: 70, ortalama_sonra: 72.2,
      elle_duzeltilmis: [{ ogrenci: 'Efe Kaya', ogretmen_puan: 50, hesaplanan: 46.03 }] },
    { sinif: '10B', odev_id: 'b1', yeniden_puanlanan: 2, ortalama_once: 80, ortalama_sonra: 82.5, elle_duzeltilmis: [] },
  ],
};

async function ac({ rol, yol, en = 800, iptal = [] }) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 1000 } });
  const cagrilar = [];
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    let govde = null;
    try { govde = JSON.parse(r.request().postData() ?? 'null'); } catch { /* yok */ }
    cagrilar.push({ uc, govde });
    const yanit = {
      odev_detay: { id: 'a1', baslik: 'Üslü ve Köklü', aciklama: null, tur: 'test', sinif_id: 's1', sinif: '10A',
        son_tarih: gun(-2), soru_sayisi: 65, gec_teslim: true, sik_sayisi: 5, cevap_anahtari: anahtar(iptal),
        konular: {}, anahtar_yolu: null, odev_yolu: null, yayinda: true, gonderim_sayisi: 3, sayfa_limiti: 1,
        kardesler: ['10B'], kardes_detay: [{ id: 'b1', sinif: '10B', gonderim_sayisi: 2, anahtar_ayni: true, arsiv: false }] },
      siniflar_listesi: [{ id: 's1', ad: '10A', seviye: 10, sube: 'A', ozel: false, arsiv: false }],
      ben_kimim: { id: 'g', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null },
      konu_onerileri: [], odevler_listesi: [], ewalu_mesajlari: [], odev_kiyasi: { durum: 'sure_dolmadi' },
      sorulari_iptal_et: RAPOR,
      soru_iptalini_geri_al: { durum: 'tamam', soru: 8, subeler: RAPOR.subeler },
      ogrenci_odevleri: {
        ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '10A', tur: 'okul' }, dersler: [], okunmamis_mesaj: 0,
        odevler: [{ id: 'a1', baslik: 'Üslü ve Köklü', aciklama: null, tur: 'test', son_tarih: gun(-2), soru_sayisi: 65,
          gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null, konu_analizi: [],
          cevap_anahtari: anahtar(iptal), anahtar_yolu: null,
          gonderim: { id: 'g1', zaman: gun(-3) + 'T10:00:00Z', durum: 'puanlandi', dogru: 63, yanlis: 0, bos: 0,
            puan: 100, ogretmen_puan: null, ogretmen_yorum: null, gecikmeli: false,
            cevaplar: Object.fromEntries(Object.entries(anahtar()).filter(([k]) => !['8', '35'].includes(k))) } }],
      },
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });
  await p.addInitScript((rol) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '10A' } })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p, cagrilar };
}
const metin = (p) => p.evaluate(() => document.body.innerText);
const kart = (p) => p.locator('div').filter({ has: p.getByRole('heading', { name: 'Soru iptali' }) }).last();
const tasma = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

console.log('--- İ1. Öğretmen iptal ediyor ---');
{
  const { b, p, cagrilar } = await ac({ rol: 'ogretmen', yol: '/ogretmen/odevler/a1' });
  const k = kart(p);
  ((await k.count()) > 0 ? tamam : bozuk)('"Soru iptali" kartı var');
  const m0 = await k.innerText();
  (/10A, 10B/.test(m0) ? tamam : bozuk)('kart şubeleri söylüyor (10A, 10B)');
  await k.getByRole('button', { name: 'Soru iptal et' }).click();
  await k.getByLabel(/İptal edilecek soru numaraları/).fill('8, 35');
  await k.getByLabel(/Sebep/).fill('Şıklar baskıda çıkmadı');
  await k.getByRole('button', { name: 'Devam' }).click();
  await p.waitForTimeout(300);
  const dlg = p.locator('dialog[open]');
  const dm = (await dlg.count()) ? await dlg.innerText() : '';
  (/8 ve 35\. sorular 10A, 10B şubelerinde değerlendirme dışı bırakılacak\. Puanlar 63 soru üzerinden/.test(dm) ? tamam : bozuk)(
    `onay metni: ${dm.split('\n').find((s) => s.includes('sorular')) ?? dm.slice(0, 120)}`);
  await dlg.getByRole('button', { name: 'İptal et' }).click();
  await p.waitForTimeout(600);
  const c = cagrilar.filter((x) => x.uc === 'sorulari_iptal_et');
  (c.length === 1 && JSON.stringify(c[0].govde.p_sorular) === '[8,35]' && c[0].govde.p_sebep === 'Şıklar baskıda çıkmadı' && c[0].govde.p_odev === 'a1'
    ? tamam : bozuk)(`sorulari_iptal_et gövdesi: ${JSON.stringify(c[0]?.govde ?? null)}`);
  const m = await metin(p);
  (/10A: 3 öğrencinin puanı yeniden hesaplandı · ortalama 70 → 72,2/.test(m) ? tamam : bozuk)('rapor 10A');
  (/10B: 2 öğrencinin puanı yeniden hesaplandı/.test(m) ? tamam : bozuk)('rapor 10B');
  (/Efe Kaya: elle verdiğiniz 50 puan korunuyor/.test(m) ? tamam : bozuk)('elle düzeltilmiş puan uyarısı');
  (await tasma(p) <= 0 ? tamam : bozuk)('800 px taşma yok');
  await b.close();
}

console.log('--- İ2. Hatalı giriş sunucuya gitmiyor ---');
{
  const { b, p, cagrilar } = await ac({ rol: 'ogretmen', yol: '/ogretmen/odevler/a1' });
  const k = kart(p);
  await k.getByRole('button', { name: 'Soru iptal et' }).click();
  await k.getByLabel(/İptal edilecek soru numaraları/).fill('8, 66');
  await k.getByLabel(/Sebep/).fill('Baskı');
  await k.getByRole('button', { name: 'Devam' }).click();
  await p.waitForTimeout(200);
  (/1 ile 65 arasında olmalı \(66\)/.test(await k.innerText()) ? tamam : bozuk)('"8, 66" → aralık uyarısı');
  await k.getByLabel(/İptal edilecek soru numaraları/).fill('8');
  await k.getByLabel(/Sebep/).fill('');
  await k.getByRole('button', { name: 'Devam' }).click();
  await p.waitForTimeout(200);
  (/sebebini yazın/.test(await k.innerText()) ? tamam : bozuk)('sebepsiz → uyarı');
  ((await p.locator('dialog[open]').count()) === 0 ? tamam : bozuk)('onay penceresi açılmadı');
  (cagrilar.every((x) => x.uc !== 'sorulari_iptal_et') ? tamam : bozuk)('sorulari_iptal_et çağrılmadı');
  await b.close();
}

console.log('--- İ3. İptal edilmiş soru: liste, geri al, ızgara ---');
{
  const { b, p, cagrilar } = await ac({ rol: 'ogretmen', yol: '/ogretmen/odevler/a1', iptal: [8] });
  const k = kart(p);
  const km = await k.innerText();
  (/8\.\s*soru · iptal · değerlendirme dışı/.test(km) ? tamam : bozuk)('listede "8. soru · iptal"');
  (/Puan 64 soru üzerinden/.test(km) ? tamam : bozuk)('"Puan 64 soru üzerinden"');
  await k.getByRole('button', { name: '8. sorunun iptalini geri al' }).click();
  await p.waitForTimeout(500);
  const c = cagrilar.filter((x) => x.uc === 'soru_iptalini_geri_al');
  (c.length === 1 && c[0].govde.p_soru === 8 ? tamam : bozuk)(`soru_iptalini_geri_al p_soru 8 (${JSON.stringify(c[0]?.govde ?? null)})`);

  const goster = p.getByRole('button', { name: /cevabı göster/ });
  if (await goster.count()) { await goster.click(); await p.waitForTimeout(200); }
  ((await p.getByRole('button', { name: '8. soru, A şıkkı', exact: true }).count()) === 0 ? tamam : bozuk)('ızgarada 8. satırda şık düğmesi yok');
  ((await p.getByRole('button', { name: '9. soru, A şıkkı', exact: true }).count()) === 1 ? tamam : bozuk)('9. satır normal');
  const satir8 = p.locator('li').filter({ hasText: 'İptal edildi · değerlendirme dışı' });
  ((await satir8.count()) === 1 ? tamam : bozuk)('8. satır "İptal edildi · değerlendirme dışı"');
  await b.close();
}

console.log('--- İ4. Öğrenci sonuç ekranı ---');
{
  const { b, p } = await ac({ rol: 'ogrenci', yol: '/ogrenci/odev/a1', iptal: [8, 35] });
  const m = await metin(p);
  (m.includes('8 ve 35. sorular iptal edildi; puanın 63 soru üzerinden hesaplandı.') ? tamam : bozuk)('açıklama satırı');
  ((m.match(/iptal edildi$/gm) ?? []).length === 2 ? tamam : bozuk)(`cevap listesinde 2 "iptal edildi" (${(m.match(/iptal edildi$/gm) ?? []).length})`);
  (!/IPTAL/.test(m) ? tamam : bozuk)('ekranda ham "IPTAL" işareti yok');
  await b.close();
}

console.log('--- İ5. 360 px ---');
for (const [rol, yol] of [['ogretmen', '/ogretmen/odevler/a1'], ['ogrenci', '/ogrenci/odev/a1']]) {
  const { b, p } = await ac({ rol, yol, en: 360, iptal: [8, 35] });
  (await tasma(p) <= 0 ? tamam : bozuk)(`${rol}: 360 px taşma yok`);
  await b.close();
}

console.log('');
if (hata) {
  console.log(`SORU İPTALİ DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('SORU İPTALİ DENETİMİ GEÇTİ');
