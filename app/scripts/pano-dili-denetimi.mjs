/**
 * =============================================================================
 * PANO DİLİ DENETİMİ — övgü yok, gerekçe yok
 * =============================================================================
 *
 * Öğretmenin bu turdaki iki cümlesi:
 *
 *   *"Eline sağlık cümlesine gerek yok. Daha pedagojik, daha profesyonel
 *   bir şey yazabilirsiniz."*
 *   *"Genel olarak tüm cümleler öyle olmalı."*
 *
 * NEDEN BİRİM TESTİ YETMİYOR. `ogrenci-ozet-metni.test.ts` fonksiyonun
 * doğru cümleyi DÖNDÜRDÜĞÜNÜ ölçüyor. Ama düzeltilen kusur tam olarak
 * "fonksiyon doğru, ekran onu kullanmıyor" biçimindeydi: cümle bir
 * koşulda, Ewalu'nun pozu BİR SATIR YUKARIDA ayrı bir koşulda duruyordu.
 * O ayrışma ancak ekranın kendisinde görülür.
 *
 * ÜÇ DURUM, HER BİRİNDE CÜMLE VE POZ BİRLİKTE:
 *
 *   A. Hiç ödev yayınlanmamış  → "Henüz ödev yayınlanmadı."  + kesif
 *   B. Hepsi gönderilmiş       → "Bütün ödevlerini gönderdin." + kutlama
 *   C. Bekleyen var            → "1 ödevin seni bekliyor."     + calisma
 *
 * Poz `img[src]`'den okunuyor (`kesif-portre-…`), koddan değil — ölçüm
 * ekranda ÇİZİLENE bakıyor.
 *
 * DÖRDÜNCÜ ÖLÇÜM: Pano ile Ödevlerim ayrışmıyor. Aynı cümle iki dosyada
 * ayrı ayrı yazılıydı; bu turun sebebi zaten o ayrışmaydı.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 * =============================================================================
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

const gun = (n) => new Date(Date.now() + n * 864e5).toISOString();

/** Sunucunun gönderdiği ödev kaydının asgari, GERÇEK biçimi. */
function odev(id, gonderildiMi) {
  return {
    id,
    baslik: `Ödev ${id}`,
    aciklama: null,
    tur: 'test',
    son_tarih: gun(7),
    soru_sayisi: 10,
    gec_teslim: false,
    sik_sayisi: 4,
    sinif_arsiv: false,
    odev_yolu: null,
    gonderim: gonderildiMi
      ? { zaman: gun(-1), puan: 80, ogretmen_puan: null, cevaplar: {}, gorsel_yolu: null }
      : null,
    konu_analizi: [],
    cevap_anahtari: null,
    anahtar_yolu: null,
  };
}

const b = await chromium.launch();

/**
 * Verilen ödev listesiyle bir öğrenci oturumu açar.
 *
 * TAKLİT GERÇEĞE SADIK: ödev listesi durumdan duruma DEĞİŞİYOR. Sabit
 * bir liste verseydik üç durum aslında tek durum olurdu ve ölçüm hiçbir
 * şey ayırt etmezdi.
 */
