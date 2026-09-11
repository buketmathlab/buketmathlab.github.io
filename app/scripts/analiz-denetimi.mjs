/**
 * SINIF ANALİZİ — TARAYICIDA UÇTAN UCA (0040)
 *
 * ## Bu betiğin NEYİ kanıtlayıp NEYİ kanıtlamadığı
 *
 * Sayıların DOĞRU HESAPLANDIĞI burada kanıtlanmıyor ve kanıtlanamaz:
 * yanıtları betiğin kendisi taklit ediyor. Kendi kurduğum sahte ortalamayı
 * "doğru" diye ölçmek dairesel olurdu.
 *
 * O iddianın yeri SQL ve ORADA ÖLÇÜLÜYOR — gerçek veritabanına karşı,
 * elde hesaplanmış değerlerle: `supabase/testler/analiz_testleri.sql`
 * (9 grup; ortalamalar, konu oranları, eşikler, hafta kırılımı, tarih
 * süzgeci, açık uçlu ödevin konuya girmemesi, kapsam).
 *
 * Bu betik o hattın TARAYICI YARISINI ölçüyor: sunucunun verdiği sayı
 * ekrana AYNEN basılıyor mu, arayüz kendi hesabını ya da kendi eşiğini
 * uyduruyor mu.
 *
 * ## Ölçüm neden İKİ VERİ KÜMESİYLE yapılıyor
 *
 * İlk yazdığımda tek küme vardı ve 29 ölçümün hepsi geçti. Bakınca üçü
 * ASLA KALAMAZDI:
 *   - `metin.includes('—')` — başlıktaki "9A — ödev analizi" tireyi zaten
 *     sağlıyordu; boş haftanın "0" yazması bu ölçümü bozmazdı.
 *   - `/\b5\b/` ödev sayısı diye ölçülüyordu; sayfadaki "5 sorudan az"
 *     ifadesi bunu her hâlükârda geçiriyordu.
 *   - `!/Çalışılmalı\s*Köklü/` — listede araya virgülle girseydi bu kalıp
 *     yine tutmazdı; kusur geçip giderdi.
 * Geçen bir ölçüm, kalabildiğini göstermedikçe bir şey kanıtlamaz.
 *
 * Onun için artık ekran, İKİ FARKLI yanıtla iki kez ölçülüyor (A ve B) ve
 * her sayı sunulan gövdeden okunup birebir karşılaştırılıyor. Sabit
 * yazılmış ya da arayüzde hesaplanmış bir değer ikisini birden tutturamaz.
 * B kümesi bilerek A'nın uç durumlarını taşıyor: ortalaması olmayan dönem,
 * boş "iyi" listesi, hiç aylık kırılım yok, konusuz hafta, %0 oran ve
 * A'dan FARKLI eşikler (arayüz kendi %70'ini basarsa B'de yakalanır).
 *
 * `✓ built` görmeden bu sonuçlara güvenmeyin — betik derlenmiş paketi
 * ölçüyor, kaynağı değil.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = 'http://127.0.0.1:8788/yeni/#';

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
/** Beklenen ile bulunanı yan yana yazar: kusur çıkınca fark görünsün. */
function esit(ad, beklenen, bulunan) {
  const b = JSON.stringify(beklenen);
  const v = JSON.stringify(bulunan);
  olc(ad, b === v, b === v ? v : `beklenen ${b}, bulunan ${v}`);
}

