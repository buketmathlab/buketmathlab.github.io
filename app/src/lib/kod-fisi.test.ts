import { describe, expect, it } from 'vitest';
import { ADRES, fisMetni, fisleriUret, sayfalaraBol, SAYFA_BASINA } from './kod-fisi';

const KAYITLAR = [
  { ad: 'Ali Yılmaz', sinif: '9A', kodlar: { ogrenci: 'ABC12345', veli: 'XYZ98765' } },
  { ad: 'Ayşe Demir', sinif: '9A', kodlar: { ogrenci: 'DEF67890', veli: 'UVW54321' } },
  // Kodu eksik öğrenci: fiş üretmemeli.
  { ad: 'Kodsuz Çocuk', sinif: '9A', kodlar: {} },
  // Yalnız öğrenci kodu var; veli sayfasında yer almamalı.
  { ad: 'Velisiz Kayıt', sinif: '9A', kodlar: { ogrenci: 'GHI11111' } },
];

describe('fisleriUret', () => {
  it('öğrenci fişleri yalnız ÖĞRENCİ kodunu taşır', () => {
    const fisler = fisleriUret(KAYITLAR, 'ogrenci');
    expect(fisler.map((f) => f.kod)).toEqual(['ABC12345', 'DEF67890', 'GHI11111']);
  });

  it('veli fişleri yalnız VELİ kodunu taşır', () => {
    const fisler = fisleriUret(KAYITLAR, 'veli');
    expect(fisler.map((f) => f.kod)).toEqual(['XYZ98765', 'UVW54321']);
  });

  /**
   * 0044: fişler NUMARA SIRASINDA basılıyor; numara fişte görünmeseydi
   * sıra keyfî görünürdü. Numarası olmayan öğrencide alan `null` —
   * "—" bile yazılmıyor, özel ders öğrencisinde numarasızlık olağan.
   */
  it('okul numarası fişe taşınıyor, yoksa null', () => {
    const fisler = fisleriUret(
      [
        { ad: 'Numaralı Öğrenci', no: '601', sinif: '9A', kodlar: { ogrenci: 'AAA11111' } },
        { ad: 'Numarasız Öğrenci', sinif: 'Özel ders', kodlar: { ogrenci: 'BBB22222' } },
      ],
      'ogrenci',
    );
    expect(fisler.map((f) => f.no)).toEqual(['601', null]);
  });

  /**
   * TURUN ÇEKİRDEK GÜVENCESİ. Öğrenci fişlerinin hiçbirinde bir veli kodu
   * geçmemeli — tersi de. Alan adına değil GERÇEK DEĞERE bakılıyor
   * (0021/0026'daki sızıntı testi deseni).
   */
  it('iki sayfa birbirinin kodunu HİÇ taşımıyor', () => {
    const ogrenciKodlari = KAYITLAR.map((k) => k.kodlar.ogrenci).filter(Boolean);
    const veliKodlari = KAYITLAR.map((k) => k.kodlar.veli).filter(Boolean);

    const ogrenciFisleri = fisleriUret(KAYITLAR, 'ogrenci').map((f) => f.kod);
    const veliFisleri = fisleriUret(KAYITLAR, 'veli').map((f) => f.kod);

    for (const veliKodu of veliKodlari) {
      expect(ogrenciFisleri).not.toContain(veliKodu);
    }
    for (const ogrenciKodu of ogrenciKodlari) {
      expect(veliFisleri).not.toContain(ogrenciKodu);
    }
  });

  it('kodu olmayan öğrenci fiş üretmiyor', () => {
    expect(fisleriUret(KAYITLAR, 'ogrenci').some((f) => f.ad === 'Kodsuz Çocuk')).toBe(false);
    expect(fisleriUret(KAYITLAR, 'veli').some((f) => f.ad === 'Velisiz Kayıt')).toBe(false);
  });

  it('veli fişi de çocuğun adını taşıyor — kimin velisi olduğu belli olsun', () => {
    expect(fisleriUret(KAYITLAR, 'veli')[0]).toMatchObject({ ad: 'Ali Yılmaz', sinif: '9A' });
  });

  it('boş listede fiş üretmiyor', () => {
    expect(fisleriUret([], 'ogrenci')).toEqual([]);
  });
});

