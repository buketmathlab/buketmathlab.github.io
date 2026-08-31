/**
 * GERİ ALMA KANITI — tanıtım profesyonelleştirme turu.
 *
 * Bir denetim ancak KIRILDIĞI görüldüğünde bir şey ölçüyordur. Bu betik
 * bu turda eklenen/taşınan ölçümlerin her birini tek tek bozuyor ve
 * `tanitim-denetimi.mjs`'in gerçekten kırıldığını gösteriyor.
 *
 * ÖZELLİKLE İKİ YÖNLÜ KİLİT: "veli bölümünde eksik yok" ve "sayfada
 * eksik olduğu konu alanları var" ölçümleri AYRI AYRI bozuluyor. İkisi
 * birlikte öğretmenin kapsam kararını kilitliyor; yalnız biri kırılsaydı
 * kilit tek yönlü olurdu ve bunu ancak burada görebilirdik.
 *
 * DERLEME KIRILIRSA DURUYOR — 0030 turunda öğrenilen tuzak: `npm run
 * build` başarısız olduğunda denetim sessizce ESKİ paketi ölçer ve
 * yamaların hepsi "yakalandı" gibi görünür. O tur yedi yamanın yedisi de
 * anlamsız çıkmıştı.
 *
 * ÇALIŞTIRMA (depo kökünden, http-server 8788'de -c-1 ile açıkken):
 *   node app/scripts/geri-alma-tanitim.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const KOK = new URL('../../', import.meta.url).pathname;
const SAYFA = `${KOK}app/src/pages/Tanitim.tsx`;
const META = `${KOK}app/tanitim/index.html`;

/**
 * Her yama: dosyada bir metni başka bir metinle değiştirir ve
 * `bekleyen` ölçümünün kırılmasını bekler.
 *
 * `bekleyen` denetimin çıktısındaki ölçüm BAŞLIĞININ bir parçası —
 * "denetim kırıldı" demek yetmez, DOĞRU ölçümün kırıldığı görülmeli.
 * Başka bir ölçüm kırılırsa yama yanlış şeyi kanıtlamış olur.
 */
