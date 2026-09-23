/**
 * =============================================================================
 * ÖĞRETMEN SINIFLARI DENETİMİ — "Sınıfları" penceresi (0050)
 *
 * BU DENETİM BİR CANLI HATADAN SONRA YAZILDI. Öğretmen bildirdi:
 * "Öğretmenlerin sınıfları sekmesine tıkladığımda o öğretmenlere
 * tanımladığım sınıflar gözükmüyor."
 *
 * Bu ekranın HİÇBİR tarayıcı denetimi yoktu ve hata tam bu yüzden
 * sessizce yaşadı: sunucu doğru veriyi tutuyordu, SQL testleri yeşildi,
 * yalnız ekran onu göstermiyordu.
 *
 * HATA ÜÇ PARÇAYDI VE ÜÇÜ DE BURADA ÖLÇÜLÜYOR:
 *   1. Pencere mevcut atamayı İŞARETLİ açmıyordu (uçta kimlik yoktu)
 *   2. Seçim pencereler arasında TAŞINIYORDU (kapanışta sıfırlanmıyor)
 *   3. Boş açılan pencerede "Kaydet" bütün atamayı SİLİYORDU
 *      (`ogretmen_sinif_ata` delete + insert yapıyor)
 *
 * ÜÇÜNCÜSÜ EN TEHLİKELİSİYDİ ve onu ölçen şey ekranda görünen bir şey
 * değil: SUNUCUYA GİDEN İSTEK. Bu yüzden denetim `__istekler` ile giden
 * gövdeleri okuyor — "ekranda bir şey oldu" yetmez, "ne gönderildi"
 * ölçülüyor.
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

const SINIFLAR = [
  { id: 's-9a', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 20 },
  { id: 's-9b', ad: '9B', seviye: 9, sube: 'B', ozel: false, arsiv: false, ogrenci_sayisi: 18 },
  { id: 's-10a', ad: '10A', seviye: 10, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 22 },
];

/**
 * İKİ ÖĞRETMEN, FARKLI SINIFLARLA — ikinci kusuru (seçimin taşınması)
 * ölçebilmek için şart. Tek öğretmenle o hata görünmezdi.
 */
const OGRETMENLER = [
  {
    id: 'g-sahip', ad: 'Sahip Ogretmen', sahip: true, aktif: true, pin_var: true,
    sinif_idler: [], sinif_sayisi: 0, odev_sayisi: 0, son_gorulme: null,
  },
  {
    id: 'g-bir', ad: 'Bir Ogretmen', sahip: false, aktif: true, pin_var: true,
    sinif_idler: ['s-9a', 's-10a'], sinif_sayisi: 2, odev_sayisi: 3, son_gorulme: null,
  },
  {
    id: 'g-iki', ad: 'Iki Ogretmen', sahip: false, aktif: true, pin_var: true,
    sinif_idler: ['s-9b'], sinif_sayisi: 1, odev_sayisi: 1, son_gorulme: null,
  },
];

const b = await chromium.launch();

async function ac() {
  const s = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await s.addInitScript(
    ([oturumJson, ogretmenlerJson, siniflarJson]) => {
      localStorage.setItem('sekiz_oturum', oturumJson);
      const asil = window.fetch;
      const json = (x) =>
        new Response(JSON.stringify(x), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      const ogretmenler = JSON.parse(ogretmenlerJson);
      const siniflar = JSON.parse(siniflarJson);
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

        if (m[1] === 'ogretmenler_listesi') return json(ogretmenler);
        if (m[1] === 'siniflar_listesi') return json(siniflar);
        if (m[1] === 'ben_kimim') return json({ id: 'g-sahip', ad: 'Sahip', sahip: true });
        if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
        if (m[1] === 'ogretmen_sinif_ata') return json({ sinif_sayisi: 0 });
        return json({});
      };
    },
    [
      JSON.stringify({
        token: 'sahte-jeton-uzunlugu-yeterli-olsun-diye-uzatildi',
        rol: 'ogretmen',
      }),
      JSON.stringify(OGRETMENLER),
      JSON.stringify(SINIFLAR),
    ],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#/ogretmen/ogretmenler', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { s, p };
}

/** Açık penceredeki işaretli sınıf adları. */
const isaretliler = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('dialog[open] label')]
      .filter((l) => l.querySelector('input[type=checkbox]')?.checked)
      .map((l) => l.textContent.trim()),
  );

