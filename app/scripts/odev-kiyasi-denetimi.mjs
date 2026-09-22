/**
 * =============================================================================
 * ÖDEV KIYASI DENETİMİ — ekranda çizilen sayı (0047)
 *
 * Sunucu tarafı `odev_kiyasi_testleri.sql` ile ölçülüyor (14 grup, yedi
 * kusur provası). Burada ölçülen şey EKRANIN KENDİSİ.
 *
 * NEDEN AYRI BİR ÖLÇÜM GEREKİYOR: bu turun tehlikesi çökmek değil,
 * SESSİZCE YANLIŞ SAYI göstermek. Sunucu 65 gönderip ekran 65'i yanlış
 * satıra yazsa ya da seviye satırını kardeş yokken de çizse hiçbir SQL
 * testi bunu görmez. Bir çocuk kendini olduğundan iyi/kötü sanır.
 *
 * DÖRT DURUM:
 *   A. Süre dolmadı        → kart HİÇ çizilmiyor (öğretmenin kuralı)
 *   B. Tek teslim          → ortalama YİNE görünüyor (alt sınır yok)
 *   C. Kardeş şube yok     → seviye satırı YOK, sınıf satırı var
 *   D. Kardeş şube var     → iki satır da var, sayılar doğru yerde
 *
 * Ayrıca: veli tarafında aynı kart ve YARGI CÜMLESİ YOK.
 *
 * Ön koşul: repo kökünde `npx http-server -c-1 -p 8788 .`
 * =============================================================================
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/';

/**
 * Kart başlığı CSS'te `uppercase`; `innerText` onu BÜYÜK HARF döndürüyor.
 *
 * Bu ilk yazımda ölü bir ölçüm doğurmuştu: "kart yok" iddiası, kart
 * çizilse bile yeşil kalıyordu çünkü aranan "Bu ödevde durum" hiçbir
 * zaman o hâliyle metinde yoktu. Türkçe küçük harfe indirip arıyoruz
 * ('I' → 'ı' farkı için `tr`).
 */
const iceriyorMu = (metin, aranan) =>
  metin.toLocaleLowerCase('tr').includes(aranan.toLocaleLowerCase('tr'));
const gun = (n) => new Date(Date.now() + n * 864e5).toISOString();

let hata = 0;
const de = (ok, m) => {
  if (!ok) {
    hata++;
    console.log('  ✗ ' + m);
  } else console.log('  ✓ ' + m);
};

/** Puanlanmış, teslim edilmiş bir ödev kaydı. */
function odev(id, puan) {
  return {
    id,
    baslik: 'Köklü Sayılar — 2',
    aciklama: null,
    tur: 'test',
    son_tarih: gun(-2),
    soru_sayisi: 4,
    gec_teslim: false,
    sik_sayisi: 4,
    sinif_arsiv: false,
    odev_yolu: null,
    gonderim: {
      zaman: gun(-3),
      puan,
      ogretmen_puan: null,
      cevaplar: {},
      gorsel_yolu: null,
      dogru: 3,
      yanlis: 1,
      bos: 0,
      durum: 'puanlandi',
      gecikmeli: false,
      ogretmen_yorum: null,
    },
    konu_analizi: [],
    cevap_anahtari: null,
    anahtar_yolu: null,
  };
}

const b = await chromium.launch();

