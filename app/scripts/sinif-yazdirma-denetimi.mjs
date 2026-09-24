/**
 * SINIF ÇIKTISI — TARAYICIDA, GERÇEKTEN YAZDIRMA KİPİNDE (26. denetim)
 *
 * Öğretmenin isteği: *"Öğrenciler sekmesinde sınıflara tıkladığımda çıkan
 * öğrenci listesi yazdırılabilir olsun istediğim zaman. Okulun adı
 * Arnavutköy Korkmaz Yiğit Anadolu Lisesi olarak ve yazdırdığım tarih
 * olsun çıktıda."*
 *
 * NEDEN `emulateMedia({ media: 'print' })`: bu ekranın vaatlerinin çoğu
 * YALNIZ kâğıtta geçerli — künye ekranda gizli, kabuk kâğıtta gizli,
 * seçilmeyen bölüm kâğıttan düşüyor. Ekran kipinde bakan bir denetim
 * bunların hiçbirini ölçemez; 0038'de "Çıkış düğmesi kâğıda çıkıyor"
 * kusuru tam olarak böyle bulunmuştu.
 *
 * ALTI ÖLÇÜM:
 *   1. Öğrenciler sekmesinde "Yazdır" düğmesi var ve ekrana götürüyor.
 *   2. KÂĞITTA künye var: okul adı + sınıf + tarih. Kabuk (yan menü,
 *      üst çubuk) ve ekranın kendi düğmeleri kâğıtta YOK.
 *   3. Sınıf listesi kâğıtta: her öğrenci bir satır, verilen/yapılan/
 *      yapılmayan/ortalama ve konu başlıkları.
 *   4. VELİ FİŞİ TEK ÖĞRENCİ TAŞIYOR — bu ekranın asıl güvencesi.
 *      Bir fişin içinde başka bir öğrencinin adı geçmiyor.
 *   5. "Sınıf listesini yazdır" seçilince veli fişleri kâğıttan
 *      DÜŞÜYOR, tersi de. Öğretmen istemediği kâğıdı almasın.
 *   6. 360 px'de yatay taşma yok (ekran tarafı).
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';
const OKUL = 'Arnavutköy Korkmaz Yiğit Anadolu Lisesi';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 3 },
];

/** Üç ayırt edilebilir öğrenci: biri tam, biri eksikli, biri ödevsiz. */
const OGRENCILER = [
  {
    id: 'o1',
    ad: 'Ada Yazdirma',
    ogrenci_no: '601',
    tur: 'okul',
    ortalama: 78.25,
    odev_sayisi: 6,
    yapilan: 6,
    yapilmayan: 0,
    eksik_konular: ['Koklu Sayilar'],
  },
  {
    id: 'o2',
    ad: 'Berk Yazdirma',
    ogrenci_no: '602',
    tur: 'okul',
    ortalama: 54.5,
    odev_sayisi: 6,
    yapilan: 4,
    yapilmayan: 2,
    eksik_konular: ['Uslu Ifadeler', 'Carpanlara Ayirma', 'Denklemler'],
  },
  {
    id: 'o3',
    ad: 'Ceren Yazdirma',
    ogrenci_no: '603',
    tur: 'okul',
    ortalama: null,
    odev_sayisi: 0,
    yapilan: 0,
    yapilmayan: 0,
    eksik_konular: [],
  },
];

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

const b = await chromium.launch();
const s = await b.newContext({ viewport: { width: 1280, height: 900 } });

await s.addInitScript(
  ([oturum, siniflar, ogrenciler]) => {
    localStorage.setItem('sekiz_oturum', oturum);
    // YAZDIRMA PENCERESİ AÇILMASIN: Playwright'ta `window.print()` sayfayı
    // kilitler. Çağrıldığı SAYILIYOR, açılmıyor.
    window.__yazdirma = 0;
    window.print = () => {
      window.__yazdirma += 1;
    };
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
      if (m[1] === 'siniflar_listesi') return json(siniflar);
      if (m[1] === 'sinif_ogrenci_ozeti')
        return json({ sinif: { id: 's9a', ad: '9A', ozel: false }, ogrenciler });
      if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
      if (m[1] === 'ben_kimim')
        return json({ id: 'g1', ad: 'Buket', sahip: true, vekalet: false, vekil: null });
      return json({});
    };
  },
  [
    JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
    SINIFLAR,
    OGRENCILER,
  ],
);

