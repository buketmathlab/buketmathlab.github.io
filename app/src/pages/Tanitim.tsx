import type { ReactNode } from 'react';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Sekiz8Mark } from '@/components/brand/Sekiz8Mark';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { GeometricDivider } from '@/components/brand/GeometricDivider';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { EwaluVideo } from '@/components/brand/EwaluVideo';
import { sekizgenYolu } from '@/lib/geometri';

/**
 * SEKİZ tanıtım sayfası — /yeni/tanitim/
 *
 * METİN ÖĞRETMENİNDİR. Bölüm başlıkları, cümleler ve sıra onun verdiği
 * nihai brief'ten; benim işim yerleşim, tipografi, görsel ritim ve
 * doğrulama.
 *
 * ═══ SIRA ═══
 * Kurum kimliği sayfanın İLK şeyi: mühür → öğretmen → okul ve konum.
 * Hemen ardından SEKİZ, marka cümlesi ve ürünün tanımı; sonra "bir
 * öğretmenin gerçek sınıf deneyiminden doğdu". Bu sıra öğretmenin
 * kararı ve denetimde kilitli — biri bölüm taşırsa sayfa başka bir
 * şey anlatmaya başlar.
 *
 * ═══ MARKA CÜMLESİ — TAM İKİ YERDE ═══
 * "Öğrenmenin sonu yok." — hero'da H1, kapanışta son söz. Felsefe
 * bölümündeki ÜÇÜNCÜ tekrarı öğretmenin düzeltmesiyle kalktı: aynı
 * cümleyi üç kez yazmak onu sıradanlaştırıyordu. Oradaki yerini
 * sonsuzluğa bağlanan pedagojik bir cümle aldı.
 *
 * ═══ VELİ ÖĞRETMENİN YERİNE GEÇMEZ — VE BU SAVUNULMAZ, KURULUR ═══
 * Veli "destek olan" değil "sürece DAHİL olan" taraf. Öğretmenin
 * gerekçesi: veli öğretmenden pay alan biri gibi görünmemeli; burada
 * yapılan şey ödevde şeffaflık. Aynı sebeple "veri öğretmenin yerini
 * almaz" gibi savunmacı cümleler sayfada yok — denetim ikisini de
 * ölçüyor (biri olumlu, biri yasaklı desen olarak).
 *
 * İSMİN MATEMATİKSEL ÇAĞRIŞIMI ŞEKİL BİLGİSİ OLARAK ANLATILMIYOR.
 * "8 yan yatınca sonsuzluk işaretidir" ve bütün varyantları YASAK.
 * Bağ düşünsel kuruluyor: sonsuzluk bir bitiş değil, devam edebilme.
 * İşaretin kendisi bunu GÖSTEREREK anlatıyor (hero ve kapanıştaki
 * `Sekiz8Mark`), cümle AÇIKLAYARAK değil.
 *
 * ═══ DİL: POZİTİF AMA GERÇEKÇİ ═══
 * Öğretmenin kuralı üç satır:
 *   GERÇEĞİ GİZLEME · ÖĞRENCİYİ ETİKETLEME · GELİŞİMİ GÖSTER
 *
 * Yani "yanlış yaptığı sorular", "eksik olduğu konu alanları", "teslim
 * edilmemiş ödev" AÇIKÇA yazılıyor — bunları yumuşatmak gerçeği gizlemek
 * olurdu. Yasak olan ÖĞRENCİYİ bir sonuçla tanımlamak: "başarısız",
 * "yetersiz", "zayıf öğrenci". "Kaygı" da marka dilinde geçmiyor.
 * `scripts/tanitim-denetimi.mjs` bu ayrımı iki listeyle ölçüyor.
 *
 * ═══ EWALU'NUN GERÇEK ROLÜ ═══
 * Ewalu, öğrenci soru çözerken yanında duran bir sohbet öğretmeni
 * DEĞİL — ölçüldü: üründe soru bazlı ipucu veren hiçbir yer yok; Ewalu
 * gönderim sonrası sonuç kartında görünüyor. Bölüm bunu doğru
 * konumlandırıyor ve Ewalu'nun ne YAPMADIĞINI uzun uzun anlatmıyor.
 *
 * ═══ EKRAN GÖRÜNTÜLERİ ═══
 * Altısı da GERÇEK uygulamanın gerçek ekranı; temsilî olan yalnız veri
 * (`scripts/tanitim-gorselleri.mjs`, sunucuya sıfır istekle çekiliyor).
 * Olmayan bir özellik için ekran üretilmedi. Görseller Ewalu'nun puan
 * cümleleri her değiştiğinde YENİDEN ÜRETİLİR — bir kez unutuldu ve
 * sonuç ekranı eski cümleyi göstermeye devam etti.
 *
 * SUNUCUYA HİÇ İSTEK ATMIYOR: ne oturum sağlayıcı, ne Supabase istemcisi.
 * Sıfır çerez, sıfır takip — denetimin 1. grubu bunu DAVRANIŞ olarak
 * ölçüyor.
 */
