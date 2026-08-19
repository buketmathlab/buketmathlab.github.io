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
 * SEKİZ tanıtım sayfası — Faz 9. Adres: /yeni/tanitim/
 *
 * KİME YAZILDI: okul müdürüne, veliye ve ürünü ilk kez duyan birine.
 * Öğrenciye değil — öğrencinin ihtiyacı giriş kutusudur, o ekran ayrı ve
 * bu sayfa oraya hiç engel olmuyor.
 *
 * TON: satış dili yok. Ne "devrim" ne "yapay zekâ destekli". Sayfadaki her
 * cümle bugün ÇALIŞAN bir şeyi anlatıyor; yapılmamış bir şey yapılmış gibi
 * yazılmıyor (Part L, Kural 15). Aşağıda birkaç yerde bunun ne demek
 * olduğunu ayrıca not ettim — özellikle puanlamanın kim tarafından
 * yapıldığı konusunda.
 *
 * SUNUCUYA HİÇ İSTEK ATMIYOR. Bu sayfa Supabase istemcisini içe bile
 * aktarmıyor; açan kişinin tarayıcısından veritabanına tek bir çağrı
 * gitmiyor ve hiçbir öğrenci verisi yüklenmiyor. Ekran görüntüleri
 * UYDURMA veriyle üretildi (`scripts/tanitim-gorselleri.mjs`) ve sayfada
 * bunu açıkça yazıyoruz.
 */
export function Tanitim() {
  return (
    <>
      <UstCubuk />
      <main id="icerik">
        <Acilis />
        <Sorun />
        <Ogrenciye />
        <Ogretmene />
        <Veliye />
        <EwaluBolumu />
        <Kim />
        <VeriNotu />
        <Kapanis />
      </main>
    </>
  );
}

/* ============================================================
   ORTAK PARÇALAR
   ============================================================ */

/**
 * Bölüm kabı. Genişlik 42rem: uzun metinde satır uzunluğu okunabilirliğin
 * en belirleyici ölçüsü ve 65–75 karakter aralığı bu genişlikte kalıyor.
 */
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
      <div className="mx-auto max-w-[42rem] px-5 py-14">
        <p className="sk-sayi text-[12px] font-bold tracking-[0.18em] text-amber">{no}</p>
        <h2 className="mt-1 text-[26px] text-ink">{baslik}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

/** Gövde paragrafı — tanıtım metninde 17px, uygulamadakinden bir tık iri. */
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[17px] leading-[1.6] text-ink">{children}</p>;
}

/** İkincil, daha sakin satır. */
function Kucuk({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14px] leading-[1.6] text-muted">{children}</p>;
}

/**
 * Ekran görüntüsü.
 *
 * `width`/`height` ÖZNİTELİK OLARAK veriliyor: tarayıcı görsel inmeden
 * önce yerini ayırsın, sayfa okunurken metin zıplamasın. Ölçüler
 * `tanitim-gorselleri.mjs`'in ürettiği dosyalarla birebir aynı; script
 * değişirse buradaki sayılar da değişmeli.
 *
 * `loading="lazy"`: üç görselin üçü de sayfanın aşağısında; açılışta
 * indirilmeleri için sebep yok.
 */
function Ekran({ dosya, alt }: { dosya: string; alt: string }) {
  return (
    <figure className="mt-6 flex justify-center">
      <img
        src={`/yeni/tanitim-ekranlar/${dosya}`}
        alt={alt}
        width={780}
        height={1520}
        loading="lazy"
        decoding="async"
        className="w-full max-w-[260px] rounded-sk-lg border border-line shadow-sk-md"
      />
    </figure>
  );
}

/* ============================================================
   ÜST ÇUBUK
   ============================================================ */

