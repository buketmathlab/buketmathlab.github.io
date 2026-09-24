/**
 * ÖĞRENCİ LİSTELERİNİN SIRASI — TARAYICIDA (0044)
 *
 * NEDEN BU DOSYA VAR: 0044 yayına alındıktan sonra öğretmen "sıralanmamış"
 * dedi. Sunucu doğru sırayı döndürüyordu; kusur kapsamdaydı — `Öğrenciler`
 * ekranı, SINIF SEÇİLİYKEN bile ada göre kalmıştı. Ama asıl mesele şu:
 * **o ekranların sırası tarayıcıda hiç ölçülmemişti.** Kodlar ve Kod
 * fişleri ölçülmüştü, öğretmenin asıl kullandığı iki ekran ölçülmemişti.
 *
 * İKİ AYRI İDDİA ÖLÇÜLÜYOR:
 *
 * 1. EKRAN SUNUCUNUN SIRASINI BOZMUYOR. Sıralama sunucuda yapılıyor;
 *    ekranın tek işi geldiği gibi çizmek. Sahte yanıt bilerek ALFABETİK
 *    OLMAYAN bir sırada veriliyor — ekran bir gün `.sort()` ekleseydi bu
 *    ölçüm kırmızı yanar.
 *
 * 2. DOĞRU SIRA İSTENİYOR. `Öğrenciler` ekranı sınıf seçiliyken
 *    `p_sirala: 'numara'`, seçili değilken `'ad'` göndermeli. İkisi de
 *    ölçülüyor: yalnız birini ölçmek, bayrağın sabit yazılmış olmasını
 *    fark etmezdi.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 5 },
  { id: 's9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 0 },
];

/**
 * NUMARA SIRASINDA ama ALFABETİK DEĞİL — tuzak burada.
 *
 * Ada göre dizilseydi: Ada · Berk · Cem · Deniz · Ela
 * Numaraya göre:       Ela(601) · Deniz(602) · Cem(603) · Berk(604) · Ada(605)
 * Ekran yeniden sıralarsa iki dizi birbirine hiç benzemez.
 */
const SIRALI = [
  { id: 'o1', ad: 'Ela Deneme', ogrenci_no: '601' },
  { id: 'o2', ad: 'Deniz Deneme', ogrenci_no: '602' },
  { id: 'o3', ad: 'Cem Deneme', ogrenci_no: '603' },
  { id: 'o4', ad: 'Berk Deneme', ogrenci_no: '604' },
  { id: 'o5', ad: 'Ada Deneme', ogrenci_no: '605' },
];
const BEKLENEN = SIRALI.map((o) => o.ad);
const ALFABETIK = [...BEKLENEN].sort((a, b) => a.localeCompare(b, 'tr'));

const SINIF_DETAY = {
  sinif: { id: 's9a', ad: '9A', ozel: false, arsiv: false },
  degerlendirilen_odev: 2,
  ogrenciler: SIRALI.map((o) => ({
    ...o,
    tur: 'okul',
    yapti: 2,
    yapmadi: 0,
    ortalama_yapan: 80,
    ortalama_tum: 80,
  })),
};

/**
 * `ogrenciler_listesi` kayıtları. Sahte sunucu bunları `p_sirala`ya göre
 * KENDİ sıralıyor (aşağıda) — taklit gerçeğe sadık olmazsa, ekran yanlış
 * bayrağı gönderse bile liste doğru sırada görünür ve ölçüm yalan söyler.
 */