export function Tanitim() {
  return (
    <>
      <UstCubuk />
      <main id="icerik">
        <Hero />
        <Hikaye />
        <Felsefe />
        <SekizNedir />
        <Ogrenci />
        <Ogretmen />
        <GeriBildirim />
        <Veli />
        <Iletisim />
        <EwaluBolumu />
        <Degerlendirme />
        <Gelisim />
        <Gelecek />
      </main>
      <Kapanis />
    </>
  );
}

/* ============================================================
   ORTAK PARÇALAR

   BÖLÜMLER BİLEREK AYNI KALIBA SOKULMADI. Her bölüm bir karta
   konsaydı sayfa bir özellik listesine dönerdi (öğretmenin açık
   uyarısı). Ritim: tipografik bölüm → ekranlı bölüm → koyu bant →
   tipografik bölüm. Aşağıdaki parçalar o ritmin yapı taşları.
   ============================================================ */

/** Metin bölümü. Kart yok, çerçeve yok — yalnız tipografi ve boşluk. */
function Bolum({
  baslik,
  ustBaslik,
  children,
  zemin = 'kagit',
  genis = false,
  ortala = false,
}: {
  baslik: string;
  ustBaslik?: string;
  children?: ReactNode;
  zemin?: 'kagit' | 'yuzey';
  genis?: boolean;
  ortala?: boolean;
}) {
  return (
    <section className={zemin === 'yuzey' ? 'bg-surface' : ''}>
      <div
        className={`mx-auto ${genis ? 'max-w-[58rem]' : 'max-w-[40rem]'} px-5 py-16 md:py-20 ${
          ortala ? 'text-center' : ''
        }`}
      >
        {ustBaslik && (
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
            {ustBaslik}
          </p>
        )}
        <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-ink md:text-[30px]">
          {baslik}
        </h2>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-[17px] leading-[1.7] text-ink">{children}</p>;
}

/** İkincil ton — bölümün kapanış cümlesi ya da ara notu. */
function Not({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[16px] leading-[1.65] text-muted">{children}</p>;
}

/**
 * Madde listesi.
 *
 * İKONSUZ VE KUTUSUZ. Öğretmenin tasarım kuralı açık: her özelliği ayrı
 * bir kutuya koyma, ikon kalabalığı yapma. Maddeler ince bir çizgiyle
 * ayrılıyor — okunurluğu bozmadan sayfayı sakin tutuyor.
 */
function Maddeler({ maddeler }: { maddeler: string[] }) {
  return (
    <ul className="mt-6 border-t border-line">
      {maddeler.map((m) => (
        <li key={m} className="border-b border-line py-3 text-[16px] leading-[1.6] text-ink">
          {m}
        </li>
      ))}
    </ul>
  );
}

/**
 * Bir uygulama ekranı.
 *
 * ÖLÇÜLER `scripts/tanitim-gorselleri.mjs` ile BİREBİR (780×1520);
 * ayrışırsa sayfa okunurken metin zıplar. Denetim bunu ayrıca ölçüyor.
 *
 * UYDURMA VERİ NOTU her görselin altında. Ekran görüntüleri sahte
 * veriyle üretildi; gerçek bir öğrenciye aitmiş gibi göstermemek bir
 * nezaket değil, dürüstlük meselesi.
 */
function Ekran({ dosya, alt, aciklama }: { dosya: string; alt: string; aciklama: string }) {
  return (
    <figure className="min-w-0">
      <img
        src={`/yeni/tanitim-ekranlar/${dosya}`}
        alt={alt}
        width={780}
        height={1520}
        loading="lazy"
        decoding="async"
        className="w-full rounded-sk-lg border border-line shadow-sk-md"
      />
      <figcaption className="mt-2 text-[12px] leading-[1.45] text-muted">
        {aciklama}
        <span className="block text-[11px]">Örnek ekran — isimler ve puanlar temsilidir.</span>
      </figcaption>
    </figure>
  );
}

/**
 * Metin ve ekran(lar) yan yana.
 *
 * `ters` ile öğretmen bölümünde görseller sola alınıyor: üç rol bölümü
 * arka arkaya aynı hizada dursaydı sayfa tekdüze olurdu.
 */
function EkranliBolum({
  ustBaslik,
  baslik,
  zemin,
  ters = false,
  ekranlar,
  children,
}: {
  ustBaslik: string;
  baslik: string;
  zemin?: 'kagit' | 'yuzey';
  ters?: boolean;
  ekranlar: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={zemin === 'yuzey' ? 'bg-surface' : ''}>
      <div className="mx-auto max-w-[62rem] px-5 py-16 md:py-20">
        <div
          className={`flex flex-col gap-10 lg:items-start lg:gap-14 ${
            ters ? 'lg:flex-row-reverse' : 'lg:flex-row'
          }`}
        >
          <div className="lg:flex-1">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
              {ustBaslik}
            </p>
            <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-ink md:text-[30px]">
              {baslik}
            </h2>
            {children}
          </div>
          {/* GENİŞLİK ÖLÇÜLEREK SEÇİLDİ. 24rem denendi: iki ekran yan yana
              ~180 px kalıyor ve telefon görüntüsündeki metin okunmuyordu —
              gerçek ürünü göstermenin bütün anlamı kayboluyor. 30rem'de
              her ekran ~230 px; metin sütunu da ~480 px kalıyor. */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:w-[30rem] lg:shrink-0">
            {ekranlar}
          </div>
        </div>
      </div>
    </section>
  );
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
        <div className="mx-auto flex max-w-[62rem] items-center justify-between gap-3 px-5 py-2">
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

   İLK EKRANDA AZ ŞEY VAR ve bu bilinçli: marka, öğretmenin adı, tek
   bir büyük cümle ve SEKİZ'in ne olduğuna dair TEK açıklama. Fazlası
   ilk izlenimi zayıflatırdı.
   ============================================================ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <SekizgenDoku />

      <div className="relative mx-auto max-w-[44rem] px-5 pb-20 pt-12 text-center md:pb-28 md:pt-16">
        {/* KURUM KİMLİĞİ SAYFANIN İLK ŞEYİ — öğretmenin kararı. Önce
            mühür, altında öğretmen, altında okul ve konum; SEKİZ ancak
            ondan sonra geliyor. Ziyaretçi ürünü tanımadan önce kimin
            işi olduğunu görüyor.

            Mühür yalnız BURADA (Kural 8: 96 px altına inilmez). Künyeden
            kalktı — iki kez göstermek onu bir tekrar öğesine çevirirdi.
            `dekoratif`: okul adı hemen altında görünür metin olarak
            geçiyor, ekran okuyucu iki kez okumasın. */}
        {/* MÜHÜR TEK BAŞINA — ve `dekoratif` DEĞİL.

            Mührün altında bir tur boyunca önce "Buket Topuzoğlu /
            Matematik Öğretmeni", sonra da okul adı ve konum duruyordu.
            İkisi de öğretmenin kararıyla kalktı: adı zaten hemen
            aşağıdaki `SekizWordmark` yazıyor, okul adı da mührün kendi
            halkasında ("ARNAVUTKÖY KORKMAZ YİĞİT ANADOLU LİSESİ ·
            BEŞİKTAŞ"). İkisi de tekrardı.

            `dekoratif` BU YÜZDEN KALDIRILDI, unutulduğu için değil. O
            prop yalnız "okul adı zaten yanında görünür metin" durumu
            için var (SchoolCrest.tsx). O metin kalkınca prop yanlış
            bilgi verir ve ekran okuyucu kullanan biri kurumu HİÇ
            duymaz — mührün halkasındaki yazıyı okuyamaz. Propsuz hâlde
            `alt` okulun tam adını taşıyor. Denetim bunu ölçüyor. */}
        <div className="flex justify-center">
          <SchoolCrest boyut={120} />
        </div>

        <GeometricDivider className="mx-auto my-9 max-w-[14rem]" />

        <div className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </div>

        <h1 className="mt-10 font-display text-[38px] font-semibold leading-[1.1] text-ink md:text-[52px]">
          Öğrenmenin sonu yok.
        </h1>

        {/* VELİ "DESTEK OLAN" DEĞİL "DAHİL OLAN". Öğretmenin kuralı ve
            gerekçesi net: veli öğretmenin yerine geçen ya da ondan pay
            alan taraf değil; sürece dahil edilen, ödevde şeffaflık
            sağlanan taraf. Denetim bu ifadeyi ayrıca ölçüyor. */}
        <p className="mx-auto mt-6 max-w-[36rem] text-[18px] leading-[1.6] text-ink md:text-[19px]">
          SEKİZ; öğrencinin öğrenme sürecini takip ettiği, öğretmenin gelişimi gördüğü ve
          velinin sürece dahil olduğu dijital eğitim platformudur.
        </p>

        {/* Dört adım. Ayraç `·` markanın ayracı (SekizWordmark ile aynı). */}
        <p className="mt-10 text-[13px] font-bold uppercase tracking-[0.16em] text-muted">
          Ödev · Değerlendirme · Geri Bildirim · Gelişim
        </p>
      </div>
    </section>
  );
}

/**
 * Açılışın arka planındaki sekizgen örgü — sayfadaki TEK dokusal öğe
 * (Faz 0 kuralı: tesselasyon yalnız landing açılışında). Opaklık 0.04,
 * metnin kontrastına karışmıyor.
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
   1 — HİKÂYE

   KÜNYEDEN BURAYA TAŞINDI (öğretmenin kararı). Eskiden sayfanın en
   altındaydı; oraya kadar inen az kişi ürünün kimin işi olduğunu
   öğreniyordu. Artık ikinci bölüm: ziyaretçi SEKİZ'in ne olduğunu
   okumadan önce nereden geldiğini biliyor.
   ============================================================ */

function Hikaye() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-16 md:py-20">
        <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-ink md:text-[30px]">
          Bir öğretmenin gerçek sınıf deneyiminden doğdu.
        </h2>

        {/* YAZARLIK — ÖLÇÜLÜ VE DOĞRU. Öğretmenin isteği: SEKİZ'i
            tasarlayanın bir yazılım şirketi değil kendisi olduğu
            anlaşılsın, ama göze sokulmadan.

            "Vizyoner" kelimesi BİLEREK YAZILMIYOR. Vizyon, kendini
            ilan ederek değil son paragraftaki bakışla anlaşılır;
            sıfatı yazmak iddiayı zayıflatırdı. */}
        <P>
          SEKİZ'i fikir olarak da yazılım olarak da tasarlayan, matematik öğretmeni Buket
          Topuzoğlu'dur. Bir yazılım şirketinin ürünü değil; sınıfın içinden, gerçek bir
          ihtiyaçtan doğdu.
        </P>
        <P>
          Öğrencilerin ödev, değerlendirme ve gelişim süreçlerini daha görünür ve
          yönetilebilir hâle getirmek için tasarlandı. Hangi verinin kime görüneceğinden
          öğrencinin ekranda okuyacağı cümleye kadar her karar, yılların sınıf deneyiminden
          çıktı.
        </P>
        <P>
          Bugün eğitimin ihtiyaç duyduğu şey yalnız yeni araçlar değil; o araçları sınıfı
          tanıyarak tasarlayabilen öğretmenler. SEKİZ bu bakışın ürünü ve gelişmeye devam
          ediyor.
        </P>
      </div>
    </section>
  );
}

