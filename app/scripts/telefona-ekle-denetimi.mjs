/**
 * TELEFONA EKLEME TARİFİ — GİRİŞ EKRANINDA
 *
 * NEDEN VAR: bu tarif dört turda dört kez yanlış yazıldı (Safari
 * eksikti · düğmenin yeri eksikti · düğme yanlıştı · Android'de hem yer
 * hem etiket yanlıştı) ve dördünü de ölçüm değil, öğretmenin GERÇEK
 * TELEFONU buldu. Ortak kök: tarayıcı menüleri değişken, kâğıt ise
 * basıldıktan sonra düzeltilemiyor.
 *
 * Çözüm aynı tarifi EKRANA da koymak oldu — ekrandaki yanlış bir
 * yayınla düzeltilebiliyor. Bu dosya o ekranın vaadini ölçüyor.
 *
 * BEŞ ÖLÇÜM:
 *
 *   1. VARSAYILAN KAPALI. Her gün giren öğrenci için bu bir dipnot;
 *      açık dursaydı giriş formunu aşağı iter ve kodunu yazmaya gelen
 *      çocuğa engel olurdu.
 *   2. AÇILIYOR. "details koydum" demek yetmez; tıklanınca içeriğin
 *      gerçekten göründüğü sayılıyor.
 *   3. ÜÇ TARAYICI DA VAR. Samsung Internet öğretmenin telefonundaki
 *      VARSAYILAN tarayıcıydı ve fişte hiç yoktu.
 *   4. SAMSUNG SATIRI "ALT" DİYOR. Öğretmenin ekran görüntüsüyle
 *      kanıtladığı kusur tam buydu: fişte "sağ üstteki" yazıyordu,
 *      oysa Samsung Internet'te menü SAĞ ALTTA.
 *   5. 360 px'te taşma yok.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
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

const b = await chromium.launch();
const s = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await s.newPage();

await p.goto(KOK + '#/', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

const bolum = () => p.locator('details').filter({ hasText: 'nasıl eklerim' });

// ===========================================================================
console.log('1 — VARSAYILAN KAPALI');
// ===========================================================================
{
  de((await bolum().count()) === 1, 'bölüm giriş ekranında var');

  const acik = await bolum().evaluate((e) => e.open);
  de(acik === false, `varsayılan kapalı (open=${acik})`);

  // İÇERİK GERÇEKTEN GÖRÜNMÜYOR — `open` bayrağına güvenmiyoruz.
  const gorunur = await p
    .locator('details li')
    .filter({ hasText: 'Safari' })
    .first()
    .isVisible()
    .catch(() => false);
  de(gorunur === false, 'kapalıyken adımlar görünmüyor');

  // Dokunma hedefi (Part XVII).
  const yuk = await bolum().locator('summary').evaluate((e) => e.getBoundingClientRect().height);
  de(yuk >= 44, `başlık 44 px dokunma hedefi (${Math.round(yuk)} px)`);
}

// ===========================================================================
console.log('2 — TIKLAYINCA AÇILIYOR VE ÜÇ TARAYICI DA GÖRÜNÜYOR');
// ===========================================================================
{
  await bolum().locator('summary').click();
  await p.waitForTimeout(300);

  de(await bolum().evaluate((e) => e.open), 'tıklayınca açıldı');

  const metin = await bolum().innerText();
  de(metin.includes('iOS'), 'iOS yolu görünüyor');
  de(metin.includes('Chrome'), 'Chrome yolu görünüyor');
  de(metin.includes('Samsung'), 'Samsung Internet yolu görünüyor');

  // "iPhone" ÖĞRETMENİN KARARIYLA KALKTI: iPad de aynı sistemi
  // kullanıyor ve tarif orada da aynı.
  de(!metin.includes('iPhone'), '"iPhone" geçmiyor (öğretmenin kararı: iOS)');
}

// ===========================================================================
console.log('3 — SAHA BULGULARI EKRANDA DA DURUYOR');
// ===========================================================================
{
  const metin = await bolum().innerText();

  // 1. bulgu: uygulama içi tarayıcıda seçenek yok.
  de(/uygulamanın içinden/i.test(metin), 'iOS satırı uygulama içi tarayıcıyı uyarıyor');

  // 4. bulgu: Samsung'da menü ALTTA, "Sayfa ekle" diyor.
  const samsung = await p
    .locator('details div')
    .filter({ hasText: 'Samsung Internet' })
    .last()
    .innerText();
  de(/alt/i.test(samsung), 'Samsung satırı menünün ALTTA olduğunu söylüyor');
  de(samsung.includes('Sayfa ekle'), 'Samsung satırı "Sayfa ekle" diyor');

  // Chrome ÜSTTE — iki Android yolu karışmamalı.
  const chrome = await p
    .locator('details div')
    .filter({ hasText: 'Android · Chrome' })
    .last()
    .innerText();
  de(/üst/i.test(chrome), 'Chrome satırı menünün ÜSTTE olduğunu söylüyor');
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
console.log(hata === 0 ? '\nTELEFONA EKLEME TARİFİ: KUSUR YOK' : `\n${hata} KUSUR VAR`);
process.exit(hata === 0 ? 0 : 1);