/**
 * AÇIK penceredeki düğmeye basar.
 *
 * `getByRole('button', {name})` KULLANILAMIYOR: bu depoda `Dialog`
 * native `<dialog>` üzerine kurulu ve KAPALI diyaloglar DOM'da kalıyor.
 * "Vazgeç" iki pencerede birden var; Playwright haklı olarak
 * "strict mode violation" diyor. Ölçüm `dialog[open]` ile daraltıldı.
 */
async function acikPencereDugmesi(p, etiket) {
  await p.evaluate((e) => {
    const d = document.querySelector('dialog[open]');
    const dugme = [...(d?.querySelectorAll('button') ?? [])].find(
      (x) => x.textContent.trim() === e,
    );
    dugme?.click();
  }, etiket);
  await p.waitForTimeout(400);
}

/**
 * Bir öğretmenin SATIRINI bulur — en DAR kapsayıcıyı.
 *
 * İLK YAZIMDA `find` KULLANMIŞTIM VE ÖLÇÜM YANLIŞ SONUÇ VERDİ. `find`
 * belgedeki İLK eşleşmeyi döndürüyor, o da bütün listeyi saran EN DIŞ
 * kapsayıcı: adı içeriyor ama içindeki ilk "Sınıfları" düğmesi BAŞKA
 * öğretmene ait. Üç grup birden kırmızı yandı ve suçlu koddaymış gibi
 * göründü.
 *
 * Doğrusu: adı içeren ve içinde düğme olan elemanlardan EN AZ torunu
 * olanı, yani satırın kendisi.
 */
function satirBul(ad) {
  const adaylar = [...document.querySelectorAll('li, div')].filter(
    (e) => e.textContent?.includes(ad) && e.querySelector('button'),
  );
  if (adaylar.length === 0) return null;
  return adaylar.reduce((a, b) =>
    b.querySelectorAll('*').length < a.querySelectorAll('*').length ? b : a,
  );
}