async function ac(odevler, yol) {
  const s = await b.newContext({ viewport: { width: 420, height: 900 } });
  await s.addInitScript(
    ([oturumJson, odevlerJson]) => {
      localStorage.setItem('sekiz_oturum', oturumJson);
      const asil = window.fetch;
      const json = (o) =>
        new Response(JSON.stringify(o), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      window.fetch = async (u, o) => {
        const url = String(typeof u === 'string' ? u : u.url);
        const m = url.match(/\/rpc\/([a-z_]+)/);
        if (!m) return asil(u, o);
        if (m[1] === 'ogrenci_odevleri')
          return json({
            ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A', tur: 'okul' },
            odevler: JSON.parse(odevlerJson),
            dersler: [],
            okunmamis_mesaj: 0,
          });
        if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
        return json({});
      };
    },
    [
      JSON.stringify({
        token: 'sahte-jeton-uzunlugu-yeterli-olsun-diye-uzatildi',
        rol: 'ogrenci',
        ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A' },
      }),
      JSON.stringify(odevler),
    ],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { s, p };
}

/** Ekranda çizilen Ewalu pozunu DOSYA ADINDAN okur. */
async function pozOku(p) {
  const src = await p.evaluate(() => {
    const img = document.querySelector('img[src*="/ewalu/"]');
    return img ? img.getAttribute('src') : '';
  });
  const m = String(src).match(/\/ewalu\/([a-z]+)-portre-/);
  return m ? m[1] : `(poz okunamadı: ${src})`;
}

const DURUMLAR = [
  {
    ad: 'A — hiç ödev yayınlanmamış',
    odevler: [],
    cumle: 'Henüz ödev yayınlanmadı.',
    poz: 'kesif',
  },
  {
    ad: 'B — ödevler var, hepsi gönderilmiş',
    odevler: [odev('a', true), odev('b', true)],
    cumle: 'Bütün ödevlerini gönderdin.',
    poz: 'kutlama',
  },
  {
    ad: 'C — bir ödev bekliyor',
    odevler: [odev('a', true), odev('b', false)],
    cumle: '1 ödevin seni bekliyor.',
    poz: 'calisma',
  },
];

for (const d of DURUMLAR) {
  console.log(d.ad);
  const { s, p } = await ac(d.odevler, '/ogrenci');
  const metin = await p.evaluate(() => document.body.innerText);
  const poz = await pozOku(p);

  de(metin.includes(d.cumle), `cümle: "${d.cumle}"`);
  de(poz === d.poz, `poz: ${d.poz} (ekranda: ${poz})`);

  // ÖTEKİ İKİ CÜMLE ORADA DEĞİL. Yalnız doğru cümleyi aramak, üçünü
  // birden yazan bir kusuru geçirirdi.
  for (const o of DURUMLAR) {
    if (o.cumle === d.cumle) continue;
    de(!metin.includes(o.cumle), `"${o.cumle}" BURADA yok`);
  }

  de(!metin.includes('Eline sağlık'), '"Eline sağlık" ekranda yok');
  await s.close();
}

/**
 * DÖRDÜNCÜ ÖLÇÜM — İKİ EKRAN AYRIŞMIYOR.
 *
 * Cümle daha önce `OgrenciPano.tsx` ve `Odevlerim.tsx` içinde AYRI AYRI
 * yazılıydı. Birini düzeltip ötekini unutmak bu turun en olası kusuru;
 * ölçüm tam olarak onu arıyor.
 *
 * "Hiç ödev yok" durumu burada YOK ve bu bilinçli: o durumda Ödevlerim
 * ekranı boş durumu gösteriyor ("Henüz ödev yok"), üst satır hiç
 * çizilmiyor. İki ekranın aynı şeyi söylemesi beklenen yer, ödev
 * olduğu durumlar.
 */
console.log('D — Pano ile Ödevlerim aynı cümleyi veriyor');
for (const d of DURUMLAR.filter((x) => x.odevler.length > 0)) {
  const { s, p } = await ac(d.odevler, '/ogrenci/odevler');
  const metin = await p.evaluate(() => document.body.innerText);
  de(metin.includes(d.cumle), `Ödevlerim, ${d.ad}: "${d.cumle}"`);
  de(!metin.includes('Eline sağlık'), `Ödevlerim, ${d.ad}: "Eline sağlık" yok`);
  await s.close();
}

/** Hiç ödev yokken Ödevlerim üst satırı boş durumu TEKRARLAMIYOR. */
console.log('E — hiç ödev yokken Ödevlerim tek kez konuşuyor');
{
  const { s, p } = await ac([], '/ogrenci/odevler');
  const metin = await p.evaluate(() => document.body.innerText);
  de(metin.includes('Henüz ödev yok'), 'boş durum görünüyor');
  de(!metin.includes('Henüz ödev yayınlanmadı.'), 'üst satır aynı şeyi tekrar etmiyor');
  await s.close();
}

await b.close();
console.log(hata === 0 ? '\nPANO DİLİ DENETİMİ: KUSUR YOK' : `\nPANO DİLİ DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
