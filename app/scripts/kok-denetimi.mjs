/**
 * KÖK ADRES DENETİMİ — `npm run kok-denetim`
 *
 * NEDEN VAR. Kök `index.html` bu turda 713 satırlık eski uygulamadan
 * `/yeni/`'ye yönlendiren küçük bir sayfaya döndü. Gerekçesi ölçülmüştü:
 * eski uygulamanın bağlandığı Supabase projesi silinmişti, yani sayfa
 * açılıyor ama hiç kimse giremiyordu — ve 15 Eylül'de sondaki "/yeni/"
 * kısmını yazmayı unutan her öğrenci oraya düşecekti.
 *
 * BU DENETİM BİR ALIŞKANLIĞIN YERİNİ ALIYOR. Bugüne kadar kök dosyanın
 * değişmediğini HER TUR ELLE kontrol ediyordum; depoda tek bir betik onu
 * ölçmüyordu (yalnız `docs/mevcut-sistem-envanteri.md`'de bir cümle
 * vardı). Alışkanlık kırıldığı gün kimse fark etmezdi. Kök artık ürünün
 * ön kapısı; ölçüm otomatik.
 *
 * ALTI ÖLÇÜM ve her biri gerçek bir başarısızlık biçimine karşılık geliyor:
 *
 *   1. Dosya küçük kalıyor      → sessizce yeniden bir uygulamaya dönüşemez
 *   2. Hedef /yeni/             → yanlış yere yönlendirme
 *   3. Üçüncü taraf kaynak yok  → KVKK: ziyaretçi IP'si dışarı sızmasın
 *   4. Tarayıcıda düşüyor       → "yazdım" yetmez, çalıştığı görülmeli
 *   5. JS KAPALIYKEN de düşüyor → betiğe güvenmeyen tek katman
 *   6. tetik.txt ve .nojekyll   → kökteki diğer iki dosya duruyor
 *
 * Beşincisi özellikle önemli: `location.replace` çalışmazsa geriye yalnız
 * meta yenileme kalıyor. Onu ölçmezsek, biri bir gün meta satırını silince
 * JavaScript'i kapalı kullanıcı sessizce kaybolur.
 *
 * Ön koşul: repo kökünde `npx http-server -p 8788 -c-1 .`
 */
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUNUCU = 'http://127.0.0.1:8788';

/** Kök dosya bir uygulamaya dönüşmesin diye üst sınır. Bugün ~3,6 KB. */
const AZAMI_BAYT = 4096;

let kusur = 0;
const bak = (ad, gecti, ek = '') => {
  console.log(`  ${gecti ? '✓' : '✗'} ${ad}${ek ? ' — ' + ek : ''}`);
  if (!gecti) kusur++;
};

const kaynak = await readFile(join(KOK, 'index.html'), 'utf8');

/* YORUMLAR ÇIKARILIYOR — ve bu bir ölçüm düzeltmesi.
 *
 * İlk hâlinde bu betik kendi açıklama yorumumu yakaladı: dosyanın
 * başındaki yorum eski sayfanın "Google Fonts, jsDelivr, cdnjs"
 * yüklediğini ANLATIYOR. Tarayıcı bir yorumdan hiçbir şey yüklemez;
 * ölçüm yanlış şeye bakıyordu.
 *
 * Kural: bu denetim TARAYICININ YÜKLEDİĞİ şeyi ölçer, kaynakta hangi
 * kelimenin geçtiğini değil. Aksi hâlde ya gerçek olmayan bir kusur
 * raporlar ya da yorumları budamak zorunda kalırdık. */
const govde = kaynak.replace(/<!--[\s\S]*?-->/g, ' ');

// ---------------------------------------------------------------------------
console.log('\n1. Kök dosyanın kendisi');

const boyut = (await stat(join(KOK, 'index.html'))).size;
bak(
  `kök dosya küçük kalıyor (< ${AZAMI_BAYT} bayt)`,
  boyut < AZAMI_BAYT,
  `${boyut} bayt`,
);

/* HEDEF İKİ KATMANDA DA ÖLÇÜLÜYOR. Yalnız birini ölçseydik öbürü
 * sessizce yanlış yere gidebilir ya da silinebilirdi. */
bak(
  'meta yenileme /yeni/ hedefliyor',
  /<meta\s+http-equiv="refresh"\s+content="0;\s*url=\/yeni\/"/i.test(kaynak),
);
bak('betik /yeni/ hedefliyor', /location\.replace\('\/yeni\/'\)/.test(kaynak));

/* `replace` DEĞİL de `href` kullanılırsa geçmişe kayıt düşer ve geri
 * tuşu buraya dönüp kullanıcıyı yeniden yönlendirir — yani geri tuşu
 * çalışmaz hâle gelir. Sessiz ve can sıkıcı bir kusur. */
