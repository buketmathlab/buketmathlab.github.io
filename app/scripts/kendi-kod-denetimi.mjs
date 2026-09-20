/**
 * KENDİ KODUMU YENİLE — TARAYICIDA (0046)
 *
 * Sunucu tarafı `kendi_kodum_testleri.sql` ile ölçülüyor (11 grup).
 * Burada ölçülen şey EKRANIN VAADİ — ve bu turda vaadin çoğu
 * öğretmenin iki sorusundan doğdu:
 *
 *   *"Düğme giriş yaptıktan sonra mı çıkıyor?"*
 *   *"Kaydetmeleri gerektiğini hatırlatıyor değil mi?"*
 *
 * ALTI ÖLÇÜM:
 *
 *   1. ONAYSIZ SUNUCUYA İSTEK GİTMİYOR. 0024/0045'te ölçülen vaadin
 *      aynısı. İşlem geri alınamaz: yanlışlıkla basılan düğme, ailenin
 *      elindeki fişi o anda ölü kâğıda çevirir.
 *   2. GÖVDE YALNIZ JETON TAŞIYOR. Kimin kodu olduğu istemciden
 *      söylenmiyor; sunucu oturumdan buluyor. Gövdeye öğrenci kimliği
 *      koymak, onu değiştirmeyi denemeye davet olurdu.
 *   3. YENİ KOD EKRANDA VE KAPATILANA KADAR KALIYOR. Uç mevcut kodu
 *      OKUMUYOR (0046 kararı) — ekrandan kaçan kod bu oturumda geri
 *      gelmiyor. Otomatik kapanan bir bildirim olsaydı özellik
 *      kullanılamaz olurdu.
 *   4. NOT ALMA HATIRLATMASI KODLA BİRLİKTE GÖRÜNÜYOR. Öğretmenin
 *      ikinci sorusunun karşılığı.
 *   5. ÇIKIŞTA KOD NE DOM'DA NE DEPODA KALIYOR (0045 deseni).
 *   6. VELİ TARAFINDA AYNI KART VAR VE DİL "SİZ".
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/** Kodlar birbirinden AYIRT EDİLEBİLİR: ölçüm alan adına değil DEĞERE bakıyor. */
const YENI_OGRENCI = 'OGRYENI7';
const YENI_VELI = 'VLIYENI4';

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

const b = await chromium.launch();

/**
 * Bir rol için sahte sunucu kuruyor.
 *
 * TAKLİT GERÇEĞE SADIK: `kendi_kodumu_yenile` çağrıldıkça kod
 * DEĞİŞİYOR. Hep aynı kodu döndürseydi "yeni kod ekranda" ölçümü, ekran
 * hiçbir şey yapmasa da yeşil kalırdı — bu deponun tekrar tekrar
 * ayıkladığı ölü ölçüm deseni.
 */
