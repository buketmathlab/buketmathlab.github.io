/**
 * BİLDİRİMLER — TARAYICIDA (27. denetim)
 *
 * Öğretmenin isteği: *"her mesajda, ödev verildiğinde, ödev teslimi
 * yaklaştığında, ödev sonucu açıklandığında öğrenciye bildirim gitsin."*
 *
 * ALTI ÖLÇÜM:
 *
 *   1. ZİL ÜST SATIRDA, ROZETİYLE — ve 360 px'de ÖĞRENCİNİN ADI
 *      KESİLMİYOR. Plan bu kararı masa başında vermedi: "zil eklenince ad
 *      kesiliyorsa geri adım beşinci sekme" yazdı. Ölçüm burada;
 *      `scrollWidth > clientWidth` olursa kırmızı yanar ve kararı ölçüm
 *      verir. Yatay taşma ayrıca sayılıyor.
 *   2. LİSTE DÖRT TÜRÜ DE ÇİZİYOR ve EN YENİ EN ÜSTTE. Sıra EKRANDAN
 *      okunuyor, veriden değil. Ödev adları bilerek ayırt edici: zaman
 *      sırası ile alfabetik sıra AYNI DÜŞMÜYOR (0053'ün dersi — düşerse
 *      ölçüm hiçbir şey kanıtlamaz).
 *   3. EKRAN AÇILINCA ROZET DÜŞÜYOR. `bildirim_goruldu` isteğinin
 *      gerçekten gittiği sayılıyor ve zilin erişilebilir adı yeniden
 *      okunuyor — "damgayı yazdım" demek yetmez.
 *   4. VELİ EKRANINDA "TESLİMİ YARIN" YOK — ve arayüzde İKİNCİ BİR
 *      SÜZGEÇ DE YOK. 4a sunucunun o satırı hiç göndermediğini, 4b
 *      (negatif kontrol) satır gelse arayüzün onu ÇİZECEĞİNİ ölçüyor.
 *      İkincisi olmadan 4a, arayüze sessizce eklenmiş bir süzgeci
 *      sunucunun güvencesi sanardı; oysa kural tersi (Part XXI:
 *      göstermediğini gönderme) ve güvence `_bildirimlerim`'de.
 *   5. BOŞ DURUM cümlesi beklenti yaratmıyor.
 *   6. ÜRÜN DİLİ: ekranda yasak kalıp yok. Kalıplar `src/lib/urun-dili.ts`
 *      KAYNAĞINDAN okunuyor — ikinci bir liste bir gün ayrışırdı.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 * VE `npm run build` — 0053'te derlemeden koşulan bir denetim yanlış
 * yeşil verdi.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/**
 * ÖĞRENCİNİN ADI BİLEREK UZUN. 360 px ölçümü kısa bir adla yapılırsa
 * hiçbir şey kanıtlamaz; gerçek bir sınıf listesinde bu uzunlukta ad var.
 * (Depo herkese açık — ad uydurma.)
 */
const OGRENCI_ADI = 'Abdurrahman Şahinoğlu';

/** Zaman sırası: mesaj → Üslü → Basit → Çarpanlara. Alfabetik sıra BAŞKA. */
const dk = (n) => new Date(Date.now() - n * 60000).toISOString();

const SATIRLAR_OGRENCI = [
  { tur: 'mesaj', zaman: dk(5), baslik: null, odev_id: null, yeni: true },
  { tur: 'odev', zaman: dk(120), baslik: 'Üslü Sayılar', odev_id: 'd1', yeni: true },
  { tur: 'teslim', zaman: dk(600), baslik: 'Basit Eşitsizlikler', odev_id: 'd2', yeni: true },
  { tur: 'sonuc', zaman: dk(4000), baslik: 'Çarpanlara Ayırma', odev_id: 'd3', yeni: false },
];

/** Veli üç tür alıyor: `teslim` sunucudan HİÇ GELMİYOR. */
const SATIRLAR_VELI = SATIRLAR_OGRENCI.filter((s) => s.tur !== 'teslim');

/** 4b — negatif kontrol: satır gelirse arayüz onu çizmeli. */
const SATIRLAR_VELI_DENEY = SATIRLAR_OGRENCI;

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

/**
 * Metin karşılaştırmaları Türkçe kurallarıyla küçük harfe çevrilerek
 * yapılıyor: 0053'te büyük İ (U+0130) tuzağı ölçümü İKİ KEZ yanlış yere
 * bastırdı — `includes` de, `/…/i` de tutmadı.
 */
const icerir = (metin, parca) =>
  metin.toLocaleLowerCase('tr').includes(parca.toLocaleLowerCase('tr'));

