/**
 * 0085 — ÖDEVİN VERİLİŞ TARİHİ, SON TESLİM TARİHİ VE UZATMA
 * (Chromium, taklit RPC)
 *
 * Öğretmenin isteği: "Ödevleri verdiğim tarih de ödevin üzerinde yazsın
 * geriye dönüp baktığımda. Yani veriliş tarihi ve son teslim tarihi
 * yazsın. Eğer teslim tarihinde uzatma yaptıysam o ekstra belirtilsin."
 * Kararları: tarihleri ÖĞRENCİ VE VELİ DE GÖRSÜN; hem ÖDEV SAYFASINDA
 * hem LİSTEDE yazsın.
 *
 *  T1. ÖĞRETMEN LİSTESİ: "Verildi: …" ve "Son teslim: …" yan yana;
 *      uzatılan kartta "uzatıldı", öne alınanda "öne alındı"; taslakta
 *      "Verildi" YOK.
 *  T2. ÖDEV SAYFASI: tarih kartı çiziliyor, uzatma cümlesi iki tarihi de
 *      taşıyor.
 *  T3. ÖDEV SAYFASI (TASLAK): veriliş yerine "henüz yayınlanmadı" notu.
 *  T4. ÖĞRENCİ: veriliş satırı ve uzatma cümlesi kartta.
 *  T5. VELİ: aynı iki satır velide de.
 *  T6. 0085 ÇALIŞMAMIŞ SUNUCU: `tarihler` hiç gelmiyor → listede yalnız
 *      "Son teslim" yazıyor, "Verildi" ÇIKMIYOR, ekran bozulmuyor; ödev
 *      sayfasında tarih kartı HİÇ çizilmiyor.
 *  T7. 360 px'de taşma yok (dört ekranın hepsi).
 *
 * ---------------------------------------------------------------------------
 * KUSUR PROVALARI — beşi de ısırdı (her provada paket YENİDEN DERLENDİ)
 *
 *   1. Listeden uzatma işareti kaldırıldı (içe alma satırıyla birlikte —
 *      yoksa kusur tip denetimine çarpıyor ve ölçümün ısırıp ısırmadığı
 *      hiç anlaşılmıyor) → T1 "uzatılan kartta uzatıldı" ve "öne alınan
 *      kartta öne alındı".
 *   2. `verilisMetni` taslakta `son_tarih`'e düşürüldü (veriliş tarihi
 *      uyduruldu) → T1 "taslakta Verildi yok" + T3 "açıklama notu var".
 *   3. Öğrencinin veriliş satırı gizlendi → T4 iki ölçüm.
 *   4. Uzatma cümlesinden İLK tarih çıkarıldı → T2 ve T4 "iki tarihli".
 *   5. Tarih kartı `tarihler` yokken de çizildi → T6 "kart hiç
 *      çizilmiyor" (0085 çalışmamış sunucu).
 *
 * ÇALIŞTIRMA: depo kökünden `npx http-server -c-1 -p 8788 .` açıkken,
 *   node app/scripts/odev-tarihleri-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => {
  hata++;
  console.log(`  ✗ ${m}`);
};
const olc = (ad, kosul, ayrinti = '') =>
  kosul ? tamam(ad) : bozuk(`${ad}${ayrinti ? ` — ${ayrinti}` : ''}`);

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const gun = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};
const an = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
};

/** Sunucunun `_odev_tarihleri` nesnesi. */
const tarihler = (verilisGun, sonTarih, ilk = null, yon = null, degisiklik = 0) => ({
  verilis: verilisGun === null ? null : an(verilisGun),
  son_tarih: sonTarih,
  ilk_son_tarih: ilk,
  degisiklik,
  yon,
});