/** A KÜMESİ — olağan dönem. */
const A = {
  sinif: { id: '9a', ad: '9A' },
  aralik: { baslangic: '2026-06-22', bitis: '2026-09-11', varsayilan: true },
  esikler: { iyi: 70, calisilmali: 50, en_az_soru: 5 },
  mevcut: 24,
  ozet: {
    odev_sayisi: 5,
    test_sayisi: 4,
    gonderim: 96,
    ortalama: 71.4,
    iyi: ['Türev'],
    calisilmali: ['Limit'],
    en_eksik_uc: ['Limit', 'Üslü Sayılar', 'Türev'],
    konular: [
      { konu: 'Limit', toplam: 48, dogru: 15, oran: 31, durum: 'calisilmali' },
      { konu: 'Üslü Sayılar', toplam: 24, dogru: 14, oran: 58, durum: 'orta' },
      { konu: 'Türev', toplam: 48, dogru: 44, oran: 92, durum: 'iyi' },
      { konu: 'Köklü Sayılar', toplam: 3, dogru: 1, oran: 33, durum: 'az_veri' },
    ],
  },
  haftalar: [
    {
      baslangic: '2026-09-07',
      bitis: '2026-09-13',
      odev_sayisi: 1,
      test_sayisi: 1,
      gonderim: 22,
      ortalama: 64.5,
      konular: [{ konu: 'Limit', toplam: 44, dogru: 14, oran: 32, durum: 'calisilmali' }],
    },
    {
      // ORTALAMASI OLMAYAN HAFTA: kimse göndermemiş. "0" yazmak "sıfır
      // aldılar" demek olurdu — bu ayrım ölçülüyor.
      baslangic: '2026-08-31',
      bitis: '2026-09-06',
      odev_sayisi: 1,
      test_sayisi: 0,
      gonderim: 0,
      ortalama: null,
      konular: [],
    },
  ],
  aylar: [
    {
      ay: '2026-09-01',
      odev_sayisi: 2,
      test_sayisi: 1,
      gonderim: 22,
      ortalama: 64.5,
      konular: [{ konu: 'Limit', toplam: 44, dogru: 14, oran: 32, durum: 'calisilmali' }],
    },
  ],
};

/**
 * B KÜMESİ — A'nın her uç durumu tersine çevrilmiş hâli.
 * Eşikler bilerek A'dan farklı: ekran kendi %70'ini yazıyorsa burada düşer.
 */
const B = {
  sinif: { id: '9a', ad: '10C' },
  aralik: { baslangic: '2026-02-10', bitis: '2026-06-20', varsayilan: false },
  esikler: { iyi: 60, calisilmali: 40, en_az_soru: 3 },
  mevcut: 7,
  ozet: {
    odev_sayisi: 2,
    test_sayisi: 2,
    gonderim: 13,
    ortalama: null, // dönem ortalaması yok
    iyi: [], // "İyi gidiyor" satırı hiç çıkmamalı
    calisilmali: ['Köklü Sayılar'],
    en_eksik_uc: ['Köklü Sayılar'],
    konular: [
      { konu: 'Köklü Sayılar', toplam: 10, dogru: 2, oran: 20, durum: 'calisilmali' },
      { konu: 'Logaritma', toplam: 2, dogru: 0, oran: 0, durum: 'az_veri' },
    ],
  },
  haftalar: [
    {
      baslangic: '2026-06-15',
      bitis: '2026-06-21',
      odev_sayisi: 1,
      test_sayisi: 0,
      gonderim: 6,
      ortalama: 100,
      konular: [], // konusuz hafta: açık uçlu ödev
    },
  ],
  aylar: [], // hiç aylık kırılım yok
};

const tarayici = await chromium.launch();

/** Sunucunun yerine geçer; hangi gövdenin döneceğini `kume` belirler. */
async function analizSayfasi(kume, genislik = 1024) {
  const s = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  const istekler = [];
  await s.route('**/rest/v1/rpc/*', (r) => {
    const uc = r.request().url().split('/').pop().split('?')[0];
    istekler.push({ uc, govde: r.request().postData() });
    const govde =
      uc === 'ben_kimim'
        ? { id: 's1', ad: 'Buket', sahip: true, vekalet: false, vekil: null }
        : uc === 'sinif_analizi'
          ? kume
          : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  });
  await s.addInitScript(() =>
    localStorage.setItem(
      'sekiz_oturum',
      JSON.stringify({ rol: 'ogretmen', token: 't'.repeat(64) }),
    ),
  );
  await s.goto(KOK + '/ogretmen/siniflar/9a/analiz', { waitUntil: 'networkidle' });
  await s.waitForTimeout(700);
  return { s, istekler };
}