async function baglam(rol, yeniKod) {
  const s = await b.newContext({ viewport: { width: 420, height: 900 } });
  await s.addInitScript(
    ([oturumJson, r, yk]) => {
      localStorage.setItem('sekiz_oturum', oturumJson);
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

        if (m[1] === 'kendi_kodumu_yenile') return json({ rol: r, kod: yk });

        // Panoların ihtiyacı olan asgari veri. `{}` döndürmek ekranı
        // çökertirdi — 0044'te öğrenilen ders: boş nesne bir cevap değil.
        if (m[1] === 'ogrenci_odevleri')
          return json({ ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A' }, odevler: [], dersler: [] });
        if (m[1] === 'veli_paneli')
          return json({
            ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A' },
            odevler: [],
            dersler: [],
            odemeler: null,
          });
        if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
        return json({});
      };
    },
    [
      JSON.stringify({
        token: 'sahte-jeton-uzunlugu-yeterli-olsun-diye-uzatildi',
        rol,
        ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A' },
      }),
      rol,
      yeniKod,
    ],
  );
  const p = await s.newPage();
  return { s, p };
}

const istekler = (p, ad) =>
  p.evaluate((a) => window.__cagrilar.filter((c) => c.ad === a), ad);

// ===========================================================================
console.log('ÖĞRENCİ TARAFI');
// ===========================================================================
const { s: so, p } = await baglam('ogrenci', YENI_OGRENCI);
await p.goto(KOK + '#/ogrenci', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const metin = () => p.evaluate(() => document.body.innerText);

// ---------------------------------------------------------------------------
console.log('1 — ONAYSIZ SUNUCUYA İSTEK GİTMİYOR');
// ---------------------------------------------------------------------------
{
  const t0 = await metin();
  de(t0.includes('Giriş kodun'), 'kart panoda görünüyor');
  de(!t0.includes(YENI_OGRENCI), 'kart açılışta hiçbir kod göstermiyor');

  await p.getByRole('button', { name: 'Kodumu yenile' }).click();
  await p.waitForTimeout(400);

  de((await istekler(p, 'kendi_kodumu_yenile')).length === 0, 'onay öncesi istek YOK');

  const onay = await metin();
  de(/çalışmaz olur/.test(onay), 'onay, eski kodun öleceğini söylüyor');
  de(/fiş/i.test(onay), 'onay, fişteki kodun da öleceğini söylüyor');
  de(/not et/.test(onay), 'onay, not almayı hatırlatıyor');
  de(/başka bir telefondan/.test(onay), 'onay, öteki girişin kapanacağını söylüyor');
}

// ---------------------------------------------------------------------------
console.log('2 — ONAYDAN SONRA: TEK İSTEK, GÖVDE YALNIZ JETON');
// ---------------------------------------------------------------------------
{
  await p.getByRole('button', { name: 'Yeni kod al' }).click();
  await p.waitForTimeout(600);

  const c = await istekler(p, 'kendi_kodumu_yenile');
  de(c.length === 1, `tam bir istek gitti (${c.length})`);

  // ASIL ÖLÇÜM: istemci kimlik göndermiyor.
  const anahtarlar = Object.keys(c[0]?.govde ?? {});
  de(
    anahtarlar.length === 1 && anahtarlar[0] === 'p_token',
    `gövde yalnız jeton taşıyor (${JSON.stringify(anahtarlar)})`,
  );
}

// ---------------------------------------------------------------------------
console.log('3 — YENİ KOD EKRANDA, HATIRLATMAYLA BİRLİKTE');
// ---------------------------------------------------------------------------
{
  // ÖLÇÜM AÇIK PENCEREYE DARALTILDI — VE BU BİR ONARIM.
  //
  // Önce sayfanın tamamına (`innerText`) bakıyordum. Kusur provası
  // yanlışladı: `Dialog` yerel <dialog> öğesi kullanıyor ve KAPALI
  // pencere DOM'da kalıyor, metni de `innerText`e giriyor. Yani sonuç
  // penceresindeki hatırlatmaları tamamen silsem bile, ONAY
  // penceresinde duran "not et" cümlesi ölçümü yeşil tutuyordu.
  //
  // Artık yalnız `dialog[open]` okunuyor: hatırlatmanın KODLA AYNI
  // PENCEREDE olduğu ölçülüyor — iddia zaten buydu.
  const acikPencere = await p.evaluate(
    () => document.querySelector('dialog[open]')?.innerText ?? '',
  );

  de(acikPencere.includes(YENI_OGRENCI), 'yeni kod açık pencerede görünüyor');

  // CÜMLENİN KENDİSİ ARANIYOR, "not et" PARÇASI DEĞİL — İKİNCİ ONARIM.
  //
  // Pencereyi daralttıktan sonra da ısırmadı: kapatma düğmesinin etiketi
  // "Tamam, not ettim" ve `/not et/` ona takılıyordu. Yani hatırlatma
  // cümlesini silsem bile DÜĞMENİN ADI ölçümü yeşil tutuyordu.
  de(
    acikPencere.includes('Bunu bir yere not et.'),
    'not alma hatırlatmasının CÜMLESİ kodla aynı pencerede',
  );
  de(
    /öğretmenin görebiliyor/.test(acikPencere),
    'kurtarma yolu (öğretmenin görebiliyor) aynı pencerede',
  );
}

// ---------------------------------------------------------------------------
console.log('4 — KOD KENDİLİĞİNDEN KAYBOLMUYOR');
//
// Uç mevcut kodu OKUMUYOR: ekrandan kaçan kod bu oturumda geri gelmiyor.
// Bu yüzden "bir süre sonra hâlâ duruyor mu" ölçülüyor.
// ---------------------------------------------------------------------------
{
  await p.waitForTimeout(2500);
  de((await metin()).includes(YENI_OGRENCI), '2,5 saniye sonra kod hâlâ ekranda');
}

// ---------------------------------------------------------------------------
console.log('5 — KAPATINCA KOD NE EKRANDA NE DEPODA KALIYOR');
// ---------------------------------------------------------------------------
{
  await p.getByRole('button', { name: 'Tamam, not ettim' }).click();
  await p.waitForTimeout(400);

  const domda = await p.evaluate((k) => document.body.innerHTML.includes(k), YENI_OGRENCI);
  de(!domda, 'kapatınca kod DOM içinde de kalmıyor');

  const depoda = await p.evaluate((k) => {
    const hepsi = [localStorage, sessionStorage];
    for (const d of hepsi) {
      for (let i = 0; i < d.length; i++) {
        const ad = d.key(i);
        if (ad && String(d.getItem(ad)).includes(k)) return true;
      }
    }
    return false;
  }, YENI_OGRENCI);
  de(!depoda, 'kod tarayıcı deposuna yazılmıyor');
}

await so.close();

// ===========================================================================
console.log('VELİ TARAFI');
// ===========================================================================
const { s: sv, p: pv } = await baglam('veli', YENI_VELI);
await pv.goto(KOK + '#/veli', { waitUntil: 'networkidle' });
await pv.waitForTimeout(600);

// ---------------------------------------------------------------------------
console.log('6 — VELİDE DE KART VAR VE DİL "SİZ"');
// ---------------------------------------------------------------------------
{
  const t = await pv.evaluate(() => document.body.innerText);
  de(t.includes('Giriş kodunuz'), 'veli panosunda kart var');
  de(t.includes('yenileyebilirsiniz'), 'veli metni "siz" diliyle');
  // NEGATİF: öğrenci metni sızmamış.
  de(!t.includes('yenileyebilirsin.'), 'veli kartında "sen" dili yok');

  await pv.getByRole('button', { name: 'Kodumu yenile' }).click();
  await pv.waitForTimeout(300);
  await pv.getByRole('button', { name: 'Yeni kod al' }).click();
  await pv.waitForTimeout(600);

  const t2 = await pv.evaluate(() => document.body.innerText);
  de(t2.includes(YENI_VELI), 'veli yeni kodu ekranda');
  de(/not edin/.test(t2), 'veliye "not edin" deniyor');
  de(/öğretmeniniz görebiliyor/.test(t2), 'veliye "öğretmeniniz" deniyor');
}

await sv.close();
await b.close();

console.log('');
console.log(hata === 0 ? 'KENDİ KOD DENETİMİ: KUSUR YOK' : `KENDİ KOD DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