const odevSatiri = (id, baslik, yayinda, sonTarih, t) => ({
  id,
  baslik,
  aciklama: null,
  tur: 'test',
  sinif_id: 's1',
  sinif: '9A',
  sinif_ozel: false,
  son_tarih: sonTarih,
  ...(t === undefined ? {} : { tarihler: t }),
  soru_sayisi: 10,
  gec_teslim: true,
  sik_sayisi: 5,
  yayinda,
  olusturma: an(-30),
  kardesler: null,
  odev_pdf_var: false,
  anahtar_pdf_var: false,
  gonderim_sayisi: 0,
  gec_gonderim_sayisi: 0,
  sinif_mevcudu: 4,
  ortalama_yapan: null,
  ortalama_tum: null,
});

const detay = (t, yayinda = true) => ({
  id: 'o1',
  baslik: 'Üslü Sayılar',
  aciklama: null,
  tur: 'acik',
  sinif_id: 's1',
  sinif: '9A',
  son_tarih: gun(6),
  ...(t === undefined ? {} : { tarihler: t }),
  soru_sayisi: null,
  gec_teslim: true,
  konular: {},
  sik_sayisi: 5,
  sayfa_limiti: 2,
  tum_sayfalar: true,
  cevap_anahtari: {},
  anahtar_yolu: null,
  odev_yolu: null,
  yayinda,
  kardesler: null,
  kardes_detay: null,
  verilebilir_siniflar: null,
  gonderim_sayisi: 0,
  gec_gonderim_sayisi: 0,
});

const SINIFLAR = [
  { id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 4 },
];

const OTURUMLAR = {
  ogretmen: { rol: 'ogretmen', token: 't'.repeat(64) },
  ogrenci: {
    rol: 'ogrenci',
    token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Deniz Yıldız', tur: 'okul', sinif: '9A' },
  },
  veli: {
    rol: 'veli',
    token: 't'.repeat(64),
    ogrenci: { id: 'o1', ad: 'Deniz Yıldız', tur: 'okul', sinif: '9A' },
  },
};

/**
 * `uclar`: uç adı → yanıt. Hangi ekranın hangi veriyi gördüğü her grupta
 * ayrı kurulabilsin diye kalıp kopyalanmıyor.
 */
async function kur(rol, yol, uclar, en = 390) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  await s.addInitScript(
    ({ oturum, uclar }) => {
      localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
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
        return json(m[1] in uclar ? uclar[m[1]] : {});
      };
    },
    { oturum: OTURUMLAR[rol], uclar },
  );
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(KOK + '#' + yol, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);

/**
 * Eksik düğümde ÇÖKMEYEN okuma.
 *
 * Doğrudan `locator.innerText()` çağırmak, düğüm yokken fırlatıyor ve
 * script'i düşürüyor: kusur provası o zaman tek bir ✗ bile yazmadan
 * biterdi — yani prova "ısırmadı" sanılırdı. (0081 C2 ve 0084 E4'te tam
 * bu oldu; ders burada koşum takımına yazıldı.)
 */
const oku = async (p, secici) => {
  const l = p.locator(secici);
  return (await l.count()) === 0 ? '' : l.first().innerText();
};
const tasma = (p) =>
  p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