/** Bir öğretmenin satırındaki "Sınıfları" düğmesine basar. */
async function sinifPenceresiniAc(p, ad) {
  await p.evaluate(
    ([a, kaynak]) => {
      const bul = eval(`(${kaynak})`);
      const satir = bul(a);
      const dugme = [...(satir?.querySelectorAll('button') ?? [])].find(
        (d) => d.textContent.trim() === 'Sınıfları',
      );
      dugme?.click();
    },
    [ad, satirBul.toString()],
  );
  await p.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
console.log('1 — ATANMIŞ SINIFLAR İŞARETLİ AÇILIYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  await sinifPenceresiniAc(p, 'Bir Ogretmen');
  const i = await isaretliler(p);
  de(i.includes('9A'), `9A işaretli (${i.join(', ') || 'hiçbiri'})`);
  de(i.includes('10A'), '10A işaretli');
  de(!i.includes('9B'), 'atanmamış 9B işaretli DEĞİL');
  de(i.length === 2, `tam iki sınıf işaretli (${i.length})`);
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('2 — SEÇİM ÖĞRETMENLER ARASINDA TAŞINMIYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  await sinifPenceresiniAc(p, 'Bir Ogretmen');
  // Vazgeç: seçim sıfırlanmalı.
  await acikPencereDugmesi(p, 'Vazgeç');

  await sinifPenceresiniAc(p, 'Iki Ogretmen');
  const i = await isaretliler(p);
  de(i.includes('9B'), `ikinci öğretmenin kendi sınıfı işaretli (${i.join(', ') || 'hiçbiri'})`);
  de(!i.includes('9A') && !i.includes('10A'), 'önceki öğretmenin işaretleri TAŞINMAMIŞ');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('3 — HEPSİNİ KALDIRMAK EK ONAY İSTİYOR (istek GİTMİYOR)');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  await sinifPenceresiniAc(p, 'Bir Ogretmen');

  // İşaretlerin hepsini kaldır.
  await p.evaluate(() => {
    for (const k of document.querySelectorAll('dialog[open] input[type=checkbox]')) {
      if (k.checked) k.click();
    }
  });
  await p.waitForTimeout(200);
  de((await isaretliler(p)).length === 0, 'hiçbir sınıf işaretli değil');

  await acikPencereDugmesi(p, 'Kaydet');

  const metin = await p.evaluate(() => document.body.innerText);
  de(metin.includes('Bütün sınıfları kaldırılsın mı?'), 'onay penceresi çıktı');

  // ASIL ÖLÇÜM: sunucuya HENÜZ istek gitmemiş olmalı.
  const gitti = await p.evaluate(() =>
    window.__istekler.some((i) => i.ad === 'ogretmen_sinif_ata'),
  );
  de(!gitti, 'onay verilmeden ogretmen_sinif_ata ÇAĞRILMADI');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('4 — ONAY VERİLİNCE BOŞ LİSTE GİDİYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  await sinifPenceresiniAc(p, 'Bir Ogretmen');
  await p.evaluate(() => {
    for (const k of document.querySelectorAll('dialog[open] input[type=checkbox]')) {
      if (k.checked) k.click();
    }
  });
  await acikPencereDugmesi(p, 'Kaydet');
  await acikPencereDugmesi(p, 'Evet, hepsini kaldır');
  await p.waitForTimeout(300);

  const istek = await p.evaluate(
    () => window.__istekler.filter((i) => i.ad === 'ogretmen_sinif_ata').at(-1) ?? null,
  );
  de(istek !== null, 'ogretmen_sinif_ata çağrıldı');
  de(istek?.govde?.p_id === 'g-bir', `doğru öğretmene (${istek?.govde?.p_id})`);
  de(
    Array.isArray(istek?.govde?.p_sinif_idler) && istek.govde.p_sinif_idler.length === 0,
    'gönderilen liste boş',
  );
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('5 — OLAĞAN KAYDETME: SEÇİLEN KİMLİKLER GİDİYOR');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  await sinifPenceresiniAc(p, 'Iki Ogretmen');
  // 9A'yı da ekle: 9B + 9A gitmeli.
  await p.evaluate(() => {
    const l = [...document.querySelectorAll('dialog[open] label')].find((x) =>
      x.textContent.trim().startsWith('9A'),
    );
    l?.querySelector('input[type=checkbox]')?.click();
  });
  await p.waitForTimeout(200);
  await acikPencereDugmesi(p, 'Kaydet');

  const istek = await p.evaluate(
    () => window.__istekler.filter((i) => i.ad === 'ogretmen_sinif_ata').at(-1) ?? null,
  );
  const gonderilen = istek?.govde?.p_sinif_idler ?? [];
  de(gonderilen.includes('s-9b'), `mevcut sınıf korunmuş (${gonderilen.join(', ')})`);
  de(gonderilen.includes('s-9a'), 'yeni işaretlenen sınıf eklenmiş');
  de(gonderilen.length === 2, `tam iki kimlik gitti (${gonderilen.length})`);

  // Onay penceresi ÇIKMAMALI — kaybedilen bir şey yok.
  const metin = await p.evaluate(() => document.body.innerText);
  de(!metin.includes('Bütün sınıfları kaldırılsın mı?'), 'gereksiz onay penceresi çıkmadı');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('6 — SAHİP SATIRINDA "SINIFLARI" DÜĞMESİ YOK');
//
// İLK YAZIMDA BU ÖLÇÜM ÖLÇÜLEMEZ BİR ŞEY İDDİA EDİYORDU: "sahibin
// satırını bul, içinde düğme var mı bak." Sahibin satırında düğme
// YOKSA satır bulucu o satırı zaten bulamıyor ve bir üst kapsayıcıyı
// döndürüyor — yani ölçüm hem yanlış kırmızı yanıyor hem de doğru
// çalıştığında hiçbir şey kanıtlamıyordu.
//
// SAYILABİLİR BİR ŞEYE ÇEVRİLDİ: sayfada kaç tane "Sınıfları" düğmesi
// var? Üç öğretmenin biri sahip, yani İKİ olmalı. Sahibin satırına
// düğme eklenirse sayı üçe çıkar ve bu ölçüm kırılır.
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac();
  const adet = await p.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter(
        (d) => d.textContent.trim() === 'Sınıfları',
      ).length,
  );
  de(adet === 2, `"Sınıfları" düğmesi sahip dışındaki iki öğretmende (${adet})`);
  await s.close();
}

await b.close();
console.log('');
console.log(hata === 0 ? 'ÖĞRETMEN SINIFLARI DENETİMİ: KUSUR YOK' : `ÖĞRETMEN SINIFLARI DENETİMİ: ${hata} KUSUR`);
process.exit(hata === 0 ? 0 : 1);
