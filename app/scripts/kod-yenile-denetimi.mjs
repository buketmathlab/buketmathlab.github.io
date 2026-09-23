/**
 * KODU YENİLE — TARAYICIDA (0045)
 *
 * NEDEN VAR: yenileme GERİ ALINAMAZ. Yanlışlıkla basılan bir düğme,
 * ailenin elindeki fişi o anda ölü kâğıda çevirir ve öğretmenin haberi
 * olmaz. Sunucu tarafı `kod_yenile_testleri.sql` ile ölçülüyor; burada
 * ölçülen şey EKRANIN VAADİ.
 *
 * EKRAN DEĞİŞTİ: yenileme Öğrenciler sekmesindeki `Kodlar` düğmesinin
 * arkasındaydı; öğretmen o düğmeyi istemedi ("Öğrenciler sekmesinin
 * içinde kodlara gerek yok") ve akış Kodlar ekranına taşındı. Bu denetim
 * yeni yerinde koşuyor — aynı dört vaat, yeni adres. 6. grup düğmenin
 * gerçekten kalktığını ayrıca sayıyor: taşımanın yarısı kalmasın.
 *
 * DÖRT ÖLÇÜM:
 *
 *   1. ONAYSIZ SUNUCUYA İSTEK GİTMİYOR. 0024'te kod fişleri için ölçülen
 *      vaadin aynısı. "Onay diyaloğu koydum" demek yetmez; isteğin
 *      gerçekten gitmediği sayılıyor.
 *   2. ONAYDAN SONRA YENİ KOD EKRANDA. Öğretmen onu hemen yazacak ya da
 *      fişini basacak; diyalog kapanıp kod kaybolursa özellik
 *      kullanılamaz olur.
 *   3. ESKİ KOD DOM'DA KALMIYOR. Yenilenen kod artık geçersiz; ekranda
 *      durması öğretmene yanlış kodu yazdırır. DEĞERE bakılıyor, alan
 *      adına değil (0021/0026 deseni).
 *   4. YENİ FİŞ HATIRLATMASI GÖRÜNÜYOR. Döngü, aile yeni kodu eline
 *      alana kadar kapanmıyor; ürün bunu söylemek zorunda.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 1 },
];

const OGRENCI = { id: 'o1', ad: 'Yenileme Deneği', ogrenci_no: '601', tur: 'okul', sinif: '9A' };

/** Kodlar birbirinden AYIRT EDİLEBİLİR: ölçüm değere bakıyor. */
const ESKI = { ogrenci: 'ESKIOGR1', veli: 'ESKIVELI' };
const YENI = { ogrenci: 'YENIOGR9', veli: 'YENIVELI' };

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
  ([oturum, siniflar, ogrenci, eski, yeni]) => {
    localStorage.setItem('sekiz_oturum', oturum);
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) =>
      new Response(JSON.stringify(o), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    // Sahte sunucu YENİLEMEYİ GERÇEKTEN UYGULUYOR: çağrıldıkça kod
    // değişiyor. Hep aynı kodu döndürseydi "yeni kod ekranda" ölçümü,
    // ekran hiçbir şey yapmasa da yeşil kalırdı.
    const kodlar = { ...eski };

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
      if (m[1] === 'ogrenciler_listesi')
        return json({ toplam: 1, sayfa: 1, boyut: 25, kayitlar: [ogrenci] });
      if (m[1] === 'ogrenci_kodlari') return json({ ...kodlar });
      // 0051 sınıf özeti — 6. grup Öğrenciler sekmesinde satır çizdirmek
      // için buna ihtiyaç duyuyor.
      if (m[1] === 'sinif_ogrenci_ozeti')
        return json({
          sinif: { id: 's9a', ad: '9A', ozel: false },
          ogrenciler: [
            {
              id: ogrenci.id,
              ad: ogrenci.ad,
              ogrenci_no: ogrenci.ogrenci_no,
              tur: ogrenci.tur,
              ortalama: 62.5,
              odev_sayisi: 4,
              en_eksik_konu: 'Köklü Sayılar',
            },
          ],
        });
      if (m[1] === 'kod_yenile') {
        const rol = govde?.p_rol;
        kodlar[rol] = yeni[rol];
        return json({ rol, kod: yeni[rol] });
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
    OGRENCI,
    ESKI,
    YENI,
  ],
);

