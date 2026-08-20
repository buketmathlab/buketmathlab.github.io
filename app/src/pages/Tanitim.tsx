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
 * SEKİZ tanıtım sayfası — Faz 9, ikinci yazım. Adres: /yeni/tanitim/
 *
 * İLK YAZIMI ÖĞRETMEN BEĞENMEDİ. Sayfayı yeniden okuyunca üç şey çıktı ve
 * üçü de gerçekti:
 *
 * 1. "Neden" bölümü ÇIKARILDI. Bir matematik öğretmeninin haftasını
 *    "ödevler grup mesajında, cevap anahtarı telefonun galerisinde, kimin
 *    ne yaptığı bir defterde" diye anlatıyordu — üstünde öğretmenin adı ve
 *    okulun mührü olan bir sayfada. Müdür ya da veli bunu ÖĞRETMENİN
 *    bugünkü düzeninin tarifi olarak okuyabilirdi. Ton meselesi değil,
 *    sahibine zarar veren bir metindi.
 *
 * 2. SAYFA ANLATMAK YERİNE SAVUNUYORDU. Her bölüm olumsuzlamayla doluydu:
 *    "hiçbir koşulda", "sessizce değişmiyor", "gerçekten gönderilmiyor".
 *    Sorulmamış itirazlara cevap veren bir metin, ürünü cevaplayacak bir
 *    şeyi varmış gibi gösterir. Güvenceler silinmedi — hepsi doğru ve
 *    hepsi duruyor — ama dağıtılmak yerine TEK BİR YERDE, sakin bir liste
 *    hâlinde toplandı ("Değişmeyen kurallar").
 *
 * 3. EN İYİ İŞİ EKRAN GÖRÜNTÜLERİ YAPIYORDU VE EN AZ YERİ ONLAR ALIYORDU.
 *    Büyütüldüler ve geniş ekranda metnin yanına alındılar.
 *
 * DEĞİŞMEYENLER: hiçbir iddia eklenmedi ya da yumuşatılmadı. Ürünün
 * yapmadığı bir şey hâlâ yazmıyor, yaptığı bir şey hâlâ abartılmıyor
 * (Part L, Kural 15). `tanitim-denetimi.mjs`'in aradığı dört cümlenin
 * dördü de sayfada duruyor.
 */
export function Tanitim() {
  return (
    <>
      <UstCubuk />
      <main id="icerik">
        <Acilis />
        <Ogrenciye />
        <Ogretmene />
        <Veliye />
        <EwaluBolumu />
        <Kurallar />
        <Kim />
        <Kapanis />
      </main>
    </>
  );
}

/* ============================================================
   ORTAK PARÇALAR
   ============================================================ */

function Bolum({
  no,
  baslik,
  children,
  zemin = 'kagit',
}: {
  no: string;
  baslik: string;
  children: ReactNode;
  zemin?: 'kagit' | 'yuzey';
}) {
  return (
    <section className={zemin === 'yuzey' ? 'bg-surface' : ''}>
      <div className="mx-auto max-w-[52rem] px-5 py-14">
        <p className="sk-sayi text-[12px] font-bold tracking-[0.18em] text-amber">{no}</p>
        <h2 className="mt-1 text-[26px] text-ink">{baslik}</h2>
        {children}
      </div>
    </section>
  );
}

/** Gövde paragrafı. */
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[17px] leading-[1.6] text-ink">{children}</p>;
}

/**
 * Rol bölümlerinin düzeni: dar ekranda metin sonra görsel, geniş ekranda
 * yan yana. Görsel artık 300 px'e kadar büyüyor ve metinle eşit ağırlıkta
 * — ilk yazımda 260 px'e sıkışmış ve paragraf duvarının altında
 * kalmıştı.
 */