/**
 * Ekranı YAPISINDAN okur — `innerText` içinde kalıp aramaz.
 * Sayıyı etiketiyle eşleştirdiği için "5" başka bir cümleden gelemez.
 */
const OKU = () => {
  const kok = document.querySelector('.sk-analiz');
  if (!kok) return null;
  const yaz = (e) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  // Ozet kutuları: <p class="sk-sayi">değer</p><p>etiket</p>
  const kutular = (kapsam) => {
    const cikti = {};
    for (const d of kapsam.querySelectorAll(':scope div.grid > div')) {
      const sayi = d.querySelector('p.sk-sayi');
      const etiket = d.querySelectorAll('p')[1];
      if (sayi && etiket) cikti[yaz(etiket)] = yaz(sayi);
    }
    return cikti;
  };

  // Konu tablosu: satır satır konu / doğru / durum.
  const tablo = (kapsam) => {
    const t = kapsam.querySelector(':scope table');
    if (!t) return { yok: yaz(kapsam.querySelector(':scope > p.text-muted')) };
    return {
      satirlar: [...t.querySelectorAll('tbody tr')].map((tr) => {
        const h = tr.querySelectorAll('td');
        return { konu: yaz(h[0]), sayi: yaz(h[1]), durum: yaz(h[2]) };
      }),
    };
  };

  const bolum = (baslik) =>
    [...kok.querySelectorAll(':scope > section')].find(
      (s) => yaz(s.querySelector('h2')) === baslik,
    );

  const ozetBolum = bolum('Dönem özeti');
  const ozetKart = ozetBolum.querySelector(':scope > div');

  // İki liste: etiket (Tag) ve parantezli eşik notu ayrı ayrı okunuyor.
  const listeler = [...ozetKart.querySelectorAll(':scope > div.gap-2 > p')].map((p) => {
    const etiket = yaz(p.querySelector('span.rounded-full'));
    const not = yaz(p.querySelector('span.text-muted'));
    let liste = yaz(p);
    if (etiket) liste = liste.replace(etiket, '');
    if (not) liste = liste.replace(not, '');
    return { etiket, liste: liste.trim(), not };
  });

  const kova = (kapsam) => ({ kutular: kutular(kapsam), tablo: tablo(kapsam) });

  const kirilim = (baslik) => {
    const b = bolum(baslik);
    const kartlar = [...b.querySelectorAll(':scope > div.gap-3 > div')];
    if (kartlar.length === 0) return { bos: yaz(b.querySelector(':scope > div > p')) };
    return {
      satirlar: kartlar.map((k) => ({ etiket: yaz(k.querySelector('h3')), ...kova(k) })),
    };
  };

  return {
    baslik: yaz(kok.querySelector('h1')),
    ustBilgi: yaz(kok.querySelector('header p')),
    ozet: kova(ozetKart),
    enEksik: yaz(ozetKart.querySelector(':scope > p strong')),
    listeler,
    haftalik: kirilim('Haftalık'),
    aylik: kirilim('Aylık'),
    dipnot: yaz(kok.querySelector(':scope > p')),
    tumMetin: kok.innerText,
  };
};

/**
 * Bir kova için beklenen kutu değerlerini sunulan gövdeden türetir.
 * Ondalık ayracı VİRGÜL olmalı: uygulamanın geri kalanı (`Gelisim.tsx`)
 * tr-TR yazıyor, ortalama burada 71.4 diye çıkarsa öğretmen aynı sayıyı
 * iki ekranda iki türlü görür.
 */
const SAYI = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
function beklenenKutular(k, mevcut) {
  return {
    Ortalama: k.ortalama === null ? '—' : SAYI.format(k.ortalama),
    Ödev: SAYI.format(k.odev_sayisi),
    Gönderim: SAYI.format(k.gonderim),
    Öğrenci: SAYI.format(mevcut),
  };
}
function beklenenSatirlar(k) {
  return k.konular.map((t) => ({
    konu: t.konu,
    sayi: `${t.dogru}/${t.toplam} (%${t.oran})`,
  }));
}