const p = await s.newPage();
const metin = () => p.evaluate(() => document.body.innerText);
const yenilemeIstekleri = async () =>
  (await p.evaluate(() => window.__cagrilar)).filter((c) => c.ad === 'kod_yenile');

await p.goto(KOK + '#/ogretmen/kodlar/s9a', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

// ===========================================================================
console.log('1 — ONAYSIZ SUNUCUYA İSTEK GİTMİYOR');
// ===========================================================================
{
  // Kodlar ekranında kod öğrencinin ADINA dokununca açılıyor (0018'in
  // "aynı anda tek öğrenci" kuralı).
  await p.getByRole('button', { name: new RegExp(OGRENCI.ad) }).first().click();
  await p.waitForTimeout(400);

  const t = await metin();
  de(t.includes(ESKI.ogrenci), 'kodlar diyaloğu açıldı ve eski kod görünüyor');

  // Yenile'ye bas, ONAYLAMA.
  // `exact: true` ŞART: `getByRole` adı ALT DİZE olarak eşliyor ve
  // deneğin adı "Yenileme Deneği". Bu satırı gevşek yazmak, tıklamayı
  // öğrencinin satır düğmesine gönderiyor ve kodlar kapanıyordu.
  await p.getByRole('button', { name: 'Yenile', exact: true }).first().click();
  await p.waitForTimeout(400);

  de((await yenilemeIstekleri()).length === 0, 'onay öncesi kod_yenile isteği YOK');

  const onayMetni = await metin();
  de(/geri alınamaz/i.test(onayMetni), 'onay metni geri alınamaz olduğunu söylüyor');
  de(/açık oturum kapanacak/i.test(onayMetni), 'onay metni oturumun kapanacağını söylüyor');
}

// ===========================================================================
console.log('2 — ONAYDAN SONRA YENİ KOD EKRANDA, ESKİSİ YOK');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Evet, yenile' }).click();
  await p.waitForTimeout(700);

  const istekler = await yenilemeIstekleri();
  de(istekler.length === 1, `tam bir kod_yenile isteği gitti (${istekler.length})`);
  de(istekler[0]?.govde?.p_rol === 'ogrenci', `istek doğru rolü taşıyor (${istekler[0]?.govde?.p_rol})`);
  de(istekler[0]?.govde?.p_id === 'o1', 'istek doğru öğrenciyi taşıyor');

  const t = await metin();
  de(t.includes(YENI.ogrenci), 'yeni öğrenci kodu ekranda');

  // DEĞERE BAKILIYOR: eski kod hiçbir yerde kalmamalı.
  de(!t.includes(ESKI.ogrenci), 'eski öğrenci kodu ekranda YOK');

  // DOM'un tamamı — görünmeyen bir düğümde de kalmamalı.
  const domda = await p.evaluate((k) => document.body.innerHTML.includes(k), ESKI.ogrenci);
  de(!domda, 'eski kod DOM içinde de kalmadı');
}

// ===========================================================================
console.log('3 — ÖTEKİ ROL ETKİLENMİYOR');
// ===========================================================================
{
  // Sunucu tarafında bu `kod_yenile_testleri.sql` 2. ve 4. grubunda
  // ölçülüyor; burada ekranın yanlış kutuyu tazelemediği ölçülüyor.
  const t = await metin();
  de(t.includes(ESKI.veli), 'veli kodu dokunulmadan duruyor');
  de(!t.includes(YENI.veli), 'veli kutusuna yanlışlıkla yeni kod yazılmadı');
}