// ===========================================================================
console.log('--- T1. Öğretmen listesi: iki tarih ve uzatma işareti ---');
// ===========================================================================
{
  const LISTE = [
    odevSatiri('d1', 'Düz ödev', true, gun(5), tarihler(-10, gun(5))),
    odevSatiri('d2', 'Uzatılan ödev', true, gun(7), tarihler(-10, gun(7), gun(3), 'uzatildi', 1)),
    odevSatiri('d3', 'Öne alınan ödev', true, gun(2), tarihler(-10, gun(2), gun(9), 'one_alindi', 1)),
    odevSatiri('d4', 'Taslak ödev', false, gun(5), tarihler(null, gun(5))),
  ];
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler', {
    odevler_listesi: LISTE,
    siniflar_listesi: SINIFLAR,
  });
  const satirlar = await p.locator('[data-test="odev-tarihleri"]').allInnerTexts();
  olc('her kartta tarih satırı var', satirlar.length === 4, `${satirlar.length} satır`);
  const duz = satirlar[0] ?? '';
  olc('"Verildi" yazıyor', /Verildi: \d+ \S+ \d{4}/.test(duz), duz);
  olc('"Son teslim" yazıyor', /Son teslim: \d+ \S+ \d{4}/.test(duz), duz);
  olc('düz ödevde uzatma işareti yok', !/uzatıldı|öne alındı/.test(duz), duz);
  olc('uzatılan kartta "uzatıldı"', (satirlar[1] ?? '').includes('uzatıldı'), satirlar[1]);
  olc('öne alınan kartta "öne alındı"', (satirlar[2] ?? '').includes('öne alındı'), satirlar[2]);
  // TASLAKTA VERİLİŞ TARİHİ UYDURULMUYOR: ödev henüz kimseye verilmedi.
  const taslak = satirlar[3] ?? '';
  olc('taslakta "Verildi" yok', !taslak.includes('Verildi'), taslak);
  olc('taslakta son teslim yine yazıyor', taslak.includes('Son teslim'), taslak);
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- T2. Ödev sayfası: tarih kartı ve uzatma cümlesi ---');
// ===========================================================================
{
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler/o1', {
    odev_detay: detay(tarihler(-12, gun(6), gun(2), 'uzatildi', 1)),
    siniflar_listesi: SINIFLAR,
    konu_onerileri: [],
  });
  olc('tarih kartı çizildi', (await p.locator('[data-test="odev-tarih-karti"]').count()) === 1);
  const k = await oku(p, '[data-test="odev-tarih-karti"]');
  olc('kartta "Verildi" var', /Verildi: \d+ \S+ \d{4}/.test(k), k);
  olc('kartta "Son teslim" var', /Son teslim: \d+ \S+ \d{4}/.test(k), k);
  olc('uzatma cümlesi var', (await p.locator('[data-test="odev-uzatma"]').count()) === 1);
  const u = await oku(p, '[data-test="odev-uzatma"]');
  olc(
    'uzatma cümlesi İKİ tarihi de taşıyor',
    /uzatıldı: \d+ \S+ \d{4} → \d+ \S+ \d{4}/.test(u),
    u,
  );
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- T3. Ödev sayfası (taslak): veriliş yerine not ---');
// ===========================================================================
{
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler/o1', {
    odev_detay: detay(tarihler(null, gun(6)), false),
    siniflar_listesi: SINIFLAR,
    konu_onerileri: [],
  });
  const k = await oku(p, '[data-test="odev-tarih-karti"]');
  olc('taslakta "Verildi" yok', !k.includes('Verildi'), k);
  olc('taslakta açıklama notu var', k.includes('henüz yayınlanmadı'), k);
  olc('taslakta uzatma cümlesi yok', (await p.locator('[data-test="odev-uzatma"]').count()) === 0);
  await b.close();
}

