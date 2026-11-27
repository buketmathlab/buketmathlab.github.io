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
 *    C1.  Kodsuz: `emulateMedia({ media: 'print' })` ile A4'te SAYFA
 *         BAŞINA İKİ çizelge; ızgara yazılabilir alana sığıyor.
 *    C1k. Kodlu: giriş bloğu yarımın üçte birini kaplıyor, o yüzden
 *         kâğıt başına BİR öğrenci. Tam sayfa ölçülüyor, her çizelgeden
 *         sonra yeni kâğıt başlıyor ve kâğıt sayısı kodsuzdan AZ.
 *    C2.  Hiçbir çizelgenin metni kutusundan taşmıyor.
 *    C4.  GERÇEK PDF'İN SAYFA SAYISI. Milimetre yetmiyor: mm'si doğru
 *         olan bir çıktının sonunda boş bir kâğıt olabiliyor.
 *    C3.  Taşan ödev listesi "— 2/3" başlığıyla sonraki parçaya geçiyor,
 *         SESSİZCE KIRPILMIYOR.
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
 *   Uf  Kabuğun yazdırma düzeltmesi kaldırıldı (`min-h-dvh`, `main`in
 *       `pb-28`i kâğıda da çıkıyor)
 *         → C4  ısırdı: 14 yarım için 8 sayfa (7 olmalı)
 *         → C4k ısırdı: 6 parça için 7 sayfa
 *         → C4  ısırdı: kısa çizelge 2 sayfa (1 olmalı)
 *         MİLİMETRE ÖLÇÜMLERİNİN HİÇBİRİ KIRMIZI YANMADI — mm doğruydu,
 *         sonda boş kâğıt vardı.
 *   Ue  Sığan satır sabitleri şişirildi (6 → 8, 15 → 18)
 *         → C1  ısırdı: 287,4 mm / 277 mm (pay −10,4)
 *         → C1k ısırdı: 296,5 mm / 277 mm (pay −19,5)
 *         (birim test de kırmızı yandı: sabit ölçülen mm'yle uyuşmuyor)
 *
 * -----------------------------------------------------------------------------
 * BU DENETİM AYNI SABİTİ İKİ KEZ DÜZELTTİ
 *
 * (1) `YARIMA_SIGAN_SATIR` ilk yazımda 12'ydi ve yorumunda "ölçüldü"
 * yazıyordu — tahmindi. En kötü hâl ölçülünce iki çizelge 323,1 mm
 * tuttu: A4'ü 46 mm aşıyor. Sabit 8 oldu.
 *
 * DERS: "ölçüldü" diye yazılmış bir yorum, ölçümün kendisi değildir.
 *
 * (2) 8 DE YANLIŞTI. O ölçümün fikstüründe satırların ikisi boş
 * durumdaydı ("süresi devam", "kapsam dışı"), yani satır başına 6,44 mm
 * çıkıyordu. Her satırda soru dökümü VE "gecikmeli" olduğunda gerçek
 * rakam 10,17 mm: 8 satırlık iki çizelge 287,4 mm, A4'ü 10 mm aşıyor.
 * Üstelik giriş bloğu (44,68 mm) çizelgenin sabitini 66,63 → 113,43 mm
 * çıkardığı için kodlu yarıma İKİ satır kalıyordu.
 *
 * Bu yüzden iki sabit var ve ikisi de ölçüldü:
 *   kodsuz yarım A4  →  6 satır, kâğıt başına 2 öğrenci (259 / 277 mm)
 *   kodlu  tam  A4   → 15 satır, kâğıt başına 1 öğrenci (266 / 277 mm)
 *
 * DERS: ölçüm fikstürü TEMSİLÎ değil EN KÖTÜ hâl olmalı; ve fikstürün
 * satır sayısı sabite eşitlenirse sabit kendini onaylar. Artık fikstür
 * 40 ödev veriyor, parçanın boyuna ekranın kendi sabiti karar veriyor.
 *
 * E. BOZUK YANIT
 *    E1. Uç `{}` ya da eksik şekilli bir şey döndürürse çizelge bölümü
 *        çizilmiyor, EKRAN ÇÖKMÜYOR, sınıf listesi ve veli fişi
 *        etkilenmiyor. (Bu grubu süpürme yazdırdı: ilk koruma `{}`'ı
 *        doğru sayıyordu.)
 *
 * F. VELİ KODU VE GİRİŞ YÖNLENDİRMESİ (öğretmenin isteği)
 *    F1. Onaysız kod ağa GİTMİYOR; diyalog ne olacağını söylüyor.
 *    F2. Kod, sekizkyal.com yönlendirmesi, uygulama kurulumu ve antette
 *        "Matematik · Buket Topuzoğlu" yazılı.
 *    F3. ÖĞRENCİ kodu bu kâğıda girmiyor (uç döndürse bile).
 *    F4. Kodlar tarayıcı deposunda tutulmuyor.
 *    F5. Sahipsiz bir yarımda kod yok.
 *
 * H. ANTETTEKİ EWALU MASKOTU (öğretmenin isteği)
 *    H1. Görsel her parçanın antetinde ve gerçekten yüklenmiş.
 *    H2. Tembel yükleme kapalı — kâğıtta boş basmasın.
 *    H3. Maskot armadan uzun değil, yani ödev satırı yemiyor.
 *
 * G. KODSUZ DA BASILABİLİYOR
 *    G1. Onaylanmazsa çizelge yine çiziliyor, boş "Veli kodunuz:" satırı
 *        basılmıyor.
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
function cizelge({ odevSayisi = 3, yeniAlanlar = true, enKotu = false } = {}) {
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
  // EN KÖTÜ HÂLDE YOK: ölçüm fikstürü "temsilî" olmamalı (aşağıdaki ders).
  if (odevSayisi >= 3 && !enKotu) {
    odevler[1].son_tarih = '2099-01-01';
    odevler[1].sure_doldu = false;
    if (yeniAlanlar) odevler[1].kiyas = { durum: 'sure_dolmadi' };
  }

  const hucre = (id, i) => {
    if (!enKotu && i === 1) return { odev_id: id, durum: 'suresi_devam', puan: null };
    if (!enKotu && i === 2) return { odev_id: id, durum: 'kapsam_disi', puan: null };
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
        // 0091 sunucuda `limit 3` uyguluyor; en kötü hâl ÜÇ UZUN konu adı.
        ...(yeniAlanlar
          ? {
            eksik_konular: enKotu
              ? ['Çarpanlara Ayırma ve Özdeşlikler', 'Köklü İfadelerde İşlemler',
                 'Oran Orantı ve Doğru Orantı']
              : ['Üslü sayılar'],
          }
          : {}),
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

/**
 * Sayfada Türkçe-duyarlı arama.
 *
 * `innerText` CSS'teki `text-transform: uppercase`'i UYGULUYOR: antetteki
 * "Veli girişi" ekrandan "VELİ GİRİŞİ" olarak okunuyor. JS'in `i` bayrağı
 * Türkçe İ/i çiftini doğru eşlemediği için karşılaştırma sayfada
 * `toLocaleLowerCase('tr')` ile yapılıyor (0041'in dersi).
 *
 * İLK YAZIMINDA bu yoktu ve F2 kırmızı yandı — ürün doğruydu, ÖLÇÜM
 * yanlıştı.
 */
const icerir = (p, s) =>
  p.evaluate(
    (x) => document.body.innerText.toLocaleLowerCase('tr').includes(x.toLocaleLowerCase('tr')),
    s,
  );

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

/** A4 − 2 × 10 mm kenar. Kâğıdın yazılabilir boyu. */
const KULLANILABILIR = 297 - 2 * 10;

/**
 * Bir modun kâğıt ölçüsünü al.
 *
 * `kodlu` ise veli kodları onaylanıp getiriliyor: giriş bloğu çiziliyor,
 * ızgara `--tam` moduna geçiyor (kâğıt başına bir öğrenci).
 */
async function kagitOlcusu({ odevSayisi, kodlu }) {
  const uclar = {
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ odevSayisi, enKotu: true }),
  };
  if (kodlu) uclar.ogrenci_kodlari = { veli: 'VELI111', ogrenci: 'OGR999' };
  // KÂĞIDIN GENİŞLİĞİNDE ÖLÇÜLÜYOR: A4 210 − 2 × 10 mm = 190 mm = 718 px.
  // 1280 px'te ölçmek, kâğıtta saran satırları görmemek demekti.
  const { b, p } = await kur(uclar, 718);

  if (kodlu) {
    await p.getByRole('button', { name: 'Veli kodlarını da ekle' }).click();
    await p.waitForTimeout(300);
    await p.locator('dialog[open]').getByRole('button', { name: 'Getir ve hazırla' }).click();
    await p.waitForTimeout(900);
  }

  await p.getByRole('button', { name: 'Veli çizelgelerini yazdır' }).click();
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(300);

  const olcu = await p.evaluate(() => {
    const PX_MM = 96 / 25.4;
    const mm = (px) => +(px / PX_MM).toFixed(1);
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')];
    const izgara = document.querySelector('.sk-cizelge-izgara');
    const bosluk = parseFloat(getComputedStyle(izgara).rowGap || '0');
    const boylar = yarimlar.map((y) => y.getBoundingClientRect().height);
    return {
      adet: yarimlar.length,
      boslukMm: mm(bosluk),
      enBuyukMm: mm(Math.max(...boylar, 0)),
      ikisiMm: mm(boylar.slice(0, 2).reduce((a, x) => a + x, 0) + bosluk),
      // 1 px pay: alt piksel yuvarlamaları taşma sayılmasın.
      tasan: yarimlar.filter((y) => y.scrollHeight > y.clientHeight + 1).length,
      tekSutun: getComputedStyle(izgara).gridTemplateColumns.split(' ').length === 1,
      tamMod: izgara.classList.contains('sk-cizelge-izgara--tam'),
      // Parça başına satır: SABİTİ ÖLÇÜM OKUYOR, denetim onu yazmıyor.
      // Sabit büyütülürse bu sayı ve boylar kendiliğinden büyüyor.
      parcaSatiri: yarimlar[0] ? yarimlar[0].querySelectorAll('tbody tr').length : 0,
      // Kâğıt başına bir öğrenci: her çizelgeden sonra yeni sayfa.
      sayfaKesmesi: yarimlar.slice(0, -1).every(
        (y) => getComputedStyle(y).breakAfter === 'page'),
    };
  });

  /**
   * MİLİMETRE YETMEZ — SAYFA SAYILIYOR.
   *
   * DOM'da iki yarımın toplamı 259 mm çıkıyordu (277'nin altında) ama
   * gerçek PDF İKİ sayfaydı: kabuğun ekrana ait boşlukları (`min-h-dvh`
   * ve `main`in `pb-28`i) gövdeyi 317,5 mm'ye uzatıyor ve her çıktının
   * sonuna BOŞ BİR KÂĞIT ekliyordu. Hiçbir mm ölçümü bunu görmedi;
   * gören şey `page.pdf()`in sayfa sayısı oldu.
   */
  const pdf = await p.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });
  olcu.sayfa = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

  await p.emulateMedia({ media: 'screen' });
  await b.close();
  return olcu;
}

