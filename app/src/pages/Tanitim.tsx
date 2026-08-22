import type { ReactNode } from 'react';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Sekiz8Mark } from '@/components/brand/Sekiz8Mark';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { StarEight } from '@/components/brand/StarEight';
import { GeometricDivider } from '@/components/brand/GeometricDivider';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { EwaluVideo } from '@/components/brand/EwaluVideo';
import { sekizgenYolu } from '@/lib/geometri';

/**
 * SEKİZ tanıtım sayfası — /yeni/tanitim/
 *
 * METİN ÖĞRETMENİNDİR. Bu dosyadaki her başlık, alt başlık ve madde onun
 * yazdığı brief'ten geliyor; benim işim yerleşim, ölçü ve doğrulama.
 *
 * ÜÇ TON KURALI (brief'ten, denetimde de ölçülüyor):
 *   1. Savunmacı / olumsuz cümle yok. Özellikle Ewalu NE OLMADIĞIYLA
 *      anlatılmaz ("ödev değerlendirmez", "öğretmenin yerine geçmez"…).
 *   2. Kurum adı gururla ve doğal biçimde geçer; kuru bir teknik not gibi
 *      değil.
 *   3. Yoğun paragraf yok. Rol bölümleri üçer MADDE — paragraf değil.
 *
 * ÖĞRETMENİN BU TURDA VERDİĞİ BEŞ KARAR — hepsi burada uygulanmış hâlde,
 * hepsi `scripts/tanitim-denetimi.mjs` içinde ölçülüyor:
 *
 *   1. SATICI ADI VE ÜLKE SAYFADA GEÇMİYOR. Brief "İsveç merkezli …
 *      Supabase" diyordu; ölçüm bunu doğrulamadı (proje bölgesi Zürih,
 *      eu-central-2 — yani İsviçre; Supabase şirketi de İsveç merkezli
 *      değil). Öğretmenin kararı: hiçbiri yazmasın. Bölge bilgisi
 *      `docs/kvkk-notlari.md`'de duruyor, tanıtım sayfasında değil.
 *   2. "Öğrenmenin sonu yok." YALNIZ KAPANIŞTA. Yeni H1 öğretmenin
 *      başlığı; marka cümlesi tek bir yerde kalıyor, tekrar etmiyor.
 *   3. OKUL YÖNETİMİ BLOĞU EKRANSIZ VE GİRİŞSİZ. Sistemde üç rol var
 *      (öğretmen, öğrenci, veli); okul yönetimi girişi yok. Öğretmenin üç
 *      maddesi birebir duruyor — ama bu blok ekran görüntüsü ve giriş
 *      bağlantısı almıyor, böylece dördüncü bir giriş ima edilmiyor.
 *      Tek bir savunmacı cümle yazmadan.
 *   4. CEVAP ANAHTARI GÜVENCESİ OLUMLU KİPTE: "Teslimden sonra açılan
 *      çözümler ve kişisel analiz." Kural 6 / Part XXI'in sayfadaki
 *      karşılığı bu; sunucudaki kural zaten değişmiyor.
 *   5. EWALU "AKILLI" DEĞİL. Ewalu bir çizim ve puan aralığına göre cümle
 *      seçen bir kural kümesi (`lib/ewalu-puan.ts`) — yapay zekâ değil ve
 *      Kural 5 gereği testleri hiçbir zaman yapay zekâ puanlamayacak.
 *      Öğretmen aynı sıfatı bir önceki turda video altyazısından da
 *      kendisi çıkarmıştı.
 *   6. EWALU SORU ÇÖZERKEN YANINDA DEĞİL. Bu bölümün gövdesi bir kez daha
 *      daraltıldı; öğretmenin kuralı: "Ewalu, öğrencinin soru çözdüğü
 *      sırada öğrencinin yanında bulunan interaktif bir öğretmen veya
 *      sohbet asistanı değildir." Önceki metin "zorlanılan anlarda yapıcı
 *      geri bildirimlerle" ve "cevabı vermek yerine düşünme cesareti
 *      kazandırır" diyordu — ikisi de tam olarak bunu ima ediyordu.
 *      ÖLÇÜLDÜ: üründe soru çözerken ipucu veren hiçbir yer yok; Ewalu
 *      yalnız gönderim sonrası sonuç kartında görünüyor (`OdevTeslim`,
 *      `puanMesaji`). Mesajları öğretmenin düzenleyebileceği bir ekran da
 *      YOK — bu yüzden sayfa "öğretmenin belirlediği mesajlar" demiyor;
 *      olmayan bir ayar ekranı vaat etmek olurdu (Part L).
 *
 * SUNUCUYA HİÇ İSTEK ATMIYOR: ne oturum sağlayıcı, ne Supabase istemcisi.
 * Sıfır çerez, sıfır takip — sayfanın kendi cümlesi bunu söylüyor ve
 * denetimin 1. grubu bunu DAVRANIŞ olarak ölçüyor.
 */
