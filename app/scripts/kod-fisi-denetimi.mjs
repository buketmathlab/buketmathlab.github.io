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
 * 10 fiş var. "CSS'te print:hidden yazdım" demek yeterli değil.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/** 12 öğrenci: iki sayfa çıkarsın (10 + 2) ve sayfalama ölçülebilsin. */
const OGRENCILER = Array.from({ length: 12 }, (_, i) => ({
  id: 'o' + i,
  ad: `Öğrenci ${i + 1}`,
  tur: 'okul',
  sinif: '9A',
}));

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

        if (m[1] === 'ogrenciler_listesi')
          return json({ toplam: ogrenciler.length, sayfa: 1, boyut: 100, kayitlar: ogrenciler });

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
  de(JSON.stringify(dagilim) === '[10,2]', `sayfa başına 10 fiş (${JSON.stringify(dagilim)})`);

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
}

await b.close();
console.log('');
console.log(hata === 0 ? 'KOD FİŞİ DENETİMİ: KUSUR YOK' : `KOD FİŞİ DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