const b = await chromium.launch();

/**
 * Bir rol için sahte sunucuyla oturum kurar.
 *
 * Sahte sunucu DAMGAYI GERÇEKTEN UYGULUYOR: `bildirim_goruldu`
 * çağrıldıktan sonra `bildirim_sayim` sıfır dönüyor. Hep aynı sayıyı
 * döndürseydi 3. ölçüm, ekran hiçbir şey yapmasa da yeşil yanabilirdi.
 */
async function otur(rol, satirlar) {
  const s = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await s.addInitScript(
    ([oturum, liste, ad]) => {
      localStorage.setItem('sekiz_oturum', oturum);
      window.__cagrilar = [];
      const asil = window.fetch;
      const json = (o) =>
        new Response(JSON.stringify(o), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      let goruldu = false;
      const yeniSayisi = () => (goruldu ? 0 : liste.filter((x) => x.yeni).length);

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

        if (m[1] === 'bildirim_sayim') return json({ yeni: yeniSayisi() });
        if (m[1] === 'bildirim_goruldu') {
          goruldu = true;
          return json({ durum: 'tamam' });
        }
        if (m[1] === 'bildirimlerim')
          return json({
            bildirimler: liste,
            toplam_yeni: liste.filter((x) => x.yeni).length,
          });
        if (m[1] === 'ogrenci_odevleri')
          return json({ ogrenci: { ad, tur: 'okul' }, odevler: [], okunmamis_mesaj: 0 });
        if (m[1] === 'veli_paneli')
          return json({
            ogrenci: { ad, tur: 'okul' },
            odevler: [],
            odemeler: [],
            okunmamis_mesaj: 0,
            onam_gerekli: false,
          });
        return json({});
      };
    },
    [JSON.stringify({ token: 'sahte', rol, ogrenci: { ad, sinif: '9A' } }), satirlar, ad],
  );
  return s;
}

const ad = OGRENCI_ADI;

// ===========================================================================
console.log('1 — ZİL ÜST SATIRDA, 360 px’DE AD KESİLMİYOR');
// ===========================================================================
const so = await otur('ogrenci', SATIRLAR_OGRENCI);
const p = await so.newPage();
const metin = () => p.evaluate(() => document.body.innerText);
const cagrilar = () => p.evaluate(() => window.__cagrilar);
const zilAdi = () =>
  p.evaluate(() => {
    const a = [...document.querySelectorAll('a[aria-label]')].find((x) =>
      x.getAttribute('aria-label').startsWith('Bildirimler'),
    );
    return a ? a.getAttribute('aria-label') : null;
  });

