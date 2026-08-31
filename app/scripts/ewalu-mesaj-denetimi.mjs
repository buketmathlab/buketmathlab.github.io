/**
 * 0032 — EWALU'NUN CÜMLELERİNİ ÖĞRETMEN YAZSIN: TARAYICIDA UÇTAN UCA
 *
 * ASIL ÖLÇÜM: TURUN SÖZLEŞMESİ. Öğretmene verilen söz şuydu —
 * "bugünkü beş cümle varsayılan olarak kalır; o ekrana girmezseniz
 * öğrenciler bugünkü cümleleri görür; değiştirdiğiniz bant sizin
 * yazdığınızla görünür; istediğiniz zaman varsayılana dönersiniz."
 * Bu betik o cümlenin dört yarısını da ölçüyor, ve son ikisini
 * ÖĞRENCİNİN GERÇEK SONUÇ KARTINDAN okuyarak — öğretmenin ekranından
 * değil. Yazdığı cümlenin çocuğa ULAŞTIĞINI görmek turun bütün mesele.
 *
 * İkincisi: 0032 panelde çalıştırılmadıysa ekran bozulmuyor mu?
 * (Part VIII: sakin Türkçe kart, İngilizce PostgREST hatası değil.)
 *
 * Görünürlük `innerText` ile ölçülüyor; `textContent` kapalı diyalogların
 * gizli başlıklarını da sayıyor (0021'de o hata yapılmıştı).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/** Kodda duran varsayılanlardan ikisi — ekranda bunları arıyoruz. */
const VARSAYILAN_50 = 'henüz tam oturmamış';
const VARSAYILAN_0 = 'Bu ödev seni zorlamış';

/** Öğretmenin yazacağı cümle. Varsayılanların hiçbirine benzemiyor. */
const OZEL_50 = 'Yarı yoldasın; kalan yarısını birlikte tamamlayacağız.';

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

/**
 * @param {object} o
 * @param {boolean} o.ucVar  0032 çalıştırılmış mı
 * @param {'ogretmen'|'ogrenci'} o.rol
 * @param {Array<{bant:number,cumle:string}>} o.mesajlar  sunucudaki kayıtlı hâl
 */
async function kur({ ucVar = true, rol = 'ogretmen', mesajlar = [] } = {}) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 360, height: 780 } });

  await s.addInitScript(
    ([oturum, baslangic, ucVarStr]) => {
      localStorage.setItem('sekiz_oturum', oturum);
      window.__cagrilar = [];
      // Sunucunun kayıtlı hâli: yazma çağrıları bunu GERÇEKTEN değiştiriyor,
      // böylece "kaydet → yenile → yeni cümle" döngüsü uçtan uca ölçülüyor.
      window.__kayitli = JSON.parse(baslangic);
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

        // 0032 ÇALIŞTIRILMAMIŞ HÂLİ: PostgREST'in gerçek cevabı.
        if ((m[1] === 'ewalu_mesajlari' || m[1] === 'ewalu_mesaj_yaz') && ucVarStr !== 'var') {
          return json(
            { code: 'PGRST202',
              message: `Could not find the function public.${m[1]} in the schema cache` },
            404,
          );
        }

        if (m[1] === 'ewalu_mesajlari') return json(window.__kayitli);

        if (m[1] === 'ewalu_mesaj_yaz') {
          const bant = govde?.p_bant;
          const cumle = govde?.p_cumle;
          window.__kayitli = window.__kayitli.filter((x) => x.bant !== bant);
          if (cumle !== null && cumle !== undefined) {
            window.__kayitli.push({ bant, cumle: String(cumle).trim() });
          }
          return json({ bant, cumle: cumle ?? null, degisti: true });
        }

        // Öğrencinin ödev ekranı: 60 puanlı, teslim edilmiş bir test.
        if (m[1] === 'ogrenci_odevleri') {
          return json({
            ogrenci: { id: 'o1', ad: 'Ada Yıldırım', sinif: '9A', tur: 'okul' },
            dersler: [],
            odevler: [{
              id: 'a1', baslik: 'Kesirler', aciklama: null, tur: 'test',
              son_tarih: '2026-09-01', soru_sayisi: 10, gec_teslim: true,
              sik_sayisi: 5, sinif_arsiv: false, odev_yolu: null,
              anahtar_yolu: null, cevap_anahtari: { 1: 'A' },
              konular: null,
              gonderim: { id: 'g1', zaman: '2026-08-30T10:00:00Z', durum: 'onaylandi',
                          dogru: 6, yanlis: 4, bos: 0, puan: 60,
                          ogretmen_puan: null, ogretmen_yorum: null },
            }],
          });
        }

        return json({});
      };
    },
    [
      JSON.stringify(
        rol === 'ogrenci'
          ? { token: 'sahte', rol: 'ogrenci',
              ogrenci: { id: 'o1', ad: 'Ada Yıldırım', tur: 'okul', sinif: '9A' } }
          : { token: 'sahte', rol: 'ogretmen', ad: 'Buket Topuzoğlu' },
      ),
      JSON.stringify(mesajlar),
      ucVar ? 'var' : 'yok',
    ],
  );

  const p = await s.newPage();
  const yol = rol === 'ogrenci' ? '#/ogrenci/odev/a1' : '#/ogretmen/ayarlar/ewalu';
  await p.goto(KOK + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);
