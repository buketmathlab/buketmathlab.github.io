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

// Ayırt edici iki cümle. Sızıntı ararken metinde bunları arıyoruz; başka
// hiçbir yerde geçmeyen kelimeler seçildi ("kalemtiras", "zeytinagaci").
//
// GERÇEK BİR CÜMLE GİBİ YAZILDILAR ve bunun ölçümle ilgili bir sebebi var:
// ilk sürümde "OGRENCIDENGELEN…" diye 15 harflik, bölünemeyen bir kelimeyle
// başlıyorlardı. Ad ön ekinin yanına sığmadığı için metin alt satıra
// kayıyordu ve "ad ve mesaj aynı satırda" ölçümü kırılıyordu — ürün değil,
// uydurma cümle yüzünden. Kısa bir kelimeyle başlayan gerçekçi bir mesaj
// gerçek kullanımı temsil ediyor.
//
// DÜRÜST SINIR: çok uzun tek bir kelimeyle başlayan bir mesaj yine alt
// satıra sarar. Bu normal metin akışı; verdiğimiz güvence "ad kendi
// satırına ZORLANMIYOR", "hiçbir mesaj hiçbir zaman sarmaz" değil.
const VELI_CUMLESI = 'Hocam kalemtiras meselesini soracaktim';
const OGRENCI_CUMLESI = 'Hocam zeytinagaci meselesini anlamadim';

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

// Kendi konu karnesi (0026). Ada'nın karnesi: Oran'da eksik, Kesirler tam.
const KENDI_KARNEM = {
  kapsam: { ad: 'Ada Kanalcı', sinif: '9A' },
  odev_sayisi: 2,
  konular: [
    { konu: 'Oran', toplam: 2, dogru: 0, yanlis: 2, bos: 0 },
    { konu: 'Kesirler', toplam: 2, dogru: 2, yanlis: 0, bos: 0 },
  ],
  gelisim: [
    { odev: 'Kesirler denemesi', tarih: gun(-3), tur: 'test', deger: 50 },
    { odev: 'Kesirler yazılı', tarih: gun(-2), tur: 'acik', deger: 70 },
  ],
};

const OGRENCI_MESAJLARI = {
  mesajlar: [
    { kimden: 'ogrenci', metin: OGRENCI_CUMLESI, zaman: gun(-1) + 'T08:00:00Z' },
    { kimden: 'ogretmen', metin: 'Yarın derste bakalım.', zaman: gun(-1) + 'T09:00:00Z' },
  ],
  son_gorulme: null,
};

// Öğretmenin öğrenci yazışması: gelen mesaj öğrencinin ADIYLA gösterilmeli.
const YAZISMA_OGRENCI = {
  ogrenci: { id: 'o1', ad: 'Ada Kanalcı', sinif: '9A' },
  kanal: 'ogrenci',
  veli_kodu_var: true,
  mesajlar: [
    { kimden: 'ogrenci', metin: OGRENCI_CUMLESI, zaman: gun(-1) + 'T08:00:00Z' },
    { kimden: 'ogretmen', metin: 'Yarın derste bakalım.', zaman: gun(-1) + 'T09:00:00Z' },
  ],
};