function UstCubuk() {
  return (
    <>
      {/* Klavyeyle gezen biri her seferinde üst çubuğu geçmek zorunda
          kalmasın. Odaklanınca görünür hâle geliyor. */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-sk-sm focus:border focus:border-line focus:bg-surface focus:px-4 focus:text-[15px] focus:font-bold focus:text-ink"
      >
        İçeriğe geç
      </a>

      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[42rem] items-center justify-between gap-3 px-5 py-2">
          <SekizWordmark bicim="sade" boyut="sm" />
          {/* Bu sayfaya yanlışlıkla düşen bir öğrenci ya da veli tek
              dokunuşla giriş kutusuna dönebilmeli. */}
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
   01 — AÇILIŞ: 8 → ∞
   ============================================================ */

function Acilis() {
  return (
    <section className="relative overflow-hidden">
      <SekizgenDoku />

      <div className="relative mx-auto max-w-[42rem] px-5 pb-14 pt-12 text-center">
        <h1 className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </h1>

        <p className="mx-auto mt-7 max-w-[30rem] text-[20px] leading-[1.45] text-ink">
          Ödev, teslim ve gelişim tek yerde.
        </p>

        {/* MARKA FİKRİ, SÜS DEĞİL: sekiz yan yatınca sonsuzluk işareti olur.
            Ürünün adı da bu okuldaki sekizinci sınıf düzeninden değil, bu
            fikirden geliyor. Cümleyi bir kez söyleyip bırakıyoruz. */}
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

/**
 * Açılışın arka planındaki sekizgen örgü.
 *
 * YALNIZ BURADA. Faz 0'da konan kural: tesselasyon landing açılışında ve
 * boş durumlarda kullanılabilir, uygulama ekranlarında kullanılamaz.
 * Opaklık 0.04 — dokunun varlığı hissedilsin ama metnin kontrastına
 * karışmasın diye ölçülü.
 *
 * Yol elle yazılmıyor, `sekizgenYolu()` ile hesaplanıyor (lib/geometri.ts).
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
   02 — SORUN
   ============================================================ */

function Sorun() {
  return (
    <Bolum no="02" baslik="Neden" zemin="yuzey">
      <P>
        Bir matematik öğretmeninin haftası şuna benziyor: ödevler bir grup mesajında,
        cevap anahtarı telefonun galerisinde, kimin ne gönderdiği bir deftere ya da
        akılda. Öğrenci ödevi kaçırdığını genellikle iş işten geçtikten sonra öğreniyor.
        Veli çocuğunun nerede zorlandığını çoğu zaman karne gününde öğreniyor.
      </P>
      <P>
        SEKİZ bu üçünü aynı yere koyuyor. Ödev bir yerde duruyor, teslim oradan
        yapılıyor, sonuç herkesin kendi ekranında görünüyor.
      </P>
    </Bolum>
  );
}

/* ============================================================
   03 — ÖĞRENCİ
   ============================================================ */

function Ogrenciye() {
  return (
    <Bolum no="03" baslik="Öğrenci ne yapıyor">
      <P>
        Koduyla giriyor. Ödevlerini görüyor, hangisinin süresi yaklaşmışsa o en üstte
        duruyor. Testte şıkları ekrandan işaretliyor, açık uçlu ödevde çözümünün
        fotoğrafını çekip gönderiyor.
      </P>

      {/* PUANLAMA CÜMLESİ DİKKATLE YAZILDI.
          "Anında puan" yalnız TEST ödevi için doğru: puanı sunucudaki
          deterministik bir fonksiyon hesaplıyor (`_puanla`). Açık uçlu
          ödevin puanını öğretmen veriyor ve bunu gizlemiyoruz.
          Hiçbir puanı yapay zekâ vermiyor; bu ürünün kalıcı kuralı. */}
      <P>
        Testlerde puanı gönderdiği anda çıkıyor — hesabı sunucu yapıyor, kural her
        öğrenci için aynı. Açık uçlu ödevlerde puanı öğretmen veriyor.{' '}
        <strong className="font-bold">Hiçbir ödevi yapay zekâ değerlendirmiyor.</strong>
      </P>
      <P>
        Teslim ettikten sonra doğrusunu görüyor, hangi soruda takıldığını görüyor ve
        dönem boyunca hangi konuda eksiği olduğunu kendi ekranından izleyebiliyor.
      </P>
      <Kucuk>
        Cevap anahtarı teslimden önce öğrencinin cihazına hiç gönderilmiyor — ekranda
        gizlenmiyor, gerçekten gönderilmiyor.
      </Kucuk>

      <Ekran
        dosya="ogrenci.webp"
        alt="Öğrencinin ödev listesi ekranı: bekleyen ve gönderilmiş ödevler, puanlar"
      />
    </Bolum>
  );
}

/* ============================================================
   04 — ÖĞRETMEN
   ============================================================ */

function Ogretmene() {
  return (
    <Bolum no="04" baslik="Öğretmen ne görüyor" zemin="yuzey">
      <P>
        Panosunda o gün bakması gereken dört sayı var: kaç öğrenci, kaç açık ödev, kaç
        gönderim puan bekliyor, kaç ödev eksik kalmış. Her birinin üstüne dokununca
        listesi açılıyor.
      </P>
      <P>
        Bir ödevin içinde <strong className="font-bold">kimin göndermediği</strong> de
        satır satır duruyor — sistem yalnız gönderenleri değil, sınıfın tamamını
        gösteriyor. Asıl aranan cevap çoğu zaman bu.
      </P>
      <P>
        Cevap anahtarını elle girmek zorunda değil: anahtarın PDF'ini yüklüyor, sistem
        okuduğunu <strong className="font-bold">öneri olarak</strong> gösteriyor,
        öğretmen onaylamadan hiçbir şey kaydedilmiyor. Sonradan bir anahtarı düzeltirse
        o ödevin gönderimleri yeniden puanlanıyor ve puanı değişen her öğrenci
        listeleniyor — not sessizce değişmiyor.
      </P>
      <P>
        Dönem ilerledikçe sınıfın hangi konuda zayıf olduğunu tek ekranda görüyor.
      </P>

      <Ekran
        dosya="ogretmen.webp"
        alt="Öğretmen panosu: öğrenci sayısı, açık ödev, puan bekleyen ve eksik ödev kutuları"
      />
    </Bolum>
  );
}

/* ============================================================
   05 — VELİ
   ============================================================ */

function Veliye() {
  return (
    <Bolum no="05" baslik="Veli ne görüyor">
      <P>
        Velinin kendi kodu var. Çocuğunun yaptığı ve yapmadığı ödevleri, aldığı puanları
        ve hangi konuda eksiği olduğunu görüyor. Öğretmene buradan yazabiliyor.
      </P>

      {/* İKİ SINIR DA GERÇEK VE İKİSİ DE SUNUCUDA. Bunları yazmak bir
          reklam cümlesi değil: veli tam da bunu sorar. */}
      <P>
        Veliye <strong className="font-bold">cevap anahtarı hiçbir koşulda</strong>{' '}
        gönderilmiyor. Gördüğü şey çocuğunun gidişatı; ödevin cevapları değil.
      </P>
      <P>
        Öğrencinin öğretmeniyle yazışması ile velinin öğretmenle yazışması{' '}
        <strong className="font-bold">iki ayrı yazışma</strong>. Veli çocuğunun
        yazdıklarını görmüyor, çocuk da velisinin yazdıklarını görmüyor. Bu ayrım
        ekranda değil veritabanında kurulu.
      </P>
      <Kucuk>
        Sınıf ortalaması, sıralama, başka bir öğrencinin tek bir verisi — hiçbiri veliye
        de öğrenciye de gönderilmiyor. Çocuk kendi gidişatını görüyor, kimseyle
        yarıştırılmıyor.
      </Kucuk>

      <Ekran
        dosya="veli.webp"
        alt="Velinin ödev listesi: gönderilen ödevler, alınan puan, yanlış yapılan soruların numaraları ve süresi yaklaşan ödev"
      />
    </Bolum>
  );
}

/* ============================================================
   06 — EWALU
   ============================================================ */

function EwaluBolumu() {
  return (
    <Bolum no="06" baslik="Ewalu" zemin="yuzey">
      <div className="flex items-start gap-4">
        <EwaluFigure poz="karsilama" boyut={72} dekoratif className="shrink-0" />
        <div>
          <P>
            Ewalu SEKİZ'in asistanı. Öğrenciyi karşılıyor, ödevi tamamladığında bir şey
            söylüyor, puanı düşük geldiğinde başka bir şey söylüyor.
          </P>
        </div>
      </div>

      {/* EWALU'NUN NE OLMADIĞINI DA YAZIYORUZ. Bir çizim karakterin
          "akıllı asistan" sanılması ürünün yapmadığı bir şeyi vaat etmek
          olurdu; "akıllı" sıfatı bu yüzden bir kez yazılıp çıkarıldı. */}
      <P>
        Söyledikleri öğretmenin yazdığı cümlelerdir; puan aralığına göre seçilirler.
        Ewalu ödev okumaz, puan vermez, karar vermez.
      </P>

      <div className="mt-6">
        <EwaluVideo />
      </div>
    </Bolum>
  );
}

/* ============================================================
   07 — KİM YAPTI
   ============================================================ */

function Kim() {
  return (
    <section>
      <div className="mx-auto max-w-[42rem] px-5 py-14 text-center">
        <p className="sk-sayi text-[12px] font-bold tracking-[0.18em] text-amber">07</p>

        {/* Mühür burada BÜYÜK: Faz 0'daki kural, okul mührü yalnız 96 px ve
            üstünde kullanılır — küçükte halka yazısı ve köprü çizgileri
            okunmuyor. `SchoolCrest` zaten 96'nın altını kabul etmiyor.
            `dekoratif` DEĞİL: burada okulun adı görünür metin olarak
            hemen altında yazmıyor, mührün kendisi kimliği taşıyor. */}
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
   VERİ VE GİZLİLİK
   ============================================================ */

/**
 * PLANDAKİ 8 BEYİTTE YOKTU, EKLENDİ.
 *
 * Gerekçe: bu sayfanın hedef okuyucusu müdür ve veli, ve öğrenci verisi
 * tutan bir sistem karşısında ikisinin de ilk sorusu bu oluyor. Cevabı
 * olmayan bir tanıtım sayfası o soruyu sormaya değil, güvenmemeye yol
 * açar. Kısa tutuldu ve numaralandırılmadı — anlatının bir beyti değil,
 * dipnotu.
 *
 * Buradaki her cümle doğrulanmış: bölge öğretmen tarafından panelden
 * teyit edildi (Zürih), sınırların hepsinin sunucu tarafı testi var.
 */
function VeriNotu() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[42rem] px-5 py-14">
        <h2 className="text-[22px] text-ink">Veriler nerede duruyor</h2>
        <Kucuk>
          Öğrencinin adı, sınıfı, ödev cevapları ve puanları bir veritabanında tutuluyor.
          Veritabanı Supabase üzerinde ve <strong className="font-bold">Zürih</strong>{' '}
          (İsviçre) bölgesinde çalışıyor.
        </Kucuk>
        <Kucuk>
          Giriş kodları öğretmen tarafından verilir; öğretmenin kendi girişi ayrı bir
          şifreyle korunur ve o şifre veritabanında düz metin olarak tutulmaz. Ödev
          dosyalarına ve öğrenci çözüm fotoğraflarına adresi bilen herkes değil, yalnız
          yetkisi olan kişi erişebilir — her erişim için kısa ömürlü ayrı bir bağlantı
          üretilir.
        </Kucuk>
        <Kucuk>
          Bu sayfa hiçbir çerez kullanmıyor, ziyaretçi takibi yapmıyor ve veritabanına
          hiçbir istek göndermiyor. Yukarıdaki ekran görüntülerindeki adlar ve puanlar{' '}
          <strong className="font-bold">uydurmadır</strong>; gerçek bir öğrenciye ait
          değildir.
        </Kucuk>
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

        {/* İkinci ve son 8 → ∞ dönüşümü. Faz 0 kuralı: bu hareket sayılı
            yerde kullanılır. Sayfada iki kez geçiyor — açılışta ve
            kapanışta; arası hareketsiz. Hareket azaltma tercihi açıksa
            işaret dönmüyor, doğrudan ∞ duruyor (Sekiz8Mark hallediyor). */}
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