{
  /**
   * SAYFA SAYMAK YETMEZ. DOM'da iki çizelge olması, ikisinin AYNI KÂĞIDA
   * sığdığını söylemez. Ölçülen şey milimetre.
   *
   * FİKSTÜR EN KÖTÜ HÂL (`enKotu: true`): her satırda soru dökümü VE
   * "gecikmeli" alt satırı, öğrencide üç uzun konu adı. İlk yazımda
   * fikstür "temsilî"ydi — iki satırı boş durumdaydı — ve satır başına
   * 6,44 mm çıkarmıştı. Gerçek rakam 10,17 mm; o yüzden eski sabit (8)
   * kâğıdı 22 mm aşıyordu ve bu ölçüm onu görmüyordu.
   *
   * ÖDEV SAYISI BİLEREK ÇOK (40): parçanın kaç satır tutacağına ekranın
   * kendi sabiti karar veriyor, denetim onu YAZMIYOR. Sabit büyütülürse
   * ölçülen parça da büyüyor ve bu satır kırmızı yanıyor. Fikstürün
   * satır sayısını sabite eşitlemek, sabiti kendi kendine onaylatmak
   * olurdu.
   */
  const kodsuz = await kagitOlcusu({ odevSayisi: 40, kodlu: false });
  console.log(`  · kodsuz parça başına ${kodsuz.parcaSatiri} satır`);
  de(kodsuz.tekSutun, 'C1: kâğıtta tek sütun — iki öğrenci alt alta');
  de(!kodsuz.tamMod, 'C1: kodsuz modda ızgara yarım düzende');
  de(
    kodsuz.ikisiMm <= KULLANILABILIR,
    `C1: KODSUZ — iki çizelge A4'e sığıyor: ${kodsuz.ikisiMm} mm / ${KULLANILABILIR} mm `
    + `(pay ${(KULLANILABILIR - kodsuz.ikisiMm).toFixed(1)} mm)`,
  );
  de(kodsuz.tasan === 0, `C2: hiçbir çizelgenin metni kutusundan taşmıyor (${kodsuz.tasan})`);
  de(
    kodsuz.sayfa === Math.ceil(kodsuz.adet / 2),
    `C4: KODSUZ — ${kodsuz.adet} yarım ${Math.ceil(kodsuz.adet / 2)} kâğıda basılıyor `
    + `(gerçek PDF: ${kodsuz.sayfa} sayfa)`,
  );

  /**
   * KODLU MOD — KÂĞIT BAŞINA BİR ÖĞRENCİ.
   *
   * Giriş bloğu 44,68 mm, yani yarım A4'ün üçte biri; yarıma bölünse
   * öğrenci başına iki ödev satırı kalırdı. Ölçülen şey: 15 satırlık en
   * kötü çizelge TAM sayfaya sığıyor ve her çizelgeden sonra yeni kâğıt
   * başlıyor.
   */
  const kodlu = await kagitOlcusu({ odevSayisi: 40, kodlu: true });
  console.log(`  · kodlu parça başına ${kodlu.parcaSatiri} satır`);
  de(kodlu.tamMod, 'C1k: kodlu modda ızgara tam sayfa düzenine geçti');
  de(
    kodlu.enBuyukMm <= KULLANILABILIR,
    `C1k: KODLU — en uzun çizelge A4'e sığıyor: ${kodlu.enBuyukMm} mm / ${KULLANILABILIR} mm `
    + `(pay ${(KULLANILABILIR - kodlu.enBuyukMm).toFixed(1)} mm)`,
  );
  de(kodlu.sayfaKesmesi, 'C1k: her çizelgeden sonra yeni kâğıt başlıyor');
  de(kodlu.tasan === 0, `C2k: kodlu çizelgenin metni kutusundan taşmıyor (${kodlu.tasan})`);
  de(
    kodlu.sayfa === kodlu.adet,
    `C4k: KODLU — kâğıt başına bir çizelge: ${kodlu.adet} parça / ${kodlu.sayfa} sayfa`,
  );
  // KODLU MOD DAHA AZ KÂĞIT YİYOR: aynı 40 ödev, daha az parça.
  de(
    kodlu.adet < kodsuz.adet,
    `C1k: kodlu mod daha az parça üretiyor — ${kodlu.adet} < ${kodsuz.adet}`,
  );

  /**
   * SONDA BOŞ KÂĞIT ÇIKMIYOR.
   *
   * En küçük hâl: iki öğrenci, ikisi de tek yarım. Doğru çıktı TEK
   * kâğıt. Bu ölçüm yazılmadan önce gerçek PDF İKİ sayfaydı ve ikincisi
   * bomboştu — ekranda hiçbir şey görünmediği için kimse fark etmezdi,
   * ama öğretmen her sınıfta bir kâğıt fazla basardı.
   */
  const kucuk = await kagitOlcusu({ odevSayisi: 3, kodlu: false });
  de(
    kucuk.sayfa === 1,
    `C4: iki öğrencilik kısa çizelge TEK kâğıt — sonda boş sayfa yok (${kucuk.sayfa})`,
  );
}

