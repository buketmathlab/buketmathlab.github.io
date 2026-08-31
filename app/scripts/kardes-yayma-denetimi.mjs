/**
 * 0031 — DÜZELTMEYİ KARDEŞ ÖDEVLERE YAYMA: TARAYICIDA UÇTAN UCA
 *
 * ASIL ÖLÇÜM: ÖĞRETMEN ONAYLAMADAN BAŞKA SINIFIN NOTU DEĞİŞMİYOR.
 * Yayma, başka çocukların notunu değiştiren geri alınamaz bir işlem. Bu
 * yüzden "düğme var mı" değil, ONAYLANMADAN AĞA TEK BİR YAYMA ÇAĞRISI
 * GİTMEDİĞİ sayılarak ölçülüyor (0024'teki desen).
 *
 * İkincisi: 0031 panelde çalıştırılmadıysa ekran bozulmuyor mu? Uç yoksa
 * `odev_detay` `kardes_detay` alanını hiç döndürmüyor; yayma kartı ve
 * düğmesi çıkmamalı, 0030'un bugünkü uyarısı yerinde kalmalı (Part VIII).
 *
 * Görünürlük `innerText` ile ölçülüyor; `textContent` kapalı diyalogların
 * gizli başlıklarını da sayıyor (0021'de o hata yapılmıştı).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

const SINIFLAR = [
  { id: 's10u', ad: '10U', seviye: 10, sube: 'U', ozel: false, arsiv: false, ogrenci_sayisi: 24 },
  { id: 's10v', ad: '10V', seviye: 10, sube: 'V', ozel: false, arsiv: false, ogrenci_sayisi: 26 },
  { id: 's10w', ad: '10W', seviye: 10, sube: 'W', ozel: false, arsiv: false, ogrenci_sayisi: 22 },
];

/** Üç kardeş bilerek farklı: biri ayrışmış, biri aynı, biri arşivde. */
const KARDES_DETAY = [
  { id: 'a2', sinif: '10V', gonderim_sayisi: 26, anahtar_ayni: false, arsiv: false },
  { id: 'a3', sinif: '10W', gonderim_sayisi: 22, anahtar_ayni: true, arsiv: false },
  { id: 'a4', sinif: '10Y', gonderim_sayisi: 18, anahtar_ayni: false, arsiv: true },
];

/** Sunucunun döneceği rapor. Zeynep BİLEREK YOK: puanı değişmeyen raporda yer almaz. */
const RAPOR = [
  {
    sinif: '10V',
    odev_id: 'a2',
    atlandi: null,
    yeniden_puanlanan: [
      { ogrenci: 'Efe Yayma', eski_puan: 50, yeni_puan: 100 },
      { ogrenci: 'Mert Yayma', eski_puan: 0, yeni_puan: 50 },
    ],
  },
  { sinif: '10W', odev_id: 'a3', atlandi: null, yeniden_puanlanan: [] },
  { sinif: '10Y', odev_id: 'a4', atlandi: 'arsiv', yeniden_puanlanan: [] },
];

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

/**
 * @param {boolean} ucVar 0031 çalıştırılmış mı. false ise `odev_detay`
 *   `kardes_detay` taşımıyor ve `odev_kardeslere_yay` PGRST202 dönüyor —
 *   canlıda migration çalıştırılmamış hâlin birebir karşılığı.
 */
