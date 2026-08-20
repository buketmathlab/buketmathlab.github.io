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
 * METİN ÖĞRETMENİNDİR VE BİREBİR KULLANILIYOR.
 *
 * Öğretmen bu sayfa için nihai bir editoryal karar seti verdi: her
 * bölümün başlığı ve metni yazılmış hâlde. Talimat açıktı —
 * "Yukarıdaki metinleri doğrudan kullan... Yeni sloganlar üretme.
 * Alternatifler sunma. Metni yeniden yorumlama."
 *
 * Bu dosyada benim yaptığım iş YERLEŞİM: bölüm sırası, tipografi
 * ölçüleri, ekran görüntülerinin metnin yanına alınması, dar/geniş ekran
 * davranışı. Cümlelere dokunulmadı.
 *
 * ÜÇ KALICI KURAL — brief'te açıkça yazılı, denetimde de ölçülüyor
 * (`scripts/tanitim-denetimi.mjs` 5. grup):
 *
 *   1. İsmin matematiksel çağrışımı ŞEKİL BİLGİSİ olarak anlatılmaz.
 *      "8 yan yatınca…" ve bütün varyantları yasak.
 *   2. "Veli süreci görür, öğrencinin yerine geçmez." KULLANILMAZ.
 *      Negatif ve velinin rolünü yanlış anlatıyor.
 *   3. Ewalu NE OLMADIĞIYLA anlatılmaz. "Ewalu ödev değerlendirmez,
 *      puan vermez…" diye başlayan bir paragraf yazılmaz.
 *
 * METİNDEKİ TEK EKSİK İDDİA GİDERİLDİ, METİN DEĞİŞTİRİLMEDİ. Metin iki
 * yerde "genel ortalamasını takip edebilir" diyordu ve ölçüldü: böyle
 * bir ekran yoktu. Öğretmenin kararıyla metne dokunulmadı, eksik özellik
 * yapıldı (migration 0029). Bu yüzden sayfa 0029 canlıya çıkmadan
 * yayımlanmamalı.
 *
 * SUNUCUYA HİÇ İSTEK ATMIYOR: ne oturum sağlayıcı, ne Supabase istemcisi.
 * Sıfır çerez, sıfır takip — sayfanın kendi cümlesi bunu söylüyor ve
 * denetim bunu ayrıca ölçüyor.
 */
export function Tanitim() {
  return (
    <>
      <UstCubuk />
      <main id="icerik">
        <Acilis />
        <Anlam />
        <NedenSekiz />
        <Ogrenci />
        <AcikUclu />
        <Ogretmen />
        <Veli />
        <Iletisim />
        <EwaluBolumu />
        <GeriBildirim />
        <VeriGuvenligi />
        <Hikaye />
        <Kapanis />
      </main>
    </>
  );
}

/* ============================================================
   ORTAK PARÇALAR
   ============================================================ */

