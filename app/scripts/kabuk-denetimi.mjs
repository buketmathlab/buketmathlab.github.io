// =============================================================================
// SEKİZ — 0025 KABUK DENETİMİ
//
// Dört giriş türünün sekme kümesini, öğrenci ekranlarında para bilgisi
// olmadığını ve iki yazışmanın birbirine karışmadığını GERÇEK TARAYICIDA
// ölçer.
//
// NEDEN SQL TESTİ YETMİYOR: sunucu doğru veriyi gönderse bile arayüz yanlış
// ucu çağırabilir, yanlış sekmeyi çizebilir ya da bir yanıtı yanlış ekranda
// gösterebilir. Buradaki ölçüm ekranın kendisinde ve AĞ TRAFİĞİNDE yapılıyor.
//
// Kullanım: yapı alındıktan ve depo kökünde bir statik sunucu
// (http-server -p 8788) çalıştıktan sonra `node scripts/kabuk-denetimi.mjs`.
// =============================================================================
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';
const gun = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// Ayırt edici iki cümle. Sızıntı ararken metinde bunları arıyoruz; kısa ve
// başka hiçbir yerde geçmeyen kelimeler seçildi.
const VELI_CUMLESI = 'VELIDENGELEN kalemtiras meselesi';
const OGRENCI_CUMLESI = 'OGRENCIDENGELEN zeytinagaci meselesi';

// Gerçekçi bir tutar: sızıntı ararken hem ALAN ADINI hem DEĞERİ arıyoruz.
const TUTAR = 1500.5;

function ogrenciOdevleri(tur) {
  return {
    ogrenci: { id: 'o1', ad: 'Ada Kanalcı', sinif: tur === 'ozel' ? 'Özel ders' : '9A', tur },
    okunmamis_mesaj: 2,
    dersler:
      tur === 'ozel'
        ? [{ zaman: gun(2) + 'T16:00:00Z', mod: 'online', link: 'https://ornek/ders' }]
        : [],
    odevler: [
      {
        id: 'a1', baslik: 'Türev testi', aciklama: null, tur: 'test', son_tarih: gun(2),
        soru_sayisi: 5, gec_teslim: true, sik_sayisi: 5, sinif_arsiv: false,
        odev_yolu: 'odev/x.pdf', gonderim: null, konu_analizi: [],
        cevap_anahtari: null, anahtar_yolu: null,
      },
    ],
  };
}

function veliPaneli(tur) {
  return {
    ogrenci: { ad: 'Ada Kanalcı', sinif: tur === 'ozel' ? 'Özel ders' : '9A', tur },
    okunmamis_mesaj: 2,
    odevler: [
      {
        baslik: 'Türev testi', son_tarih: gun(-5), olusturma: gun(-12), gonderildi: true,
        gonderim_zamani: gun(-6) + 'T20:10:00Z', puan: 85, durum: 'puanlandi',
        yanlis_sorular: [3], bos_sorular: [], konu_analizi: [],
      },
    ],
    mesajlar: [
      { kimden: 'veli', metin: VELI_CUMLESI, zaman: gun(-2) + 'T09:15:00Z' },
      { kimden: 'ogretmen', metin: 'Merhaba, buyurun.', zaman: gun(-2) + 'T10:02:00Z' },
    ],
    // Ödeme YALNIZ özel derste; sunucu okul öğrencisinde boş dizi döndürüyor.
    odemeler: tur === 'ozel' ? [{ tutar: TUTAR, tarih: gun(-2), odendi: false }] : [],
    son_gorulme: gun(-1) + 'T20:00:00Z',
  };
}

const OGRENCI_MESAJLARI = {
  mesajlar: [
    { kimden: 'ogrenci', metin: OGRENCI_CUMLESI, zaman: gun(-1) + 'T08:00:00Z' },
    { kimden: 'ogretmen', metin: 'Yarın derste bakalım.', zaman: gun(-1) + 'T09:00:00Z' },
  ],
  son_gorulme: null,
};

const OTURUM = {
  ogrenci: (tur) => ({
    rol: 'ogrenci', token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Ada Kanalcı', tur, sinif: tur === 'ozel' ? 'Özel ders' : '9A' },
  }),
  veli: (tur) => ({
    rol: 'veli', token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Ada Kanalcı', tur, sinif: tur === 'ozel' ? 'Özel ders' : '9A' },
  }),
};

