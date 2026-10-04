/**
 * MÜDÜR HESABI (Chromium, taklit RPC) — 0060 + 0061
 *
 * Öğretmen: "Müdür için hesap açmak istiyorum." Sonra (0061): "Kendi
 * kodunu değiştirebilsin. Ödevlerdeki soru sayısını görebilsin. Bugüne
 * kadar verilen toplam soru sayısı şube sınıf bazlı gösterilsin. Daha
 * detaylı analizler, gelişim grafikleri olsun. Öğrencilerin bireysel
 * notlarını da görsün."
 *
 * Asıl sınır sunucuda (`mudur_testleri.sql`); burada ekranın o sınırla
 * aynı şeyi söylediği ölçülüyor:
 *
 *  M1. PIN'le giriş → /mudur (Genel); yazma düğmesi yok; yalnız izinli uçlar.
 *  M2. Öğretmenler: sınıflar, ödev ve soru sayısı.
 *  M3. Sınıflar → Konu analizi ve Onam dökümü; "← Sınıf" o sınıfın sayfasına.
 *  M4. Öğretmen adresi elle yazılsa da müdür ekranına düşüyor.
 *  M5. Sahip → "Müdür ekle": `mudur_ekle`; müdür satırında vekâlet/sınıf yok,
 *      son giriş tarihi öğretmenlerdeki gibi var.
 *  M6. Genel: toplam soru, seviye kartları, aylık grafik (ay kadar nokta,
 *      boş ay çizilmiyor), şube çubukları, eksik konular, tablo görünümü.
 *  M7. Sınıflar kartında soru toplamı; sınıf sayfasında ödevlerin soru
 *      sayısı, öğrenci notları; öğrenci açılınca grafik ve "Gönderilmedi".
 *  M8. PIN: `mudur_pin_degistir` çağrılıyor; yeni PIN'ler uyuşmazsa
 *      sunucuya gidilmiyor; yanlış eski PIN'de (28000) oturum düşmüyor.
 *  M9. 360 px: yeni sayfalarda yatay taşma yok.
 *  M10. (0062) Sahip → "Müdür ekranını gör": müdürün hesabına girmeden,
 *      kendi oturumuyla müdür ekranı; önizleme şeridi; PIN sekmesi yok;
 *      sınıf → konu analizi → geri hep önizleme içinde; hiçbir yazma ucu
 *      ve `ogretmen_olarak_gir` çağrılmıyor; "← Öğretmenler" geri götürüyor.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/mudur-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
let hata = 0;
const olc = (ad, kosul, ayrinti = '') => {
  if (!kosul) hata++;
  console.log(`  ${kosul ? '✓' : '✗'} ${ad}${!kosul && ayrinti ? ` — ${ayrinti}` : ''}`);
};

const PANEL = {
  ad: 'Ayşe Kaya',
  yil_baslangici: '2026-09-01',
  okul: {
    sinif_sayisi: 2, ogrenci_sayisi: 59, odev_sayisi: 6, soru_toplami: 1240, soru_sayisiz: 1,
    gonderim_orani: 84, ortalama: 72.5,
  },
  seviyeler: [
    { seviye: 9, sinif_sayisi: 1, ogrenci_sayisi: 28, odev_sayisi: 6, soru_toplami: 1240, soru_sayisiz: 1, gonderim_orani: 84, ortalama: 72.5 },
    { seviye: 10, sinif_sayisi: 1, ogrenci_sayisi: 31, odev_sayisi: 0, soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null, ortalama: null },
  ],
  siniflar: [
    {
      id: '9a', ad: '9A', seviye: 9, ogretmenler: ['Buket Topuzoğlu'], ogrenci_sayisi: 28,
      odev_sayisi: 6, suresi_dolan: 5, soru_toplami: 1240, soru_sayisiz: 1, gonderim_orani: 84, ortalama: 72.5, son_odev: '2026-09-30',
    },
    {
      id: '10b', ad: '10B', seviye: 10, ogretmenler: ['Barış Atmaca', 'Buket Topuzoğlu'], ogrenci_sayisi: 31,
      odev_sayisi: 0, suresi_dolan: 0, soru_toplami: 0, soru_sayisiz: 0, gonderim_orani: null, ortalama: null, son_odev: null,
    },
  ],
  aylar: [
    { ay: '2026-09-01', odev_sayisi: 4, soru_toplami: 800, gonderim_orani: 88, ortalama: 70 },
    { ay: '2026-10-01', odev_sayisi: 0, soru_toplami: 0, gonderim_orani: null, ortalama: null },
    { ay: '2026-11-01', odev_sayisi: 2, soru_toplami: 440, gonderim_orani: 80, ortalama: 75.5 },
  ],
  eksik_konular: [
    { konu: 'Limit', toplam: 48, dogru: 15, oran: 31 },
    { konu: 'Üslü Sayılar', toplam: 24, dogru: 14, oran: 58 },
  ],
  ogretmenler: [
    { ad: 'Barış Atmaca', sahip: false, siniflar: ['10B'], odev_sayisi: 3, soru_toplami: 75, son_30_gun: 2, son_odev: '2026-09-28' },
    { ad: 'Buket Topuzoğlu', sahip: true, siniflar: ['9A', '10B'], odev_sayisi: 14, soru_toplami: 1240, son_30_gun: 5, son_odev: '2026-09-30' },
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
const CIZELGE = {
  sinif: { id: '9a', ad: '9A', ogretmenler: ['Buket Topuzoğlu'] },
  mevcut: 2,
  odevler: [
    { id: 'd1', baslik: 'Sayılar testi', tur: 'test', ogretmen: 'Buket Topuzoğlu', soru_sayisi: 20, son_tarih: '2026-09-10', sure_doldu: true, gonderim: 2, ortalama: 75 },
    { id: 'd2', baslik: 'Kümeler testi', tur: 'test', ogretmen: 'Buket Topuzoğlu', soru_sayisi: 25, son_tarih: '2026-09-24', sure_doldu: true, gonderim: 1, ortalama: 90 },
    { id: 'd3', baslik: 'Açık uçlu ödev', tur: 'acik', ogretmen: 'Buket Topuzoğlu', soru_sayisi: null, son_tarih: '2026-12-01', sure_doldu: false, gonderim: 0, ortalama: null },
  ],
  ogrenciler: [
    {
      id: 'o1', ad: 'Deniz Yalın', ogrenci_no: '101', ortalama: 85, yapilan: 2, yapilmayan: 0,
      puanlar: [
        { odev_id: 'd1', puan: 80, durum: 'gonderdi' },
        { odev_id: 'd2', puan: 90, durum: 'gonderdi' },
        { odev_id: 'd3', puan: null, durum: 'suresi_devam' },
      ],
    },
    {
      id: 'o2', ad: 'Kerem Aksu', ogrenci_no: '102', ortalama: 35, yapilan: 1, yapilmayan: 1,
      puanlar: [
        { odev_id: 'd1', puan: 70, durum: 'gonderdi' },
        { odev_id: 'd2', puan: null, durum: 'gondermedi' },
        { odev_id: 'd3', puan: null, durum: 'suresi_devam' },
      ],
    },
  ],
  aylar: [
    { ay: '2026-09-01', odev_sayisi: 2, ortalama: 80, gonderim_orani: 75 },
    { ay: '2026-10-01', odev_sayisi: 0, ortalama: null, gonderim_orani: null },
  ],
};
/** Müdür oturumunda çağrılabilecek uçlar — sunucudaki `izinli` ile aynı. */
const MUDUR_UCLARI = new Set([
  'giris', 'mudur_paneli', 'sinif_analizi', 'onam_dokumu', 'sinif_not_cizelgesi',
  'mudur_pin_degistir', 'cikis',
]);

