/**
 * GERİ ALMA KANITI — tanıtım metin turu (öğretmenin yeni brief'i).
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
    ad: 'Yeni H1 eski marka cümlesine dönerse',
    dosya: SAYFA,
    eski: '          Sonsuz bir öğrenme döngüsü için tasarlandı.',
    yeni: '          Öğrenmenin sonu yok.',
    bekleyen: 'Hero başlığı öğretmenin cümlesi',
  },
  {
    // MARKA CÜMLESİ SAYISININ KİLİDİ — sayı TAM ölçülüyor, yani cümle
    // ÇOĞALIRSA da kırılıyor. Yukarıdaki yama düşmeyi, bu yama
    // çoğalmayı kanıtlıyor.
    ad: 'Marka cümlesi ikinci bir yere serpiştirilirse',
    dosya: SAYFA,
    eski: '      <Not>SEKİZ, bu görünürlüğü kurmak için var.</Not>',
    yeni: '      <Not>SEKİZ, bu görünürlüğü kurmak için var. Öğrenmenin sonu yok.</Not>',
    bekleyen: 'marka cümlesi tam bir yerde',
  },
  {
    ad: 'Hero alt başlığı brief metninden çıkarsa',
    dosya: SAYFA,
    eski: 'Öğrenci gelişimini ve ödev süreçlerini şeffaf, yönetilebilir ve anlamlı verilerle',
    yeni: 'Öğrenci gelişimini ve ödev süreçlerini anlaşılır biçimde',
    bekleyen: "hero alt başlığı brief'ten",
  },
  {
    // VELİ CÜMLESİ HERO'DAN DÜŞERSE. Brief'in alt başlığı veliden hiç
    // söz etmiyor; rol satırı bu yüzden bilerek korundu.
    ad: 'Hero rol satırı silinirse (veli düşer)',
    dosya: SAYFA,
    eski: 'sürece dahil olduğu bir zemin kurar.',
    yeni: 'birlikte ilerlediği bir zemin kurar.',
    bekleyen: 'hero: velinin sürece DAHİL olduğu',
  },
  {
    ad: 'Künye anlatısı brief metninden çıkarsa',
    dosya: SAYFA,
    eski: 'tahta başındaki gerçek',
    yeni: 'gerçek',
    bekleyen: 'künye anlatısı: masa başı teorisi değil',
  },
  {
    ad: "SEKİZ'i kimin tasarladığı silinirse",
    dosya: SAYFA,
    eski:
      'Fikir aşamasından kod satırlarına kadar matematik\n          öğretmeni Buket Topuzoğlu tarafından tasarlandı.',
    yeni: 'Uzun bir süre boyunca tasarlandı.',
    bekleyen: "SEKİZ'i kimin tasarladığı yazıyor",
  },
  {
    ad: 'Hikâye başlığı bir önceki tura dönerse',
    dosya: SAYFA,
    eski: '          Bir öğretmenin sınıf deneyiminden doğdu.',
    yeni: '          Sınıftan doğdu.',
    bekleyen: '"Bir öğretmenin sınıf deneyiminden doğdu." bölümü var',
  },
  {
    ad: 'Felsefe başlığı brief metninden çıkarsa',
    dosya: SAYFA,
    eski: '          İsmini matematiğin sonsuzluk düşüncesinden alır.',
    yeni: '          Öğrenmenin doğası.',
    bekleyen: 'Bölümler beklenen SIRADA',
  },
  {
    ad: 'Felsefe vurgu cümlesi brief metninden çıkarsa',
    dosya: SAYFA,
    eski: '8’in kesintisiz akışı, öğrenmenin bitmeyen doğası: SEKİZ',
    yeni: 'Öğrenmenin bitmeyen doğası: SEKİZ',
    bekleyen: 'felsefe vurgu cümlesi yerinde',
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
    eski: '          Bu yüzden SEKİZ ödevi bir görev listesi gibi değil',
    yeni:
      '          Sonsuzluk bir varış değil, bir yöndür. Bu yüzden SEKİZ ödevi bir görev listesi gibi değil',
    bekleyen: 'geri çekilen felsefe cümlesi',
  },
  {
    // KORUNAN GÜVENCE 1 — kalıcı dil kuralı (öğrenci tarafı).
    ad: 'Öğrenci maddesinden "tamamlaması gereken" düşerse',
    dosya: SAYFA,
    eski: "'Tamamladığı, tamamlaması gereken ve sıradaki çalışmalarını tek ekrandan takip eder.',",
    yeni: "'Tamamladığı ve sıradaki çalışmalarını tek ekrandan takip eder.',",
    bekleyen: 'öğrencinin tamamlaması gerekenler',
  },
  {
    // KORUNAN GÜVENCE 2 — Kural 6 / Part XXI.
    ad: 'Cevap anahtarı güvencesi maddeden düşerse',
    dosya: SAYFA,
    eski: "'Teslimden önce açılmaz; teslimden hemen sonra açılır.",
    yeni: "'Teslimden sonra görünür.",
    bekleyen: 'anahtarın yalnız teslimden sonra açıldığı',
  },
  {
    // KORUNAN GÜVENCE 3 — ölçülen ürün davranışı.
    ad: 'Fotoğraf zorunluluğu maddeden düşerse',
    dosya: SAYFA,
    eski: 'fotoğraf yüklenmeden teslim tamamlanmaz.',
    yeni: 'fotoğrafını da ekler.',
    bekleyen: 'çözüm fotoğrafının zorunlu olduğu',
  },
  {
    // KORUNAN GÜVENCE 4 — kalıcı dil kuralı (öğretmen tarafı).
    ad: 'Öğretmen maddesinden tamamlanmamış ödev düşerse',
    dosya: SAYFA,
    eski: "'Hangi öğrencilerin çalışmalarını tamamladığını, hangi ödevlerin henüz tamamlanmadığını görür.',",
    yeni: "'Hangi öğrencilerin çalışmalarını tamamladığını görür.',",
    bekleyen: 'tamamlanmamış ödev öğretmene anlatılıyor',
  },
  {
    ad: 'Öğretmenin zaman kazancı maddesi silinirse',
    dosya: SAYFA,
    eski: 'Bürokratik ödev kontrolü',
    yeni: 'Ödev kontrolü',
    bekleyen: 'öğretmenin zaman kazancı anlatılıyor',
  },
  {
    ad: 'Türkçe yazım düzeltmesi geri alınırsa (imkânı → imkanı)',
    dosya: SAYFA,
    eski: 'tespit etme imkânı sunar.',
    yeni: 'tespit etme imkanı sunar.',
    bekleyen: 'yazım: "imkânı"',
  },
  {
    ad: 'Türkçe yazım düzeltmesi geri alınırsa (Motivasyon → Motive)',
    dosya: SAYFA,
    eski: "'Süreç Odaklı Motivasyon',",
    yeni: "'Süreç Odaklı Motive',",
    bekleyen: 'yazım: "Motivasyon"',
  },
  {
    ad: 'Veli maddesi brief metninden çıkarsa',
    dosya: SAYFA,
    eski: 'karmaşık grafikler yerine anlaşılır, somut ve yapıcı verilerle',
    yeni: 'grafiklerle',
    bekleyen: 'velinin gördüğü: karmaşık grafik değil somut veri',
  },
  {
    // İKİ YÖNLÜ KİLİDİN BİRİNCİ YARISI.
    ad: '"eksik" veli bölümüne geri gelirse',
    dosya: SAYFA,
    eski: 'gelişimini güçlendirebileceği konu alanlarını takip edebilir.',
    yeni: 'eksik olduğu konu alanlarını takip edebilir.',
    bekleyen: 'veli bölümünün KENDİ metninde "eksik"',
  },
  {
    // İKİ YÖNLÜ KİLİDİN İKİNCİ YARISI — tek başına birinciyi KIRMAZ.
    ad: '"eksik olduğu konu alanları" sayfadan tamamen silinirse',
    dosya: SAYFA,
    eski: 'Yanlış yaptığı soruları ve eksik olduğu\n          konu alanlarını da görünür hâle getirir.',
    yeni: 'Yanlış yaptığı soruları da görünür hâle getirir.',
    bekleyen: '"eksik olduğu konu alanları" yazıyor',
  },
  {
    ad: 'Sayfaya övgü sıfatı girerse',
    dosya: SAYFA,
    eski: '          Bir öğretmenin sınıf deneyiminden doğdu.',
    yeni: '          Bir öğretmenin sınıf deneyiminden doğdu. Vizyoner ve benzersiz bir ürün.',
    bekleyen: 'devrim dili',
  },
  {
    ad: 'Kapanış olumsuz tanımlamaya dönerse',
    dosya: SAYFA,
    eski: '            Öğrenmenin sonu yok.\n',
    yeni: '            SEKİZ sadece bir ödev takip uygulaması değildir.\n',
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
