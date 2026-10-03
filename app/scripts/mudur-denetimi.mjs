/**
 * MÜDÜR HESABI — SALT İZLEME (Chromium, taklit RPC) — 0060
 *
 * Öğretmen: "Müdür için hesap açmak istiyorum." Seçtiği kapsam: salt
 * izleme; sınıf özetleri, öğretmen etkinliği, veli onam durumu. Öğrenci
 * puanları YOK.
 *
 * Asıl sınır sunucuda (`mudur_testleri.sql`); burada ekranın o sınırla
 * aynı şeyi söylediği ölçülüyor:
 *
 *  M1. PIN'le giriş → /mudur; sınıf kartlarında sayılar, öğrenci adı yok,
 *      hiçbir yazma düğmesi yok.
 *  M2. Öğretmenler sekmesi: kim hangi sınıfa giriyor, kaç ödev yayınladı.
 *  M3. Sınıf analizi ve onam dökümü açılıyor; "geri" müdür ekranına dönüyor.
 *  M4. Öğretmen adresi elle yazılsa da müdür ekranına düşüyor; müdür
 *      oturumu boyunca çağrılan uçlar YALNIZ okuma uçları.
 *  M5. Sahip → Öğretmenler: "Müdür ekle" `mudur_ekle`yi çağırıyor, pencere
 *      müdürün ne gördüğünü yazıyor; müdür satırında "Sınıfları" ve
 *      "Bu öğretmen olarak gir" yok.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/mudur-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`);
};

const PANEL = {
  ad: 'Ayşe Kaya',
  siniflar: [
    {
      id: '9a', ad: '9A', ogretmenler: ['Buket Topuzoğlu'], ogrenci_sayisi: 28,
      odev_sayisi: 6, suresi_dolan: 5, gonderim_orani: 84, ortalama: 72.5, son_odev: '2026-09-30',
    },
    {
      id: '10b', ad: '10B', ogretmenler: ['Barış Atmaca', 'Buket Topuzoğlu'], ogrenci_sayisi: 31,
      odev_sayisi: 0, suresi_dolan: 0, gonderim_orani: null, ortalama: null, son_odev: null,
    },
  ],
  ogretmenler: [
    { ad: 'Barış Atmaca', sahip: false, siniflar: ['10B'], odev_sayisi: 3, son_30_gun: 2, son_odev: '2026-09-28' },
    { ad: 'Buket Topuzoğlu', sahip: true, siniflar: ['9A', '10B'], odev_sayisi: 14, son_30_gun: 5, son_odev: '2026-09-30' },
  ],
};
const ANALIZ = {
  sinif: { id: '9a', ad: '9A' },
  aralik: { baslangic: '2026-07-13', bitis: '2026-10-03', varsayilan: true },
  esikler: { iyi: 70, calisilmali: 50, en_az_soru: 5 },
  mevcut: 28,
  ozet: {
    odev_sayisi: 5, test_sayisi: 4, gonderim: 110, ortalama: 72.5,
    iyi: ['Türev'], calisilmali: ['Limit'], en_eksik_uc: ['Limit', 'Türev'],
    konular: [
      { konu: 'Limit', toplam: 48, dogru: 15, oran: 31, durum: 'calisilmali' },
      { konu: 'Türev', toplam: 48, dogru: 44, oran: 92, durum: 'iyi' },
    ],
  },
  haftalar: [],
  aylar: [],
};
const ONAM = {
  sinif: { id: '9a', ad: '9A' }, surum: '2026-09', alindi: '2026-10-03T10:00:00Z',
  alan: 'Ayşe Kaya', toplam: 2, onayli: 1,
  satirlar: [
    { ogrenci_id: 'o1', ogrenci: 'Deniz Yalın', onam_var: true, veli_adi: 'Fatma Yalın', onay_zamani: '2026-09-11T09:15:00Z' },
    { ogrenci_id: 'o2', ogrenci: 'Kerem Aksu', onam_var: false, veli_adi: null, onay_zamani: null },
  ],
};
/** Müdür oturumunda çağrılabilecek uçlar — sunucudaki `izinli` ile aynı. */
const OKUMA_UCLARI = new Set(['giris', 'mudur_paneli', 'sinif_analizi', 'onam_dokumu', 'cikis']);

const tarayici = await chromium.launch();

