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
 * ═══ SIRA — 8 BÖLÜM ═══
 * Kurum kimliği sayfanın İLK şeyi: mühür, ardından SEKİZ, başlık, tanım,
 * dört adım ve isim sloganı. Sonra sırayla: öğretmen deneyimi ve sürekli
 * gelişim → ürün → üç rol → iletişim → Ewalu → künye. Bu sıra öğretmenin
 * kararı ve denetimde kilitli — biri bölüm taşırsa sayfa başka bir şey
 * anlatmaya başlar.
 *
 * SAYFA BU TURDA 13 → 8 BÖLÜME İNDİ. Öğretmenin isteği sadeleştirmek:
 * iki bölüm tek başlıkta birleşti, üç bölüm tamamen kalktı, bir bölüm de
 * sloganına indirgenip hero'ya taşındı. Kalkan başlıkların hepsi denetimde
 * YASAKLI DESEN — ölçümler silinmedi, yönü çevrildi.
 *
 * ROL BÖLÜMLERİ AYRI KALIYOR, SEKME OLMUYOR. Brief üç rolü "interactive
 * tabs" ile istiyordu; öğretmenin kararı mevcut yapının korunması.
 * Sekme aynı anda iki rolü gizler, altı ekran görüntüsünün üçe bölünmüş
 * dağılımını bozar ve sayfayı arama motoruna tek rol olarak gösterirdi.
 *
 * ═══ MARKA CÜMLESİ — TAM BİR YERDE ═══
 * "Öğrenmenin sonu yok." yalnız KAPANIŞTA. Üç yerdeydi, ikiye indi,
 * bu turda BİRE indi: öğretmen hero başlığı olarak kendi cümlesini
 * yazdı ("Sonsuz bir öğrenme döngüsü için tasarlandı.") ve H1 olmasını
 * istedi. Sayı yine TAM ölçülüyor — cümle ne düşebilir ne çoğalabilir.
 * Bir tur önce tersi seçilmişti; fikir yine değişirse değiştirilecek
 * yer hero'daki `h1` ve denetimdeki sayı kilidi.
 *
 * ═══ REDESIGN DEĞİL, REFINEMENT ═══
 * Bu turun tek cümlelik kuralı öğretmenin kendi ifadesi. Arka plan,
 * renkler, tipografi, sekizgen doku, 8 → ∞ hareketi, `Bolum` /
 * `EkranliBolum` / `Maddeler` düzeni — hiçbiri değişmedi. Değişen
 * içerik, hiyerarşi ve belirli cümleler.
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
        <OgretmenDeneyimi />
        <SekizNedir />
        <Ogrenci />
        <Ogretmen />
        <Veli />
        <Iletisim />
        <EwaluBolumu />
        <Kunye />
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
 *
 * KALIN GİRİŞ (`[giriş, metin]`) — brief'in yazım biçimi. Öğretmen rol
 * maddelerini "**Sade ve Odaklı Takip:** …" diye yazdı; giriş maddeyi
 * taranabilir kılıyor, gövde açıklıyor.
 *
 * YENİ RENK, İKON VE KUTU YOK. Brief `border-l-4 border-indigo-500` gibi
 * bir vurgu öneriyordu; indigo palette'te yok ve renk kümesi WCAG AA'dan
 * BİR KÜME OLARAK geçti (18 çift). Dışarıdan bir renk eklemek o denetimi
 * anlamsız kılardı. Vurgu yalnız yazı ağırlığıyla veriliyor.
 *
 * Düz dize de kabul ediliyor: bugünkü çağrı noktalarının hiçbiri
 * değişmek zorunda değil.
 */
type Madde = string | [giris: string, metin: string];

