/**
 * 0091 — VELİ ÇİZELGESİ (Chromium, taklit RPC)
 *
 * Öğretmenin isteği: "Veli toplantısı var... 1 A4'e 2 öğrenci olsun.
 * Öğrenciyle ilgili sistemdeki tüm veriler yazmalı. Hangi ödev ne zaman
 * verilmiş... O ödevde sınıfının ortalaması kaçmış, o düzeydeki tüm
 * sınıfların ortalaması kaçmış. En çok eksik olduğu konular yazsın."
 *
 * A. ÇİZELGENİN İÇERİĞİ
 *    A1. Üç düğme var; çizelge düğmesi veri gelmeden kapalı.
 *    A2. Ödev tablosu: veriliş, son teslim, başlık, durum, puan,
 *        sınıf ort., düzey ort. — düzey başlığı sunucudan ("7. sınıflar").
 *    A3. Göndermediği ödev "0 puan" DEĞİL, "—"; süresi dolmamış ödev
 *        "Gönderilmedi" DEĞİL; sınıfa sonradan katılan suçlanmıyor.
 *    A4. Eksik konular ve gecikmeli işareti yazıyor.
 *    A5. KURAL 6: işaretlenen şık hiçbir yerde yok; yalnız soru numarası.
 *
 * B. GİZLİLİK — KÂĞIT VELİYE GİDİYOR
 *    B1. Bir öğrencinin yarımında BAŞKA öğrencinin adı GEÇMİYOR.
 *    B2. Çizelge basılırken sınıf listesi ve veli fişi kâğıttan düşüyor
 *        (üçü aynı kâğıda çıkarsa veli öbür çocukların puanını görür).
 *
 * C. KÂĞIT — GERÇEKTEN ÖLÇÜLÜYOR
 *    C1. `emulateMedia({ media: 'print' })` ile A4'te SAYFA BAŞINA İKİ
 *        çizelge; ızgara yazılabilir alana sığıyor.
 *    C2. Hiçbir çizelgenin metni kutusundan taşmıyor.
 *    C3. Taşan ödev listesi "— 2/2" başlığıyla ikinci yarıma geçiyor,
 *        SESSİZCE KIRPILMIYOR.
 *
 * D. 0091 ÇALIŞMAMIŞ SUNUCU (Part VIII)
 *    D1. `tarihler` ve `kiyas` gelmezse o sütunlar HİÇ ÇİZİLMİYOR ve
 *        ekran bozulmuyor — boş bir sütun başlığı veliye olmayan bir
 *        bilgiyi vaat ederdi.
 *
 * -----------------------------------------------------------------------------
 * KUSUR PROVALARI (ölçüldü)
 *
 *   Ua  Yarımlar yerine sınıfın tamamı tek kutuda basılıyor
 *         → B1 ısırdı: "1 sızıntı" (iki öğrencinin adı aynı yarımda)
 *   Ub  `parcalaraBol` yalnız ilk yarımı döndürüyor (taşma kırpılıyor)
 *         → C3 ısırdı: "15 ödevin hepsi kâğıtta (8)"
 *   Uc  Alan gelmezse boş sütun çiziliyor (Part VIII ihlali)
 *         → D1 ısırdı
 *   Ud  Yarımın alt sınırı A4'ün yarısını aşıyor
 *         → C1 ısırdı: 323 mm / 277 mm
 *
 * -----------------------------------------------------------------------------
 * BU DENETİM BİR SABİTİ DÜZELTTİ
 *
 * `YARIMA_SIGAN_SATIR` ilk yazımda 12'ydi ve yorumunda "ölçüldü"
 * yazıyordu — tahmindi. C1 ölçümü ilk koşuda 8 ödevle yapılmıştı, yani
 * sabitin dayandığı sayı HİÇ ölçülmemişti. En kötü hâl (12 satır)
 * ölçülünce iki çizelge 323,1 mm tuttu: A4'ü 46 mm aşıyor. İki ölçümden
 * türetilen gerçek rakam 8,4 satır; sabit 8 oldu.
 *
 * DERS: "ölçüldü" diye yazılmış bir yorum, ölçümün kendisi değildir.
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/veli-cizelgesi-denetimi.mjs
 */