/** Her iki küme için aynı ölçümleri yapar. */
async function kumeyiOlc(ad, K) {
  console.log(`\n— ${ad} KÜMESİ —`);
  const { s } = await analizSayfasi(K);
  const g = await s.evaluate(OKU);
  if (!g) {
    olc(`${ad}: analiz ekranı çizildi`, false, 'sk-analiz bulunamadı');
    await s.close();
    return null;
  }
  olc(`${ad}: analiz ekranı çizildi`, true);

  // 1. Başlık ve mevcut, sunulan gövdeden.
  esit(`${ad}: başlık sunucunun sınıf adı`, `${K.sinif.ad} — ödev analizi`, g.baslik);
  olc(
    `${ad}: öğrenci sayısı üst bilgide`,
    new RegExp(`${K.mevcut} öğrenci`).test(g.ustBilgi),
    g.ustBilgi,
  );
  olc(
    `${ad}: "son 12 hafta" notu yalnız varsayılanda`,
    /son 12 hafta/.test(g.ustBilgi) === K.aralik.varsayilan,
    g.aralik === undefined ? `varsayılan=${K.aralik.varsayilan}` : '',
  );

  // 2. Dönem özeti kutuları — etiketiyle eşleşen sayı.
  esit(
    `${ad}: dönem özeti kutuları`,
    beklenenKutular(K.ozet, K.mevcut),
    g.ozet.kutular,
  );

  // 3. Konu tablosu satır satır.
  esit(
    `${ad}: dönem konu tablosu`,
    beklenenSatirlar(K.ozet),
    (g.ozet.tablo.satirlar ?? []).map(({ konu, sayi }) => ({ konu, sayi })),
  );

  // 4. Durum etiketi SUNUCUNUN `durum` alanından; arayüz kendi eşiğini
  //    uydurmuyor. Az veri damgası sunucunun `en_az_soru` sayısını yazıyor.
  const beklenenDurum = {
    iyi: 'İyi',
    orta: 'Orta',
    calisilmali: 'Çalışılmalı',
    az_veri: `Az veri (${K.esikler.en_az_soru} sorudan az)`,
  };
  esit(
    `${ad}: durum damgaları sunucunun alanından`,
    K.ozet.konular.map((t) => beklenenDurum[t.durum]),
    (g.ozet.tablo.satirlar ?? []).map((t) => t.durum),
  );

  // 5. İki liste ayrı; boş olan hiç çıkmıyor; eşik yüzdesi sunucudan.
  const beklenenListeler = [];
  if (K.ozet.calisilmali.length > 0)
    beklenenListeler.push({
      etiket: 'Çalışılmalı',
      liste: K.ozet.calisilmali.join(', '),
      not: `(doğru oranı %${K.esikler.calisilmali} altında)`,
    });
  if (K.ozet.iyi.length > 0)
    beklenenListeler.push({
      etiket: 'İyi gidiyor',
      liste: K.ozet.iyi.join(', '),
      not: `(doğru oranı %${K.esikler.iyi} ve üstü)`,
    });
  esit(`${ad}: iyi/çalışılmalı listeleri`, beklenenListeler, g.listeler);

  // 6. Az veri konusu İKİ LİSTEYE DE girmemeli — tabloda durur ama
  //    sınıflandırılmaz. (Liste metninin tamamı karşılaştırıldığı için
  //    araya virgülle sızsa da yakalanır.)
  const azVeri = K.ozet.konular.filter((t) => t.durum === 'az_veri').map((t) => t.konu);
  olc(
    `${ad}: az veri konusu listelere girmemiş`,
    azVeri.every((k) => g.listeler.every((l) => !l.liste.includes(k))),
    azVeri.length ? azVeri.join(', ') : 'az veri konusu yok',
  );
  olc(
    `${ad}: az veri konusu tablodan da silinmemiş`,
    azVeri.every((k) => (g.ozet.tablo.satirlar ?? []).some((t) => t.konu === k)),
  );

  // 7. En çok eksik üç konu.
  esit(
    `${ad}: en çok eksik konular`,
    K.ozet.en_eksik_uc.length ? K.ozet.en_eksik_uc.join(', ') : null,
    g.enEksik,
  );

  // 8. Haftalık ve aylık kırılım — her kova sunulan gövdeyle birebir.
  for (const [baslik, kovalar, alan] of [
    ['Haftalık', K.haftalar, g.haftalik],
    ['Aylık', K.aylar, g.aylik],
  ]) {
    if (kovalar.length === 0) {
      esit(
        `${ad}: ${baslik.toLowerCase()} kırılım yoksa boş metin`,
        `Bu aralıkta ${baslik.toLowerCase()} kırılım yok.`,
        alan.bos,
      );
      continue;
    }
    esit(
      `${ad}: ${baslik.toLowerCase()} kova sayısı`,
      kovalar.length,
      (alan.satirlar ?? []).length,
    );
    esit(
      `${ad}: ${baslik.toLowerCase()} kutular`,
      kovalar.map((k) => beklenenKutular(k, K.mevcut)),
      (alan.satirlar ?? []).map((r) => r.kutular),
    );
    esit(
      `${ad}: ${baslik.toLowerCase()} konu tabloları`,
      kovalar.map((k) =>
        k.konular.length
          ? beklenenSatirlar(k)
          : 'Bu aralıkta konu dökümü çıkaracak test ödevi yok.',
      ),
      (alan.satirlar ?? []).map((r) =>
        r.tablo.satirlar
          ? r.tablo.satirlar.map(({ konu, sayi }) => ({ konu, sayi }))
          : r.tablo.yok,
      ),
    );
  }

  // 9. Ortalaması olmayan kova "0" DEĞİL "—" gösteriyor.
  const bosKovalar = [K.ozet, ...K.haftalar, ...K.aylar].filter((k) => k.ortalama === null);
  const ekrandakiOrtalamalar = [
    g.ozet.kutular.Ortalama,
    ...(g.haftalik.satirlar ?? []).map((r) => r.kutular.Ortalama),
    ...(g.aylik.satirlar ?? []).map((r) => r.kutular.Ortalama),
  ];
  olc(
    `${ad}: ortalaması olmayan kova "—" gösteriyor`,
    ekrandakiOrtalamalar.filter((o) => o === '—').length === bosKovalar.length,
    `${bosKovalar.length} boş kova, ${ekrandakiOrtalamalar.filter((o) => o === '—').length} tire`,
  );
  olc(
    `${ad}: boş ortalama "0" yazmıyor`,
    bosKovalar.length === 0 || !ekrandakiOrtalamalar.includes('0'),
  );

  // 10. Dil: konu damgası, öğrenci damgası değil.
  olc(`${ad}: yasaklı ifade yok`, !/(başarısız|yetersiz|zayıf öğrenci)/i.test(g.tumMetin));
  olc(
    `${ad}: ölçütü açıklayan dipnot var`,
    /son teslim tarihi geçmiş/.test(g.dipnot) &&
      /açık uçlu ödevin konu eşlemesi yoktur/.test(g.dipnot),
    g.dipnot?.slice(0, 60),
  );

  await s.close();
  return g;
}