function Maddeler({ maddeler }: { maddeler: Madde[] }) {
  return (
    <ul className="mt-6 border-t border-line">
      {maddeler.map((m) => {
        const [giris, metin] = Array.isArray(m) ? m : [null, m];
        return (
          <li
            key={giris ?? metin}
            className="border-b border-line py-3 text-[16px] leading-[1.6] text-ink"
          >
            {giris && <span className="font-semibold">{giris}:</span>} {metin}
          </li>
        );
      })}
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
   0 — HERO

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

        {/* HERO'DA KÜNYE SATIRI YOK — VE BU BİR UNUTMA DEĞİL.
            Bir tur önce buraya "Fikir, pedagojik tasarım ve yazılım
            geliştirme" girmişti (brief hero'da tam künye istiyordu);
            öğretmen bu turda kaldırılmasını istedi.

            BİLGİ KAYBOLMADI: aynı cümle sayfanın sonundaki "SEKİZ'in
            arkasındaki yaklaşım" bölümünde tam künyenin içinde duruyor
            ve denetim onu orada ölçüyor. Ayrıca hero'da OLMADIĞI da
            ölçülüyor — iki yönlü kilit, sessizce geri gelmesin. */}

        {/* H1 ARTIK MARKA CÜMLESİ DEĞİL — ÖĞRETMENİN KARARI.
            Brief hero başlığı olarak "Sınıfın Gerçek İhtiyacından Doğan
            Pedagojik Takip Sistemi: SEKİZ" istiyordu; öğretmen ikisini de
            seçmedi ve kendi cümlesini yazdı.

            SONUCU: "Öğrenmenin sonu yok." artık YALNIZ KAPANIŞTA. Marka
            cümlesi tam iki yerden BİRE indi ve denetimdeki sayı kilidi
            buna göre taşındı — sayı yine TAM ölçülüyor, yani cümle ne
            düşebilir ne çoğalabilir. İki tur önce tersi seçilmişti;
            fikir yine değişirse değiştirilecek yer bu satır. */}
        <h1 className="mt-10 font-display text-[38px] font-semibold leading-[1.1] text-ink md:text-[52px]">
          Sonsuz bir öğrenme döngüsü için tasarlandı.
        </h1>

        {/* TEK TANIM CÜMLESİ — ÖĞRETMENİN KENDİ CÜMLESİ.
            Brief'in alt başlığı ("…şeffaf, yönetilebilir ve anlamlı
            verilerle görünür kılmak için tasarlandı.") bu turda çıktı:
            H1 de "…için tasarlandı." ile bittiği için art arda aynı
            bitişi okutuyordu, ve öğretmen o cümlenin hiç olmamasını
            istedi.

            VELİ "DESTEK OLAN" DEĞİL "DAHİL OLAN". Öğretmenin kuralı ve
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

        {/* İSİM SLOGANI — BÖLÜM BAŞLIĞIYDI, BU TURDA HERO'YA TAŞINDI.
            Bir tur önce "SEKİZ ismini matematiğin sonsuzluk
            düşüncesinden alır." kendi bölümünün `h2`siydi. Öğretmen o
            bölümü kaldırdı ama cümlenin "uygun bir yere slogan gibi"
            yazılmasını istedi; yeri sorulduğunda hero'yu seçti.

            ARTIK `h2` DEĞİL, `p`. Bölüm sırası listesinden düştüğü için
            denetim onu İKİ YÖNLÜ ölçüyor: cümle hero'da DURUYOR ve
            hiçbir `h2` bu cümle DEĞİL. Yalnız varlığını ölçseydik bölüm
            başlığı olarak geri gelebilirdi.

            ŞEKİL BİLGİSİ YOK: "8 yan yatınca…", "8 şeklinden alır" ve
            varyantları yasaklı desen olarak aranıyor. İşaretin kendisi
            (hero'daki `SekizWordmark`, kapanıştaki `Sekiz8Mark`) dönüşümü
            GÖSTEREREK anlatıyor; cümlenin işi açıklamak değil. */}
        <p className="mx-auto mt-8 max-w-[30rem] border-t border-line pt-8 font-display text-[19px] font-semibold leading-[1.35] text-ink md:text-[21px]">
          SEKİZ ismini matematiğin sonsuzluk düşüncesinden alır.
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
   BU TURDA ÜÇ BÖLÜM KALKTI, İKİSİ BİRLEŞTİ — ÖĞRETMENİN KARARI.

   Kendi ifadesi: "tek bir başlıkta daha sade, kafa karışıklığı
   olmadan." Sayfa 13 → 8 bölüm.

   BİRLEŞENLER: "Bir öğretmenin sınıf deneyiminden doğdu." +
   "SEKİZ gelişmeye devam ediyor." → aşağıdaki tek bölüm. Metnini
   öğretmen yazdı ve birebir verdi.

   KALKANLAR: "SEKİZ neden var?" (bir önceki tur) ·
   "Sonuç, öğrenmenin bir sonraki adımını gösterir." ·
   "Değerlendirme, öğrenmeyi görünür kılar." · "Puanın ötesinde,
   gelişim." · ve bölüm olarak "SEKİZ ismini matematiğin sonsuzluk
   düşüncesinden alır." (cümlesi hero'ya slogan oldu).

   HİÇBİRİ SESSİZCE GERİ GELEMEZ: denetim beş başlığın da sayfada
   OLMADIĞINI ölçüyor — ölçümler silinmedi, yönü çevrildi. Geri alma
   kanıtı her birini tek tek gösteriyor.
   ============================================================ */

/* ============================================================
   1 — ÖĞRETMEN DENEYİMİ VE SÜREKLİ GELİŞİM (birleşik)

   İKİ BÖLÜM TEK BÖLÜM OLDU. Eskiden hikâye sayfanın başında, gelecek
   vizyonu ise sonlarında ayrı bir koyu banttaydı; öğretmen ikisinin
   aynı şeyi iki yerden anlattığını söyleyip birleştirdi.

   METİN ÖĞRETMENİN, BİREBİR. Üç paragrafın da tek kelimesi
   değiştirilmedi. Başlık da yazdığı gibi: Title Case ve noktasız.
   Sayfanın diğer sekiz başlığı cümle düzeninde ve noktalı; farkı
   sordum, "yazdığınız gibi kalsın" dedi.

   ZEMİN AÇIK (`bg-surface`), KOYU DEĞİL — ve bu bir karar.
   Birleşen `Gelecek` bölümü koyu bir banttı. Koyu yapmayı düşündüm
   ama metin 180 kelime; 360 px'de ters kontrastlı 180 kelime okuma
   yükü, üstelik hero'nun hemen ardında iki tam genişlik bloğu üst
   üste gelirdi. İstenen şey "sade". SONUCU AÇIKÇA YAZIYORUM: sayfada
   artık orta yerde koyu bant yok, yalnız kapanış koyu.

   SLOGAN BURAYA TAŞINDI. "8'in kesintisiz akışı…" bugüne kadar
   felsefe bölümünün vurgusuydu; öğretmen "bu yazının hemen altına
   slogan olarak gelsin" dedi. Tek kelimesi değişmedi ve sayfada TAM
   BİR KEZ geçtiği ölçülüyor.
   ============================================================ */

function OgretmenDeneyimi() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-16 md:py-20">
        <h2 className="font-display text-[26px] font-semibold leading-[1.2] text-ink md:text-[30px]">
          Öğretmen Deneyimiyle Şekillenen, Sürekli Gelişen Platform
        </h2>

        <P>
          SEKİZ, bir yazılım ofisinde değil; bir matematik öğretmeninin, Buket Topuzoğlu’nun
          uzun yıllara dayanan sınıf deneyiminde şekillendi. Dışarıdan bakılarak kurgulanan
          bir uygulama olarak değil; öğrencilerin, öğretmenlerin ve velilerin eğitim
          sürecinde karşılaştığı doğrudan ihtiyaçlara yanıt vermek üzere sıfırdan tasarlandı.
        </P>
        <P>
          Platformun temelinde, öğrencinin günlük öğrenme yolculuğunu pürüzsüz kılma fikri
          yer alır. Öğrenci; ödevlerini kolayca takip eder, çözümlerini anında karşılaştırarak
          hatalarını zamanında fark eder ve eksiklerini kendi ritmiyle tamamlar. Süreç
          karmaşık görünmekten çıkar; düzenli, net ve motive edici bir alışkanlığa dönüşür.
        </P>
        <P>
          Eğitim durağan değil; yaşayan ve dönüşen bir süreçtir. Bu yüzden SEKİZ, tamamlanıp
          kenara çekilen sabit bir ürün olarak tasarlanmadı. Sınıflardan gelen dönütlerle,
          yeni ihtiyaçlarla ve gelişen teknolojiyle birlikte sürekli gelişmeye, büyümeye
          devam edecek dinamik bir yapıdır.
        </P>

        <GeometricDivider className="mx-auto my-10 max-w-[16rem]" />

        {/* SLOGAN — ÖĞRETMENİN CÜMLESİ, TAŞINDI.
            Bugüne kadar felsefe bölümünün vurgusuydu.

            "8'İN KESİNTİSİZ AKIŞI" VE "SONSUZ BİR YOLCULUK" — ÖĞRETMENİN
            AÇIK KARARI. İkisinin de bugüne kadarki kurallarla (şekil
            bilgisi verme, yolculuk klişesi) ruhen çakıştığını söylemiştim;
            "cümleler aynen girsin" dedi. Yasaklı DESENLERİ tek tek
            ölçtüm: hiçbiriyle eşleşmiyorlar, yani tek bir yasak bile
            gevşetilmedi. Denetim bunu ayrıca kanıtlıyor.

            ÖĞRETMENİN BU TURDAKİ YAZIMI: "sekizin kesintisiz akışı…
            sonsuz yolculuğa". Aynı cümleye işaret ettiği açık ve bir
            düzeltme istemedi; kurulu ve ölçülen hâli korunuyor. */}
        <p className="text-center font-display text-[22px] font-semibold leading-[1.35] text-ink md:text-[24px]">
          8’in kesintisiz akışı, öğrenmenin bitmeyen doğası: SEKİZ, gelişimi anlık sonuçlara
          değil, sonsuz bir yolculuğa dönüştürür.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   2 — SEKİZ NEDİR?
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

      {/* KIYASLAMA CÜMLESİ BURAYA TAŞINDI — öğretmenin seçimi.
          "Puanın ötesinde, gelişim." bölümü bu turda kalktı; içindeki
          tek korunacak cümle buydu ve nereye gideceğini sordum. Üç
          seçenek sundum (bu bölüm / öğrenci / veli); üç rolü birden
          anlatan bu bölümü seçti — cümle hem öğrenciden hem veliden söz
          ettiği için en dengeli yer burası.

          BU BİR SLOGAN DEĞİL, SUNUCUDAKİ BİR SINIR: `kendi_karnem` ve
          `veli_paneli` sınıf ortalamasını, sıralamayı ve başka
          öğrencinin verisini bilerek döndürmüyor (0026/0029), testleri
          de bunu ölçüyor. Denetimdeki `kıyaslama olmadığı yazıyor`
          kilidi taşınmadan aynen duruyor. */}
      <Not>
        Öğrenciye ve veliye başka öğrencilerin puanları veya sıralamaları gösterilmez. Amaç
        kıyaslama değil, kişisel gelişimdir.
      </Not>
    </Bolum>
  );
}