let hata = 0;
const tamam = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };
const de = (kosul, m) => (kosul ? tamam(m) : bozuk(m));

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';

const SAHIP = { id: 's', ad: 'Buket Topuzoğlu', sahip: true, vekalet: false, vekil: null };
const OTURUM = { rol: 'ogretmen', token: 't'.repeat(64) };

const BIR = 'Birinci Öğrenci';
const IKI = 'İkinci Öğrenci';

/** `sinif_ogrenci_ozeti` — mevcut fişin ve listenin kaynağı (0053). */
const OZET = {
  sinif: { id: 'c1', ad: '7C', ozel: false },
  ogrenciler: [
    {
      id: 'o1', ad: BIR, ogrenci_no: '701', tur: 'okul',
      ortalama: 62.5, yapilan_ortalama: 75, puan_bekleyen: 0,
      calisma_sayisi: 0, calisma_yapilan: 0,
      odev_sayisi: 2, yapilan: 1, yapilmayan: 1,
      eksik_konular: ['Üslü sayılar', 'Köklü sayılar'],
    },
    {
      id: 'o2', ad: IKI, ogrenci_no: '702', tur: 'okul',
      ortalama: 100, yapilan_ortalama: 100, puan_bekleyen: 0,
      calisma_sayisi: 0, calisma_yapilan: 0,
      odev_sayisi: 2, yapilan: 2, yapilmayan: 0,
      eksik_konular: [],
    },
  ],
};

const KIYAS = {
  durum: 'hazir',
  sinif: { ad: '7C', ortalama: 75 },
  seviye: { ad: '7. sınıflar', ortalama: 50 },
};

/**
 * `sinif_not_cizelgesi` — 0091'in ucu.
 *
 * `odevSayisi` ile uzatılabiliyor: C3 (taşma) gerçekten çok ödev
 * istiyor, A grubu ise okunur bir tablo.
 */
function cizelge({ odevSayisi = 3, yeniAlanlar = true } = {}) {
  const odevler = Array.from({ length: odevSayisi }, (_, i) => {
    const o = {
      id: `d${i + 1}`,
      baslik: `Tema ${i + 1}`,
      tur: 'test',
      ogretmen: 'Buket Topuzoğlu',
      soru_sayisi: 4,
      odev_yolu: null,
      anahtar_yolu: null,
      cevap_anahtari: null,
      son_tarih: '2026-11-19',
      sure_doldu: true,
      beklenen: 2,
      gonderim: 2,
      ortalama: 75,
    };
    if (yeniAlanlar) {
      o.tarihler = {
        verilis: '2026-11-12T07:00:00+03:00',
        son_tarih: '2026-11-19',
        ilk_son_tarih: null,
        degisiklik: 0,
        yon: null,
      };
      o.kiyas = KIYAS;
    }
    return o;
  });

  // Son üç ödeve özel durumlar: süresi devam eden, kapsam dışı, gecikmeli.
  if (odevSayisi >= 3) {
    odevler[1].son_tarih = '2099-01-01';
    odevler[1].sure_doldu = false;
    if (yeniAlanlar) odevler[1].kiyas = { durum: 'sure_dolmadi' };
  }

  const hucre = (id, i) => {
    if (i === 1) return { odev_id: id, durum: 'suresi_devam', puan: null };
    if (i === 2) return { odev_id: id, durum: 'kapsam_disi', puan: null };
    return {
      odev_id: id, durum: 'gonderdi', puan: 75,
      ...(yeniAlanlar
        ? { gecikmeli: true, dogru: 3, yanlis: 1, bos: 0, yanlis_sorular: [3], bos_sorular: [] }
        : {}),
    };
  };

  return {
    sinif: { id: 'c1', ad: '7C', ozel: false, arsiv: false, ogretmenler: ['Buket Topuzoğlu'] },
    kapsam: 'ogretmen',
    degerlendirilen_odev: odevSayisi,
    mevcut: 2,
    odevler,
    ogrenciler: [
      {
        id: 'o1', ad: BIR, ogrenci_no: '701', tur: 'okul',
        ortalama: 62.5, yapti: 1, yapmadi: 1, ortalama_yapan: 75, ortalama_tum: 62.5,
        yapilan: 1, yapilmayan: 1, calisma_sayisi: 0, calisma_yapilan: 0,
        puanlar: odevler.map((d, i) => hucre(d.id, i)),
        ...(yeniAlanlar ? { eksik_konular: ['Üslü sayılar'] } : {}),
      },
      {
        id: 'o2', ad: IKI, ogrenci_no: '702', tur: 'okul',
        ortalama: 100, yapti: 2, yapmadi: 0, ortalama_yapan: 100, ortalama_tum: 100,
        yapilan: 2, yapilmayan: 0, calisma_sayisi: 0, calisma_yapilan: 0,
        puanlar: odevler.map((d) => ({ odev_id: d.id, durum: 'gonderdi', puan: 100 })),
        ...(yeniAlanlar ? { eksik_konular: [] } : {}),
      },
    ],
    aylar: [{ ay: '2026-11', odev_sayisi: odevSayisi, ortalama: 80, gonderim_orani: 90 }],
  };
}