const tarayici = await chromium.launch();

async function sayfa({ oturum, yol, genislik = 390, pinYaniti = null }) {
  const s = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  const uclar = [];
  const govdeler = [];
  s.on('pageerror', (e) => olc('sayfa hatası yok', false, e.message));
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    uclar.push(uc);
    govdeler.push({ uc, govde: r.request().postData() });
    if (uc === 'mudur_pin_degistir' && pinYaniti) {
      return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(pinYaniti) });
    }
    const govde =
      uc === 'giris' ? { rol: 'mudur', token: 'm'.repeat(64) }
      : uc === 'mudur_paneli' ? PANEL
      : uc === 'sinif_analizi' ? ANALIZ
      : uc === 'onam_dokumu' ? ONAM
      : uc === 'sinif_not_cizelgesi' ? CIZELGE
      : uc === 'mudur_pin_degistir' ? { durum: 'tamam' }
      : uc === 'ben_kimim' ? { id: 's1', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null }
      : uc === 'ogretmenler_listesi'
        ? [
            { id: 'g1', ad: 'Buket Topuzoğlu', sahip: true, aktif: true, pin_var: true, sinif_sayisi: 2, odev_sayisi: 14, son_gorulme: null, sinif_idler: [] },
            { id: 'g2', ad: 'Barış Atmaca', sahip: false, aktif: true, pin_var: true, sinif_sayisi: 1, odev_sayisi: 3, son_gorulme: null, sinif_idler: ['10b'] },
            { id: 'g3', ad: 'Ayşe Kaya', sahip: false, mudur: true, aktif: true, pin_var: true, sinif_sayisi: 0, odev_sayisi: 0, son_gorulme: '2026-10-02T09:00:00Z', sinif_idler: [] },
          ]
      : uc === 'mudur_ekle' ? { id: 'g4', ad: 'Yeni Müdür' }
      : uc === 'siniflar_listesi' ? []
      : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
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
const yalnizMudurUclari = (uclar) => uclar.every((u) => MUDUR_UCLARI.has(u));
const YAZMA = /ekle|sil|kaydet|gönder|yayınla|düzelt|ata\b|puanla/i;

