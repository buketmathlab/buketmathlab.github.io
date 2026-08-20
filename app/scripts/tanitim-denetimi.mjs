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

  bak('Üç ekran görüntüsü de sayfada', durum.length === 3, `${durum.length} görsel`);
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

  /* BULUNMASI GEREKENLER — ürünün gerçek sınırları metinde duruyor mu.
   * Cümleler öğretmenin nihai editoryal metninden; metin değişirse
   * buradaki desenler de değişmeli (aynı cümleyi iki yerde tutmak
   * yerine, denetim metnin kendisini okuyor). */
  bak(
    'değerlendirmenin öğretmende olduğu yazıyor',
    /son değerlendirme öğretmen tarafından yapılır/.test(metin),
  );
  bak(
    'pedagojik değerlendirmenin öğretmende kaldığı yazıyor',
    /pedagojik değerlendirme öğretmende kalır/.test(metin),
  );
  bak(
    'anahtarın teslimden önce açılmadığı yazıyor',
    /teslim etmeden cevap anahtarına erişemez/.test(metin),
  );
  bak(
    'ekran görüntülerinin uydurma olduğu yazıyor',
    /adlar ve puanlar uydurmadır/.test(metin),
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

  /* MARKA CÜMLESİ ve onu kuran bölüm. Brief bu turda kuralı gevşetti:
   * "Öğrenmenin sonu yok." artık TEK BAŞINA da güçlü bir marka cümlesi
   * olarak kullanılabiliyor. Bu yüzden eski "yanında bağlayıcı satır
   * olmalı" ölçümü kaldırıldı — artık yanlış şeyi ölçüyordu.
   * Yerine ölçülen: cümle sayfada var ve onu kuran felsefe bölümü de var. */
  bak('marka cümlesi var', /Öğrenmenin sonu yok\./.test(metin));
  bak(
    'sonsuzluk fikri eğitim felsefesine bağlanıyor',
    /SEKİZ, sonsuzluk fikrinden ilham alır/.test(metin),
  );
  bak(
    'öğrenmenin süreç olduğu yazıyor',
    /Öğrenme bir sonuç değil, devam eden bir süreçtir/.test(metin),
  );

  await sayfa.close();
}

/* ============================================================
   6 — GİRİŞ EKRANIYLA BAĞ
   ============================================================ */
console.log('\n6. Giriş ekranı bağlantısı');
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

await tarayici.close();

console.log(`\n${'='.repeat(52)}`);
console.log(`TANITIM DENETİMİ — ${olcum} ölçüm, ${kusur} kusur`);
console.log('='.repeat(52));
process.exit(kusur === 0 ? 0 : 1);