describe('fisMetni', () => {
  it('iki tür farklı başlık ve etiket veriyor', () => {
    expect(fisMetni('ogrenci').baslik).toBe('Öğrenci girişi');
    expect(fisMetni('veli').baslik).toBe('Veli girişi');
    expect(fisMetni('ogrenci').kodEtiketi).not.toBe(fisMetni('veli').kodEtiketi);
  });

  /**
   * ADRES DÜZ METİNLE BEKLENİYOR — ve bu bir ölçüm onarımı.
   *
   * Bu test eskiden `toContain(ADRES)` diyordu; yani sabiti aynı
   * modülden import edip KENDİSİYLE karşılaştırıyordu. Adres ne olursa
   * olsun yeşil kalırdı: yanlış bir alan adı bassak, hiç kimsenin
   * açamayacağı bir adres bassak bile. Kırılamayan bir ölçüm hiçbir şey
   * ölçmez — 0042'de aynı desenin SQL tarafındaki eşi bulunmuştu
   * (`pg_get_function_identity_arguments`).
   *
   * Artık fişte gerçekten hangi harflerin bulunduğu yazılı. Alan adı bir
   * gün değişirse bu test kırmızı yanacak ve DEĞİŞTİRİLMESİ GEREKTİĞİ
   * için yanacak — sessizce uyum sağlamayacak.
   */
  it('her iki fişte de alan adı düz metin olarak yazıyor', () => {
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain('sekizkyal.com');
    expect(fisMetni('veli').satirlar.join(' ')).toContain('sekizkyal.com');
  });

  /**
   * NEGATİF KONTROL: eski adres fişte GEÇMİYOR.
   *
   * Pozitif ölçüm tek başına yetmezdi — `sekizkyal.com/yeni/` yazsaydık
   * ya da iki adres birden bassaydık üstteki test yine geçerdi. Fişte
   * `/yeni/` de olmamalı: çocuk fazladan altı karakter yazmasın diye
   * kısalttık, sonradan geri sızmasın.
   */
  it('fişte eski adres ve /yeni/ kuyruğu geçmiyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const metin = fisMetni(tur).satirlar.join(' ');
      expect(metin).not.toContain('github.io');
      expect(metin).not.toContain('/yeni/');
    }
  });

  it('ADRES sabiti fişte gerçekten kullanılıyor', () => {
    // Sabit ile basılan metnin bağı yine de ölçülüyor: biri ADRES'i
    // değiştirip cümleye elle bir adres yazarsa bu yakalanır.
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain(ADRES);
  });

  /**
   * KURULUM YÖNERGESİ — öğretmenin isteği: "hem veli kod fişinde hem
   * öğrenci kod fişinde bu detaya yer verilmeli".
   *
   * İKİ FİŞ AYRI AYRI ÖLÇÜLÜYOR. Tek bir fişe bakmak yetmezdi: metin
   * fonksiyonu iki ayrı dal döndürüyor ve biri güncellenip öteki unutulsa
   * yalnız bir dala bakan ölçüm bunu göremezdi.
   */
  it('iki fişte de telefona ekleme yönergesi var', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = fisMetni(tur);
      expect(m.kurulumBasligi).toContain('uygulama');
      expect(m.kurulum.join(' ')).toContain('Ana Ekrana Ekle');
      expect(m.kurulum.join(' ')).toContain('Ana ekrana ekle');
    }
  });

  /**
   * HER İKİ TELEFON DA ANLATILIYOR. Yalnız birini yazmak, ailelerin
   * yarısını yolda bırakırdı — iPhone'da yol "Paylaş"ın içinden,
   * Android'de tarayıcı menüsünden geçiyor.
   */
  it('hem iPhone hem Android yolu yazıyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      // KÜÇÜK HARFE TÜRKÇE KURALIYLA İNİLİYOR. `toLowerCase()` "I"yı "i"
      // yapar ve Türkçe metinde yanlış eşleşme üretir; depodaki kural
      // (0043, ayrıştırıcı) burada da geçerli.
      const k = fisMetni(tur).kurulum.join(' ').toLocaleLowerCase('tr');
      expect(k).toContain('iphone');
      expect(k).toContain('paylaş');
      expect(k).toContain('android');
      expect(k).toContain('menü');
    }
  });

  /**
   * TARAYICININ ADI GEÇMELİ — ve bu test bir SAHA BULGUSUNUN karşılığı.
   *
   * Yönerge önce yalnız "Paylaş → Ana Ekrana Ekle" diyordu. Öğretmen
   * kendi iPhone'unda deneyip YAPAMADI: bağlantıyı bir uygulamanın
   * içinden açmıştı ve iOS'ta uygulama içi tarayıcıda "Ana Ekrana Ekle"
   * seçeneği hiç yok. Safari'de açınca hemen oldu.
   *
   * Yani kusur üründe değil yönergedeydi ve ancak gerçek bir telefonda
   * göründü. Bu satır o dersin geri sızmasını engelliyor: biri bir gün
   * "fiş kalabalık olmuş" deyip tarayıcı adlarını atarsa test yanar.
   */
  it('kurulum yönergesi tarayıcının adını söylüyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const k = fisMetni(tur).kurulum.join(' ');
      expect(k).toContain('Safari');
      expect(k).toContain('Chrome');
    }
  });

  /**
   * MUHATAP KURULUM SATIRINDA DA DOĞRU: öğrenciye "ekle", veliye
   * "ekleyin". Fişin geri kalanında verilen kararın aynısı; tek bir
   * ortak cümle yazmak kolay olurdu ama veliye sen demek olurdu.
   */
  it('kurulum başlığı da öğrenciye sen, veliye siz diyor', () => {
    expect(fisMetni('ogrenci').kurulumBasligi).toContain('Telefonuna');
    expect(fisMetni('veli').kurulumBasligi).toContain('Telefonunuza');
  });

  /**
   * Öğrenciye "sen", veliye "siz" — 0026'da karne cümlelerinde verilen
   * kararın aynısı. Yanlış muhatap, fişi tuhaf yapar.
   */
  it('öğrenciye sen, veliye siz diye sesleniyor', () => {
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain('git');
    expect(fisMetni('veli').satirlar.join(' ')).toContain('girin');
  });

  /**
   * ÜST SINIR GEVŞEDİ (60 → 130) VE SEBEBİ KAYDA DEĞER.
   *
   * Bu test "kâğıda sığsın" demenin VEKİLİYDİ: harf sayısını sayarak
   * sayfaya sığmayı tahmin ediyordu. Artık sığmayı DOĞRUDAN ölçen bir
   * şey var — `kod-fisi-denetimi.mjs` ızgaranın A4'ün 277 mm'sini
   * aşmadığını ve hiçbir fişin kutusundan taşmadığını ölçüyor, ikisi de
   * kusur yerleştirilerek ısırtıldı.
   *
   * Öğretmen tarifin ayrıntılanmasını isteyince 60 harflik vekil, asıl
   * gereksinimle ÇELİŞTİ. Vekili zorlamak yerine gerçek ölçüme
   * bırakıldı; buradaki sayı yalnız "bir paragraf yazılmasın" diyen
   * kaba bir tavan.
   */
  it('fiş metni bir paragrafa dönüşmüyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      for (const satir of [...fisMetni(tur).satirlar, ...fisMetni(tur).kurulum]) {
        expect(satir.length).toBeLessThanOrEqual(130);
      }
    }
  });

  /**
   * ÖĞRETMENİN İSTEDİĞİ İFADE: "uygulama gibi" değil "uygulama olarak".
   */
  it('başlık "uygulama olarak" diyor', () => {
    expect(fisMetni('ogrenci').kurulumBasligi).toContain('uygulama olarak');
    expect(fisMetni('veli').kurulumBasligi).toContain('uygulama olarak');
  });

  /**
   * DÜĞMENİN YERİ TARİF EDİLİYOR — öğretmenin ikinci ve üçüncü eksiği.
   *
   * Önce "Safari'de aç" demek yetmedi: *"paylaş butonunu nereden
   * bulacak?"* Sonra yazdığım tarif ESKİYDİ: "ekranın alt ortasındaki
   * paylaş simgesi" dedim, öğretmen "orada üç noktalı bir simge yok mu?"
   * diye sordu ve haklıydı. Bugünkü iOS'ta alttaki düğme üç nokta;
   * Apple'ın kendi adımı da "share button (three dots), then tap Share".
   * Öğretmen kendi telefonunda doğruladı.
   *
   * İKİ YER AYRI AYRI ÖLÇÜLÜYOR: iPhone'da ALTTA, Android'de SAĞ ÜSTTE.
   * Yalnız "üç nokta" aransaydı, iki satırdan biri silinse bile test
   * yeşil kalırdı — öteki satırdaki "üç nokta" yetiyor olurdu.
   */
  it('düğmenin yeri iki telefonda da ayrı ayrı yazıyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const k = fisMetni(tur).kurulum.join(' ');
      expect(k).toContain('Alttaki üç nokta');
      expect(k).toContain('Sağ üstteki üç nokta');
      expect(k).toContain('Paylaş');
    }
  });

  /**
   * MENÜ SİMGESİ ÇİZİLMİYOR, KELİMESİ YAZILIYOR.
   *
   * "⋮" ya da "⋯" gibi karakterler yazı tipine göre boş kutu çıkıyor ve
   * kâğıtta bunu düzeltmenin yolu yok. Karar bir kez verildi; bu test
   * geri sızmasını engelliyor.
   */
  it('kurulum metninde tipografik üç nokta karakteri yok', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const k = fisMetni(tur).kurulum.join(' ');
      expect(k).not.toContain('⋮');
      expect(k).not.toContain('⋯');
      expect(k).not.toContain('…');
    }
  });

  /**
   * ANDROID'DE İKİ ETİKET DE YAZIYOR. Chrome, koşullar sağlanınca
   * menüde "Ana ekrana ekle" yerine "Uygulamayı yükle" gösteriyor. Tek
   * etiket yazsaydık, öteki etiketi gören veli aradığını bulamazdı.
   */
  it('Android satırı iki menü etiketini de veriyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const k = fisMetni(tur).kurulum.join(' ');
      expect(k).toContain('Ana ekrana ekle');
      expect(k).toContain('Uygulamayı yükle');
    }
  });

  /**
   * NE GÖRECEĞİ SAYILARAK YAZILDI. Cümleler kabuklardaki gerçek
   * sekmelerden çıktı; "burada görürsün" gibi içi boş bir ifadeye geri
   * dönülürse bu test yanar.
   *
   * Öğretmen cümleleri iki kez kısalttı: önce "takip eder" istedi
   * ("görür" değil), sonra mesajlaşmanın hiç anılmamasını. Fiş bir
   * tanıtım broşürü değil; ilk gün ne yapılacağını söylüyor.
   */
  it('ne göreceği gerçekten tarif ediliyor', () => {
    const o = fisMetni('ogrenci').satirlar.join(' ');
    expect(o).toContain('Ödevlerini takip eder');
    expect(o).toContain('gönderir');
    expect(o).toContain('gelişimini izlersin');

    const v = fisMetni('veli').satirlar.join(' ');
    expect(v).toContain('ödevlerini takip eder');
    expect(v).toContain('gelişimini izlersiniz');
  });

  /**
   * NEGATİF KONTROL — MESAJLAŞMA FİŞTE ANILMIYOR.
   *
   * Öğretmenin kararı: *"o mesajlaşma kısmına hiç girme."* Özellik
   * duruyor, fişte anlatılmıyor. Bir gün "bir cümle daha ekleyelim"
   * denirse bu test yanar ve kararın konuşulmuş olduğunu hatırlatır.
   */
  it('fişte mesajlaşmadan söz edilmiyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const metin = fisMetni(tur).satirlar.join(' ').toLocaleLowerCase('tr');
      expect(metin).not.toContain('yazış');
      expect(metin).not.toContain('mesaj');
    }
  });

  /**
   * GİRİŞ CÜMLESİ: "gir" değil "giriş yap" — öğretmenin sözü.
   */
  it('giriş cümlesi "giriş yap" diyor', () => {
    expect(fisMetni('ogrenci').satirlar.join(' ')).toContain('giriş yap.');
    expect(fisMetni('veli').satirlar.join(' ')).toContain('giriş yapın.');
  });

  /**
   * NEGATİF KONTROL — OLMAYAN VAAT SIZMASIN.
   *
   * `Ödemeler` sekmesi YALNIZ özel ders velisinde var. Fişe yazılsaydı
   * yüzlerce okul velisine olmayan bir şey vaat edilmiş olurdu.
   * Öğretmenin ödeme kuralı da ayrıca bunu yasaklıyor.
   */
  it('fişte Ödemeler vaat edilmiyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const metin = [...fisMetni(tur).satirlar, ...fisMetni(tur).kurulum].join(' ');
      expect(metin.toLocaleLowerCase('tr')).not.toContain('ödeme');
    }
  });

  /**
   * NEGATİF KONTROL — İMZA GERİ GELMESİN. Öğretmen kaldırttı; fiş
   * metninde adı hiç geçmemeli.
   */
  it('fiş metninde imza geçmiyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const metin = [...fisMetni(tur).satirlar, ...fisMetni(tur).kurulum].join(' ');
      expect(metin).not.toContain('Topuzoğlu');
    }
  });
});