// ===========================================================================
console.log('4 — YENİ FİŞ HATIRLATMASI');
// ===========================================================================
{
  const t = await metin();
  de(/fiş/i.test(t), 'ekran yeni fişin verilmesi gerektiğini söylüyor');

  // Veli kodunu da yenileyip mesajın MUHATABA göre değiştiğini ölç:
  // tek bir genel cümle yazılsaydı bu ayrım görünmezdi.
  await p.getByRole('button', { name: 'Yenile', exact: true }).nth(1).click();
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Evet, yenile' }).click();
  await p.waitForTimeout(700);

  const t2 = await metin();
  de(t2.includes(YENI.veli), 'veli kodu da yenilendi');
  de(/veliye/i.test(t2), 'bildirim veliye ulaştırmaktan söz ediyor');

  const istekler = await yenilemeIstekleri();
  de(istekler.length === 2, `toplam iki yenileme isteği (${istekler.length})`);
  de(
    istekler.map((c) => c.govde?.p_rol).join(',') === 'ogrenci,veli',
    'istekler sırayla doğru rolleri taşıdı',
  );
}

// ===========================================================================
console.log('5 — 360 px');
// ===========================================================================
{
  await p.setViewportSize({ width: 360, height: 800 });
  await p.waitForTimeout(300);
  const fark = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(fark <= 0, `360 px yatay taşma yok (${fark}px)`);
}

// ===========================================================================
console.log('6 — ÖĞRENCİLER SEKMESİNDE KOD YOK');
// ===========================================================================
{
  // Öğretmenin bu turdaki isteğinin KENDİ ölçümü: "Öğrenciler sekmesinin
  // içinde kodlara gerek yok." Taşıma yapıldı diye düğmenin kalktığını
  // varsaymak yetmez — sayılıyor.
  await p.setViewportSize({ width: 1280, height: 900 });
  // Çağrı defteri sıfırlanıyor: kod isteği ÖNCEKİ ekranda yapıldı, burada
  // yapılmadığını ölçeceğiz.
  await p.evaluate(() => {
    window.__cagrilar = [];
  });
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // Sınıf kutusundan 9A'ya girip satırları çizdiriyoruz: düğme varsa
  // burada olurdu.
  await p.getByRole('button', { name: /^9A/ }).first().click();
  await p.waitForTimeout(600);

  const kodDugmesi = await p.evaluate(() =>
    [...document.querySelectorAll('button')].filter((d) => d.textContent.trim() === 'Kodlar')
      .length,
  );
  de(kodDugmesi === 0, `Öğrenciler'de "Kodlar" düğmesi yok (${kodDugmesi})`);

  // POZİTİF KONTROL: satırlar gerçekten çizildi. Bu olmadan yukarıdaki
  // sıfır, "ekran hiç yüklenmedi" yüzünden de çıkardı.
  //
  // ÇIPA ÖĞRENCİNİN ADI, BİR DÜĞME DEĞİL. İlk hâli "Çıkar" düğmesini
  // sayıyordu ve o düğme bir sonraki turda Ayarlar'a taşınınca bu grup
  // kırmızı yandı — kusur üründe değil ölçümdeydi. Pozitif kontrol,
  // ölçtüğü ekranın en kalıcı parçasına bağlanmalı: satırın kendisi.
  // Ad, satırda bir BAĞLANTI olarak duruyor (öğrenci detayına gider);
  // etiket adına değil metne bakılıyor ki işaretleme değişse de ölçüm
  // yerinde kalsın.
  const satir = await p.evaluate(
    (a) => [...document.querySelectorAll('a, span')].filter((d) => d.textContent.trim() === a).length,
    OGRENCI.ad,
  );
  de(satir > 0, `satırlar çizildi — öğrencinin adı ekranda (${satir})`);

  // Kod hiçbir yoldan bu sekmede istenmiyor.
  const kodIstegi = (await p.evaluate(() => window.__cagrilar)).filter(
    (c) => c.ad === 'ogrenci_kodlari',
  ).length;
  de(kodIstegi === 0, `bu sekmede ogrenci_kodlari hiç çağrılmadı (${kodIstegi})`);
}

await s.close();
await b.close();
console.log(hata === 0 ? '\nKOD YENİLEME UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
