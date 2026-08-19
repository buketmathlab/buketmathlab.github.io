/**
 * Tanıtım sayfasının ekran görüntüleri (Faz 9).
 *
 * GERÇEK ÖĞRENCİ VERİSİ HİÇBİR KOŞULDA KULLANILMAZ. Uygulama gerçek
 * sunucuya hiç bağlanmıyor: bütün RPC çağrıları burada kesilip aşağıdaki
 * UYDURMA veriyle cevaplanıyor. Adlar da puanlar da uydurma ve tanıtım
 * sayfası bunu okuyucuya ayrıca yazıyor.
 *
 * ÇALIŞTIRMA (depo kökünden):
 *   npm --prefix app run build
 *   setsid npx --prefix app http-server -p 8788 -s . > /tmp/hs.log 2>&1 < /dev/null &
 *   node app/scripts/tanitim-gorselleri.mjs
 *
 * Çıktı: app/public/tanitim-ekranlar/*.webp — 780×1520 (390×760 @2x).
 * Ölçüler `pages/Tanitim.tsx`'teki `Ekran` bileşeninin width/height
 * öznitelikleriyle BİREBİR aynı olmalı; burada değişirse orada da değişir,
 * yoksa sayfa okunurken metin zıplar.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import { mkdir, rm } from 'node:fs/promises';

const KOK = new URL('../public/tanitim-ekranlar/', import.meta.url);
const ADRES = 'http://127.0.0.1:8788/yeni/';

const GENISLIK = 390;
const YUKSEKLIK = 760;
const OLCEK = 2;

/* ---------- UYDURMA VERİ ---------- */

/**
 * Tarihler ÇEKİM ANINA göreli.
 *
 * İlk denemede sabit bir gün yazmıştım ve ekran görüntüsünde "87 gün
 * kaldı" çıktı: etiketleri uygulama gerçek saate göre hesaplıyor, benim
 * sabit tarihim ise aylar ötedeydi. İki gün sonrası için "87 gün kaldı"
 * yazan bir ekran, ürünü bozuk gösterir.
 *
 * Göreli üretince görüntü "2 gün kaldı" diyor ve bu, donmuş bir resimde
 * kalıcı olarak makul kalıyor.
 */
const bugun = new Date();
const gun = (fark) => new Date(bugun.getTime() + fark * 86400000).toISOString().slice(0, 10);
const an = (fark) => new Date(bugun.getTime() + fark * 3600000).toISOString();

const OGRENCI_ODEVLERI = {
  ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '10C', tur: 'okul' },
  okunmamis_mesaj: 1,
  dersler: [],
  odevler: [
    {
      id: 'd1',
      baslik: 'Üslü ve Köklü Sayılar — Değerlendirme',
      aciklama: null,
      tur: 'test',
      son_tarih: gun(2),
      soru_sayisi: 10,
      gec_teslim: true,
      sik_sayisi: 5,
      sinif_arsiv: false,
      odev_yolu: 'odev/d1.pdf',
      gonderim: null,
      konu_analizi: [],
      cevap_anahtari: null,
      anahtar_yolu: null,
    },
    {
      id: 'd2',
      baslik: 'Fonksiyonlar — çalışma kâğıdı',
      aciklama: null,
      tur: 'acik',
      son_tarih: gun(5),
      soru_sayisi: null,
      gec_teslim: true,
      sik_sayisi: 4,
      sinif_arsiv: false,
      odev_yolu: 'odev/d2.pdf',
      gonderim: null,
      konu_analizi: [],
      cevap_anahtari: null,
      anahtar_yolu: null,
    },
    {
      id: 'd3',
      baslik: 'Mutlak Değer — test',
      aciklama: null,
      tur: 'test',
      son_tarih: gun(-3),
      soru_sayisi: 12,
      gec_teslim: false,
      sik_sayisi: 5,
      sinif_arsiv: false,
      odev_yolu: 'odev/d3.pdf',
      gonderim: {
        id: 'g3',
        zaman: an(-70),
        durum: 'onaylandi',
        dogru: 10,
        yanlis: 2,
        bos: 0,
        puan: 83,
        ogretmen_puan: null,
        ogretmen_yorum: null,
        cevaplar: {},
        gecikmeli: false,
      },
      konu_analizi: [],
      cevap_anahtari: null,
      anahtar_yolu: null,
    },
    {
      id: 'd4',
      baslik: 'Denklemler — açık uçlu',
      aciklama: null,
      tur: 'acik',
      son_tarih: gun(-8),
      soru_sayisi: null,
      gec_teslim: true,
      sik_sayisi: 4,
      sinif_arsiv: false,
      odev_yolu: 'odev/d4.pdf',
      gonderim: {
        id: 'g4',
        zaman: an(-190),
        durum: 'incelemede',
        dogru: null,
        yanlis: null,
        bos: null,
        puan: null,
        ogretmen_puan: null,
        ogretmen_yorum: null,
        cevaplar: {},
        gecikmeli: false,
      },
      konu_analizi: [],
      cevap_anahtari: null,
      anahtar_yolu: null,
    },
  ],
};

