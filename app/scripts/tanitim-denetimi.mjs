/**
 * Tanıtım sayfası denetimi (Faz 9).
 *
 * BU DENETİMİN ASIL İŞİ: sayfanın KENDİ İDDİALARINI ölçmek.
 *
 * Tanıtım sayfası okuyucusuna üç somut söz veriyor — "bu sayfa hiçbir
 * çerez kullanmıyor", "ziyaretçi takibi yapmıyor", "veritabanına hiçbir
 * istek göndermiyor". Bunlar pazarlama cümlesi değil, ölçülebilir
 * iddialar. Ölçülmeyen bir gizlilik iddiası, iddia değil temennidir.
 *
 * Ayrıca video: giriş ekranındaki kural burada da geçerli — 2,5 MB'lik
 * dosya sayfa açılışında İNMEMELİ.
 *
 * ÇALIŞTIRMA (depo kökünden):
 *   npm --prefix app run build
 *   setsid npx --prefix app http-server -p 8788 -s . > /tmp/hs.log 2>&1 < /dev/null &
 *   node app/scripts/tanitim-denetimi.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const TANITIM = 'http://127.0.0.1:8788/yeni/tanitim/';
const GIRIS = 'http://127.0.0.1:8788/yeni/';

let olcum = 0;
let kusur = 0;

/**
 * Türkçe farkında küçültme — VE BU BİR ÖZENTİ DEĞİL, ÖLÇÜLMÜŞ BİR TUZAK.
 *
 * Sayfa bazı etiketleri CSS `text-transform: uppercase` ile çiziyor ve
 * `innerText` DÖNÜŞMÜŞ hâli döndürüyor: "Matematik Öğretmeni" ekrana
 * "MATEMATİK ÖĞRETMENİ" olarak geliyor.
 *
 * JavaScript'in `/…/i` bayrağı basit kıvrım (simple case folding)
 * kullanıyor ve U+0130 (İ) için 'i' karşılığı YOK. Yani
 * `/matematik öğretmeni/i` bu metinle EŞLEŞMİYOR — ölçüm sessizce
 * "cümle sayfada yok" diyor. Bu tuzak bu turda gerçekten yakalandı;
 * 0024'te `toLowerCase()`'in "ALİ"yi birleşen noktalı `ali̇` yapması da
 * aynı ailedendi.
 *
 * `toLocaleLowerCase('tr')` doğru dönüşümü yapıyor (İ → i, I → ı).
 * Büyük/küçük harfe duyarsız arama BU fonksiyondan geçirilerek
 * yapılıyor, `/…/i` ile değil.
 */
function kucult(s) {
  return s.toLocaleLowerCase('tr');
}

function bak(baslik, kosul, ayrinti = '') {
  olcum += 1;
  if (kosul) {
    console.log(`  ✓ ${baslik}${ayrinti ? ' — ' + ayrinti : ''}`);
  } else {
    kusur += 1;
    console.log(`  ✗ ${baslik}${ayrinti ? ' — ' + ayrinti : ''}`);
  }
}

const tarayici = await chromium.launch();

/* ============================================================
   1 — GİZLİLİK İDDİALARI
   ============================================================ */
console.log('\n1. Sayfanın kendi gizlilik iddiaları');
{
  const baglam = await tarayici.newContext();
  const sayfa = await baglam.newPage();

  const disIstekler = [];
  sayfa.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1' && u.protocol !== 'data:') disIstekler.push(r.url());
  });

  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(800);

  bak(
    'Üçüncü tarafa hiç istek gitmiyor',
    disIstekler.length === 0,
    disIstekler.length ? disIstekler.join(', ') : '0 dış istek',
  );

  const supabase = disIstekler.filter((u) => /supabase/.test(u));
  bak('Veritabanına hiç istek gitmiyor', supabase.length === 0, `${supabase.length} istek`);

  const cerezler = await baglam.cookies();
  bak('Hiç çerez yazılmıyor', cerezler.length === 0, `${cerezler.length} çerez`);

  const depolama = await sayfa.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  bak(
    'localStorage / sessionStorage boş',
    depolama.local === 0 && depolama.session === 0,
    `local=${depolama.local} session=${depolama.session}`,
  );

  await baglam.close();
}

/* ============================================================
   2 — VİDEO AÇILIŞTA İNMİYOR
   ============================================================ */
console.log('\n2. Video yükü');
{
  const sayfa = await tarayici.newPage();
  const videoIstekleri = [];
  sayfa.on('request', (r) => {
    if (/\.mp4/.test(r.url())) videoIstekleri.push(r.url());
  });

  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(1200);

  bak(
    'Sayfa açılışında .mp4 indirilmiyor',
    videoIstekleri.length === 0,
    `${videoIstekleri.length} istek`,
  );

  const preload = await sayfa.getAttribute('video', 'preload');
  bak('video preload="none"', preload === 'none', `preload=${preload}`);

  await sayfa.close();
}

/* ============================================================
   3 — TAŞMA VE DOKUNMA HEDEFLERİ
   ============================================================ */