console.log('--- M1. Giriş → Genel ---');
{
  const { s, uclar } = await sayfa({ oturum: null, yol: '/' });
  await s.getByLabel('Giriş kodunuz').fill('482915');
  await s.getByLabel('Giriş kodunuz').press('Enter');
  await s.waitForTimeout(800);
  olc('giriş sonrası /mudur', s.url().endsWith('#/mudur'), s.url());
  const m = await metin(s);
  olc('başlıkta müdür adı ve "yalnız izleme"', m.includes('Ayşe Kaya') && m.includes('Müdür · yalnız izleme'));
  olc('Genel bakış açıldı', m.includes('Genel bakış'));
  const n = await s.getByRole('button', { name: YAZMA }).count();
  olc('yazma düğmesi yok', n === 0, `${n} düğme`);
  olc('yalnız müdür uçları', yalnizMudurUclari(uclar), [...new Set(uclar)].join(', '));
  olc('pano bir kez çekildi (kabuk paylaşıyor)', uclar.filter((u) => u === 'mudur_paneli').length === 1, String(uclar.filter((u) => u === 'mudur_paneli').length));
  await s.close();
}

console.log('--- M2. Öğretmenler ---');
{
  const { s, uclar } = await sayfa({ oturum: MUDUR, yol: '/mudur' });
  await s.getByRole('link', { name: 'Öğretmenler' }).first().click();
  await s.waitForTimeout(500);
  const m = await metin(s);
  olc('Barış Atmaca: 10B, 3 ödev, 75 soru, son 30 günde 2 ödev', /Barış Atmaca[\s\S]*10B[\s\S]*3\s*ödev · 75\s*soru · son 30 günde 2\s*ödev/.test(m), m.slice(0, 500));
  olc('Buket: 1.240 soru', /1\.240\s*soru/.test(m));
  olc('sahip etiketi', m.includes('Platform sahibi'));
  olc('sekme değişince pano yeniden çekilmedi', uclar.filter((u) => u === 'mudur_paneli').length === 1);
  await s.close();
}