/* ============================================================
   2 — MARKA FELSEFESİ
   ============================================================ */

function Felsefe() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-20 text-center md:py-24">
        <h2 className="font-display text-[28px] font-semibold leading-[1.25] text-ink md:text-[34px]">
          Öğrenme bir sonuç değil, devam eden bir süreçtir.
        </h2>
        <p className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-[1.7] text-ink">
          SEKİZ, matematiğin sonsuzluk fikrinden ilham alır. Çünkü öğrenme de tek bir sonuçla
          tamamlanmaz; her kazanım yeni bir düşüncenin ve yeni bir gelişimin başlangıcıdır.
        </p>

        <GeometricDivider className="mx-auto my-10 max-w-[16rem]" />

        {/* BURADA ARTIK MARKA CÜMLESİ YOK. Öğretmenin düzeltmesi:
            "Öğrenmenin sonu yok." en üstte zaten geçiyor, ikinci kez
            yazmak onu sıradanlaştırıyordu. Yerine bölüme ait, sonsuzluğa
            bağlanan pedagojik bir cümle.

            ŞEKİL BİLGİSİ YOK: "8 yan yatınca…" ve varyantları yasak
            (denetim ayrıca ölçüyor). Bağ düşünsel kuruluyor — sonsuzluk
            bir bitiş değil, devam edebilme. */}
        <p className="font-display text-[22px] font-semibold leading-[1.35] text-ink md:text-[24px]">
          Sonsuzluk bir varış değil, bir yöndür; öğrenme de o yönde ilerler.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   3 — SEKİZ NEDİR?
   ============================================================ */