const OGRETMEN_PANOSU = {
  ogrenci_sayisi: 137,
  odev_verilen_ogrenci: 124,
  acik_odev: 4,
  bekleyen_degerlendirme: 6,
  gecikmis_eksik: 11,
  son_gonderimler: [
    { ogrenci: 'Elif Yıldırım', odev: 'Mutlak Değer — test', puan: 83, zaman: an(-2), gecikmeli: false },
    { ogrenci: 'Mert Çağlar', odev: 'Mutlak Değer — test', puan: 71, zaman: an(-5), gecikmeli: false },
    { ogrenci: 'Zeynep Şahin', odev: 'Denklemler — açık uçlu', puan: null, zaman: an(-9), gecikmeli: true },
    { ogrenci: 'Ahmet Öztürk', odev: 'Mutlak Değer — test', puan: 95, zaman: an(-20), gecikmeli: false },
  ],
};

const VELI_PANELI = {
  ogrenci: { ad: 'Elif Yıldırım', sinif: '10C', tur: 'okul' },
  okunmamis_mesaj: 1,
  son_gorulme: an(-3),
  odemeler: [],
  mesajlar: [
    {
      kimden: 'ogretmen',
      metin: 'Elif son iki ödevini de zamanında gönderdi, mutlak değerde çok iyi gidiyor.',
      zaman: an(-26),
    },
  ],
  odevler: [
    {
      baslik: 'Mutlak Değer — test',
      son_tarih: gun(-3),
      olusturma: gun(-10),
      gonderildi: true,
      gonderim_zamani: an(-70),
      puan: 83,
      durum: 'onaylandi',
      konu_analizi: [],
      yanlis_sorular: [4, 9],
      bos_sorular: [],
    },
    {
      baslik: 'Denklemler — açık uçlu',
      son_tarih: gun(-8),
      olusturma: gun(-15),
      gonderildi: true,
      gonderim_zamani: an(-190),
      puan: null,
      durum: 'incelemede',
      konu_analizi: [],
      yanlis_sorular: [],
      bos_sorular: [],
    },
    {
      baslik: 'Üslü ve Köklü Sayılar — Değerlendirme',
      son_tarih: gun(2),
      olusturma: gun(-2),
      gonderildi: false,
      gonderim_zamani: null,
      puan: null,
      durum: null,
      konu_analizi: [],
      yanlis_sorular: [],
      bos_sorular: [],
    },
  ],
};

const CEVAPLAR = {
  ogrenci_odevleri: OGRENCI_ODEVLERI,
  ogretmen_panosu: OGRETMEN_PANOSU,
  veli_paneli: VELI_PANELI,
  bildirim_sayilari: { okunmamis_mesaj: 2, puan_bekleyen: 6 },
};

/* ---------- ÇEKİM ---------- */

await rm(KOK, { recursive: true, force: true });
await mkdir(KOK, { recursive: true });

