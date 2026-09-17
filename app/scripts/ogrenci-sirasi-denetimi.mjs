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
console.log('2 — ÖĞRENCİLER: SINIF SEÇİLİ DEĞİLKEN ADA GÖRE İSTENİYOR');
// ===========================================================================
{
  await p.goto(KOK + '#/ogretmen/ogrenciler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const govde = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'ogrenciler_listesi').at(-1)?.govde ?? null,
  );
  de(govde?.p_sirala === 'ad', `sınıfsızken 'ad' isteniyor (${govde?.p_sirala})`);
  de(govde?.p_sinif_id === null, 'sınıf süzgeci boş');

  // Sunucu 'ad' istendiğinde alfabetik döndürüyor; ekran onu da aynen
  // çiziyor. Bu satır aynı zamanda taklidin bayrağı GERÇEKTEN dinlediğini
  // gösteriyor — 3. gruptaki numara sırası ölçümü ancak o zaman anlamlı.
  const adlar = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="/ogrenciler/"]')].map(
      (e) => e.textContent?.trim() ?? '',
    ),
  );
  de(
    JSON.stringify(adlar) === JSON.stringify(ALFABETIK),
    `sınıfsız liste ada göre: ${JSON.stringify(adlar)}`,
  );
}

// ===========================================================================
console.log('3 — ÖĞRENCİLER: SINIF SEÇİLİNCE NUMARAYA GÖRE İSTENİYOR');
// ===========================================================================
{
  // Öğretmenin bildirdiği kusur tam buradaydı: 9A seçiliyken liste ada
  // göre geliyordu. Kapsam "ekran" düzeyinde kararlaştırılmıştı; oysa
  // karar "sınıf seçili mi" düzeyinde olmalıydı.
  await p.evaluate(() => {
    window.__cagrilar.length = 0;
  });
  await p.selectOption('select[aria-label="Sınıfa göre filtrele"]', 's9a');
  await p.waitForTimeout(600);

  const govde = await p.evaluate(
    () => window.__cagrilar.filter((c) => c.ad === 'ogrenciler_listesi').at(-1)?.govde ?? null,
  );
  de(govde?.p_sirala === 'numara', `sınıf seçiliyken 'numara' isteniyor (${govde?.p_sirala})`);
  de(govde?.p_sinif_id === 's9a', `süzgeç sınıfı taşıyor (${govde?.p_sinif_id})`);

  // Ekran yine sunucunun sırasını bozmuyor.
  const adlar = await p.evaluate(() =>
    [...document.querySelectorAll('a[href*="/ogrenciler/"]')].map(
      (e) => e.textContent?.trim() ?? '',
    ),
  );
  de(
    JSON.stringify(adlar) === JSON.stringify(BEKLENEN),
    `liste sunucunun sırasında: ${JSON.stringify(adlar)}`,
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