function SekizNedir() {
  const roller: [string, string][] = [
    ['Öğrenci', 'Kendi öğrenme sürecini takip eder.'],
    // ÖĞRETMEN İKİ ÖLÇEKTE BİRDEN GÖRÜYOR — sınıf ve tek tek öğrenci.
    // Ürün ikisini de veriyor (`konu_karnesi` sınıf ve öğrenci ekseninde
    // çalışıyor, 0023); cümle yalnız sınıfı söylemek yetersiz kalıyordu.
    ['Öğretmen', 'Sınıfın ve her öğrencinin gelişimini görür, öğretimini buna göre şekillendirir.'],
    ['Veli', 'Öğrencinin gelişimini takip eder ve sürece dahil olur.'],
  ];

  return (
    <Bolum baslik="Ödevden gelişime, öğrenmenin tamamı tek yerde." genis>
      <P>
        SEKİZ; ödevlerin verildiği, çalışmaların teslim edildiği, sonuçların
        değerlendirildiği, geri bildirimlerin görüldüğü ve öğrencinin gelişiminin takip
        edildiği bütünsel bir eğitim platformudur.
      </P>

      {/* Üç rol: kutu değil, sütun. Kartlara koymak sayfayı bir özellik
          ızgarasına çevirirdi; burada amaç yalnız kimin ne yaptığını
          bir bakışta göstermek. */}
      <div className="mt-10 grid gap-8 border-t border-line pt-8 md:grid-cols-3 md:gap-10">
        {roller.map(([ad, cumle]) => (
          <div key={ad}>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">{ad}</p>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink">{cumle}</p>
          </div>
        ))}
      </div>
    </Bolum>
  );
}

