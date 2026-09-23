/**
 * ÖĞRENCİ ÇIKARMA — TARAYICIDA (25. denetim)
 *
 * Öğretmenin isteği: *"Öğrenci çıkarmak ayarlar içerisinde bir sekmede
 * olsun."*
 *
 * Çıkar düğmesi Öğrenciler sekmesinde her satırın sağındaydı. Geri
 * alınamaz bir iş, en sık açılan listenin kenarında duruyordu. Taşındı.
 *
 * ALTI ÖLÇÜM:
 *
 *   1. ÖĞRENCİLER SEKMESİNDE ÇIKAR YOK — ne arama sonuçlarında ne sınıf
 *      özetinde. Taşıdım demek yetmez; sayılıyor. Satırların gerçekten
 *      çizildiği ayrıca doğrulanıyor (pozitif kontrol) — yoksa sıfır,
 *      "ekran hiç yüklenmedi" yüzünden de çıkardı.
 *   2. AYARLAR'DAN GİDİLİYOR ve ekran açılıyor.
 *   3. ONAYSIZ SUNUCUYA İSTEK GİTMİYOR. 0024 ve 0045'te ölçülen vaadin
 *      aynısı: "onay diyaloğu koydum" demek yetmez, isteğin gerçekten
 *      gitmediği sayılıyor. Onay metni kimi çıkardığını ADIYLA ve
 *      geri alınamayacağını söylüyor.
 *   4. ONAYDAN SONRA İSTEK GİDİYOR, doğru öğrenciyi taşıyor ve satır
 *      listeden düşüyor.
 *   5. ÖZEL DERS ÖĞRENCİSİ ERİŞİLEBİLİR. Bu ekran sınıf sınıf gitseydi
 *      onların `sinif_id`'si olmadığı için hiç ulaşılamazdı; tasarımın
 *      asıl gerekçesi bu ve ölçülüyor.
 *   6. 360 px'de yatay taşma yok.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 2 },
];

/** İkisi okul, biri ÖZEL DERS — 5. ölçüm bunun için var. */
const OGRENCILER = [
  { id: 'o1', ad: 'Ayrılan Öğrenci', ogrenci_no: '601', tur: 'okul', sinif: '9A' },
  { id: 'o2', ad: 'Kalan Öğrenci', ogrenci_no: '602', tur: 'okul', sinif: '9A' },
  { id: 'o3', ad: 'Özel Ders Deneği', ogrenci_no: null, tur: 'ozel', sinif: null },
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
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) =>
      new Response(JSON.stringify(o), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    // Sahte sunucu ÇIKARMAYI GERÇEKTEN UYGULUYOR: pasifleştirilen
    // öğrenci bir daha listede dönmüyor. Hep aynı listeyi döndürseydi
    // "satır listeden düştü" ölçümü, ekran hiçbir şey yapmasa da
    // kırmızı yanar; tersi de olurdu — ölçüm anlamsızlaşırdı.
    let kalanlar = [...ogrenciler];

    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      let govde = null;
      try {
        govde = JSON.parse(String(o?.body ?? 'null'));
      } catch {
        /* gövde okunamadıysa null kalsın */
      }
      window.__cagrilar.push({ ad: m[1], govde });

      if (m[1] === 'siniflar_listesi') return json(siniflar);
      if (m[1] === 'ogrenciler_listesi') {
        const arama = govde?.p_arama;
        const sinif = govde?.p_sinif_id;
        const suzulen = kalanlar.filter(
          (k) =>
            (!arama || k.ad.toLowerCase().includes(String(arama).toLowerCase())) &&
            (!sinif || k.sinif === '9A'),
        );
        return json({
          toplam: suzulen.length,
          sayfa: 1,
          boyut: 25,
          toplam_sayfa: 1,
          kayitlar: suzulen,
        });
      }
      if (m[1] === 'sinif_ogrenci_ozeti')
        return json({
          sinif: { id: 's9a', ad: '9A', ozel: false },
          ogrenciler: kalanlar
            .filter((k) => k.sinif === '9A')
            .map((k) => ({
              id: k.id,
              ad: k.ad,
              ogrenci_no: k.ogrenci_no,
              tur: k.tur,
              ortalama: 60,
              odev_sayisi: 3,
              en_eksik_konu: 'Köklü Sayılar',
            })),
        });
      if (m[1] === 'ogrenci_pasiflestir') {
        kalanlar = kalanlar.filter((k) => k.id !== govde?.p_id);
        return json({ durum: 'tamam' });
      }
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
const metin = () => p.evaluate(() => document.body.innerText);
const cikarmaIstekleri = async () =>
  (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'ogrenci_pasiflestir');
/**
 * Listedeki SATIR sayısı — sayfanın tamamı değil.
 *
 * Satır adı kendi `<span>`'inde duruyor; bildirim, onay penceresi ve
 * başlık aynı adı taşıyabilir. Ölçüm satırı iddia ediyorsa satırı
 * saymalı.
 */
const satirSayisi = (ad) =>
  p.evaluate(
    (a) =>
      [...document.querySelectorAll('.space-y-2 span.font-semibold')].filter(
        (d) => d.textContent.trim() === a,
      ).length,
    ad,
  );

/** Metni TAM eşleşen düğmeleri sayar — alt dize tuzağına düşmeden. */
const dugmeSayisi = (etiket) =>
  p.evaluate(
    (e) => [...document.querySelectorAll('button')].filter((d) => d.textContent.trim() === e).length,
    etiket,
  );

// ===========================================================================
console.log('1 — ÖĞRENCİLER SEKMESİNDE ÇIKAR YOK');
// ===========================================================================
{
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  // (a) Sınıf özeti
  await p.getByRole('button', { name: /^9A/ }).first().click();
  await p.waitForTimeout(700);
  de((await dugmeSayisi('Çıkar')) === 0, `sınıf özetinde "Çıkar" yok (${await dugmeSayisi('Çıkar')})`);
  const t1 = await metin();
  de(t1.includes('Ayrılan Öğrenci'), 'pozitif kontrol: sınıf özeti satırları çizildi');

  // (b) Arama sonuçları
  await p.fill('input[type="search"]', 'Öğrenci');
  await p.waitForTimeout(800);
  de(
    (await dugmeSayisi('Çıkar')) === 0,
    `arama sonuçlarında "Çıkar" yok (${await dugmeSayisi('Çıkar')})`,
  );
  const t2 = await metin();
  de(t2.includes('Kalan Öğrenci'), 'pozitif kontrol: arama satırları çizildi');

  de(
    (await cikarmaIstekleri()).length === 0,
    'bu sekmeden hiç ogrenci_pasiflestir çağrılmadı',
  );
}

// ===========================================================================
console.log('2 — AYARLAR’DAN GİDİLİYOR');
// ===========================================================================
{
  await p.goto(KOK + '#/ogretmen/ayarlar', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);

  const t = await metin();
  de(t.includes('Öğrenci çıkarma'), 'Ayarlar’da "Öğrenci çıkarma" kartı var');

  await p.getByRole('button', { name: 'Çıkarma ekranını aç' }).click();
  await p.waitForTimeout(800);

  const adres = p.url();
  de(adres.includes('/ogretmen/ogrenciler/cikar'), `çıkarma ekranına gidildi (${adres})`);

  const e = await metin();
  de(e.includes('silinmez'), 'ekran verinin silinmediğini söylüyor');
  de(/geri alma yolu yoktur/.test(e), 'ekran geri alınamadığını söylüyor');
}

// ===========================================================================
console.log('3 — ONAYSIZ SUNUCUYA İSTEK GİTMİYOR');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Çıkar', exact: true }).first().click();
  await p.waitForTimeout(400);

  de((await cikarmaIstekleri()).length === 0, 'onay öncesi ogrenci_pasiflestir isteği YOK');

  const t = await metin();
  de(t.includes('Ayrılan Öğrenci'), 'onay metni kimi çıkardığını adıyla söylüyor');
  de(/geri alınamaz/.test(t), 'onay metni geri alınamaz olduğunu söylüyor');
  de(/silinmez/.test(t), 'onay metni verinin silinmediğini söylüyor');

  // Vazgeçmek gerçekten vazgeçiyor.
  await p.locator('dialog[open]').getByRole('button', { name: 'Vazgeç' }).click();
  await p.waitForTimeout(400);
  de((await cikarmaIstekleri()).length === 0, 'vazgeçince de istek gitmedi');
  de((await metin()).includes('Ayrılan Öğrenci'), 'vazgeçince öğrenci listede duruyor');
}

