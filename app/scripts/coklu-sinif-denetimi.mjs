/**
 * 0030 — AYNI ÖDEVİ BİRDEN ÇOK SINIFA: TARAYICIDA UÇTAN UCA
 *
 * ASIL ÖLÇÜM: PDF'LER KAÇ KEZ YÜKLENİYOR. Turun bütün kazancı, üç sınıfa
 * ödev verirken iki dosyanın ALTI KEZ değil İKİ KEZ yüklenmesi. Bu ekrandan
 * bakarak anlaşılmaz; AĞ TRAFİĞİNDEN sayılıyor.
 *
 * İkincisi: 0030 panelde çalıştırılmadıysa ekran bozulmuyor mu? Tek sınıf
 * seçiliyken eski uca düşmeli, çok sınıf seçiliyken Türkçe ve anlaşılır bir
 * cümle çıkmalı — İngilizce PostgREST hatası değil (Part VIII).
 *
 * Görünürlük `innerText` ile ölçülüyor; `textContent` kapalı diyalogların
 * gizli başlıklarını da sayıyor (0021'de o hata yapılmıştı).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 24 },
  { id: 's9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 26 },
  { id: 's9c', ad: '9C', seviye: 9, sube: 'C', ozel: false, arsiv: false, ogrenci_sayisi: 22 },
  { id: 's10a', ad: '10A', seviye: 10, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 25 },
];

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

/** Küçük ama GEÇERLİ bir PDF — pdf.js okuyabilsin diye gerçek bir belge. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8',
);

/**
 * Tarayıcıyı sahte bir sunucuyla kurar.
 * @param {boolean} ucVar 0030 çalıştırılmış mı (false ise PGRST202 döner)
 */
async function kur(ucVar) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 780 } });

  await s.addInitScript(
    ([oturum, siniflar, ucVarStr]) => {
      localStorage.setItem('sekiz_oturum', oturum);
      window.__cagrilar = [];
      window.__yuklemeler = [];
      const asil = window.fetch;
      const json = (o, st = 200) =>
        new Response(JSON.stringify(o), {
          status: st,
          headers: { 'Content-Type': 'application/json' },
        });

      window.fetch = async (u, o) => {
        const url = String(typeof u === 'string' ? u : u.url);

        // Edge Function: imzalı yükleme adresi. HER ÇAĞRI SAYILIYOR.
        if (url.includes('/functions/v1/dosya-url')) {
          const g = JSON.parse(String(o?.body ?? '{}'));
          window.__yuklemeler.push(g.yol ?? '?');
          return json({ imzaliUrl: 'https://sahte.test/yukle', jeton: 'j', yol: g.yol });
        }
        // İmzalı adrese yapılan PUT.
        if (url.startsWith('https://sahte.test/')) {
          window.__yuklemeler.push('PUT');
          return new Response('{}', { status: 200 });
        }

        const m = url.match(/\/rpc\/([a-z_]+)/);
        if (m) {
          let govde = null;
          try {
            govde = JSON.parse(String(o?.body ?? 'null'));
          } catch {
            /* gövde okunamadıysa null kalsın */
          }
          window.__cagrilar.push({ ad: m[1], govde });

          if (m[1] === 'siniflar_listesi') return json(siniflar);
          if (m[1] === 'konu_onerileri') return json([]);

          if (m[1] === 'odevler_coklu_olustur') {
            if (ucVarStr !== 'var') {
              // PostgREST'in gerçek cevabı: yetkisi olmayan ya da var olmayan
              // fonksiyon aynı kodla gizleniyor.
              return json(
                {
                  code: 'PGRST202',
                  message:
                    'Could not find the function public.odevler_coklu_olustur in the schema cache',
                },
                404,
              );
            }
            const idler = govde?.p_sinif_idler ?? [];
            return json({
              grup_id: idler.length > 1 ? 'g1' : null,
              odevler: idler.map((id, i) => ({
                odev_id: 'o' + i,
                sinif_id: id,
                sinif: (siniflar.find((s) => s.id === id) ?? {}).ad ?? '?',
              })),
            });
          }

          if (m[1] === 'odev_olustur') return json({ id: 'tek', yayinda: false });
          return json({});
        }
        return asil(u, o);
      };
    },
    [
      JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
      SINIFLAR,
      ucVar ? 'var' : 'yok',
    ],
  );

  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/odevler/yeni', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = (p) => p.evaluate(() => window.__cagrilar);