console.log('\n3. Üç genişlikte taşma, dokunma hedefi, görsel alt metni');
for (const genislik of [360, 768, 1280]) {
  const sayfa = await tarayici.newPage({ viewport: { width: genislik, height: 900 } });
  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(600);

  const olcumler = await sayfa.evaluate(() => {
    const tasma = document.documentElement.scrollWidth - document.documentElement.clientWidth;

    // Görünür ve dokunulabilir her öğe 44 px'i geçmeli.
    //
    // ATLAMA BAĞLANTISI HARİÇ — ve bu bir muafiyet değil, ayrı bir ölçüm.
    // "İçeriğe geç" bağlantısı `sr-only` ile 1×1 px'e indirilmiş: gözle
    // görünmüyor, yalnız klavyeyle odaklanınca açılıyor. Gizli hâlinin
    // yüksekliğini dokunma hedefi diye ölçmek yanlış soruyu sormak olurdu;
    // doğru soru "odaklanınca 44 px oluyor mu" ve o aşağıda ayrıca
    // ölçülüyor. Kalıp genel: 1×1 px'e sıkıştırılmış öğeler görsel değil.
    const kucuk = [];
    for (const el of document.querySelectorAll('a[href], button')) {
      if (!el.checkVisibility()) continue;
      const k = el.getBoundingClientRect();
      if (k.width <= 1 && k.height <= 1) continue;
      if (k.height < 44) kucuk.push((el.textContent || '').trim().slice(0, 30) + ` (${Math.round(k.height)}px)`);
    }

    // Her görselin anlamlı bir alt metni olmalı; dekoratif olanlar
    // aria-hidden ile zaten ağaçtan çıkmış oluyor.
    const altsiz = [];
    for (const img of document.querySelectorAll('img')) {
      if (img.closest('[aria-hidden="true"]')) continue;
      if (!img.getAttribute('alt')?.trim()) altsiz.push(img.getAttribute('src'));
    }

    const basliklar = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.tagName);

    return { tasma, kucuk, altsiz, basliklar };
  });

  bak(`${genislik}px yatay taşma 0`, olcumler.tasma === 0, `${olcumler.tasma}px`);
  bak(
    `${genislik}px 44px altı dokunma hedefi yok`,
    olcumler.kucuk.length === 0,
    olcumler.kucuk.join(' · ') || '0 öğe',
  );
  bak(
    `${genislik}px alt metni olmayan görsel yok`,
    olcumler.altsiz.length === 0,
    olcumler.altsiz.join(', ') || '0 görsel',
  );

  if (genislik === 360) {
    const h1 = olcumler.basliklar.filter((t) => t === 'H1').length;
    bak('Sayfada tam bir h1 var', h1 === 1, `${h1} adet`);

    // ATLAMA BAĞLANTISI — yukarıda ölçümden çıkarılan öğenin ASIL testi.
    // Klavyeyle sekmelendiğinde görünür ve tıklanabilir olmalı; olmazsa
    // klavye kullanan biri her seferinde üst çubuğu geçmek zorunda kalır.
    await sayfa.keyboard.press('Tab');
    const atlama = await sayfa.evaluate(() => {
      const el = document.activeElement;
      const k = el.getBoundingClientRect();
      return { metin: (el.textContent || '').trim(), en: k.width, boy: k.height };
    });
    bak(
      'Atlama bağlantısı odaklanınca açılıyor',
      atlama.metin === 'İçeriğe geç' && atlama.boy >= 44 && atlama.en > 1,
      `${atlama.metin} · ${Math.round(atlama.en)}×${Math.round(atlama.boy)}px`,
    );
  }

  await sayfa.close();
}

/* ============================================================
   4 — EKRAN GÖRÜNTÜLERİ GERÇEKTEN YÜKLENİYOR
   ============================================================ */