const OTURUM = {
  ogretmen: () => ({ rol: 'ogretmen', token: 't'.repeat(64) }),
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
  // UÇ BAŞINA yanıt: bazı iddialar sayfanın TAMAMINA değil TEK BİR UCA ait.
  // (Öğrenci teslimden sonra `ogrenci_odevleri` içinde anahtarı meşru
  //  olarak alıyor — 0007. "Sayfada hiç anahtar geçmesin" demek yanlış
  //  bir iddia olurdu; ölçüm doğru uca daraltılıyor.)
  const govdeler = {};
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    cagrilar.push(uc);
    const govde =
      uc === 'ogrenci_odevleri' ? ogrenciOdevleri(tur)
      : uc === 'veli_paneli' ? veliPaneli(tur)
      : uc === 'ogrenci_mesajlari' ? OGRENCI_MESAJLARI
      : uc === 'mesajlar_ogretmen' ? YAZISMA_OGRENCI
      : uc === 'kendi_karnem' ? KENDI_KARNEM
      : {};
    agGovdeleri.push(JSON.stringify(govde));
    govdeler[uc] = JSON.stringify(govde);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript((o) => localStorage.setItem('sekiz_oturum', JSON.stringify(o)),
    OTURUM[rol](tur));
  await s.goto(KOK + yol, { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  return { s, agGovdeleri, cagrilar, govdeler };
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
  'öğrenci (okul)': ['Pano', 'Ödevler', 'Konularım', 'Mesajlar'],
  'öğrenci (özel)': ['Pano', 'Ödevler', 'Konularım', 'Mesajlar'],
  'veli (okul)': ['Pano', 'Ödevler', 'Konular', 'Mesajlar'],
  'veli (özel)': ['Pano', 'Ödevler', 'Konular', 'Ödemeler', 'Mesajlar'],
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
  ['Konularım', '/ogrenci/konularim'],
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
console.log('\n4b — AD VE MESAJ AYNI SATIRDA, ÖĞRENCİNİN GERÇEK ADIYLA');
//
// Öğretmenin isteği: "Öğrenciden gelen mesaj öğrencinin isminin yanında
// olmalı. Ayrı bir satırda olmamalı o mesajlar."
//
// NASIL ÖLÇÜLÜYOR: sınıf adına ya da HTML yapısına bakmıyoruz — ikisi de
// düzeni değil niyeti ölçer. Adın ve mesajın ekranda GERÇEKTEN aynı yatay
// hizada olup olmadığı `getBoundingClientRect()` ile karşılaştırılıyor.
// Ad ayrı satıra düşerse iki `top` değeri ayrışır ve ölçüm kırılır.
// -----------------------------------------------------------------------------
{
  const { s } = await sayfaAc('ogretmen', 'ozel', '/ogretmen/ogrenciler/yazisma/o1');
  const olcum = await s.evaluate((cumle) => {
    const kalin = [...document.querySelectorAll('strong')]
      .find((e) => e.textContent.includes('Ada Kanalcı'));
    if (!kalin) return { adVar: false };
    // Mesaj metnini taşıyan metin düğümünün kendi dikdörtgeni.
    const balon = kalin.parentElement;
    const dugum = [...balon.childNodes]
      .find((n) => n.nodeType === 3 && n.textContent.includes(cumle.slice(0, 12)));
    if (!dugum) return { adVar: true, metinVar: false };
    const araliq = document.createRange();
    araliq.selectNodeContents(dugum);
    return {
      adVar: true,
      metinVar: true,
      adUst: Math.round(kalin.getBoundingClientRect().top),
      metinUst: Math.round(araliq.getBoundingClientRect().top),
    };
  }, OGRENCI_CUMLESI);

  olc('öğretmen ekranında öğrencinin GERÇEK ADI geçiyor', olcum.adVar === true);
  olc('adın yanında mesaj metni var', olcum.metinVar === true);
  olc(
    'ad ve mesaj AYNI SATIRDA',
    olcum.metinVar === true && olcum.adUst === olcum.metinUst,
    `ad üst ${olcum.adUst} · metin üst ${olcum.metinUst}`,
  );

  // Genel "Öğrenci" kelimesi ARTIK ETİKET DEĞİL: gerçek ad geldiyse o
  // kelimenin ön ek olarak durmaması gerekiyor.
  const genel = await s.evaluate(() =>
    [...document.querySelectorAll('strong')].some((e) => e.textContent.trim() === 'Öğrenci:'));
  olc('genel "Öğrenci" etiketi yerini ada bıraktı', genel === false);
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n4c — BEŞ SEKME 360 px\'DE SIĞIYOR MU (varsayılmıyor, ölçülüyor)');
//
// Özel ders velisinde sekme sayısı 4'ten 5'e çıktı. Öğretmenin altı sekmesi
// 360 px'de sığıyor ama bu KENDİLİĞİNDEN geçerli değil: alt çubukta etiket
// uzunlukları farklı ("Konular", "Ödemeler"). Taşma ve dokunma hedefi
// ölçülüyor.
// -----------------------------------------------------------------------------
{
  const { s } = await sayfaAc('veli', 'ozel', '/veli');
  const o = await s.evaluate(() => {
    const cubuk = [...document.querySelectorAll('nav[aria-label="Ana gezinme"]')]
      .filter((n) => n.checkVisibility())[0];
    const baglar = [...cubuk.querySelectorAll('a')];
    return {
      adet: baglar.length,
      tasma: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Her sekme 44 px dokunma hedefini koruyor mu
      kucuk: baglar.filter((a) => a.getBoundingClientRect().height < 44).length,
      // Etiketler kırpılıyor mu: yazı kabından geniş mi
      kirpik: baglar.filter((a) => a.scrollWidth > a.clientWidth + 1).length,
    };
  });
  olc('özel ders velisinde 5 sekme çiziliyor', o.adet === 5, `${o.adet} sekme`);
  olc('360 px yatay taşma yok', o.tasma === 0, `${o.tasma} px`);
  olc('beş sekmenin hepsi 44 px+', o.kucuk === 0);
  olc('hiçbir sekme etiketi kırpılmıyor', o.kirpik === 0);
  await s.close();
}

// -----------------------------------------------------------------------------
console.log('\n4d — KARNEDE KIYAS VE ANAHTAR YOK');
//
// Sunucu testi (`kendi_karnem_testleri.sql`) sızıntıyı UÇTA ölçüyor; bu
// grup EKRANDA ölçüyor. Arayüz doğru veriyi alıp yanlış bir şey
// yazabilirdi — örneğin "sınıf ortalaması" diye bir satır uydurabilirdi.
// -----------------------------------------------------------------------------
for (const [ad, rol, yol] of [
  ['öğrenci', 'ogrenci', '/ogrenci/konularim'],
  ['veli', 'veli', '/veli/konular'],
]) {
  const { s, govdeler } = await sayfaAc(rol, 'okul', yol);
  const metin = await s.evaluate(() => document.body.innerText);
  // YALNIZ KARNE UCUNUN yanıtı — sayfanın tamamı değil.
  const karne = govdeler.kendi_karnem ?? '';
  olc(`${ad} karne ucu çağrıldı`, karne.length > 0);
  olc(`${ad} karnesinde kıyas kelimesi yok`,
    !/sınıf ortalaması|sıralama|sınıfın/i.test(metin));
  olc(`${ad} karne yanıtında mevcut/gonderen yok`,
    !/"mevcut"|"gonderen"/.test(karne));
  olc(`${ad} karne yanıtında cevap anahtarı yok`,
    !/cevap_anahtari|anahtar_yolu/.test(karne));
  // YALNIZ KONU ADINI ARAMAK KÖR — ölçüldü. "Oran" Ewalu'nun cümlesinde de
  // geçiyor ("En çok Oran konusunda takılmışsın"), o yüzden konu LİSTESİ hiç
  // çizilmese bile arama tutuyordu. Listenin kendi başlığı da aranıyor.
  const listeBasligi = rol === 'ogrenci' ? 'Çalışılacak konular' : 'Eksik olunan konular';
  olc(`${ad} konu listesi çiziliyor`, metin.includes(listeBasligi), listeBasligi);
  olc(`${ad} en zayıf konuyu görüyor`, metin.includes('Oran'));
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
