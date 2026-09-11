/**
 * VELİ ONAM METNİ — 0034.
 *
 * NEDEN BURADA, VERİTABANINDA DEĞİL
 * SEKİZ statik bir site. Metni veritabanından çekseydik veli onam
 * ekranını görebilmek için fazladan bir istek beklerdi ve metnin geçmişi
 * hiçbir yerde tutulmazdı. Burada duruyor: geçmişi git'te, sürümü
 * veritabanında.
 *
 * SÜRÜM NEDEN VAR
 * Veritabanına giren şey metnin kendisi değil, SÜRÜMÜ. Metin değişip
 * sürüm sabit kalsaydı, eski onaylar yeni metni sessizce kapsardı — yani
 * veli okumadığı bir şeyi onaylamış sayılırdı. `onam-metni.test.ts`
 * metnin hash'ini sürümle birlikte kilitliyor: metne dokunan, sürümü de
 * yükseltmek zorunda kalıyor.
 *
 * BURADAKİ HER CÜMLE ÜRÜNÜN GERÇEKTE YAPTIĞI ŞEY.
 * Uydurma yok, iyimser yuvarlama yok:
 *   - barındırma bölgesi `docs/kvkk-notlari.md`'de teyitli (Zürih)
 *   - çözüm fotoğraflarının imzalı URL'i kısa ömürlü
 *     (`supabase/functions/dosya-url/index.ts`, GECERLILIK_SN = 60)
 *   - öğrencinin öğretmeniyle yazışması veliye KAPALI (0025)
 *   - okul adı ÇOCUĞUN KAYDINDA tutulmuyor (`siniflar` yalnız
 *     seviye+şube; `ad` ondan türetiliyor) — ama uygulamanın kimliğinde
 *     VAR: giriş ekranında görünür metin ve mührün `alt` metni
 *     (`SchoolCrest.tsx`, `GirisEkrani.tsx`)
 *   - bir öğretmen yalnız KENDİ sınıflarındaki öğrenciyi görüyor,
 *     sahip ise yönetim için hepsini (`_ogretmenin_ogrencisi`,
 *     `_yonetici`; `supabase/testler/ogretmen_kapsami_testleri.sql`)
 *
 * ---------------------------------------------------------------------------
 * METİN ÖĞRETMENİN OKUMALARIYLA ŞEKİLLENDİ. Sürüm sürüm ne değişti:
 *
 * 3 — ÜÇ ŞEY KALKTI: yapay zekâ bölümü, "cevap anahtarı veliye
 *     gösterilmez" cümlesi, özel derse ait ders planı/ödeme satırı. Ve
 *     BİR HATA DÜZELDİ: "matematik zümresindeki öğretmenler — dört kişi"
 *     yanlıştı; her öğretmen yalnız kendi sınıfını görüyor.
 *
 *     Kural 5 ve Kural 6 ÜRÜNE ait, yerlerinde duruyor ve
 *     `guvenlik_testleri.sql` 8./10. gruplarında ölçülmeye devam ediyor —
 *     metinden çıkmaları onları değiştirmiyor.
 *
 * 4 — "60 SANİYE" RAKAMI KALKTI. Öğretmen sordu: "yani öğretmen ödev
 *     kâğıdına sadece altmış saniye mi bakabilecek?" Hayır — o süre
 *     BAĞLANTININ ÖMRÜ; ekranlar fotoğrafı her açışta yeniden adresliyor
 *     (`dosyaAdresi()`). Ama cümle ÜRÜNÜN SAHİBİNİ yanılttıysa veliyi de
 *     yanıltır. Metin artık ne olduğunu ve ne OLMADIĞINI birlikte
 *     söylüyor.
 *
 * 5 — "OKULUN ADI HİÇBİR YERDE SAKLANMIYOR" CÜMLESİ YANLIŞTI. Öğretmen
 *     "ama logoda var" dedi ve haklıydı. "Çocuğun kaydında yok" ile
 *     "uygulamada hiçbir yerde yok" aynı şey değil; ilki doğru, ikincisi
 *     yanlıştı. Daha kötüsü, TESTLER O YANLIŞ CÜMLEYİ KİLİTLİYORDU —
 *     ölçüm, yanlış bir iddiayı koruduğunda kusuru bulmaz, gizler. Artık
 *     `onam-metni.test.ts` `SchoolCrest.tsx`'i okuyup metnin bu
 *     görünürlüğü İNKÂR ETMEDİĞİNİ ölçüyor.
 *
 * 6 — "çocuğunuza ait bir kayıt değil" kuyruğu kalktı (öğretmenin
 *     isteği). Cümle zaten "kaydına yazılmıyor" diye başlıyor; kuyruk
 *     aynı şeyi ikinci kez söylüyordu.
 * ---------------------------------------------------------------------------
 *
 * BİLİNEN BOŞLUK: özel ders öğrencilerinde `dersler` ve `odemeler`
 * gerçekten tutuluyor ve veli ödemeleri kendi panelinde görüyor; metin
 * artık bunu saymıyor. Öğretmene söylendi, kararı tekrarlandı; kayıt
 * `docs/kvkk-notlari.md`'de.
 *
 * BU METİN HUKUKİ GÖRÜŞ DEĞİLDİR. Ürünün ne yaptığını dürüstçe anlatır;
 * mevzuata uygunluk değerlendirmesi okul yönetiminin ve gerekiyorsa bir
 * hukukçunun işidir (`docs/kvkk-notlari.md`).
 */

