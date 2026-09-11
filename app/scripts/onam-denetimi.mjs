/**
 * VELİ ONAMI — TARAYICIDA UÇTAN UCA (0034)
 *
 * ## Bu betiğin NEYİ kanıtlayıp NEYİ kanıtlamadığı
 *
 * Öğretmenin kararı: *onam uygulama içinde alınacak, onaylamayan veli
 * panele giremeyecek.*
 *
 * "Onaylamayan veri göremez" iddiası BURADA KANITLANMIYOR ve kanıtlanamaz:
 * bu denetimde sunucu yanıtlarını betiğin kendisi taklit ediyor. Kendi
 * kurduğum sahte yanıtın veri taşımadığını ölçmek dairesel olurdu.
 *
 * O iddianın yeri SQL ve ORADA ÖLÇÜLÜYOR — gerçek fonksiyona karşı,
 * `supabase/testler/onam_testleri.sql`:
 *   1. grup — onamsız `veli_paneli` çocuğa ait TEK BİR ALAN döndürmüyor
 *   2. grup — diğer dört uç 42501 veriyor
 *   9. grup — beyaz liste dışı HİÇBİR uç onamsız veliyi kabul etmiyor
 *
 * Bu betik o hattın TARAYICI YARISINI ölçüyor:
 *   1. Onam bekleyen veliye onam ekranı çiziliyor, sekmeler ÇİZİLMİYOR.
 *   2. Metnin asıl maddeleri ekranda gerçekten görünüyor.
 *   3. Onayla → sunucuya `onam_ver` gidiyor, DOĞRU sürümle.
 *   4. Onaydan sonra panel açılıyor, sekmeler geri geliyor.
 *   5. NEGATİF KONTROL: onamı olan veli bu ekranı hiç görmüyor.
 *   6. NEGATİF KONTROL: 0034 çalıştırılmamış panelde (uç `onam_gerekli`
 *      döndürmüyor) akış bugünkü gibi çalışıyor.
 *   7. Onam ekranında ÇIKIŞ duruyor — kimse ekranda kilitlenmiyor.
 *   8. Öğretmen tarafı: onam bekleyene "Onam bekliyor" etiketi.
 *   9. 360 px'de taşma ve dokunma hedefi.
 *
 * ## UYARI — ELLE GERİ ALMA KANITI ALACAKLARA
 *
 * Bu betik `yeni/` altındaki DERLENMİŞ paketi ölçüyor, kaynağı değil. Bir
 * yama koyup `npm run build` SESSİZCE DÜŞERSE eski paket yerinde kalır ve
 * denetim yamayı hiç görmeden YEŞİL yanar. `✓ built` görmeden sonuca
 * güvenmeyin.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';

// SÜRÜM KAYNAKTAN OKUNUYOR, kopyalanmıyor. Kopyalasaydım kaynak değişince
// denetim eski sürümü ölçmeye devam eder ve sessizce yanlış olurdu.
const SURUM = /ONAM_SURUMU = '([^']+)'/.exec(
  readFileSync(new URL('../src/lib/onam-metni.ts', import.meta.url), 'utf8'),
)?.[1];

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

const PANEL_DOLU = {
  ogrenci: { ad: 'Deniz Yalın', sinif: '9A', tur: 'okul' },
  genel_ortalama: 82,
  odevler: [],
  mesajlar: [],
  odemeler: [],
  okunmamis_mesaj: 0,
  son_gorulme: null,
};

const tarayici = await chromium.launch();

/**
 * Veli oturumu açar. `onamli` false ise sunucu 0034'ün kapısını
 * döndürüyor; `eskiPanel` true ise 0034 hiç çalıştırılmamış gibi davranıyor
 * (yanıtta `onam_gerekli` alanı YOK).
 */