const YAMALAR = [
  {
    ad: 'Hero künye satırı silinirse',
    dosya: SAYFA,
    eski: 'Fikir, pedagojik tasarım ve yazılım geliştirme\n        </p>',
    yeni: 'Ödev · Değerlendirme\n        </p>',
    bekleyen: 'hero künye satırı',
  },
  {
    ad: '"SEKİZ neden var?" bölümü kaldırılırsa',
    dosya: SAYFA,
    // `{false && …}` ile çiziliyor: bölüm DOM'dan gerçekten kalkıyor
    // ama bileşene yapılan başvuru duruyor. Düz silme, TS6133
    // ("kullanılmayan bileşen") ile DERLEMEYİ kırıyordu ve o zaman
    // ölçüm hiç yapılamıyordu — betiğin derleme koruması bunu yakaladı.
    eski: '        <NedenVar />',
    yeni: '        {false && <NedenVar />}',
    bekleyen: '"SEKİZ neden var?" bölümü var',
  },
  {
    ad: 'Künye bölümü kaldırılırsa',
    dosya: SAYFA,
    eski: '        <Kunye />',
    yeni: '        {false && <Kunye />}',
    bekleyen: 'künyede ad, unvan ve rolün kapsamı',
  },
  {
    ad: 'Hikâye başlığı eski uzun hâline dönerse',
    dosya: SAYFA,
    eski: '          Sınıftan doğdu.\n',
    yeni: '          Bir öğretmenin gerçek sınıf deneyiminden doğdu.\n',
    bekleyen: '"Sınıftan doğdu." bölümü var',
  },
  {
    ad: 'Bağ "8 rakamı" yerine şekil üzerinden kurulursa',
    dosya: SAYFA,
    eski: 'matematikte sonsuzluğu çağrıştıran 8 rakamından alır',
    yeni: 'sonsuzluğu çağrıştıran 8 şeklinden alır',
    bekleyen: '8 → sonsuzluk bağı 8 RAKAMI üzerinden',
  },
  {
    ad: 'Geri çekilen felsefe cümlesi sayfaya geri konursa',
    dosya: SAYFA,
    eski: 'Çözülen her problem, sorulacak yeni bir soruyu mümkün kılar.',
    yeni: 'Sonsuzluk bir varış değil, bir yöndür; öğrenme de o yönde ilerler.',
    bekleyen: 'geri çekilen felsefe cümlesi',
  },
  {
    ad: 'Öğrenci maddesi eski ifadeye dönerse',
    dosya: SAYFA,
    eski:
      "'Tamamladığı, tamamlaması gereken ve sıradaki çalışmalarını tek ekrandan takip eder.'",
    yeni:
      "'Bütün ödevlerini tek ekranda görür; tamamladıklarını takip eder.'",
    bekleyen: 'öğrencinin tamamlaması gerekenler',
  },
  {
    ad: 'Öğretmen maddesinden tamamlanmamış ödev düşerse',
    dosya: SAYFA,
    eski:
      "'Hangi öğrencilerin çalışmalarını tamamladığını, hangi ödevlerin henüz tamamlanmadığını görür.'",
    yeni: "'Hangi öğrencilerin çalışmalarını tamamladığını görür.'",
    bekleyen: 'tamamlanmamış ödev öğretmene anlatılıyor',
  },
  {
    // İKİ YÖNLÜ KİLİDİN BİRİNCİ YARISI: "eksik" veli bölümüne geri gelirse.
    ad: '"eksik" veli bölümüne geri gelirse',
    dosya: SAYFA,
    eski: 'Öğrencinin gelişimini güçlendirebileceği konu\n        alanları veli tarafından da görülebilir.',
    yeni: 'Öğrencinin eksik olduğu konu\n        alanları veli tarafından da görülebilir.',
    bekleyen: 'veli bölümünün KENDİ metninde "eksik"',
  },
  {
    // İKİ YÖNLÜ KİLİDİN İKİNCİ YARISI: gerçek sayfadan tamamen silinirse.
    // Bu yama tek başına birinci ölçümü KIRMAZ (veli bölümü zaten temiz);
    // kalıcı dil kuralının kilidi tam olarak burada.
    ad: '"eksik olduğu konu alanları" sayfadan tamamen silinirse',
    dosya: SAYFA,
    eski: 'Yanlış yaptığı soruları ve eksik olduğu\n          konu alanlarını da görünür hâle getirir.',
    yeni: 'Yanlış yaptığı soruları da görünür hâle getirir.',
    bekleyen: '"eksik olduğu konu alanları" yazıyor',
  },
  {
    ad: 'Sayfaya övgü sıfatı girerse',
    dosya: SAYFA,
    eski: '          Sınıftan doğdu.\n',
    yeni: '          Sınıftan doğdu. Vizyoner bir öğretmenin benzersiz ürünü.\n',
    bekleyen: 'devrim dili',
  },
  {
    ad: 'Kapanış olumsuz tanımlamaya dönerse',
    dosya: SAYFA,
    eski: '            Öğrenmenin sonu yok.\n',
    yeni:
      '            SEKİZ sadece bir ödev takip uygulaması değildir.\n',
    bekleyen: 'olumsuz kapanış tanımı',
  },
  {
    ad: 'Meta açıklama eski konumlandırmaya dönerse',
    dosya: META,
    eski:
      'content="SEKİZ — matematik öğrenme sürecini görünür kılmak için sınıfın içinden doğan dijital bir öğrenme platformu. Ödev, değerlendirme, geri bildirim ve gelişim tek yerde. Buket Topuzoğlu · Matematik."',
    yeni:
      "content=\"SEKİZ — Arnavutköy Korkmaz Yiğit Anadolu Lisesi'nde matematik ödevleri için kurulmuş bir uygulama.\"",
    bekleyen: 'meta açıklama',
  },
  {
    ad: 'og açıklamasında veli yine "izleyen" taraf olursa',
    dosya: META,
    eski:
      'content="Ödev, değerlendirme, geri bildirim ve gelişim tek yerde. Öğrenci kendi gelişimini takip eder, öğretmen süreci görür, veli sürece dahil olur."',
    yeni:
      'content="Ödev, teslim ve gelişim tek yerde. Veli çocuğunun gidişatını izler."',
    bekleyen: 'og açıklamasında veli',
  },
  {
    ad: 'Bölüm sırası kayarsa',
    dosya: SAYFA,
    eski: '        <NedenVar />\n        <Hikaye />',
    yeni: '        <Hikaye />\n        <NedenVar />',
    bekleyen: 'Bölümler beklenen SIRADA',
  },
];

