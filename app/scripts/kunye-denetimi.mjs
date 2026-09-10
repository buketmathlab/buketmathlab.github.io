/**
 * SORU KÂĞIDI KÜNYESİ — TARAYICIDA UÇTAN UCA
 *
 * ## Bu betiğin NEYİ kanıtlayıp NEYİ kanıtlamadığı
 *
 * Öğretmenin şartı şuydu: *"öğrenciye ödev kâğıdı gönderilirken cevap
 * anahtarı olmayacak. Ödevi teslim ettikten sonra cevap anahtarı
 * açılacak."*
 *
 * O şart burada KANITLANMIYOR ve kanıtlanamaz — bu denetimde sunucu
 * yanıtlarını betiğin kendisi taklit ediyor, dolayısıyla "sunucu anahtarı
 * göndermiyor" demek kendi kurduğum sahte yanıtı ölçmek olurdu. Dairesel
 * bir kanıt, kanıt değildir.
 *
 * O iddianın yeri SQL ve ORADA ZATEN ÖLÇÜLÜYOR — gerçek fonksiyona karşı,
 * `supabase/testler/guvenlik_testleri.sql`:
 *
 *   8. CEVAP ANAHTARI teslim öncesi sızıyor mu?   → `cevap_anahtari` VE
 *      `anahtar_yolu` ikisi de `null`
 *   10. Teslim sonrası anahtar açılmalı            → açılıyor
 *
 * Bu betik, o hattın TARAYICI YARISINI ölçüyor:
 *
 *   1. Künye okunuyor ve önizleme ne bulduğunu söylüyor.
 *   2. UYGULA'ya basılmadan hiçbir alan değişmiyor.
 *   3. Bozuk künye uygulanamıyor, Türkçe açıklama çıkıyor.
 *   4. Uygulanınca hem cevap ızgarası hem konular doluyor.
 *   5. ASIL KAZANÇ: sunucuya giden istekte `p_konular` GERÇEKTEN dolu.
 *      Turun bütün sebebi bu — konu bugün PDF'ten çıkarılamıyor ve konu
 *      karnesi tamamen o alana dayanıyor.
 *   6. Anahtarsız bir yanıt geldiğinde öğrenci ekranı kendiliğinden bir
 *      anahtar uydurmuyor/önbellekten çıkarmıyor.
 *   7. 360 px'de taşma ve dokunma hedefi.
 *
 * ## Bu denetime ELLE geri alma kanıtı alacaklara uyarı
 *
 * Bu betik `yeni/` altındaki DERLENMİŞ paketi ölçüyor, kaynağı değil.
 * Bir yama koyup `npm run build` SESSİZCE DÜŞERSE (tipik sebep: yama bir
 * import'u kullanılmaz bırakır, `error TS6133`), eski paket yerinde kalır
 * ve denetim yamayı hiç görmeden YEŞİL yanar — yani kanıt, kanıtlamak
 * istediğinin tam tersini gösterir.
 *
 * Bu tam olarak yaşandı: `p_konular: null` yaması `sunucuyaHazirla`
 * import'unu boşta bıraktı, derleme düştü, denetim 22/0 geçti. Yamanın
 * ısırdığı ancak derleme çıktısı gizlenmeden bakılınca görüldü.
 *
 * KURAL: yama sonrası `npm run build` çıktısına BAK; `✓ built` görmeden
 * denetimin sonucuna güvenme. (0030'da migration için öğrenilen dersin
 * arayüz hâli.)
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';

const SINIFLAR = [
  { id: '9a', ad: '9A', seviye: 9, sube: 'A', arsiv: false, ozel: false, ogrenci_sayisi: 20 },
];

const gun = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

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

/**
 * Öğretmen olarak ödev oluşturma akışının 3. adımına kadar gelir.
 *
 * `tur` parametresi 8b için gerekiyor: açık uçlu ödevde cevap anahtarı
 * kavramı yok, `ilerle()` 2. adımı ATLAYIP doğrudan 3'e geçiyor.
 */