/**
 * Metnin sürümü. Veritabanındaki `_gecerli_onam_surumu()` ile BİREBİR aynı
 * olmak zorunda; testi `onam-metni.test.ts` migration dosyasını okuyarak
 * yapıyor.
 *
 * Metni değiştirirken bunu da yükseltin — yoksa test kırmızı olur.
 */
export const ONAM_SURUMU = '2026-09-6';

export type OnamBolumu = {
  readonly baslik: string;
  readonly maddeler: readonly string[];
};

export const ONAM_BASLIK = 'Veli onam metni';

export const ONAM_GIRIS =
  'SEKİZ, çocuğunuzun ödevlerini ve gelişimini takip etmek için ' +
  'kullanılan bir uygulamadır. Çocuğunuz kendi koduyla giriyor, ödevlerini ' +
  'görüyor ve çözümünü gönderiyor; siz de kendi kodunuzla gidişatı ' +
  'izliyorsunuz. Devam etmeden önce hangi bilgilerin tutulduğunu, kimin ' +
  'görebildiğini ve nerede saklandığını okumanızı istiyoruz.';

export const ONAM_BOLUMLERI: readonly OnamBolumu[] = [
  {
    baslik: 'Neye izin veriyorsunuz',
    maddeler: [
      'Çocuğunuzun SEKİZ öğrenci uygulamasını kullanmasına: kendi ' +
        'koduyla girip ödevlerini görmesine, çözümünü göndermesine ve ' +
        'sonucunu okumasına.',
      'Aşağıda sayılan bilgilerin — adı, soyadı, sınıfı, ödevleri ve ' +
        'notları dâhil — bu uygulamada saklanmasına.',
    ],
  },
  {
    baslik: 'Hangi bilgiler tutuluyor',
    maddeler: [
      'Çocuğunuzun adı ve soyadı.',
      'Sınıfı — yalnız seviye ve şube olarak, örneğin 9A.',
      'Okulun adı çocuğunuzun kaydına yazılmıyor; kayıtta yalnız sınıfı ' +
        'var. Okulun adı ve arması uygulamanın giriş ekranında zaten ' +
        'yazılı.',
      'Ödevleri: cevapları, notu (puanı) ve öğretmen yorumu.',
      'Ödev için yüklediği çözüm kâğıdı fotoğrafı.',
      'Sizinle öğretmen arasındaki mesajlar.',
      'Giriş kodları — kod bir şifredir, başkasıyla paylaşmayın.',
      'Adres, telefon, kimlik numarası, doğum tarihi ve fotoğrafı ' +
        'istenmiyor ve tutulmuyor.',
    ],
  },
  {
    baslik: 'Kim görebiliyor',
    maddeler: [
      'Siz, kendi kodunuzla girdiğinizde.',
      'Çocuğunuz, kendi kodunda kendi bilgilerini.',
      'Çocuğunuzun dersine giren öğretmen. Her öğretmen yalnız kendi ' +
        'sınıflarındaki öğrencileri görüyor; başka bir sınıfın öğretmeni ' +
        'çocuğunuzun bilgilerine erişemiyor.',
      'Platformu yöneten öğretmen, yönetim için sistemin tamamını ' +
        'görebiliyor.',
      'Başka hiçbir veli ve başka hiçbir öğrenci görmez.',
      'Çocuğunuzun öğretmeniyle yazıştığı ayrı bir bölüm vardır; orayı ' +
        'siz görmezsiniz. Sizin yazışmanızı da o görmez.',
    ],
  },
  {
    baslik: 'Nerede saklanıyor',
    maddeler: [
      'Bilgiler Supabase üzerinde, İsviçre’nin Zürih bölgesindeki ' +
        'sunucularda tutuluyor. Yani veriler Türkiye dışında saklanıyor.',
      'Çözüm fotoğrafları internette açık bir adreste durmuyor.',
      'Fotoğraf her açılışta, yalnız onu açan kişiye özel ve kısa ömürlü ' +
        'bir bağlantıyla getiriliyor. Bağlantı kısa sürede geçersiz ' +
        'oluyor; bu, bağlantı başkasının eline geçerse çalışmasın diye. ' +
        'Öğretmenin fotoğrafa ne kadar bakabildiğiyle ilgisi yok — ' +
        'dilediği zaman, dilediği kadar açabiliyor.',
      'Şifreler açık hâlde saklanmıyor.',
    ],
  },
  {
    baslik: 'Onayınızı vermezseniz',
    maddeler: [
      'Veli paneline giremezsiniz: çocuğunuzun ödevlerini, notlarını ve ' +
        'öğretmenle yazışmayı göremezsiniz.',
      'Çocuğunuzun kendi girişi bundan kendiliğinden etkilenmez; o ' +
        'kendi koduyla ödevlerini görmeye ve göndermeye devam eder. ' +
        'Çocuğunuzun uygulamayı kullanmasını istemiyorsanız öğretmene ' +
        'söyleyin, hesabı kapatılır.',
      'Onayınızı sonradan geri almak isterseniz öğretmeninize söylemeniz ' +
        'yeterli.',
    ],
  },
];

/**
 * Düğmenin hemen üstünde duran özet.
 *
 * Onam ekranı uzun; veli aşağı inip düğmeye bastığında NEYE bastığını
 * tek cümlede görmeli. Metnin bir parçası olduğu için hash kilidine de
 * dâhil — sessizce değiştirilemez.
 */
export const ONAM_OZET =
  'Onaylayarak, çocuğumun SEKİZ öğrenci uygulamasını kullanmasına ve ' +
  'yukarıda sayılan bilgilerin saklanmasına izin veriyorum.';

/**
 * Metnin düz hâli — hash kilidi ve ölçümler bunu kullanıyor.
 *
 * Bölümlerden TÜRETİLİYOR, ayrıca yazılmıyor: iki yerde tutulsaydı biri
 * değişip diğeri kalabilir ve kilit yanlış metni koruyabilirdi.
 */
export const ONAM_METNI: string = [
  ONAM_BASLIK,
  ONAM_GIRIS,
  ...ONAM_BOLUMLERI.map(
    (b) => `${b.baslik}\n${b.maddeler.map((m) => `- ${m}`).join('\n')}`,
  ),
  ONAM_OZET,
].join('\n\n');
