/**
 * =============================================================================
 * MESAJLAR DENETİMİ — sekme değişimi ve ekrandaki SIRA (0048)
 *
 * Sunucu tarafı `yazisma_listesi_testleri.sql` ile ölçülüyor (11 grup,
 * altı kusur provası). Burada ölçülen şey EKRAN.
 *
 * EN ÖNEMLİ ÖLÇÜM SIRA VE ÇİZİLDİĞİ YERDEN OKUNUYOR. Sunucu doğru
 * sıralayıp arayüz yeniden sıralarsa hiçbir SQL testi bunu görmez;
 * öğretmen yalnız "en son yazan kim"i bulamaz. Bu yüzden ekrandaki
 * DOM sırası okunuyor, sunucudan gelen değil.
 *
 * ALTI ÖLÇÜM:
 *   1. Sekme çubuğunda Mesajlar VAR, Kodlar YOK
 *   2. Kodlar ekranına Ayarlar'dan gidiliyor ve ekran çalışıyor
 *   3. Sınıf sırası ve sınıf içi sıra EKRANDA doğru
 *   4. Kanal düğmesi listeyi gerçekten değiştiriyor
 *   5. Eski kapılar kapalı (Öğrenciler ve Veliler'de yazışma girişi yok)
 *   6. Arama, yazışması olmayan öğrenciyi bulabiliyor
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 * =============================================================================
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

const saat = (n) => new Date(Date.now() - n * 3600e3).toISOString();

/**
 * SUNUCUNUN SIRASINI TAKLİT EDİYOR.
 *
 * Gerçek uç sınıfları `max(son_mesaj)`, sınıf içini `son_mesaj` ile
 * diziyor; taklit de ZATEN SIRALI gönderiyor. Böylece ekranda yanlış
 * bir sıra görülürse suçlu tektir: arayüz.
 */
const OGRENCI_KANALI = {
  kanal: 'ogrenci',
  toplam_okunmamis: 3,
  gruplar: [
    {
      sinif_id: 's1', sinif: '9M', okunmamis: 2,
      satirlar: [
        { ogrenci_id: 'o1', ad: 'Melis Yaz', son_mesaj: saat(1), okunmamis: 2 },
        { ogrenci_id: 'o2', ad: 'Mert Yaz', son_mesaj: saat(120), okunmamis: 0 },
      ],
    },
    {
      sinif_id: 's2', sinif: '10M', okunmamis: 1,
      satirlar: [
        { ogrenci_id: 'o3', ad: 'Zeynep Yaz', son_mesaj: saat(2), okunmamis: 1 },
      ],
    },
    {
      sinif_id: 's3', sinif: '9N', okunmamis: 0,
      satirlar: [
        { ogrenci_id: 'o4', ad: 'Kaan Yaz', son_mesaj: saat(72), okunmamis: 0 },
      ],
    },
  ],
};

const VELI_KANALI = {
  kanal: 'veli',
  toplam_okunmamis: 0,
  gruplar: [
    {
      sinif_id: 's3', sinif: '9N', okunmamis: 0,
      satirlar: [
        { ogrenci_id: 'o5', ad: 'Ada Yaz', son_mesaj: saat(240), okunmamis: 0 },
      ],
    },
  ],
};

const b = await chromium.launch();

