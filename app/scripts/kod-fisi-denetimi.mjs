/**
 * KOD FİŞLERİ — TARAYICIDA UÇTAN UCA
 *
 * ASIL ÖLÇÜM, SIZINTI: öğrenci fişleri sayfasında HİÇBİR VELİ KODU
 * geçmiyor — ve tersi. Alan adına değil GERÇEK KOD DEĞERLERİNE bakılıyor
 * (0021/0026'daki desen). Bu, turun bütün tasarım kararının kanıtı:
 * veli kodunu eline alan öğrenci, özel derste ödeme bilgisini ve 0025'in
 * ayırdığı veli↔öğretmen yazışmasını görürdü.
 *
 * İKİNCİ ÖLÇÜM, ONAY KAPISI: onaylamadan sunucuya TEK BİR kod isteği bile
 * gitmiyor (0024'te ölçülen vaadin aynısı) ve gidince her istek YALNIZ
 * kendi öğrencisinin kimliğini taşıyor — 0018'in "aynı anda tek öğrenci"
 * sunucu sınırı bu ekranda da bozulmuyor.
 *
 * ÜÇÜNCÜ ÖLÇÜM, KÂĞIT: `emulateMedia({ media: 'print' })` ile gerçekten
 * yazdırma kipinde bakılıyor — kabuk ve düğmeler çıkmıyor, sayfa başına
 * 8 fiş var. "CSS'te print:hidden yazdım" demek yeterli değil.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/**
 * 12 öğrenci: iki sayfa çıkarsın (8 + 4) ve sayfalama ölçülebilsin.
 *
 * NUMARALAR BİLEREK KARIŞIK ve metin sıralamasıyla ÇAKIŞIYOR (0044):
 *   sayısal : 1, 2, 3, 5, 7, 8, 9, 11, 12, 25, 40, 100
 *   metin   : 1, 100, 11, 12, 2, 25, 3, 40, 5, 7, 8, 9
 * İkisi aynı olsaydı "numaraya göre sıralı" ölçümü, sıralama hiç
 * yapılmasa da yeşil kalabilirdi.
 */
const NUMARALAR = ['12', '3', '25', '7', '100', '1', '9', '40', '2', '11', '8', '5'];

/**
 * BİR AD BİLEREK UZUN — ama bunun bir TRİPWIRE OLMADIĞI ölçüldü.
 *
 * Fiş, kurulum tarifi eklenince A4'ün tavanına yaklaştı (65,4 / 66,2 mm)
 * ve "dört adlı bir öğrencide ad satırı alt satıra taşar, kâğıt patlar"
 * diye düşünüp bu uzun adı ekledim. ÖLÇÜM BENİ YANLIŞLADI ve kayda
 * geçiyor:
 *
 *   - 54 harflik bir ad bile alt satıra TAŞMIYOR (ad satırı iki durumda
 *     da 20 px).
 *   - Ad yazısı 13 → 16 px büyütülerek gelecekteki bir değişiklik
 *     taklit edildi: A4 ölçümü kırmızı yandı (-1,7 mm) — ama KISA adlı
 *     eski fixture'la da AYNI şekilde yandı.
 *
 * Yani bu ad, kısa adın yakalayamadığı hiçbir kusuru yakalamıyor.
 * Kalmasının sebebi gerçekçi veri olması; bir güvence olduğunu iddia
 * etmiyor. Kâğıdı koruyan şey aşağıdaki A4 ölçümünün kendisi.
 *
 * Ad uydurma ve uydurma olduğu belli — depo herkese açık.
 */
const UZUN_AD = 'Öğrenci Uzunadlı Deneme Kaydı';

const OGRENCILER = Array.from({ length: 12 }, (_, i) => ({
  id: 'o' + i,
  ad: i === 0 ? UZUN_AD : `Öğrenci ${i + 1}`,
  ogrenci_no: NUMARALAR[i],
  tur: 'okul',
  sinif: '9A',
}));

/** Sunucudaki `_numara_sira` kuralının aynısı. */
const SIRA_ANAHTARI = (no) =>
  no === null || no === undefined || no.trim() === ''
    ? null
    : /^[0-9]+$/.test(no.trim())
      ? no.trim().padStart(12, '0')
      : 'Z' + no.trim();

