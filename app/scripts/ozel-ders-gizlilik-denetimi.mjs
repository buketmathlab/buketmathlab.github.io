/**
 * ÖZEL DERS YALNIZ SAHİPTE — YAZI DA (Chromium, taklit RPC)
 *
 * Öğretmen: "Benim dışımdaki diğer öğretmenlerin (müdür dahil) hesaplarının
 * hiçbir yerinde özel derse ait bir yazı ya da detaya yer verilmemeli."
 *
 * Veri tarafı zaten kapalı: özel ders öğrencileri ve grubu yalnız sahibe
 * dönüyor (`_ogretmenin_ogrencisi`, `_sinif_okuyucusu`, `mudur_paneli`).
 * Bu denetim EKRANDAKİ SABİT YAZILARI ölçüyor:
 *
 *  Ö1. Sahip olmayan öğretmen: Genel, Öğrenciler (+ "Öğrenci ekle"
 *      penceresi), Yeni ödev (+ 4 şık seçimi açık), Duyurular — hiçbirinde
 *      "özel ders" / "özel öğrenci" yok.
 *  Ö2. Müdür: Genel bakış — "özel ders" yok.
 *  Ö3. Sahip: "Öğrenci ekle" penceresinde "Özel ders öğrencisi" seçeneği
 *      VAR (sahibin işi bozulmadı).
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/ozel-ders-gizlilik-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
const YASAK = /özel ders|ozel ders|özel öğrenci/i;
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};

const OZET = { ogrenci_sayisi: 56, odev_sayisi: 12, soru_toplami: 240, soru_sayisiz: 0, gonderim_orani: 82, ortalama: 71.4 };
const GENEL = {
  yil_baslangici: '2026-09-01', okul: { ...OZET, sinif_sayisi: 1, kontrol_edilen_soru: 1400 },
  seviyeler: [{ ...OZET, seviye: 9, sinif_sayisi: 1, eksik_konular: [] }],
  siniflar: [{ id: 's1', ad: '9A', seviye: 9, ogrenci_sayisi: 28, odev_sayisi: 6, soru_toplami: 120, gonderim_orani: 85, ortalama: 74.1 }],
  aylar: [{ ay: '2026-09-01', odev_sayisi: 8, soru_toplami: 160, gonderim_orani: 80, ortalama: 70 }],
};
const SINIFLAR = [{ id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 28 }];

async function ac(yol, { rol = 'ogretmen', sahip = false } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on('pageerror', (e) => olc(`${yol}: sayfa hatası yok`, false, e.message));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = {
      ben_kimim: { id: 't1', ad: sahip ? 'Buket Topuzoğlu' : 'Barış Atmaca', sahip, vekalet: false, vekil: null },
      bildirim_sayilari: {}, okul_geneli: GENEL, siniflar_listesi: SINIFLAR, konu_onerileri: [],
      ogretmen_panosu: { ogrenci_sayisi: 28, odev_verilen_ogrenci: 28, acik_odev: 1, bekleyen_degerlendirme: 0,
        gecikmis_eksik: 2, son_gonderimler: [] },
      ogrenciler_listesi: { toplam: 1, sayfa: 1, toplam_sayfa: 1, kayitlar: [{ id: 'a', ad: 'Elif Yıldırım', tur: 'okul', sinif: '9A' }] },
      sinif_kartlari: SINIFLAR.map((s) => ({ ...s, ogretmenler: [], suresi_dolan: 0, son_odev: null, odev_sayisi: 0,
        soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null, ortalama: null })),
      ogretmen_duyurulari: [],
      mudur_paneli: { ...GENEL, ad: 'Ayşe Kaya', ogretmenler: [] },
      okul_odevleri: [],
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await p.addInitScript((rol) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol, token: 't'.repeat(64) })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p };
}
const metin = (p) => p.evaluate(() => document.body.innerText);

console.log('--- Ö1. Sahip olmayan öğretmen ---');
for (const yol of ['/ogretmen', '/ogretmen/duyurular', '/ogretmen/okul-odevleri']) {
  const { b, p } = await ac(yol);
  const m = await metin(p);
  olc(`${yol}: özel ders yazısı yok`, !YASAK.test(m), m.match(YASAK)?.[0]);
  await b.close();
}
{
  const { b, p } = await ac('/ogretmen/ogrenciler');
  await p.getByRole('button', { name: 'Öğrenci ekle' }).first().click();
  await p.waitForTimeout(300);
  const m = await metin(p);
  olc('Öğrenci ekle penceresi açık', (await p.locator('dialog[open]').count()) === 1);
  olc('/ogretmen/ogrenciler + ekleme penceresi: özel ders yazısı yok', !YASAK.test(m), m.match(YASAK)?.[0]);
  olc('"Öğrenci türü" seçimi yok', !m.includes('Öğrenci türü'));
  await b.close();
}
{
  const { b, p } = await ac('/ogretmen/odevler/yeni');
  const dugme = p.getByRole('button', { name: '4 şıklı test hazırlayacağım' });
  if (await dugme.count()) {
    await dugme.click();
    await p.waitForTimeout(200);
  }
  const m = await metin(p);
  olc('şık sayısı seçimi açık', m.includes('Şık sayısı'), m.slice(0, 200));
  olc('/ogretmen/odevler/yeni: özel ders yazısı yok', !YASAK.test(m), m.match(YASAK)?.[0]);
  await b.close();
}

console.log('--- Ö2. Müdür ---');
{
  const { b, p } = await ac('/mudur', { rol: 'mudur' });
  const m = await metin(p);
  olc('müdür Genel bakış açıldı', m.includes('Genel bakış'), m.slice(0, 200));
  olc('/mudur: özel ders yazısı yok', !YASAK.test(m), m.match(YASAK)?.[0]);
  await b.close();
}

console.log('--- Ö3. Sahipte seçenek duruyor ---');
{
  const { b, p } = await ac('/ogretmen/ogrenciler', { sahip: true });
  await p.getByRole('button', { name: 'Öğrenci ekle' }).first().click();
  await p.waitForTimeout(300);
  const secenekler = await p.locator('dialog[open] option').allInnerTexts();
  olc('sahipte "Özel ders öğrencisi" seçeneği var', secenekler.includes('Özel ders öğrencisi'), secenekler.join(' | '));
  await b.close();
}

console.log('');
if (hata) {
  console.log(`ÖZEL DERS GİZLİLİK DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('ÖZEL DERS GİZLİLİK DENETİMİ GEÇTİ');