async function ucuncuAdim(soruSayisi = 5, tur = 'test') {
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  const istekler = [];
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    istekler.push({ uc, govde: r.request().postData() });
    const govde =
      uc === 'siniflar_listesi' ? SINIFLAR
      : uc === 'konu_onerileri' ? ['Türev', 'Limit']
      : uc === 'ben_kimim' ? { id: 's1', ad: 'Buket', sahip: true, vekalet: false, vekil: null }
      // ASIL YOL `odevler_coklu_olustur` (0030); `odev_olustur` yalnız o uç
      // panelde yoksa devreye giren yedek. Denetim üretimdeki yolu ölçüyor.
      : uc === 'odevler_coklu_olustur' ? { odevler: [{ id: 'a1', sinif: '9A' }] }
      : uc === 'odev_olustur' ? { id: 'yeni-odev' }
      : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }),
    ),
  );
  await s.goto(KOK + '/ogretmen/odevler/yeni', { waitUntil: 'networkidle' });
  await s.waitForTimeout(600);

  // 1. adım
  await s.getByLabel(/başlık/i).fill('Künye denemesi');
  await s.getByRole('checkbox', { name: '9A' }).check().catch(async () => {
    await s.getByText('9A', { exact: true }).click();
  });
  await s.locator('input[type="date"]').fill(gun(5));
  if (tur === 'acik') {
    await s.getByLabel('Tür').selectOption('acik');
    await s.waitForTimeout(200);
  } else {
    await s.getByLabel(/soru sayısı/i).fill(String(soruSayisi));
  }
  await s.getByRole('button', { name: /devam|ilerle/i }).first().click();
  await s.waitForTimeout(400);

  // 2. adım YALNIZ testte var; açık uçluda `ilerle()` doğrudan 3'e geçiyor.
  if (tur === 'test') {
    await s.getByRole('button', { name: /elle gireceğim|devam/i }).first().click();
    await s.waitForTimeout(400);
  }

  return { s, istekler };
}

const KUNYE = '1  A  Türev\n2  C  Türev\n3  B  Limit\n4  D  Limit\n5  A  Türev';

console.log('\n1 — KÜNYE PANELİ AÇILIYOR VE ÖNİZLEME GÖSTERİYOR');
{
  const { s } = await ucuncuAdim();
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.waitForTimeout(300);

  const kutu = s.getByLabel('Künye metni');
  olc('künye kutusu açıldı', await kutu.isVisible());

  await kutu.fill(KUNYE);
  await s.waitForTimeout(300);

  const metin = await s.locator('body').innerText();
  olc('önizleme kaç cevap okunduğunu söylüyor', /5\s*sorunun cevabı/i.test(metin));
  olc('önizleme kaç konu okunduğunu söylüyor', /5\s*sorunun konusu/i.test(metin));
  await s.close();
}

console.log('\n2 — UYGULA’YA BASILMADAN HİÇBİR ŞEY DEĞİŞMİYOR');
{
  const { s } = await ucuncuAdim();

  // IZGARANIN KENDİ SAYACI OKUNUYOR ("3/5 cevap girildi").
  //
  // İlk yazışında bu ölçüm `select` öğelerini sayıyordu ve ızgarada
  // `select` YOK — sayaç her zaman 0 dönüyor, ölçüm her koşulda
  // geçiyordu. Geri alma kanıtı yakaladı: onay kuralını delen bir yama
  // konduğunda denetim yine yeşil yanmıştı. Ölçülemeyen bir iddia,
  // iddia değildir.
  const sayac = async () => {
    const m = /(\d+)\s*\/\s*(\d+)\s*cevap girildi/.exec(await s.locator('body').innerText());
    return m ? Number(m[1]) : -1;
  };
  const once = await sayac();
  olc('sayaç okunabiliyor (denetim kör değil)', once >= 0, `${once}`);

  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill(KUNYE);
  await s.waitForTimeout(400);

  const sonra = await sayac();
  olc('yapıştırmak ızgarayı DOLDURMUYOR', once === sonra, `önce ${once} · sonra ${sonra}`);

  // Ve UYGULA'dan SONRA gerçekten doluyor — yoksa yukarıdaki ölçüm
  // "hiçbir şey hiç çalışmıyor" durumunda da geçerdi.
  await s.getByRole('button', { name: 'Uygula' }).click();
  await s.waitForTimeout(500);
  const uygulandi = await sayac();
  olc('UYGULA’dan sonra ızgara doluyor', uygulandi === 5, `${uygulandi}/5`);
  await s.close();
}

