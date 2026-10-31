/**
 * 0086 — ÇALIŞMA KAĞIDI: PUANSIZ ÜÇÜNCÜ ÖDEV TÜRÜ (Chromium, taklit RPC)
 *
 * Öğretmenin isteği: "Çalışma kağıdı şeklinde de ödev verilebilsin. Puan
 * hesaplaması yapılmadan ödevi gönderip göndermediği şeklinde
 * tamamlansın... Ama bu ayrı bir kategoride olsun."
 *
 *  C1. OLUŞTURMA: üçüncü seçenek var; seçilince "puanlanmaz" yazıyor ve
 *      soru sayısı / cevap anahtarı alanları HİÇ ÇİZİLMİYOR.
 *  C2. LİSTE: kartta "Çalışma kağıdı" yazıyor; "Çalışma kağıtları"
 *      süzgeci yalnız o türü bırakıyor.
 *  C3. GÖNDERİMLER: puan etiketi yerine "Gönderdi"; puan düzeltme
 *      düğmesi çizilmiyor.
 *  C4. ÖĞRENCİ: optik ızgara yok, "puanlanmıyor" notu var.
 *  C5. VELİ: tür satırı ve "puanlanmaz" yazıyor; puan yok.
 *  C6. AYRI SATIR: sınıf sayfasında ve karnede "Çalışma kağıdı: n/m
 *      gönderdi"; hiç çalışma kağıdı yoksa satır ÇIKMIYOR.
 *  C7. 0086 ÇALIŞMAMIŞ SUNUCU: yeni alanlar hiç gelmiyor → ekran
 *      bozulmuyor, satırlar çıkmıyor.
 *
 * ---------------------------------------------------------------------------
 * KUSUR PROVALARI — yedisi de ısırdı (her provada paket YENİDEN DERLENDİ)
 *
 *   1. Tür adı "Açık uçlu" yapıldı → C2 ve C3 ısırdı.
 *   2. Liste süzgeci türü süzmez yapıldı (içe alma satırıyla birlikte —
 *      yoksa kusur tip denetimine çarpıyor) → C2.
 *   3. Gönderimlerde puan etiketi hep çizilir yapıldı → C3 iki ölçüm.
 *   4. Öğrencideki "puanlanmıyor" notu gizlendi → C4.
 *   5. `calismaSatiri` 0/0'da da satır üretir yapıldı → C6.
 *      ÖĞRETİCİ: bu prova İLK HÂLİNDE ISIRMADI. Sebebi ölçümün kendi
 *      kusuruydu: "çalışma kağıdı yok" durumu alanları HİÇ
 *      GÖNDERMEYEREK taklit ediliyordu, oysa 0086 yayındayken sunucu
 *      o alanları her zaman gönderiyor — sıfır olarak. Fikstür gerçek
 *      şekle çevrildi, prova ondan sonra ısırdı.
 *   6. Velide tür satırı gizlendi → C5 iki ölçüm.
 *   7. Oluşturmadaki "puanlanmaz" açıklaması gizlendi → C1 iki ölçüm.
 *
 * ÖLÇÜMÜN YAZILIRKEN BULDUĞU ÜÇ ŞEY:
 *   • Öğretmenin sınıf sayfası `sinif_not_cizelgesi`'nden besleniyor,
 *     `sinif_ogrencileri`'nden değil — süzgeç oraya da kondu.
 *   • Öğrencinin teslim ekranının rotası `/ogrenci/odev/:id`.
 *   • Sayfalar yan uçları da çağırıyor (`konu_karnesi`,
 *     `odev_sayfa_kurali`); eksik fikstür ekranı çökertiyordu.
 *
 * ÇALIŞTIRMA: depo kökünden `npx http-server -c-1 -p 8788 .` açıkken,
 *   node app/scripts/calisma-kagidi-denetimi.mjs
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

/**
 * Eksik düğümde ÇÖKMEYEN okuma — 0085'te koşum takımına konan desen.
 * Doğrudan `innerText()` çağırmak düğüm yokken fırlatıyor ve kusur
 * provası tek bir ✗ bile yazmadan bitiyor.
 */
const oku = async (p, secici) => {
  const l = p.locator(secici);
  return (await l.count()) === 0 ? '' : l.first().innerText();
};
const metin = (p) => p.evaluate(() => document.body.innerText);
const tasma = (p) =>
  p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