console.log('--- M3. Konu analizi ve onam dökümü, geri dönüş ---');
{
  const { s, govdeler } = await sayfa({ oturum: MUDUR, yol: '/mudur/siniflar' });
  await s.getByRole('button', { name: 'Konu analizi' }).first().click();
  await s.waitForTimeout(700);
  olc('analiz adresi /mudur/siniflar/9a/analiz', s.url().endsWith('#/mudur/siniflar/9a/analiz'), s.url());
  const a = await metin(s);
  olc('analiz çizildi (Limit, Türev)', a.includes('Limit') && a.includes('Türev'));
  const g = JSON.parse(govdeler.find((x) => x.uc === 'sinif_analizi')?.govde ?? '{}');
  olc('müdür jetonuyla istendi', g.p_token === MUDUR.token && g.p_sinif_id === '9a');
  await s.getByRole('button', { name: '← Sınıf' }).first().click();
  await s.waitForTimeout(600);
  olc('geri → /mudur/siniflar/9a', s.url().endsWith('#/mudur/siniflar/9a'), s.url());

  await s.getByRole('button', { name: 'Onam dökümü' }).first().click();
  await s.waitForTimeout(700);
  olc('onam adresi /mudur/siniflar/9a/onam', s.url().endsWith('#/mudur/siniflar/9a/onam'), s.url());
  const o = await metin(s);
  olc('onam durumu görünüyor', o.includes('Deniz Yalın') && o.includes('Kerem Aksu'));
  await s.getByRole('button', { name: '← Sınıf' }).first().click();
  await s.waitForTimeout(500);
  olc('geri → /mudur/siniflar/9a', s.url().endsWith('#/mudur/siniflar/9a'), s.url());
  await s.close();
}