function calistir(komut, argumanlar) {
  return execFileSync(komut, argumanlar, { cwd: KOK, encoding: 'utf8', stdio: 'pipe' });
}

/** Derle. BAŞARISIZ OLURSA `null` — çağıran DURMAK zorunda. */
function derle() {
  try {
    calistir('npm', ['--prefix', 'app', 'run', 'build']);
    return true;
  } catch (e) {
    console.log('    ⚠ DERLEME KIRILDI — bu yama ölçülemez.');
    console.log('      ' + String(e.stdout || e.message).split('\n').slice(-6).join('\n      '));
    return false;
  }
}

/** Denetimi koştur; kırılan ölçüm başlıklarını döndür. */
function denetle() {
  let cikti;
  try {
    cikti = calistir('node', ['app/scripts/tanitim-denetimi.mjs']);
  } catch (e) {
    cikti = String(e.stdout || '');
  }
  return cikti
    .split('\n')
    .filter((s) => s.includes('✗'))
    .map((s) => s.replace(/^\s*✗\s*/, '').trim());
}

console.log('GERİ ALMA KANITI — tanıtım turu\n' + '='.repeat(52));

// TABAN ÖLÇÜMÜ: bozulmamış hâlde denetim TEMİZ olmalı. Değilse aşağıdaki
// "kırıldı" sonuçlarının hiçbiri bir şey kanıtlamaz.
if (!derle()) process.exit(1);
const taban = denetle();
if (taban.length > 0) {
  console.log(`\n✗ TABAN TEMİZ DEĞİL — ${taban.length} kusur:\n  ${taban.join('\n  ')}`);
  console.log('Geri alma kanıtı anlamsız olurdu; duruyorum.');
  process.exit(1);
}
console.log('\n✓ Taban temiz — 0 kusur. Yamalar başlıyor.\n');

let yakalanan = 0;
for (const y of YAMALAR) {
  const once = readFileSync(y.dosya, 'utf8');
  if (!once.includes(y.eski)) {
    console.log(`✗ ${y.ad}\n    YAMA UYGULANAMADI — aranan metin dosyada yok.`);
    continue;
  }
  writeFileSync(y.dosya, once.replace(y.eski, y.yeni));
  try {
    if (!derle()) {
      console.log(`✗ ${y.ad} — derleme kırıldığı için ÖLÇÜLEMEDİ.`);
      continue;
    }
    const kirilan = denetle();
    const dogru = kirilan.filter((k) => k.includes(y.bekleyen));
    if (dogru.length > 0) {
      yakalanan += 1;
      console.log(`✓ ${y.ad}\n    kırılan: ${dogru[0]}`);
    } else {
      console.log(
        `✗ ${y.ad}\n    BEKLENEN ÖLÇÜM KIRILMADI ("${y.bekleyen}")` +
          `\n    kırılanlar: ${kirilan.join(' | ') || '(hiçbiri)'}`,
      );
    }
  } finally {
    writeFileSync(y.dosya, once);
  }
}

// Dosyaları eski hâline getirdikten sonra son bir derleme: depo temiz kalsın.
derle();

console.log('\n' + '='.repeat(52));
console.log(`GERİ ALMA KANITI — ${yakalanan}/${YAMALAR.length} yakalandı`);
console.log('='.repeat(52));
process.exit(yakalanan === YAMALAR.length ? 0 : 1);