/* ============================================================
   4 — ÖĞRENCİ
   ============================================================ */

function Ogrenci() {
  return (
    <EkranliBolum
      ustBaslik="Öğrenci"
      baslik="Öğrenci kendi öğrenme sürecini görür."
      zemin="yuzey"
      ekranlar={
        <>
          <Ekran
            dosya="ogrenci.webp"
            alt="Öğrencinin ödev listesi: bekleyen ve gönderilmiş ödevler, puanlar"
            aciklama="Ödev listesi"
          />
          <Ekran
            dosya="ogrenci-sonuc.webp"
            alt="Teslim sonrası sonuç ekranı: puan, doğru ve yanlış sayısı, çalışılacak konular"
            aciklama="Teslimden sonra: puan ve geri bildirim"
          />
        </>
      }
    >
      <Maddeler
        maddeler={[
          'Bütün ödevlerini tek ekranda görür; tamamladıklarını ve teslim edilmeyi bekleyenleri takip eder.',
          'Ödevini çözüm fotoğrafıyla teslim eder — fotoğraf yüklenmeden teslim tamamlanmaz.',
          'Test türündeki ödevlerde puanını teslim ettiği anda görür.',
          'Cevap anahtarı teslimden önce açılmaz; teslimden hemen sonra açılır.',
          'Yanlış yaptığı soruları ve ödev sonuçlarını görür.',
          'Genel ortalamasını ve gelişimini güçlendirebileceği konu alanlarını takip eder.',
        ]}
      />
      <Not>Öğrenci yalnızca ödev teslim etmez; kendi öğrenme sürecini takip eder.</Not>
    </EkranliBolum>
  );
}