// ===========================================================================
console.log('--- C3. Taşan liste bir sonraki parçaya geçiyor ---');
// ===========================================================================
{
  // 15 ödev, kodsuz: sığan satır 6, yani ilk öğrenci üç parçaya taşmalı.
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ odevSayisi: 15 }),
  });
  const g = await metin(p);
  de(g.includes(`${BIR} — 1/3`) && g.includes(`${BIR} — 3/3`),
    'C3: taşan çizelge "— 1/3" … "— 3/3" olarak bölündü');

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

// ===========================================================================
console.log('--- E. Uç BEKLENMEDİK bir şey döndürürse ekran çökmüyor ---');
// ===========================================================================
{
  /**
   * SÜPÜRME BU KUSURU YAKALADI, BU DENETİM DEĞİL.
   *
   * D grubu iyi biçimli ama yeni alanları olmayan bir yanıtı ölçüyordu;
   * eksik olan hâl BOZUK yanıttı. Koruma `{cizelge && …}` yazıyordu ve
   * `{}` DOĞRU SAYILIYOR: ekran `cizelge.sinif.ad` satırında çöküyordu.
   * `iki-ortalama-denetimi.mjs` taklit etmediği uçlara `{}` döndürüyor
   * ve bu ekrana uğradığı için kırmızı yandı.
   *
   * Part VIII'in kuralı "alan gelmezse çizme" değil, "gelmeyen veri
   * ekranı BOZMASIN".
   */
  for (const [ad, yanit] of [
    ['boş nesne', {}],
    ['sinif yok', { odevler: [], ogrenciler: [] }],
    ['odevler dizi değil', { sinif: { ad: '7C' }, odevler: null, ogrenciler: [] }],
    ['ogrenciler dizi değil', { sinif: { ad: '7C' }, odevler: [], ogrenciler: {} }],
  ]) {
    const { b, p } = await kur({
      ben_kimim: SAHIP,
      sinif_ogrenci_ozeti: OZET,
      sinif_not_cizelgesi: yanit,
    });
    const g = await metin(p);
    de(!(await icerir(p, 'Ödev çizelgesi')), `E1 ${ad}: çizelge bölümü çizilmedi`);
    // SINIF LİSTESİ VE VELİ FİŞİ ETKİLENMİYOR: bozuk bir uç, çalışan
    // iki çıktıyı da götürmemeli.
    de(g.includes(BIR) && (await icerir(p, 'Veli bilgi fişi')),
      `E1 ${ad}: liste ve veli fişi yerinde`);
    await b.close();
  }
}