const SINIFLAR = [
  { id: 's1', ad: '9A', seviye: 9, sube: 'A', ozel: false, arsiv: false, ogrenci_sayisi: 3 },
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

const tarihler = (sonTarih) => ({
  verilis: an(-10),
  son_tarih: sonTarih,
  ilk_son_tarih: null,
  degisiklik: 0,
  yon: null,
});

const odevSatiri = (id, baslik, tur, sonTarih) => ({
  id,
  baslik,
  aciklama: null,
  tur,
  sinif_id: 's1',
  sinif: '9A',
  sinif_ozel: false,
  son_tarih: sonTarih,
  tarihler: tarihler(sonTarih),
  soru_sayisi: tur === 'test' ? 10 : null,
  gec_teslim: true,
  sik_sayisi: 5,
  yayinda: true,
  olusturma: an(-30),
  kardesler: null,
  odev_pdf_var: false,
  anahtar_pdf_var: false,
  gonderim_sayisi: 2,
  gec_gonderim_sayisi: 0,
  sinif_mevcudu: 3,
  ortalama_yapan: tur === 'calisma' ? null : 72.5,
  ortalama_tum: tur === 'calisma' ? null : 60,
});

async function kur(rol, yol, uclar, en = 390) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 900 } });
  await s.addInitScript(
    ({ oturum, uclar }) => {
      localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
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
          /* yok */
        }
        window.__cagrilar.push({ ad: m[1], govde });
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

// ===========================================================================
console.log('--- C1. Oluşturma ekranı ---');
// ===========================================================================
{
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler/yeni', {
    siniflar_listesi: SINIFLAR,
    konu_onerileri: [],
  });
  const secim = p.locator('select').filter({ hasText: 'Test (çoktan seçmeli)' }).first();
  olc('tür seçimi çizildi', (await secim.count()) === 1);
  const secenekler = await secim.locator('option').allInnerTexts();
  olc(
    'üçüncü seçenek var',
    secenekler.some((x) => x.includes('Çalışma kağıdı')),
    secenekler.join(' | '),
  );

  // TESTTEYKEN soru sayısı var — karşıt ölçüm olmadan "alan yok"
  // iddiası, alanın hiç çizilmediği bir ekranda da yeşil yanardı.
  olc('testte soru sayısı alanı var', (await metin(p)).includes('Soru sayısı'));

  await secim.selectOption('calisma');
  await p.waitForTimeout(300);
  const m = await metin(p);
  olc('çalışma kağıdında soru sayısı alanı YOK', !m.includes('Soru sayısı'), m.slice(0, 200));
  const not = await oku(p, '[data-test="calisma-aciklamasi"]');
  olc('"puanlanmaz" açıklaması çıkıyor', /puanlanmaz/.test(not), not);
  olc('açıklama ortalamaları da söylüyor', /[Oo]rtalamalara girmez/.test(not), not);
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- C2. Öğretmenin ödev listesi ---');
// ===========================================================================
{
  const LISTE = [
    odevSatiri('d1', 'Üslü Sayılar', 'test', gun(-3)),
    odevSatiri('d2', 'Problemler', 'acik', gun(-2)),
    odevSatiri('d3', 'Alıştırma kağıdı', 'calisma', gun(-1)),
  ];
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler', {
    odevler_listesi: LISTE,
    siniflar_listesi: SINIFLAR,
  });
  let m = await metin(p);
  olc('kartta "Çalışma kağıdı" yazıyor', m.includes('Çalışma kağıdı'), m.slice(0, 300));
  olc('üç ödev de listede', m.includes('Üslü Sayılar') && m.includes('Alıştırma kağıdı'));

  await p.getByRole('button', { name: 'Çalışma kağıtları', exact: true }).click();
  await p.waitForTimeout(400);
  m = await metin(p);
  olc(
    'süzgeç yalnız çalışma kağıdını bırakıyor',
    m.includes('Alıştırma kağıdı') && !m.includes('Üslü Sayılar') && !m.includes('Problemler'),
    m.slice(0, 300),
  );
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- C3. Gönderim takibi ---');
// ===========================================================================
const gonderimler = (tur) => ({
  odev: {
    id: 'd3',
    baslik: 'Alıştırma kağıdı',
    tur,
    sinif: '9A',
    son_tarih: gun(-1),
    soru_sayisi: tur === 'test' ? 10 : null,
    gec_teslim: true,
    yayinda: true,
  },
  ozet: { mevcut: 2, gonderen: 1, gecikmeli: 0, puan_bekleyen: 0 },
  konu_ozeti: [],
  satirlar: [
    {
      ogrenci_id: 'o1',
      ogrenci: 'Deniz Yıldız',
      gonderim_id: 'g1',
      gonderdi: true,
      zaman: an(-1),
      gecikmeli: false,
      durum: tur === 'calisma' ? 'tamamlandi' : 'puanlandi',
      dogru: tur === 'calisma' ? null : 8,
      yanlis: tur === 'calisma' ? null : 2,
      bos: tur === 'calisma' ? null : 0,
      puan: tur === 'calisma' ? null : 80,
      ogretmen_puan: null,
      ogretmen_yorum: null,
      yanlis_sorular: [],
      bos_sorular: [],
      foto_var: true,
      duzeltildi: false,
      duzeltme_nedeni: null,
      ek_sure: null,
    },
    {
      ogrenci_id: 'o2',
      ogrenci: 'Efe Kaya',
      gonderim_id: null,
      gonderdi: false,
      zaman: null,
      gecikmeli: false,
      durum: null,
      dogru: null,
      yanlis: null,
      bos: null,
      puan: null,
      ogretmen_puan: null,
      ogretmen_yorum: null,
      yanlis_sorular: [],
      bos_sorular: [],
      foto_var: false,
      duzeltildi: false,
      duzeltme_nedeni: null,
      ek_sure: null,
    },
  ],
});
{
  const SAHIP = { id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null };
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler/d3/gonderimler', {
    odev_gonderimleri: gonderimler('calisma'),
    ben_kimim: SAHIP,
  });
  const m = await metin(p);
  olc('tür başlıkta yazıyor', m.includes('Çalışma kağıdı'), m.slice(0, 200));
  olc('"Gönderdi" etiketi var', m.includes('Gönderdi'), m.slice(0, 300));
  olc('"— puan" yazmıyor', !m.includes('— puan'), m.slice(0, 300));
  olc('puan düzeltme düğmesi yok', !m.includes('Puanı düzelt'), m.slice(0, 400));
  olc('"Göndermeyenler" bölümü duruyor', m.includes('Göndermeyenler'));
  await b.close();

  // KARŞIT ÖLÇÜM: aynı ekran TEST ödevinde puanı gösteriyor.
  const t = await kur('ogretmen', '/ogretmen/odevler/d3/gonderimler', {
    odev_gonderimleri: gonderimler('test'),
    ben_kimim: SAHIP,
  });
  const tm = await metin(t.p);
  olc('testte puan etiketi var', /80 puan/.test(tm), tm.slice(0, 300));
  await t.b.close();
}