/* ============================================================
   5 — ÖĞRETMEN
   ============================================================ */

function Ogretmen() {
  return (
    <EkranliBolum
      ustBaslik="Öğretmen"
      baslik="Öğretmen yalnızca sonucu değil, öğrenmenin gelişimini görür."
      ters
      ekranlar={
        <>
          <Ekran
            dosya="ogretmen.webp"
            alt="Öğretmen panosu: öğrenci sayısı, açık ödev, puan bekleyen ve teslim edilmemiş ödev sayıları"
            aciklama="Pano"
          />
          <Ekran
            dosya="ogretmen-sinif.webp"
            alt="Sınıf karnesi: öğrenci ortalamaları ve sınıfın konu dökümü"
            aciklama="Sınıf karnesi"
          />
        </>
      }
    >
      <Maddeler
        maddeler={[
          'Hangi öğrencinin ödevini yaptığını, hangi ödevin henüz teslim edilmediğini görür.',
          'Puanları ve puan bekleyen çalışmaları takip eder.',
          'Ödev, öğrenci ve sınıf ortalamalarını görür.',
          'Öğrencilerin yanlış yaptığı soruları ve konu alanlarını inceler.',
          'Sınıfın hangi matematik konularında gelişime ihtiyaç duyduğunu görür.',
        ]}
      />
      <P>
        Açık uçlu ödevlerde öğrencinin çözümü öğretmen tarafından kontrol edilir ve nihai puan
        öğretmen tarafından verilir.
      </P>
      {/* SAVUNMACI CÜMLE KALKTI. Eskiden "Veri öğretmenin yerini almaz."
          diye başlıyordu; öğretmenin kararı: böyle bir savunma gereksiz,
          verinin ne YAPTIĞI söylensin yeter. Denetim "yerini alma"
          kalıbını artık yasaklı desen olarak arıyor. */}
      <Not>
        Veri, öğretmenin öğrenciyi daha iyi tanımasına ve takip etmesine yardımcı olur.
      </Not>
    </EkranliBolum>
  );
}

/* ============================================================
   6 — GERİ BİLDİRİM

   KOYU BANT. Sayfanın ortasında ritmi kıran tek tipografik durak;
   art arda gelen üç rol bölümünden sonra gözün dinlendiği yer.
   ============================================================ */

function GeriBildirim() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[42rem] px-5 py-20 text-center md:py-24">
        <h2 className="font-display text-[26px] font-semibold leading-[1.25] md:text-[32px]">
          Sonuç, öğrenmenin bir sonraki adımını gösterir.
        </h2>
        <p className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-[1.7] text-paper/90">
          SEKİZ öğrencinin yalnızca puanını göstermez. Yanlış yaptığı soruları ve eksik olduğu
          konu alanlarını da görünür hâle getirir.
        </p>
        <p className="mx-auto mt-5 max-w-[34rem] text-[17px] leading-[1.7] text-paper/90">
          Öğrenci nerede olduğunu görür. Öğretmen sınıfın hangi konularda gelişime ihtiyaç
          duyduğunu görür.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   7 — VELİ
   ============================================================ */