let gecen = 0;
let kalan = 0;
function olc(ad, kosul, ayrinti = '') {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`); }
  else { kalan++; console.log(`  ✗ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`); }
}

const tarayici = await chromium.launch();

/**
 * Bir rol için sayfa açar; dönen `agGovdeleri` o sayfada sunucudan gelen
 * BÜTÜN yanıtları taşır. Sızıntıyı ekrandan değil trafikten ölçmenin sebebi
 * bu: `display:none` ile gizlenen bir alan ekranda görünmez ama cihaza
 * inmiştir (Part XXI).
 */
async function sayfaAc(rol, tur, yol) {
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  const agGovdeleri = [];
  const cagrilar = [];
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    cagrilar.push(uc);
    const govde =
      uc === 'ogrenci_odevleri' ? ogrenciOdevleri(tur)
      : uc === 'veli_paneli' ? veliPaneli(tur)
      : uc === 'ogrenci_mesajlari' ? OGRENCI_MESAJLARI
      : {};
    agGovdeleri.push(JSON.stringify(govde));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)),
    OTURUM[rol](tur));
  await s.goto(KOK + yol, { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  return { s, agGovdeleri, cagrilar };
}

/**
 * GÖRÜNEN sekme etiketleri.
 *
 * İKİ AYRI ÖLÇÜM TUZAĞI var ve ikisi de bu turda yaşandı:
 *
 * 1. `checkVisibility()` şart: geniş ekran için yazılmış yatay sekme satırı
 *    DOM'da duruyor ama 360 px'de gizli. Filtresiz okusaydık her sekmeyi
 *    iki kez sayardık.
 * 2. ROZET DE METİN SAYILIYOR: düz `textContent` "Mesajlar" yerine
 *    "2Mesajlar" veriyor, çünkü sayı bağlantının içinde. Rozet
 *    `aria-hidden="true"` — yani ekran okuyucunun okumadığı şeyi biz de
 *    okumuyoruz; etiketi almadan önce o düğümleri çıkarıyoruz.
 */
async function sekmeler(s) {
  return s.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Ana gezinme"]')]
      .filter((n) => n.checkVisibility())
      .flatMap((n) => [...n.querySelectorAll('a')])
      .map((a) => {
        const k = a.cloneNode(true);
        k.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove());
        return k.textContent.trim();
      })
      .filter(Boolean),
  );
}

// -----------------------------------------------------------------------------
console.log('\n1 — DÖRT GİRİŞ TÜRÜNÜN SEKME KÜMESİ');
// -----------------------------------------------------------------------------
const BEKLENEN = {
  'öğrenci (okul)': ['Pano', 'Ödevler', 'Mesajlar'],
  'öğrenci (özel)': ['Pano', 'Ödevler', 'Mesajlar'],
  'veli (okul)': ['Pano', 'Ödevler', 'Mesajlar'],
  'veli (özel)': ['Pano', 'Ödevler', 'Ödemeler', 'Mesajlar'],
};

for (const [ad, [rol, tur, yol]] of Object.entries({
  'öğrenci (okul)': ['ogrenci', 'okul', '/ogrenci'],
  'öğrenci (özel)': ['ogrenci', 'ozel', '/ogrenci'],
  'veli (okul)': ['veli', 'okul', '/veli'],
  'veli (özel)': ['veli', 'ozel', '/veli'],
})) {
  const { s } = await sayfaAc(rol, tur, yol);
  const bulunan = await sekmeler(s);
  const beklenen = BEKLENEN[ad];
  olc(
    `${ad} sekmeleri`,
    JSON.stringify(bulunan) === JSON.stringify(beklenen),
    `beklenen [${beklenen}] · bulunan [${bulunan}]`,
  );
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n2 — ÖDEMELER SEKMESİ YALNIZ ÖZEL DERS VELİSİNDE');
// -----------------------------------------------------------------------------
for (const [ad, [rol, tur, yol], olmali] of [
  ['okul velisi', ['veli', 'okul', '/veli'], false],
  ['özel ders velisi', ['veli', 'ozel', '/veli'], true],
  ['özel ders öğrencisi', ['ogrenci', 'ozel', '/ogrenci'], false],
]) {
  const { s } = await sayfaAc(rol, tur, yol);
  const var_ = (await sekmeler(s)).includes('Ödemeler');
  olc(`${ad}: Ödemeler sekmesi ${olmali ? 'VAR' : 'YOK'}`, var_ === olmali);
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n3 — ÖĞRENCİ EKRANLARINDA PARA BİLGİSİ YOK');
//
// Öğretmenin kalıcı kuralı: "Ödeme detaylarını öğrenci görmesin."
// Üç öğrenci ekranında hem EKRAN METNİ hem AĞ YANITI taranıyor. Özel ders
// öğrencisi seçildi — en sert durum: ödenmemiş borcu ve dersi var.
// -----------------------------------------------------------------------------
const PARA_DESENI = /tutar|odendi|ödendi|₺|borç|ödeme/i;
for (const [ad, yol] of [
  ['Pano', '/ogrenci'],
  ['Ödevler', '/ogrenci/odevler'],
  ['Mesajlar', '/ogrenci/mesajlar'],
]) {
  const { s, agGovdeleri } = await sayfaAc('ogrenci', 'ozel', yol);
  const metin = await s.evaluate(() => document.body.innerText);
  const ag = agGovdeleri.join(' ');
  olc(`${ad}: ekranda para geçmiyor`, !PARA_DESENI.test(metin));
  olc(`${ad}: ağ yanıtında para alanı yok`, !PARA_DESENI.test(ag));
  olc(`${ad}: ağ yanıtında tutar DEĞERİ yok`, !ag.includes(String(TUTAR)));
  await s.close();
}

// Denetimin işe yaradığı kanıtı: AYNI desen velinin ödeme ekranında
// BULUNUYOR. Bulunmasaydı yukarıdaki üç ölçüm, arama hiç çalışmadığı için
// de geçerdi.
{
  const { s, agGovdeleri } = await sayfaAc('veli', 'ozel', '/veli/odemeler');
  const metin = await s.evaluate(() => document.body.innerText);
  olc('KANIT: aynı arama velinin ödeme ekranında eşleşiyor',
    PARA_DESENI.test(metin) && agGovdeleri.join(' ').includes(String(TUTAR)));
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n4 — İKİ YAZIŞMA BİRBİRİNE KARIŞMIYOR');
//
// Sunucu testinin (iki_yazisma_testleri.sql 2. grup) tarayıcıdaki kardeşi.
// Burada ayrıca ARAYÜZÜN DOĞRU UCU çağırdığı ölçülüyor: öğrenci ekranı
// `veli_paneli`'ne hiç dokunmamalı.
// -----------------------------------------------------------------------------
{
  const { s, agGovdeleri, cagrilar } = await sayfaAc('ogrenci', 'ozel', '/ogrenci/mesajlar');
  const metin = await s.evaluate(() => document.body.innerText);
  const ag = agGovdeleri.join(' ');
  olc('öğrenci kendi cümlesini görüyor', metin.includes(OGRENCI_CUMLESI));
  olc('öğrenci ekranında velinin cümlesi YOK', !metin.includes(VELI_CUMLESI));
  olc('öğrenciye giden ağ yanıtında velinin cümlesi YOK', !ag.includes(VELI_CUMLESI));
  olc('öğrenci ekranı veli_paneli ucunu ÇAĞIRMIYOR', !cagrilar.includes('veli_paneli'));
  await s.close();
}
{
  const { s, agGovdeleri, cagrilar } = await sayfaAc('veli', 'ozel', '/veli/mesajlar');
  const metin = await s.evaluate(() => document.body.innerText);
  const ag = agGovdeleri.join(' ');
  olc('veli kendi cümlesini görüyor', metin.includes(VELI_CUMLESI));
  olc('veli ekranında öğrencinin cümlesi YOK', !metin.includes(OGRENCI_CUMLESI));
  olc('veliye giden ağ yanıtında öğrencinin cümlesi YOK', !ag.includes(OGRENCI_CUMLESI));
  olc('veli ekranı ogrenci_mesajlari ucunu ÇAĞIRMIYOR',
    !cagrilar.includes('ogrenci_mesajlari'));
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n5 — MESAJLAR ROZETİ OKUNUNCA DÜŞÜYOR');
//
// `okundu_isaretle` çağrıldıktan SONRA sunucu 0 döndürüyor; rozetin rota
// değişiminde yenilendiğini ölçüyoruz. Yarım saat beklemek "okudum ama
// hâlâ 2 diyor" hissi verirdi.
// -----------------------------------------------------------------------------
{
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  let okundu = false;
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    if (uc === 'okundu_isaretle') okundu = true;
    const govde =
      uc === 'ogrenci_odevleri'
        ? { ...ogrenciOdevleri('okul'), okunmamis_mesaj: okundu ? 0 : 2 }
        : uc === 'ogrenci_mesajlari' ? OGRENCI_MESAJLARI
        : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)),
    OTURUM.ogrenci('okul'));

  await s.goto(KOK + '/ogrenci', { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  // GÖRÜNÜR çubuğa daraltmak şart: yatay sekme satırı 360 px'de gizli ama
  // DOM'da duruyor ve seçici önce onu buluyor (ölçüldü — tıklama zaman
  // aşımına düşmüştü).
  const rozetAdi = () => s.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Ana gezinme"]')]
      .filter((n) => n.checkVisibility())
      .flatMap((n) => [...n.querySelectorAll('a')])
      .find((a) => a.textContent.includes('Mesajlar'))?.getAttribute('aria-label') ?? null);
  const once = (await rozetAdi()) ?? '';
  olc('rozet sayısı aria-label\'da geçiyor', /2 okunmamış mesaj/.test(once), once);

  await s.click('nav[aria-label="Ana gezinme"]:visible a[href$="/ogrenci/mesajlar"]');
  await s.waitForTimeout(900);
  await s.click('nav[aria-label="Ana gezinme"]:visible a[href$="/ogrenci/odevler"]');
  await s.waitForTimeout(900);

  const sonra = await rozetAdi();
  olc('okuduktan sonra rozet düştü', sonra === null, String(sonra));
  await s.close();
}

await tarayici.close();
console.log(`\n--- GEÇEN: ${gecen}   KALAN: ${kalan} ---`);
process.exit(kalan === 0 ? 0 : 1);
