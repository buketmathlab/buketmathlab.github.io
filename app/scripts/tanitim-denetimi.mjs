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
    'Üç ekran görüntüsü de sayfada (dördüncü YOK)',
    durum.length === 3,
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
    /Teslimden sonra açılan çözümler/.test(metin),
  );
  bak(
    'açık uçluda değerlendirmenin öğretmende olduğu yazıyor',
    /Açık uçlu ödevlerde pedagojik değerlendirme kontrolü/.test(metin),
  );
  /* Bu bir süsleme değil, ÖLÇÜLMÜŞ bir güvence: 0026 `kendi_karnem`
   * sınıf ortalamasını, sıralamayı ve başka öğrencinin verisini bilerek
   * dışarıda bıraktı ve `kendi_karnem_testleri.sql` bunu doğruluyor. */
  bak(
    'kıyaslama olmadığı yazıyor',
    /Sıralama baskısı veya kıyaslama olmadan/.test(metin),
  );
  bak(
    'ekran görüntülerinin uydurma olduğu yazıyor',
    /adlar ve puanlar uydurmadır/.test(metin),
  );
  /* 1. grup DAVRANIŞI ölçüyor (çerez sayısı, dış istek). Bu ölçüm
   * cümlenin sayfada durduğunu ölçüyor — ikisi birlikte "iddia var ve
   * doğru" demek oluyor. */
  bak(
    'çerez/takip yapılmadığı yazıyor',
    /çerez kullanmaz ve ziyaretçi takibi yapmaz/.test(metin),
  );

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
    // Brief "İsveç merkezli … Supabase" diyordu. Ölçüm doğrulamadı:
    // proje bölgesi Zürih (eu-central-2), yani İsviçre; Supabase şirketi
    // de İsveç merkezli değil. Öğretmenin kararı: hiçbiri yazmasın.
    ['İsveç', /İsveç/],
    ['Supabase (satıcı adı)', /Supabase/i],
    ['Zürih / İsviçre (bölge)', /Zürih|İsviçre/],
    // Ewalu bir çizim + puan aralığına göre cümle seçen kural kümesi;
    // yapay zekâ değil (Kural 5). Öğretmen aynı sıfatı bir önceki turda
    // video altyazısından da kendisi çıkarmıştı.
    ['akıllı maskot/asistan', /akıllı\s+(maskot|asistan)/i],
    // Kural 18: kullanıcıya görünen metin Türkçe. Brief'te "Bosphorus
    // hattının" yazıyordu, "Boğaz hattının" oldu.
    ['Bosphorus', /Bosphorus/i],
    // Sistemde üç rol var. Dördüncü bir giriş vaat edilmiyor.
    ['dördüncü bir giriş vaadi', /(okul yönetimi|yönetici|kurum)\s+girişi|kurum panosu/i],
  ];
  for (const [ad, kalip] of turKararlari) {
    bak(`tur kararı: "${ad}" geçmiyor`, !kalip.test(metin));
  }

  /* MARKA CÜMLESİ — öğretmenin kararı: yeni H1 başlık oldu, marka cümlesi
   * kapanışta TEK BİR YERDE kaldı. Sayı ölçülüyor: eskiden üç yerde
   * geçiyordu ve brief'in "tekrar yok" ilkesi tam olarak bunu hedefliyor. */
  const markaAdet = (metin.match(/Öğrenmenin sonu yok\./g) || []).length;
  bak('marka cümlesi tam bir kez geçiyor', markaAdet === 1, `${markaAdet} kez`);

  /* Öğretmenin yeni H1'i ve alt metni — sayfanın vaadi bu iki cümle. */
  bak(
    'yeni ana başlık yerinde',
    /Öğrenmenin Sürekliliği, Gelişimin Netliği\./.test(metin),
  );
  bak('kurum rozeti yerinde', /Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi/.test(metin));
  bak('telif satırı yerinde', /© 2026 SEKİZ\. Tüm hakları saklıdır\./.test(metin));

  await sayfa.close();
}