const yuklemeler = (p) => p.evaluate(() => window.__yuklemeler);

/** 1. adımı doldurur ve verilen sınıfları işaretler. */
async function birinciAdim(p, adlar, tur = 'acik') {
  await p.getByLabel(/Başlık/).fill('Üslü Sayılar');
  for (const ad of adlar) {
    await p.getByText(ad, { exact: true }).click();
  }
  const yarin = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await p.fill('input[type="date"]', yarin);
  await p.selectOption('select', tur);
  await p.getByRole('button', { name: 'Devam' }).click();
  await p.waitForTimeout(300);
}

// ===========================================================================
console.log('1 — SINIF SEÇİMİ ÇOKLU VE GÖRÜNÜR');
// ===========================================================================
{
  const { b, p } = await kur(true);
  const t0 = await metin(p);
  de(t0.includes('Sınıflar'), 'çoklu sınıf alanı ekranda');
  de(t0.includes('her sınıf için ayrı bir ödev oluşur'), 'ne olacağı yazıyor');
  de(t0.includes('PDF’ler bir kez yüklenir'), 'tek yükleme sözü ekranda');

  // Tek sınıf seçiliyken sayaç çıkmamalı: "1 sınıf seçildi" gürültü olurdu.
  await p.getByText('9A', { exact: true }).click();
  de(!(await metin(p)).includes('sınıf seçildi'), 'tek sınıfta sayaç satırı yok');

  await p.getByText('9B', { exact: true }).click();
  await p.getByText('9C', { exact: true }).click();
  const t = await metin(p);
  de(t.includes('3 sınıf seçildi'), 'üç sınıf seçilince sayaç çıkıyor');
  de(t.includes('gönderimleri ve karnesi ayrı tutulur'), 'kopya olduğu söyleniyor');

  // Seçim geri alınabiliyor mu — kutuya ikinci dokunuş.
  await p.getByText('9C', { exact: true }).click();
  de((await metin(p)).includes('2 sınıf seçildi'), 'ikinci dokunuş seçimi kaldırıyor');

  // 44 px dokunma hedefi ve 360 pikselde taşma yok.
  const kucuk = await p.evaluate(() =>
    [...document.querySelectorAll('fieldset label')].filter(
      (e) => e.getBoundingClientRect().height < 44,
    ).length,
  );
  de(kucuk === 0, '44 px altında sınıf kutusu yok');
  const tasma = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(tasma === 0, `360 px'de yatay taşma yok (${tasma} px)`);

  await b.close();
}