async function kur(uclar, en = 1280) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: en, height: 1000 } });
  await s.addInitScript(({ oturum, uclar }) => {
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    const asil = window.fetch;
    const json = (o) => new Response(JSON.stringify(o), {
      status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      /**
       * KABUĞUN KENDİ UÇLARI. Taklit edilmeyen uçta `{}` dönmek ekranı
       * ÇÖKERTİYOR: dizi bekleyen yerlere nesne düşüyor
       * (`Cannot read properties of undefined (reading 'length')`).
       * Bu liste ilk koşuda ölçülerek çıkarıldı — tahminle değil.
       */
      const KABUK = {
        anket_durumu: { acik: false },
        bildirim_sayilari: {},
        siniflar_listesi: [{ id: 'c1', ad: '7C', seviye: 7, sube: 'C',
                             ozel: false, arsiv: false, ogrenci_sayisi: 2 }],
        ogrenciler_listesi: { toplam: 0, sayfa: 1, boyut: 25, kayitlar: [] },
        ogretmen_panosu: { siniflar: [], son_odevler: [], bekleyen_degerlendirme: [],
                           okunmamis_mesaj: 0, duyurular: [] },
        okul_geneli: null,
        ogrenci_duyurulari: [],
        ewalu_mesajlari: [],
      };
      if (m[1] in uclar) return json(uclar[m[1]]);
      return json(m[1] in KABUK ? KABUK[m[1]] : {});
    };
    // Yazdırma penceresi açılmasın: düğmeye basıldığını ÖLÇÜYORUZ,
    // tarayıcının kendi penceresini değil.
    window.__basildi = 0;
    window.print = () => { window.__basildi++; };
  }, { oturum: OTURUM, uclar });
  const p = await s.newPage();
  p.on('pageerror', (e) => bozuk(`sayfa hatası: ${e.message}`));
  await p.goto(`${KOK}#/ogretmen/ogrenciler/yazdir/c1`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);

// ===========================================================================
console.log('--- A. Çizelgenin içeriği ---');
// ===========================================================================
{
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge(),
  });

  const d = await p.getByRole('button', { name: 'Veli çizelgelerini yazdır' }).count();
  de(d === 1, 'A1: çizelge düğmesi var');

  const g = await metin(p);
  for (const [ad, s] of [
    ['Verildi', 'Verildi'], ['Son teslim', 'Son teslim'], ['Ödev', 'Ödev'],
    ['Durum', 'Durum'], ['Puanı', 'Puanı'], ['Sınıf ort.', 'Sınıf ort.'],
    ['düzey başlığı', '7. sınıflar'],
  ]) {
    de(g.includes(s), `A2: ${ad} sütunu var`);
  }
  de(g.includes('12 Kas'), 'A2: veriliş tarihi yazılı');
  de(/75/.test(g) && /50/.test(g), 'A2: sınıf 75 ve düzey 50 ortalamaları yazılı');

  de(g.includes('Süresi sürüyor'), 'A3: süresi dolmamış ödev "Gönderilmedi" demiyor');
  de(g.includes('Sınıfa sonra katıldı'), 'A3: sonradan katılan suçlanmıyor');
  de(g.includes('—'), 'A3: puansız hücre "—" (0 yazılmıyor)');

  de(g.includes('Üslü sayılar'), 'A4: eksik konular yazılı');
  de(g.includes('gecikmeli'), 'A4: gecikmeli işareti yazılı');
  de(g.includes('yanlış: 3'), 'A5: yanlış soru NUMARASI yazılı');

  // KURAL 6: şık hiçbir yerde olmamalı. Taklit sunucu zaten göndermiyor;
  // bu ölçüm ekranın da uydurmadığını gösteriyor.
  const sik = await p.evaluate(() => {
    const t = document.body.innerText;
    return /\b(şıkk?ı|işaretlediği|cevap anahtarı)\b/i.test(t);
  });
  de(!sik, 'A5: şık / cevap anahtarı çizelgede yok (Kural 6)');
  await b.close();
}