function RolBolum({
  no,
  baslik,
  zemin,
  dosya,
  alt,
  children,
}: {
  no: string;
  baslik: string;
  zemin?: 'kagit' | 'yuzey';
  dosya: string;
  alt: string;
  children: ReactNode;
}) {
  return (
    <Bolum no={no} baslik={baslik} {...(zemin ? { zemin } : {})}>
      <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <div className="md:flex-1">{children}</div>
        <figure className="flex justify-center md:w-[300px] md:shrink-0">
          <img
            src={`/yeni/tanitim-ekranlar/${dosya}`}
            alt={alt}
            width={780}
            height={1520}
            loading="lazy"
            decoding="async"
            className="w-full max-w-[300px] rounded-sk-lg border border-line shadow-sk-md"
          />
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
   01 — AÇILIŞ
   ============================================================ */

function Acilis() {
  return (
    <section className="relative overflow-hidden">
      <SekizgenDoku />

      <div className="relative mx-auto max-w-[42rem] px-5 pb-16 pt-12 text-center">
        <h1 className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </h1>

        <p className="mx-auto mt-7 max-w-[30rem] text-[22px] leading-[1.4] text-ink">
          Matematik ödevleri; verilmesi, yapılması ve takibi tek yerde.
        </p>

        {/* Marka fikri bir kez söyleniyor ve bırakılıyor. */}
        <p className="mx-auto mt-3 max-w-[30rem] text-[16px] text-muted">
          Sekiz, yan yattığında sonsuzluk işaretidir. Öğrenmenin sonu yok.
        </p>

        <p className="mt-8 text-[14px] text-muted">
          Arnavutköy Korkmaz Yiğit Anadolu Lisesi · Matematik
        </p>
      </div>
    </section>
  );
}

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
   02 — ÖĞRENCİ
   ============================================================ */

function Ogrenciye() {
  return (
    <RolBolum
      no="02"
      baslik="Öğrenci"
      dosya="ogrenci.webp"
      alt="Öğrencinin ödev listesi ekranı: bekleyen ve gönderilmiş ödevler, puanlar"
    >
      <P>
        Koduyla giriyor, ödevlerini görüyor; süresi yaklaşan en üstte duruyor. Testte
        şıkları ekrandan işaretliyor, açık uçlu ödevde çözümünün fotoğrafını gönderiyor.
      </P>
      <P>
        Testlerde puanı gönderdiği anda çıkıyor. Açık uçlu ödevlerde puanı öğretmen
        veriyor. Sonra doğrusunu, hangi soruda takıldığını ve dönem boyunca hangi konuda
        eksiği olduğunu kendi ekranından izliyor.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   03 — ÖĞRETMEN
   ============================================================ */

function Ogretmene() {
  return (
    <RolBolum
      no="03"
      baslik="Öğretmen"
      zemin="yuzey"
      dosya="ogretmen.webp"
      alt="Öğretmen panosu: öğrenci sayısı, açık ödev, puan bekleyen ve eksik ödev kutuları"
    >
      <P>
        Panoda günün dört sayısı var: kaç öğrenci, kaç açık ödev, kaç gönderim puan
        bekliyor, kaç ödev eksik kalmış. Her sayının üstüne dokununca listesi açılıyor —
        ve listede yalnız gönderenler değil, <strong className="font-bold">kimin
        göndermediği</strong> de var.
      </P>
      <P>
        Cevap anahtarını elle girmek gerekmiyor: PDF'i yükleniyor, sistem okuduğunu öneri
        olarak gösteriyor, onaylanmadan hiçbir şey kaydedilmiyor. Dönem ilerledikçe
        sınıfın hangi konuda zayıf olduğu tek ekranda görünüyor.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   04 — VELİ
   ============================================================ */

function Veliye() {
  return (
    <RolBolum
      no="04"
      baslik="Veli"
      dosya="veli.webp"
      alt="Velinin ödev listesi: gönderilen ödevler, alınan puan, yanlış yapılan soruların numaraları ve süresi yaklaşan ödev"
    >
      <P>
        Velinin kendi kodu var. Çocuğunun yaptığı ve yapmadığı ödevleri, aldığı puanları
        ve hangi konuda eksiği olduğunu görüyor.
      </P>
      <P>
        Öğretmene buradan yazabiliyor. Öğrencinin öğretmeniyle yazışması ile velinin
        yazışması ayrı tutuluyor; ikisi birbirinin yazdığını görmüyor.
      </P>
    </RolBolum>
  );
}

/* ============================================================
   05 — EWALU
   ============================================================ */

function EwaluBolumu() {
  return (
    <Bolum no="05" baslik="Ewalu" zemin="yuzey">
      <div className="mt-4 flex items-start gap-4">
        <EwaluFigure poz="karsilama" boyut={72} dekoratif className="shrink-0" />
        <div>
          <P>
            SEKİZ'in asistanı. Öğrenciyi karşılıyor ve puanını gördüğü anda ona bir şey
            söylüyor — cümleler öğretmenin yazdığı cümleler, puan aralığına göre
            seçiliyorlar.
          </P>
        </div>
      </div>

      <div className="mt-6">
        <EwaluVideo />
      </div>
    </Bolum>
  );
}

/* ============================================================
   06 — DEĞİŞMEYEN KURALLAR
   ============================================================ */

/**
 * GÜVENCELER BURADA TOPLANDI.
 *
 * İlk yazımda bu cümleler bölümlere dağılmıştı ve her biri kendi
 * bağlamında bir savunma gibi duruyordu. Aynı cümleler tek bir yerde,
 * "bunlar ürünün kuralları" başlığı altında toplandığında savunma
 * olmaktan çıkıp TASARIM KARARI oluyorlar — ki gerçekte oldukları şey de
 * bu.
 *
 * Buradaki dört maddenin dördü de sunucu tarafında test edilmiş
 * güvencelerdir; hiçbiri arayüzde gizlemeye dayanmıyor.
 */
function Kurallar() {
  const kurallar: Array<{ baslik: string; metin: ReactNode }> = [
    {
      baslik: 'Puanı insan verir',
      metin: (
        <>
          Testlerin puanını sunucu hesaplıyor, kural her öğrenci için aynı. Açık uçlu
          ödevlerde puanı öğretmen veriyor.{' '}
          <strong className="font-bold">Hiçbir ödevi yapay zekâ değerlendirmiyor.</strong>
        </>
      ),
    },
    {
      baslik: 'Cevap anahtarı yalnız öğretmende',
      metin: (
        <>
          Öğrenci anahtarı ancak ödevini gönderdikten sonra görüyor; öncesinde cihazına
          hiç inmiyor. Veliye{' '}
          <strong className="font-bold">cevap anahtarı hiçbir koşulda</strong>{' '}
          gönderilmiyor.
        </>
      ),
    },
    {
      baslik: 'Kıyas yok',
      metin: (
        <>
          Sınıf ortalaması, sıralama, başka bir öğrencinin verisi — hiçbiri öğrenciye de
          veliye de gönderilmiyor. Çocuk kendi gidişatını görüyor.
        </>
      ),
    },
    {
      baslik: 'Not sessizce değişmez',
      metin: (
        <>
          Öğretmen bir cevap anahtarını sonradan düzeltirse o ödev yeniden puanlanıyor ve
          puanı değişen her öğrenci öğretmene listeleniyor.
        </>
      ),
    },
  ];

  return (
    <Bolum no="06" baslik="Değişmeyen kurallar">
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {kurallar.map((k) => (
          <li key={k.baslik} className="rounded-sk-lg border border-line bg-surface p-5">
            <p className="text-[16px] font-bold text-ink">{k.baslik}</p>
            <p className="mt-2 text-[15px] leading-[1.6] text-muted">{k.metin}</p>
          </li>
        ))}
      </ul>

      {/* Veri notu artık kendi bölümü değil, bu bölümün dipnotu. Müdürün ve
          velinin soracağı soru bu ve cevabı duruyor — ama sayfanın üçte
          birini kaplamıyor. */}
      <p className="mt-6 text-[14px] leading-[1.6] text-muted">
        Veriler Supabase üzerinde, <strong className="font-bold">Zürih</strong> (İsviçre)
        bölgesinde tutuluyor. Ödev dosyalarına ve çözüm fotoğraflarına yalnız yetkisi olan
        kişi erişebiliyor; her erişim için kısa ömürlü ayrı bir bağlantı üretiliyor. Bu
        sayfa çerez kullanmıyor ve ziyaretçi takibi yapmıyor. Yukarıdaki ekran
        görüntülerindeki adlar ve puanlar{' '}
        <strong className="font-bold">uydurmadır</strong>.
      </p>
    </Bolum>
  );
}

/* ============================================================
   07 — KİM YAPTI
   ============================================================ */

function Kim() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-14 text-center">
        <p className="sk-sayi text-[12px] font-bold tracking-[0.18em] text-amber">07</p>

        {/* Mühür yalnız 96 px ve üstünde kullanılır (Faz 0 kuralı);
            küçükte halka yazısı okunmuyor. `dekoratif` değil: okulun adı
            burada mührün kendisiyle taşınıyor. */}
        <div className="mt-6 flex justify-center">
          <SchoolCrest boyut={160} />
        </div>

        <h2 className="mt-6 text-[26px] text-ink">Buket Topuzoğlu</h2>
        <p className="mt-1 text-[16px] text-muted">Matematik Öğretmeni</p>
        <p className="mt-4 text-[15px] text-ink">
          Arnavutköy Korkmaz Yiğit Anadolu Lisesi · Beşiktaş
        </p>

        <GeometricDivider className="my-8" />

        <p className="mx-auto max-w-[34rem] text-[16px] text-muted">
          SEKİZ bir şirket ürünü değil; kendi sınıfları için yapılmış, kendi
          öğrencileriyle kullanılan bir uygulama.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   08 — KAPANIŞ
   ============================================================ */

function Kapanis() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[42rem] px-5 py-16 text-center">
        <div className="flex justify-center">
          <StarEight boyut={28} bicim="cizgi" className="text-paper opacity-70" />
        </div>

        {/* Sayfadaki ikinci ve son 8 → ∞ dönüşümü: açılışta ve kapanışta,
            arası hareketsiz. Hareket azaltma tercihi açıksa dönmüyor. */}
        <div className="mt-6 flex justify-center text-paper">
          <Sekiz8Mark boyut={64} acilistaDonsun gecikme={200} etiket={null} />
        </div>

        <p className="mt-6 text-[22px] leading-[1.35]">Öğrenmenin sonu yok.</p>

        <a
          href="/yeni/"
          className="mt-8 inline-flex min-h-[48px] items-center rounded-sk-sm bg-paper px-6 text-[16px] font-bold text-ink"
        >
          Giriş ekranına git
        </a>

        <p className="mt-8 text-[13px] text-paper/70">
          SEKİZ · Buket Topuzoğlu · Matematik
        </p>
      </div>
    </section>
  );
}