console.log('\n3 — UYGULANINCA ANAHTAR VE KONULAR DOLUYOR');
{
  const { s } = await ucuncuAdim();
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill(KUNYE);
  await s.waitForTimeout(300);
  await s.getByRole('button', { name: 'Uygula' }).click();
  await s.waitForTimeout(500);

  const govde = await s.locator('body').innerText();
  // Konular ekranda görünmeli: KonuAtama özetinde konu adları geçiyor.
  olc('konu adları ekranda', /Türev/.test(govde) && /Limit/.test(govde));
  olc('künye kutusu kapandı', (await s.getByLabel('Künye metni').count()) === 0);
  await s.close();
}

console.log('\n4 — SUNUCUYA GİDEN İSTEKTE KONULAR GERÇEKTEN VAR');
{
  const { s, istekler } = await ucuncuAdim();
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill(KUNYE);
  await s.waitForTimeout(300);
  await s.getByRole('button', { name: 'Uygula' }).click();
  await s.waitForTimeout(400);
  // `/taslak/i` DEĞİL: düğme "Taslağı kaydet" yazıyor ve Türkçe ünsüz
  // yumuşaması yüzünden kök "taslağ" oluyor. Kısa yoldan eşleşen bir
  // parça seçiliyor.
  await s.getByRole('button', { name: /kaydet/i }).first().click();
  await s.waitForTimeout(900);

  const olustur = istekler.find(
    (i) => i.uc === 'odevler_coklu_olustur' || i.uc === 'odev_olustur');
  olc('ödev oluşturma ucu çağrıldı', olustur !== undefined,
      olustur?.uc ?? istekler.map((i) => i.uc).join(', '));
  if (olustur) {
    const p = JSON.parse(olustur.govde ?? '{}');
    const konular = p.p_konular ?? {};
    const anahtar = p.p_cevap_anahtari ?? {};
    olc('p_konular 5 sorunun konusunu taşıyor', Object.keys(konular).length === 5,
        JSON.stringify(konular));
    olc('p_cevap_anahtari 5 cevabı taşıyor', Object.keys(anahtar).length === 5,
        JSON.stringify(anahtar));
    // Değerler de doğru mu — sayı tutup içerik kayabilirdi.
    olc('3. sorunun konusu Limit', konular['3'] === 'Limit', String(konular['3']));
    olc('3. sorunun cevabı B', anahtar['3'] === 'B', String(anahtar['3']));
  }
  await s.close();
}

console.log('\n5 — BOZUK KÜNYE UYGULANMIYOR, TÜRKÇE AÇIKLAMA ÇIKIYOR');
{
  const { s } = await ucuncuAdim();
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill('Merhaba, bu bir soru kâğıdıdır.\nİkinci cümle.');
  await s.waitForTimeout(400);

  const metin = await s.locator('body').innerText();
  olc('hiçbir satır okunamadığı söyleniyor', /hiçbir satır okunamadı/i.test(metin));
  olc('ne yapması gerektiği söyleniyor', /numara, cevap, konu/i.test(metin));
  olc('İngilizce hata metni yok', !/error|invalid|failed/i.test(metin));

  const uygula = s.getByRole('button', { name: 'Uygula' });
  olc('Uygula düğmesi çalışmıyor', await uygula.isDisabled());
  await s.close();
}

