/**
 * 0023 KONU KARNESİ — TARAYICIDA UÇTAN UCA
 *
 * Erişilebilirlik denetimi 22 ekranı geziyor ama "bölüm ÇİZİLDİ Mİ"
 * sorusunu sormuyor; sahte veri boş dönse de o denetim temiz görünürdü.
 * Bu betik bölümün gerçekten var olduğunu, sayıların okunduğunu ve üç
 * ayrı durumun (dolu / boş / uç yok) doğru metni verdiğini ölçüyor.
 *
 * ÖLÇÜLEN, GÖRÜNEN ÖĞELER: `checkVisibility()`. `textContent` kapalı
 * diyalogların gizli başlıklarını da sayıyor ve 0021 turunda tam olarak
 * bu yüzden yanlış bir kusur bildirmiştim.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';
const gun = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const DOLU = {
  kapsam: { tur: 'sinif', ad: '11B', sinif: '11B', mevcut: 24 },
  odev_sayisi: 8,
  konular: [
    { konu: 'Üslü ve Köklü Sayılar', toplam: 48, dogru: 19, yanlis: 22, bos: 7 },
    { konu: 'Limit', toplam: 32, dogru: 20, yanlis: 9, bos: 3 },
    { konu: 'Türev', toplam: 40, dogru: 38, yanlis: 2, bos: 0 },
  ],
  gelisim: [
    { odev: 'Üslü ve Köklü Sayılar · Değerlendirme Sınavı', tarih: gun(-40), tur: 'test', deger: 54.5, gonderen: 22, mevcut: 24 },
    { odev: 'Limit — açık uçlu', tarih: gun(-24), tur: 'acik', deger: 71, gonderen: 19, mevcut: 24 },
    { odev: 'Deneme 4', tarih: gun(-2), tur: 'test', deger: null, gonderen: 0, mevcut: 24 },
  ],
};
const BOS = { kapsam: { tur: 'sinif', ad: '11B', sinif: '11B', mevcut: 24 }, odev_sayisi: 0, konular: [], gelisim: [] };
const KONUSUZ = { ...DOLU, konular: [] };

const SINIF_DETAY = {
  sinif: { id: '11B', ad: '11B', ozel: false, arsiv: false },
  degerlendirilen_odev: 8,
  ogrenciler: [{ id: 'o1', ad: 'Ali Yıldırım', tur: 'okul', yapti: 8, yapmadi: 0, ortalama_yapan: 86.5, ortalama_tum: 86.5 }],
};
const OZEL_DETAY = {
  ogrenci: { id: 'o9', ad: 'Deniz Okul', tur: 'okul', sinif: '11B', aktif: true },
  dersler: [], odemeler: [],
  ozet: { toplam: 0, odenen: 0, kalan: 0, gelecek_ders: 0, ders_toplam: 0 },
};

let hata = 0;
const de = (ok, mesaj) => { if (!ok) { hata++; console.log('  ✗ ' + mesaj); } else console.log('  ✓ ' + mesaj); };

/**
 * Yalnız GÖRÜNEN metin — `innerText`.
 *
 * İlk yazımda seçilmiş etiketlerin YAPRAK düğümlerini topluyordum ve iki
 * denetim boşuna kırıldı: "22/24 gönderdi" cümlesi `span`'lara bölündüğü
 * için parçalanmış, öğrenci adı `<a>` içinde olduğu için hiç okunmamıştı.
 * İkisi de ölçüm hatasıydı, üründe kusur yoktu.
 *
 * `textContent` DEĞİL: o, `display:none` diyalogların gizli başlıklarını da
 * sayıyor ve 0021 turunda tam olarak bu yüzden yanlış bir kusur bildirdim.
 * `innerText` yalnız GERÇEKTEN ÇİZİLEN metni veriyor — istenen tam da bu.
 */
async function gorunenMetin(p) {
  return p.evaluate(() => document.body.innerText);
}