/* ============================================================
   6 — DÖRDÜNCÜ PAYDAŞ VE HERO ÇAĞRILARI

   Bu grubun tamamı bu turun kararlarını KODDA ölçüyor, metinde değil.

   Öğretmenin kararı şuydu: "Okul Yönetimi kalsın, ayrı biçimde." Ölçülen
   gerçek şu — sistemde üç rol var (`ogretmen`, `ogrenci`, `veli`); okul
   yönetimi girişi, kurum panosu ya da idari rapor yok. Üç maddesi zaten
   bir özellik vaat etmiyor, ama diğer üç rolle birebir aynı kalıpta
   dursaydı dördüncü bir giriş varmış gibi okunurdu.

   Çözüm tek bir savunmacı cümle yazmak DEĞİL, bloğu farklı kurmaktı:
   ekran görüntüsü yok, giriş bağlantısı yok. Aşağısı bunun gerçekten
   böyle olduğunu ölçüyor.
   ============================================================ */
console.log('\n6. Dördüncü paydaş ve hero çağrıları');
{
  const sayfa = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
  await sayfa.goto(TANITIM, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(400);

  const blok = await sayfa.evaluate(() => {
    const rol = [...document.querySelectorAll('[data-blok="rol"]')];
    const yonetim = document.querySelector('[data-blok="yonetim"]');
    return {
      rolAdet: rol.length,
      rolGorselleri: rol.map((b) => b.querySelectorAll('img').length),
      yonetimVar: yonetim !== null,
      yonetimGorsel: yonetim ? yonetim.querySelectorAll('img').length : -1,
      yonetimGiris: yonetim ? yonetim.querySelectorAll('a[href^="/yeni/"]').length : -1,
      yonetimBaslik: yonetim
        ? (yonetim.querySelector('h3')?.textContent || '').trim()
        : '',
    };
  });

  bak('Üç rol bloğu var', blok.rolAdet === 3, `${blok.rolAdet} blok`);
  bak(
    'Her rol bloğunda tam bir ekran görüntüsü',
    blok.rolGorselleri.length === 3 && blok.rolGorselleri.every((n) => n === 1),
    blok.rolGorselleri.join('/'),
  );
  bak('Okul yönetimi bloğu sayfada', blok.yonetimVar, blok.yonetimBaslik);
  bak(
    'Okul yönetimi bloğunda EKRAN GÖRÜNTÜSÜ YOK',
    blok.yonetimGorsel === 0,
    `${blok.yonetimGorsel} görsel`,
  );
  bak(
    'Okul yönetimi bloğunda GİRİŞ BAĞLANTISI YOK',
    blok.yonetimGiris === 0,
    `${blok.yonetimGiris} bağlantı`,
  );

  /* HERO'NUN İKİ ÇAĞRISI. "Sistemi Keşfet ↓" bir çapaya gidiyor; çapanın
   * gerçekten var olduğu ve tıklayınca KAYDIRDIĞI ölçülüyor. Ölü bir
   * çapa hiçbir hata vermez, yalnız sessizce hiçbir şey yapmaz. */
  const giris = sayfa.locator('main a[href="/yeni/"]');
  bak('Hero: "Platforma Giriş Yap" /yeni/ adresine gidiyor', (await giris.count()) === 1);

  const kesfet = sayfa.locator('a[href="#ekosistem"]');
  bak('Hero: "Sistemi Keşfet" bağlantısı var', (await kesfet.count()) === 1);

  const hedefVar = (await sayfa.locator('#ekosistem').count()) === 1;
  bak('Çapa gerçekten var (#ekosistem)', hedefVar);

  for (const [ad, yer] of [
    ['Platforma Giriş Yap', giris],
    ['Sistemi Keşfet', kesfet],
  ]) {
    const kutu = await yer.first().boundingBox();
    bak(
      `"${ad}" 44px dokunma hedefi`,
      kutu !== null && kutu.height >= 44,
      `${kutu ? Math.round(kutu.height) : 0}px`,
    );
  }

  if (hedefVar) {
    const onceki = await sayfa.evaluate(() => window.scrollY);
    await kesfet.click();
    await sayfa.waitForTimeout(700);
    const sonraki = await sayfa.evaluate(() => window.scrollY);
    bak(
      '"Sistemi Keşfet" gerçekten kaydırıyor',
      sonraki > onceki + 100,
      `${Math.round(onceki)} → ${Math.round(sonraki)}px`,
    );
  }

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
    bak(
      'Bağlantı giriş formunun AŞAĞISINDA',
      kutu.y > formKutu.y + formKutu.height,
      `bağlantı ${Math.round(kutu.y)}px · form sonu ${Math.round(formKutu.y + formKutu.height)}px`,
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
