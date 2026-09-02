/**
 * GERİ ALMA KANITI — tanıtım metin turu (öğretmenin yeni brief'i).
 *
 * Bir denetim ancak KIRILDIĞI görüldüğünde bir şey ölçüyordur. Bu betik
 * bu turda eklenen/taşınan ölçümlerin her birini tek tek bozuyor ve
 * `tanitim-denetimi.mjs`'in gerçekten kırıldığını gösteriyor.
 *
 * ÖZELLİKLE İKİ YÖNLÜ KİLİTLER: "isim sloganı hero'da" / "isim sloganı
 * bölüm BAŞLIĞI değil" ve "hero künye satırı KALKTI" / "aynı cümle künye
 * bölümünde DURUYOR" çiftleri AYRI AYRI bozuluyor. Her çift bir kararı
 * iki yönden kilitliyor; yalnız biri kırılsaydı kilit tek yönlü olurdu
 * ve bunu ancak burada görebilirdik.
 *
 * KALKAN BÖLÜMLER DE BURADA ÖLÇÜLÜYOR. Öğretmen bir bölümü kaldırdığında
 * denetimdeki ölçüm silinmiyor, YÖNÜ ÇEVRİLİYOR ("… geri gelmemiş").
 * Aşağıdaki dört yama o yönün gerçekten ısırdığını gösteriyor —
 * kırılmayan bir "yok" ölçümü hiçbir şey ölçmüyor demektir.
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
    // ÇOĞALIRSA da kırılıyor.
    //
    // ÇAPA YİNE TAŞINDI: bir tur önce gelişim bölümünün notundaydı, o
    // bölüm bu turda kalktı. Şimdi öğrenci bölümünün notu.
    ad: 'Marka cümlesi ikinci bir yere serpiştirilirse',
    dosya: SAYFA,
    eski: '      <Not>Öğrenci yalnızca ödev teslim etmez;',
    yeni: '      <Not>Öğrenmenin sonu yok. Öğrenci yalnızca ödev teslim etmez;',
    bekleyen: 'marka cümlesi tam bir yerde',
  },
  {
    /* KALKAN BAŞLIKLAR — her biri geri konunca denetim kırılmalı.
       Ölçümler silinmedi, yönü çevrildi; bu yamalar o yönün gerçekten
       ısırdığını gösteriyor. */
    ad: 'Kalkan "SEKİZ neden var?" bölümü geri konursa',
    dosya: SAYFA,
    eski: '        <SekizNedir />',
    yeni: '        <Bolum baslik="SEKİZ neden var?" />\n        <SekizNedir />',
    bekleyen: 'kalkan başlık geri gelmemiş: "SEKİZ neden var?"',
  },
  {
    ad: 'Kalkan "Sonuç, öğrenmenin bir sonraki adımı" bölümü geri konursa',
    dosya: SAYFA,
    eski: '        <Ogrenci />',
    yeni: '        <Bolum baslik="Sonuç, öğrenmenin bir sonraki adımını gösterir." />\n        <Ogrenci />',
    bekleyen: 'kalkan başlık geri gelmemiş: "Sonuç, öğrenmenin bir sonraki adımını gösterir."',
  },
  {
    ad: 'Kalkan "Puanın ötesinde, gelişim." bölümü geri konursa',
    dosya: SAYFA,
    eski: '        <Iletisim />',
    yeni: '        <Bolum baslik="Puanın ötesinde, gelişim." />\n        <Iletisim />',
    bekleyen: 'kalkan başlık geri gelmemiş: "Puanın ötesinde, gelişim."',
  },
  {
    ad: 'İsim sloganı yeniden bölüm başlığı yapılırsa',
    dosya: SAYFA,
    eski: '        <Kunye />',
    yeni: '        <Bolum baslik="SEKİZ ismini matematiğin sonsuzluk düşüncesinden alır." />\n        <Kunye />',
    bekleyen: 'isim sloganı bölüm BAŞLIĞI değil',
  },
  {
    // KALKAN ALT BAŞLIK GERİ GELİRSE.
    ad: 'Kalkan hero alt başlığı geri konursa',
    dosya: SAYFA,
    eski: '        <p className="mx-auto mt-6 max-w-[36rem] text-[18px]',
    yeni:
      '        <p>Öğrenci gelişimini ve ödev süreçlerini şeffaf, yönetilebilir ve anlamlı verilerle görünür kılmak için tasarlandı.</p>\n        <p className="mx-auto mt-6 max-w-[36rem] text-[18px]',
    bekleyen: 'kalkan alt başlık geri gelmemiş',
  },
  {
    // HERO'NUN TEK TANIM CÜMLESİ.
    ad: 'Hero tanım cümlesi silinirse',
    dosya: SAYFA,
    eski: 'velinin sürece dahil olduğu dijital eğitim platformudur.',
    yeni: 'velinin de yer aldığı bir uygulamadır.',
    bekleyen: 'hero tanım cümlesi: dijital eğitim platformu',
  },
  {
    // VELİ CÜMLESİ HERO'DAN DÜŞERSE.
    ad: 'Hero tanımından veli düşerse',
    dosya: SAYFA,
    eski: 've\n          velinin sürece dahil olduğu dijital eğitim platformudur.',
    yeni: 'dijital eğitim platformudur.',
    bekleyen: 'hero: velinin sürece DAHİL olduğu',
  },
  {
    // KÜNYE SATIRI HERO'YA GERİ GELİRSE — iki yönlü kilidin yarısı.
    ad: 'Künye satırı hero\'ya geri konursa',
    dosya: SAYFA,
    eski: '        <h1 className="mt-10 font-display',
    yeni:
      '        <p>Fikir, pedagojik tasarım ve yazılım geliştirme</p>\n        <h1 className="mt-10 font-display',
    bekleyen: 'hero künye satırı KALKTI',
  },
  {
    // KİLİDİN ÖBÜR YARISI: cümle künyeden de silinirse.
    ad: 'Künye satırı künye bölümünden de silinirse',
    dosya: SAYFA,
    eski: "fikir, pedagojik tasarım ve yazılım geliştirme süreçleri",
    yeni: "SEKİZ'in süreçleri",
    bekleyen: 'aynı cümle künye bölümünde DURUYOR',
  },
  {
    /* ÇAPA ÖĞRETMENİN YENİ METNİNE TAŞINDI: "bir yazılım ofisinde
       değil". İddia aynı, kelimeler öğretmenin. */
    ad: 'Bir sirket urunu olmadigi silinirse',
    dosya: SAYFA,
    eski: '          SEKİZ, bir yazılım ofisinde değil; bir matematik öğretmeninin, Buket Topuzoğlu’nun',
    yeni: '          SEKİZ, bir matematik öğretmeninin, Buket Topuzoğlu’nun',
    bekleyen: 'bir yazılım şirketinin ürünü olmadığı yazıyor',
  },
  {
    ad: "SEKİZ'i kimin tasarladığı silinirse",
    dosya: SAYFA,
    eski: '          uzun yıllara dayanan sınıf deneyiminde şekillendi. Dışarıdan bakılarak kurgulanan',
    yeni: '          uzun yıllara dayanan deneyimle kuruldu. Dışarıdan bakılarak kurgulanan',
    bekleyen: "SEKİZ'i kimin tasarladığı yazıyor",
  },
  {
    /* BİRLEŞİK BÖLÜMÜN BAŞLIĞI — öğretmenin yazdığı gibi (Title Case,
       noktasız). Eski hikâye başlığına dönerse kırılmalı. */
    ad: 'Birleşik bölüm başlığı eski hikâye başlığına dönerse',
    dosya: SAYFA,
    eski: '          Öğretmen Deneyimiyle Şekillenen, Sürekli Gelişen Platform',
    yeni: '          Bir öğretmenin sınıf deneyiminden doğdu.',
    bekleyen: 'birleşik bölüm başlığı öğretmenin yazdığı gibi',
  },
  {
    /* İSİM SLOGANI HERO'DAN DÜŞERSE. Bölüm başlığıyken ölçülüyordu;
       öğretmen bölümü kaldırıp cümleyi hero'ya slogan olarak koydurdu. */
    ad: 'Isim slogani hero\'dan silinirse',
    dosya: SAYFA,
    eski: '          SEKİZ ismini matematiğin sonsuzluk düşüncesinden alır.',
    yeni: '          SEKİZ bir eğitim platformudur.',
    bekleyen: "isim sloganı hero'da",
  },
  {
    /* SLOGAN DÜŞERSE. Sayı TAM ölçülüyor; bu yama düşmeyi kanıtlıyor. */
    ad: 'Slogan birleşik bölümden çıkarsa',
    dosya: SAYFA,
    eski: '          8’in kesintisiz akışı, öğrenmenin bitmeyen doğası: SEKİZ, gelişimi anlık sonuçlara',
    yeni: '          Öğrenmenin bitmeyen doğası: SEKİZ, gelişimi anlık sonuçlara',
    bekleyen: 'slogan tam bir yerde',
  },
  {
    /* ŞEKİL YASAĞI — ÇAPA HERO SLOGANINA TAŞINDI. Yasak listesi aynen
       yerinde; cümle şekil üzerinden yazılırsa denetim kırılıyor. */
    ad: 'Bağ şekil üzerinden kurulursa',
    dosya: SAYFA,
    eski: '          SEKİZ ismini matematiğin sonsuzluk düşüncesinden alır.',
    yeni: '          SEKİZ ismini 8 şeklinden alır.',
    bekleyen: 'brief: "8 şeklinden" geçmiyor',
  },
  {
    /* ÇAPA TAŞINDI: eski çapa ("Bu yüzden SEKİZ ödevi bir görev
       listesi gibi değil") silinen gövdedeydi. Yasak aynı yerde. */
    ad: 'Geri çekilen felsefe cümlesi sayfaya geri konursa',
    dosya: SAYFA,
    eski: '          8’in kesintisiz akışı,',
    yeni: '          Sonsuzluk bir varış değil, bir yöndür. 8’in kesintisiz akışı,',
    bekleyen: 'geri çekilen felsefe cümlesi',
  },
  {
    /* ÖĞRETMENİN METNİ — 3. PARAGRAF (gelecek vizyonu). Kaybolursa sayfa
       ürünün gelişmeye devam edeceğini hiçbir yerde söylemez. */
    ad: 'Gelecek vizyonu paragrafı silinirse',
    dosya: SAYFA,
    eski: '          yeni ihtiyaçlarla ve gelişen teknolojiyle birlikte sürekli gelişmeye, büyümeye',
    yeni: '          yeni ihtiyaçlarla birlikte',
    bekleyen: 'gelecek vizyonu sayfada',
  },
  {
    /* ÖĞRETMENİN METNİ — 2. PARAGRAF (öğrencinin günlük akışı). */
    ad: 'Öğrencinin kendi ritmi paragrafı silinirse',
    dosya: SAYFA,
    eski: '          hatalarını zamanında fark eder ve eksiklerini kendi ritmiyle tamamlar. Süreç',
    yeni: '          hatalarını fark eder. Süreç',
    bekleyen: 'birleşik bölüm 2. paragraf: kendi ritmiyle tamamlar',
  },
  {
    /* KÜNYEDEN KALKAN CÜMLE GERİ KONURSA. */
    ad: 'Künyeye kalkan ölçü cümlesi geri konursa',
    dosya: SAYFA,
    eski: '    </Bolum>\n  );\n}\n\n/* ============================================================\n   KAPANIŞ',
    yeni:
      '      <Not>SEKİZ bu ölçüyle tasarlandı.</Not>\n    </Bolum>\n  );\n}\n\n/* ============================================================\n   KAPANIŞ',
    bekleyen: 'brief: "künyenin kalkan ölçü cümlesi" geçmiyor',
  },
  /* VELİ TARAFINDAKİ "yapmadığı ödevleri" YAMASI KALDIRILDI.
     Öğretmen o cümleyi "öğrencisinin ödev durumunu…" ile değiştirdi;
     ölçüm de bu yüzden denetimden çıkarıldı (gerekçesi orada yazılı).
     Bozulacak bir iddia kalmadığı için yama da kalktı — var olmayan
     bir ölçümü "yakalandı" diye saymak, sayının kendisini bozardı. */
  {
    // ÖĞRENCİNİN GÖNDERDİKTEN SONRA GÖRDÜKLERİ — bu turun isteği.
    ad: 'Öğrencinin puan/ortalama maddesi silinirse',
    dosya: SAYFA,
    eski: "'Ödevini gönderdikten sonra aldığı puanı,",
    yeni: "'Sonuçlarını görür. Eski hâl:",
    bekleyen: 'öğrenci gönderdikten sonra puanını',
  },
  {
    // KORUNAN GÜVENCE 2 — Kural 6 / Part XXI.
    ad: 'Cevap anahtarı güvencesi maddeden düşerse',
    dosya: SAYFA,
    eski: "'Cevap anahtarı ödev tesliminden önce erişime kapalıdır;",
    yeni: "'Cevap anahtarı teslimden sonra görünür.",
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
    // KALICI DİL KURALI 2 — yapılmayan ödev, öğretmen tarafı.
    ad: 'Öğretmen maddesinden "ödevin yapılıp yapılmadığı" düşerse',
    dosya: SAYFA,
    eski: 'yalnızca ödevin yapılıp yapılmadığını değil, ',
    yeni: '',
    bekleyen: 'yapılmayan ödev öğretmene anlatılıyor',
  },
  {
    // BAŞLIK OLARAK "YANLIŞ" YASAĞI.
    ad: 'Bir madde başlığı "Yanlışlar" olursa',
    dosya: SAYFA,
    eski: "'Soru ve Puan Dökümü',",
    yeni: "'Yanlışlar ve Konular',",
    bekleyen: 'hiçbir madde başlığı "yanlış" ile başlamıyor',
  },
  {
    ad: 'Öğretmen başlığı iki ölçeği anlatmayı bırakırsa',
    dosya: SAYFA,
    eski: 'baslik="Öğretmen sınıfın genel ritmini, öğrencinin bireysel gelişimini görür."',
    yeni: 'baslik="Öğretmen süreci görür."',
    bekleyen: 'öğretmen iki ölçekte birden',
  },
  {
    ad: '"Nokta atışı" maddesi eski hâline dönerse',
    dosya: SAYFA,
    eski: 'öğrencilerin bireysel ihtiyaçlarını anında tespit etme imkânı',
    yeni: 'kişiselleştirilmiş ihtiyaçları anında tespit etme imkânı',
    bekleyen: 'nokta atışı müdahale: bireysel ihtiyaçlar',
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
    ad: 'Veli maddesi somut veri demeyi bırakırsa',
    dosya: SAYFA,
    eski: 'Süreci anlaşılır, somut ve anlık verilerle yapıcı bir şekilde takip eder.',
    yeni: 'Süreci takip eder.',
    bekleyen: 'velinin gördüğü: somut, anlık ve yapıcı veri',
  },
  {
    // OLUMSUZ ÖRNEK GERİ GELİRSE.
    ad: '"karmaşık grafikler yerine" geri konursa',
    dosya: SAYFA,
    eski: 'Süreci anlaşılır, somut ve anlık verilerle yapıcı bir şekilde takip eder.',
    yeni: 'Süreci karmaşık grafikler yerine anlaşılır verilerle takip eder.',
    bekleyen: 'olumsuz örnek ("karmaşık grafikler") geri gelmemiş',
  },
  {
    // ÖĞRETMENİN GERİ İSTEDİĞİ CÜMLE SİLİNİRSE.
    ad: 'Veli konu alanları cümlesi silinirse',
    dosya: SAYFA,
    eski: 'Öğrencinin eksik olduğu veya daha fazla çalışabileceği konu alanları',
    yeni: 'Konu alanları',
    bekleyen: 'veli bölümünde konu alanları cümlesi duruyor',
  },
  {
    /* ÇAPA TAŞINDI. Eski yama silinen koyu banttaki cümleye yapışıyordu
       ve ölçtüğü iki kilit bu turda kaldırıldı (gerekçesi denetimde).
       "eksik" GERÇEĞİ hâlâ sayfada: veli bölümündeki cümlede duruyor ve
       kendi ölçümüyle kilitli. Bu yama artık onu kanıtlıyor. */
    ad: 'Veli bölümünden "eksik olduğu" ifadesi silinirse',
    dosya: SAYFA,
    eski: "            'Öğrencinin eksik olduğu veya daha fazla çalışabileceği konu alanları veli tarafından da görülebilir.',",
    yeni: "            'Konu alanları veli tarafından da görülebilir.',",
    bekleyen: 'veli bölümünde konu alanları cümlesi duruyor',
  },
  {
    ad: 'Sayfaya övgü sıfatı girerse',
    dosya: SAYFA,
    eski: '          Öğretmen Deneyimiyle Şekillenen, Sürekli Gelişen Platform',
    yeni: '          Öğretmen Deneyimiyle Şekillenen Benzersiz Platform',
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
    eski: '        <OgretmenDeneyimi />\n        <SekizNedir />',
    yeni: '        <SekizNedir />\n        <OgretmenDeneyimi />',
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