// ===========================================================================
console.log('--- F. Veli kodu, giriş yönlendirmesi, uygulama kurulumu ---');
// ===========================================================================
{
  const KOD = { o1: 'VELI111', o2: 'VELI222' };
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge(),
    ogrenci_kodlari: { veli: KOD.o1, ogrenci: 'OGR999' },
  });

  // F1 — ONAYSIZ KOD AĞA GİTMİYOR.
  const once = await p.evaluate(() => document.body.innerText);
  de(!once.includes('Veli kodunuz'), 'F1: onaydan önce giriş bloğu yok');
  de(!once.includes(KOD.o1), 'F1: onaydan önce kod ekranda yok');

  await p.getByRole('button', { name: 'Veli kodlarını da ekle' }).click();
  await p.waitForTimeout(300);
  const diyalog = await p.locator('dialog[open]').innerText();
  de(/yalnız VELİ kodu basılır/i.test(diyalog),
    'F1: diyalog öğrenci kodunun basılmadığını söylüyor');
  de(/öğrencilere dönük bırakmayın/i.test(diyalog),
    'F1: diyalog ekranı uyarıyor');

  await p.locator('dialog[open]').getByRole('button', { name: 'Getir ve hazırla' }).click();
  await p.waitForTimeout(900);

  const g = await p.evaluate(() => document.body.innerText);
  de(await icerir(p, 'Veli girişi'), 'F2: giriş bloğu çizildi');
  de(g.includes(KOD.o1), 'F2: veli kodu yazılı');
  de(g.includes('sekizkyal.com'), 'F2: giriş adresi yazılı');
  de(/Ana Ekrana Ekle/.test(g) && /Android/.test(g),
    'F2: uygulama kurulumu (iOS + Android) yazılı');
  de(await icerir(p, 'Matematik · Buket Topuzoğlu'),
    'F2: antette ders ve öğretmen yazılı');

  // F3 — ÖĞRENCİ KODU BU KÂĞIDA GİRMİYOR. Taklit uç onu döndürüyor;
  // ekranın onu basmadığı ölçülüyor.
  de(!g.includes('OGR999'), 'F3: ÖĞRENCİ kodu çizelgede YOK');

  // F4 — KODLAR TARAYICI DEPOSUNDA TUTULMUYOR. "Geri gelince yeniden
  // çekmeyelim" diye depoya yazmak kolay bir iyileştirme gibi görünür;
  // kodları cihazda kalıcı bırakır (`KodFisleri`in aynı ölçümü).
  const depoda = await p.evaluate((kodlar) => {
    const hepsi = [localStorage, sessionStorage]
      .map((d) => Object.keys(d).map((k) => String(d.getItem(k))).join(' '))
      .join(' ');
    return kodlar.filter((k) => hepsi.includes(k)).length;
  }, [KOD.o1, 'OGR999']);
  de(depoda === 0, `F4: kodlar tarayıcı deposunda tutulmuyor (${depoda})`);

  // F5 — KOD YALNIZ KENDİ YARIMINDA. Bu kâğıt kesilip veliye gidiyor;
  // bir yarımda başka öğrencinin kodu olsaydı o veli başka bir çocuğun
  // veli hesabına girebilirdi.
  const sizan = await p.evaluate(({ kod, bir, iki }) => {
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')];
    return yarimlar.filter((y) => {
      const t = y.innerText;
      const kendi = t.includes(bir) ? bir : (t.includes(iki) ? iki : null);
      // Taklitte iki öğrenciye de aynı kod dönüyor; ölçülen şey kodun
      // BAŞKA bir öğrencinin yarımında görünüp görünmediği değil, bir
      // yarımda İKİ öğrencinin birlikte bulunmaması (B1 ile birlikte).
      return kendi === null && t.includes(kod);
    }).length;
  }, { kod: KOD.o1, bir: BIR, iki: IKI });
  de(sizan === 0, `F5: sahipsiz yarımda kod yok (${sizan})`);

  await b.close();
}