function Veli() {
  return (
    <EkranliBolum
      ustBaslik="Veli"
      baslik="Öğrenme sürecine aile de eşlik eder."
      zemin="yuzey"
      ekranlar={
        <>
          <Ekran
            dosya="veli.webp"
            alt="Velinin ödev listesi: gönderilen ödevler, alınan puan ve yanlış yapılan soruların numaraları"
            aciklama="Velinin gördüğü ödev durumu"
          />
          <Ekran
            dosya="ogrenci-konular.webp"
            alt="Konu karnesi: genel ortalama, konu alanları ve ödev ödev gelişim"
            aciklama="Ortalama ve gelişim alanları"
          />
        </>
      }
    >
      <P>
        Veli; öğrencinin yaptığı ve yapmadığı ödevleri, puanlarını, genel ortalamasını ve
        gelişim alanlarını takip edebilir. Öğrencinin eksik olduğu veya daha fazla
        çalışabileceği konu alanları veli tarafından da görülebilir.
      </P>
      <P>
        Bu görünürlük, öğrencinin ihtiyaç duyduğu desteğin doğru zamanda verilmesine yardımcı
        olur.
      </P>
      <Not>
        SEKİZ, öğretmen ile aile arasında öğrencinin gelişimini destekleyen ortak bir zemin
        oluşturur.
      </Not>
    </EkranliBolum>
  );
}

/* ============================================================
   8 — İLETİŞİM
   ============================================================ */

function Iletisim() {
  return (
    <Bolum baslik="Öğrenme, iletişimle güçlenir." ortala>
      <P>
        SEKİZ üzerinden öğrenci–öğretmen ve veli–öğretmen arasında iletişim kurulabilir.
      </P>
      <Not>Bu iki iletişim alanı birbirinden bağımsızdır.</Not>
    </Bolum>
  );
}

/* ============================================================
   9 — EWALU
   ============================================================ */

function EwaluBolumu() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[46rem] px-5 py-16 md:py-20">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
          Ewalu
        </p>
        <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-ink md:text-[30px]">
          SEKİZ'in öğrenme sürecindeki dijital yüzü.
        </h2>

        <div className="mt-6 flex items-start gap-5">
          <EwaluFigure poz="karsilama" boyut={88} dekoratif className="shrink-0" />
          <div>
            {/* TEK PARAGRAF, İKİ CÜMLE — iki kez kısaltıldı.
                1) "Ewalu, SEKİZ'in öğrencinin öğrenme yolculuğuna eşlik
                   eden dijital asistanıdır." — arka arkaya iki tamlama
                   ("SEKİZ'in öğrencinin") cümleyi düşürüyordu.
                2) "SEKİZ deneyimine insani bir yüz kazandırır" çıkarıldı:
                   öğretmen gereksiz buldu. Ayrıca kalan cümle birinciyle
                   tekrar ediyordu, o yüzden ikisi tek paragrafta
                   birleştirildi. Ne yaptığı bir kez söyleniyor. */}
            <p className="text-[17px] leading-[1.7] text-ink">
              Ewalu, SEKİZ'in dijital asistanıdır. Öğrenciyi karşılar ve ödev sonucunu
              aldığında ona uygun geri bildirimi sunar.
            </p>
          </div>
        </div>

        <div className="mt-9">
          <EwaluVideo />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   10 — DEĞERLENDİRME
   ============================================================ */

function Degerlendirme() {
  return (
    <Bolum baslik="Değerlendirme, öğrenmeyi görünür kılar.">
      <P>
        Test türündeki ödevler, önceden belirlenmiş kurallar doğrultusunda sistem tarafından
        otomatik olarak değerlendirilir.
      </P>
      <P>
        Açık uçlu ödevlerde son kontrol ve puanlama öğretmen tarafından yapılır.
      </P>
      <Not>Öğretmenin değerlendirmesi sistemin temel parçalarından biridir.</Not>
    </Bolum>
  );
}

/* ============================================================
   11 — GELİŞİM
   ============================================================ */

function Gelisim() {
  return (
    <Bolum baslik="Puanın ötesinde, gelişim." zemin="yuzey">
      <P>
        SEKİZ öğrencinin yalnızca tek bir ödevde aldığı sonucu değil, çalışmalar boyunca
        oluşan genel gelişimini görmesine yardımcı olur.
      </P>
      <P>
        Öğrenci kendi ortalamasını ve gelişim alanlarını takip eder. Öğretmen öğrencinin ve
        sınıfın genel gelişimini görür.
      </P>
      {/* KIYASLAMA YOK — ve bu bir slogan değil, sunucudaki bir sınır:
          `kendi_karnem` ve `veli_paneli` sınıf ortalamasını, sıralamayı
          ve başka öğrencinin verisini bilerek döndürmüyor (0026/0029),
          testleri de bunu ölçüyor. */}
      <Not>
        Öğrenciye ve veliye başka öğrencilerin puanları veya sıralamaları gösterilmez. Amaç
        kıyaslama değil, kişisel gelişimdir.
      </Not>
    </Bolum>
  );
}