const KAYITLAR = SIRALI.map((o) => ({ ...o, tur: 'okul', sinif: '9A' }));

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
  ([oturum, siniflar, detay, kayitlar]) => {
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
      if (!m) return asil(u, o);
      let govde = null;
      try {
        govde = JSON.parse(String(o?.body ?? 'null'));
      } catch {
        /* gövde okunamadıysa null kalsın */
      }
      window.__cagrilar.push({ ad: m[1], govde });

      if (m[1] === 'siniflar_listesi') return json(siniflar);
      if (m[1] === 'sinif_ogrencileri') return json(detay);

      if (m[1] === 'ogrenciler_listesi') {
        // TAKLİT SADIK: sunucunun `_numara_sira` kuralının aynısı, ve
        // `p_sirala` gerçekten dinleniyor. Sahte sunucu bayrağı yok
        // saysaydı, ekran 'ad' gönderse bile liste numara sırasında
        // görünür; yani bayrağın bir işe yaradığı hiç ölçülmemiş olurdu.
        const anahtar = (no) =>
          !no || !no.trim()
            ? null
            : /^[0-9]+$/.test(no.trim())
              ? no.trim().padStart(12, '0')
              : 'Z' + no.trim();
        const sirali = [...kayitlar].sort((x, y) => {
          if (govde?.p_sirala === 'numara') {
            const a = anahtar(x.ogrenci_no);
            const b2 = anahtar(y.ogrenci_no);
            if (a !== b2) {
              if (a === null) return 1;
              if (b2 === null) return -1;
              return a < b2 ? -1 : 1;
            }
          }
          return x.ad.localeCompare(y.ad, 'tr');
        });
        return json({ toplam: sirali.length, sayfa: 1, boyut: 25, kayitlar: sirali });
      }

      // SINIF ÖĞRENCİ ÖZETİ (0051) — sınıfa dokunulduğunda açılan liste.
      // Taklit, gerçek ucun yaptığını yapıyor: NUMARA SIRASINDA döndürüyor
      // ve numarasızı sona koyuyor. Ekranın kendi başına yeniden
      // sıralamadığı ancak böyle ölçülebilir.
      if (m[1] === 'sinif_ogrenci_ozeti') {
        const anahtar2 = (no) =>
          !no || !no.trim() ? null : /^[0-9]+$/.test(no.trim()) ? no.trim().padStart(12, '0') : 'Z' + no.trim();
        const sirali2 = [...kayitlar].sort((x, y) => {
          const a = anahtar2(x.ogrenci_no);
          const b2 = anahtar2(y.ogrenci_no);
          if (a !== b2) {
            if (a === null) return 1;
            if (b2 === null) return -1;
            return a < b2 ? -1 : 1;
          }
          return x.ad.localeCompare(y.ad, 'tr');
        });
        return json({
          sinif: { id: 's9a', ad: '9A', ozel: false },
          ogrenciler: sirali2.map((k, i) => ({
            id: k.id,
            ad: k.ad,
            ogrenci_no: k.ogrenci_no,
            tur: 'okul',
            ortalama: 40 + i,
            odev_sayisi: 3,
            // 0052 — üç sayı BİRBİRİYLE TUTARLI: yapilan + yapilmayan =
            // odev_sayisi. Sahte sunucu bu kuralı bozarsa ekranın
            // ölçümü de anlamını yitirirdi.
            yapilan: i === 0 ? 2 : 3,
            yapilmayan: i === 0 ? 1 : 0,
            eksik_konular: i === 0 ? ['Turev'] : [],
          })),
        });
      }

      if (m[1] === 'ben_kimim')
        return json({ id: 'g1', ad: 'Buket', sahip: true, vekalet: false, vekil: null });
      if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });

      // KONU KARNESİ SINIF DETAYINDA AÇIK. Boş nesne döndürmek ekranı
      // çökertiyordu (`kapsam.tur` okunuyor) ve ölçüm "hiçbir öğrenci
      // çizilmedi" diye kırmızı yanıyordu — kusur üründe değil bu sahte
      // sunucudaydı. Taklidin sadık olmadığı yer ölçümün kör noktasıdır.
      if (m[1] === 'konu_karnesi')
        return json({
          kapsam: { tur: 'sinif', ad: '9A', sinif: '9A', mevcut: kayitlar.length },
          odev_sayisi: 0,
          konular: [],
          gelisim: [],
        });

      return json({});
    };
  },
  [
    JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
    SINIFLAR,
    SINIF_DETAY,
    KAYITLAR,
  ],
);

const p = await s.newPage();

// ===========================================================================
console.log('1 — SINIF DETAYI: SUNUCUNUN SIRASI AYNEN ÇİZİLİYOR');
// ===========================================================================
{
  await p.goto(KOK + '#/ogretmen/siniflar/s9a', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // Ad ve numara AYRI okunuyor: numara rozeti adın `<p>`'si içinde bir
  // `span`, düz metin alınsaydı "601Ela Deneme" çıkardı.
  // SEÇİCİ AD BAĞLANTISINDAN YÜRÜYOR, kap sınıfından değil: iki ekranın
  // kabı farklı (`ul.grid` ve `div.space-y-2`) ama ikisinde de numara
  // rozeti adın HEMEN ÖNCEKİ kardeşi. İlk yazımda kaba bağlanmıştım ve
  // ölçüm boş dizi görüp kırmızı yandı — kusur üründe değil ölçümdeydi.
  const satirlar = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="/ogrenciler/"]')].map((a) => {
      const onceki = a.previousElementSibling;
      return {
        ad: a.textContent?.trim() ?? '',
        no:
          onceki && onceki.classList.contains('sk-sayi')
            ? (onceki.textContent?.trim() ?? null)
            : null,
      };
    }),
  );

  de(satirlar.length === 5, `5 öğrenci çizildi (${satirlar.length})`);
  de(
    JSON.stringify(satirlar.map((r) => r.ad)) === JSON.stringify(BEKLENEN),
    `sıra sunucudan geldiği gibi: ${JSON.stringify(satirlar.map((r) => r.ad))}`,
  );
  // TUZAK GERÇEKTEN KURULU MU: iki dizi aynı olsaydı ölçüm bir şey
  // kanıtlamazdı — ekran yeniden sıralasa da yeşil kalırdı.
  de(
    JSON.stringify(ALFABETIK) !== JSON.stringify(BEKLENEN),
    'fixture tuzaklı: alfabetik sıra ≠ numara sırası',
  );
  de(
    JSON.stringify(satirlar.map((r) => r.no)) ===
      JSON.stringify(['601', '602', '603', '604', '605']),
    `numara rozetleri de sırada: ${JSON.stringify(satirlar.map((r) => r.no))}`,
  );
}