async function sayfa({ oturum, yol, genislik = 390 }) {
  const s = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  const uclar = [];
  const govdeler = [];
  s.on('pageerror', (e) => olc(`sayfa hatası yok`, false, e.message));
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    uclar.push(uc);
    govdeler.push({ uc, govde: r.request().postData() });
    const govde =
      uc === 'giris' ? { rol: 'mudur', token: 'm'.repeat(64) }
      : uc === 'mudur_paneli' ? PANEL
      : uc === 'sinif_analizi' ? ANALIZ
      : uc === 'onam_dokumu' ? ONAM
      : uc === 'ben_kimim' ? { id: 's1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null }
      : uc === 'ogretmenler_listesi'
        ? [
            { id: 'g1', ad: 'Buket Topuzoğlu', sahip: true, aktif: true, pin_var: true, sinif_sayisi: 2, odev_sayisi: 14, son_gorulme: null, sinif_idler: [] },
            { id: 'g2', ad: 'Barış Atmaca', sahip: false, aktif: true, pin_var: true, sinif_sayisi: 1, odev_sayisi: 3, son_gorulme: null, sinif_idler: ['10b'] },
            { id: 'g3', ad: 'Ayşe Kaya', sahip: false, mudur: true, aktif: true, pin_var: true, sinif_sayisi: 0, odev_sayisi: 0, son_gorulme: null, sinif_idler: [] },
          ]
      : uc === 'mudur_ekle' ? { id: 'g4', ad: 'Yeni Müdür' }
      : uc === 'siniflar_listesi' ? []
      : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  if (oturum) {
    await s.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)), oturum);
  }
  await s.goto(KOK + yol, { waitUntil: 'networkidle' });
  await s.waitForTimeout(500);
  return { s, uclar, govdeler };
}
const metin = (s) => s.locator('body').innerText();
const MUDUR = { rol: 'mudur', token: 'm'.repeat(64) };

console.log('--- M1. Giriş ve sınıf özetleri ---');
{
  const { s, uclar } = await sayfa({ oturum: null, yol: '/' });
  await s.getByLabel('Giriş kodunuz').fill('482915');
  await s.getByLabel('Giriş kodunuz').press('Enter');
  await s.waitForTimeout(800);
  olc('giriş sonrası /mudur', s.url().endsWith('#/mudur'), s.url());
  const m = await metin(s);
  olc('başlıkta müdür adı ve "yalnız izleme"', m.includes('Ayşe Kaya') && m.includes('Müdür · yalnız izleme'));
  olc('9A kartı: 28 öğrenci, %84, ortalama', m.includes('9A') && m.includes('28') && m.includes('%84') && /72[,.]5/.test(m));
  olc('ödevi olmayan 10B: oran ve ortalama "—"', /10B[\s\S]*Gönderim oranı\s*—[\s\S]*Sınıf ortalaması\s*—/.test(m));
  olc('öğrenci adı yok', !m.includes('Deniz') && !m.includes('Kerem'));
  const yazmaDugmeleri = await s.getByRole('button', { name: /ekle|sil|kaydet|gönder|yayınla|düzelt|ata/i }).count();
  olc('yazma düğmesi yok', yazmaDugmeleri === 0, `${yazmaDugmeleri} düğme`);
  olc('yalnız okuma uçları çağrıldı', uclar.every((u) => OKUMA_UCLARI.has(u)), [...new Set(uclar)].join(', '));
  await s.close();
}

console.log('--- M2. Öğretmenler sekmesi ---');
{
  const { s } = await sayfa({ oturum: MUDUR, yol: '/mudur' });
  await s.getByRole('link', { name: 'Öğretmenler' }).first().click();
  await s.waitForTimeout(500);
  const m = await metin(s);
  olc('Barış Atmaca: 10B, 3 ödev, son 30 günde 2', /Barış Atmaca[\s\S]*10B[\s\S]*3\s*ödev yayınladı · son 30 günde 2/.test(m));
  olc('sahip etiketi', m.includes('Platform sahibi'));
  await s.close();
}