const tarayici = await chromium.launch();

async function cek(dosya, yol, oturum) {
  const sayfa = await tarayici.newPage({
    viewport: { width: GENISLIK, height: YUKSEKLIK },
    deviceScaleFactor: OLCEK,
  });

  /* HİÇBİR İSTEK GERÇEK SUNUCUYA GİTMİYOR — ve bu ÖLÇÜLÜYOR.
   *
   * İlk denemede bunu `sayfa.on('request')` ile saymıştım ve denetim
   * "2 gerçek istek" dedi. Ölçüm yanlıştı: `request` olayı `route.fulfill()`
   * ile karşılanan istekler için de tetikleniyor, oysa o istekler
   * tarayıcıdan hiç çıkmıyor.
   *
   * Doğru ölçüm iki katmanlı. Playwright yönlendirmeleri KAYIT SIRASININ
   * TERSİNDEN eşleştirdiği için önce yakalayıcı, sonra RPC yolu
   * kaydediliyor: RPC istekleri sahte cevabı alıyor, Supabase'e giden
   * BAŞKA her istek yakalayıcıya düşüp iptal ediliyor ve sayılıyor.
   */
  let sahteCevap = 0;
  let kacak = 0;

  await sayfa.route('**/*supabase.co/**', async (rota) => {
    kacak += 1;
    await rota.abort();
  });
  await sayfa.route('**/rest/v1/rpc/*', async (rota) => {
    const uc = rota.request().url().split('/').pop().split('?')[0];
    sahteCevap += 1;
    await rota.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CEVAPLAR[uc] ?? {}),
    });
  });

  await sayfa.addInitScript((o) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(o));
  }, oturum);

  await sayfa.goto(ADRES + '#' + yol, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(1200);

  const tasma = await sayfa.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  const png = await sayfa.screenshot({ type: 'png' });
  const cikti = new URL(dosya, KOK);
  const bilgi = await sharp(png).webp({ quality: 82 }).toFile(cikti.pathname);

  console.log(
    `${dosya.padEnd(14)} ${bilgi.width}×${bilgi.height}  ` +
      `${String(Math.round(bilgi.size / 1024)).padStart(3)} KB  ` +
      `taşma=${tasma}px  sahte-cevap=${sahteCevap}  kaçak=${kacak}`,
  );

  if (kacak > 0) throw new Error(`${dosya}: Supabase'e karşılanmamış istek gitti!`);
  if (sahteCevap === 0) throw new Error(`${dosya}: hiç veri çağrısı olmadı — ekran boş olabilir.`);
  if (bilgi.width !== GENISLIK * OLCEK || bilgi.height !== YUKSEKLIK * OLCEK) {
    throw new Error(`${dosya}: beklenmeyen ölçü ${bilgi.width}×${bilgi.height}`);
  }

  await sayfa.close();
}

const OGRENCI_OTURUM = {
  rol: 'ogrenci',
  token: 't'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '10C', tur: 'okul' },
};
const VELI_OTURUM = {
  rol: 'veli',
  token: 'v'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Elif Yıldırım', sinif: '10C', tur: 'okul' },
};
const OGRETMEN_OTURUM = { rol: 'ogretmen', token: 'g'.repeat(64) };

await cek('ogrenci.webp', '/ogrenci/odevler', OGRENCI_OTURUM);
await cek('ogretmen.webp', '/ogretmen', OGRETMEN_OTURUM);
/* VELİDE PANO DEĞİL ÖDEV LİSTESİ.
 * Pano ölçüldü: içeriği 760 px'lik çerçevenin yarısında bitiyor ve ekran
 * seyrek görünüyordu. Tanıtımın 5. bölümü zaten "yaptığı ve yapmadığı
 * ödevleri, aldığı puanları" diyor — o cümlenin karşılığı bu ekran. */
await cek('veli.webp', '/veli/odevler', VELI_OTURUM);

await tarayici.close();
console.log('\nTanıtım görselleri hazır — uydurma veriyle, gerçek sunucuya sıfır istek.');