async function kur(ucVar) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 780 } });

  await s.addInitScript(
    ([oturum, siniflar, kardesDetay, rapor, ucVarStr]) => {
      localStorage.setItem('sekiz_oturum', oturum);
      window.__cagrilar = [];
      const asil = window.fetch;
      const json = (o, st = 200) =>
        new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });

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
        if (m[1] === 'konu_onerileri') return json([]);

        if (m[1] === 'odev_detay') {
          const d = {
            id: 'a1', baslik: 'Üslü Sayılar', aciklama: null, tur: 'test',
            sinif_id: 's10u', sinif: '10U', son_tarih: '2026-09-30',
            soru_sayisi: 2, gec_teslim: true, sik_sayisi: 5,
            cevap_anahtari: { 1: 'A', 2: 'C' },
            konular: null, anahtar_yolu: null, odev_yolu: null,
            yayinda: true, gonderim_sayisi: 24,
            kardesler: ['10V', '10W', '10Y'],
          };
          // 0031 ÇALIŞTIRILMADIYSA ALAN HİÇ GELMİYOR — canlının davranışı bu.
          if (ucVarStr === 'var') d.kardes_detay = kardesDetay;
          return json(d);
        }

        if (m[1] === 'odev_guncelle') return json({ yeniden_puanlanan: [] });

        if (m[1] === 'odev_kardeslere_yay') {
          if (ucVarStr !== 'var') {
            return json(
              { code: 'PGRST202',
                message: 'Could not find the function public.odev_kardeslere_yay in the schema cache' },
              404,
            );
          }
          return json(rapor);
        }
        return json({});
      };
    },
    [
      JSON.stringify({ token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' }),
      SINIFLAR, KARDES_DETAY, RAPOR, ucVar ? 'var' : 'yok',
    ],
  );

  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/odevler/a1', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = (p) => p.evaluate(() => window.__cagrilar);
const yaymaSayisi = async (p) =>
  (await cagrilar(p)).filter((c) => c.ad === 'odev_kardeslere_yay').length;

console.log('KARDEŞ YAYMA DENETİMİ (0031)\n');

// ============================================================================
console.log('--- 1. Kart: kardeşler ve durumları yazılı ---');
// ============================================================================
{
  const { b, p } = await kur(true);
  const t = await metin(p);
  de(/10V/.test(t) && /10W/.test(t) && /10Y/.test(t), 'üç kardeş sınıf da ekranda');
  de(/26 gönderim/.test(t), 'kardeşin gönderim sayısı yazılı (26)');
  de(/Anahtar farklı/.test(t), 'ayrışan anahtar "Anahtar farklı" olarak işaretli');
  de(/Anahtar aynı/.test(t), 'ayrışmayan kardeş "Anahtar aynı" olarak işaretli');
  de(/Arşivde/.test(t), 'arşivdeki kardeş ekranda ATLANACAK diye yazılı');
  // Arşivdeki sınıf düğme metnine girmemeli: yayılmayacak bir sınıfı
  // düğmede vaat etmek, raporda "atlandı" görünce şaşırtırdı.
  const dugme = await p.getByRole('button', { name: /uygula/i }).first().innerText();
  de(/10V/.test(dugme) && /10W/.test(dugme), 'düğme yayılabilecek sınıfları sayıyor');
  de(!/10Y/.test(dugme), 'ARŞİVDEKİ SINIF DÜĞMEDE VAAT EDİLMİYOR');
  await b.close();
}

// ============================================================================
console.log('\n--- 2. ONAY KAPISI: onaylamadan hiçbir not değişmiyor ---');
// ============================================================================
{
  const { b, p } = await kur(true);
  de((await yaymaSayisi(p)) === 0, 'sayfa açılışında yayma çağrısı YOK');

  await p.getByRole('button', { name: /uygula/i }).first().click();
  await p.waitForTimeout(300);
  de((await yaymaSayisi(p)) === 0, 'DÜĞMEYE BASINCA DA çağrı gitmiyor — önce onay');

  const t = await metin(p);
  de(/notları değişecek/.test(t), 'onay diyaloğu notların değişeceğini söylüyor');
  de(/geri alınamaz/.test(t), 'geri alınamaz olduğu yazılı');
  de(/son tarih/i.test(t) && /Taşınmayacaklar/.test(t),
     'TAŞINMAYANLAR diyalogda tek tek yazılı');

  // Vazgeçince gerçekten hiçbir şey olmamalı.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  de((await yaymaSayisi(p)) === 0, 'VAZGEÇİNCE hiçbir not değişmiyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 3. Onaylanınca: tam bir çağrı ve sınıf sınıf sonuç ---');
// ============================================================================
{
  const { b, p } = await kur(true);
  await p.getByRole('button', { name: /uygula/i }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole('button', { name: /^Uygula$/ }).click();
  await p.waitForTimeout(600);

  const c = await cagrilar(p);
  const y = c.filter((x) => x.ad === 'odev_kardeslere_yay');
  de(y.length === 1, 'onaydan sonra TAM BİR yayma çağrısı');
  de(y[0]?.govde?.p_id === 'a1', 'çağrı kaynak ödevin id’siyle gidiyor');

  const t = await metin(p);
  de(/Efe Yayma/.test(t) && /50/.test(t) && /100/.test(t),
     'puanı değişen öğrenci eskisi → yenisi olarak yazılı');
  de(/Mert Yayma/.test(t), 'ikinci öğrenci de listede');
  de(!/Zeynep/.test(t), 'PUANI DEĞİŞMEYEN ÖĞRENCİ RAPORDA YOK');
  de(/hiçbir öğrencinin puanı değişmedi/.test(t),
     'puanı değişmeyen sınıf sessiz geçilmiyor, durumu yazılı');
  de(/Atlandı/.test(t) && /arşivde/.test(t),
     'ARŞİVDEKİ SINIF ATLANDIĞI RAPORDA YAZILI — sessiz atlama yok');
  de(/denetim izine kaydedildi/.test(t), 'denetim izi bilgisi ekranda');
  await b.close();
}

// ============================================================================
console.log('\n--- 4. 0031 çalıştırılmadıysa ekran bozulmuyor (Part VIII) ---');
// ============================================================================
{
  const { b, p } = await kur(false);
  const t = await metin(p);
  de(!/uygula/i.test(t), 'YAYMA DÜĞMESİ HİÇ ÇIKMIYOR');
  de(/ayrı ayrı düzenleyin/.test(t), '0030’un uyarısı yerinde duruyor');
  de(/birlikte verildi/.test(t), 'ödev yine kardeşli olduğunu söylüyor');
  de(!/schema cache|Could not find/i.test(t), 'İngilizce PostgREST hatası ekranda yok');
  de(/Değişiklikleri kaydet/.test(t), 'ödev düzenleme bugünkü gibi çalışıyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 5. 360 px: taşma ve dokunma hedefi ---');
// ============================================================================
{
  const { b, p } = await kur(true);
  const tasma = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(tasma === 0, `yatay taşma 0 px (ölçülen ${tasma})`);
  // Düğme metni uzun ("… 10V ve 10W sınıfına da uygula") ve sarmalı.
  const kucuk = await p.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((e) => e.checkVisibility())
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length,
  );
  de(kucuk === 0, `44 px altı dokunma hedefi 0 (ölçülen ${kucuk})`);
  await b.close();
}

console.log(
  hata === 0
    ? '\nKARDEŞ YAYMA DENETİMİ GEÇTİ — kusur yok'
    : `\nKARDEŞ YAYMA DENETİMİ KIRILDI — ${hata} kusur`,
);
process.exit(hata === 0 ? 0 : 1);