async function ac(kiyas, { rol = 'ogrenci', sonTarih = gun(-2) } = {}) {
  const s = await b.newContext({ viewport: { width: 420, height: 1000 } });
  const o = odev('od-1', 80);
  o.son_tarih = sonTarih;

  await s.addInitScript(
    ([oturumJson, odevJson, kiyasJson]) => {
      localStorage.setItem('sekiz_oturum', oturumJson);
      const asil = window.fetch;
      const json = (x) =>
        new Response(JSON.stringify(x), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      const od = JSON.parse(odevJson);
      const ky = JSON.parse(kiyasJson);
      window.fetch = async (u, opt) => {
        const url = String(typeof u === 'string' ? u : u.url);
        const m = url.match(/\/rpc\/([a-z_]+)/);
        if (!m) return asil(u, opt);
        if (m[1] === 'ogrenci_odevleri')
          return json({
            ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A', tur: 'okul' },
            odevler: [od],
            dersler: [],
            okunmamis_mesaj: 0,
          });
        if (m[1] === 'odev_kiyasi') return json(ky);
        if (m[1] === 'veli_paneli')
          return json({
            ogrenci: { ad: 'Ela Yılmaz', sinif: '9A', tur: 'okul' },
            genel_ortalama: 80,
            odevler: [
              {
                baslik: od.baslik,
                son_tarih: od.son_tarih,
                olusturma: od.son_tarih,
                gonderildi: true,
                gonderim_zamani: od.gonderim.zaman,
                puan: 80,
                durum: 'puanlandi',
                konu_analizi: [],
                yanlis_sorular: [],
                bos_sorular: [],
                kiyas: ky,
              },
            ],
            mesajlar: [],
            odemeler: [],
            okunmamis_mesaj: 0,
            son_gorulme: null,
          });
        if (m[1] === 'bildirim_sayilari') return json({ okunmamis_mesaj: 0, puan_bekleyen: 0 });
        if (m[1] === 'ewalu_mesajlari') return json([]);
        return json({});
      };
    },
    [
      JSON.stringify({
        token: 'sahte-jeton-uzunlugu-yeterli-olsun-diye-uzatildi',
        rol,
        ogrenci: { id: 'o1', ad: 'Ela Yılmaz', sinif: '9A' },
      }),
      JSON.stringify(o),
      JSON.stringify(kiyas),
    ],
  );
  const p = await s.newPage();
  await p.goto(KOK + '#' + (rol === 'ogrenci' ? '/ogrenci/odev/od-1' : '/veli/odevler'), {
    waitUntil: 'networkidle',
  });
  await p.waitForTimeout(600);
  return { s, p };
}

const HAZIR_KARDESLI = {
  durum: 'hazir',
  sinif: { ad: '9A', ortalama: 65, adet: 24 },
  seviye: { ad: '9. sınıflar', ortalama: 61.4, adet: 71, sube: 3 },
};
const HAZIR_KARDESSIZ = {
  durum: 'hazir',
  sinif: { ad: '9A', ortalama: 65, adet: 24 },
  seviye: null,
};

// ---------------------------------------------------------------------------
console.log('A — SÜRE DOLMADI: kart hiç çizilmiyor');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac({ durum: 'sure_dolmadi' });
  const t = await p.evaluate(() => document.body.innerText);
  de(!iceriyorMu(t, 'Bu ödevde durum'), 'kıyas kartı yok');
  de(!/ortalaması/.test(t), '"ortalaması" kelimesi ekranda geçmiyor');
  de(t.includes('80 puan'), 'puan yine de görünüyor (kart puanı gizlemiyor)');
  await s.close();
}
{
  // KARARI `durum` VERİYOR, SAYILARIN VARLIĞI DEĞİL.
  //
  // Yukarıdaki taklitte `sinif` alanı hiç yok; bu yüzden kart "sayı
  // yok" diye de çizilmemiş olabilirdi ve `durum` kapısı ÖLÇÜLMEMİŞ
  // kalıyordu (kusur provasıyla yakalandı: kapıyı silince denetim yeşil
  // kaldı). Burada sayılar DOLU ama süre dolmamış: kart yine çizilmemeli.
  //
  // Bugün sunucu böyle bir yanıt üretmiyor. Ölçüm yine de duruyor,
  // çünkü sözleşmeyi kilitliyor: bir gün uç `sinif`'i her zaman
  // gönderirse kart süre dolmadan ortalamayı SIZDIRIRDI.
  const { s, p } = await ac({
    durum: 'sure_dolmadi',
    sinif: { ad: '9A', ortalama: 65, adet: 24 },
    seviye: null,
  });
  const t = await p.evaluate(() => document.body.innerText);
  de(!iceriyorMu(t, 'Bu ödevde durum'), 'sayılar dolu olsa bile süre dolmadan kart yok');
  de(!t.includes('9A ortalaması'), 'ortalama sızmıyor');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('B — TEK TESLİM: ortalama yine görünüyor (alt sınır yok)');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac({
    durum: 'hazir',
    sinif: { ad: '9A', ortalama: 80, adet: 1 },
    seviye: null,
  });
  const t = await p.evaluate(() => document.body.innerText);
  de(iceriyorMu(t, 'Bu ödevde durum'), 'kart çizildi');
  de(t.includes('1 teslimden'), 'tek teslim olduğu yazıyor');
  de(/9A ortalaması/.test(t), 'sınıf satırı var');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('C — KARDEŞ ŞUBE YOK: seviye satırı çizilmiyor');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac(HAZIR_KARDESSIZ);
  const t = await p.evaluate(() => document.body.innerText);
  de(t.includes('9A ortalaması'), 'sınıf satırı var');
  de(!t.includes('9. sınıflar'), 'seviye satırı YOK');
  // Boş bir satır ya da "—" da olmamalı: olmayan bir kıyas varmış gibi durur.
  de(!/9\. sınıflar\s*[—-]/.test(t), 'yerine tire konmuyor');
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('D — KARDEŞ ŞUBE VAR: iki satır, sayılar DOĞRU satırda');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac(HAZIR_KARDESLI);

  // Sayıyı etiketiyle BİRLİKTE okuyoruz. Yalnız "65 ekranda var mı" diye
  // sormak, 65'i seviye satırına yazan bir kusuru geçirirdi.
  const satirlar = await p.evaluate(() =>
    [...document.querySelectorAll('dl div')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
  );
  const bul = (etiket) => satirlar.find((x) => x.startsWith(etiket)) ?? '';

  de(bul('Puanın').endsWith('80'), `puan satırı: "${bul('Puanın')}"`);
  de(bul('9A ortalaması').endsWith('65'), `sınıf satırı: "${bul('9A ortalaması')}"`);
  de(bul('9. sınıflar').endsWith('61,4'), `seviye satırı: "${bul('9. sınıflar')}"`);
  de(bul('9A ortalaması').includes('24 teslimden'), 'sınıf adedi doğru satırda');
  de(bul('9. sınıflar').includes('71 teslimden'), 'seviye adedi doğru satırda');

  // YARGI CÜMLESİ YOK — bir önceki turun kuralı.
  const t = await p.evaluate(() => document.body.innerText);
  for (const hukum of ['üstündesin', 'altındasın', 'geridesin', 'Eline sağlık']) {
    de(!t.includes(hukum), `"${hukum}" yazmıyor`);
  }
  await s.close();
}

// ---------------------------------------------------------------------------
console.log('E — VELİ TARAFI: aynı kart, aynı sayılar');
// ---------------------------------------------------------------------------
{
  const { s, p } = await ac(HAZIR_KARDESLI, { rol: 'veli' });
  const satirlar = await p.evaluate(() =>
    [...document.querySelectorAll('dl div')].map((d) => d.innerText.replace(/\s+/g, ' ').trim()),
  );
  const bul = (etiket) => satirlar.find((x) => x.startsWith(etiket)) ?? '';

  de(satirlar.length > 0, 'veli satırında kıyas kartı var');
  de(bul('Puanı').endsWith('80'), `veli puan satırı: "${bul('Puanı')}"`);
  de(bul('9A ortalaması').endsWith('65'), 'veliye giden sınıf ortalaması öğrencininkiyle aynı');
  de(bul('9. sınıflar').endsWith('61,4'), 'veliye giden seviye ortalaması aynı');
  // Muhatap ayrımı: veliye "Puanın" değil "Puanı".
  de(!satirlar.some((x) => x.startsWith('Puanın')), 'veliye "sen" diliyle seslenilmiyor');
  await s.close();
}

await b.close();
console.log(
  hata === 0 ? '\nÖDEV KIYASI DENETİMİ: KUSUR YOK' : `\nÖDEV KIYASI DENETİMİ: ${hata} KUSUR`,
);
process.exit(hata === 0 ? 0 : 1);