async function ac(yol) {
  const s = await b.newContext({ viewport: { width: 420, height: 1000 } });
  await s.addInitScript(
    ([oturumJson, ogrJson, veliJson]) => {
      localStorage.setItem('sekiz_oturum', oturumJson);
      const asil = window.fetch;
      const json = (x) =>
        new Response(JSON.stringify(x), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      const ogr = JSON.parse(ogrJson);
      const veli = JSON.parse(veliJson);
      window.__istekler = [];
      window.fetch = async (u, opt) => {
        const url = String(typeof u === 'string' ? u : u.url);
        const m = url.match(/\/rpc\/([a-z_]+)/);
        if (!m) return asil(u, opt);
        let govde = null;
        try {
          govde = JSON.parse(String(opt?.body ?? 'null'));
        } catch {
          /* okunamadıysa null kalsın */
        }
        window.__istekler.push({ ad: m[1], govde });

        if (m[1] === 'yazisma_listesi')
          return json(govde?.p_kanal === 'veli' ? veli : ogr);
        if (m[1] === 'ben_kimim')
          return json({ id: 'g1', ad: 'Buket', sahip: true });
        if (m[1] === 'bildirim_sayilari')
          return json({ okunmamis_mesaj: 3, puan_bekleyen: 0 });
        if (m[1] === 'siniflar_listesi')
          return json([{ id: 's1', ad: '9M', seviye: 9, sube: 'M', ozel: false, arsiv: false, ogrenci_sayisi: 2 }]);
        if (m[1] === 'ogrenciler_listesi')
          return json({
            kayitlar: [{ id: 'o9', ad: 'Sessiz Yaz', sinif: '9M', ogrenci_no: '101', tur: 'okul' }],
            toplam: 1, sayfa: 1, toplam_sayfa: 1,
          });
        if (m[1] === 'veliler_listesi')
          return json({ yanit_bekleyen: [], gruplar: [] });
        if (m[1] === 'ogrenci_yazismalari')
          return json({ toplam_okunmamis: 0, yanit_bekleyen: [] });
        return json({});
      };
    },
    [
      JSON.stringify({
        token: 'sahte-jeton-uzunlugu-yeterli-olsun-diye-uzatildi',
        rol: 'ogretmen',
      }),
      JSON.stringify(OGRENCI_KANALI),
      JSON.stringify(VELI_KANALI),
    ],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { s, p };
}

/**
 * TEK BİR sekme çubuğunun etiketleri.
 *
 * İlk yazımda `nav a` kullanmıştım ve ölçüm 12 etiket saydı: sayfada
 * İKİ menü var — geniş ekranın yan menüsü ve dar ekranın alt çubuğu.
 * İkisi de DOM'da duruyor, yalnız biri CSS ile gizli. Ayrıca rozet
 * rakamı (`3`) bağlantının metnine karışıyor ve satır sırası değişiyor,
 * yani `innerText`in ilk satırını almak da kırılgan.
 *
 * Çözüm: TEK bir `nav` seçiliyor ve etiketten rozet rakamları
 * ayıklanıyor.
 */
const sekmeler = (p) =>
  p.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return [];
    // Rozet rakamı etiketle AYNI satırda ("Mesajlar3"), ayrı satırda
    // değil — bu yüzden satır süzmek yetmiyor, rakamlar ayıklanıyor.
    // Hiçbir sekme adında anlamlı rakam yok.
    return [...nav.querySelectorAll('a')].map((a) =>
      a.innerText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim(),
    );
  });

