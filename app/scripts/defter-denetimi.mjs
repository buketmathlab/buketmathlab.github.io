/**
 * SÜRÜM DEFTERİ — TARAYICIDA UÇTAN UCA (0041)
 *
 * ## Bu betiğin NEYİ kanıtlayıp NEYİ kanıtlamadığı
 *
 * Defterin İÇERİĞİNİN doğru olduğu burada kanıtlanmıyor: yanıtları betiğin
 * kendisi taklit ediyor. O iddianın yeri SQL ve orada ölçülüyor —
 * `supabase/testler/defter_testleri.sql` (7 grup; çıpası olmayan aralığın
 * yazılmaması, çıkarımın kanıta yükselmesi, yedeğe sızmama, kapsam).
 *
 * Burada ölçülen şey EKRANIN KARARI: iki listeyi (sunucunun defteri ve
 * depodaki dosyalar) doğru karşılaştırıyor mu.
 *
 * Bu ekranın en tehlikeli kusuru çökmek değil, **"veritabanınız güncel"
 * derken yanılmak** olurdu: öğretmen ona bakıp çalıştırması gereken
 * dosyayı çalıştırmaz ve bir ekran sessizce bozuk kalır. Yani defter, tam
 * da işe yarayacağı anda yalan söyler.
 *
 * ## İKİ VERİ KÜMESİ — 0040'ta öğrenilen ders
 *
 * Analiz denetimi ilk yazıldığında tek kümeyle 29 ölçümün hepsi geçmişti
 * ve üçü asla kalamıyordu. Onun için burada da ekran İKİ farklı yanıtla
 * ölçülüyor:
 *   A — defter tam: ekran "güncel" demeli, eksik listesi HİÇ olmamalı.
 *   B — defter eksik: ekran eksikleri ADIYLA saymalı.
 * Sabit yazılmış ya da tek yöne kaymış bir karar ikisini birden
 * tutturamaz.
 *
 * `✓ built` görmeden bu sonuçlara güvenmeyin — betik derlenmiş paketi
 * ölçüyor, kaynağı değil.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// Depo listesi ÜRETİCİDEN okunuyor: paketin içindeki `migration-listesi.ts`
// Node'dan doğrudan okunamaz. İkisinin aynı kaldığını `migration-listesi.test.ts`
// zaten kilitliyor — orada ayrışırlarsa `npm test` kırmızı yanıyor.
import { migrationlariOku } from './migration-listesi.mjs';

const MIGRATION_LISTESI = migrationlariOku();

const KOK = 'http://127.0.0.1:8788/yeni/#';

let gecen = 0;
let kalan = 0;
function olc(ad, kosul, ayrinti = '') {
  if (kosul) {
    gecen++;
    console.log(`  ✓ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`);
  } else {
    kalan++;
    console.log(`  ✗ ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`);
  }
}

const tarayici = await chromium.launch();

/** Defteri verilen numaralara göre kuran sahte yanıt. */
function defter(numaralar) {
  return {
    alindi: '2026-09-12T10:00:00Z',
    dosyalar: numaralar.map((no) => ({
      dosya: no,
      uygulandi: '2026-09-12T09:00:00Z',
      kaynak: no >= '0041' ? 'migration' : 'geriye_donuk',
    })),
    son: numaralar.at(-1) ?? null,
  };
}