// ===========================================================================
console.log('--- C4. Öğrencinin teslim ekranı ---');
// ===========================================================================
const ogrenciOdevleri = (tur) => ({
  ogrenci: { id: 'o1', ad: 'Deniz Yıldız', sinif: '9A', tur: 'okul' },
  odevler: [
    {
      id: 'd3',
      baslik: 'Alıştırma kağıdı',
      aciklama: null,
      tur,
      son_tarih: gun(5),
      tarihler: tarihler(gun(5)),
      soru_sayisi: tur === 'test' ? 10 : null,
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
});
{
  const { b, p } = await kur('ogrenci', '/ogrenci/odev/d3', {
    ogrenci_odevleri: ogrenciOdevleri('calisma'),
    odev_sayfa_siniri: 1,
    // `ozel_liste` benzeri uçlar DİZİ bekliyor; boş nesne dönünce
    // ekran "(ne ?? []) is not iterable" ile çöküyordu.
    odev_sayfa_kurali: {},
    ewalu_mesajlari: [],
    odev_kiyasi: null,
  });
  const m = await metin(p);
  olc('tür yazıyor', m.includes('Çalışma kağıdı'), m.slice(0, 200));
  const not = await oku(p, '[data-test="ogrenci-calisma-notu"]');
  olc('"puanlanmıyor" notu var', /puanlan/.test(not), not);
  // Optik ızgara: test ödevinde soru numaraları çizilir.
  olc('optik ızgara yok', !/\bA\s+B\s+C\s+D\b/.test(m), m.slice(0, 300));
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();

  // KARŞIT: test ödevinde optik var.
  const t = await kur('ogrenci', '/ogrenci/odev/d3', {
    ogrenci_odevleri: ogrenciOdevleri('test'),
    odev_sayfa_siniri: 1,
    odev_sayfa_kurali: {},
    ewalu_mesajlari: [],
    odev_kiyasi: null,
  });
  const tm = await metin(t.p);
  olc('testte optik ızgara var', /\bA\b[\s\S]{0,20}\bB\b[\s\S]{0,20}\bC\b/.test(tm), tm.slice(0, 300));
  await t.b.close();
}

// ===========================================================================
console.log('--- C5. Veli ekranı ---');
// ===========================================================================
const veliPaneli = (tur) => ({
  ogrenci: { ad: 'Deniz Yıldız', sinif: '9A', tur: 'okul' },
  genel_ortalama: 78.5,
  odevler: [
    {
      baslik: 'Alıştırma kağıdı',
      tur,
      son_tarih: gun(-1),
      olusturma: an(-30),
      tarihler: tarihler(gun(-1)),
      gonderildi: true,
      gonderim_zamani: an(-2),
      puan: null,
      durum: tur === 'calisma' ? 'tamamlandi' : 'incelemede',
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
});
{
  const { b, p } = await kur('veli', '/veli/odevler', { veli_paneli: veliPaneli('calisma') });
  const satir = await oku(p, '[data-test="veli-tur"]');
  olc('velide tür satırı var', satir.includes('Çalışma kağıdı'), satir);
  olc('"puanlanmaz" yazıyor', satir.includes('puanlanmaz'), satir);
  const m = await metin(p);
  olc('"Gönderdi" yazıyor', m.includes('Gönderdi'), m.slice(0, 250));
  olc('puan yazmıyor', !/\d+\s*puan/.test(m), m.slice(0, 250));
  olc('360 px taşma yok', !(await tasma(p)));
  await b.close();
}

// ===========================================================================
console.log('--- C6. Ayrı satır: sınıf sayfası ve karne ---');
// ===========================================================================
// ÖĞRETMENİN SINIF SAYFASI `sinif_not_cizelgesi`'nden besleniyor —
// `sinif_ogrenci_ozeti`'nden değil. Denetim ilk yazıldığında yanlış uç
// taklit edilmişti ve ekran boş çizildi; ölçüm bunu gösterdi.
const notCizelgesi = (calisma) => ({
  sinif: { id: 's1', ad: '9A', ozel: false, arsiv: false, seviye: 9, ogretmenler: ['Buket Topuzoğlu'] },
  degerlendirilen_odev: 4,
  mevcut: 1,
  kapsam: 'ogretmen',
  // `aylar` da çiziliyor; eksikse ekran "reading 'map'" ile çöküyordu.
  aylar: [],
  // ÖDEV LİSTESİ BOŞ BIRAKILAMIYOR: öğrenci satırı `puanlar` ile
  // `odevler`i SIRAYLA eşliyor (`odevler[i]`), boş dizide eşleşme
  // bulunamayınca ekran çöküyordu. Fikstür gerçeğe yaklaştırıldı.
  odevler: [
    {
      id: 'd1',
      baslik: 'Üslü Sayılar',
      tur: 'test',
      ogretmen: 'Buket Topuzoğlu',
      soru_sayisi: 10,
      odev_yolu: null,
      anahtar_yolu: null,
      cevap_anahtari: null,
      son_tarih: gun(-3),
      sure_doldu: true,
      beklenen: 1,
      gonderim: 1,
      ortalama: 80,
    },
  ],
  ogrenciler: [
    {
      id: 'o1',
      ad: 'Deniz Yıldız',
      ogrenci_no: '101',
      tur: 'okul',
      ortalama: 72.5,
      yapti: 3,
      yapmadi: 1,
      ortalama_yapan: 80,
      ortalama_tum: 60,
      yapilan: 3,
      yapilmayan: 1,
      puan_bekleyen: 0,
      puanlar: [{ odev_id: 'd1', puan: 80, durum: 'gonderdi' }],
      // 0086 YAYINDAYKEN ALANLAR HEP GELİYOR — hiç çalışma kağıdı
      // verilmemişse SIFIR olarak. Bu yüzden "yok" durumu `undefined`
      // değil, 0/0 ile taklit ediliyor; kusur provası ilk hâlinde
      // ısırmamıştı, çünkü alanı hiç göndermiyordu.
      ...(calisma ? { calisma_sayisi: 5, calisma_yapilan: 4 } : { calisma_sayisi: 0, calisma_yapilan: 0 }),
    },
  ],
});
{
  const { b, p } = await kur('ogretmen', '/ogretmen/siniflar/s1', {
    sinif_not_cizelgesi: notCizelgesi(true),
    siniflar_listesi: SINIFLAR,
    // Sayfa konu karnesini AYRI çağırıyor; boş nesne dönünce o bölüm
    // çöküyor ve bütün ekranı düşürüyordu.
    konu_karnesi: { kapsam: { tur: 'sinif', ad: '9A', sinif: '9A', mevcut: 1 },
                    odev_sayisi: 1, konular: [], gelisim: [] },
  });
  const satir = await oku(p, '[data-test="calisma-satiri"]');
  olc('sınıf sayfasında ayrı satır', satir === 'Çalışma kağıdı: 4/5 gönderdi', satir);
  await b.close();

  // HİÇ ÇALIŞMA KAĞIDI YOKSA SATIR ÇIKMIYOR.
  const y = await kur('ogretmen', '/ogretmen/siniflar/s1', {
    sinif_not_cizelgesi: notCizelgesi(false),
    siniflar_listesi: SINIFLAR,
    konu_karnesi: { kapsam: { tur: 'sinif', ad: '9A', sinif: '9A', mevcut: 1 },
                    odev_sayisi: 1, konular: [], gelisim: [] },
  });
  olc(
    'çalışma kağıdı yoksa satır yok',
    (await y.p.locator('[data-test="calisma-satiri"]').count()) === 0,
  );
  olc('öğrenci yine listede (ekran çizildi)', (await metin(y.p)).includes('Deniz Yıldız'));
  await y.b.close();
}
{
  const KARNE = {
    kapsam: { ad: 'Deniz Yıldız', sinif: '9A' },
    odev_sayisi: 4,
    genel_ortalama: 80,
    tum_ortalama: 60,
    yapilmayan: 1,
    puan_bekleyen: 0,
    calisma_sayisi: 5,
    calisma_yapilan: 4,
    konular: [],
    gelisim: [],
  };
  const { b, p } = await kur('ogrenci', '/ogrenci/konularim', {
    kendi_karnem: KARNE,
    // Ekran ikinci bir uç daha okuyor; eksikse "ad" okunamıyor ve
    // sayfa çöküyordu (ölçüm gösterdi).
    ogrenci_odevleri: ogrenciOdevleri('calisma'),
  });
  const satir = await oku(p, '[data-test="karne-calisma"]');
  olc('karnede ayrı satır', satir === 'Çalışma kağıdı: 4/5 gönderdi', satir);
  olc('"değerlendirilmiş ödev" sayısı yerinde', (await metin(p)).includes('değerlendirilmiş ödev'));
  await b.close();
}

// ===========================================================================
console.log('--- C7. 0086 çalışmamış sunucu ---');
// ===========================================================================
{
  // `tur` eski değerlerle, yeni alanlar hiç yok.
  const { b, p } = await kur('ogretmen', '/ogretmen/odevler', {
    odevler_listesi: [odevSatiri('d1', 'Üslü Sayılar', 'test', gun(-3))],
    siniflar_listesi: SINIFLAR,
  });
  const m = await metin(p);
  olc('liste çizildi', m.includes('Üslü Sayılar'));
  olc('"Çalışma kağıdı" yazmıyor', !m.includes('Çalışma kağıdı'), m.slice(0, 200));
  await b.close();

  const v = await kur('veli', '/veli/odevler', {
    veli_paneli: (() => {
      const x = veliPaneli('acik');
      delete x.odevler[0].tur;
      return x;
    })(),
  });
  olc('velide tür satırı hiç çizilmiyor', (await v.p.locator('[data-test="veli-tur"]').count()) === 0);
  olc('veli ekranı yine çizildi', (await metin(v.p)).includes('Alıştırma kağıdı'));
  await v.b.close();
}

console.log('');
if (hata) {
  console.log(`ÇALIŞMA KAĞIDI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('ÇALIŞMA KAĞIDI DENETİMİ GEÇTİ');