bak(
  'betik location.href KULLANMIYOR (geri tuşu çalışsın)',
  !/location\.href\s*=/.test(kaynak),
);

/* GÖRÜNÜR BAĞLANTI — üçüncü katman. İki otomatik yol da engellenirse
 * (bazı kurumsal tarayıcılar meta yenilemeyi engelliyor) elle tıklanır. */
bak('görünür bağlantı var', /<a\s+href="\/yeni\/"/.test(kaynak));

// ---------------------------------------------------------------------------
console.log('\n2. Üçüncü taraf kaynak yok (KVKK)');

/* Eski kök sayfa Google Fonts, jsDelivr ve cdnjs yüklüyordu; oraya düşen
 * herkesin IP'si üç ayrı üçüncü tarafa gidiyordu. Yeni sayfa hiçbir dış
 * kaynak yüklemiyor.
 *
 * KENDİ ADRESİMİZ MUAF: `rel="canonical"` tam adres yazmak zorunda ve o
 * bir İSTEK değil, arama motoruna bildirim. Ölçüm host bazında yapılıyor,
 * "http geçiyor mu" diye bakmıyor — aksi hâlde canonical'ı silmek
 * zorunda kalırdık. */
const KENDI = 'buketmathlab.github.io';
const disKaynaklar = [...govde.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => new URL(u).host !== KENDI);
bak(
  'üçüncü taraf src/href yok',
  disKaynaklar.length === 0,
  disKaynaklar.join(', ') || 'temiz',
);

const gomulu = /@import|fonts\.googleapis|cdn\.jsdelivr|cdnjs|unpkg/i.test(govde);
bak('gömülü CDN/font çağrısı yok', !gomulu);

// ---------------------------------------------------------------------------
console.log('\n3. Kökteki diğer dosyalar duruyor');

for (const d of ['tetik.txt', '.nojekyll']) {
  let var_mi = true;
  try {
    await stat(join(KOK, d));
  } catch {
    var_mi = false;
  }
  bak(`${d} yerinde`, var_mi);
}

// ---------------------------------------------------------------------------
console.log('\n4. Tarayıcıda gerçekten yönlendiriyor');

const tarayici = await chromium.launch();

/* JAVASCRIPT AÇIK — normal kullanıcı. */
{
  const sayfa = await tarayici.newPage();
  await sayfa.goto(SUNUCU + '/', { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(600);
  const adres = new URL(sayfa.url()).pathname;
  bak('JS açıkken /yeni/ açılıyor', adres === '/yeni/', adres);

  /* Yönlendikten sonra GERÇEKTEN uygulama mı açıldı — yalnız adrese
   * bakmak yetmez, boş bir sayfaya da düşebilirdik. */
  const girisVar = await sayfa.locator('text=Giriş yap').count();
  bak('gelen sayfa giriş ekranı', girisVar > 0, `${girisVar} "Giriş yap"`);

  /* GERİ TUŞU: `replace` kullanıldığı için köke dönmemeli. Bir önceki
   * sayfa yoksa tarayıcı olduğu yerde kalır — ölçülen şey, geri tuşunun
   * kullanıcıyı sonsuz döngüye sokmadığı. */
  await sayfa.goBack().catch(() => {});
  await sayfa.waitForTimeout(300);
  const geriAdres = new URL(sayfa.url()).pathname;
  bak('geri tuşu sonsuz döngüye girmiyor', geriAdres !== '/', geriAdres);
  await sayfa.close();
}

/* JAVASCRIPT KAPALI — betiğe güvenmeyen katman. Meta yenileme tek başına
 * çalışmalı; çalışmazsa JS'i kapalı kullanıcı ölü sayfada kalır. */
{
  const baglam = await tarayici.newContext({ javaScriptEnabled: false });
  const sayfa = await baglam.newPage();
  await sayfa.goto(SUNUCU + '/', { waitUntil: 'load' });
  await sayfa.waitForTimeout(1500);
  const adres = new URL(sayfa.url()).pathname;
  bak('JS KAPALIYKEN de /yeni/ açılıyor', adres === '/yeni/', adres);
  await baglam.close();
}

/* Yönlendirme tanıtım sayfasını etkilemiyor — ayrı adres, ayrı giriş. */
{
  const sayfa = await tarayici.newPage();
  const yanit = await sayfa.goto(SUNUCU + '/yeni/tanitim/', { waitUntil: 'networkidle' });
  bak('tanıtım sayfası etkilenmedi', yanit?.status() === 200, `http=${yanit?.status()}`);
  await sayfa.close();
}

await tarayici.close();

// ---------------------------------------------------------------------------
console.log('\n====================================================');
console.log(
  kusur === 0 ? 'KÖK DENETİMİ GEÇTİ — kusur yok' : `KÖK DENETİMİ: ${kusur} KUSUR`,
);
console.log('====================================================\n');
process.exit(kusur === 0 ? 0 : 1);