const ekranA = await kumeyiOlc('A', A);
const ekranB = await kumeyiOlc('B', B);

console.log('\n— İKİ KÜME GERÇEKTEN AYRIŞTI MI —');
// Bu ölçüm olmadan yukarıdakiler sessizce aynı şeyi iki kez okuyor
// olabilirdi (örneğin yönlendirme çalışmayıp sayfa önbellekten gelseydi).
olc(
  'A ve B farklı sayılar bastı',
  ekranA && ekranB && JSON.stringify(ekranA.ozet) !== JSON.stringify(ekranB.ozet),
);
olc(
  'eşik yüzdesi kümeyle birlikte değişti',
  ekranA?.listeler[0]?.not !== ekranB?.listeler[0]?.not,
  `${ekranA?.listeler[0]?.not} ≠ ${ekranB?.listeler[0]?.not}`,
);

console.log('\n— İSTEKTE TARİH ARALIĞI —');
{
  const { s, istekler } = await analizSayfasi(A);
  const ilk = JSON.parse(istekler.find((i) => i.uc === 'sinif_analizi')?.govde ?? '{}');
  olc('sınıf kimliği gidiyor', ilk.p_sinif_id === '9a');
  olc('varsayılanda tarihler boş gidiyor', ilk.p_baslangic === null && ilk.p_bitis === null);

  await s.getByLabel('Başlangıç').fill('2026-02-10');
  await s.getByLabel('Bitiş').fill('2026-06-20');
  await s.getByRole('button', { name: 'Uygula' }).click();
  await s.waitForTimeout(800);

  const cagrilar = istekler.filter((i) => i.uc === 'sinif_analizi');
  const son = JSON.parse(cagrilar[cagrilar.length - 1]?.govde ?? '{}');
  olc('Uygula yeni istek atıyor', cagrilar.length >= 2, `${cagrilar.length} çağrı`);
  olc('başlangıç gidiyor', son.p_baslangic === '2026-02-10', String(son.p_baslangic));
  olc('bitiş gidiyor', son.p_bitis === '2026-06-20', String(son.p_bitis));

  // Tarih seçiliyken geri dönüş yolu açılmalı, yoksa öğretmen son 12
  // haftaya elle tarih yazmadan dönemez.
  olc(
    '"Son 12 haftaya dön" düğmesi belirdi',
    await s.getByRole('button', { name: /son 12 haftaya dön/i }).isVisible(),
  );
  await s.getByRole('button', { name: /son 12 haftaya dön/i }).click();
  await s.waitForTimeout(600);
  const donus = JSON.parse(
    istekler.filter((i) => i.uc === 'sinif_analizi').pop()?.govde ?? '{}',
  );
  olc(
    'dönüşte tarihler yine boş gidiyor',
    donus.p_baslangic === null && donus.p_bitis === null,
    `${donus.p_baslangic} / ${donus.p_bitis}`,
  );
  await s.close();
}