async function veliSayfasi({ onamli = false, eskiPanel = false } = {}) {
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  const istekler = [];
  let onayVerildi = onamli;

  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde = r.request().postData();
    istekler.push({ uc, govde });

    let yanit = {};
    if (uc === 'veli_paneli') {
      yanit =
        eskiPanel || onayVerildi
          ? PANEL_DOLU
          : { onam_gerekli: true, surum: SURUM };
    } else if (uc === 'onam_ver') {
      // Sunucu sürümü doğruluyor; taklit de aynısını yapıyor ki yanlış
      // sürüm gönderen bir arayüz burada da yakalansın.
      const g = JSON.parse(govde ?? '{}');
      if (g.p_surum !== SURUM) {
        r.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Onam metni güncellenmiş.' }),
        });
        return;
      }
      onayVerildi = true;
      yanit = { onayli: true, surum: SURUM };
    }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yanit) });
  });

  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({
        rol: 'veli',
        token: 'v'.repeat(64),
        ogrenci: { id: 'o1', ad: 'Deniz Yalın', sinif: '9A', tur: 'okul' },
      }),
    ),
  );
  await s.goto(KOK + '/veli', { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  return { s, istekler };
}

console.log(`\nsürüm kaynaktan okundu: ${SURUM}`);
olc('ONAM_SURUMU okunabildi', Boolean(SURUM));

console.log('\n1 — ONAM BEKLEYEN VELİ: ekran çiziliyor, sekmeler çizilmiyor');
{
  const { s } = await veliSayfasi();
  const metin = await s.locator('body').innerText();

  // ÖLÇÜM BOŞ SAYFAYI ÖLÇMESİN. Bu kontrol olmadan aşağıdaki "sekme yok"
  // ölçümü, sayfa hiç çizilmediğinde de yeşil yanardı.
  olc('Onam ekranı çizildi', /Veli onam metni/i.test(metin));
  olc('onay düğmesi var', await s.getByRole('button', { name: /onaylıyorum/i }).isVisible());

  for (const sekme of ['Ödevler', 'Konular', 'Mesajlar']) {
    const n = await s.getByRole('link', { name: sekme }).count();
    olc(`"${sekme}" sekmesi çizilmiyor`, n === 0, `${n} bağlantı`);
  }

  // Çocuğa ait veri de görünmemeli (taklit yanıt zaten taşımıyor; bu,
  // arayüzün önbellekten bir yerden çıkarmadığının kontrolü).
  olc('panodaki çocuk verisi görünmüyor', !/82/.test(metin));

  console.log('\n2 — METNİN ASIL MADDELERİ EKRANDA');
  olc('yurt dışı barındırma yazıyor', /İsviçre/.test(metin));
  olc('onaylamamanın sonucu yazıyor', /Veli paneline giremezsiniz/i.test(metin));
  olc('sürüm ekranda yazıyor', metin.includes(SURUM));

  // ÖĞRETMENİN İKİNCİ TURDAKİ İSTEĞİ — ekranda gerçekten görünüyor mu.
  olc(
    'çocuğun uygulamayı kullanmasına izin cümlesi var',
    /öğrenci uygulamasını kullanmasına/i.test(metin),
  );
  olc('ad-soyad sayılıyor', /adı ve soyadı/i.test(metin));
  olc('not (puan) sayılıyor', /notu \(puanı\)/i.test(metin));
  olc('okul adının saklanmadığı yazıyor', /Okulun adı .*saklanmıyor/i.test(metin));
  olc('sınıf örneği yazıyor', /örneğin 9A/i.test(metin));
  olc(
    'düğmenin üstünde ne onaylandığı özetleniyor',
    /Onaylayarak, çocuğumun .* izin veriyorum/i.test(metin),
  );
  // Metin düz metin olarak çiziliyor; ham markdown ekrana sızmamalı.
  olc('ekranda ham ** işareti yok', !metin.includes('**'));

  // KAPSAM DOĞRU ANLATILIYOR MU (sürüm 3). Metin bir tur boyunca
  // "matematik zümresindeki öğretmenler — dört kişi" dedi; bu YANLIŞTI.
  olc('dersin öğretmeni ifadesi var', /dersine giren öğretmen/i.test(metin));
  olc(
    'öğretmenin yalnız kendi sınıfını gördüğü yazıyor',
    /yalnız kendi sınıflarındaki öğrencileri/i.test(metin),
  );
  olc('yöneticinin tamamını gördüğü yazıyor', /Platformu yöneten öğretmen/i.test(metin));

  // SİLİNENLER EKRANDA GERÇEKTEN YOK MU.
  //
  // Bu dört ölçüm turun asıl kanıtı: kaynakta sildiğimi biliyorum ama
  // ölçülen şey DERLENMİŞ PAKET. Derleme sessizce düşse eski paket
  // yerinde kalır ve yukarıdaki "var mı" ölçümleri bunu fark ETMEZDİ —
  // ama bu "yok mu" ölçümleri fark eder.
  console.log('\n2b — ÖĞRETMENİN KALDIRTTIKLARI EKRANDA YOK');
  olc('yapay zekâ bölümü yok', !/yapay zekâ/i.test(metin));
  olc('cevap anahtarı cümlesi yok', !/cevap anahtarı/i.test(metin));
  olc('özel ders ödeme/ders planı satırı yok', !/(ödeme kaydı|ders planı)/i.test(metin));
  olc('yanlış olan "dört kişi" ifadesi yok', !/(dört kişi|zümre)/i.test(metin));
  // Öğretmeni yanıltan rakam: "60 saniye" bakma süresi sanılıyordu.
  olc('yanıltan "60 saniye" rakamı yok', !/(60\s*saniye|altmış saniye)/i.test(metin));
  olc(
    'fotoğrafın bakma süresi olmadığı yazıyor',
    /ne kadar bakabildiğiyle ilgisi yok/i.test(metin),
  );

  console.log('\n7 — ÇIKIŞ ONAM EKRANINDA DA DURUYOR');
  olc(
    'çıkış düğmesi var (kimse ekranda kilitlenmiyor)',
    await s.getByRole('button', { name: /çıkış/i }).isVisible(),
  );

  console.log('\n9 — 360 px: TAŞMA VE DOKUNMA HEDEFİ');
  const olcum = await s.evaluate(() => {
    const kok = document.documentElement;
    const kucuk = [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .map((e) => ({ t: e.textContent?.trim().slice(0, 24), h: e.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44);
    return { tasma: kok.scrollWidth - kok.clientWidth, kucuk };
  });
  olc('360 px yatay taşma yok', olcum.tasma === 0, `${olcum.tasma} px`);
  olc('44 px altı dokunma hedefi yok', olcum.kucuk.length === 0, JSON.stringify(olcum.kucuk));

  await s.close();
}

console.log('\n3–4 — ONAYLA: sunucuya gidiyor ve panel açılıyor');
{
  const { s, istekler } = await veliSayfasi();
  await s.getByRole('button', { name: /onaylıyorum/i }).click();
  await s.waitForTimeout(900);

  const cagri = istekler.find((i) => i.uc === 'onam_ver');
  olc('onam_ver çağrıldı', Boolean(cagri));
  if (cagri) {
    const g = JSON.parse(cagri.govde ?? '{}');
    olc('doğru sürümle gönderildi', g.p_surum === SURUM, `p_surum = ${g.p_surum}`);
    olc('jeton gönderildi', typeof g.p_token === 'string' && g.p_token.length > 0);
  }

  const metin = await s.locator('body').innerText();
  olc('onam ekranı kalktı', !/Veli onam metni/i.test(metin));
  olc('panel çizildi', /Deniz Yalın/.test(metin));
  for (const sekme of ['Ödevler', 'Konular', 'Mesajlar']) {
    const n = await s.getByRole('link', { name: sekme }).count();
    olc(`"${sekme}" sekmesi geri geldi`, n > 0);
  }
  await s.close();
}

console.log('\n5 — NEGATİF KONTROL: onamı olan veli bu ekranı hiç görmüyor');
{
  const { s, istekler } = await veliSayfasi({ onamli: true });
  const metin = await s.locator('body').innerText();
  olc('onam ekranı hiç çıkmadı', !/Veli onam metni/i.test(metin));
  olc('panel doğrudan açıldı', /Deniz Yalın/.test(metin));
  olc('onam_ver hiç çağrılmadı', !istekler.some((i) => i.uc === 'onam_ver'));
  await s.close();
}

console.log('\n6 — NEGATİF KONTROL: 0034 çalıştırılmamış panelde akış aynı');
{
  // Öğretmen migration'ı henüz çalıştırmadıysa uç `onam_gerekli` alanını
  // hiç döndürmüyor. Arayüz o hâlde kapıyı UYDURMAMALI — yoksa veliler,
  // sunucuda karşılığı olmayan bir onam ekranında kilitlenirdi.
  const { s, istekler } = await veliSayfasi({ eskiPanel: true });
  const metin = await s.locator('body').innerText();
  olc('onam ekranı çıkmadı', !/Veli onam metni/i.test(metin));
  olc('panel bugünkü gibi açıldı', /Deniz Yalın/.test(metin));
  olc('onam_ver çağrılmadı', !istekler.some((i) => i.uc === 'onam_ver'));
  await s.close();
}

console.log('\n8 — ÖĞRETMEN TARAFI: "Onam bekliyor" etiketi');
{
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde =
      uc === 'ben_kimim'
        ? { id: 's1', ad: 'Buket', sahip: true, vekalet: false, vekil: null }
        : uc === 'sinif_velileri'
          ? {
              sinif: { id: '9a', ad: '9A', ozel: false },
              veliler: [
                {
                  ogrenci_id: 'o1', ad: 'Onamsız Veli', tur: 'okul',
                  veli_kodu_var: true, onam_var: false,
                  mesaj_sayisi: 0, son_mesaj: null, okunmamis: 0,
                },
                {
                  ogrenci_id: 'o2', ad: 'Onamlı Veli', tur: 'okul',
                  veli_kodu_var: true, onam_var: true,
                  mesaj_sayisi: 0, son_mesaj: null, okunmamis: 0,
                },
              ],
            }
          : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }),
    ),
  );
  await s.goto(KOK + '/ogretmen/veliler/sinif/9a', { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);

  const metin = await s.locator('body').innerText();
  olc('Veliler ekranı çizildi', /Onamsız Veli/.test(metin));

  // ETİKET DOĞRU KİŞİDE Mİ. İki veli var: biri onamsız, biri onamlı.
  // Tek satırla ölçseydim "etiket herkeste çıkıyor" hatası yakalanmazdı.
  const n = await s.getByText('Onam bekliyor', { exact: true }).count();
  olc('"Onam bekliyor" tam olarak bir kez çıkıyor', n === 1, `${n} kez`);

  const satir = s.locator('li, a').filter({ hasText: 'Onamlı Veli' }).first();
  const onamliMetin = (await satir.count()) ? await satir.innerText() : '';
  olc('onamlı velide etiket yok', !/Onam bekliyor/.test(onamliMetin));
  await s.close();
}

await tarayici.close();
console.log(`\n--- GEÇEN: ${gecen}   KALAN: ${kalan} ---`);
process.exit(kalan === 0 ? 0 : 1);