/** Numara sırasındaki beklenen ad dizisi — ölçümün beklentisi buradan türüyor. */
const NUMARA_SIRASI = [...OGRENCILER]
  .sort((x, y) => SIRA_ANAHTARI(x.ogrenci_no).localeCompare(SIRA_ANAHTARI(y.ogrenci_no)))
  .map((o) => o.ad);

/** Kodlar birbirinden AYIRT EDİLEBİLİR: sızıntı testi değere bakıyor. */
const KOD = (i) => ({ ogrenci: `OGR${String(i).padStart(5, '0')}`, veli: `VLI${String(i).padStart(5, '0')}` });
const OGRENCI_KODLARI = OGRENCILER.map((_, i) => KOD(i).ogrenci);
const VELI_KODLARI = OGRENCILER.map((_, i) => KOD(i).veli);

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
  ([oturum, ogrenciler]) => {
    localStorage.setItem('sekiz_oturum', oturum);
    window.__cagrilar = [];
    const asil = window.fetch;
    const json = (o) =>
      new Response(JSON.stringify(o), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (m) {
        let govde = null;
        try {
          govde = JSON.parse(String(o?.body ?? 'null'));
        } catch {
          /* gövde okunamadıysa null kalsın */
        }
        window.__cagrilar.push({ ad: m[1], govde });

        if (m[1] === 'ogrenciler_listesi') {
          // TAKLİT GERÇEĞE SADIK OLMALI (0044): sahte sunucu `p_sirala`yı
          // yok saysaydı, ekran sıralamayı kendi yapmadığı hâlde denetim
          // yeşil kalırdı — yani bayrağın bir işe yaradığı hiç ölçülmezdi.
          const anahtar = (no) =>
            !no || !no.trim()
              ? null
              : /^[0-9]+$/.test(no.trim())
                ? no.trim().padStart(12, '0')
                : 'Z' + no.trim();
          const govde2 = JSON.parse(String(o?.body ?? '{}'));
          const sirali = [...ogrenciler].sort((x, y) => {
            if (govde2.p_sirala === 'numara') {
              const a2 = anahtar(x.ogrenci_no);
              const b2 = anahtar(y.ogrenci_no);
              if (a2 !== b2) {
                if (a2 === null) return 1;
                if (b2 === null) return -1;
                return a2 < b2 ? -1 : 1;
              }
            }
            return x.ad.localeCompare(y.ad, 'tr');
          });
          return json({ toplam: sirali.length, sayfa: 1, boyut: 100, kayitlar: sirali });
        }

        if (m[1] === 'ogrenci_kodlari') {
          const i = ogrenciler.findIndex((x) => x.id === govde?.p_id);
          if (i < 0) return json({});
          const n = String(i).padStart(5, '0');
          return json({ ogrenci: 'OGR' + n, veli: 'VLI' + n });
        }
        return json({});
      }
      return asil(u, o);
    };
  },
  [JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }), OGRENCILER],
);

const p = await s.newPage();
const metin = () => p.evaluate(() => document.body.innerText);
const cagrilar = () => p.evaluate(() => window.__cagrilar);
const kodIstekleri = async () => (await cagrilar()).filter((c) => c.ad === 'ogrenci_kodlari');