// ===========================================================================
console.log('--- T4. Öğrenci: veriliş ve uzatma kartta ---');
// ===========================================================================
{
  const ODEVLER = {
    ogrenci: { id: 'o1', ad: 'Deniz Yıldız', sinif: '9A', tur: 'okul' },
    odevler: [
      {
        id: 'a1',
        baslik: 'Üslü ve köklü',
        aciklama: null,
        tur: 'test',
        son_tarih: gun(6),
        tarihler: tarihler(-12, gun(6), gun(2), 'uzatildi', 1),
        soru_sayisi: 10,
        gec_teslim: true,
        sik_sayisi: 5,
        sinif_arsiv: false,
        odev_yolu: null,
        gonderim: null,
        konu_analizi: [],
        cevap_anahtari: null,
        anahtar_yolu: null,
      },
    ],
    dersler: [],
    okunmamis_mesaj: 0,
  };
  const { b, p } = await kur('ogrenci', '/ogrenci/odevler', { ogrenci_odevleri: ODEVLER });
  olc('öğrenci veriliş satırını görüyor', (await p.locator('[data-test="ogrenci-verilis"]').count()) === 1);
  const ov = await oku(p, '[data-test="ogrenci-verilis"]');
  olc('satır "Verildi: <gün>" biçiminde', /Verildi: \d+ \S+ \d{4}/.test(ov), ov);
  olc('öğrenci uzatmayı görüyor', (await p.locator('[data-test="ogrenci-uzatma"]').count()) === 1);
  const ou = await oku(p, '[data-test="ogrenci-uzatma"]');
  olc('uzatma cümlesi iki tarihli', /uzatıldı: \d+ \S+ \d{4} → \d+ \S+ \d{4}/.test(ou), ou);
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- T5. Veli: aynı iki satır ---');
// ===========================================================================
{
  const PANEL = {
    ogrenci: { ad: 'Deniz Yıldız', sinif: '9A', tur: 'okul' },
    genel_ortalama: 74.5,
    odevler: [
      {
        baslik: 'Üslü ve köklü',
        son_tarih: gun(6),
        olusturma: an(-30),
        tarihler: tarihler(-12, gun(6), gun(2), 'uzatildi', 1),
        gonderildi: false,
        gonderim_zamani: null,
        puan: null,
        durum: null,
        konu_analizi: [],
        kiyas: null,
        yanlis_sorular: [],
        bos_sorular: [],
        odev_yolu: null,
        cozum_yollari: [],
      },
    ],
    mesajlar: [],
    ogretmenler: [],
    okunmamis_mesaj: 0,
    odemeler: [],
    son_gorulme: null,
  };
  const { b, p } = await kur('veli', '/veli/odevler', { veli_paneli: PANEL });
  olc('veli veriliş satırını görüyor', (await p.locator('[data-test="veli-verilis"]').count()) === 1);
  olc('veli uzatmayı görüyor', (await p.locator('[data-test="veli-uzatma"]').count()) === 1);
  const m = await metin(p);
  olc('ekranda "Verildi" okunuyor', m.includes('Verildi'), m.slice(0, 200));
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- T6. 0085 çalışmamış sunucu: ekran bozulmuyor ---');
// ===========================================================================
{
  // `tarihler` alanı HİÇ YOK — panelde SQL henüz çalışmadıysa durum bu.
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler', {
    odevler_listesi: [odevSatiri('d1', 'Eski ödev', true, gun(5), undefined)],
    siniflar_listesi: SINIFLAR,
  });
  const s = await oku(p, '[data-test="odev-tarihleri"]');
  olc('yalnız son teslim yazıyor', /^Son teslim: \d+ \S+ \d{4}/.test(s), s);
  olc('"Verildi" çıkmıyor', !s.includes('Verildi'), s);
  olc('ödev başlığı yerinde (ekran çizildi)', (await metin(p)).includes('Eski ödev'));
  await b.close();

  const d = await kur('ogretmen', '/ogretmen/odevler/o1', {
    odev_detay: detay(undefined),
    siniflar_listesi: SINIFLAR,
    konu_onerileri: [],
  });
  olc(
    'ödev sayfasında tarih kartı hiç çizilmiyor',
    (await d.p.locator('[data-test="odev-tarih-karti"]').count()) === 0,
  );
  // Başlık bir `input` DEĞERİ olduğu için `innerText`'te yok; ekranın
  // çizildiğini sayfanın kendi başlığı ve form alanı söylüyor.
  const dm = await metin(d.p);
  olc('form yine çizildi', dm.includes('Ödevi düzenle') && dm.includes('Son tarih'), dm.slice(0, 160));
  await d.b.close();
}

console.log('');
if (hata) {
  console.log(`ÖDEV TARİHLERİ DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('ÖDEV TARİHLERİ DENETİMİ GEÇTİ');