{
  await p.goto(KOK + '#/ogrenci', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  const etiket = await zilAdi();
  de(etiket !== null, `zil üst satırda (${etiket})`);
  de(etiket !== null && icerir(etiket, '3 yeni'), `zilin adı yeni sayısını söylüyor (${etiket})`);

  // Rozet GÖRSEL olarak da çizilmiş mi: ad taşıyor diye rozet çizilmiş
  // sayılamaz, ikisi ayrı kod yolu.
  const rozet = await p.evaluate(() => {
    const a = [...document.querySelectorAll('a[aria-label]')].find((x) =>
      x.getAttribute('aria-label').startsWith('Bildirimler'),
    );
    return a ? (a.querySelector('.sk-sayi')?.textContent.trim() ?? null) : null;
  });
  de(rozet === '3', `rozet sayıyı çiziyor (${rozet})`);

  await p.setViewportSize({ width: 360, height: 800 });
  await p.waitForTimeout(500);

  // ASIL SORU: zil, öğrencinin adını KESTİ Mİ.
  //
  // İlk yazımda ad `truncate` taşıyordu ve bu ölçüm kırmızı yandı
  // (148 gereken / 84 olan). Ölçüm doğru işini yaptı: `truncate` geri
  // alındı, çünkü ortak bir tablette kesilmiş bir ad öğrencinin doğru
  // hesapta olduğunu doğrulayamaz. Ad artık SARIYOR, kesilmiyor —
  // `scrollWidth <= clientWidth` sarma durumunda da doğru.
  //
  // Ölçülen taban: zilsiz hâlde de bu uzunlukta bir ad iki satıra
  // iniyordu ve başlık yüksekliği aynıydı; yani zilin bedeli yok.
  const adOlcu = await p.evaluate((a) => {
    const el = [...document.querySelectorAll('header span')].find(
      (x) => x.textContent.trim() === a,
    );
    const h = document.querySelector('header');
    return el
      ? { s: el.scrollWidth, c: el.clientWidth, h: h.getBoundingClientRect().height }
      : null;
  }, ad);
  de(adOlcu !== null, 'öğrencinin adı üst satırda çizili');
  de(
    adOlcu !== null && adOlcu.s <= adOlcu.c,
    `360 px’de ad kesilmiyor (${adOlcu?.s} ≤ ${adOlcu?.c}) — kesilirse geri adım beşinci sekme`,
  );
  // ZİLSİZ TABANDA ÖLÇÜLEN BAŞLIK YÜKSEKLİĞİ 73,75 px. Zil bu satırı
  // büyütmemeli; büyütüyorsa ekranın üstünden yer çalıyor demektir.
  de(
    adOlcu !== null && adOlcu.h <= 74,
    `başlık zilsiz tabandan yüksek değil (${adOlcu?.h} ≤ 74)`,
  );
  de((await zilAdi()) !== null, '360 px’de zil duruyor');

  const fark = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(fark <= 0, `360 px yatay taşma yok (${fark}px)`);

  await p.setViewportSize({ width: 1280, height: 900 });
  await p.waitForTimeout(300);
}

// ===========================================================================
console.log('2 — DÖRT TÜR, EN YENİ EN ÜSTTE');
// ===========================================================================
{
  await p.getByRole('link', { name: /^Bildirimler/ }).click();
  await p.waitForTimeout(900);

  const t = await metin();
  de(icerir(t, 'Öğretmeninden yeni mesaj'), 'mesaj satırı çizildi');
  de(icerir(t, 'Yeni ödev: Üslü Sayılar'), 'yeni ödev satırı çizildi');
  de(icerir(t, 'Basit Eşitsizlikler ödevinin teslimi yarın'), 'teslim satırı çizildi');
  de(icerir(t, 'Çarpanlara Ayırma değerlendirildi'), 'sonuç satırı çizildi');

  // SIRA EKRANDAN OKUNUYOR. Veriye bakan bir ölçüm, arayüz listeyi ters
  // çevirse de yeşil kalırdı.
  const sira = await p.evaluate(() =>
    [...document.querySelectorAll('[data-test="bildirim-listesi"] > li')].map((l) =>
      l.innerText.split('\n')[0].trim(),
    ),
  );
  de(sira.length === 4, `dört satır çizildi (${sira.length})`);
  de(icerir(sira[0] ?? '', 'yeni mesaj'), `en üstteki en yeni (${sira[0]})`);
  de(icerir(sira[1] ?? '', 'Üslü Sayılar'), `ikinci sırada Üslü Sayılar (${sira[1]})`);
  de(icerir(sira[2] ?? '', 'Basit Eşitsizlikler'), `üçüncü sırada Basit Eşitsizlikler (${sira[2]})`);
  de(icerir(sira[3] ?? '', 'Çarpanlara Ayırma'), `en altta en eski (${sira[3]})`);

  // DÜRÜST SINIR EKRANDA YAZILI: telefona bildirim gitmiyor.
  de(icerir(t, 'telefona ayrıca bildirim gönderilmez'), 'ekran telefona bildirim gitmediğini söylüyor');
  de(icerir(t, '30 gün'), 'ekran listenin kapsamını söylüyor');

  // SONUÇ SATIRI PUAN TAŞIMIYOR: aynı telefona bakan bir kardeş puanı
  // görmesin.
  const sonucSatiri = sira[3] ?? '';
  de(!/\d/.test(sonucSatiri), `sonuç satırında sayı yok (${sonucSatiri})`);
}

// ===========================================================================
console.log('3 — EKRAN AÇILINCA ROZET DÜŞÜYOR');
// ===========================================================================
{
  const damga = (await cagrilar()).filter((c) => c.ad === 'bildirim_goruldu');
  de(damga.length === 1, `bildirim_goruldu bir kez çağrıldı (${damga.length})`);

  // Rota değişimi sayımı yeniden yokluyor (`useBildirimSayim`).
  await p.goto(KOK + '#/ogrenci', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const etiket = await zilAdi();
  de(etiket === 'Bildirimler', `rozet düştü (${etiket})`);
  const rozet = await p.evaluate(() => document.querySelector('header .sk-sayi'));
  de(rozet === null, 'rozet artık çizilmiyor');
}
await so.close();

// ===========================================================================
console.log('4 — VELİDE TESLİM SATIRI YOK, ARAYÜZDE SÜZGEÇ DE YOK');
// ===========================================================================
{
  // (a) Sunucunun gönderdiği üç tür çiziliyor, "teslimi yarın" yok.
  const sv = await otur('veli', SATIRLAR_VELI);
  const pv = await sv.newPage();
  await pv.goto(KOK + '#/veli/bildirimler', { waitUntil: 'networkidle' });
  await pv.waitForTimeout(900);

  const t = await pv.evaluate(() => document.body.innerText);
  de(!icerir(t, 'teslimi yarın'), '4a: veli ekranında "teslimi yarın" yok');
  // POZİTİF KONTROL: ekran gerçekten çizildi — yoksa yokluk, "sayfa hiç
  // yüklenmedi" yüzünden de doğru çıkardı.
  de(icerir(t, 'Öğretmeninizden yeni mesaj'), '4a pozitif kontrol: veli sesiyle mesaj satırı var');
  de(icerir(t, 'Yeni ödev: Üslü Sayılar'), '4a pozitif kontrol: ödev satırı çizildi');
  de(!icerir(t, 'Öğretmeninden yeni mesaj'), '4a: veliye öğrenci sesiyle yazılmıyor');
  await sv.close();

  // (b) NEGATİF KONTROL: satır gelirse arayüz ONU ÇİZİYOR. Arayüzde
  // ikinci bir süzgeç olsaydı burası kırmızı yanardı — ve 4a'nın
  // güvencesi sunucudan değil arayüzden geliyor olurdu.
  const sd = await otur('veli', SATIRLAR_VELI_DENEY);
  const pd = await sd.newPage();
  await pd.goto(KOK + '#/veli/bildirimler', { waitUntil: 'networkidle' });
  await pd.waitForTimeout(900);

  const td = await pd.evaluate(() => document.body.innerText);
  de(
    icerir(td, 'Basit Eşitsizlikler ödevinin teslimi yarın'),
    '4b negatif kontrol: sunucu gönderirse arayüz çiziyor (arayüzde süzgeç yok)',
  );
  await sd.close();
}

// ===========================================================================
console.log('5 — BOŞ DURUM');
// ===========================================================================
{
  const sb = await otur('ogrenci', []);
  const pb = await sb.newPage();
  await pb.goto(KOK + '#/ogrenci/bildirimler', { waitUntil: 'networkidle' });
  await pb.waitForTimeout(900);

  const t = await pb.evaluate(() => document.body.innerText);
  de(icerir(t, 'Henüz bildirim yok'), 'boş durum cümlesi çizildi');
  de(
    !/yakında|birazdan|gelecek/i.test(t),
    'boş durum söz vermiyor (yakında/birazdan/gelecek yok)',
  );
  // Boş listede de dürüst sınır yazıyor: "bana haber gelir mi?" sorusu
  // tam o anda doğuyor.
  de(icerir(t, 'telefona ayrıca bildirim gönderilmez'), 'boş listede de sınır yazılı');

  const rozet = await pb.evaluate(() => document.querySelector('header .sk-sayi'));
  de(rozet === null, 'boş listede rozet çizilmiyor');
  await sb.close();
}

// ===========================================================================
console.log('6 — ÜRÜN DİLİ');
// ===========================================================================
{
  // Kalıplar KAYNAKTAN okunuyor: ikinci bir liste yazsaydım bir gün
  // ayrışır ve denetim, kuralın eski hâlini korurdu.
  const kaynak = readFileSync(new URL('../src/lib/urun-dili.ts', import.meta.url), 'utf8');
  const kaliplar = [...kaynak.matchAll(/kalip:\s*'([^']+)'/g)].map((m) => m[1]);
  de(kaliplar.length >= 10, `kalıp listesi kaynaktan okundu (${kaliplar.length})`);

  const sk = await otur('ogrenci', SATIRLAR_OGRENCI);
  const pk = await sk.newPage();
  await pk.goto(KOK + '#/ogrenci/bildirimler', { waitUntil: 'networkidle' });
  await pk.waitForTimeout(900);
  const t = (await pk.evaluate(() => document.body.innerText)).toLocaleLowerCase('tr');

  const bulunan = kaliplar.filter((k) => t.includes(k.toLocaleLowerCase('tr')));
  de(bulunan.length === 0, `ekranda yasak kalıp yok (${bulunan.join(', ') || 'yok'})`);

  // BASKI KURAN SÖZCÜK YOK: teslim cümlesi gerçeği söylüyor, acele
  // ettirmiyor (öğretmenin dil kuralı).
  de(
    !/yetiştir|acele|unutma|son şans/.test(t),
    'teslim cümlesi baskı kurmuyor (yetiştir/acele/unutma/son şans yok)',
  );
  await sk.close();
}

await b.close();
console.log(hata === 0 ? '\nBİLDİRİMLER UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