/* ============================================================
   12 — SÜREKLİ GELİŞEN PLATFORM

   MARKANIN GELECEK VİZYONU. Sayfanın ikinci koyu durağı: bu bölüm
   diğerlerinin arasında kaybolmamalı.
   ============================================================ */

function Gelecek() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[44rem] px-5 py-20 md:py-24">
        <h2 className="font-display text-[26px] font-semibold leading-[1.25] md:text-[32px]">
          SEKİZ gelişmeye devam ediyor.
        </h2>
        <p className="mt-6 text-[17px] leading-[1.7] text-paper/90">
          SEKİZ tamamlanmış ve değişmeyecek bir ürün olarak tasarlanmadı. Gerçek sınıf
          deneyimi, öğrencilerin ihtiyaçları, öğretmen geri bildirimleri ve gelişen
          teknolojiler doğrultusunda sürekli geliştirilmeye devam edecek.
        </p>
        <p className="mt-5 text-[17px] leading-[1.7] text-paper/90">
          Yeni ihtiyaçlar ortaya çıktıkça yeni özellikler eklenecek; mevcut deneyim sürekli
          iyileştirilecek.
        </p>

        <div className="mt-9 border-t border-paper/20 pt-7">
          <p className="font-display text-[20px] font-semibold leading-[1.35] md:text-[22px]">
            Çünkü öğrenme sürekli gelişiyorsa, onu destekleyen teknoloji de gelişmeye devam
            etmelidir.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   KAPANIŞ

   GÜVEN BÖLÜMÜ KALKTI — öğretmenin kararı. Üç cümlesi de (Supabase
   altyapısı, Zürih/İsviçre bölgesi, yetkili erişim, çerez notu) tanıtım
   sayfasına gereksiz teknik ayrıntı olarak girmişti.

   GÜVENCE KALKMADI, YALNIZ CÜMLE KALKTI: sayfa hâlâ tek çerez yazmıyor
   ve sunucuya tek istek atmıyor — `scripts/tanitim-denetimi.mjs` 1.
   grubu bunu DAVRANIŞ olarak ölçmeye devam ediyor. Söylenmeyen bir
   güvence, ölçülen bir güvenceden zayıf değil.
   ============================================================ */

function Kapanis() {
  return (
    <footer>
      <div className="bg-ink text-paper">
        <div className="mx-auto max-w-[42rem] px-5 py-20 text-center md:py-24">
          {/* Sayfadaki ikinci ve son 8 → ∞ hareketi: açılışta ve
              kapanışta, arası hareketsiz (Kural 12). Hareket azaltma
              tercihi açıksa dönmüyor, doğrudan ∞ duruyor.

              `gorununceDonsun` — ÖLÇÜLEN BİR KUSURUN DÜZELTMESİ. Burası
              sayfanın en altı; `acilistaDonsun` ile dönüş sayfa
              YÜKLENİRKEN oynuyordu, yani okuyucu buraya kaydırdığında
              dönüş çoktan bitmiş oluyordu. İşaret ekrana girdiğinde
              oynuyor. Hero'daki açılışta oynamaya devam ediyor. */}
          <div className="flex justify-center text-paper">
            <Sekiz8Mark boyut={64} gorununceDonsun gecikme={250} etiket={null} />
          </div>

          <p className="mt-9 font-display text-[30px] font-semibold leading-[1.2] md:text-[38px]">
            Öğrenmenin sonu yok.
          </p>

          <a
            href="/yeni/"
            className="mt-10 inline-flex min-h-[48px] items-center rounded-sk-sm bg-paper px-6 text-[16px] font-bold text-ink"
          >
            Giriş ekranına git
          </a>

          <p className="mt-12 text-[14px] font-bold tracking-[0.16em] text-paper">SEKİZ</p>
          <p className="mt-1 text-[13px] text-paper/70">Buket Topuzoğlu · Matematik</p>
        </div>
      </div>
    </footer>
  );
}