await p.goto(KOK + '#/ogretmen/kodlar/s9a/fisler', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

// ===========================================================================
console.log('1 — ONAYLAMADAN TEK BİR KOD İSTEĞİ GİTMİYOR');
// ===========================================================================
{
  de((await kodIstekleri()).length === 0, 'onay öncesi kod isteği yok');

  const t = await metin();
  de(t.includes('bütün'), 'diyalog ne olacağını söylüyor (bütün kodlar)');
  de(/öğrencilere dönük bırakmayın/i.test(t), 'ekran uyarısı görünür');

  // Kodların hiçbiri henüz ekranda olmamalı.
  const sizan = [...OGRENCI_KODLARI, ...VELI_KODLARI].filter((k) => t.includes(k));
  de(sizan.length === 0, `onay öncesi ekranda kod yok (${sizan.length} bulundu)`);
}

// ===========================================================================
console.log('2 — ONAYDAN SONRA: HER İSTEK YALNIZ KENDİ ÖĞRENCİSİNİ TAŞIYOR');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Getir ve hazırla' }).click();
  await p.waitForTimeout(2500);

  const istekler = await kodIstekleri();
  de(
    istekler.length === OGRENCILER.length,
    `öğrenci sayısı kadar istek (${istekler.length}/${OGRENCILER.length})`,
  );

  const idler = istekler.map((c) => c.govde?.p_id);
  de(new Set(idler).size === OGRENCILER.length, 'her öğrenci için tam bir istek');
  de(
    istekler.every((c) => Object.keys(c.govde ?? {}).filter((k) => k !== 'p_token').length === 1),
    'istek gövdesi yalnız TEK öğrenci kimliği taşıyor',
  );
  // Sınıfın tümünü tek yanıtta döndüren bir uç ÇAĞRILMIYOR (0018 kaldırmıştı).
  de(
    (await cagrilar()).every((c) => c.ad !== 'sinif_kodlari'),
    '`sinif_kodlari` çağrılmıyor — 0018 geri alınmadı',
  );
}

// ===========================================================================
console.log('3 — SIZINTI: ÖĞRENCİ SAYFASINDA VELİ KODU YOK');
// ===========================================================================
{
  const t = await metin();

  const veliSizan = VELI_KODLARI.filter((k) => t.includes(k));
  de(veliSizan.length === 0, `öğrenci sayfasında veli kodu YOK (${veliSizan.length} bulundu)`);

  // DENETİMİN İŞE YARADIĞI KANITI: aynı yöntemle öğrenci kodları BULUNUYOR.
  const bulunan = OGRENCI_KODLARI.filter((k) => t.includes(k));
  de(
    bulunan.length === OGRENCILER.length,
    `öğrenci kodlarının hepsi kendi sayfasında var (${bulunan.length}/${OGRENCILER.length})`,
  );

  de(t.includes('yalnız öğrenci kodları var'), 'sayfa ne taşıdığını yazıyla söylüyor');
}

// ===========================================================================
console.log('3b — FİŞLER NUMARA SIRASINDA, NUMARA FİŞTE GÖRÜNÜYOR (0044)');
// ===========================================================================
{
  // İSTEK: sıralama sunucudan isteniyor mu.
  const govde = await p.evaluate(
    () => window.__cagrilar.find((c) => c.ad === 'ogrenciler_listesi')?.govde ?? null,
  );
  de(govde?.p_sirala === 'numara', `liste 'numara' sırasıyla istendi (${govde?.p_sirala})`);

  // EKRAN: fişlerin sırası. Adları fiş fiş okuyup numara sırasıyla
  // karşılaştırıyoruz — "sıralı görünüyor" demek yetmez.
  // AD VE NUMARA AYRI AYRI OKUNUYOR, düz metinden ayıklanarak değil.
  // İlk yazımda `.sk-fis > p` bütün paragrafları (kod, yönerge) topladı ve
  // 48 satır çıktı; ayrıca numara ile ad arasında boşluk KARAKTERİ yok
  // (aradaki boşluk CSS `mr-1`), yani metinden ayıklamak kırılgandı.
  const satirlar = await p.evaluate(() =>
    [...document.querySelectorAll('.sk-fis')].map((fis) => {
      const bas = fis.querySelector('p');
      if (!bas) return { no: null, ad: '' };
      const no = bas.querySelector('span.sk-sayi')?.textContent?.trim() ?? null;
      const kopya = bas.cloneNode(true);
      kopya.querySelectorAll('span').forEach((x) => x.remove());
      return { no, ad: kopya.textContent?.replace(/\s+/g, ' ').trim() ?? '' };
    }),
  );
  de(satirlar.length === 12, `12 fiş çizildi (${satirlar.length})`);

  const sadeceAd = satirlar.map((r) => r.ad);
  de(
    JSON.stringify(sadeceAd) === JSON.stringify(NUMARA_SIRASI),
    `fişler numara sırasında: ${JSON.stringify(sadeceAd.slice(0, 4))}…`,
  );

  // METİN SIRALAMASI TUZAĞI: bu ikisi aynı olsaydı ölçüm bir şey kanıtlamazdı.
  const metinSirasi = [...OGRENCILER]
    .sort((x, y) => (x.ogrenci_no < y.ogrenci_no ? -1 : 1))
    .map((o) => o.ad);
  de(
    JSON.stringify(metinSirasi) !== JSON.stringify(NUMARA_SIRASI),
    'fixture gerçekten tuzak kuruyor (metin sırası ≠ sayısal sıra)',
  );

  // NUMARA FİŞTE GÖRÜNÜYOR: görünmeseydi sıra keyfî görünürdü.
  const numarali = satirlar.filter((r) => r.no !== null && r.no !== '').length;
  de(numarali === 12, `her fişte numara yazıyor (${numarali}/12)`);
  de(
    JSON.stringify(satirlar.map((r) => r.no)) ===
      JSON.stringify(NUMARA_SIRASI.map((ad) => OGRENCILER.find((o) => o.ad === ad).ogrenci_no)),
    `fişteki numaralar da sırada: ${JSON.stringify(satirlar.map((r) => r.no))}`,
  );
}