export function Tanitim() {
  return (
    <>
      <UstCubuk />
      <main id="icerik">
        <Hero />
        <Felsefe />
        <Ekosistem />
        <EwaluBolumu />
        <Guven />
      </main>
      <Kunye />
    </>
  );
}

/* ============================================================
   ORTAK PARÇALAR
   ============================================================ */

function Bolum({
  baslik,
  ustBaslik,
  children,
  zemin = 'kagit',
  genis = false,
  id,
}: {
  baslik: string;
  ustBaslik?: string;
  children: ReactNode;
  zemin?: 'kagit' | 'yuzey';
  genis?: boolean;
  id?: string;
}) {
  return (
    <section className={zemin === 'yuzey' ? 'bg-surface' : ''} {...(id ? { id } : {})}>
      <div className={`mx-auto ${genis ? 'max-w-[54rem]' : 'max-w-[42rem]'} px-5 py-14`}>
        {ustBaslik && (
          <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
            {ustBaslik}
          </p>
        )}
        <h2 className="text-[26px] leading-[1.2] text-ink">{baslik}</h2>
        {children}
      </div>
    </section>
  );
}

/**
 * Madde işareti.
 *
 * SELÇUKLU YILDIZI KULLANILMIYOR ve bu bilinçli: sayfada 12 madde var,
 * her birine yıldız koymak "bir ekranda en fazla bir geometrik vurgu"
 * kuralını (Faz 0) çiğnerdi. Yıldız yalnız Okul Yönetimi bloğunda, tek
 * bir kez.
 */
function Madde({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-ink/30"
      />
      <span className="text-[16px] leading-[1.6] text-ink">{children}</span>
    </li>
  );
}