// ===========================================================================
console.log('4 — ONAYDAN SONRA ÇIKIYOR');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Çıkar', exact: true }).first().click();
  await p.waitForTimeout(400);
  await p.locator('dialog[open]').getByRole('button', { name: 'Evet, çıkar' }).click();
  await p.waitForTimeout(900);

  const istekler = await cikarmaIstekleri();
  de(istekler.length === 1, `tam bir ogrenci_pasiflestir isteği gitti (${istekler.length})`);
  de(istekler[0]?.govde?.p_id === 'o1', `istek doğru öğrenciyi taşıyor (${istekler[0]?.govde?.p_id})`);

  // ÖLÇÜM LİSTEYE DARALTILDI. `document.body.innerText`e bakmak yanlış
  // sonuç veriyordu: çıkarma bildirimi ("… listeden çıkarıldı.") adı
  // taşıyor ve ekranda birkaç saniye duruyor. Satır sayılıyor, sayfa
  // değil — ölçüm neyi ölçtüğünü iddia ediyorsa orayı okumalı.
  de(
    (await satirSayisi('Ayrılan Öğrenci')) === 0,
    `çıkarılan öğrenci listeden düştü (${await satirSayisi('Ayrılan Öğrenci')} satır)`,
  );
  de((await satirSayisi('Kalan Öğrenci')) === 1, 'öteki öğrenci listede duruyor');

  // Bildirim de kendi işini yapıyor: öğretmen ne olduğunu görüyor.
  de((await metin()).includes('listeden çıkarıldı'), 'çıkarıldığı öğretmene bildiriliyor');
}

// ===========================================================================
console.log('5 — ÖZEL DERS ÖĞRENCİSİ ERİŞİLEBİLİR');
// ===========================================================================
{
  // Bu ekranın sınıf sınıf değil tek aramalı liste olmasının ASIL
  // gerekçesi: özel ders öğrencilerinin sınıfı yok, sınıf kutusundan
  // hiç ulaşılamazlardı.
  const t = await metin();
  de(t.includes('Özel Ders Deneği'), 'özel ders öğrencisi listede');

  const sinifSuzgecli = (await p.evaluate(() => window.__cagrilar)).filter(
    (c) => c.ad === 'ogrenciler_listesi' && c.govde?.p_sinif_id,
  ).length;
  de(sinifSuzgecli === 0, `bu ekran sınıf süzgeci göndermiyor (${sinifSuzgecli})`);
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
console.log(hata === 0 ? '\nÖĞRENCİ ÇIKARMA UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