// ===========================================================================
console.log('2 — ÖĞRENCİLER: ARAMA BÜTÜN SINIFLAR ARASINDA, ADA GÖRE');
// ===========================================================================
//
// BU GRUBUN HEDEFİ 0051'DE DEĞİŞTİ — ve değişmesi gerekiyordu.
//
// Eskiden ekran varsayılan olarak DÜZ BİR LİSTE açıyordu ve burada
// "sınıf seçili değilken 'ad' isteniyor" ölçülüyordu. 0051'de öğretmenin
// isteğiyle varsayılan görünüm SINIF KUTUSU oldu; sınıf seçili değilken
// artık hiç liste çizilmiyor, dolayısıyla `ogrenciler_listesi` de
// çağrılmıyor.
//
// Korunan güvence AYNI: arama BÜTÜN sınıflar arasında ve ADA göre
// yapılır. Numaraya göre sıralamak iki farklı sınıfın 601'ini yan yana
// getirirdi. Ölçüm silinmedi, arama akışına taşındı.
{
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  // Sınıf kutusu açılışta var ve düz liste yok.
  const kutuVar = await p.evaluate(() => document.body.innerText.includes('Sınıflar'));
  de(kutuVar, 'açılışta sınıf kutusu çiziliyor');
  const bosCagri = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'ogrenciler_listesi').length,
  );
  de(bosCagri === 0, `sınıf kutusundayken öğrenci listesi çağrılmıyor (${bosCagri})`);

  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
  await p.fill('input[type="search"]', 'Deneme');
  await p.waitForTimeout(800);

  const govde = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'ogrenciler_listesi').at(-1)?.govde ?? null,
  );
  de(govde?.p_sirala === 'ad', `aramada 'ad' isteniyor (${govde?.p_sirala})`);
  de(govde?.p_sinif_id === null, 'arama sınıfla sınırlı değil');

  const adlar = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="/ogrenciler/"]')].map(
      (e) => e.textContent?.trim() ?? '',
    ),
  );
  de(
    JSON.stringify(adlar) === JSON.stringify(ALFABETIK),
    `arama sonucu ada göre: ${JSON.stringify(adlar)}`,
  );
}

// ===========================================================================
console.log('3 — SINIFA DOKUNULUNCA: SUNUCUNUN SIRASI AYNEN ÇİZİLİYOR');
// ===========================================================================
//
// Öğretmenin bildirdiği kusur burada doğmuştu: 9A seçiliyken liste ada
// göre geliyordu. Güvence AYNEN duruyor, yeri değişti — sıralama artık
// `sinif_ogrenci_ozeti`nin işi (sunucuda, okul numarasına göre) ve bu
// grup ekranın onu BOZMADIĞINI ölçüyor.
{
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  // ARAMA KUTUSU TEMİZLENİYOR. `goto` aynı adrese gidince HashRouter
  // bileşeni yeniden kurmuyor; 2. gruptan kalan "Deneme" araması duruyor
  // ve arama varken sınıf kutusu hiç çizilmiyor. İlk yazımda bu atlandı
  // ve grup "düğme bulunamadı" diye kırmızı yandı — kusur üründe değil
  // ölçümdeydi.
  await p.fill('input[type="search"]', '');
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });

  // Sınıf kutusundaki 9A düğmesine dokun.
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('button')].find((x) =>
      x.textContent?.trim().startsWith('9A'),
    );
    d?.click();
  });
  await p.waitForTimeout(800);

  const govde = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'sinif_ogrenci_ozeti').at(-1)?.govde ?? null,
  );
  de(govde !== null, 'sınıfa dokununca sinif_ogrenci_ozeti çağrıldı');
  de(govde?.p_sinif_id === 's9a', `doğru sınıfla (${govde?.p_sinif_id})`);

  const adlar = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="/ogrenciler/"]')].map(
      (e) => e.textContent?.trim() ?? '',
    ),
  );
  de(
    JSON.stringify(adlar) === JSON.stringify(BEKLENEN),
    `liste sunucunun sırasında: ${JSON.stringify(adlar)}`,
  );

  // ORTALAMA VE KONU EKRANDA (öğretmenin isteği).
  const metin = await p.evaluate(() => document.body.innerText);
  de(metin.includes('40,0'), 'ortalama ekranda ve Türkçe ondalıkla');
  de(metin.includes('Turev'), 'en eksik konu ekranda');
  de(metin.includes('—'), 'konusu olmayan öğrencide tire');

  // YAPILAN / YAPILMAYAN (0052 — öğretmenin isteği: "kaç tane ödevi
  // yaptıklarını, kaç tanesini yapmadıkları").
  de(metin.includes('2 yapıldı · 1 yapılmadı'), 'yapılan ve yapılmayan ekranda');
  de(metin.includes('3 yapıldı · 0 yapılmadı'), 'sıfır olan taraf da yazılıyor');

  // SAYILARIN KAPSAMI EKRANDA. Öğretmen "bu hafta verdiğim ödev neden
  // görünmüyor" diye sorabilir; cevap ekranda olmalı.
  de(/süresi dolmuş/.test(metin), 'sayıların hangi ödevleri kapsadığı yazılı');
}