const p = await s.newPage();

/** Kâğıda GERÇEKTEN çıkan metin: yazdırma kipinde okunuyor. */
const kagit = async () => {
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(250);
  const t = await p.evaluate(() => document.body.innerText);
  await p.emulateMedia({ media: 'screen' });
  return t;
};

// ===========================================================================
console.log('1 — ÖĞRENCİLER SEKMESİNDEN GİDİLİYOR');
// ===========================================================================
{
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: /^9A/ }).first().click();
  await p.waitForTimeout(700);

  de((await p.getByRole('button', { name: 'Yazdır', exact: true }).count()) === 1, 'sınıf özetinde "Yazdır" düğmesi var');

  await p.getByRole('button', { name: 'Yazdır', exact: true }).click();
  await p.waitForTimeout(800);
  de(p.url().includes('/ogretmen/ogrenciler/yazdir/s9a'), `çıktı ekranına gidildi (${p.url()})`);
}

// ===========================================================================
console.log('2 — KÂĞITTA KÜNYE VAR, KABUK YOK');
// ===========================================================================
{
  const k = await kagit();
  de(k.includes(OKUL), 'okul adı kâğıtta');
  de(/\b9A\b/.test(k), 'sınıf adı kâğıtta');
  de(/20\d\d/.test(k) && /\d{2}:\d{2}/.test(k), 'tarih ve saat kâğıtta');

  // KÜNYENİN KENDİSİ ÇİZİLİYOR MU — yukarıdaki üç iddia bunu ölçmüyor.
  // Prova söyledi: künyeyi tümden kaldırdım ve hiçbir şey kırılmadı,
  // çünkü okul adı ve tarih VELİ FİŞLERİNİN alt notunda da var. Üç iddia
  // da oradan karşılanıyordu — künye ölçümü ölüydü.
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(200);
  const kunyeKagitta = await p.evaluate(() => {
    const d = document.querySelector('.sk-cikti-kunye');
    return d ? getComputedStyle(d).display !== 'none' : null;
  });
  await p.emulateMedia({ media: 'screen' });
  de(kunyeKagitta === true, `çıktının künyesi kâğıtta çiziliyor (${kunyeKagitta})`);

  // Kabuk ve ekranın kendi düğmeleri kâğıda çıkmamalı.
  de(!k.includes('Çıkış'), 'kabuk kâğıtta YOK (Çıkış düğmesi basılmıyor)');
  de(!k.includes('Sınıf listesini yazdır'), 'ekranın yazdırma düğmeleri kâğıtta YOK');

  // KÜNYE EKRANDA GÖRÜNMÜYOR — aynı bilgi ekranda zaten başlıkta.
  //
  // ÖLÇÜM KÜNYEYE DARALTILDI. İlk yazımda "okul adı ekranda hiç geçmesin"
  // diyordu ve KIRILDI — ama kusur üründe değildi: okul adı veli fişinin
  // alt notunda da var ve orada OLMASI gerekiyor (fiş kesilip veriliyor).
  // İddia künyenin kendisi hakkında olmalı.
  const kunyeEkranda = await p.evaluate(() => {
    const d = document.querySelector('.sk-cikti-kunye');
    return d ? getComputedStyle(d).display !== 'none' : null;
  });
  de(kunyeEkranda === false, `künye ekranda çizilmiyor, yalnız kâğıtta (${kunyeEkranda})`);
}

// ===========================================================================
console.log('3 — SINIF LİSTESİ KÂĞITTA');
// ===========================================================================
{
  const k = await kagit();
  for (const o of OGRENCILER) {
    de(k.includes(o.ad), `${o.ad} listede`);
  }
  de(k.includes('Yapılmayan'), 'yapılmayan sütunu var');
  de(k.includes('Koklu Sayilar'), 'konu başlığı listede');
  de(/süresi dolmuş/.test(k), 'sayıların kapsamı kâğıtta yazılı');
}