async function sayfa(govdeler, { sahip = true, yol = '/ogretmen/ayarlar/surumler' } = {}) {
  const s = await tarayici.newPage({ viewport: { width: 1024, height: 900 } });
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const g =
      uc === 'ben_kimim'
        ? { id: 's1', ad: 'Buket', sahip, vekalet: false, vekil: null }
        : (govdeler[uc] ?? {});
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(g) });
  });
  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }),
    ),
  );
  await s.goto(KOK + yol, { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  return s;
}

/** Ekranı yapısından okur; `innerText` içinde kalıp aramaz. */
const OKU = () => {
  const kok = document.querySelector('.sk-defter');
  if (!kok) return null;
  const yaz = (e) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const kart = kok.querySelector('div');
  return {
    baslik: yaz(kok.querySelector('h1')),
    kararBaslik: yaz(kart?.querySelector('h2')),
    eksikler: [...(kart?.querySelectorAll('ul li code') ?? [])].map((e) => yaz(e)),
    satirlar: [...kok.querySelectorAll('tbody tr')].map((tr) => {
      const h = tr.querySelectorAll('td');
      return { dosya: yaz(h[0]), kayit: yaz(h[1]) };
    }),
    tumMetin: kok.innerText,
  };
};

const SON = MIGRATION_LISTESI.at(-1).no;
const HEPSI = MIGRATION_LISTESI.map((m) => m.no);

console.log(`\n(depo listesi: ${HEPSI.length} dosya, son ${SON})`);

console.log('\nA — DEFTER TAM: "güncel" demeli');
{
  const s = await sayfa({ surum_defteri: defter(HEPSI) });
  const g = await s.evaluate(OKU);
  olc('A: ekran çizildi', g !== null);
  if (g) {
    olc('A: başlık', g.baslik === 'Sürüm defteri', g.baslik);
    olc('A: "güncel" kararı', /güncel/i.test(g.kararBaslik ?? ''), g.kararBaslik);
    // ASIL ÖLÇÜM: eksik listesi HİÇ olmamalı.
    olc('A: eksik dosya listesi yok', g.eksikler.length === 0, JSON.stringify(g.eksikler));
    olc(
      'A: defter satırları sunucudan, eksiksiz',
      g.satirlar.length === HEPSI.length,
      `${g.satirlar.length}/${HEPSI.length}`,
    );
    // Kesin/çıkarım ayrımı ekranda duruyor mu (sunucunun `kaynak` alanı).
    const kesin = g.satirlar.filter((r) => r.kayit === 'Kesin').length;
    olc('A: yalnız 0041 "Kesin"', kesin === 1, `${kesin} kesin satır`);
    olc(
      'A: çıkarım satırları "Çıkarım" diyor',
      g.satirlar.filter((r) => r.kayit === 'Çıkarım').length === HEPSI.length - 1,
    );
    olc('A: yedeğe girmediği yazıyor', /yedeğe .*girmiyor/i.test(g.tumMetin));
  }
  await s.close();
}

console.log('\nB — DEFTER EKSİK: eksikleri ADIYLA saymalı');
{
  const eksikNo = HEPSI.slice(-2); // son iki dosya çalıştırılmamış
  const s = await sayfa({ surum_defteri: defter(HEPSI.slice(0, -2)) });
  const g = await s.evaluate(OKU);
  olc('B: ekran çizildi', g !== null);
  if (g) {
    olc('B: "güncel" DEMİYOR', !/güncel/i.test(g.kararBaslik ?? ''), g.kararBaslik);
    olc(
      'B: eksik sayısı doğru',
      /(^|\D)2(\D|$)/.test(g.kararBaslik ?? ''),
      g.kararBaslik,
    );
    // Eksikler DOSYA ADIYLA yazılmalı: numara tek başına panelde işe yaramaz.
    const beklenen = MIGRATION_LISTESI.filter((m) => eksikNo.includes(m.no)).map(
      (m) => m.dosya,
    );
    olc(
      'B: eksik dosyalar adıyla listelenmiş',
      JSON.stringify(g.eksikler) === JSON.stringify(beklenen),
      `beklenen ${JSON.stringify(beklenen)}, bulunan ${JSON.stringify(g.eksikler)}`,
    );
    olc(
      'B: defter satırları eksik hâliyle basılmış',
      g.satirlar.length === HEPSI.length - 2,
      `${g.satirlar.length}`,
    );
    olc('B: panel klasörü yolu gösteriliyor', /panel-icin/.test(g.tumMetin));
    olc('B: önce yedek uyarısı var', /yedek/i.test(g.tumMetin));
  }
  await s.close();
}

console.log('\nC — İKİ KÜME GERÇEKTEN AYRIŞTI MI');
{
  // Bu olmadan A ve B sessizce aynı şeyi iki kez okuyor olabilirdi.
  const sa = await sayfa({ surum_defteri: defter(HEPSI) });
  const ga = await sa.evaluate(OKU);
  await sa.close();
  const sb = await sayfa({ surum_defteri: defter(HEPSI.slice(0, -2)) });
  const gb = await sb.evaluate(OKU);
  await sb.close();
  olc('karar kümeyle birlikte değişti', ga?.kararBaslik !== gb?.kararBaslik,
    `${ga?.kararBaslik} ≠ ${gb?.kararBaslik}`);
  olc('satır sayısı kümeyle birlikte değişti', ga?.satirlar.length !== gb?.satirlar.length);
}

console.log('\nD — AYARLAR KARTI YALNIZ SAHİPTE');
{
  const sa = await sayfa({}, { sahip: true, yol: '/ogretmen/ayarlar' });
  const varMi = await sa.getByRole('heading', { name: 'Sürüm defteri' }).isVisible();
  olc('sahipte kart görünüyor', varMi);
  await sa.close();

  const sb = await sayfa({}, { sahip: false, yol: '/ogretmen/ayarlar' });
  const yokMu = (await sb.getByRole('heading', { name: 'Sürüm defteri' }).count()) === 0;
  olc('sahip olmayanda kart HİÇ çizilmiyor', yokMu);
  await sb.close();
}

console.log('\nE — 360 px');
{
  const s = await sayfa({ surum_defteri: defter(HEPSI.slice(0, -2)) });
  await s.setViewportSize({ width: 360, height: 800 });
  await s.waitForTimeout(300);
  const olcum = await s.evaluate(() => {
    const kok = document.documentElement;
    const kucuk = [...document.querySelectorAll('button, a[href]')]
      .map((e) => ({ t: e.textContent?.trim().slice(0, 18), h: e.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44);
    return { tasma: kok.scrollWidth - kok.clientWidth, kucuk };
  });
  olc('360 px yatay taşma yok', olcum.tasma === 0, `${olcum.tasma} px`);
  olc('44 px altı dokunma hedefi yok', olcum.kucuk.length === 0, JSON.stringify(olcum.kucuk));
  await s.close();
}

await tarayici.close();
console.log(`\n--- GEÇEN: ${gecen}   KALAN: ${kalan} ---`);
process.exit(kalan === 0 ? 0 : 1);