// ===========================================================================
console.log('--- G. Kod olmadan da basılabiliyor ---');
// ===========================================================================
{
  // Öğretmen kodları getirmeyi onaylamazsa çizelge YİNE basılıyor;
  // giriş bloğu olmadan. Kodsuz bir çizelge hâlâ işe yarıyor.
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge(),
  });
  const g = await p.evaluate(() => document.body.innerText);
  de(await icerir(p, 'Ödev çizelgesi'), 'G1: çizelge kodsuz da çiziliyor');
  de(!g.includes('Veli kodunuz'), 'G1: boş "Veli kodunuz:" satırı basılmıyor');
  de(!(await icerir(p, 'Veli girişi')), 'G1: giriş bloğu hiç çizilmiyor');
  await b.close();
}

// ===========================================================================
console.log('--- H. Antetteki Ewalu maskotu ---');
// ===========================================================================
{
  /**
   * Öğretmenin isteği: "Ödev çizelgesinde Ewalu maskotunun da görüntüsü
   * olsun... arkasında okul adı gözüken resim."
   *
   * ÜÇ ŞEY ÖLÇÜLÜYOR:
   *   H1. Görsel HER parçanın antetinde ve GERÇEKTEN YÜKLENMİŞ.
   *       `naturalWidth > 0` olmadan `<img>` etiketi varken kâğıda boş
   *       bir çerçeve basılır.
   *   H2. Tembel yükleme KAPALI. Kâğıt çıktısında alttaki çizelgeler
   *       görünür alanın dışında kalıyor; `lazy` olsaydı o maskotlar
   *       boş basardı. Bu, ekranda hiç görünmeyen bir kusur.
   *   H3. Maskot anteti BÜYÜTMÜYOR: boyu armayı aşmıyor. Aşsaydı
   *       çizelge uzar ve yarıma sığan ödev satırı düşerdi — C1/C4
   *       zaten kırmızı yanardı, ama bu satır nedenini söylüyor.
   */
  const { b, p } = await kur({
    ben_kimim: SAHIP,
    sinif_ogrenci_ozeti: OZET,
    sinif_not_cizelgesi: cizelge({ odevSayisi: 15 }),
  }, 718);
  await p.getByRole('button', { name: 'Veli çizelgelerini yazdır' }).click();
  await p.waitForTimeout(400);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(500);

  const m = await p.evaluate(() => {
    const yarimlar = [...document.querySelectorAll('.sk-veli-cizelge')];
    const gorseller = yarimlar.map((y) => y.querySelector('.sk-cizelge-maskot'));
    const arma = yarimlar[0]?.querySelector('.sk-fis-muhru');
    const mm = (px) => +(px / (96 / 25.4)).toFixed(2);
    return {
      yarim: yarimlar.length,
      gorsel: gorseller.filter(Boolean).length,
      yuklenen: gorseller.filter((g) => g && g.naturalWidth > 0).length,
      tembel: gorseller.filter((g) => g && g.loading !== 'eager').length,
      kaynak: gorseller[0]?.currentSrc ?? '',
      maskotMm: gorseller[0] ? mm(gorseller[0].getBoundingClientRect().height) : 0,
      armaMm: arma ? mm(arma.getBoundingClientRect().height) : 0,
    };
  });

  de(m.gorsel === m.yarim, `H1: maskot her parçanın antetinde (${m.gorsel}/${m.yarim})`);
  de(m.yuklenen === m.yarim, `H1: görsellerin hepsi yüklendi (${m.yuklenen}/${m.yarim})`);
  de(/okul-tam/.test(m.kaynak), `H1: öğretmenin istediği "okul" pozu — arkasında okul adı (${m.kaynak.split('/').pop()})`);
  de(m.tembel === 0, `H2: tembel yükleme kapalı — kâğıtta boş basmaz (${m.tembel} tembel)`);
  de(
    m.maskotMm <= m.armaMm + 0.1,
    `H3: maskot anteti büyütmüyor — ${m.maskotMm} mm ≤ arma ${m.armaMm} mm`,
  );
  await p.emulateMedia({ media: 'screen' });
  await b.close();
}

console.log('');
if (hata) { console.log(`VELİ ÇİZELGESİ DENETİMİ BAŞARISIZ — ${hata} sapma`); process.exit(1); }
console.log('VELİ ÇİZELGESİ DENETİMİ GEÇTİ');
