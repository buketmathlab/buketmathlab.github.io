/**
 * Ana ekrana ekleme ve sürüm denetimi doğrulaması — `npm run pwa-denetim`
 *
 * Üç şey ölçülüyor:
 *
 * 1. MANIFEST GERÇEKTEN GEÇERLİ Mİ. Bildirilen her simge dosyası var mı ve
 *    BİLDİRİLEN BOYUTTA mı — yanlış boyut, sessizce çalışmayan bir simge
 *    demektir ve ancak gerçek bir telefonda fark edilirdi.
 * 2. SÜRÜM ŞERİDİ ÇALIŞIYOR MU. Farklı sürümde çıkıyor, aynı sürümde
 *    ÇIKMIYOR (denetimin gerçekten ölçtüğünün kanıtı), kapatılınca geri
 *    gelmiyor, "Yenile" adrese sürümü yazıyor.
 * 3. HİÇBİR SERVICE WORKER KAYDEDİLMİYOR. Bu turun en önemli kararının
 *    kanıtı: kök adresteki eski uygulamanın etkilenmesi imkânsız, çünkü
 *    ortada bir service worker yok.
 *
 * Ön koşul: repo kökünde `npx http-server -p 8788 -s .`
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const YENI = join(kok, 'yeni');
const ADRES = 'http://127.0.0.1:8788/yeni/';

let kusur = 0;
const hata = (m) => {
  console.log('  ✗ ' + m);
  kusur++;
};
const ok = (m) => console.log('  ✓ ' + m);

// ---------------------------------------------------------------------------
console.log('\n1 — MANIFEST');
const manifest = JSON.parse(await readFile(join(YENI, 'manifest.webmanifest'), 'utf8'));

for (const alan of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  if (!manifest[alan]) hata(`zorunlu alan eksik: ${alan}`);
}
if (manifest.scope !== '/yeni/' || manifest.start_url !== '/yeni/') {
  hata(`kapsam /yeni/ değil: scope=${manifest.scope} start_url=${manifest.start_url}`);
} else {
  ok('scope ve start_url /yeni/ — eski uygulama kapsam dışında');
}
if (manifest.display !== 'standalone') hata('display standalone değil');
else ok('display: standalone');
if (manifest.short_name.length > 12) hata(`short_name uzun (${manifest.short_name.length})`);
else ok(`short_name "${manifest.short_name}" ana ekranda sığar`);

// Bildirilen boyut ile GERÇEK boyut aynı mı
for (const s of manifest.icons) {
  const yol = join(YENI, s.src.replace(/^\/yeni\//, ''));
  try {
    const m = await sharp(yol).metadata();
    const bildirilen = s.sizes.split('x').map(Number);
    if (m.width !== bildirilen[0] || m.height !== bildirilen[1]) {
      hata(`${s.src}: bildirilen ${s.sizes}, gerçek ${m.width}x${m.height}`);
    } else {
      ok(`${s.src.split('/').pop()} ${s.sizes} ${s.purpose}`);
    }
  } catch {
    hata(`${s.src} okunamadı — dosya yok`);
  }
}
if (!manifest.icons.some((s) => s.purpose === 'maskable')) {
  hata('maskable simge yok — Android işareti kırpar');
}

// iOS simgesi: şeffaf OLMAMALI (iOS şeffafı siyah basar)
const ios = await sharp(join(YENI, 'marka', 'sekiz-simge-180.png'))
  .raw()
  .toBuffer({ resolveWithObject: true });
if (ios.info.channels === 4 && ios.data[3] !== 255) {
  hata('apple-touch-icon şeffaf — iOS siyah kutu basar');
} else {
  ok('apple-touch-icon zemini dolu');
}

// ---------------------------------------------------------------------------
const b = await chromium.launch();

/** Sayfayı açar; `surum` verilirse surum.json onu döndürür. */
async function ac(surum) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const swIstekleri = [];
  p.on('request', (r) => {
    if (/service-?worker|\bsw\.js/.test(r.url())) swIstekleri.push(r.url());
  });
  await p.route('**/rest/v1/rpc/*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  if (surum !== undefined) {
    await p.route('**/surum.json', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ surum }),
      }),
    );
  }
  await p.goto(ADRES, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  return { p, swIstekleri };
}

const seritGorunur = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')].some(
      (e) => e.checkVisibility() && (e.textContent || '').includes('Yeni sürüm hazır'),
    ),
  );

console.log('\n2 — SÜRÜM ŞERİDİ');
{
  const { p } = await ac('99999999999999');
  if (!(await seritGorunur(p))) hata('farklı sürümde şerit ÇIKMADI');
  else ok('farklı sürümde şerit çıkıyor');

  // "Yenile" adrese sürümü yazmalı — location.reload() yetmezdi
  await p.getByRole('button', { name: 'Yenile' }).click();
  await p.waitForTimeout(800);
  if (!p.url().includes('s=99999999999999')) hata(`adreste sürüm yok: ${p.url()}`);
  else ok('Yenile adrese ?s=<sürüm> yazıp geçiyor');
  await p.close();
}