// ===========================================================================
console.log('--- B. Gizlilik: kâğıt veliye gidiyor ---');
// ===========================================================================
{
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge(),
  });

  // B1 — bir yarımda yalnız KENDİ öğrencisinin adı.
  const sizinti = await p.evaluate(({ bir, iki }) => {
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')];
    return yarimlar.map((y) => {
      const t = y.innerText;
      return { bir: t.includes(bir), iki: t.includes(iki) };
    }).filter((x) => x.bir && x.iki).length;
  }, { bir: BIR, iki: IKI });
  de(sizinti === 0, `B1: hiçbir yarımda iki öğrencinin adı birlikte yok (${sizinti} sızıntı)`);

  // B2 — çizelge basılırken öbür iki bölüm kâğıttan düşüyor.
  await p.getByRole('button', { name: 'Veli çizelgelerini yazdır' }).click();
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(200);
  const kagittaki = await p.evaluate(() => {
    const gorunur = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      liste: gorunur(document.querySelector('.sk-yazdirma-tablo')),
      fis: gorunur(document.querySelector('.sk-veli-fis')),
      cizelge: gorunur(document.querySelector('.sk-veli-cizelge')),
    };
  });
  de(!kagittaki.liste, 'B2: sınıf listesi kâğıttan düştü');
  de(!kagittaki.fis, 'B2: veli fişi kâğıttan düştü');
  de(kagittaki.cizelge, 'B2: çizelge kâğıtta');
  const bas = await p.evaluate(() => window.__basildi);
  de(bas === 1, `B2: yazdırma bir kez çağrıldı (${bas})`);
  await p.emulateMedia({ media: 'screen' });
  await b.close();
}

