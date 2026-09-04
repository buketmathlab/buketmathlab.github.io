/**
 * GERİ ALMA KANITI — kök yönlendirme turu.
 *
 * Bir denetim ancak KIRILDIĞI görüldüğünde bir şey ölçüyordur. Bu betik
 * `kok-denetimi.mjs`'in her ölçümünü tek tek bozuyor ve gerçekten
 * kırıldığını gösteriyor.
 *
 * BURADA ÖZELLİKLE ÖNEMLİ, ÇÜNKÜ ÖLÇÜLEN ŞEY BİR ALIŞKANLIĞIN YERİNİ
 * ALDI. Kök dosyanın doğruluğunu bugüne kadar her tur ELLE kontrol
 * ediyordum. Yerine koyduğum otomatik denetim gerçekten ısırmıyorsa,
 * elimde eskisinden DAHA AZ güvence olurdu — çünkü artık elle de
 * bakmayacağım.
 *
 * DERLEME GEREKMİYOR: kök dosya derlemeye girmiyor, doğrudan servis
 * ediliyor. (Tanıtım turunun betiği her yamada yeniden derliyor; burada
 * o adım yok, bu yüzden koşu hızlı.)
 *
 * ÇALIŞTIRMA (depo kökünden, http-server 8788'de -c-1 ile açıkken):
 *   node app/scripts/geri-alma-kok.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAYFA = join(KOK, 'index.html');

/**
 * `bekleyen` denetimin çıktısındaki ölçüm BAŞLIĞININ bir parçası.
 * "denetim kırıldı" demek yetmez — DOĞRU ölçümün kırıldığı görülmeli;
 * başka bir ölçüm kırılırsa yama yanlış şeyi kanıtlamış olur.
 */
const YAMALAR = [
  {
    /* KVKK KATMANI. Eski kök sayfa üç ayrı üçüncü tarafa istek atıyordu;
       yenisi hiçbirine atmıyor. Biri bir gün "hızlıca bir font ekleyeyim"
       derse denetim kırılmalı. */
    ad: 'Üçüncü taraf font/CDN eklenirse',
    eski: '    <title>SEKİZ · Buket Topuzoğlu · Matematik</title>',
    yeni:
      '    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope" />\n' +
      '    <title>SEKİZ · Buket Topuzoğlu · Matematik</title>',
    bekleyen: 'üçüncü taraf src/href yok',
  },
  {
    /* HEDEF — betik katmanı. */
    ad: 'Betik yanlış yere yönlendirirse',
    eski: "location.replace('/yeni/');",
    yeni: "location.replace('/eski/');",
    bekleyen: 'betik /yeni/ hedefliyor',
  },
  {
    /* HEDEF — meta katmanı. Bu ikisi AYRI ölçülüyor: yalnız birini
       ölçseydik öbürü sessizce bozulabilirdi. */
    ad: 'Meta yenileme yanlış yere giderse',
    eski: '<meta http-equiv="refresh" content="0; url=/yeni/" />',
    yeni: '<meta http-equiv="refresh" content="0; url=/eski/" />',
    bekleyen: 'meta yenileme /yeni/ hedefliyor',
  },
  {
    /* EN ÖNEMLİ YAMA. Meta satırı silinince JavaScript'i AÇIK olan
       kullanıcı hiçbir şey fark etmez — betik zaten yönlendirir. Kaybolan
       kişi JavaScript'i kapalı olandır ve o sessizce ölü sayfada kalır.
       Denetimin "JS kapalıyken de düşüyor" ölçümü tam olarak bunu
       yakalamak için var; bu yama onun gerçekten ısırdığını gösteriyor. */
    ad: 'Meta yenileme silinirse (JS kapalı kullanıcı kaybolur)',
    eski: '    <meta http-equiv="refresh" content="0; url=/yeni/" />\n',
    yeni: '',
    bekleyen: 'JS KAPALIYKEN de /yeni/ açılıyor',
  },
  {
    /* GERİ TUŞU. `href` geçmişe kayıt bırakır; kullanıcı geri tuşuna
       basınca köke döner ve yeniden yönlendirilir — yani geri tuşu
       çalışmaz hâle gelir. */
    ad: 'location.replace yerine location.href kullanılırsa',
    eski: "location.replace('/yeni/');",
    yeni: "location.href = '/yeni/';",
    bekleyen: 'betik location.href KULLANMIYOR',
  },
  {
    /* ÜÇÜNCÜ KATMAN. Bazı kurumsal tarayıcılar meta yenilemeyi engelliyor
       ve JavaScript'i de kısıtlayabiliyor; görünür bağlantı son çare. */
    ad: 'Görünür bağlantı silinirse',
    eski: '      <a href="/yeni/">Giriş ekranına git</a>\n',
    yeni: '',
    bekleyen: 'görünür bağlantı var',
  },
  {
    /* BOYUT SINIRI. Asıl korunan şey şu: kök bir daha sessizce bir
       uygulamaya dönüşmesin. 4 KB'yi aşan her şey bunu tetikler. */
    ad: 'Kök dosya yeniden şişerse',
    eski: '  </body>',
    yeni: '    <div hidden>' + 'x'.repeat(4200) + '</div>\n  </body>',
    bekleyen: 'kök dosya küçük kalıyor',
  },
];