console.log('\n— 360 px VE YAZDIRMA —');
{
  const { s } = await analizSayfasi(A, 360);
  const olcum = await s.evaluate(() => {
    const kok = document.documentElement;
    const kucuk = [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .map((e) => ({ t: e.textContent?.trim().slice(0, 20), h: e.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44);
    return { tasma: kok.scrollWidth - kok.clientWidth, kucuk };
  });
  olc('360 px yatay taşma yok', olcum.tasma === 0, `${olcum.tasma} px`);
  olc('44 px altı dokunma hedefi yok', olcum.kucuk.length === 0, JSON.stringify(olcum.kucuk));

  await s.emulateMedia({ media: 'print' });
  await s.waitForTimeout(300);
  const kagit = await s.evaluate(() => {
    const gorunur = (sec) =>
      [...document.querySelectorAll(sec)].some((e) => e.offsetParent !== null);
    const yazdirDugmesi = [...document.querySelectorAll('button')].some(
      (b) => b.textContent?.trim() === 'Yazdır' && b.offsetParent !== null,
    );
    const kok = document.querySelector('.sk-analiz');
    return {
      kabuk: gorunur('aside') || gorunur('header') || gorunur('nav'),
      tarihKutulari: gorunur('input[type="date"]'),
      yazdirDugmesi,
      belge: kok?.offsetParent !== null,
      // Kâğıda giden metinde sayılar duruyor mu: yazdırma kipinde gizlenen
      // bir şey varsa öğretmen boş kâğıt basardı.
      ortalamaVar: /71,4/.test(kok?.innerText ?? ''),
    };
  });
  olc('kâğıtta kabuk yok', !kagit.kabuk);
  olc('kâğıtta tarih kutuları yok', !kagit.tarihKutulari);
  olc('kâğıtta "Yazdır" düğmesi yok', !kagit.yazdirDugmesi);
  olc('kâğıtta analiz duruyor', kagit.belge);
  olc('kâğıtta ortalama duruyor', kagit.ortalamaVar);
  await s.emulateMedia({ media: 'screen' });
  await s.close();
}

await tarayici.close();
console.log(`\n--- GEÇEN: ${gecen}   KALAN: ${kalan} ---`);
process.exit(kalan === 0 ? 0 : 1);