function Bolum({
  baslik,
  children,
  zemin = 'kagit',
  genis = false,
}: {
  baslik: string;
  children: ReactNode;
  zemin?: 'kagit' | 'yuzey';
  genis?: boolean;
}) {
  return (
    <section className={zemin === 'yuzey' ? 'bg-surface' : ''}>
      <div className={`mx-auto ${genis ? 'max-w-[52rem]' : 'max-w-[42rem]'} px-5 py-14`}>
        <h2 className="text-[26px] leading-[1.2] text-ink">{baslik}</h2>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[17px] leading-[1.65] text-ink">{children}</p>;
}

/**
 * Rol bölümü: metin ve ekran görüntüsü. Dar ekranda alt alta, geniş
 * ekranda yan yana — üç ekran görüntüsü sayfanın en somut kısmı ve
 * paragraf duvarının altında kalmamaları gerekiyor.
 *
 * UYDURMA VERİ NOTU her görselin ALTINDA. Öğretmenin metninde bu not
 * yok; ekran görüntüleri de metninde yok. Görseller kalsın dedi, ben de
 * onları gerçek bir öğrenciye aitmiş gibi göstermemek için tek satırlık
 * bir açıklama ekledim — metne değil, görselin altına.
 */
function RolBolum({
  baslik,
  zemin,
  dosya,
  alt,
  children,
}: {
  baslik: string;
  zemin?: 'kagit' | 'yuzey';
  dosya: string;
  alt: string;
  children: ReactNode;
}) {
  return (
    <Bolum baslik={baslik} genis {...(zemin ? { zemin } : {})}>
      <div className="mt-2 flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <div className="md:flex-1">{children}</div>
        <figure className="md:w-[300px] md:shrink-0">
          <img
            src={`/yeni/tanitim-ekranlar/${dosya}`}
            alt={alt}
            width={780}
            height={1520}
            loading="lazy"
            decoding="async"
            className="mx-auto w-full max-w-[300px] rounded-sk-lg border border-line shadow-sk-md"
          />
          <figcaption className="mt-2 text-center text-[12px] text-muted">
            Örnek ekran — adlar ve puanlar uydurmadır.
          </figcaption>
        </figure>
      </div>
    </Bolum>
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
        <div className="mx-auto flex max-w-[52rem] items-center justify-between gap-3 px-5 py-2">
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
   HERO
   ============================================================ */

function Acilis() {
  return (
    <section className="relative overflow-hidden">
      <SekizgenDoku />

      <div className="relative mx-auto max-w-[42rem] px-5 pb-16 pt-12 text-center">
        <div className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </div>

        {/* SAYFANIN TEK h1'İ: öğretmenin belirlediği ana başlık. */}
        <h1 className="mt-8 font-display text-[32px] font-semibold leading-[1.15] text-ink">
          Öğrenmenin sonu yok.
        </h1>

        <p className="mx-auto mt-5 max-w-[34rem] text-[18px] leading-[1.55] text-ink">
          SEKİZ; öğrencinin öğrenmesini takip ettiği, öğretmenin gelişimi gördüğü ve
          velinin bu sürece eşlik ettiği dijital bir eğitim platformudur.
        </p>

        {/* Dört adım. Ayraç `·` markanın ayracı (SekizWordmark ile aynı). */}
        <p className="mt-7 text-[14px] font-bold tracking-[0.08em] text-muted">
          Ödev · Değerlendirme · Geri Bildirim · Gelişim
        </p>
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
   SEKİZ'İN ANLAMI
   ============================================================ */

function Anlam() {
  return (
    <Bolum baslik="Öğrenme bir sonuç değil, devam eden bir süreçtir." zemin="yuzey">
      <P>
        SEKİZ, sonsuzluk fikrinden ilham alır. Çünkü öğrenme de tamamlanan bir görev
        değil; her kazanımın yeni bir soruya, yeni bir düşünceye ve yeni bir gelişime
        açıldığı sürekli bir süreçtir.
      </P>
      <p className="mt-6 font-display text-[22px] font-semibold text-ink">
        Öğrenmenin sonu yok.
      </p>
    </Bolum>
  );
}

/* ============================================================
   NEDEN SEKİZ?
   ============================================================ */

function NedenSekiz() {
  return (
    <Bolum baslik="Öğrenmeyi görünür kılmak.">
      <P>
        SEKİZ, ödevden değerlendirmeye ve geri bildirimden gelişime uzanan süreci tek bir
        yerde birleştirir. Öğrenci ne yapacağını ve nasıl ilerlediğini görür; öğretmen
        sınıfın ihtiyaçlarını fark eder; veli ise çocuğunun öğrenme sürecini daha
        yakından destekleyebilir.
      </P>
      <P>
        Amaç yalnızca ödevleri takip etmek değil, öğrenmenin nasıl ilerlediğini görünür
        kılmaktır.
      </P>
    </Bolum>
  );
}

/* ============================================================
   ÖĞRENCİ
   ============================================================ */

function Ogrenci() {
  return (
    <RolBolum
      baslik="Öğrenci kendi gelişimini görür."
      zemin="yuzey"
      dosya="ogrenci.webp"
      alt="Öğrencinin ödev listesi ekranı: bekleyen ve gönderilmiş ödevler, puanlar"
    >
      <P>
        Öğrenci kendisine verilen tüm ödevleri tek ekrandan görür; hangilerinin
        beklediğini, hangilerini tamamladığını takip eder. Ödevini tamamladığında
        çözümünü fotoğraf olarak yükler ve teslim eder.
      </P>
      <P>
        Testlerde puanını teslim ettiği anda görür. Ödevini teslim etmeden cevap
        anahtarına erişemez; teslimden sonra cevap anahtarı açılır ve kendi çözümünü
        kontrol edebilir.
      </P>
      <P>
        Öğrenci tek tek ödev sonuçlarının yanı sıra genel ortalamasını ve hangi konu
        alanlarında daha fazla çalışması gerektiğini de takip edebilir. Yapılmayan
        ödevler puanlandırılmaz.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   AÇIK UÇLU ÖDEVLER
   ============================================================ */

function AcikUclu() {
  return (
    <Bolum baslik="Değerlendirmede öğretmenin bilgisi ve deneyimi merkezde.">
      <P>
        Açık uçlu ödevlerde öğrencinin çalışması öğretmen tarafından kontrol edilir ve son
        değerlendirme öğretmen tarafından yapılır. Teknoloji süreci kolaylaştırır;
        pedagojik değerlendirme öğretmende kalır.
      </P>
    </Bolum>
  );
}

/* ============================================================
   ÖĞRETMEN
   ============================================================ */

function Ogretmen() {
  return (
    <RolBolum
      baslik="Öğretmen sınıfın gelişimini görür."
      zemin="yuzey"
      dosya="ogretmen.webp"
      alt="Öğretmen panosu: öğrenci sayısı, açık ödev, puan bekleyen ve eksik ödev kutuları"
    >
      <P>
        Öğretmen hangi öğrencinin ödevini yaptığını, hangisinin yapmadığını, ödev
        sonuçlarını ve puan bekleyen çalışmaları tek ekrandan takip eder. Öğrenci ve ödev
        ortalamalarını, sınıf ortalamasını ve zaman içindeki gelişimi görebilir.
      </P>
      <P>
        SEKİZ ayrıca sınıf genelinde hangi matematik konularında daha fazla çalışmaya
        ihtiyaç olduğunu görünür kılar. Böylece değerlendirme, yalnızca bir sonuç değil;
        öğretmenin bir sonraki ders için alacağı kararlara yardımcı olan bir bilgiye
        dönüşür.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   VELİ
   ============================================================ */

function Veli() {
  return (
    <RolBolum
      baslik="Öğrenme sürecine aile de eşlik eder."
      dosya="veli.webp"
      alt="Velinin ödev listesi: gönderilen ödevler, alınan puan, yanlış yapılan soruların numaraları ve süresi yaklaşan ödev"
    >
      <P>
        Veli; çocuğunun yaptığı ve yapmadığı ödevleri, aldığı puanları, genel ortalamasını
        ve gelişim alanlarını takip edebilir. Böylece öğrencinin ihtiyaç duyduğu desteği
        zamanında fark edebilir ve öğrenme sürecine daha bilinçli biçimde eşlik edebilir.
      </P>
      <P>
        SEKİZ, öğretmen ile aile arasında öğrencinin gelişimini destekleyen ortak bir
        zemin oluşturur.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   İLETİŞİM
   ============================================================ */

function Iletisim() {
  return (
    <Bolum baslik="İletişim de öğrenmenin bir parçasıdır." zemin="yuzey">
      <P>
        SEKİZ üzerinden öğrenci-öğretmen ve veli-öğretmen arasında ayrı iletişim kanalları
        kurulabilir. Böylece öğrencinin öğrenme süreciyle ilgili iletişim ile velinin
        öğretmenle iletişimi kendi sınırları içinde ve güvenli biçimde yürütülür.
      </P>
    </Bolum>
  );
}

/* ============================================================
   EWALU
   ============================================================ */

function EwaluBolumu() {
  return (
    <Bolum baslik="Ewalu">
      <p className="mt-2 text-[17px] font-semibold text-muted">
        SEKİZ'in öğrenme sürecindeki dijital yüzü.
      </p>

      <div className="mt-5 flex items-start gap-4">
        <EwaluFigure poz="karsilama" boyut={72} dekoratif className="shrink-0" />
        <div>
          <p className="text-[17px] leading-[1.65] text-ink">
            Ewalu, öğrenciyi SEKİZ deneyimi boyunca karşılayan ve öğrenme sürecine eşlik
            eden dijital asistandır. Öğrencinin başarısını fark eder, zorlandığı anlarda
            onu destekler ve çalışmaya devam etmesi için yapıcı geri bildirimler sunar.
          </p>
        </div>
      </div>

      <P>Ewalu'nun dili, öğrenciyi cevaba değil; düşünmeye ve öğrenmeye yönlendirir.</P>

      <div className="mt-7">
        <EwaluVideo />
      </div>
    </Bolum>
  );
}

/* ============================================================
   ÖĞRENME GERİ BİLDİRİMİ
   ============================================================ */

function GeriBildirim() {
  return (
    <Bolum baslik="Puanın ötesinde: Öğrencinin gelişimi." zemin="yuzey">
      <P>
        SEKİZ, öğrencinin yalnızca kaç puan aldığını değil, hangi konularda daha fazla
        çalışmaya ihtiyaç duyduğunu da görmesine yardımcı olur. Öğrenci zaman içinde kendi
        sonuçlarını izleyerek gelişimini daha bilinçli biçimde takip eder.
      </P>
    </Bolum>
  );
}

/* ============================================================
   VERİ GÜVENLİĞİ
   ============================================================ */

function VeriGuvenligi() {
  return (
    <Bolum baslik="Güven, eğitim deneyiminin temelidir.">
      <P>
        SEKİZ'de öğrenci bilgileri, ödevler ve değerlendirme sonuçları güvenli bir dijital
        altyapıda tutulur. Sistem Supabase altyapısını kullanır ve veritabanı Zürih,
        İsviçre bölgesinde çalışır.
      </P>
      <P>
        Ödev dosyaları ve öğrenci çözüm görselleri herkese açık değildir; yalnızca yetkili
        erişimle görüntülenebilir. Öğretmen erişimi güvenli şekilde korunur ve giriş
        bilgileri düz metin olarak saklanmaz.
      </P>
      <P>Tanıtım sayfası ziyaretçi takibi yapmaz ve çerez kullanmaz.</P>
    </Bolum>
  );
}

/* ============================================================
   SEKİZ'İN HİKÂYESİ
   ============================================================ */

function Hikaye() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-14">
        <h2 className="text-[26px] leading-[1.2] text-ink">Bir sınıfın ihtiyacından doğdu.</h2>
        <P>
          SEKİZ, matematik öğretmeni Buket Topuzoğlu'nun öğrencilerinin ödev,
          değerlendirme ve gelişim süreçlerini daha düzenli ve görünür hâle getirme
          ihtiyacından doğdu. Gerçek sınıf deneyimlerinden beslenerek geliştirilen SEKİZ,
          öğrencinin öğrenmesini, öğretmenin değerlendirmesini ve ailenin desteğini aynı
          sistemde buluşturmayı amaçlar.
        </P>

        <GeometricDivider className="my-9" />

        <div className="text-center">
          {/* Mühür yalnız 96 px ve üstünde kullanılır (Faz 0 kuralı):
              küçükte halka yazısı okunmuyor. Kurum bilgisi öğretmenin
              verdiği biçimde, dört satır. */}
          <div className="flex justify-center">
            <SchoolCrest boyut={160} />
          </div>
          <p className="mt-6 font-display text-[22px] font-semibold text-ink">
            Buket Topuzoğlu
          </p>
          <p className="mt-1 text-[16px] text-muted">Matematik Öğretmeni</p>
          <p className="mt-4 text-[15px] text-ink">Arnavutköy Korkmaz Yiğit Anadolu Lisesi</p>
          <p className="text-[15px] text-muted">Beşiktaş · İstanbul</p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   KAPANIŞ
   ============================================================ */

function Kapanis() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[42rem] px-5 py-16 text-center">
        <div className="flex justify-center">
          <StarEight boyut={28} bicim="cizgi" className="text-paper opacity-70" />
        </div>

        {/* Sayfadaki ikinci ve son 8 → ∞ hareketi: açılışta ve kapanışta,
            arası hareketsiz (Kural 12). Hareket azaltma tercihi açıksa
            dönmüyor, doğrudan ∞ duruyor. */}
        <div className="mt-6 flex justify-center text-paper">
          <Sekiz8Mark boyut={64} acilistaDonsun gecikme={200} etiket={null} />
        </div>

        <p className="mt-7 font-display text-[26px] font-semibold leading-[1.25]">
          Öğrenmenin sonu yok.
        </p>
        <p className="mx-auto mt-4 max-w-[32rem] text-[16px] leading-[1.6] text-paper/85">
          SEKİZ, her ödevi öğrencinin bir sonraki gelişim adımına açılan bir öğrenme
          fırsatı olarak görür.
        </p>

        <a
          href="/yeni/"
          className="mt-9 inline-flex min-h-[48px] items-center rounded-sk-sm bg-paper px-6 text-[16px] font-bold text-ink"
        >
          Giriş ekranına git
        </a>

        <p className="mt-10 text-[14px] font-bold tracking-[0.12em] text-paper">SEKİZ</p>
        <p className="mt-1 text-[13px] text-paper/70">Buket Topuzoğlu · Matematik</p>
      </div>
    </section>
  );
}