// ===========================================================================
console.log('2 — ÜÇ SINIF, İKİ PDF: DOSYALAR BİR KEZ YÜKLENİYOR');
// ===========================================================================
{
  const { b, p } = await kur(true);
  await birinciAdim(p, ['9A', '9B', '9C'], 'test');

  // 2. adım: iki PDF. (Test ödevinde iki dosya alanı var.)
  const alanlar = await p.locator('input[type="file"]').all();
  de(alanlar.length === 2, 'iki dosya alanı var (sorular + anahtar)');
  await alanlar[0].setInputFiles({ name: 'sorular.pdf', mimeType: 'application/pdf', buffer: PDF });
  await p.waitForTimeout(600);
  await alanlar[1].setInputFiles({ name: 'anahtar.pdf', mimeType: 'application/pdf', buffer: PDF });
  await p.waitForTimeout(1500);

  // ÇIKARIM BAŞARISIZ OLABİLİR ve bu normal: sahte PDF'in metin katmanı yok.
  // Ekran o durumda 2. adımda kalıp elle girmeyi öneriyor (Part VIII). Testin
  // konusu çıkarım değil YÜKLEME SAYISI; 3. adıma elle geçiyoruz.
  const devam = p.getByRole('button', { name: /^(Devam|Anahtarı elle gireceğim)$/ });
  if (await devam.isVisible().catch(() => false)) {
    await devam.click();
    await p.waitForTimeout(400);
  }

  const kaydet = p.getByRole('button', { name: /sınıf için taslak kaydet/ });
  de(await kaydet.isVisible(), 'düğme "3 sınıf için taslak kaydet" diyor');
  await kaydet.click();
  await p.waitForTimeout(1200);

  // ASIL ÖLÇÜM. İki dosya → iki imzalı adres + iki PUT = 4 istek.
  // Sınıf başına yükleseydik 12 olurdu.
  const y = await yuklemeler(p);
  const imzali = y.filter((x) => x !== 'PUT');
  de(imzali.length === 2, `imzalı adres 2 kez istendi (ölçülen: ${imzali.length})`);
  de(y.filter((x) => x === 'PUT').length === 2, 'dosya 2 kez yüklendi, 6 kez değil');
  de(new Set(imzali).size === 2, 'iki farklı yol (sorular + anahtar)');

  const c = await cagrilar(p);
  const coklu = c.filter((x) => x.ad === 'odevler_coklu_olustur');
  de(coklu.length === 1, `tek RPC çağrısı yapıldı (ölçülen: ${coklu.length})`);
  de(
    coklu[0]?.govde?.p_sinif_idler?.length === 3,
    'çağrı üç sınıf kimliği taşıyor: ' + JSON.stringify(coklu[0]?.govde?.p_sinif_idler),
  );
  de(
    c.filter((x) => x.ad === 'odev_olustur').length === 0,
    'tek sınıflık eski uç çağrılmadı',
  );
  // Üç ödev de AYNI yolları taşıyor — kopyaların dosyayı paylaştığının kanıtı.
  de(
    typeof coklu[0]?.govde?.p_anahtar_yolu === 'string' &&
      typeof coklu[0]?.govde?.p_odev_yolu === 'string',
    'iki dosya yolu da çağrıda',
  );

  await b.close();
}

// ===========================================================================
console.log('3 — 0030 ÇALIŞTIRILMAMIŞSA EKRAN BOZULMUYOR');
// ===========================================================================
{
  // 3a — TEK sınıf: sessizce eski uca düşüyor, ödev oluşuyor.
  const { b, p } = await kur(false);
  await birinciAdim(p, ['9A']);
  await p.getByRole('button', { name: 'Taslağı kaydet' }).click();
  await p.waitForTimeout(900);

  const c = await cagrilar(p);
  de(
    c.filter((x) => x.ad === 'odev_olustur').length === 1,
    'tek sınıfta eski `odev_olustur` çağrıldı (yedek davranış)',
  );
  de(
    c.find((x) => x.ad === 'odev_olustur')?.govde?.p_sinif_id === 's9a',
    'eski çağrı doğru sınıfı taşıyor',
  );
  const t = await metin(p);
  de(!/schema cache|Could not find/i.test(t), 'İngilizce PostgREST hatası ekranda yok');
  await b.close();
}
{
  // 3b — ÇOK sınıf: Türkçe ve anlaşılır bir cümle; sessizce yarısı oluşmuyor.
  const { b, p } = await kur(false);
  await birinciAdim(p, ['9A', '9B']);
  await p.getByRole('button', { name: /sınıf için taslak kaydet/ }).click();
  await p.waitForTimeout(900);

  const t = await metin(p);
  de(t.includes('henüz açılmadı'), 'Türkçe açıklama çıkıyor');
  de(t.includes('Tek sınıf seçerek'), 'ne yapabileceği söyleniyor');
  de(!/schema cache|Could not find/i.test(t), 'İngilizce hata metni ekranda yok');
  const c = await cagrilar(p);
  de(
    c.filter((x) => x.ad === 'odev_olustur').length === 0,
    'çok sınıflı istekte YARIM ödev oluşturulmuyor',
  );
  await b.close();
}

console.log('');
console.log(hata === 0 ? 'ÇOKLU SINIF DENETİMİ: KUSUR YOK' : `ÇOKLU SINIF DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