// ===========================================================================
console.log('4 — VELİ FİŞİ TEK ÖĞRENCİ TAŞIYOR');
// ===========================================================================
{
  // BU EKRANIN ASIL GÜVENCESİ. Fiş kesilip veliye veriliyor; içinde başka
  // bir çocuğun adı geçerse o bilgi yanlış kişiye gitmiş olur.
  const fisler = await p.evaluate(() =>
    [...document.querySelectorAll('.sk-veli-fis')].map((d) => d.innerText),
  );
  de(fisler.length === 3, `her öğrenciye bir fiş (${fisler.length})`);

  const sizinti = fisler.filter(
    (f, i) => OGRENCILER.some((o, j) => j !== i && f.includes(o.ad)),
  );
  de(sizinti.length === 0, `hiçbir fişte başka öğrencinin adı yok (${sizinti.length})`);

  const berk = fisler.find((f) => f.includes('Berk Yazdirma')) ?? '';
  de(berk.includes('Verilen ödev: 6'), 'fişte verilen ödev sayısı');
  de(berk.includes('Yapılan: 4'), 'fişte yapılan');
  de(berk.includes('Yapılmayan: 2'), 'fişte yapılmayan');
  de(berk.includes('Ortalama: 54,5'), 'fişte ortalama, Türkçe ondalıkla');
  de(
    berk.includes('Uslu Ifadeler') && berk.includes('Denklemler'),
    'fişte konu BAŞLIKLARI (çoğul)',
  );
  de(berk.includes(OKUL), 'fiş kesildikten sonra da okul adını taşıyor');

  // ORTALAMASI OLMAYANIN FİŞİNE SIFIR BASILMIYOR.
  const ceren = fisler.find((f) => f.includes('Ceren Yazdirma')) ?? '';
  de(ceren.includes('henüz ödev yok'), 'ödevi olmayanın fişinde sıfır değil, cümle');
  de(!/Ortalama: 0/.test(ceren), 'ödevi olmayana "Ortalama: 0" basılmıyor');
}

// ===========================================================================
console.log('5 — SEÇİLMEYEN BÖLÜM KÂĞITTAN DÜŞÜYOR');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Sınıf listesini yazdır' }).click();
  await p.waitForTimeout(400);
  de((await p.evaluate(() => window.__yazdirma)) === 1, 'yazdırma bir kez çağrıldı');

  // FİŞ ETİKETİ KÂĞITTA BÜYÜK HARF (CSS `uppercase`) ve `innerText`
  // ÇİZİLEN hâli veriyor. İlk yazımda harfe duyarlı arandı: "düştü"
  // iddiası her zaman doğru çıkıyordu — yani ölü bir ölçümdü, ikizi de
  // haksız yere kırmızı yandı.
  //
  // İKİNCİ TUZAK, TÜRKÇEYE ÖZGÜ: düzeltirken `/veli bilgi fişi/i` yazdım
  // ve O DA TUTMADI. Tarayıcı "fişi"yi "FİŞİ" yapıyor — noktalı büyük İ
  // (U+0130). Regex'in `i` bayrağı Unicode basit katlama kullanıyor ve
  // U+0130 orada küçük "i"ye katlanmıyor. Karşılaştırma TÜRKÇE YERELLE
  // küçültülerek yapılıyor.
  const fisVarMi = (metin) => metin.toLocaleLowerCase('tr').includes('veli bilgi fişi');

  let k = await kagit();
  de(k.includes('Ada Yazdirma'), 'sınıf listesi kâğıtta duruyor');
  de(!fisVarMi(k), 'veli fişleri kâğıttan düştü');

  await p.getByRole('button', { name: 'Veli fişlerini yazdır' }).click();
  await p.waitForTimeout(400);
  de((await p.evaluate(() => window.__yazdirma)) === 2, 'ikinci yazdırma da çağrıldı');

  k = await kagit();
  de(fisVarMi(k), 'veli fişleri kâğıtta');
  de(!k.includes('Yapılmayan\t') && !k.includes('Ad Soyad'), 'sınıf listesi tablosu kâğıttan düştü');
}

// ===========================================================================
console.log('6 — 360 px');
// ===========================================================================
{
  await p.setViewportSize({ width: 360, height: 800 });
  await p.waitForTimeout(400);
  const fark = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(fark <= 0, `360 px yatay taşma yok (${fark}px)`);
}

await s.close();
await b.close();
console.log(hata === 0 ? '\nSINIF ÇIKTISI UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