function Maddeler({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={`mt-4 flex flex-col gap-3 ${className ?? ''}`}>{children}</ul>;
}

/* ============================================================
   ÜST ÇUBUK
   ============================================================ */

function UstCubuk() {
  return (
    <>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-sk-sm focus:border focus:border-line focus:bg-surface focus:px-4 focus:text-[15px] focus:font-bold focus:text-ink"
      >
        İçeriğe geç
      </a>

      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[54rem] items-center justify-between gap-3 px-5 py-2">
          <SekizWordmark bicim="sade" boyut="sm" />
          <a
            href="/yeni/"
            className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-link underline"
          >
            Giriş yap
          </a>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   1 — HERO
   ============================================================ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <SekizgenDoku />

      <div className="relative mx-auto max-w-[44rem] px-5 pb-16 pt-12 text-center">
        <div className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </div>

        {/* KURUM ROZETİ. Mühür DEĞİL, metin: mühür yalnız 96 px ve üstünde
            kullanılabiliyor (Kural 8) ve künyede zaten 160 px'de duruyor.
            `rounded-full` değil `rounded-sk-lg`: ad uzun, 360 px'de iki-üç
            satıra sarıyor ve hap biçimi o zaman kırılıyor. */}
        <p className="mx-auto mt-8 inline-block max-w-[30rem] rounded-sk-lg border border-line bg-surface px-4 py-2 text-[13px] font-bold leading-[1.45] tracking-[0.04em] text-muted">
          Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi · İstanbul
        </p>

        {/* SAYFANIN TEK h1'İ. */}
        <h1 className="mt-6 font-display text-[32px] font-semibold leading-[1.15] text-ink">
          Öğrenmenin Sürekliliği, Gelişimin Netliği.
        </h1>

        <p className="mx-auto mt-5 max-w-[36rem] text-[18px] leading-[1.55] text-ink">
          SEKİZ; ödev takibini, akademik gelişimi ve nitelikli geri bildirimi tek bir rafine
          platformda buluşturan dijital çalışma ekosistemidir.
        </p>

        {/* İKİ CTA. 480 px altında ALT ALTA: yan yana koyunca "Platforma
            Giriş Yap" 360 px'de iki satıra kırılıyor ve düğme çarpık
            duruyor. Ölçüldü, varsayılmadı. */}
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="/yeni/"
            className="inline-flex min-h-[48px] items-center justify-center rounded-sk-sm bg-ink px-6 text-[16px] font-bold text-paper"
          >
            Platforma Giriş Yap
          </a>
          <a
            href="#ekosistem"
            className="inline-flex min-h-[48px] items-center justify-center rounded-sk-sm border border-line bg-surface px-6 text-[16px] font-bold text-ink"
          >
            Sistemi Keşfet <span aria-hidden="true">&nbsp;↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Açılışın arka planındaki sekizgen örgü. Yalnız burada (Faz 0 kuralı:
 * tesselasyon landing açılışında ve boş durumlarda; uygulama
 * ekranlarında değil). Opaklık 0.04 — metnin kontrastına karışmıyor.
 */
function SekizgenDoku() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-ink"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="sekizgen-doku" width="72" height="72" patternUnits="userSpaceOnUse">
          <path
            d={sekizgenYolu(72)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.04}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sekizgen-doku)" />
    </svg>
  );
}

/* ============================================================
   2 — FELSEFE
   ============================================================ */

function Felsefe() {
  const kartlar: [string, string][] = [
    [
      'Gelişim Odaklı Takip',
      'Öğrenci yalnızca sonucunu değil, eksiklerini ve gelişebileceği alanları anlık görür. Öz-düzenleme becerisi kazanır.',
    ],
    [
      'Kaygısız Öğrenme Alanı',
      'Sıralama baskısı veya kıyaslama olmadan, her öğrencinin kendi potansiyelini ve ritmini keşfetmesine odaklanan güvenli bir yapı.',
    ],
    [
      'Görünür Akademik İlerleme',
      'Öğretmenin rehberliği ve velinin bilinçli desteği, öğrenciyi baskı altına almadan aynı yapıcı eksende buluşur.',
    ],
  ];

  return (
    <Bolum baslik="Sadece Puan Değil, Süreç Odaklı Akademik Rutin" zemin="yuzey" genis>
      <div className="mt-7 grid gap-5 md:grid-cols-3">
        {kartlar.map(([baslik, metin]) => (
          <div key={baslik} className="rounded-sk-lg border border-line bg-paper p-5">
            <h3 className="font-display text-[18px] font-semibold leading-[1.25] text-ink">
              {baslik}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-muted">{metin}</p>
          </div>
        ))}
      </div>
    </Bolum>
  );
}

/* ============================================================
   3 — EKOSİSTEM
   ============================================================ */