// ===========================================================================
console.log('--- C. Kâğıt: A4 ölçülüyor ---');
// ===========================================================================
{
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ odevSayisi: 8 }),
  });
  await p.getByRole('button', { name: 'Veli çizelgelerini yazdır' }).click();
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(300);

  /**
   * SAYFA SAYMAK YETMEZ. DOM'da iki çizelge olması, ikisinin AYNI KÂĞIDA
   * sığdığını söylemez: `min-height` ikisini 128+128+3 = 259 mm'ye
   * oturtuyor ve A4'ün yazılabilir boyu 277 mm. Ölçülen şey bu.
   */
  const KAGIT = { yukseklikMm: 297, kenarMm: 10 };
  const KULLANILABILIR = KAGIT.yukseklikMm - 2 * KAGIT.kenarMm;

  const olcu = await p.evaluate(() => {
    const PX_MM = 96 / 25.4;
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')];
    const ikisi = yarimlar.slice(0, 2);
    const boy = ikisi.reduce((a, y) => a + y.getBoundingClientRect().height, 0);
    // Aradaki boşluk: ızgaranın `gap`i.
    const izgara = document.querySelector('.sk-cizelge-izgara');
    const bosluk = parseFloat(getComputedStyle(izgara).rowGap || '0');
    return {
      adet: yarimlar.length,
      ikisiMm: +((boy + bosluk) / PX_MM).toFixed(1),
      // 1 px pay: alt piksel yuvarlamaları taşma sayılmasın.
      tasan: yarimlar.filter((y) => y.scrollHeight > y.clientHeight + 1).length,
      tekSutun: getComputedStyle(izgara).gridTemplateColumns.split(' ').length === 1,
    };
  });

  de(olcu.tekSutun, 'C1: kâğıtta tek sütun — iki öğrenci alt alta');
  de(
    olcu.ikisiMm <= KULLANILABILIR,
    `C1: iki çizelge A4'e sığıyor — ${olcu.ikisiMm} mm / ${KULLANILABILIR} mm (pay ${(KULLANILABILIR - olcu.ikisiMm).toFixed(1)} mm)`,
  );
  de(olcu.tasan === 0, `C2: hiçbir çizelgenin metni kutusundan taşmıyor (${olcu.tasan} taşan)`);
  await p.emulateMedia({ media: 'screen' });
  await b.close();
}

// ===========================================================================
console.log('--- C3. Taşan liste ikinci yarıma geçiyor ---');
// ===========================================================================
{
  // 15 ödev: `YARIMA_SIGAN_SATIR` 12, yani ilk öğrenci iki yarıma taşmalı.
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ odevSayisi: 15 }),
  });
  const g = await metin(p);
  de(g.includes(`${BIR} — 1/2`) && g.includes(`${BIR} — 2/2`),
    'C3: taşan çizelge "— 1/2" ve "— 2/2" olarak ikiye bölündü');

  // HİÇBİR ÖDEV KAYBOLMAMALI: sessizce kırpmak bir ödevi yok saymaktır.
  const sayim = await p.evaluate((ad) => {
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')]
      .filter((y) => y.innerText.includes(ad));
    return yarimlar.reduce((a, y) => a + y.querySelectorAll('tbody tr').length, 0);
  }, BIR);
  de(sayim === 15, `C3: 15 ödevin hepsi kâğıtta (${sayim})`);
  await b.close();
}

// ===========================================================================
console.log('--- D. 0091 çalışmamış sunucu (Part VIII) ---');
// ===========================================================================
{
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ yeniAlanlar: false }),
  });
  const g = await metin(p);
  de(!g.includes('Verildi'), 'D1: veriliş sütunu çizilmedi');
  de(!g.includes('Sınıf ort.'), 'D1: sınıf ortalaması sütunu çizilmedi');
  de(!g.includes('7. sınıflar'), 'D1: düzey sütunu çizilmedi');
  // Ekran yine de çalışıyor: başlık, ad ve puan yerinde.
  de(g.includes(BIR) && g.includes('Ödev çizelgesi'),
    'D1: çizelge yine çiziliyor, ekran bozulmadı');
  de(g.includes('Gönderildi'), 'D1: durum sütunu çalışıyor');
  await b.close();
}

console.log('');
if (hata) { console.log(`VELİ ÇİZELGESİ DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('VELİ ÇİZELGESİ DENETİMİ GEÇTİ');