/* ============================================================
   3 — ÖĞRENCİ
   ============================================================ */

function Ogrenci() {
  return (
    <EkranliBolum
      ustBaslik="Öğrenci"
      /* BAŞLIK BRIEF'TEN, "Öğrenci:" ÖN EKİ OLMADAN. Brief başlığı
         "Öğrenci: Kendi Gelişim Yolculuğunun Farkında" diye yazıyor;
         rol adı zaten hemen üstünde `ustBaslik` olarak duruyor, ön ek
         aynı kelimeyi iki kez okuturdu. Türkçe cümle düzeni + nokta. */
      baslik="Kendi gelişim yolculuğunun farkında."
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
      {/* İLK ÜÇ MADDE BRIEF'TEN, BİREBİR. Sonraki üçü ürünün ÖLÇÜLEN
          sınırlarını anlatıyor ve BİLEREK korunuyor:

            • cevap anahtarının ne zaman açıldığı — Kural 6 / Part XXI
            • fotoğrafsız teslimin tamamlanmadığı — ölçülen davranış
            • "tamamlaması gereken" — kalıcı dil kuralının kilidi

          Denetim üçünü de ayrı ayrı ölçüyor. Brief'in maddeleri FAYDA
          anlatıyor, bunlar ürünün ne YAPTIĞINI; ikisi birbirinin yerini
          tutmuyor.

          DÜRÜST NOT: brief'in ilk maddesi ile korunan "tamamlaması
          gereken" maddesi kısmen örtüşüyor. Örtüşmeye rağmen ikisi de
          duruyor, çünkü brief'in cümlesi "tamamlaması gereken"i
          düşürüyor ve o ifade kalıcı dil kuralının sayfadaki karşılığı.
          Fazla bulunursa silinecek yer bu satır. */}
      <Maddeler
        maddeler={[
          [
            'Sade ve Odaklı Takip',
            'Tamamlanan görevler ve sıradaki sorumluluklar net bir akışla tek ekranda görüntülenir.',
          ],
          [
            'Süreç Odaklı Motivasyon',
            'Başarı sadece bir sonuç değil; adım adım kaydedilen bir emek ve gelişim serüveni olarak hissettirilir.',
          ],
          [
            'Öz Düzenleme Becerisi',
            'Öğrenci neyi başardığını ve hangi alanda gelişmesi gerektiğini kendi panelinden kolayca takip eder.',
          ],
          /* "TAMAMLANMAMIŞ ÇALIŞMA" MADDESİ BU TURDA KALKTI.
             Öğretmenin gerekçesi: "Sade ve Odaklı Takip" maddesi zaten
             "sıradaki sorumluluklar" diyor, ikinci bir madde gereksiz
             tekrar. Gerçek gizlenmiyor — yapılmamış ödev sayfada hâlâ
             AÇIKÇA yazılı: öğretmen maddesinde "ödevin yapılıp
             yapılmadığını", veli maddesinde "yaptığı ve yapmadığı
             ödevleri". Denetim ikisini de ölçüyor. */
          [
            'Teslim Akışı',
            'Ödevini çözüm fotoğrafıyla teslim eder, fotoğraf yüklenmeden teslim tamamlanmaz.',
          ],
          [
            'Cevap Anahtarı',
            'Cevap anahtarı ödev tesliminden önce erişime kapalıdır; teslimin hemen ardından açılarak öğrencinin kendi çözümlerini incelemesine, hatalarını anında fark edip kendini geliştirmesine olanak tanır.',
          ],
          [
            'Puan ve Gelişim',
            'Ödevini gönderdikten sonra aldığı puanı, soru bazlı doğru-yanlış analizini, tüm ödevlerden genel başarı ortalamasını ve gelişimini güçlendirebileceği konu alanlarını takip eder.',
          ],
        ]}
      />
      <Not>Öğrenci yalnızca ödev teslim etmez; kendi öğrenme sürecini takip eder.</Not>
    </EkranliBolum>
  );
}

