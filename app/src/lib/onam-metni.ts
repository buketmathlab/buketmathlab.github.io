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
 *   - çözüm fotoğraflarının imzalı URL'i 60 saniyelik
 *     (`supabase/functions/dosya-url/index.ts`, GECERLILIK_SN = 60)
 *   - test puanlaması deterministik, yapay zekâ yok (Kural 5;
 *     `supabase/testler/guvenlik_testleri.sql`)
 *   - veli cevap anahtarını hiç görmüyor (Kural 6; 0025 ve 8./10. gruplar)
 *   - öğrencinin öğretmeniyle yazışması veliye KAPALI (0025)
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
export const ONAM_SURUMU = '2026-09-1';

export type OnamBolumu = {
  readonly baslik: string;
  readonly maddeler: readonly string[];
};

export const ONAM_BASLIK = 'Veli onam metni';

export const ONAM_GIRIS =
  'SEKİZ, çocuğunuzun ödevlerini ve gelişimini takip etmek için ' +
  'kullanılan bir uygulamadır. Devam etmeden önce hangi bilgilerin ' +
  'tutulduğunu, kimin görebildiğini ve nerede saklandığını okumanızı ' +
  'istiyoruz.';

export const ONAM_BOLUMLERI: readonly OnamBolumu[] = [
  {
    baslik: 'Hangi bilgiler tutuluyor',
    maddeler: [
      'Çocuğunuzun adı soyadı ve sınıfı.',
      'Ödev cevapları, puanı ve öğretmen yorumu.',
      'Ödev için yüklediği çözüm kâğıdı fotoğrafı.',
      'Sizinle öğretmen arasındaki mesajlar.',
      'Özel ders alıyorsa ders planı ve ödeme kaydı.',
      'Giriş kodları — kod bir şifredir, başkasıyla paylaşmayın.',
    ],
  },
  {
    baslik: 'Kim görebiliyor',
    maddeler: [
      'Siz, kendi kodunuzla girdiğinizde.',
      'Çocuğunuz, kendi kodunda kendi bilgilerini.',
      'Matematik zümresindeki öğretmenler — dört kişi.',
      'Başka hiçbir veli ve başka hiçbir öğrenci görmez.',
      'Çocuğunuzun öğretmeniyle yazıştığı ayrı bir bölüm vardır; orayı ' +
        'siz görmezsiniz. Sizin yazışmanızı da o görmez.',
      'Cevap anahtarı veliye hiçbir zaman gösterilmez.',
    ],
  },
  {
    baslik: 'Nerede saklanıyor',
    maddeler: [
      'Bilgiler Supabase üzerinde, İsviçre’nin Zürih bölgesindeki ' +
        'sunucularda tutuluyor. Yani veriler Türkiye dışında saklanıyor.',
      'Çözüm fotoğrafları herkese açık bir adreste durmuyor; yalnız ' +
        'yetkili kişiye, 60 saniye geçerli tek kullanımlık bir bağlantıyla ' +
        'açılıyor.',
      'Şifreler açık hâlde saklanmıyor.',
    ],
  },
  {
    baslik: 'Yapay zekâ',
    maddeler: [
      'Test puanlaması yapay zekâ ile yapılmaz. Puan, cevap anahtarıyla ' +
        'karşılaştırılarak hesaplanır; aynı kâğıt her zaman aynı sonucu ' +
        'verir.',
      'Çocuğunuzun çalışması bugün hiçbir yapay zekâ servisine ' +
        'gönderilmiyor. İleride böyle bir şey planlanırsa ayrıca ' +
        'bilgilendirilirsiniz.',
    ],
  },
  {
    baslik: 'Onayınızı vermezseniz',
    maddeler: [
      'Veli paneline giremezsiniz. Çocuğunuzun kendi girişi bundan ' +
        'etkilenmez; o kendi koduyla ödevlerini görmeye ve göndermeye ' +
        'devam eder.',
      'Fikrinizi değiştirirseniz öğretmeninize söylemeniz yeterli.',
    ],
  },
];

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
].join('\n\n');