console.log('\n4. Ekran görüntüleri');
{
  const sayfa = await tarayici.newPage({ viewport: { width: 768, height: 900 } });
  const bozuk = [];
  sayfa.on('response', (r) => {
    if (/tanitim-ekranlar/.test(r.url()) && r.status() >= 400) bozuk.push(r.url());
  });

  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  // Görseller lazy: hepsi görünene kadar sayfayı gez.
  await sayfa.evaluate(async () => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) {
      img.scrollIntoView();
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await sayfa.waitForTimeout(800);

  const durum = await sayfa.evaluate(() =>
    [...document.querySelectorAll('img[src*="tanitim-ekranlar"]')].map((i) => ({
      src: i.getAttribute('src'),
      yuklendi: i.complete && i.naturalWidth > 0,
      en: i.naturalWidth,
      boy: i.naturalHeight,
      // Yer tutucu ölçüsü gerçek ölçüyle aynı mı: değilse metin zıplar.
      bildirilenEn: Number(i.getAttribute('width')),
      bildirilenBoy: Number(i.getAttribute('height')),
    })),
  );

  bak(
    'Altı ekran görüntüsü de sayfada',
    durum.length === 6,
    `${durum.length} görsel`,
  );
  bak('Hiçbiri 404 değil', bozuk.length === 0, bozuk.join(', ') || '0 hata');
  for (const g of durum) {
    const ad = g.src.split('/').pop();
    bak(`${ad} yüklendi`, g.yuklendi, `${g.en}×${g.boy}`);
    bak(
      `${ad} bildirilen ölçü gerçek ölçüyle aynı`,
      g.en === g.bildirilenEn && g.boy === g.bildirilenBoy,
      `bildirilen ${g.bildirilenEn}×${g.bildirilenBoy}`,
    );
  }

  await sayfa.close();
}

/* ============================================================
   5 — İDDİA DENETİMİ: SAYFA ÜRÜNÜN YAPMADIĞI BİR ŞEYİ SÖYLEMİYOR
   ============================================================ */
console.log('\n5. Metindeki iddialar');
{
  const sayfa = await tarayici.newPage();
  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  const metin = (await sayfa.locator('body').innerText()).replace(/\s+/g, ' ');

  /* BULUNMASI GEREKENLER — ürünün gerçek güvenceleri metinde duruyor mu.
   *
   * BU LİSTE BU TURDA YENİLENDİ ve gevşetilmedi. Öğretmenin yeni brief'i
   * savunmacı/olumsuz cümleleri yasakladığı için eski dört desen artık
   * sayfada olmayan cümleleri arıyordu ("…erişemez", "…öğretmende kalır").
   * Her birinin OLUMLU KİPTEKİ karşılığı aşağıda duruyor; yani ölçülen
   * güvence aynı, aranan cümle değişti.
   *
   *   eski: "Ödevini teslim etmeden cevap anahtarına erişemez"
   *   yeni: "Teslimden sonra açılan çözümler"          (Kural 6 / Part XXI)
   *
   *   eski: "son değerlendirme öğretmen tarafından yapılır"
   *   yeni: "Açık uçlu ödevlerde pedagojik değerlendirme kontrolü" (Kural 5)
   */
  bak(
    'anahtarın yalnız teslimden sonra açıldığı yazıyor',
    /Cevap anahtarı teslimden önce açılmaz; teslimden hemen sonra açılır/.test(metin),
  );
  bak(
    'açık uçluda son puanı öğretmenin verdiği yazıyor',
    /nihai puan öğretmen tarafından verilir/.test(metin),
  );
  bak(
    'test puanlamasının kural tabanlı olduğu yazıyor',
    /önceden belirlenmiş kurallar doğrultusunda/.test(metin),
  );
  bak(
    'çözüm fotoğrafının zorunlu olduğu yazıyor',
    /fotoğraf yüklenmeden teslim tamamlanmaz/.test(metin),
  );
  /* Bu bir süsleme değil, ÖLÇÜLMÜŞ bir sınır: `kendi_karnem` ve
   * `veli_paneli` sınıf ortalamasını, sıralamayı ve başka öğrencinin
   * verisini bilerek döndürmüyor (0026/0029) — testleri de bunu
   * doğruluyor. Sayfa o sınırı söylüyor; denetim söylediğini ölçüyor. */
  bak(
    'kıyaslama olmadığı yazıyor',
    /başka öğrencilerin puanları veya sıralamaları gösterilmez/.test(metin),
  );
  /* FELSEFE BAĞI "8 RAKAMI" ÜZERİNDEN — ÖLÇÜM TAŞINDI, GEVŞETİLMEDİ.
   *
   *   eski: "matematiğin sonsuzluk fikrinden ilham alır"
   *   yeni: "8 rakamından alır"
   *
   * İddia aynı: sayfa ismin arkasındaki matematiksel bağı gerçekten
   * kuruyor mu. Değişen, öğretmenin bu turdaki talimatı — bağ SAYI
   * üzerinden anlatılacak. "8 şeklinden" yasaklı desen olarak aşağıda. */
  bak('8 → sonsuzluk bağı 8 RAKAMI üzerinden kuruluyor', /8 rakam/.test(metin));
  bak('gelecek vizyonu bölümü var', /SEKİZ gelişmeye devam ediyor/.test(metin));

  /* BU TURDA GELEN İKİ YENİ BÖLÜM ve hero'nun künye satırı.
   * Üçü de brief'in açık maddeleri; silinirse denetim kırılır. */
  bak('"SEKİZ neden var?" bölümü var', /SEKİZ neden var\?/.test(metin));
  bak('"Sınıftan doğdu." bölümü var', /Sınıftan doğdu\./.test(metin));
  bak(
    'hero künye satırı: fikir + pedagojik tasarım + yazılım geliştirme',
    /Fikir, pedagojik tasarım ve yazılım geliştirme/.test(metin),
  );
  /* KÜNYE BÖLÜMÜNÜN KENDİ METNİ ÖLÇÜLÜYOR, sayfanın tamamı değil.
   *
   * Sayfada bir yerde "matematik öğretmeni" geçmesi yetmez — hikâye
   * bölümü zaten öyle diyor ve o ölçüm ayrıca duruyor. Burada sorulan
   * şey künye bloğunun gerçekten künye olup olmadığı: ad, unvan ve
   * rolün kapsamı bir arada mı.
   *
   * Unvan `uppercase` ile çiziliyor ve `innerText` dönüşmüş hâli
   * döndürüyor; ölçüm o yüzden büyük/küçük harfe bakmıyor. */
  const kunyeMetni = await sayfa.evaluate(() => {
    const b = [...document.querySelectorAll('h2')].find((h) =>
      /arkasındaki yaklaşım/.test(h.textContent || ''),
    );
    // `innerText` satır sarmalarını \n olarak döndürüyor; boşluk
    // normalize edilmezse aranan cümle kelimenin ortasından bölünmüş
    // hâlde geliyor ve ölçüm sessizce yanlış sonuç veriyor.
    return (b?.closest('section')?.innerText ?? '').replace(/\s+/g, ' ');
  });
  bak(
    'künyede ad, unvan ve rolün kapsamı bir arada',
    /Buket Topuzoğlu/.test(kunyeMetni) &&
      kucult(kunyeMetni).includes('matematik öğretmeni') &&
      kucult(kunyeMetni).includes('fikir, pedagojik tasarım ve yazılım geliştirme'),
    `${kunyeMetni.length} karakter`,
  );

  /* META AÇIKLAMA SAYFAYLA AYNI ŞEYİ SÖYLEMELİ.
   *
   * ÖLÇÜLEN BİR ÇELİŞKİYDİ: `tanitim/index.html` SEKİZ'i "matematik
   * ödevleri için kurulmuş bir uygulama" diye tanıtıyordu, oysa sayfanın
   * ilk cümlesi bunu değil bir öğrenme platformunu anlatıyor. Arama
   * sonucunda ve paylaşım kartında görünen cümle burasıdır; sayfayla
   * ayrıştığı anda ziyaretçi iki farklı ürün okumuş olur.
   *
   * `innerText` meta etiketlerini görmez, o yüzden ayrıca okunuyor. */
  const metalar = await sayfa.evaluate(() => ({
    aciklama: document.querySelector('meta[name="description"]')?.content ?? '',
    og: document.querySelector('meta[property="og:description"]')?.content ?? '',
    baslik: document.title,
  }));
  bak(
    'meta açıklama "öğrenme platformu" diyor',
    /öğrenme platformu/i.test(metalar.aciklama),
    metalar.aciklama.slice(0, 60) + '…',
  );
  bak(
    'meta açıklama eski konumlandırmayı taşımıyor',
    !/ödevleri için kurulmuş bir uygulama/i.test(metalar.aciklama),
  );
  bak(
    'og açıklamasında veli SÜRECE DAHİL olan taraf',
    /sürece dahil olur/i.test(metalar.og) && !/gidişatını izler/i.test(metalar.og),
    metalar.og.slice(0, 60) + '…',
  );
  bak('sayfa başlığı korundu', metalar.baslik.startsWith('SEKİZ nedir?'), metalar.baslik);
  bak(
    'ekran görüntülerinin temsilî olduğu yazıyor',
    /isimler ve puanlar temsilidir/.test(metin),
  );

  /* ÇEREZ CÜMLESİ ARTIK ARANMIYOR — ve bu bir gevşetme değil.
   *
   * Öğretmen "Eğitimde güven" bölümünü tamamen kaldırdı; içindeki
   * "çerez kullanmaz ve ziyaretçi takibi yapmaz" cümlesi de onunla
   * birlikte gitti. Ama GÜVENCE yerinde: bu denetimin 1. grubu çerez
   * sayısını ve sayfanın attığı dış istekleri DAVRANIŞ olarak ölçüyor
   * ve sıfır olmadığı anda kırılıyor.
   *
   * Yani sayfa artık bir şey söylemiyor, ama söylenmeyen şey hâlâ
   * doğru ve hâlâ ölçülüyor. Kaldırılan tek şey cümle. */

  /* BULUNMAMASI GEREKENLER — bugün YAPILMAYAN şeyler. */
  const yasakli = [
    ['çevrimdışı', /çevrimdışı/i],
    ['bildirim gönderme vaadi', /bildirim gönder/i],
    ['yapay zekâ destekli', /yapay zekâ destekli|AI destekli/i],
    ['otomatik konu önerisi', /konuları otomatik|yapay zekâ.{0,20}öner/i],
  ];
  for (const [ad, kalip] of yasakli) {
    bak(`"${ad}" iddiası YOK`, !kalip.test(metin));
  }

  /* -------------------------------------------------------------------
   * EDİTORYAL KURALLAR — öğretmenin brief'inde AÇIKÇA yasakladıkları.
   *
   * Yazılı ama ölçülmeyen bir kural, ilk aceleci düzenlemede geri gelir.
   * Üçü de brief'te "kesinlikle kullanma" diye geçiyor.
   * ----------------------------------------------------------------- */
  const yasakliMarka = [
    ['yan yat', /yan yat/i],
    ['yan çevir', /yan çevir/i],
    ['sonsuzluk işareti', /sonsuzluk işaret/i],
    ['sonsuzluk sembolü', /sonsuzluk sembol/i],
    ['ufukların ötesi', /ufuk(ların|un) ötesi/i],
    ['sınırsız yolculuk', /sınırsız yolculuk/i],
    ['sonsuz keşifler', /sonsuz keşif/i],
    // "Veli süreci görür, öğrencinin yerine geçmez." — brief: KULLANMA.
    ['velinin yerine geçmez kalıbı', /yerine geçmez/i],
    // Negatif Ewalu paragrafı — brief: yazma.
    ['negatif Ewalu kalıbı', /Ewalu (ödev değerlendirmez|puan vermez|karar vermez)/i],
  ];
  for (const [ad, kalip] of yasakliMarka) {
    bak(`editoryal: "${ad}" geçmiyor`, !kalip.test(metin));
  }

  /* -------------------------------------------------------------------
   * BU TURUN BEŞ KARARINI KİLİTLEYEN YASAKLAR.
   *
   * Hepsi öğretmenin bu turda verdiği kararlar. Yazılı ama ölçülmeyen bir
   * karar, ilk aceleci düzenlemede geri gelir.
   * ----------------------------------------------------------------- */
  const turKararlari = [
    // "İsveç merkezli Supabase" iddiası ÖLÇÜLDÜ ve doğrulanmadı: bölge
    // Zürih (eu-central-2), yani İSVİÇRE. Yasak olan yanlış ülke.
    ['İsveç', /İsveç(?!re)/],
    // GÜVEN BÖLÜMÜ KALKTI. Öğretmen barındırma altyapısını, bölgeyi ve
    // yetkili erişim notunu tanıtım sayfası için gereksiz buldu. Yasak
    // kararı kilitliyor: bir gün "biraz teknik güven verelim" diye geri
    // eklenirse denetim kırılır.
    //
    // NOT — bu karar bir tur boyunca ters yönde durmuştu (o turda cümle
    // bilerek yazdırılmıştı). Fikir değişirse kaldırılacak yer bu üç
    // satır; sessizce geri gelmesin diye buraya yazıldı.
    ['barındırma altyapısı adı', /Supabase/i],
    ['barındırma bölgesi', /Zürih|İsviçre/i],
    ['kalkan güven bölümü', /Eğitimde güven/i],
    // Öğretmenin kelime kararı: "bütünleşik" değil "bütünsel".
    ['bütünleşik', /bütünleşik/i],
    // Ekran altyazısında "uydurma" profesyonel durmuyor: "temsilidir".
    ['uydurmadır', /uydurmadır/i],
    // SAVUNMACI KALIP. "Veri öğretmenin yerini almaz" cümlesi kaldırıldı;
    // sayfa verinin ne YAPMADIĞINI değil ne yaptığını söylüyor.
    ['veri yerini almaz kalıbı', /yerini alma/i],
    // Ewalu bir çizim + puan aralığına göre cümle seçen kural kümesi;
    // yapay zekâ değil (Kural 5). "AI üzerinden pazarlama" da yasak.
    ['akıllı maskot/asistan', /akıllı\s+(maskot|asistan)/i],
    // Kural 18: kullanıcıya görünen metin Türkçe.
    ['Bosphorus', /Bosphorus/i],
    // Sistemde üç rol var. Dördüncü bir giriş vaat edilmiyor.
    ['dördüncü bir giriş vaadi', /(okul yönetimi|yönetici|kurum)\s+girişi|kurum panosu/i],
  ];
  for (const [ad, kalip] of turKararlari) {
    bak(`tur kararı: "${ad}" geçmiyor`, !kalip.test(metin));
  }

  /* -------------------------------------------------------------------
   * PROFESYONELLEŞTİRME TURUNUN YASAKLARI.
   *
   * Hepsi öğretmenin bu turdaki brief'inde AÇIKÇA yazılı. İkisi
   * özellikle önemli:
   *
   *  1. "Sonsuzluk bir varış değil, bir yöndür" — bu cümleyi bir önceki
   *     turda ben taslak olarak yazmıştım ve öğretmen ONAYLAMIŞTI.
   *     Şimdi açıkça geri çekti. Onaylanmış bir cümlenin geri çekilmesi
   *     tam olarak sessizce geri gelebilecek türden bir karardır; bu
   *     yüzden yasaklı desen olarak buraya yazıldı.
   *
   *  2. "8 şeklinden" — bağ bir çizim benzerliğinden değil, sayının
   *     matematikteki çağrışımından kuruluyor. Yukarıdaki olumlu ölçüm
   *     ("8 rakam") ile birlikte iki yönlü çalışıyor: bağ VAR ama şekil
   *     üzerinden DEĞİL.
   * ----------------------------------------------------------------- */
  const briefYasaklari = [
    ['geri çekilen felsefe cümlesi', /Sonsuzluk bir varış değil/i],
    ['8 şeklinden', /8\s*şeklinden|şeklinden (alır|esinlen|ilham)/i],
    // Abartılı pazarlama sıfatları — brief: "kesinlikle kullanma".
    ['devrim dili', /devrim|çığır açan|benzersiz|oyunun kurallarını değiştiren/i],
    ['geleceği ilan eden dil', /geleceğin eğitimi|eğitimde yeni çağ|dünyayı değiştiren/i],
    ['mükemmellik iddiası', /mükemmel|eşsiz/i],
    // Öğretmeni öven sıfat. Yazarlık anlatılıyor, öğretmen övülmüyor.
    ['vizyoner/benzersiz öğretmen', /(vizyoner|benzersiz|geleceği değiştiren)\s+(öğretmen|eğitimci)/i],
    // Klişe. Brief: "Öğrenme bir yolculuktur" gibi ifadeler kullanılmayacak.
    ['yolculuk klişesi', /öğrenme bir yolculuk/i],
    // Kapanışta OLUMSUZ TANIMLAMA yasak: SEKİZ ne OLDUĞUYLA anlatılıyor.
    ['olumsuz kapanış tanımı', /sadece bir ödev takip uygulaması değil/i],
    // Veliye seslenirken "çocuğunuzun eksikleri" çağrışımı yasak.
    ['çocuğunuzun eksikleri', /çocuğunuzun eksik/i],
  ];
  for (const [ad, kalip] of briefYasaklari) {
    bak(`brief: "${ad}" geçmiyor`, !kalip.test(metin));
  }

  /* -------------------------------------------------------------------
   * DİL KURALI: GERÇEĞİ GİZLEME · ÖĞRENCİYİ ETİKETLEME · GELİŞİMİ GÖSTER
   *
   * İKİ YÖNLÜ ÖLÇÜM ve ikinci yön en az birincisi kadar önemli.
   *
   * Öğretmen ilk brief'inde "yanlış" ve "eksik" kelimelerini de
   * yumuşatmamı istemiş, sonra bunu AÇIKÇA geri almıştı: "Yanlış
   * kelimesini her durumda daha yumuşak bir ifadeyle değiştirmeye
   * çalışma." ve "Eksikliği tamamen gizleyen ... metinler
   * kullanılmayacak."
   *
   * Bu yüzden aşağıda hem yasaklı etiketler aranıyor HEM DE gerçeği
   * söyleyen kelimelerin sayfada DURDUĞU ölçülüyor. Biri bir gün
   * "daha pozitif olsun" diye onları silerse denetim kırılır.
   * ----------------------------------------------------------------- */
  const etiketler = [
    ['başarısız', /başarısız/i],
    ['yetersiz', /yetersiz/i],
    ['zayıf', /zayıf/i],
    ['kaygı', /kaygı/i],
    ['baskı', /baskı(?![a-zçğıöşü])/i],
  ];
  for (const [ad, kalip] of etiketler) {
    bak(`etiket yok: "${ad}"`, !kalip.test(metin));
  }

  bak('gerçek korunuyor: "yanlış yaptığı sorular" yazıyor', /[Yy]anlış yaptığı soruları/.test(metin));
  bak('gerçek korunuyor: "eksik olduğu konu alanları" yazıyor', /eksik olduğu konu alanları/.test(metin));

  /* TAMAMLANMAMIŞ ÖDEV — ÖLÇÜM TAŞINDI, GEVŞETİLMEDİ.
   *
   * Brief iki cümleyi birden düzeltti:
   *   öğrenci:  "…teslim edilmeyi bekleyenleri takip eder."
   *          →  "…tamamlaması gereken ve sıradaki çalışmalarını…"
   *   öğretmen: "…hangi ödevin henüz teslim edilmediğini görür."
   *          →  "…hangi ödevlerin henüz tamamlanmadığını görür."
   *
   * Eski desen (`teslim edilmedi|teslim edilmeyi bekleyen`) artık
   * sayfada olmayan bir cümleyi arıyordu. İDDİA AYNI ve kalıcı dil
   * kuralının sayfadaki kilidi olmayı sürdürüyor: tamamlanmamış ödev
   * gizlenmiyor, iki ayrı yerde AÇIKÇA anlatılıyor. İkisi de ayrı ayrı
   * ölçülüyor ki biri silinince öbürü örtmesin. */
  bak(
    'gerçek korunuyor: öğrencinin tamamlaması gerekenler anlatılıyor',
    /tamamlaması gereken/.test(metin),
  );
  bak(
    'gerçek korunuyor: tamamlanmamış ödev öğretmene anlatılıyor',
    /henüz tamamlanmadığını/.test(metin),
  );

  /* VELİ BÖLÜMÜNDE "EKSİK" YOK — AMA SAYFADA VAR. İKİ YÖNLÜ KİLİT.
   *
   * Öğretmenin kararı bir KAPSAM kararı, bir dil değişikliği değil:
   * "Yalnız veli bölümünde kalksın." Veliye seslenen cümlelerde
   * "çocuğunuzun eksikleri" çağrışımı istemiyor; ama öğrenciyi anlatan
   * koyu banttaki "eksik olduğu konu alanları" kalıcı dil kuralının
   * kapsamında ve AYNEN duruyor.
   *
   * Tek yönlü ölçmek yetmez ve bu bilerek böyle kuruldu:
   *   • yalnız "veli bölümünde eksik yok" ölçseydik, biri bir gün
   *     kelimeyi sayfanın HER YERİNDEN silerdi ve denetim geçerdi;
   *   • yalnız "sayfada eksik var" ölçseydik, veli bölümüne geri
   *     gelmesi fark edilmezdi.
   * İkisi birlikte kararı tam olarak kilitliyor. Yukarıdaki
   * "eksik olduğu konu alanları" ölçümü bu çiftin ikinci yarısı. */
  const veliMetni = await sayfa.evaluate(() => {
    const b = [...document.querySelectorAll('h2')].find((h) =>
      /Öğrenme sürecine aile de eşlik eder/.test(h.textContent || ''),
    );
    // `innerText` satır sarmalarını \n olarak döndürüyor; boşluk
    // normalize edilmezse aranan cümle kelimenin ortasından bölünmüş
    // hâlde geliyor ve ölçüm sessizce yanlış sonuç veriyor.
    return (b?.closest('section')?.innerText ?? '').replace(/\s+/g, ' ');
  });
  bak(
    'veli bölümü gerçekten bulundu',
    /Öğrenme sürecine aile de eşlik eder/.test(veliMetni),
    `${veliMetni.length} karakter`,
  );
  bak(
    'veli bölümünün KENDİ metninde "eksik" geçmiyor',
    // `/eksik/i` "EKSİK" ile EŞLEŞMEZ (İ tuzağı, yukarıdaki `kucult`
    // açıklaması). Bu ölçüm bir YOKLUK ölçtüğü için tuzak burada en
    // tehlikeli hâlinde: yanlış eşleşme sessizce "temiz" derdi.
    veliMetni.length > 0 && !kucult(veliMetni).includes('eksik'),
    (veliMetni.match(/[^.]*eksik[^.]*\./i) || ['—'])[0].trim().slice(0, 70),
  );

  /* VELİ "DAHİL OLAN" TARAFTIR — iki yerde, ikisi de ölçülüyor.
   *
   * Öğretmenin gerekçesi kelime tercihinden ibaret değil: veli
   * öğretmenden pay alan ya da onun yerine geçen biri gibi
   * görünmemeli. "Destek olur" bu izlenimi veriyordu. Biri bir gün
   * eski hâline döndürürse denetim kırılır. */
  bak('hero: velinin sürece DAHİL olduğu yazıyor', /velinin sürece dahil olduğu/.test(metin));
  bak('rol satırı: veli sürece DAHİL olur', /sürece dahil olur/.test(metin));

  /* Öğretmen iki ölçekte birden görüyor: sınıf VE tek tek öğrenci.
   * Ürün ikisini de veriyor (`konu_karnesi`, 0023). */
  bak('öğretmen her öğrencinin gelişimini de görüyor', /her öğrencinin gelişimini/.test(metin));

  /* MARKA CÜMLESİ TAM İKİ YERDE — hero'da H1 ve kapanışta son söz.
   *
   * Üçtü; öğretmenin düzeltmesiyle felsefe bölümündeki tekrarı kalktı
   * ("en üstte zaten kullandık"). Sayı ölçülüyor ki ne düşsün ne
   * çoğalsın: üçüncü bir yere serpiştirilirse cümle sıradanlaşır. */
  const markaAdet = (metin.match(/Öğrenmenin sonu yok\./g) || []).length;
  bak('marka cümlesi tam iki yerde', markaAdet === 2, `${markaAdet} kez`);

  /* FELSEFE VURGU CÜMLESİ — ÖLÇÜM TAŞINDI.
   *
   * Bir önceki tur "Sonsuzluk bir varış değil, bir yöndür…" cümlesini
   * ölçüyordu; öğretmen bu turda o cümleyi açıkça geri çekti ve yerine
   * geçen cümle ölçülüyor. Eski cümle ayrıca YASAKLI desen olarak
   * duruyor — yani bu iki ölçüm birlikte hem yeninin durduğunu hem
   * eskinin geri gelmediğini kilitliyor.
   *
   * Şekil bilgisi yok: "yan yat", "sonsuzluk işareti", "8 şeklinden"
   * hepsi yasaklı desen olarak ayrıca aranıyor. */
  bak(
    'felsefe vurgu cümlesi yerinde',
    /Çözülen her problem, sorulacak yeni bir soruyu mümkün kılar/.test(metin),
  );

  /* OKUL ADI ARTIK GÖRÜNÜR METİNDE DEĞİL — MÜHÜRÜN ALT METNİNDE.
   *
   * Öğretmenin kararı: "Mühür yeter, yazı kalksın." Mührün kendi
   * halkasında okul adı ve BEŞİKTAŞ zaten yazılı, yani kurum görsel
   * olarak tanınıyor.
   *
   * Ama halkadaki yazı bir GÖRSEL; ekran okuyucu onu okuyamaz. Bu
   * yüzden mühür artık `dekoratif` değil ve `alt` okulun tam adını
   * taşıyor. Ölçüm oraya taşındı: iddia aynı ("bu sayfa okulu
   * tanıtıyor"), ölçülen yer değişti.
   *
   * `innerText` alt metnini görmez, o yüzden ayrıca okunuyor. */
  const muhurAlt = await sayfa.evaluate(
    () => document.querySelector('img[src*="okul-muhru"]')?.getAttribute('alt') ?? '',
  );
  bak(
    'okul adı mührün alt metninde',
    /Arnavutköy Korkmaz Yiğit Anadolu Lisesi/.test(muhurAlt),
    muhurAlt || '(boş)',
  );
  /* Ve mühür DEKORATİF DEĞİL. Biri bir gün `dekoratif` propunu geri
   * koyarsa `alt` boşalır, `aria-hidden` gelir ve okul adı ekran
   * okuyucudan SESSİZCE düşer — sayfada başka hiçbir yerde yazmadığı
   * için de kimse fark etmez. Bu ölçüm tam olarak onu yakalıyor. */
  const muhurGizli = await sayfa.evaluate(
    () => document.querySelector('img[src*="okul-muhru"]')?.getAttribute('aria-hidden') ?? null,
  );
  bak('mühür ekran okuyucudan gizlenmiyor', muhurGizli === null, `aria-hidden=${muhurGizli}`);
  /* "Matematik Öğretmeni" başlığı hero'dan kalktı (mühürün altında ada
   * ikinci kez yer vermek tekrardı). Kimlik hâlâ sayfada ve hâlâ
   * ölçülüyor — hikâye bölümü "matematik öğretmeni Buket Topuzoğlu"
   * diyor. Ölçüm küçük harfe de bakıyor; iddia aynı, yeri değişti. */
  bak(
    'öğretmen kimliği sayfada',
    /Buket Topuzoğlu/.test(metin) && kucult(metin).includes('matematik öğretmeni'),
  );

  /* YAZARLIK — sayfanın söylemesi gereken şey. Öğretmenin isteği:
   * SEKİZ'i tasarlayanın bir yazılım şirketi değil kendisi olduğu
   * anlaşılsın. Cümle silinirse denetim kırılır. */
  bak(
    'SEKİZ\'i kimin tasarladığı yazıyor',
    /fikir olarak da yazılım olarak da tasarlayan/.test(metin),
  );

  await sayfa.close();
}

/* ============================================================
   6 — BÖLÜM RİTMİ VE GÖRSEL DAĞILIMI

   Öğretmenin brief'i yalnız metinleri değil SIRAYI da belirliyor
   (20. madde): felsefe → öğrenci → öğretmen → veli → Ewalu → gelişim →
   gelecek → kurucusu → kapanış. Sıra bir tercih değil anlatının kendisi;
   biri bir bölümü yukarı taşırsa sayfa başka bir şey anlatmaya başlar.
   Bu yüzden sıra ÖLÇÜLÜYOR, gözle bırakılmıyor.
   ============================================================ */
console.log('\n6. Bölüm ritmi ve görsel dağılımı');
{
  const sayfa = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(400);

  /* BU TURDA SIRA 12 → 14 BÖLÜM. Üç değişiklik, üçü de brief'in maddesi:
   *   1. Başa "SEKİZ neden var?" girdi — problemi anlatan kısa bölüm.
   *      Ziyaretçi çözümü okumadan önce soruyu okuyor.
   *   2. "Bir öğretmenin gerçek sınıf deneyiminden doğdu." başlığı
   *      "Sınıftan doğdu." oldu. Bölüm yerinde, yalnız başlık kısaldı.
   *   3. Sona "SEKİZ'in arkasındaki yaklaşım" künyesi eklendi.
   *
   * Liste GEVŞETİLMEDİ, uzadı: sıra hâlâ birebir ölçülüyor. */
  const BEKLENEN = [
    'SEKİZ neden var?',
    'Sınıftan doğdu.',
    'Öğrenme bir sonuç değil, devam eden bir süreçtir.',
    'Ödevden gelişime, öğrenmenin tamamı tek yerde.',
    'Öğrenci kendi öğrenme sürecini görür.',
    'Öğretmen yalnızca sonucu değil, öğrenmenin gelişimini görür.',
    'Sonuç, öğrenmenin bir sonraki adımını gösterir.',
    'Öğrenme sürecine aile de eşlik eder.',
    'Öğrenme, iletişimle güçlenir.',
    "SEKİZ'in öğrenme sürecindeki dijital yüzü.",
    'Değerlendirme, öğrenmeyi görünür kılar.',
    'Puanın ötesinde, gelişim.',
    'SEKİZ gelişmeye devam ediyor.',
    "SEKİZ'in arkasındaki yaklaşım",
  ];

  const basliklar = await sayfa.evaluate(() =>
    [...document.querySelectorAll('h2')].map((h) => (h.textContent || '').trim()),
  );

  bak('Bölüm sayısı beklenen', basliklar.length === BEKLENEN.length,
    `${basliklar.length} h2 (beklenen ${BEKLENEN.length})`);
  const sirali = basliklar.length === BEKLENEN.length &&
    BEKLENEN.every((b, i) => basliklar[i] === b);
  bak('Bölümler beklenen SIRADA', sirali,
    sirali ? 'birebir' : `ilk sapma: ${basliklar.find((b, i) => b !== BEKLENEN[i]) ?? '—'}`);

  /* HERO'DA TEK BÜYÜK CÜMLE: marka cümlesi h1. Brief 20. madde ilk
   * ekranda yalnız birkaç temel şeyin görünmesini istiyor. */
  const h1 = (await sayfa.locator('h1').innerText()).trim();
  bak('Hero başlığı marka cümlesi', h1 === 'Öğrenmenin sonu yok.', h1);

  /* KURUM KİMLİĞİ SAYFANIN İLK ŞEYİ — ve bu bir yerleşim tercihi değil,
   * öğretmenin açık talimatı: "en üstte logo, altında öğretmen ismi ve
   * okul ilçe il adı olmalı."
   *
   * Metnin sayfada BİR YERDE geçmesi yetmez (5. grup onu ölçüyor);
   * burada ölçülen KONUM: üçü de ilk bölümün içinde mi. Biri künyeye
   * geri taşınırsa 5. grup geçmeye devam eder, bu ölçüm kırılır. */
  const ilkBolum = await sayfa.evaluate(
    () => document.querySelector('main section')?.textContent ?? '',
  );
  /* Ad hero'da HÂLÂ var — ama artık ayrı bir satır olarak değil,
   * `SekizWordmark`ın altındaki "Buket Topuzoğlu · Matematik" olarak.
   * Ölçüm ayakta: marka bloğu bir gün adsız bırakılırsa kırılır.
   *
   * OKUL ADI VE KONUM ÖLÇÜMLERİ BURADAN KALKTI — metin olarak artık
   * hero'da yok (öğretmenin kararı: "Mühür yeter, yazı kalksın").
   * Karşılıkları 5. grupta duruyor: ad mührün `alt` metninde ölçülüyor
   * ve mührün gizlenmediği ayrıca kontrol ediliyor. Sessizce
   * gevşetilmiş bir ölçüm yok. */
  bak('Hero: öğretmen adı ilk bölümde', /Buket Topuzoğlu/.test(ilkBolum));

  /* Mühür de ilk bölümde — metin ölçümü onu yakalamaz (görsel). */
  const heroMuhur = await sayfa.evaluate(
    () => document.querySelectorAll('main section:first-of-type img[src*="okul-muhru"]').length,
  );
  bak('Hero: okul mührü ilk bölümde', heroMuhur === 1, `${heroMuhur} adet`);

  /* MÜHÜR TAM BİR KEZ. Künyeden kalktı, hero'ya geçti. İkisinde birden
   * durursa tekrar öğesine dönüşür; hiç durmazsa kurum kimliği kaybolur.
   * Kural 8: mühür yeniden çizilmiyor, yalnız yeri değişiyor. */
  const muhurAdet = await sayfa.evaluate(
    () => document.querySelectorAll('img[src*="okul-muhru"]').length,
  );
  bak('Okul mührü tam bir kez', muhurAdet === 1, `${muhurAdet} adet`);

  /* GÖRSEL DAĞILIMI. Altı ekranın üçe bölünmesi anlatının parçası:
   * her rol bölümünde iki ekran. Hepsi tek bir yere yığılsaydı
   * öğretmen ve veli bölümleri metin duvarı olarak kalırdı. */
  const dagilim = await sayfa.evaluate(() =>
    [...document.querySelectorAll('section')]
      .map((b) => b.querySelectorAll('img[src*="tanitim-ekranlar"]').length)
      .filter((n) => n > 0),
  );
  bak('Üç bölümde ekran var', dagilim.length === 3, `${dagilim.length} bölüm`);
  bak('Her birinde ikişer ekran', dagilim.every((n) => n === 2), dagilim.join('/'));

  /* GERÇEK ÜRÜN GÖSTERİLİYOR — ve olmayan bir ekran uydurulmuyor:
   * sayfadaki her görsel `tanitim-gorselleri.mjs`'in ürettiği dosya. */
  const dosyalar = await sayfa.evaluate(() =>
    [...document.querySelectorAll('img[src*="tanitim-ekranlar"]')].map((i) =>
      (i.getAttribute('src') || '').split('/').pop(),
    ),
  );
  const BEKLENEN_DOSYA = [
    'ogrenci.webp', 'ogrenci-sonuc.webp',
    'ogretmen.webp', 'ogretmen-sinif.webp',
    'veli.webp', 'ogrenci-konular.webp',
  ].sort();
  bak('Görseller üretilen altı dosya', 
    JSON.stringify([...dosyalar].sort()) === JSON.stringify(BEKLENEN_DOSYA),
    dosyalar.join(', '));

  await sayfa.close();
}

/* ============================================================
   7 — GİRİŞ EKRANIYLA BAĞ
   ============================================================ */
console.log('\n7. Giriş ekranı bağlantısı');
{
  const sayfa = await tarayici.newPage({ viewport: { width: 360, height: 900 } });
  await sayfa.goto(GIRIS, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(500);

  const bag = sayfa.locator('a[href="/yeni/tanitim/"]');
  const adet = await bag.count();
  bak('Giriş ekranında tanıtım bağlantısı var', adet === 1, `${adet} adet`);

  if (adet === 1) {
    const kutu = await bag.boundingBox();
    const formKutu = await sayfa.locator('form').boundingBox();
    const formSonu = formKutu.y + formKutu.height;
    const mesafe = Math.round(kutu.y - formSonu);
    bak(
      'Bağlantı giriş formunun AŞAĞISINDA',
      kutu.y > formSonu,
      `bağlantı ${Math.round(kutu.y)}px · form sonu ${Math.round(formSonu)}px`,
    );

    /* BAĞLANTI DÜĞMEYE YAKIN — ve bu bir estetik tercih değil, ölçülmüş
     * bir kusurun düzeltmesi. Eskiden sayfanın en altındaydı: videonun
     * da altında, "Giriş yap" düğmesinden ~600 px aşağıda. Öğretmenin
     * ifadesi: "çok küçük kalıyor, insanlar bunu görmez."
     *
     * Sınır 120 px: düğmenin hemen altındaki bir dipnotu geçirir, ama
     * bağlantı bir gün tekrar videonun altına kayarsa denetim kırılır.
     * Bu, bir sayı değil bir kararın kilidi. */
    bak(
      'Bağlantı "Giriş yap" düğmesine YAKIN',
      mesafe <= 120,
      `form sonuna ${mesafe}px`,
    );
    bak('Bağlantı 44px dokunma hedefi', kutu.height >= 44, `${Math.round(kutu.height)}px`);
  }

  // Tanıtım sayfasından giriş ekranına dönüş yolu
  const geri = await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  bak('Tanıtım sayfası 200 dönüyor', geri.status() === 200, String(geri.status()));
  const donus = await sayfa.locator('a[href="/yeni/"]').count();
  bak('Tanıtımdan girişe dönüş bağlantısı var', donus >= 1, `${donus} adet`);

  await sayfa.close();
}

/* ============================================================
   8 — SESSİZ TAZELEME (bayat önbellek)

   Öğretmen yeni tasarımı göremedi. Ölçüm: sayfa yayında doğruydu, ama
   GitHub Pages HTML'i `max-age=600` ile gönderdiği için tarayıcı 10
   dakika eski HTML'i veriyordu ve o HTML dosya adı hash'li ESKİ paketi
   çağırıyordu.

   Uygulamada bu iş `SurumSeridi` ile çözülmüştü; tanıtım sayfası
   uygulamadan hiçbir şey içe aktarmadığı için buraya bağlanmamıştı.
   Aşağısı yeni davranışın gerçekten çalıştığını ölçüyor — ve en önemlisi,
   SONSUZ DÖNGÜYE girmediğini.
   ============================================================ */
console.log('\n8. Sessiz tazeleme');
{
  const { readFile } = await import('node:fs/promises');
  const kendiSurum = JSON.parse(
    await readFile(new URL('../../yeni/surum.json', import.meta.url), 'utf8'),
  ).surum;

  /** Sayfayı açar; `surum` verilirse surum.json onu döndürür (yoksa 404). */
  async function ac(surum) {
    const s = await tarayici.newPage();
    const belgeler = [];
    // Ana belge isteklerini sayıyoruz: tazelemenin KAÇ KEZ olduğu bu.
    s.on('request', (r) => {
      if (r.resourceType() === 'document') belgeler.push(r.url());
    });
    await s.route('**/surum.json', (r) =>
      surum === undefined
        ? r.fulfill({ status: 404, body: 'yok' })
        : r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ surum }),
          }),
    );
    await s.goto(TANITIM, { waitUntil: 'networkidle' });
    // Tazeleme olacaksa ilk saniyede olur; ikinci bir tur için pay bırak.
    await s.waitForTimeout(2500);
    return { s, belgeler };
  }

  /* AYNI SÜRÜM → HİÇ YÖNLENDİRME YOK.
     Bu ölçüm olmadan diğerleri boş: her koşulda yönlendiren bir kod da
     "farklı sürümde yenileniyor" testini geçerdi. */
  {
    const { s, belgeler } = await ac(kendiSurum);
    const adres = s.url();
    bak(
      'Aynı sürümde tazeleme YOK',
      !adres.includes('?s=') && belgeler.length === 1,
      `${belgeler.length} belge · ${adres.split('/yeni')[1]}`,
    );
    await s.close();
  }

  /* FARKLI SÜRÜM → BİR KEZ TAZELENİYOR, sayfa açık kalıyor. */
  {
    const { s, belgeler } = await ac('99999999999999');
    const adres = s.url();
    bak(
      'Farklı sürümde adres ?s ile tazeleniyor',
      adres.includes('s=99999999999999'),
      adres.split('/yeni')[1],
    );
    /* SONSUZ DÖNGÜ KİLİDİ. surum.json ISRARLA farklı dönüyor (yayın yarım
       kalmış gibi). Kilit olmasaydı sayfa kendini sonsuza kadar yeniden
       yüklerdi; belge sayısı 2'de kalmalı. */
    bak(
      'SONSUZ DÖNGÜ YOK — en fazla bir tazeleme',
      belgeler.length === 2,
      `${belgeler.length} belge yüklemesi`,
    );
    const basliklar = await s.locator('h1').count();
    bak('Tazelemeden sonra sayfa açık', basliklar === 1, `${basliklar} h1`);
    await s.close();
  }

  /* surum.json OKUNAMIYOR → sayfa normal açılıyor.
     Çevrimdışı olmak normal bir durum, hata değil. */
  {
    const { s, belgeler } = await ac(undefined);
    const basliklar = await s.locator('h1').count();
    bak(
      'surum.json 404 iken sayfa normal açılıyor',
      basliklar === 1 && belgeler.length === 1 && !s.url().includes('?s='),
      `${belgeler.length} belge · ${basliklar} h1`,
    );
    await s.close();
  }

  /* DEPOLAMA KULLANILMIYOR. Uygulamadaki "Şimdi değil" tercihi
     localStorage'a yazıyor; burada kapatılacak şerit olmadığı için o yola
     hiç girilmiyor. Sayfanın "çerez kullanmaz, takip yapmaz" cümlesi
     tazelemeden SONRA da doğru olmalı. */
  {
    const { s } = await ac('99999999999999');
    const depo = await s.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));
    bak(
      'Tazelemeden sonra da depolama boş',
      depo.local === 0 && depo.session === 0,
      `local=${depo.local} session=${depo.session}`,
    );
    await s.close();
  }
}

await tarayici.close();

console.log(`\n${'='.repeat(52)}`);
console.log(`TANITIM DENETİMİ — ${olcum} ölçüm, ${kusur} kusur`);
console.log('='.repeat(52));
process.exit(kusur === 0 ? 0 : 1);