console.log('--- M3. Sınıf analizi ve onam dökümü, geri dönüş ---');
{
  const { s, govdeler } = await sayfa({ oturum: MUDUR, yol: '/mudur' });
  await s.getByRole('button', { name: 'Sınıf analizi' }).first().click();
  await s.waitForTimeout(700);
  olc('analiz adresi /mudur/sinif/9a', s.url().endsWith('#/mudur/sinif/9a'), s.url());
  const a = await metin(s);
  olc('analiz çizildi (Limit, Türev)', a.includes('Limit') && a.includes('Türev'));
  const g = JSON.parse(govdeler.find((x) => x.uc === 'sinif_analizi')?.govde ?? '{}');
  olc('müdür jetonuyla istendi', g.p_token === MUDUR.token && g.p_sinif_id === '9a');
  await s.getByRole('button', { name: '← Sınıflar' }).first().click();
  await s.waitForTimeout(500);
  olc('geri → /mudur', s.url().endsWith('#/mudur'), s.url());

  await s.getByRole('button', { name: 'Onam dökümü' }).first().click();
  await s.waitForTimeout(700);
  olc('onam adresi /mudur/sinif/9a/onam', s.url().endsWith('#/mudur/sinif/9a/onam'), s.url());
  const o = await metin(s);
  olc('onam durumu görünüyor', o.includes('Deniz Yalın') && o.includes('Kerem Aksu'));
  await s.getByRole('button', { name: '← Sınıflar' }).first().click();
  await s.waitForTimeout(500);
  olc('geri → /mudur', s.url().endsWith('#/mudur'), s.url());
  await s.close();
}

console.log('--- M4. Öğretmen adresi elle yazılırsa ---');
{
  for (const yol of ['/ogretmen', '/ogretmen/siniflar/9a', '/ogretmen/ogretmenler', '/veli']) {
    const { s, uclar } = await sayfa({ oturum: MUDUR, yol });
    olc(`${yol} → /mudur`, s.url().endsWith('#/mudur'), s.url());
    olc(`${yol}: yalnız okuma uçları`, uclar.every((u) => OKUMA_UCLARI.has(u)), [...new Set(uclar)].join(', '));
    await s.close();
  }
}

console.log('--- M5. Sahip: Müdür ekle ---');
{
  const { s, govdeler } = await sayfa({
    oturum: { rol: 'ogretmen', token: 't'.repeat(64) },
    yol: '/ogretmen/ogretmenler',
    genislik: 1024,
  });
  const m = await metin(s);
  olc('müdür satırında etiket', m.includes('Müdür · yalnız izler'));
  const satir = s.locator('div').filter({ hasText: 'Ayşe Kaya' }).filter({ has: s.getByRole('button') }).last();
  const satirMetni = await satir.innerText();
  olc('müdür satırında "Sınıfları" yok', !satirMetni.includes('Sınıfları'), satirMetni.replace(/\s+/g, ' '));
  olc('müdür satırında "Bu öğretmen olarak gir" yok', !satirMetni.includes('Bu öğretmen olarak gir'));
  olc('müdür satırında "PIN sıfırla" var', satirMetni.includes('PIN sıfırla'));
  olc('öğretmen satırında "Bu öğretmen olarak gir" duruyor', (await s.getByRole('button', { name: 'Bu öğretmen olarak gir' }).count()) === 1);

  await s.getByRole('button', { name: 'Müdür ekle' }).click();
  await s.waitForTimeout(300);
  const d = await s.getByRole('dialog').innerText();
  olc('pencere başlığı "Müdür ekle"', d.includes('Müdür ekle'));
  olc('pencere ne göreceğini yazıyor', d.includes('yalnız izler') && d.includes('Öğrenci puanlarını'));
  await s.getByRole('dialog').getByLabel('Ad soyad').fill('Yeni Müdür');
  await s.getByRole('dialog').getByLabel("Başlangıç PIN'i").fill('739204');
  await s.getByRole('dialog').getByRole('button', { name: 'Ekle' }).click();
  await s.waitForTimeout(600);
  const g = govdeler.find((x) => x.uc === 'mudur_ekle');
  olc('mudur_ekle çağrıldı', !!g && JSON.parse(g.govde).p_ad === 'Yeni Müdür');
  olc('ogretmen_ekle çağrılmadı', !govdeler.some((x) => x.uc === 'ogretmen_ekle'));

  // Aynı pencere öğretmen için açılınca eski kipte kalmamalı.
  await s.getByRole('button', { name: 'Öğretmen ekle' }).click();
  await s.waitForTimeout(300);
  const d2 = await s.getByRole('dialog').innerText();
  olc('"Öğretmen ekle" penceresinde müdür açıklaması yok', d2.includes('Öğretmen ekle') && !d2.includes('yalnız izler'));
  await s.close();
}

await tarayici.close();
console.log('');
if (hata) {
  console.log(`MÜDÜR DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('MÜDÜR DENETİMİ GEÇTİ');