function Ekosistem() {
  return (
    <section id="ekosistem">
      <div className="mx-auto max-w-[54rem] px-5 py-14">
        <h2 className="text-[26px] leading-[1.2] text-ink">
          SEKİZ Ekosistemi: Dört Paydaş, Tek Uyum
        </h2>

        <div className="mt-8 flex flex-col gap-12">
          <RolBlok
            kicker="Öğrenci İçin"
            baslik="Ne Yapacağını Bilen, Özgür ve Planlı Zihinler"
            dosya="ogrenci.webp"
            alt="Öğrencinin ödev listesi ekranı: bekleyen ve gönderilmiş ödevler, puanlar"
            maddeler={[
              'Tek ekrandan ödev ve çözüm erişimi.',
              // Kural 6 / Part XXI güvencesi — olumlu kipte, öğretmenin kararı.
              'Teslimden sonra açılan çözümler ve kişisel analiz.',
              'Sorumluluk bilincini artıran şeffaf takip.',
            ]}
          />

          <RolBlok
            kicker="Öğretmen İçin"
            baslik="Veriye Dayalı, Nitelikli Rehberlik"
            dosya="ogretmen.webp"
            alt="Öğretmen panosu: öğrenci sayısı, açık ödev, puan bekleyen ve eksik ödev kutuları"
            ters
            maddeler={[
              'Sınıfın genel ve bireysel konu hakimiyetini anlık görme.',
              'Açık uçlu ödevlerde pedagojik değerlendirme kontrolü.',
              'Zaman kazandıran, doğrudan ihtiyaca odaklanan ders planlaması.',
            ]}
          />

          <RolBlok
            kicker="Veli İçin"
            baslik="Kıyassız, Şeffaf ve Bilinçli Eşlik"
            dosya="veli.webp"
            alt="Velinin ödev listesi: gönderilen ödevler, alınan puan, yanlış yapılan soruların numaraları ve süresi yaklaşan ödev"
            maddeler={[
              'Çocuğunun akademik yolculuğunu anlık ve net izleme.',
              'İletişim sınırları korunmuş, güvenli okul-aile bağı.',
              'Sadece eksikleri değil, gösterilen çabayı da fark etme imkânı.',
            ]}
          />

          <YonetimBlok />
        </div>
      </div>
    </section>
  );
}

/**
 * Rol bloğu: üç madde ve o rolün gerçek ekran görüntüsü.
 *
 * ÜÇ ROL, ÜÇ EKRAN — ve dördüncüsü yok. Bu bilinçli: sistemde
 * `ogretmen`, `ogrenci`, `veli` rolleri var (`types/api.ts`), okul
 * yönetimi girişi yok. Aşağıdaki `YonetimBlok` bu yüzden ekran
 * görüntüsü ve giriş bağlantısı taşımıyor.
 *
 * UYDURMA VERİ NOTU her görselin ALTINDA. Ekran görüntüleri sahte veriyle
 * üretildi; gerçek bir öğrenciye aitmiş gibi göstermemek için tek satırlık
 * bir açıklama duruyor. Bu bir "teknik disclaimer" değil, bir görsel
 * altyazısı — uydurma veriyi gerçekmiş gibi sunmamak Part L'nin konusu.
 */
function RolBlok({
  kicker,
  baslik,
  dosya,
  alt,
  maddeler,
  ters = false,
}: {
  kicker: string;
  baslik: string;
  dosya: string;
  alt: string;
  maddeler: string[];
  ters?: boolean;
}) {
  return (
    <div
      data-blok="rol"
      className={`flex flex-col gap-7 md:items-center md:gap-10 ${
        ters ? 'md:flex-row-reverse' : 'md:flex-row'
      }`}
    >
      <div className="md:flex-1">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
          {kicker}
        </p>
        <h3 className="mt-1 font-display text-[21px] font-semibold leading-[1.25] text-ink">
          {baslik}
        </h3>
        <Maddeler>
          {maddeler.map((m) => (
            <Madde key={m}>{m}</Madde>
          ))}
        </Maddeler>
      </div>

      <figure className="md:w-[280px] md:shrink-0">
        <img
          src={`/yeni/tanitim-ekranlar/${dosya}`}
          alt={alt}
          width={780}
          height={1520}
          loading="lazy"
          decoding="async"
          className="mx-auto w-full max-w-[280px] rounded-sk-lg border border-line shadow-sk-md"
        />
        <figcaption className="mt-2 text-center text-[12px] text-muted">
          Örnek ekran — adlar ve puanlar uydurmadır.
        </figcaption>
      </figure>
    </div>
  );
}