console.log('\n6 — ANAHTARSIZ YANITTA ÖĞRENCİ EKRANI ANAHTAR UYDURMUYOR');
{
  // Sunucunun anahtarı gizlemesi SQL'de ölçülüyor (guvenlik_testleri 8).
  // Burada ölçülen ŞEY FARKLI: sunucu `null` gönderdiğinde istemci
  // kendiliğinden bir anahtar üretmiyor, önbellekten çıkarmıyor.
  const s = await tarayici.newPage({ viewport: { width: 360, height: 780 } });
  const govdeler = [];
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    const govde =
      uc === 'ogrenci_odevleri'
        ? {
            ogrenci: { id: 'o1', ad: 'Ada', sinif: '9A', tur: 'okul' },
            okunmamis_mesaj: 0,
            dersler: [],
            odevler: [
              {
                id: 'a1', baslik: 'Künye denemesi', aciklama: null, tur: 'test',
                son_tarih: gun(3), soru_sayisi: 5, gec_teslim: true, sik_sayisi: 5,
                sinif_arsiv: false, odev_yolu: 'odev/x.pdf',
                gonderim: null, konu_analizi: [],
                cevap_anahtari: null, anahtar_yolu: null,
              },
            ],
          }
        : {};
    govdeler.push(JSON.stringify(govde));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({
        rol: 'ogrenci', token: 't'.repeat(64),
        ogrenci: { id: 'o1', ad: 'Ada', tur: 'okul', sinif: '9A' },
      }),
    ),
  );
  await s.goto(KOK + '/ogrenci/odevler', { waitUntil: 'networkidle' });
  await s.waitForTimeout(800);

  const ekran = await s.locator('body').innerText();
  olc('ekranda "cevap anahtarı" bölümü yok', !/cevap anahtarı/i.test(ekran));
  // Ağdan gelen gövdede de yok — sahte yanıtın kendisi de temiz olmalı,
  // yoksa yukarıdaki ölçüm yanlış bir şeyi ölçerdi.
  olc('ağ yanıtında anahtar yok', !govdeler.some((g) => /"cevap_anahtari":\{/.test(g)));

  const tasma = await s.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  olc('360 px yatay taşma yok', tasma === 0, `${tasma} px`);
  await s.close();
}

console.log('\n7 — 360 px: TAŞMA VE DOKUNMA HEDEFİ (künye paneli açıkken)');
{
  const { s } = await ucuncuAdim();
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill(KUNYE);
  await s.waitForTimeout(400);

  const olcum = await s.evaluate(() => {
    const kok = document.documentElement;
    const kucuk = [...document.querySelectorAll('button,a,input,select,textarea')]
      .map((e) => ({
        t: (e.textContent || e.tagName).trim().slice(0, 18),
        h: Math.round(e.getBoundingClientRect().height),
      }))
      .filter((x) => x.h > 0 && x.h < 44);
    return { tasma: kok.scrollWidth - kok.clientWidth, kucuk };
  });
  olc('yatay taşma yok', olcum.tasma === 0, `${olcum.tasma} px`);
  olc('44 px altı dokunma hedefi yok', olcum.kucuk.length === 0, JSON.stringify(olcum.kucuk));
  await s.close();
}

// ---------------------------------------------------------------------------
// 8 — KÜNYE KULLANILMAZSA ESKİ AKIŞ AYNEN ÇALIŞIYOR
//
// Öğretmenin şartı: *"Künye olmadığı zaman da şu anki gibi çalışsın."*
//
// İki somut sebebi var. Üç meslektaşının skill'i YOK — onlar ödevi
// bugünkü yolla oluşturacak: iki PDF, ızgaradan anahtar, elle konu.
// Öğretmenin kendisi de her ödevi Claude'da üretmeyecek.
//
// Kod bunu zaten sağlıyordu (panel `KonuAtama`'nın altında, kapalı
// başlıyor, state'i yalnız `Uygula` değiştiriyor) — ama bu bir İDDİAYDI.
// 1–7. gruplar 22 ölçümün hepsini künye YOLUNDA yapıyor; künyesiz akış
// hiç ölçülmüyordu. Ölçülmeyen vaat, bir sonraki turda sessizce bozulur.
// ---------------------------------------------------------------------------
console.log('\n8 — KÜNYE KULLANILMAZSA ESKİ AKIŞ AYNEN ÇALIŞIYOR');
{
  const { s, istekler } = await ucuncuAdim();

  // Panel KAPALI başlamalı: künyesi olmayan öğretmen her ödevde
  // kullanmayacağı bir metin kutusunu geçmek zorunda kalmasın.
  olc('künye kutusu kapalı başlıyor', (await s.getByLabel('Künye metni').count()) === 0);
  olc('yalnız "Künyeden doldur" düğmesi duruyor',
      await s.getByRole('button', { name: 'Künyeden doldur' }).isVisible());

  // ESKİ YOL: cevaplar ızgaradan tek tek.
  const cevaplar = { 1: 'A', 2: 'C', 3: 'B', 4: 'D', 5: 'E' };
  for (const [no, sik] of Object.entries(cevaplar)) {
    await s.getByRole('button', { name: `${no}. soru, ${sik} şıkkı` }).click();
  }
  await s.waitForTimeout(300);

  const sayacMetni = await s.locator('body').innerText();
  olc('ızgara elle doldu', /5\s*\/\s*5\s*cevap girildi/.test(sayacMetni));

  // ESKİ YOL: konular aralıkla.
  await s.locator('input[id$="-ilk"]').fill('1');
  await s.locator('input[id$="-son"]').fill('5');
  await s.locator('input[id$="-konu"]').fill('Üslü Sayılar');
  await s.getByRole('button', { name: 'Ata', exact: true }).click();
  await s.waitForTimeout(400);

  // Künyeye HİÇ DOKUNULMADI — kutu hâlâ yok.
  olc('künyeye dokunulmadı (kutu hâlâ kapalı)',
      (await s.getByLabel('Künye metni').count()) === 0);

  await s.getByRole('button', { name: /kaydet/i }).first().click();
  await s.waitForTimeout(900);

  const olustur = istekler.find(
    (i) => i.uc === 'odevler_coklu_olustur' || i.uc === 'odev_olustur');
  olc('künyesiz ödev kaydedilebiliyor', olustur !== undefined);
  if (olustur) {
    const p = JSON.parse(olustur.govde ?? '{}');
    const a = p.p_cevap_anahtari ?? {};
    const k = p.p_konular ?? {};
    olc('anahtar elle girilenle birebir',
        JSON.stringify(a) === JSON.stringify(cevaplar), JSON.stringify(a));
    olc('konular elle girilenle birebir',
        Object.keys(k).length === 5 && k['3'] === 'Üslü Sayılar', JSON.stringify(k));
  }
  await s.close();
}