/* ============================================================
   4 — ÖĞRETMEN
   ============================================================ */

function Ogretmen() {
  return (
    <EkranliBolum
      ustBaslik="Öğretmen"
      /* BAŞLIK ÖĞRETMENİN KENDİ CÜMLESİ.
         Bir tur önce brief'in "Öğrenme bir sonuç değil, devam eden bir
         süreçtir." dizesi buradaydı; bunun bir kopyala-yapıştır kayması
         olabileceğini söylemiştim ve öğretmen bu turda gerçek öğretmen
         başlığını yazdı. İki ölçek — sınıf ve tek tek öğrenci — başlığın
         kendisinde duruyor. */
      baslik="Öğretmen sınıfın genel ritmini, öğrencinin bireysel gelişimini görür."
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
      {/* İLK ÜÇ MADDE BRIEF'TEN, BİREBİR — "imkanı" → "imkânı" düzeltmesi
          dışında (brief'in kendi kuralı: sıfır Türkçe yazım hatası).

          DÖRDÜNCÜ MADDE BİLEREK KORUNDU: "henüz tamamlanmadığını" kalıcı
          dil kuralının sayfadaki kilidi — tamamlanmamış ödev gizlenmiyor,
          açıkça yazılıyor. Denetim onu ayrıca ölçüyor. */}
      <Maddeler
        maddeler={[
          [
            'Bütünsel Gelişim Takibi',
            'Öğretmen; yalnızca ödevin yapılıp yapılmadığını değil, hem sınıfın genel ritmini hem de her öğrencinin bireysel gelişimini net olarak görür.',
          ],
          [
            'Nokta Atışı Müdahale',
            'Sınıfın genel eksiklerini ve öğrencilerin bireysel ihtiyaçlarını anında tespit etme imkânı sunar.',
          ],
          [
            'Zaman Yönetimi',
            'Bürokratik ödev kontrolü yükünü hafifleterek öğretmenin enerjisini doğrudan eğitime odaklamasına yardımcı olur.',
          ],
          /* "TAMAMLANMAMIŞ ÖDEV" MADDESİ BU TURDA KALKTI.
             Öğretmenin gerekçesi: olumsuzu ayrı bir BAŞLIK olarak öne
             çıkarmaya gerek yok; bilgi zaten "Bütünsel Gelişim
             Takibi"nin içinde ("ödevin yapılıp yapılmadığını"). Yani
             kalkan şey başlık, gerçek değil — denetim o ifadeyi orada
             ölçmeye devam ediyor.

             BAŞLIK "YANLIŞLAR" OLAMAZ — öğretmenin açık talimatı.
             Kelime GÖVDEDE duruyor ("doğru ve yanlış yaptığı sorular"):
             kalıcı dil kuralı "yanlış"ı yumuşatmayı yasaklıyor, ama onu
             bir başlık hâline getirmeyi de gerektirmiyor. */
          [
            'Soru ve Puan Dökümü',
            'Öğrencilerin bireysel ödev puanlarını, genel ortalamalarını ve sınıfın o ödevdeki başarısını takip eder. Aynı zamanda soru bazlı doğru-yanlış dağılımını detaylıca analiz eder.',
          ],
          [
            'Konu Alanları',
            'Sınıfın hangi matematik konularında gelişime ihtiyaç duyduğunu görür.',
          ],
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
   "SONUÇ, ÖĞRENMENİN BİR SONRAKİ ADIMINI GÖSTERİR." KALKTI.

   ⚠ BU BÖLÜM ÖĞRETMENİN KALICI DİL KURALININ SAYFADAKİ TEK DAYANAĞINI
   TAŞIYORDU ve kalkması onun AÇIK kararı. Gövdedeki cümle şuydu:

     "SEKİZ öğrencinin yalnızca puanını göstermez. Yanlış yaptığı
      soruları ve eksik olduğu konu alanlarını da görünür hâle getirir."

   Sordum ve sonucu gösterdim: "yanlış yaptığı soruları" ifadesi sayfada
   BAŞKA HİÇBİR YERDE geçmiyor (ölçtüm); geriye "soru bazlı doğru-yanlış
   analizi" gibi daha teknik ifadeler kalıyor. Kalıcı kuralı da birebir
   hatırlattım: "Yanlış kelimesini her durumda daha yumuşak bir ifadeyle
   değiştirmeye çalışma." Kararı: "Kalksın."

   KURAL ÜRÜNÜN İÇİNDE AYNEN DURUYOR — bu tur hiçbir ürün ekranına
   dokunulmadı. Kalkan şey yalnız tanıtım sayfasındaki cümle.

   Denetimden iki ölçüm bu yüzden kaldırıldı; gerekçeleri
   `tanitim-denetimi.mjs` içinde yazılı.
   ============================================================ */

/* ============================================================
   5 — VELİ
   ============================================================ */

function Veli() {
  return (
    <EkranliBolum
      ustBaslik="Veli"
      /* BAŞLIK ESKİ HÂLİNE DÖNDÜ — öğretmenin bu turdaki kararı.
         Bir tur önce brief'in "Şeffaf ve Anlamlı Bilgi Akışı" başlığı
         girmişti; öğretmen bu başlığın geri gelmesini istedi. */
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
      {/* ⚠ "EKSİK" VELİ BÖLÜMÜNE GERİ GELDİ — VE BU BİR KARAR DEĞİŞİKLİĞİ.
          Kayda geçiyor çünkü iki tur önce TAM TERSİ seçilmişti.

          O turda öğretmene açıkça sormuştum ve cevabı "yalnız veli
          bölümünde kalksın" olmuştu; cümle çıkarılmış ve denetimde
          "veli bölümünün kendi metninde `eksik` YOK" diye kilitlenmişti.
          Bu turda öğretmen cümleyi kelimesi kelimesine geri yazdırdı:
          "Öğrencinin eksik olduğu veya daha fazla çalışabileceği konu
          alanları veli tarafından görülebilir."

          Son talimat geçerli. O yüzden kilidin O YARISI KALKTI — ama
          diğer yarısı DURUYOR ve asıl kural zaten oydu:
          `çocuğunuzun eksik…` hâlâ YASAKLI desen. Yani veliye "sizin
          çocuğunuzun eksikleri" diye seslenmek hâlâ imkânsız; öğrencinin
          durumunu nesnel olarak yazmak serbest.

          Kalıcı dil kuralıyla da uyumlu: "GERÇEĞİ GİZLEME." Bu cümle
          gerçeği söylüyor ve öğrenciyi etiketlemiyor.

          Fikir yine değişirse değiştirilecek yer: aşağıdaki "Konu
          Alanları" maddesi ve denetimdeki `çocuğunuzun eksik` yasağı. */}
      <Maddeler
        maddeler={[
          /* "KARMAŞIK GRAFİKLER YERİNE" ÇIKTI — öğretmenin talimatı:
             olumsuz bir örnek üzerinden anlatma, doğrudan söyle. */
          [
            'Doğru ve Zamanında Bilgilendirme',
            'Süreci anlaşılır, somut ve anlık verilerle yapıcı bir şekilde takip eder.',
          ],
          [
            'Güvenli Eğitim İş Birliği',
            'Çocuğunun akademik disiplinini ve sorumluluk bilincini objektif bir zeminde gözlemler.',
          ],
          /* "POZİTİF İLETİŞİM" MADDESİ TAMAMEN KALKTI.
             İki ayrı gerekçe: iletişim OKULLA değil öğretmenle kuruluyor
             (ölçüldü — `mesaj_gonder` yalnız veli↔öğretmen kanalı,
             0025), ve öğretmen o maddenin süslü dilini istemedi.
             İletişimin kendisi zaten "Öğrenme, iletişimle güçlenir."
             bölümünde sade bir cümleyle anlatılıyor. */
          [
            'Ödev ve Puan Takibi',
            'Veli; öğrencisinin ödev durumunu, aldığı puanları ve genel başarı ortalamasını takip edebilir.',
          ],
          [
            'Konu Alanları',
            'Öğrencinin eksik olduğu veya daha fazla çalışabileceği konu alanları veli tarafından da görülebilir.',
          ],
          [
            'Doğru Zamanda Destek',
            'Bu görünürlük, öğrencinin ihtiyaç duyduğu desteğin doğru zamanda verilmesine yardımcı olur.',
          ],
        ]}
      />
      <Not>
        SEKİZ, öğretmen ile aile arasında öğrencinin gelişimini destekleyen ortak bir zemin
        oluşturur.
      </Not>
    </EkranliBolum>
  );
}

/* ============================================================
   6 — İLETİŞİM
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
   7 — EWALU
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
   "DEĞERLENDİRME, ÖĞRENMEYİ GÖRÜNÜR KILAR." VE "PUANIN ÖTESİNDE,
   GELİŞİM." KALKTI — öğretmenin kararı.

   DEĞERLENDİRME BÖLÜMÜNDEN KALKAN CÜMLE:
     "Test türündeki ödevler, önceden belirlenmiş kurallar doğrultusunda
      sistem tarafından otomatik olarak değerlendirilir."
   Sordum, "Kalksın" dedi.

   KURAL 5 GÜVENCESİ KALKMADI — ÖLÇÜLDÜ. Öğretmen bölümü zaten şunu
   söylüyor ve denetim onu AYRICA ölçüyor:
     "Açık uçlu ödevlerde öğrencinin çözümü öğretmen tarafından kontrol
      edilir ve nihai puan öğretmen tarafından verilir."
   Yani "puanlamayı öğretmen yapar" sayfada yazılı ve kilitli kalıyor.
   Kalkan tek şey, testin SABİT KURALLARLA puanlandığının yazılı olması.

   GELİŞİM BÖLÜMÜNDEN TEK CÜMLE KORUNDU ve öğretmen nereye gideceğini
   kendisi seçti: kıyaslama cümlesi "Ödevden gelişime…" bölümüne taşındı
   (üç rolü birden anlatan bölüm; cümle hem öğrenciden hem veliden söz
   ettiği için en dengeli yer orası). Denetimdeki `kıyaslama olmadığı
   yazıyor` kilidi aynen duruyor.
   ============================================================ */

/* ============================================================
   8 — SEKİZ'İN ARKASINDAKİ YAKLAŞIM

   KÜNYE, ÖZGEÇMİŞ DEĞİL. Brief'in istediği tam künye burada duruyor:
   ad, unvan ve rolün kapsamı. Hero yalnız yeni bilgiyi taşıyor
   ("Fikir, pedagojik tasarım ve yazılım geliştirme"); tam hâli
   sayfanın sonunda, okuyucu ürünü gördükten sonra.

   ÖVGÜ SIFATI YOK — brief'te "vizyoner öğretmen", "benzersiz",
   "devrim", "geleceği değiştiren" açıkça yasak ve denetim hepsini
   yasaklı desen olarak arıyor. Ölçü, sıfatla değil işin nereden
   çıktığıyla veriliyor.

   İKİ KOYU BANDIN ARASINDA AÇIK ZEMİN. "SEKİZ gelişmeye devam
   ediyor." ve kapanış art arda iki koyu bant; araya giren bu bölüm
   ritmi açıyor. Konumu tesadüf değil.
   ============================================================ */

function Kunye() {
  return (
    <Bolum baslik="SEKİZ'in arkasındaki yaklaşım">
      <div className="mt-7 border-t border-line pt-6">
        <p className="font-display text-[20px] font-semibold leading-[1.3] text-ink">
          Buket Topuzoğlu
        </p>
        <p className="mt-1 text-[13px] font-bold uppercase tracking-[0.16em] text-muted">
          Matematik Öğretmeni
        </p>
        <p className="mt-4 text-[16px] leading-[1.65] text-ink">
          SEKİZ'in fikir, pedagojik tasarım ve yazılım geliştirme süreçleri Buket Topuzoğlu
          tarafından yürütülüyor.
        </p>
      </div>

      {/* KAPANIŞ CÜMLESİ BU TURDA KALKTI — öğretmenin talimatı:
          "SEKİZ bu ölçüyle tasarlandı; her yeni özellik de aynı ölçüyle
          değerlendiriliyor." çıkarılacak. Cümle bir "ölçü"ye atıf
          yapıyordu ama o ölçüyü tarif eden paragraf bir tur önce zaten
          buradan kalkmıştı; geriye neye işaret ettiği belirsiz bir
          kapanış kalmıştı.

          Künye artık yalnız kimlik taşıyor: ad, unvan, rolün kapsamı.
          Cümle denetimde YASAKLI DESEN olarak duruyor ki sessizce geri
          gelmesin. */}
    </Bolum>
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
