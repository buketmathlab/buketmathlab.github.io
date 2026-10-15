/**
 * PROJE RAPORU (Chromium, taklit RPC) — 0075
 *
 * Okul Gelişim Projesi izleme-değerlendirme komisyonuna gösterilecek sayfa.
 *
 *  R1. Müdür: "Rapor" sekmesi var; sayfa `proje_raporu`'nun sayılarını
 *      doğru alanlarda gösteriyor (kayıt, onam oranı, hazırlanan/ulaşan
 *      ödev, çözümlü anahtar, kontrol edilen soru, ortalama); altta okulun
 *      genel özeti (`mudur_paneli`, kabuk bir kez çekiyor).
 *  R2. Sahip: Öğretmenler sayfasındaki "Proje raporu" önizlemedeki rapora
 *      götürüyor; aynı sayılar.
 *  R3. Yazdırma: kabuk (header/nav) kâğıda çıkmıyor; okul ve proje başlığı
 *      çıkıyor; "Yazdır / PDF" düğmesi kâğıtta yok. A4 PDF üretiliyor.
 *  R4. 0075 çalışmamışsa (uç yok): sayfa bozulmuyor, ne yapılacağını söylüyor.
 *  R5. Sayfada öğrenci adı yok.
 *  R6. 360 px'de yatay taşma yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/proje-raporu-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/#';

const RAPOR = {
  rapor_zamani: '2026-10-31T15:00:00Z',
  yil_baslangici: '2026-09-01',
  kayit: { sube_sayisi: 13, ogrenci_sayisi: 367, giris_yapan_ogrenci: 301, giris_yapan_veli: 244,
    veli_onami: 236, ilk_veli_onami: '2026-09-24T15:51:01Z', ogretmen_hesabi: 4, mudur_hesabi: 1 },
  odev: { hazirlanan: 21, subeye_ulasan: 57, hazirlanan_soru: 1180, subeye_ulasan_soru: 3215, test: 18,
    acik_uclu: 3, cozumlu_anahtar: 17, soru_dosyasi: 20, konu_etiketli: 15 },
  gonderim: { toplam: 1432, gonderen_ogrenci: 298, kontrol_edilen_soru: 80412, otomatik_puanlanan_soru: 71230,
    dogru: 45210, yanlis: 15020, bos: 11000, cozume_ulasan: 1250, ortalama: 66.4 },
  aylar: [
    { ay: '2026-09-01', hazirlanan: 6, subeye_ulasan: 15, gonderim: 310, ortalama: 63.1 },
    { ay: '2026-10-01', hazirlanan: 15, subeye_ulasan: 42, gonderim: 1122, ortalama: 67.3 },
  ],
  seviyeler: [
    { seviye: 9, sube_sayisi: 3, ogrenci_sayisi: 87, veli_onami: 60, hazirlanan: 6, gonderim: 400, ortalama: 64 },
    { seviye: 10, sube_sayisi: 3, ogrenci_sayisi: 91, veli_onami: 58, hazirlanan: 5, gonderim: 380, ortalama: 69.2 },
  ],
  ogretmenler: [{ ad: 'Buket Topuzoğlu', hazirlanan: 15, soru: 900, sube: 9 }, { ad: 'Barış Atmaca', hazirlanan: 6, soru: 280, sube: 4 }],
};
const PANEL = {
  ad: 'Ayşe Kaya', yil_baslangici: '2026-09-01',
  okul: { sinif_sayisi: 13, ogrenci_sayisi: 367, odev_sayisi: 57, soru_toplami: 3215, soru_sayisiz: 0,
    gonderim_orani: 84, ortalama: 66.4, kontrol_edilen_soru: 80412 },
  seviyeler: [{ seviye: 9, sinif_sayisi: 3, ogrenci_sayisi: 87, odev_sayisi: 15, soru_toplami: 800, soru_sayisiz: 0,
    gonderim_orani: 82, ortalama: 64, eksik_konular: [{ konu: 'Kümeler', toplam: 480, dogru: 200, oran: 42 }] }],
  siniflar: [{ id: '9a', ad: '9A', seviye: 9, ozel: false, arsiv: false, ogretmenler: ['Buket Topuzoğlu'], ogrenci_sayisi: 28,
    odev_sayisi: 6, suresi_dolan: 5, soru_toplami: 300, soru_sayisiz: 0, gonderim_orani: 84, ortalama: 72.5, son_odev: '2026-09-30' }],
  aylar: [{ ay: '2026-09-01', odev_sayisi: 15, soru_toplami: 800, gonderim_orani: 80, ortalama: 63 },
    { ay: '2026-10-01', odev_sayisi: 42, soru_toplami: 2415, gonderim_orani: 85, ortalama: 67 }],
  ogretmenler: [{ ad: 'Buket Topuzoğlu', sahip: true, siniflar: ['9A'], odev_sayisi: 15, soru_toplami: 900, son_30_gun: 5, son_odev: '2026-10-30' }],
};

async function ac({ rol = 'mudur', yol = '/mudur/rapor', ucYok = false, en = 1100 } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: en, height: 1000 } });
  const cagrilar = [];
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    cagrilar.push(uc);
    if (ucYok && uc === 'proje_raporu') {
      return r.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.proje_raporu(p_token) in the schema cache' }) });
    }
    const yanit = {
      proje_raporu: RAPOR, mudur_paneli: PANEL,
      ben_kimim: { id: 't1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null },
      ogretmenler_listesi: [{ id: 't1', ad: 'Buket Topuzoğlu', sahip: true, mudur: false, aktif: true, pin_var: true,
        sinif_sayisi: 2, odev_sayisi: 5, son_gorulme: null, sinif_idler: [] }],
      deneme_hesaplari: [], siniflar_listesi: [], bildirim_sayilari: {},
    }[uc] ?? {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });
  await p.addInitScript((rl) => localStorage.setItem('sekiz_oturum', JSON.stringify({ rol: rl, token: 't'.repeat(64) })), rol);
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { b, p, cagrilar };
}
const kutu = async (p, ad) => {
  const d = p.locator('dl > div').filter({ has: p.locator('dt', { hasText: new RegExp(`^${ad}$`) }) }).first();
  return (await d.count()) ? (await d.innerText()).replace(/\s+/g, ' ') : '';
};

console.log('--- R1. Müdür ---');
{
  const { b, p, cagrilar } = await ac();
  ((await p.getByRole('link', { name: 'Rapor' }).count()) > 0 ? tamam : bozuk)('"Rapor" sekmesi var');
  const kontroller = [
    ['Kayıtlı öğrenci', /367.*13 şube/],
    ['Veli onamı \\(KVKK\\)', /236.*%64/],
    ['Hazırlanan ödev', /21.*18 test.*3 açık uçlu/],
    ['Şubelere ulaşan ödev', /57/],
    ['Çözümlü cevap anahtarı', /17.*%81/],
    ['Kontrol edilen soru', /80\.412/],
    ['Otomatik puanlanan soru', /71\.230/],
    ['Ortalama puan', /66,4/],
    ['Müdür hesabı', /1/],
  ];
  for (const [ad, re] of kontroller) {
    const m = await kutu(p, ad);
    (re.test(m) ? tamam : bozuk)(`${ad.replace(/\\/g, '')}: ${m}`);
  }
  const govde = await p.locator('main').innerText();
  (/Ekim 2026/.test(govde) && /1\.122/.test(govde) ? tamam : bozuk)('aylık tablo');
  (/10\. sınıf/.test(govde) && /Barış Atmaca/.test(govde) ? tamam : bozuk)('düzey ve öğretmen tabloları');
  (/Okulun genel özeti/.test(govde) && /Aylık gelişim/.test(govde) ? tamam : bozuk)('altta okulun genel özeti');
  (cagrilar.filter((u) => u === 'mudur_paneli').length === 1 ? tamam : bozuk)('mudur_paneli bir kez çekildi');
  (/adım adım çözüm/.test(govde) && /Veliye anahtar hiçbir zaman/.test(govde) ? tamam : bozuk)('çözümlü anahtar açıklaması');

  console.log('--- R3. Yazdırma ---');
  await p.emulateMedia({ media: 'print' });
  const gorunur = async (sec) => p.locator(sec).evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).length);
  ((await gorunur('header, nav')) === 0 ? tamam : bozuk)('kabuk kâğıda çıkmıyor');
  ((await gorunur('.sk-rapor-baslik')) === 1 ? tamam : bozuk)('rapor başlığı kâğıtta');
  ((await p.getByRole('button', { name: 'Yazdır / PDF' }).evaluateAll((els) => els.filter((e) => e.offsetParent !== null).length)) === 0 ? tamam : bozuk)('yazdır düğmesi kâğıtta yok');
  const pdf = await p.pdf({ format: 'A4', printBackground: true });
  (pdf.length > 20000 ? tamam : bozuk)(`A4 PDF üretildi (${Math.round(pdf.length / 1024)} KB)`);
  await b.close();
}

console.log('--- R2. Sahip: Öğretmenler → Proje raporu ---');
{
  const { b, p } = await ac({ rol: 'ogretmen', yol: '/ogretmen/ogretmenler' });
  await p.getByRole('button', { name: 'Proje raporu' }).click();
  await p.waitForTimeout(800);
  (p.url().endsWith('/ogretmen/mudur-onizleme/rapor') ? tamam : bozuk)(`önizlemedeki rapor açıldı (${p.url().split('#')[1]})`);
  (/80\.412/.test(await kutu(p, 'Kontrol edilen soru')) ? tamam : bozuk)('aynı sayılar');
  await b.close();
}

console.log('--- R4. 0075 öncesi ---');
{
  const { b, p } = await ac({ ucYok: true });
  (/SQL 0075/.test(await p.locator('main').innerText()) ? tamam : bozuk)('"SQL 0075 … sonra kullanılabilir" yazıyor');
  await b.close();
}

console.log('--- R5–R6. Ad yok, 360 px ---');
{
  const { b, p } = await ac({ en: 360 });
  const t = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  (t <= 0 ? tamam : bozuk)(`yatay taşma yok (${t} px)`);
  const m = await p.locator('main').innerText();
  (!/Elif|Yıldırım|Mert/.test(m) ? tamam : bozuk)('öğrenci adı yok');
  await b.close();
}

console.log('');
if (hata) {
  console.log(`PROJE RAPORU DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('PROJE RAPORU DENETİMİ GEÇTİ');