async function ekran(b, yol, karneCevabi, ekCevap = {}) {
  const s = await b.newContext({ viewport: { width: 360, height: 780 } });
  await s.addInitScript(
    ([oturum, cevaplar]) => {
      localStorage.setItem('sekiz_oturum', oturum);
      const asil = window.fetch;
      window.fetch = async (u, o) => {
        const url = String(typeof u === 'string' ? u : u.url);
        const m = url.match(/\/rpc\/([a-z_]+)/);
        if (m && Object.prototype.hasOwnProperty.call(cevaplar, m[1])) {
          const v = cevaplar[m[1]];
          if (v && v.__hata) {
            return new Response(JSON.stringify({ code: 'PGRST202', message: v.__hata }), {
              status: 404, headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return asil(u, o);
      };
    },
    [
      JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
      { konu_karnesi: karneCevabi, sinif_ogrencileri: SINIF_DETAY, ozel_ders_detay: OZEL_DETAY, ...ekCevap },
    ],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { p, s };
}

const b = await chromium.launch();

console.log('1 — SINIF SAYFASINDA BÖLÜM DOLU ÇİZİLİYOR');
{
  const { p, s } = await ekran(b, '/ogretmen/siniflar/11B', DOLU);
  const t = await gorunenMetin(p);
  de(t.includes('Konu karnesi'), 'başlık görünüyor');
  de(t.includes('Üslü ve Köklü Sayılar'), 'en zayıf konu görünüyor');
  de(t.indexOf('Üslü ve Köklü Sayılar') < t.indexOf('Türev'), 'en zayıf konu Türev’den ÖNCE');
  de(t.includes('Bu dönemdeki') || t.includes('En çok eksik olan konu en üstte'),
     'metin DÖNEM diyor, "bu ödevdeki" demiyor');
  de(!t.includes('Bu ödevdeki'), '"Bu ödevdeki" ifadesi YOK (dönem karnesinde yanlış olurdu)');
  de(t.includes('Ödev ödev gelişim'), 'gelişim bölümü var');
  de(t.includes('Gönderilmedi'), 'gönderilmeyen ödev "Gönderilmedi" diyor, 0 demiyor');
  de(/54[,.]5/.test(t), 'ondalıklı değer metin olarak okunuyor');
  de(t.includes('22/24 gönderdi') || /22\s*\/\s*24/.test(t), 'gönderen/mevcut sayısı metinde');
  // EĞİLİM İDDİASI OLMAMALI
  de(!/yükseliyor|düşüyor|gelişiyor|geriliyor|artış|azalış/i.test(t),
     'hiçbir eğilim iddiası yok');
  // Çubuklar ekran okuyucuya görünmemeli
  const cubukGizli = await p.evaluate(() =>
    [...document.querySelectorAll('div[aria-hidden="true"]')].some((e) =>
      e.className.includes('rounded-full') && e.className.includes('bg-line')));
  de(cubukGizli, 'çubuklar aria-hidden (sayılar metinde zaten var)');
  await s.close();
}

console.log('2 — DEĞERLENDİRİLMİŞ ÖDEV YOKKEN BOŞ GRAFİK DEĞİL, METİN');
{
  const { p, s } = await ekran(b, '/ogretmen/siniflar/11B', BOS);
  const t = await gorunenMetin(p);
  de(t.includes('Henüz değerlendirilmiş ödev yok'), 'açıklayıcı metin çıkıyor');
  de(t.includes('süresi dolmuş'), 'ölçüt yazılı (yalnız süresi dolmuş ödevler)');
  const cubuk = await p.evaluate(() =>
    [...document.querySelectorAll('div[aria-hidden="true"]')]
      .filter((e) => e.className.includes('bg-line') && e.className.includes('h-2')).length);
  de(cubuk === 0, 'tek bir boş çubuk bile çizilmiyor');
  await s.close();
}

console.log('3 — KONU EŞLEMESİ YOKKEN NEDEN OLMADIĞI YAZIYOR');
{
  const { p, s } = await ekran(b, '/ogretmen/siniflar/11B', KONUSUZ);
  const t = await gorunenMetin(p);
  de(t.includes('Konu dökümü çıkarılamıyor'), 'konu dökümü yokluğu açıklanıyor');
  de(t.includes('Ödev ödev gelişim'), 'gelişim yine de çiziliyor');
  await s.close();
}

console.log('4 — 0023 PANELDE ÇALIŞTIRILMAMIŞSA EKRAN BOZULMUYOR');
{
  const { p, s } = await ekran(b, '/ogretmen/siniflar/11B', {
    __hata: 'Could not find the function public.konu_karnesi(p_sinif_id, p_token) in the schema cache',
  });
  const t = await gorunenMetin(p);
  de(t.includes('Konu karnesi henüz açık değil'), 'sakin ve Türkçe bir açıklama çıkıyor');
  de(t.includes('0023'), 'yapılacak iş söyleniyor (0023 çalıştırılmalı)');
  de(!t.includes('schema cache'), 'İngilizce teknik mesaj öğretmene GÖSTERİLMİYOR');
  de(t.includes('Ali Yıldırım'), 'sayfanın geri kalanı çalışmaya devam ediyor');
  await s.close();
}

console.log('5 — ÖĞRENCİ SAYFASINDA DA VAR (okul öğrencisi)');
{
  const { p, s } = await ekran(b, '/ogretmen/ogrenciler/o9', {
    ...DOLU, kapsam: { tur: 'ogrenci', ad: 'Deniz Okul', sinif: '11B', mevcut: 1 },
  });
  const t = await gorunenMetin(p);
  de(t.includes('Konu karnesi'), 'bölüm okul öğrencisinde de çiziliyor');
  de(t.includes('Ders programı ve ödeme takibi yalnız özel'), 'ders/ödeme kuralı yerinde');
  de(!t.includes('gönderdi'), 'öğrencide "x/y gönderdi" yazmıyor (sınıfa özel bilgi)');
  de(!/₺|tutar|Ödeme ekle/i.test(t), 'okul öğrencisinde para bilgisi yok');
  await s.close();
}

console.log('6 — 1280 px’te de taşma yok');
{
  const s = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await s.addInitScript(
    ([o, c]) => {
      localStorage.setItem('sekiz_oturum', o);
      const asil = window.fetch;
      window.fetch = async (u, x) => {
        const m = String(typeof u === 'string' ? u : u.url).match(/\/rpc\/([a-z_]+)/);
        if (m && c[m[1]]) return new Response(JSON.stringify(c[m[1]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        return asil(u, x);
      };
    },
    [JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
     { konu_karnesi: DOLU, sinif_ogrencileri: SINIF_DETAY }],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/siniflar/11B', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const fark = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  de(fark <= 0, `1280 px yatay taşma yok (${fark}px)`);
  await s.close();
}

await b.close();
console.log(hata === 0 ? '\nKONU KARNESİ UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
