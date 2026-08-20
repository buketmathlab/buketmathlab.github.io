/**
 * Faz 11 güvenlik denetimi — TARAYICI TARAFI.
 *
 * `docs/guvenlik-testleri.md` 10. madde yıllardır **KAPALI (tasarım)**
 * diyordu: "mesaj düz metin saklanır, React kaçış uygular,
 * dangerouslySetInnerHTML hiç kullanılmaz". Üçü de doğru — ama üçü de
 * KAYNAK KODU İDDİASI. Belgenin kendi "kalan riskler" bölümü bunu zaten
 * kabul ediyordu: *"saldırgan girdisiyle sistematik bir deneme
 * YAPILMADI. Faz 11'e ait."*
 *
 * Bu betik o denemeyi yapıyor: yükler gerçek ekranlara gerçek veri olarak
 * geliyor ve ölçülen şey "kaynakta kaçış var mı" değil,
 * **script çalıştı mı**.
 *
 * NASIL ÖLÇÜLÜYOR — üç bağımsız kanal:
 *   1. `dialog` olayı: `alert()` çalışırsa Playwright yakalar.
 *   2. `window.__xss` işareti: yükler bunu set etmeye çalışıyor.
 *   3. DOM: enjekte edilen metinden `<script>`/`<img>`/`<svg>` DÜĞÜMÜ
 *      oluştu mu — yani metin, işaretleme olarak ayrıştırıldı mı.
 *
 * Ayrıca yükün EKRANDA GÖRÜNDÜĞÜ ölçülüyor: kaçış çalışıyorsa öğretmen
 * mesajı olduğu gibi okumalı. Kaybolmuş bir mesaj da bir kusurdur.
 *
 * ÇALIŞTIRMA (depo kökünden):
 *   npm --prefix app run build
 *   setsid npx --prefix app http-server -p 8788 -s . > /tmp/hs.log 2>&1 < /dev/null &
 *   node app/scripts/guvenlik-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/**
 * Yükler. Her biri iki şeyi birden dener: bir yan etki (`__xss` / alert)
 * ve DOM'da bir düğüm oluşturmak.
 */
const YUKLER = [
  '<script>window.__xss=1;alert("x")</script>',
  '<img src=x onerror="window.__xss=1">',
  '<svg onload="window.__xss=1">',
  '<iframe src="javascript:window.parent.__xss=1"></iframe>',
  '"><script>window.__xss=1</script>',
  "<a href=\"javascript:window.__xss=1\">bağlantı</a>",
  '<body onload="window.__xss=1">',
  '<div style="background:url(javascript:window.__xss=1)">stil</div>',
];

let olcum = 0;
let kusur = 0;
function bak(baslik, kosul, ayrinti = '') {
  olcum += 1;
  if (kosul) console.log(`  ✓ ${baslik}${ayrinti ? ' — ' + ayrinti : ''}`);
  else {
    kusur += 1;
    console.log(`  ✗ ${baslik}${ayrinti ? ' — ' + ayrinti : ''}`);
  }
}

const ZAMAN = '2026-08-19T10:00:00Z';

/** Öğrenci ADINA konan yük — mesaj değil, ad alanı da bir yüzey. */
const AD_YUKU = '<img src=x onerror="window.__xss=1">';

/** Yükleri mesaj listesine çeviren yardımcı. */
const mesajlar = (kimden) =>
  YUKLER.map((metin, i) => ({ kimden, metin, zaman: ZAMAN, i }));

const CEVAPLAR = {
  // Öğretmenin bir öğrenciyle yazışması
  mesajlar_ogretmen: {
    ogrenci: { id: 'o1', ad: 'Yük Denemesi', sinif: '11Z' },
    mesajlar: mesajlar('ogrenci'),
    son_gorulme: ZAMAN,
  },
  // Öğrencinin kendi yazışması
  ogrenci_mesajlari: { mesajlar: mesajlar('ogretmen'), son_gorulme: ZAMAN },
  // Velinin paneli
  veli_paneli: {
    ogrenci: { ad: 'Yük Denemesi', sinif: '11Z', tur: 'okul' },
    odevler: [],
    mesajlar: mesajlar('ogretmen'),
    odemeler: [],
    okunmamis_mesaj: 0,
    son_gorulme: ZAMAN,
  },
  // Öğretmenin öğrenci yazışmaları listesi — ŞEKİL SUNUCUDAN ALINDI.
  // İlk denememde uydurmuştum ve ekran `veri?.map is not a function` ile
  // çöktü; kusur üründe değil sahte verimdeydi. Gerçek şekil
  // `ogrenci_yazismalari` gövdesinden okundu: yanit_bekleyen + toplam.
  ogrenci_yazismalari: {
    toplam_okunmamis: 2,
    yanit_bekleyen: [
      {
        ogrenci_id: 'o1',
        ad: AD_YUKU,
        sinif: '11Z',
        okunmamis: 2,
        son_mesaj: ZAMAN,
      },
    ],
  },
  siniflar_listesi: [
    { id: 's1', ad: '11Z', seviye: 11, sube: 'Z', ozel: false, arsiv: false, ogrenci_sayisi: 1 },
  ],
  ogrenciler_listesi: {
    toplam: 1,
    sayfa: 1,
    toplam_sayfa: 1,
    kayitlar: [{ id: 'o1', ad: AD_YUKU, tur: 'okul', sinif: '11Z' }],
  },
  ogrenci_odevleri: {
    ogrenci: { id: 'o1', ad: 'Yük Denemesi', sinif: '11Z', tur: 'okul' },
    odevler: [],
    dersler: [],
    okunmamis_mesaj: 0,
  },
  bildirim_sayilari: { okunmamis_mesaj: 0, puan_bekleyen: 0 },
};

