// Faz 2C — öğrenci ekranlarının görsel denetimi.
//
// RPC yanıtları taklit ediliyor: canlı veriye gönderim yapmadan üç durumu da
// (bekleyen test, süresi kapanmış ödev, teslim edilmiş ödev) aynı anda
// görebilmek için. Taklit, sunucunun GERÇEK sözleşmesine sadık — cevap
// anahtarı yalnız gönderimi olan ödevde dolu.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const bugun = new Date();
const gun = (n) => {
  const d = new Date(bugun);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const ODEVLER = [
  {
    id: 'a1', baslik: 'Türev testi — sayfa 84', aciklama: 'Sadece 1–20 arası sorular.',
    tur: 'test', son_tarih: gun(2), soru_sayisi: 10, gec_teslim: true, sik_sayisi: 5,
    odev_yolu: 'odev/x/sorular.pdf', gonderim: null,
    cevap_anahtari: null, anahtar_yolu: null,
  },
  {
    id: 'a2', baslik: 'Limit — açık uçlu', aciklama: null,
    tur: 'acik', son_tarih: gun(-2), soru_sayisi: null, gec_teslim: false, sik_sayisi: 5,
    odev_yolu: 'odev/y/sorular.pdf', gonderim: null,
    cevap_anahtari: null, anahtar_yolu: null,
  },
  {
    id: 'a3', baslik: 'Üslü ve Köklü Sayılar', aciklama: null,
    tur: 'test', son_tarih: gun(-6), soru_sayisi: 10, gec_teslim: true, sik_sayisi: 4,
    odev_yolu: 'odev/z/sorular.pdf',
    gonderim: {
      id: 'g1', zaman: gun(-7), durum: 'puanlandi', dogru: 8, yanlis: 1, bos: 1,
      puan: 80, ogretmen_puan: null, ogretmen_yorum: 'Üçüncü soruda işlem hatası var, tekrar bak.',
      cevaplar: { 1: 'A', 2: 'C', 3: 'D', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'A', 9: 'D' },
      gecikmeli: true,
    },
    cevap_anahtari: { 1: 'A', 2: 'C', 3: 'B', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'A', 9: 'D', 10: 'B' },
    anahtar_yolu: 'odev/z/anahtar.pdf',
  },
];

const OTURUM = {
  rol: 'ogrenci',
  token: 't'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Elif Yıldırım', tur: 'okul', sinif: '11B' },
};

const CEVAP = {
  ogrenci_odevleri: {
    ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '11B' },
    odevler: ODEVLER,
    dersler: [],
  },
};

const b = await chromium.launch();
async function cek(ad, genislik, yol) {
  const p = await b.newPage({ viewport: { width: genislik, height: 900 }, deviceScaleFactor: 2 });
  await p.route('**/rest/v1/rpc/*', async (route) => {
    const fn = route.request().url().split('/').pop().split('?')[0];
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(CEVAP[fn] ?? {}),
    });
  });
  await p.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)), OTURUM);
  await p.goto('http://127.0.0.1:8788/yeni/#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const tasma = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const kucukHedef = await p.evaluate(() =>
    [...document.querySelectorAll('button, a, input, select')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.height < 36 || r.width < 36);
    }).length,
  );
  await p.screenshot({ path: `/tmp/f2c-${ad}.png`, fullPage: true });
  console.log(`${ad.padEnd(24)} ${String(genislik).padStart(4)}px  tasma=${tasma}px  kucukHedef=${kucukHedef}`);
  await p.close();
}

await cek('odevlerim-360', 360, '/ogrenci');
await cek('teslim-test-360', 360, '/ogrenci/odev/a1');
await cek('teslim-kapali-360', 360, '/ogrenci/odev/a2');
await cek('teslim-sonuc-360', 360, '/ogrenci/odev/a3');
await cek('odevlerim-1280', 1280, '/ogrenci');
await cek('teslim-test-1280', 1280, '/ogrenci/odev/a1');
await cek('teslim-sonuc-1280', 1280, '/ogrenci/odev/a3');
await b.close();