let yakalandi = 0;

function denetimCiktisi() {
  try {
    return execFileSync('node', [join(KOK, 'app/scripts/kok-denetimi.mjs')], {
      cwd: KOK,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (e) {
    // Denetim kusur bulunca 1 ile çıkıyor — çıktısı `stdout`'ta.
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('\nGERİ ALMA KANITI — kök yönlendirme turu');
console.log('====================================================\n');

const taban = denetimCiktisi();
if (!/KÖK DENETİMİ GEÇTİ/.test(taban)) {
  console.error('✗ TABAN TEMİZ DEĞİL. Yamalara başlanmıyor.\n');
  console.error(taban);
  process.exit(1);
}
console.log('✓ Taban temiz — 0 kusur. Yamalar başlıyor.\n');

const orijinal = readFileSync(SAYFA, 'utf8');

for (const y of YAMALAR) {
  if (!orijinal.includes(y.eski)) {
    console.log(`✗ ${y.ad}\n    YAMA UYGULANAMADI: aranan metin dosyada yok`);
    continue;
  }
  writeFileSync(SAYFA, orijinal.replace(y.eski, y.yeni));

  const cikti = denetimCiktisi();
  writeFileSync(SAYFA, orijinal); // her yamadan sonra hemen geri al

  const kirilan = cikti
    .split('\n')
    .filter((s) => s.trimStart().startsWith('✗'))
    .map((s) => s.replace(/^\s*✗\s*/, ''));

  const dogru = kirilan.some((s) => s.includes(y.bekleyen));
  if (dogru) {
    yakalandi++;
    console.log(`✓ ${y.ad}\n    kırılan: ${kirilan.find((s) => s.includes(y.bekleyen))}`);
  } else {
    console.log(
      `✗ ${y.ad}\n    BEKLENEN ÖLÇÜM KIRILMADI ("${y.bekleyen}")\n` +
        `    kırılanlar: ${kirilan.join(' | ') || '(hiçbiri)'}`,
    );
  }
}

// Son bir kez: dosya gerçekten orijinal hâline döndü mü.
const sonHal = readFileSync(SAYFA, 'utf8');
console.log(
  '\n' + (sonHal === orijinal ? '✓' : '✗') + ' Kök dosya orijinal hâline döndü',
);

console.log('\n====================================================');
console.log(`GERİ ALMA KANITI — ${yakalandi}/${YAMALAR.length} yakalandı`);
console.log('====================================================\n');
process.exit(yakalandi === YAMALAR.length && sonHal === orijinal ? 0 : 1);