// ---------------------------------------------------------------------------
console.log('1 — SEKME ÇUBUĞU: Mesajlar var, Kodlar yok');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/mesajlar');
  const ad = await sekmeler(p);
  de(ad.includes('Mesajlar'), `Mesajlar sekmesi var (${ad.join(', ')})`);
  de(!ad.includes('Kodlar'), 'Kodlar sekmesi YOK');
  // Sekme sayısı altı kalmalı: yedincisi 360 px'de sığmıyor (Kabuk.tsx).
  de(ad.length === 6, `sekme sayısı altı (${ad.length})`);
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('2 — KODLAR AYARLAR’DAN AÇILIYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/ayarlar');
  const t = await p.evaluate(() => document.body.innerText);
  de(t.includes('Giriş kodları'), 'Ayarlar’da Kodlar kartı var');

  await p.getByRole('button', { name: 'Kodları aç' }).click();
  await p.waitForTimeout(700);
  const adres = await p.evaluate(() => location.hash);
  de(adres.includes('/ogretmen/kodlar'), `Kodlar ekranına gidildi (${adres})`);
  const k = await p.evaluate(() => document.body.innerText);
  de(k.includes('Kodlar'), 'Kodlar ekranı çiziliyor');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('3 — SIRA EKRANDA DOĞRU (DOM’dan okunuyor)');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/mesajlar');

  const siniflar = await p.evaluate(() =>
    [...document.querySelectorAll('section[aria-label$="yazışmaları"] h2')].map((h) =>
      h.innerText.trim().split('\n')[0],
    ),
  );
  de(
    siniflar.join(',') === '9M,10M,9N',
    `sınıf sırası tazeliğe göre: ${siniflar.join(', ')}`,
  );

  const ilkSinif = await p.evaluate(() =>
    [...document.querySelectorAll('section[aria-label^="9M"] li button')].map(
      (x) => x.innerText.trim().split('\n')[0],
    ),
  );
  de(
    ilkSinif.join(',') === 'Melis Yaz,Mert Yaz',
    `9M içinde sıra: ${ilkSinif.join(', ')}`,
  );

  // Okunmamış rozeti doğru satırda.
  const melis = await p.evaluate(
    () =>
      [...document.querySelectorAll('li button')].find((x) =>
        x.innerText.includes('Melis Yaz'),
      )?.innerText ?? '',
  );
  de(melis.includes('2 yeni'), 'okunmamış rozeti doğru satırda');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('4 — KANAL DÜĞMESİ LİSTEYİ DEĞİŞTİRİYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/mesajlar');
  const once = await p.evaluate(() => document.body.innerText);
  de(once.includes('Melis Yaz'), 'öğrenci kanalı açık');

  await p.getByRole('tab', { name: 'Veliler' }).click();
  await p.waitForTimeout(700);
  const sonra = await p.evaluate(() => document.body.innerText);
  de(sonra.includes('Ada Yaz'), 'veli kanalına geçildi');
  de(!sonra.includes('Melis Yaz'), 'öğrenci kanalı listesi kalktı');

  // Sunucuya GERÇEKTEN kanal parametresiyle gidildi mi.
  const kanallar = await p.evaluate(() =>
    window.__istekler.filter((i) => i.ad === 'yazisma_listesi').map((i) => i.govde?.p_kanal),
  );
  de(kanallar.includes('ogrenci') && kanallar.includes('veli'),
     `iki kanal da istendi (${kanallar.join(', ')})`);
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('5 — ESKİ KAPILAR KAPALI');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/ogrenciler');
  const t = await p.evaluate(() => document.body.innerText);
  de(!t.includes('Yanıt bekleyen'), 'Öğrenciler’de yazışma bölümü yok');
  // Uç bile çağrılmamalı: bölüm kalktıysa isteği de kalkmış olmalı.
  const cagrildi = await p.evaluate(() =>
    window.__istekler.some((i) => i.ad === 'ogrenci_yazismalari'),
  );
  de(!cagrildi, 'ogrenci_yazismalari ucu artık çağrılmıyor');
  await s.close();
}
{
  const { s, p } = await ac('/ogretmen/veliler');
  const t = await p.evaluate(() => document.body.innerText);
  de(!t.includes('Yanıt bekleyenler'), 'Veliler’de yazışma bölümü yok');
  de(t.includes('Onam'), 'Veliler’de onam işi duruyor (sekme boşalmadı)');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('6 — ARAMA YAZIŞMASI OLMAYANI BULUYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac('/ogretmen/mesajlar');
  const once = await p.evaluate(() => document.body.innerText);
  de(!once.includes('Sessiz Yaz'), 'yazışmasız öğrenci listede yok');

  await p.fill('#mesaj-arama', 'Sessiz');
  await p.waitForTimeout(800);
  const sonra = await p.evaluate(() => document.body.innerText);
  de(sonra.includes('Sessiz Yaz'), 'arama onu buldu');
  await s.close();
}

await b.close();
console.log(hata === 0 ? '\nMESAJLAR DENETİMİ: KUSUR YOK' : `\nMESAJLAR DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