describe('sayfalaraBol', () => {
  const fis = (i: number) => ({
    tur: 'ogrenci' as const,
    ad: 'Ö' + i,
    no: String(600 + i),
    sinif: '9A',
    kod: 'K' + i,
  });

  /**
   * A4 BAŞINA 8 — 10 DEĞİL.
   *
   * Kurulum tarifi ayrıntılanınca 10 fişlik düzene tek satır bile
   * sığmadı (ölçüm: satır 2,62 mm, sayfa payı 9,8 mm). Öğretmen kâğıt
   * bedelini bilerek kabul etti. Bu sayı sessizce 10'a dönerse metin
   * kâğıttan taşar; o yüzden burada kilitli.
   */
  it('A4 başına 8 fiş', () => {
    expect(SAYFA_BASINA).toBe(8);
    const sayfalar = sayfalaraBol(Array.from({ length: 25 }, (_, i) => fis(i)));
    expect(sayfalar.map((s) => s.length)).toEqual([8, 8, 8, 1]);
  });

  it('tam sayfa dolduğunda boş sayfa açmıyor', () => {
    expect(sayfalaraBol(Array.from({ length: 16 }, (_, i) => fis(i)))).toHaveLength(2);
  });

  it('boş listede sayfa yok', () => {
    expect(sayfalaraBol([])).toEqual([]);
  });

  it('hiçbir fiş kaybolmuyor', () => {
    const hepsi = Array.from({ length: 37 }, (_, i) => fis(i));
    expect(sayfalaraBol(hepsi).flat().map((f) => f.kod)).toEqual(hepsi.map((f) => f.kod));
  });
});