console.log('--- M4. Öğretmen adresi elle yazılırsa ---');
{
  for (const yol of ['/ogretmen', '/ogretmen/siniflar/9a', '/ogretmen/ogretmenler', '/veli']) {
    const { s, uclar } = await sayfa({ oturum: MUDUR, yol });
    olc(`${yol} → /mudur`, s.url().endsWith('#/mudur'), s.url());
    olc(`${yol}: yalnız müdür uçları`, yalnizMudurUclari(uclar), [...new Set(uclar)].join(', '));
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
  olc('müdürün son girişi görünüyor (öğretmenler gibi)', satirMetni.includes('son giriş 02.10.2026'), satirMetni.replace(/\s+/g, ' '));
  olc('öğretmen satırında "Bu öğretmen olarak gir" duruyor', (await s.getByRole('button', { name: 'Bu öğretmen olarak gir' }).count()) === 1);

  await s.getByRole('button', { name: 'Müdür ekle' }).click();
  await s.waitForTimeout(300);
  const d = await s.getByRole('dialog').innerText();
  olc('pencere başlığı "Müdür ekle"', d.includes('Müdür ekle'));
  olc('pencere ne göreceğini yazıyor', d.includes('yalnız izler') && d.includes('öğrencilerin notlarını') && d.includes('Cevapları'));
  await s.getByRole('dialog').getByLabel('Ad soyad').fill('Yeni Müdür');
  await s.getByRole('dialog').getByLabel("Başlangıç PIN'i").fill('739204');
  await s.getByRole('dialog').getByRole('button', { name: 'Ekle' }).click();
  await s.waitForTimeout(600);
  const g = govdeler.find((x) => x.uc === 'mudur_ekle');
  olc('mudur_ekle çağrıldı', !!g && JSON.parse(g.govde).p_ad === 'Yeni Müdür');
  olc('ogretmen_ekle çağrılmadı', !govdeler.some((x) => x.uc === 'ogretmen_ekle'));

  await s.getByRole('button', { name: 'Öğretmen ekle' }).click();
  await s.waitForTimeout(300);
  const d2 = await s.getByRole('dialog').innerText();
  olc('"Öğretmen ekle" penceresinde müdür açıklaması yok', d2.includes('Öğretmen ekle') && !d2.includes('yalnız izler'));
  await s.close();
}

console.log('--- M6. Genel: soru toplamı, seviyeler, grafik, konular ---');
{
  const { s } = await sayfa({ oturum: MUDUR, yol: '/mudur', genislik: 1024 });
  const m = await metin(s);
  olc('Toplam soru kutucuğu 1.240', /Toplam soru\s*1\.240/.test(m), m.slice(0, 400));
  olc('soru sayısı girilmemiş ödev notu', m.includes('+1 ödevde soru sayısı yok'));
  olc('okul gönderim ve ortalama', m.includes('%84') && /72,5/.test(m));
  olc('seviye kartları: 9. ve 10. sınıflar', m.includes('9. sınıflar') && m.includes('10. sınıflar'));
  olc('9. sınıflar toplam soru 1.240', /9\. sınıflar[\s\S]*?Toplam soru\s*1\.240/.test(m));
  const grafik = s.getByRole('img', { name: /Okulun aylık ortalaması/ });
  olc('aylık grafik çizildi', (await grafik.count()) === 1);
  const ortNokta = await grafik.locator('g[data-seri="Ortalama"] circle[data-nokta]').count();
  olc('ortalama: 3 aydan 2 nokta (boş ay çizilmiyor)', ortNokta === 2, String(ortNokta));
  const yol = await grafik.locator('g[data-seri="Ortalama"] path').getAttribute('d');
  olc('boş ay çizgiyi kesiyor (iki ayrı parça)', (yol.match(/M/g) ?? []).length === 2, yol);
  olc('lejant iki seri', m.includes('Ortalama') && m.includes('Gönderim oranı'));
  await grafik.hover({ position: { x: 40, y: 100 } });
  await s.waitForTimeout(200);
  olc('üstüne gelince ipucu: Eylül 2026', (await metin(s)).includes('Eylül 2026'));
  await s.getByText('Tablo olarak gör').first().click();
  const tablo = await s.locator('table').first().innerText();
  olc('tablo görünümünde ay, ödev ve soru', /Kasım 2026\s*75,5\s*%80\s*2\s*440/.test(tablo), tablo);
  olc('şube çubukları ve eksik konular', m.includes('Şubelerin ortalaması') && m.includes('Limit') && m.includes('doğru: 15 / 48 cevap'));
  await s.close();
}

console.log('--- M7. Sınıflar ve sınıf sayfası: soru sayıları, öğrenci notları ---');
{
  const { s, uclar } = await sayfa({ oturum: MUDUR, yol: '/mudur/siniflar' });
  const m = await metin(s);
  olc('9A kartında toplam soru 1.240', /9A[\s\S]*Toplam soru\s*1\.240/.test(m));
  await s.getByRole('button', { name: 'Sınıfı aç' }).first().click();
  await s.waitForTimeout(700);
  olc('sınıf adresi /mudur/siniflar/9a', s.url().endsWith('#/mudur/siniflar/9a'), s.url());
  olc('Sınıflar sekmesi etkin kalıyor', (await s.getByRole('link', { name: 'Sınıflar' }).first().getAttribute('aria-current')) === 'page');
  const k = await metin(s);
  olc('ödev başlığında toplam: 3 ödev · 45 soru', /3\s*ödev · 45\s*soru/.test(k), k.slice(0, 600));
  olc('ödev satırında soru sayısı (20 soru, 25 soru)', k.includes('20 soru') && k.includes('25 soru'));
  olc('süresi sürmekte olan ödev işaretli', k.includes('süresi sürüyor'));
  olc('öğrenci notları: Deniz 85, Kerem 35', /Deniz Yalın[\s\S]*?85/.test(k) && /Kerem Aksu[\s\S]*?35/.test(k));
  olc('ortalama kuralı yazıyor', k.includes('gönderilmeyen ödev 0 sayılır'));
  olc('cevap/yorum yok', !/cevap anahtar|yorum/i.test(k));
  await s.getByRole('button', { name: /Kerem Aksu/ }).click();
  await s.waitForTimeout(300);
  const d = await metin(s);
  olc('Kerem açıldı: Gönderilmedi görünüyor', d.includes('Gönderilmedi'));
  olc('Kerem: süresi süren ödev notu', d.includes('ödevin süresi sürüyor'));
  const g = s.getByRole('img', { name: /Kerem Aksu ödev puanları/ });
  olc('Kerem grafiği: 2 ödevden 1 nokta', (await g.count()) === 1 && (await g.locator('circle[data-nokta]').count()) === 1);
  olc('aria-expanded', (await s.getByRole('button', { name: /Kerem Aksu/ }).getAttribute('aria-expanded')) === 'true');
  olc('yalnız müdür uçları', yalnizMudurUclari(uclar), [...new Set(uclar)].join(', '));
  await s.close();
}

console.log('--- M8. PIN değiştir ---');
{
  const { s, govdeler } = await sayfa({ oturum: MUDUR, yol: '/mudur' });
  await s.getByRole('link', { name: 'PIN' }).first().click();
  await s.waitForTimeout(400);
  olc('PIN sayfası /mudur/ayarlar', s.url().endsWith('#/mudur/ayarlar'));
  await s.getByLabel('Mevcut PIN').fill('Mudur!Okul26');
  await s.getByLabel('Yeni PIN').first().fill('Yeni!Pin26');
  await s.getByLabel('Yeni PIN tekrar').fill('Baska!Pin26');
  await s.getByRole('button', { name: 'PIN’i değiştir' }).click();
  await s.waitForTimeout(300);
  olc('uyuşmazsa sunucuya gidilmiyor', !govdeler.some((x) => x.uc === 'mudur_pin_degistir'));
  await s.getByLabel('Yeni PIN tekrar').fill('Yeni!Pin26');
  await s.getByRole('button', { name: 'PIN’i değiştir' }).click();
  await s.waitForTimeout(500);
  const g = govdeler.find((x) => x.uc === 'mudur_pin_degistir');
  const gv = g ? JSON.parse(g.govde) : {};
  olc('mudur_pin_degistir çağrıldı', gv.p_eski === 'Mudur!Okul26' && gv.p_yeni === 'Yeni!Pin26');
  olc('pin_degistir (öğretmen ucu) çağrılmadı', !govdeler.some((x) => x.uc === 'pin_degistir'));
  olc('başarı mesajı', (await metin(s)).includes('PIN’iniz değişti'));
  await s.close();

  const y = await sayfa({
    oturum: MUDUR,
    yol: '/mudur/ayarlar',
    pinYaniti: { code: '28000', message: 'Mevcut PIN doğru değil.' },
  });
  await y.s.getByLabel('Mevcut PIN').fill('yanlis-pin');
  await y.s.getByLabel('Yeni PIN').first().fill('Yeni!Pin26');
  await y.s.getByLabel('Yeni PIN tekrar').fill('Yeni!Pin26');
  await y.s.getByRole('button', { name: 'PIN’i değiştir' }).click();
  await y.s.waitForTimeout(500);
  const ym = await metin(y.s);
  olc('yanlış eski PIN: mesaj var, oturum düşmedi', ym.includes('Mevcut PIN doğru değil.') && y.s.url().endsWith('#/mudur/ayarlar') && !ym.includes('Giriş kodunuz'));
  await y.s.close();
}

console.log('--- M10. Sahibin önizlemesi ---');
{
  const { s, uclar } = await sayfa({
    oturum: { rol: 'ogretmen', token: 't'.repeat(64) },
    yol: '/ogretmen/ogretmenler',
    genislik: 1024,
  });
  olc('"Müdür ekranını gör" yalnız müdür satırında', (await s.getByRole('button', { name: 'Müdür ekranını gör' }).count()) === 1);
  await s.getByRole('button', { name: 'Müdür ekranını gör' }).click();
  await s.waitForTimeout(700);
  olc('adres /ogretmen/mudur-onizleme', s.url().endsWith('#/ogretmen/mudur-onizleme'), s.url());
  const m = await metin(s);
  olc('önizleme şeridi', m.includes('Müdürün gördüğü ekranın aynısı') && m.includes('müdürün hesabına girilmedi'));
  olc('müdür Genel ekranı (1.240 soru)', m.includes('Genel bakış') && /Toplam soru\s*1\.240/.test(m));
  olc('PIN sekmesi yok, Çıkış yok', (await s.getByRole('link', { name: 'PIN' }).count()) === 0 && (await s.getByRole('button', { name: 'Çıkış' }).count()) === 0);
  await s.getByRole('link', { name: 'Sınıflar' }).first().click();
  await s.waitForTimeout(400);
  await s.getByRole('button', { name: 'Sınıfı aç' }).first().click();
  await s.waitForTimeout(600);
  olc('sınıf önizlemede açıldı', s.url().endsWith('#/ogretmen/mudur-onizleme/siniflar/9a'), s.url());
  olc('öğrenci notları görünüyor', (await metin(s)).includes('Deniz Yalın'));
  await s.getByRole('button', { name: 'Konu analizi' }).click();
  await s.waitForTimeout(600);
  olc('konu analizi önizlemede', s.url().endsWith('#/ogretmen/mudur-onizleme/siniflar/9a/analiz'), s.url());
  await s.getByRole('button', { name: '← Sınıf' }).first().click();
  await s.waitForTimeout(500);
  olc('geri → önizlemedeki sınıf', s.url().endsWith('#/ogretmen/mudur-onizleme/siniflar/9a'), s.url());
  await s.getByRole('button', { name: '← Öğretmenler' }).click();
  await s.waitForTimeout(500);
  olc('"← Öğretmenler" sahibin ekranına döndürüyor', s.url().endsWith('#/ogretmen/ogretmenler'), s.url());
  const yazan = uclar.filter((u) => /ekle|sil|guncelle|_ata|gonder|yayinla|puanla|degistir|olarak_gir/.test(u));
  olc('hiçbir yazma ucu ve vekâlet çağrılmadı', yazan.length === 0, yazan.join(', '));
  await s.close();
}

console.log('--- M9. 360 px yatay taşma ---');
{
  for (const yol of ['/mudur', '/mudur/siniflar', '/mudur/siniflar/9a', '/mudur/ogretmenler', '/mudur/ayarlar']) {
    const s = await tarayici.newPage({ viewport: { width: 360, height: 800 } });
    await s.route('**/rest/v1/rpc/*', (r) => {
      const uc = r.request().url().split('/').pop().split('?')[0];
      const govde = uc === 'mudur_paneli' ? PANEL : uc === 'sinif_not_cizelgesi' ? CIZELGE : {};
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
    });
    await s.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)), MUDUR);
    await s.goto(KOK + yol, { waitUntil: 'networkidle' });
    await s.waitForTimeout(400);
    if (yol.endsWith('9a')) {
      await s.getByRole('button', { name: /Deniz Yalın/ }).click();
      await s.waitForTimeout(200);
    }
    const tasma = await s.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    olc(`${yol}: taşma yok`, tasma <= 0, `${tasma}px`);
    await s.close();
  }
}

await tarayici.close();
console.log('');
if (hata) {
  console.log(`MÜDÜR DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('MÜDÜR DENETİMİ GEÇTİ');