console.log('\n8b — AÇIK UÇLU ÖDEVDE KÜNYE PANELİ HİÇ ÇIKMIYOR');
{
  // Açık uçluda cevap anahtarı kavramı yok; künye orada anlamsız bir
  // kutu olurdu.
  const { s } = await ucuncuAdim(5, 'acik');
  olc('künye düğmesi yok',
      (await s.getByRole('button', { name: 'Künyeden doldur' }).count()) === 0);
  olc('künye kutusu yok', (await s.getByLabel('Künye metni').count()) === 0);
  await s.close();
}

console.log('\n8c — İKİ YOL ÇAKIŞMIYOR: ELLE GİRİLEN KAYBOLMUYOR');
{
  // `OdevOlustur.tsx` yorumu bunu iddia ediyordu ama ölçen bir şey yoktu:
  //   "ÜZERİNE YAZMA DEĞİL BİRLEŞTİRME: öğretmen ızgarada elle bir şey
  //    girdiyse ve künyede o soru yoksa, girdiği kaybolmamalı."
  // Öğretmenin şartının en ince hâli bu — eski yol ve yeni yol aynı
  // ekranda birbirini bozmadan yaşayabilmeli.
  const { s, istekler } = await ucuncuAdim();

  await s.getByRole('button', { name: '1. soru, E şıkkı' }).click();
  await s.waitForTimeout(200);

  // Künye YALNIZ 2–5'i kapsıyor; 1. soru künyede YOK.
  await s.getByRole('button', { name: 'Künyeden doldur' }).click();
  await s.getByLabel('Künye metni').fill('2  C  Türev\n3  B  Limit\n4  D  Limit\n5  A  Türev');
  await s.waitForTimeout(300);
  await s.getByRole('button', { name: 'Uygula' }).click();
  await s.waitForTimeout(500);

  await s.getByRole('button', { name: /kaydet/i }).first().click();
  await s.waitForTimeout(900);

  const olustur = istekler.find(
    (i) => i.uc === 'odevler_coklu_olustur' || i.uc === 'odev_olustur');
  if (olustur) {
    const a = JSON.parse(olustur.govde ?? '{}').p_cevap_anahtari ?? {};
    olc('elle girilen 1. soru DURUYOR', a['1'] === 'E', `1 → ${a['1']}`);
    olc('künyeden gelen 2–5 de var', a['2'] === 'C' && a['5'] === 'A', JSON.stringify(a));
  } else {
    olc('ödev kaydedildi', false, 'uç çağrılmadı');
  }
  await s.close();
}

await tarayici.close();
console.log(`\n--- GEÇEN: ${gecen}   KALAN: ${kalan} ---`);
process.exit(kalan === 0 ? 0 : 1);