const tarayici = await chromium.launch();

async function ekran(ad, yol, oturum, beklenenMetinler = YUKLER) {
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 900 } });

  const alarmlar = [];
  const hatalar = [];
  sayfa.on('dialog', async (d) => {
    alarmlar.push(d.message());
    await d.dismiss();
  });
  sayfa.on('pageerror', (e) => hatalar.push(String(e)));

  await sayfa.route('**/rest/v1/rpc/*', async (rota) => {
    const uc = rota.request().url().split('/').pop().split('?')[0];
    await rota.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CEVAPLAR[uc] ?? {}),
    });
  });

  await sayfa.addInitScript((o) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(o));
    // Yüklerin hedefi. Sayfa açılışında temiz.
    window.__xss = 0;
  }, oturum);

  await sayfa.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(1500);

  const sonuc = await sayfa.evaluate((yukler) => {
    // Uygulamanın kendi <script> etiketleri sayılmamalı: yalnız mesaj
    // gövdesinin İÇİNDE oluşmuş düğümler aranıyor.
    const kap = document.body;
    const enjekte = {
      script: kap.querySelectorAll('script[data-yuk], li script, li img, li svg, li iframe').length,
      // Yükün metin olarak görünüp görünmediği
      gorunen: yukler.filter((y) => (document.body.innerText || '').includes(y)).length,
    };
    return { xss: window.__xss, ...enjekte };
  }, beklenenMetinler);

  console.log(`\n  ${ad}`);
  bak('alert() çalışmadı', alarmlar.length === 0, alarmlar.join(' | ') || '0 diyalog');
  bak('window.__xss set edilmedi', sonuc.xss === 0, `__xss=${sonuc.xss}`);
  bak(
    'mesajdan işaretleme düğümü oluşmadı',
    sonuc.script === 0,
    `${sonuc.script} düğüm`,
  );
  bak(
    'yükler EKRANDA METİN olarak görünüyor',
    sonuc.gorunen === beklenenMetinler.length,
    `${sonuc.gorunen}/${beklenenMetinler.length}`,
  );
  bak('sayfa hatası yok', hatalar.length === 0, hatalar.slice(0, 1).join('') || '0 hata');

  await sayfa.close();
}

const OGRETMEN = { rol: 'ogretmen', token: 'g'.repeat(64) };
const OGRENCI = {
  rol: 'ogrenci',
  token: 'o'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Yük Denemesi', sinif: '11Z', tur: 'okul' },
};
const VELI = {
  rol: 'veli',
  token: 'v'.repeat(64),
  ogrenci: { id: 'o1', ad: 'Yük Denemesi', sinif: '11Z', tur: 'okul' },
};

console.log('FAZ 11 — XSS DENEMESİ (tarayıcıda, gerçek yüklerle)');
console.log('='.repeat(56));

await ekran('Öğretmen · öğrenci yazışması', '/ogretmen/ogrenciler/yazisma/o1', OGRETMEN);
await ekran('Öğretmen · veli yazışması', '/ogretmen/veliler/yazisma/o1', OGRETMEN);
await ekran('Öğrenci · mesajlar', '/ogrenci/mesajlar', OGRENCI);
await ekran('Veli · mesajlar', '/veli/mesajlar', VELI);
// Bu ekranda mesaj yok; yüzey ÖĞRENCİ ADI. Beklenen metin de o.
await ekran('Öğretmen · öğrenci listesi (addaki yük)', '/ogretmen/ogrenciler', OGRETMEN, [AD_YUKU]);

await tarayici.close();

console.log(`\n${'='.repeat(56)}`);
console.log(`GÜVENLİK DENETİMİ (tarayıcı) — ${olcum} ölçüm, ${kusur} kusur`);
console.log('='.repeat(56));
process.exit(kusur === 0 ? 0 : 1);