// ===========================================================================
console.log('3b — SINIF KUTUSU SINIFLAR SEKMESİYLE AYNI ÖLÇÜDE');
// ===========================================================================
// Öğretmenin isteği: "Öğrenciler sekmesinin içindeki sınıflar kutularının
// büyüklüğü, sınıflar sekmesindeki sınıflar kutularının büyüklüğü gibi
// olsun."
//
// ÖLÇÜM İKİ EKRANI KARŞILAŞTIRIYOR, SABİT BİR SAYIYA BAKMIYOR. Bir piksel
// değeri yazsaydık, Sınıflar sekmesi bir gün değiştiğinde bu ölçüm yeşil
// kalır ve iki sekme yine ayrışırdı. İddia "aynı" olmalı, "44 px" değil.
{
  const olc = async (yol) => {
    await p.goto(KOK + yol, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    return p.evaluate(() => {
      // ÇIPA: sınıf kutusu hem adı hem "N öğrenci" satırını taşıyor.
      // Yalnız "9A" ile başlamak yetmiyor (yukarıdaki tuzak).
      const d = [...document.querySelectorAll('button')].find(
        (x) => x.textContent?.trim().startsWith('9A') && x.textContent.includes('öğrenci'),
      );
      if (!d) return null;
      const r = d.getBoundingClientRect();
      const ad = d.querySelector('span');
      return {
        g: Math.round(r.width),
        y: Math.round(r.height),
        punto: getComputedStyle(ad ?? d).fontSize,
      };
    });
  };

  await p.setViewportSize({ width: 1280, height: 900 });
  // SIRA ÖNEMLİ: önce Sınıflar, sonra Öğrenciler. HashRouter aynı adrese
  // `goto` edilince bileşeni yeniden kurmuyor; 3. gruptan kalan `sinifId`
  // duruyor ve sınıf kutusu hiç çizilmiyordu. Araya Sınıflar girince
  // Öğrenciler yeniden kuruluyor ve kutu çiziliyor.
  //
  // Bu sıra bir denemeyle bulunmadı: önce "pano'ya uğra" yazdım, pano
  // sahte sunucuda boş yanıt aldığı için ekran tamamen boş kaldı ve
  // ölçüm HİÇBİR DÜĞME bulamadı. Ölçümün kendi yolu da ürünün yolu kadar
  // gerçek olmalı.
  const siniflar = await olc('#/ogretmen/siniflar');
  const ogrenciler = await olc('#/ogretmen/ogrenciler');

  de(ogrenciler !== null && siniflar !== null, 'iki sekmede de 9A kutusu bulundu');
  de(
    ogrenciler?.punto === siniflar?.punto,
    `sınıf adının puntosu aynı (${ogrenciler?.punto} / ${siniflar?.punto})`,
  );
  // Genişlik ızgaradan geliyor; Sınıflar'da kartın yanında Arşivle düğmesi
  // var, o yüzden düğmenin kendi genişliği değil KARTIN genişliği aynı
  // olmalı. Punto ve satır yüksekliği ise birebir karşılaştırılabilir.
  de(
    Math.abs((ogrenciler?.y ?? 0) - (siniflar?.y ?? 0)) <= 2,
    `kutu yüksekliği aynı (${ogrenciler?.y} / ${siniflar?.y})`,
  );
}

// ===========================================================================
console.log('4 — 360 px');
// ===========================================================================
{
  await p.setViewportSize({ width: 360, height: 800 });
  await p.waitForTimeout(300);
  const fark = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(fark <= 0, `360 px yatay taşma yok (${fark}px)`);
}

await s.close();
await b.close();
console.log(hata === 0 ? '\nÖĞRENCİ SIRASI UÇTAN UCA: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