const yazmalar = (p) =>
  p.evaluate(() => window.__cagrilar.filter((c) => c.ad === 'ewalu_mesaj_yaz'));

console.log('EWALU MESAJ DENETİMİ (0032)\n');

// ============================================================================
console.log('--- 1. Sözleşme: hiç dokunulmadıysa bugünkü cümleler duruyor ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [] });
  const t = await metin(p);
  de(t.includes(VARSAYILAN_50), 'öğretmen ekranında 50–69 varsayılanı yazılı');
  de(t.includes(VARSAYILAN_0), 'öğretmen ekranında 0–49 varsayılanı yazılı');
  de(/0–49/.test(t) && /50–69/.test(t) && /70–84/.test(t) && /85–99/.test(t),
     'beş bandın aralıkları ekranda');
  de(!/Sizin yazdığınız/.test(t), 'hiçbir bant "Sizin yazdığınız" işaretli değil');
  // DÜĞME SAYILIYOR, metin aranmıyor. İlk yazışında `innerText` aranıyordu
  // ve giriş kartındaki açıklama cümlesi ("…'Varsayılana dön' ile eski
  // hâline dönebilirsiniz") ölçümü yanlış yere düşürüyordu. Düğmeyi saymak
  // hem doğru şeyi ölçüyor hem daha sıkı: metin değişse de ölçüm ayakta.
  de((await p.getByRole('button', { name: /Varsayılana dön/ }).count()) === 0,
     'DÖNÜLECEK BİR ŞEY YOKKEN "Varsayılana dön" DÜĞMESİ çıkmıyor');
  de((await yazmalar(p)).length === 0, 'ekranı açmak tek başına hiçbir şey yazmıyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 2. Öğrencinin gördüğü: dokunulmamışken VARSAYILAN ---');
// ============================================================================
{
  const { b, p } = await kur({ rol: 'ogrenci', mesajlar: [] });
  const t = await metin(p);
  de(t.includes(VARSAYILAN_50), '60 puanlı sonuç kartında varsayılan cümle çıkıyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 3. Yazma: cümle kaydediliyor ve ÖĞRENCİYE ULAŞIYOR ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [] });

  // 50–69 kutusunu bul ve öğretmenin cümlesini yaz.
  const kutu = p.locator('textarea').nth(3); // BANT_NOKTALARI: 100, 85, 70, 50, 0
  await kutu.fill(OZEL_50);
  await p.waitForTimeout(200);

  // ÖNİZLEME KAYDETMEDEN DEĞİŞİYOR: öğretmen çocuğun ne göreceğini
  // kaydetmeden önce görüyor.
  de((await metin(p)).includes(OZEL_50), 'önizleme kaydetmeden yeni cümleyi gösteriyor');
  de((await yazmalar(p)).length === 0, 'YAZMADAN ÖNCE sunucuya hiçbir şey gitmiyor');

  await p.getByRole('button', { name: /^Kaydet$/ }).nth(3).click();
  await p.waitForTimeout(600);

  const y = await yazmalar(p);
  de(y.length === 1, 'kaydetmek TAM BİR yazma çağrısı yapıyor');
  de(y[0]?.govde?.p_bant === 50, 'çağrı doğru bandı taşıyor (50)');
  de(y[0]?.govde?.p_cumle === OZEL_50, 'çağrı cümleyi bozmadan gönderiyor');

  const t = await metin(p);
  de(/Sizin yazdığınız/.test(t), 'kaydedilen bant "Sizin yazdığınız" olarak işaretli');
  de((await p.getByRole('button', { name: /Varsayılana dön/ }).count()) === 1,
     'artık TAM BİR "Varsayılana dön" düğmesi çıkıyor');
  // Komşu bantlar bozulmamalı.
  de(t.includes(VARSAYILAN_0), 'dokunulmayan bant varsayılanda kaldı');

  await b.close();
}

// ============================================================================
console.log('\n--- 3b. ÖĞRENCİ artık öğretmenin cümlesini görüyor ---');
// ============================================================================
{
  // Sunucuda kayıtlı hâl: öğretmen 50 bandını yazmış.
  const { b, p } = await kur({ rol: 'ogrenci', mesajlar: [{ bant: 50, cumle: OZEL_50 }] });
  const t = await metin(p);
  de(t.includes(OZEL_50), 'ÖĞRETMENİN YAZDIĞI CÜMLE ÇOCUĞUN KARTINDA');
  de(!t.includes(VARSAYILAN_50), 'varsayılan cümle artık görünmüyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 4. Varsayılana dön: eski cümle geri geliyor ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [{ bant: 50, cumle: OZEL_50 }] });
  de((await metin(p)).includes(OZEL_50), 'başlangıçta öğretmenin cümlesi duruyor');

  await p.getByRole('button', { name: /Varsayılana dön/ }).first().click();
  await p.waitForTimeout(600);

  const y = await yazmalar(p);
  de(y.length === 1 && y[0]?.govde?.p_cumle === null,
     'geri alma `p_cumle: null` gönderiyor (satır silinsin)');

  const t = await metin(p);
  de(t.includes(VARSAYILAN_50), 'KUTUDA VARSAYILAN CÜMLE GERİ GELDİ');
  de(!t.includes(OZEL_50), 'öğretmenin cümlesi ekrandan kalktı');
  de(!/Sizin yazdığınız/.test(t), '"Sizin yazdığınız" işareti kalktı');
  de((await p.getByRole('button', { name: /Varsayılana dön/ }).count()) === 0,
     'geri alındıktan sonra düğme de kalktı');
  await b.close();
}

// ============================================================================
console.log('\n--- 5. Yasaklı kelime UYARIR, ENGELLEMEZ ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [] });
  const kutu = p.locator('textarea').nth(3);
  await kutu.fill('Bu sonuç başarısız sayılır, sınıfın ortalaması daha yüksek.');
  await p.waitForTimeout(300);

  const t = await metin(p);
  de(/başarısız/.test(t) && /dil kuralınız/.test(t), 'uyarı çıkıyor ve gerekçesi yazılı');
  de(/ortalama/.test(t), 'birden çok yasaklı kelime birlikte bildiriliyor');

  // ENGEL DEĞİL: düğme çalışmaya devam ediyor. Kural öğretmenin kendi
  // kuralı; kendi ürününün metnini yazarken onu bloke etmek haddimiz değil.
  const dugme = p.getByRole('button', { name: /^Kaydet$/ }).nth(3);
  de(await dugme.isEnabled(), 'KAYDET DÜĞMESİ HÂLÂ ETKİN — uyarı engel değil');
  await dugme.click();
  await p.waitForTimeout(500);
  de((await yazmalar(p)).length === 1, 'uyarıya rağmen kaydedilebiliyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 6. Boş cümle kaydedilemiyor ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [] });
  await p.locator('textarea').nth(3).fill('   ');
  await p.waitForTimeout(200);
  de(!(await p.getByRole('button', { name: /^Kaydet$/ }).nth(3).isEnabled()),
     'boş cümlede Kaydet düğmesi kapalı');
  de((await yazmalar(p)).length === 0, 'boş cümle sunucuya hiç gitmiyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 7. 0032 çalıştırılmadıysa ekran bozulmuyor (Part VIII) ---');
// ============================================================================
{
  const { b, p } = await kur({ ucVar: false });
  const t = await metin(p);
  de(/henüz hazır değil/.test(t), 'sakin Türkçe kart çıkıyor');
  de(/0032/.test(t), 'hangi dosyanın çalıştırılacağı yazılı');
  de(/bugünkü cümleleri görmeye devam/.test(t), 'öğrencilerin etkilenmediği söyleniyor');
  de(!/schema cache|Could not find/i.test(t), 'İngilizce PostgREST hatası ekranda YOK');
  de(!/Kaydet/.test(t), 'düzenleme kutuları hiç çizilmiyor');
  await b.close();
}

// ============================================================================
console.log('\n--- 7b. Uç yokken ÖĞRENCİNİN kartı bozulmuyor ---');
// ============================================================================
{
  // Turun en sessiz riski: bir AYAR ucunun ulaşılamaz olması çocuğun
  // sonuç kartını boş bırakırsa, kimse fark etmeden Ewalu susardı.
  const { b, p } = await kur({ ucVar: false, rol: 'ogrenci' });
  const t = await metin(p);
  de(t.includes(VARSAYILAN_50), 'UÇ YOKKEN DE varsayılan cümle çıkıyor');
  de(!/schema cache|Could not find/i.test(t), 'öğrenciye İngilizce hata görünmüyor');
  de(/60/.test(t), 'puan yine görünüyor, kart bozulmadı');
  await b.close();
}

// ============================================================================
console.log('\n--- 8. 360 px: taşma ve dokunma hedefi ---');
// ============================================================================
{
  const { b, p } = await kur({ mesajlar: [{ bant: 50, cumle: OZEL_50 }] });
  const tasma = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  de(tasma === 0, `yatay taşma 0 px (ölçülen ${tasma})`);
  const kucuk = await p.evaluate(() =>
    [...document.querySelectorAll('button, textarea')]
      .filter((e) => e.checkVisibility())
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
      .length,
  );
  de(kucuk === 0, `44 px altı dokunma hedefi 0 (ölçülen ${kucuk})`);
  await b.close();
}

console.log(
  hata === 0
    ? '\nEWALU MESAJ DENETİMİ GEÇTİ — kusur yok'
    : `\nEWALU MESAJ DENETİMİ KIRILDI — ${hata} kusur`,
);
process.exit(hata === 0 ? 0 : 1);