// ===========================================================================
console.log('4 — SIZINTI: VELİ SAYFASINDA ÖĞRENCİ KODU YOK');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Veli fişleri' }).click();
  await p.waitForTimeout(400);
  const t = await metin();

  const ogrSizan = OGRENCI_KODLARI.filter((k) => t.includes(k));
  de(ogrSizan.length === 0, `veli sayfasında öğrenci kodu YOK (${ogrSizan.length} bulundu)`);

  const bulunan = VELI_KODLARI.filter((k) => t.includes(k));
  de(
    bulunan.length === OGRENCILER.length,
    `veli kodlarının hepsi kendi sayfasında var (${bulunan.length}/${OGRENCILER.length})`,
  );

  de(
    /Veli fişini çocuğa değil, veliye verin/.test(t),
    'veli fişinin kime verileceği yazıyor',
  );

  // Sekme değişince öbür sayfa DOM'dan da düşüyor — gizlenmiyor, çizilmiyor.
  const domdaOgrenciKodu = await p.evaluate(
    (kodlar) => kodlar.filter((k) => document.body.innerHTML.includes(k)).length,
    OGRENCI_KODLARI,
  );
  de(domdaOgrenciKodu === 0, 'öğrenci kodları DOM içinde de kalmıyor');
}

// ===========================================================================
console.log('5 — KÂĞIT: YAZDIRMA KİPİNDE KABUK YOK, SAYFA BAŞINA 10 FİŞ');
// ===========================================================================
{
  await p.getByRole('button', { name: 'Öğrenci fişleri' }).click();
  await p.waitForTimeout(300);

  const sayfaSayisi = await p.evaluate(() => document.querySelectorAll('.sk-fis-sayfa').length);
  de(sayfaSayisi === 2, `12 fiş iki sayfaya bölündü (${sayfaSayisi})`);

  const dagilim = await p.evaluate(() =>
    [...document.querySelectorAll('.sk-fis-sayfa')].map((s) => s.querySelectorAll('.sk-fis').length),
  );
  // 10 → 8: kurulum tarifi ayrıntılanınca fiş büyüdü ve 10'luk düzene
  // tek satır bile sığmıyordu (ölçüm: satır 2,62 mm, sayfa payı 9,8 mm).
  de(JSON.stringify(dagilim) === '[8,4]', `sayfa başına 8 fiş (${JSON.stringify(dagilim)})`);

  // KÂĞIT ÖLÇÜSÜ EKRAN KİPİNDE ÖLÇÜLÜYOR — ve bunun sebebi ölçülerek
  // bulundu: yazdırma kipinde ızgaranın eni bilerek `auto` (gerçek kâğıtta
  // `@page { margin: 10mm }` onu 190 mm'ye oturtuyor). Playwright'ın kâğıt
  // taklidinde `@page` uygulanmadığı için orada 976 px çıkıyor; o sayı
  // kâğıt hakkında hiçbir şey söylemiyor.
  // Ekranda ise ızgara 190 mm olarak çiziliyor: öğretmenin gördüğü
  // önizleme, kâğıda çıkacak şeyle aynı ölçüde.
  const mm190 = Math.round((190 / 25.4) * 96); // 96 dpi CSS varsayımı: 718 px
  const ekranEni = await p.evaluate(() =>
    Math.round(document.querySelector('.sk-fis-sayfa').getBoundingClientRect().width),
  );
  de(
    Math.abs(ekranEni - mm190) <= 2,
    `önizleme ızgarası 190 mm (beklenen ${mm190} px, ölçülen ${ekranEni} px)`,
  );

  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(300);

  // Kabuk ve düğmeler kâğıda çıkmamalı — GERÇEKTEN görünmez mi diye
  // `checkVisibility()` ile bakılıyor (0021'de `textContent` hatası).
  const gorunenDugme = await p.evaluate(
    () => [...document.querySelectorAll('button')].filter((e) => e.checkVisibility()).length,
  );
  de(gorunenDugme === 0, `yazdırma kipinde görünen düğme yok (${gorunenDugme})`);

  const fisGorunur = await p.evaluate(
    () => [...document.querySelectorAll('.sk-fis')].filter((e) => e.checkVisibility()).length,
  );
  de(fisGorunur === 12, `yazdırma kipinde 12 fişin hepsi görünür (${fisGorunur})`);

  // Yazdırmada ızgara İKİ SÜTUN kalıyor ve fiş bölünmüyor; en kâğıda göre
  // (`@page`) oturuyor, o yüzden burada px değil YAPI ölçülüyor.
  const yapi = await p.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.sk-fis-sayfa'));
    const f = getComputedStyle(document.querySelector('.sk-fis'));
    return {
      sutun: s.gridTemplateColumns.split(' ').length,
      bolunme: f.breakInside,
      yukseklikPx: Math.round(document.querySelector('.sk-fis').getBoundingClientRect().height),
    };
  });
  de(yapi.sutun === 2, `yazdırmada iki sütun (${yapi.sutun})`);
  de(yapi.bolunme === 'avoid', `fiş iki sayfaya bölünmüyor (${yapi.bolunme})`);
  de(yapi.yukseklikPx >= 150, `fiş yüksekliği ~50 mm ve üzeri (${yapi.yukseklikPx} px)`);

  /* ---------------------------------------------------------------------
   * ON FİŞ KÂĞIDA GERÇEKTEN SIĞIYOR MU — ve bu ölçümün neden VAR OLMASI
   * gerektiği.
   *
   * Yukarıdaki "sayfa başına 8 fiş" ölçümü JAVASCRIPT SAYFALAMASINI
   * sayıyor (`SAYFA_BASINA`), kâğıdı değil. Yani fişler büyüyüp beşinci
   * satır A4'ten taşsa bile o ölçüm yeşil kalırdı: DOM'da yine 8 fiş
   * olurdu, ama yazıcıdan 8'i bir kâğıda, 2'si ayrı kâğıda çıkardı ve
   * öğretmen bunu ancak 72 sayfa bastıktan sonra görürdü.
   *
   * Fişe telefona kurulum yönergesi eklenince pay 9,8 mm'ye indi — satır
   * başına yaklaşık 2 mm. Bir sonraki cümle bunu sessizce aşabilir.
   * Ölçülmeyen şey, kırılan şeydir.
   *
   * İKİ AYRI ŞEY ÖLÇÜLÜYOR:
   *   1. Izgaranın toplam boyu A4'ün yazılabilir alanına sığıyor mu
   *   2. Metin kendi fişinin kutusundan taşıyor mu (kesme çizgisini aşan
   *      yazı, kâğıtta yarım cümle demek)
   */
  const KAGIT = { yukseklikMm: 297, kenarMm: 10 };
  const KULLANILABILIR_MM = KAGIT.yukseklikMm - 2 * KAGIT.kenarMm;

  const kagit = await p.evaluate(() => {
    const PX_MM = 96 / 25.4;
    const sayfa = document.querySelector('.sk-fis-sayfa');
    const fisler = [...document.querySelectorAll('.sk-fis')];
    return {
      izgaraMm: +(sayfa.getBoundingClientRect().height / PX_MM).toFixed(1),
      ilkSayfa: sayfa.querySelectorAll('.sk-fis').length,
      // 1 px pay: alt piksel yuvarlamaları taşma sayılmasın.
      tasan: fisler.filter((f) => f.scrollHeight > f.clientHeight + 1).length,
    };
  });

  de(
    kagit.izgaraMm <= KULLANILABILIR_MM,
    `${kagit.ilkSayfa} fiş A4'e sığıyor — ızgara ${kagit.izgaraMm} mm / ${KULLANILABILIR_MM} mm (pay ${(KULLANILABILIR_MM - kagit.izgaraMm).toFixed(1)} mm)`,
  );
  de(kagit.tasan === 0, `hiçbir fişin metni kutusundan taşmıyor (${kagit.tasan} taşan)`);

  await p.emulateMedia({ media: 'screen' });
}