console.log('\n3 — DENETİM GERÇEKTEN ÖLÇÜYOR MU');
{
  // Çalışan paketin KENDİ sürümü döndürülüyor: şerit çıkmamalı. Çıkarsa
  // denetim "her zaman göster" demek olurdu ve 2. grup hiçbir şey ölçmezdi.
  const kendi = JSON.parse(await readFile(join(YENI, 'surum.json'), 'utf8')).surum;
  const { p } = await ac(kendi);
  if (await seritGorunur(p)) hata('AYNI sürümde de şerit çıktı — denetim işe yaramıyor');
  else ok(`aynı sürümde (${kendi}) şerit çıkmıyor`);
  await p.close();
}

console.log('\n4 — "ŞİMDİ DEĞİL" KALICI');
{
  const { p } = await ac('88888888888888');
  await p.getByRole('button', { name: 'Şimdi değil' }).click();
  await p.waitForTimeout(300);
  if (await seritGorunur(p)) hata('kapatılan şerit hâlâ duruyor');
  else ok('kapatılınca kayboluyor');

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  if (await seritGorunur(p)) hata('kapatılan şerit yenileyince geri geldi');
  else ok('yenileyince geri gelmiyor');

  // DAHA YENİ bir sürümde tekrar çıkmalı — yoksa öğretmen bir kez
  // kapattığı için sonsuza kadar haber alamazdı.
  await p.unroute('**/surum.json');
  await p.route('**/surum.json', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ surum: '99999999999999' }),
    }),
  );
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  if (!(await seritGorunur(p))) hata('daha yeni sürümde şerit çıkmadı');
  else ok('daha yeni sürüm çıkınca yeniden gösteriliyor');
  await p.close();
}

console.log('\n5 — SERVICE WORKER YOK (bu turun asıl güvencesi)');
{
  const { p, swIstekleri } = await ac();
  const kayitli = await p.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { destek: false, sayi: 0, kontrolcu: null };
    const r = await navigator.serviceWorker.getRegistrations();
    return {
      destek: true,
      sayi: r.length,
      kontrolcu: navigator.serviceWorker.controller ? 'VAR' : null,
    };
  });
  if (kayitli.sayi !== 0) hata(`${kayitli.sayi} service worker kaydı var`);
  else ok('kayıtlı service worker yok');
  if (kayitli.kontrolcu) hata('sayfayı bir service worker kontrol ediyor');
  else ok('sayfayı kontrol eden service worker yok');
  if (swIstekleri.length) hata(`sw isteği yapıldı: ${swIstekleri.join(', ')}`);
  else ok('sw.js isteği hiç yapılmadı — eski uygulama etkilenemez');

  // Manifest tarayıcı tarafından da bulunabiliyor mu
  const m = await p.evaluate(() =>
    document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  );
  if (m !== '/yeni/manifest.webmanifest') hata(`manifest bağlantısı yanlış: ${m}`);
  else ok('manifest bağlantısı yerinde');
  const ait = await p.evaluate(() =>
    document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  );
  if (!ait) hata('apple-touch-icon etiketi yok — iOS simgeyi bulamaz');
  else ok('apple-touch-icon etiketi yerinde');
  await p.close();
}

console.log('\n6 — ŞERİTTE ODAK HALKASI GÖRÜNÜYOR MU');
{
  // NEDEN AYRI BİR MADDE: erişilebilirlik denetimi halkanın VARLIĞINA
  // bakıyor, RENGİNE bakmıyor. Şerit koyu zeminli; genel kural halkayı
  // `--color-ink` ile çiziyor ve `outline-offset` onu kabın (yani yine
  // laciverdin) üstüne düşürüyordu — halka teknik olarak vardı ama
  // görünmüyordu. Bu ölçüm o boşluğu kapatıyor.
  const { p } = await ac('99999999999999');
  for (const ad of ['Yenile', 'Şimdi değil']) {
    await p.getByRole('button', { name: ad }).focus();
    const r = await p.evaluate(() => {
      const e = document.activeElement;
      const s = getComputedStyle(e);
      // Halka `outline-offset` kadar DIŞARIDA çizilir: kabın zeminindedir.
      let n = e.parentElement;
      let zemin = 'rgb(255, 255, 255)';
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) {
          zemin = c;
          break;
        }
        n = n.parentElement;
      }
      return { halka: s.outlineColor, zemin, genislik: s.outlineWidth };
    });
    if (r.halka === r.zemin) hata(`"${ad}" odak halkası zeminle aynı renk (${r.halka})`);
    else ok(`"${ad}" halkası görünür (${r.halka} / zemin ${r.zemin})`);
  }
  await p.close();
}

console.log('\n7 — ŞERİT AÇIKKEN TAŞMA VE DOKUNMA HEDEFİ');
for (const w of [360, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.route('**/rest/v1/rpc/*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await p.route('**/surum.json', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ surum: '99999999999999' }),
    }),
  );
  await p.goto(ADRES, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const t = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (t > 0) hata(`${w}px: ${t}px yatay taşma`);
  else ok(`${w}px: taşma 0 px`);
  const kucuk = await p.evaluate(() =>
    [...document.querySelectorAll('[role="status"] button')]
      .map((e) => ({ t: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h < 44),
  );
  if (kucuk.length) hata(`${w}px: 44px altı düğme ${JSON.stringify(kucuk)}`);
  else ok(`${w}px: şerit düğmeleri 44px+`);
  await p.screenshot({ path: `/tmp/pwa-${w}.png` });
  await p.close();
}

await b.close();
console.log(kusur === 0 ? '\n→ PWA DENETİMİ GEÇTİ' : `\n→ ${kusur} KUSUR`);
process.exitCode = kusur === 0 ? 0 : 1;