/**
 * Dördüncü paydaş: okul yönetimi.
 *
 * ÜÇ MADDE ÖĞRETMENİN, BİREBİR — yalnız "Bosphorus" Türkçeleştirildi
 * (Kural 18: kullanıcıya görünen metin Türkçe).
 *
 * BU BLOK NEDEN FARKLI GÖRÜNÜYOR: üçü rol, bu kurum. Sistemde okul
 * yönetimi girişi, kurum panosu ya da idari rapor YOK — ve maddelerin
 * hiçbiri zaten bir özellik vaat etmiyor ("yakışan altyapı",
 * "bütünleşme", "somut gösterge"). Ama diğer üçüyle birebir aynı kalıpta
 * dursaydı dördüncü bir giriş varmış gibi okunurdu. Çözüm tek bir
 * savunmacı cümle yazmak değil, bloğu farklı kurmak: ekran görüntüsü
 * yok, giriş bağlantısı yok, tek geometrik vurgu burada.
 * `scripts/tanitim-denetimi.mjs` 7. grubu bunu ölçüyor.
 */
function YonetimBlok() {
  return (
    <div
      data-blok="yonetim"
      className="rounded-sk-lg border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex items-start gap-4">
        <StarEight boyut={26} bicim="cizgi" className="mt-1 shrink-0 text-amber" />
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
            Okul Yönetimi İçin
          </p>
          <h3 className="mt-1 font-display text-[21px] font-semibold leading-[1.25] text-ink">
            Kurumsal Vizyon ve Standart
          </h3>
          <Maddeler>
            <Madde>Boğaz hattının prestijli lise geleneğine yakışan dijital altyapı.</Madde>
            <Madde>Akademik disiplin ile teknolojik inovasyonun bütünleşmesi.</Madde>
            <Madde>Süreç odaklı eğitim anlayışının somut göstergesi.</Madde>
          </Maddeler>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   4 — EWALU
   ============================================================ */

function EwaluBolumu() {
  return (
    <Bolum baslik="Ewalu: Öğrenme Yolculuğunda İlham Veren Bir Eşlikçi" zemin="yuzey">
      <div className="mt-5 flex items-start gap-4">
        <EwaluFigure poz="karsilama" boyut={80} dekoratif className="shrink-0" />
        <p className="text-[17px] leading-[1.65] text-ink">
          Ewalu, SEKİZ'in öğrencinin öğrenme yolculuğuna eşlik eden dijital asistanıdır.
          Öğrenciyi karşılar ve ödevi tamamlandığında sonucuna eşlik eder.
        </p>
      </div>

      <div className="mt-7">
        <EwaluVideo />
      </div>
    </Bolum>
  );
}

/* ============================================================
   5 — GÜVEN
   ============================================================ */

function Guven() {
  return (
    <Bolum baslik="Güvenilir Altyapı, Sorumlu Teknoloji">
      {/*
        SATICI ADI VE ÜLKE YOK — öğretmenin kararı. Brief "İsveç merkezli
        … Supabase" diyordu; ölçüm bunu doğrulamadı (bölge Zürih /
        eu-central-2, yani İsviçre; şirket de İsveç merkezli değil).
        Doğrulanmamış bir iddiayı yayımlamaktansa (Kural 15) satıcı ve
        ülke sayfadan tümüyle çıktı. Bölge bilgisi `docs/kvkk-notlari.md`
        içinde duruyor.

        Üç madde de OLUMLU KİPTE ve üçü de bugün doğru:
          · dosyalar özel bir kovada, imzalı ve kısa ömürlü adresle açılıyor
          · öğretmen PIN'i bcrypt ile saklanıyor (0003)
          · bu sayfa hiçbir sunucuya istek atmıyor — denetimin 1. grubu
            bunu davranış olarak ölçüyor
      */}
      <p className="mt-4 text-[17px] leading-[1.65] text-ink">
        Öğrenci verileri ve akademik içerikler, üst düzey güvenlik standartlarına sahip bir
        veritabanı altyapısıyla korunur. Şeffaf, gizlilik odaklı ve kesintisiz bir deneyim
        sunar.
      </p>

      <Maddeler className="mt-5">
        <Madde>Ödev dosyaları ve çözüm görselleri yalnızca yetkili erişimle görüntülenir.</Madde>
        <Madde>Öğretmen giriş bilgisi geri döndürülemez biçimde saklanır.</Madde>
        <Madde>Bu tanıtım sayfası çerez kullanmaz ve ziyaretçi takibi yapmaz.</Madde>
      </Maddeler>
    </Bolum>
  );
}

/* ============================================================
   6 — KÜNYE VE KAPANIŞ
   ============================================================ */

function Kunye() {
  return (
    <footer>
      {/* AÇIK ZEMİN: mühür lacivert bir çizim, koyu zeminde kaybolur.
          Bu yüzden künye açık, kapanış bandı koyu — ikisi ayrı. */}
      <div className="bg-surface">
        <div className="mx-auto max-w-[42rem] px-5 py-14 text-center">
          {/* Mühür yalnız 96 px ve üstünde (Kural 8). `dekoratif`: okulun
              tam adı hemen altındaki künye cümlesinde GÖRÜNÜR METİN olarak
              geçiyor; işaretlemeseydik ekran okuyucu adı iki kez okurdu. */}
          <div className="flex justify-center">
            <SchoolCrest boyut={160} dekoratif />
          </div>

          <p className="mx-auto mt-6 max-w-[34rem] text-[16px] leading-[1.65] text-ink">
            İstanbul Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi Matematik Öğretmeni{' '}
            <strong className="font-semibold">Buket Topuzoğlu</strong> tarafından sınıf içi
            gerçek ihtiyaçlardan doğarak geliştirilmiştir.
          </p>

          <GeometricDivider className="my-9" />
        </div>
      </div>

      <div className="bg-ink text-paper">
        <div className="mx-auto max-w-[42rem] px-5 py-16 text-center">
          {/* Sayfadaki ikinci ve son 8 → ∞ hareketi: açılışta ve kapanışta,
              arası hareketsiz (Kural 12). Hareket azaltma tercihi açıksa
              dönmüyor, doğrudan ∞ duruyor. */}
          <div className="flex justify-center text-paper">
            <Sekiz8Mark boyut={64} acilistaDonsun gecikme={200} etiket={null} />
          </div>

          {/* MARKA CÜMLESİ — sayfada TAM BİR KEZ, burada. Öğretmenin
              kararı: yeni H1 başlık oldu, marka cümlesi kapanışta kaldı.
              Denetim bir kez geçtiğini ayrıca sayıyor. */}
          <p className="mt-7 font-display text-[26px] font-semibold leading-[1.25]">
            Öğrenmenin sonu yok.
          </p>

          <a
            href="/yeni/"
            className="mt-9 inline-flex min-h-[48px] items-center rounded-sk-sm bg-paper px-6 text-[16px] font-bold text-ink"
          >
            Giriş ekranına git
          </a>

          <p className="mt-10 text-[14px] font-bold tracking-[0.12em] text-paper">SEKİZ</p>
          <p className="mt-1 text-[13px] text-paper/70">Buket Topuzoğlu · Matematik</p>
          <p className="mt-6 text-[13px] text-paper/60">
            © 2026 SEKİZ. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