// ===========================================================================
console.log('6 — EKRANDAN ÇIKINCA KODLAR KALMIYOR');
// ===========================================================================
{
  await p.getByRole('button', { name: '← Sınıf kodları' }).click();
  await p.waitForTimeout(600);

  const kalan = await p.evaluate(
    (kodlar) => kodlar.filter((k) => document.body.innerHTML.includes(k)).length,
    [...OGRENCI_KODLARI, ...VELI_KODLARI],
  );
  de(kalan === 0, `çıkıştan sonra sayfada kod kalmadı (${kalan})`);

  // KODLAR CİHAZDA KALMIYOR. "Geri gelince yeniden çekmeyelim" diye
  // depolamaya yazmak kolay bir iyileştirme gibi görünür; kodları kalıcı
  // bırakır. Bu ölçüm o iyileştirmenin önüne geçiyor.
  const depoda = await p.evaluate((kodlar) => {
    const hepsi = [localStorage, sessionStorage]
      .map((d) => Object.keys(d).map((k) => String(d.getItem(k))).join(' '))
      .join(' ');
    return kodlar.filter((k) => hepsi.includes(k)).length;
  }, [...OGRENCI_KODLARI, ...VELI_KODLARI]);
  de(depoda === 0, `kodlar tarayıcı deposunda tutulmuyor (${depoda})`);

  // Sınıf ekranı hâlâ 0018 kuralıyla çalışıyor: tek tek açılıyor.
  de((await metin()).includes('kodu görmek için'), 'tek öğrenci akışı bozulmadı');

  // 0044: KODLAR EKRANI DA NUMARA SIRASINDA ve numarayı gösteriyor.
  // Fişler numara sırasında basılıyorsa, fişleri üreten ekranın başka bir
  // sırada durması öğretmeni iki listeyi karşılaştırırken şaşırtırdı.
  const kodlarSatir = await p.evaluate(() =>
    [...document.querySelectorAll('ul.divide-y > li button > span:first-child')].map((e) => {
      // Ad KENDİ `span`'ında duruyor; "bütün span'ları çıkar" deseni
      // burada adı da siler (fişte işe yarıyordu, burada yaramıyor).
      const no = e.querySelector('span.sk-sayi')?.textContent?.trim() ?? null;
      // `span.font-semibold` DEĞİL: numara rozeti de o sınıfı taşıyor ve
      // seçici numarayı ad sanıyordu. Numara rozeti OLMAYAN ilk span.
      const ad =
        [...e.querySelectorAll('span')]
          .find((x) => !x.classList.contains('sk-sayi'))
          ?.textContent?.trim() ?? '';
      return { no, ad };
    }),
  );
  de(kodlarSatir.length === 12, `Kodlar ekranında 12 satır (${kodlarSatir.length})`);
  de(
    JSON.stringify(kodlarSatir.map((r) => r.ad)) === JSON.stringify(NUMARA_SIRASI),
    `Kodlar ekranı numara sırasında: ${JSON.stringify(kodlarSatir.map((r) => r.ad).slice(0, 4))}…`,
  );
  de(
    kodlarSatir.every((r) => r.no !== null && r.no !== ''),
    'Kodlar ekranında numara görünüyor',
  );
}

await b.close();
console.log('');
console.log(hata === 0 ? 'KOD FİŞİ DENETİMİ: KUSUR YOK' : `KOD FİŞİ DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
