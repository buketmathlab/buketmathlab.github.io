import { Link } from 'react-router-dom'
import { Sayfa } from '@/components/duzen/Sayfa'
import { Bolum, RenkKarti, OlcekSatiri } from '@/components/tasarim/Parcalar'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SekizFigur } from '@/components/marka/SekizFigur'
import { OkulAdi } from '@/components/marka/OkulAdi'
import { SekizOrgu } from '@/components/marka/SekizOrgu'
import { Marka } from '@/components/marka/Marka'
import { Muhur } from '@/components/marka/Muhur'
import { YoklamaSeridi } from '@/components/marka/YoklamaSeridi'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { Kart } from '@/components/ui/Kart'
import { Alan } from '@/components/ui/Alan'
import { Iskelet, KartIskeleti } from '@/components/ui/Iskelet'
import { BosDurum } from '@/components/ui/BosDurum'
import { HataDurumu } from '@/components/ui/HataDurumu'
import { OlayKarti } from '@/components/tasarim/OlayKarti'
import { OranSeridi } from '@/components/ornek/OranSeridi'
import { ornekYoklama } from '@/lib/ornekVeri'

const aralikOlcegi = ['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px'] as const
const aralikKullanimi = [
  'ikon–metin arası',
  'satır arası, rozet iç boşluğu',
  'kart içi öğeler',
  'kart iç boşluğu, sayfa kenarı',
  'bölümler arası',
  'başlık ile içerik arası',
  'büyük bölüm arası',
  'tanıtım bölümleri arası',
] as const

const ornekEkranlar = [
  ['/ornek/ogretmen', 'Öğretmen — Bugün', 'Bugün ilgilenmem gereken ne var?'],
  ['/ornek/sinif', 'Sınıf panosu — 9A', 'Sınıf ne durumda?'],
  ['/ornek/ogrenci', 'Öğrenci — Bugün', 'Bugün ne yapmalıyım?'],
  ['/ornek/veli', 'Veli — Özet', 'Çocuğum nerede duruyor?'],
] as const

/**
 * TASARIM SİSTEMİ — SEKİZ
 * Sistemin tek yerde görülebildiği vitrin. Yeni ekran yazılırken buradaki
 * ölçeklerin dışına çıkılmadığı buradan denetlenir.
 */
export function TasarimSistemi() {
  return (
    <Sayfa
      ustEtiket="SANAT YÖNETİMİ"
      baslik="Tasarım sistemi"
      aciklama="Kireç ve Nar: ferah bir zemin, üzerinde az ama cesur renk. Enerji büyük renk bloklarından değil, doğru noktadaki tek vurgudan gelir."
    >
      <div className="flex flex-col gap-12">
        <Bolum
          baslik="Örnek ekranlar"
          aciklama="Sistem soyut değil: aynı token'larla çizilmiş dört gerçek ekran. Telefonda açın — alt gezinme öğrenci ve veli ekranlarında görünür."
        >
          <ul className="grid gap-px overflow-hidden rounded-lg border border-kenar bg-kenar sm:grid-cols-2" role="list">
            {ornekEkranlar.map(([yol, ad, soru]) => (
              <li key={yol} className="bg-yuzey">
                <Link to={yol} className="block p-6 transition-colors hover:bg-yuzey-yuksek">
                  <p className="text-b3 font-semibold">{ad}</p>
                  <p className="mt-1 text-kucuk text-metin-ikincil">{soru}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Bolum>

        <Bolum
          baslik="8 → ∞"
          aciklama="İki halka üst üste sekizi kurar; 90° döndüğünde yan yana gelip sonsuz olur. Şekil değişmez, bakış açısı değişir. Sembol SÜREKLİ DÖNMEZ: anlamlı bir anda bir kez döner ve sonsuz olarak durur."
        >
          <div className="flex flex-wrap items-center gap-12 rounded-lg border border-kenar bg-yuzey p-8 shadow-kart">
            <figure className="text-center text-marka">
              <SekizSonsuz boyut="buyuk" hal="sekiz" />
              <figcaption className="mt-3 text-etiket text-metin-ikincil">DURAN 8</figcaption>
            </figure>
            <figure className="text-center text-vurgu">
              <SekizSonsuz boyut="buyuk" hal="donus" />
              <figcaption className="mt-3 text-etiket text-metin-ikincil">TEK SEFERLİK DÖNÜŞ</figcaption>
            </figure>
            <figure className="text-center text-marka">
              <SekizSonsuz boyut="buyuk" hal="sonsuz" />
              <figcaption className="mt-3 text-etiket text-metin-ikincil">DURAN ∞</figcaption>
            </figure>
            <figure className="text-center text-vurgu">
              <SekizSonsuz boyut="buyuk" hal="sonsuz" bekliyor />
              <figcaption className="mt-3 text-etiket text-metin-ikincil">BEKLERKEN NEFES</figcaption>
            </figure>
            <Marka olcek="orta" ekSinif="ml-auto" />
          </div>
        </Bolum>

        <Bolum
          baslik="8 → öğrenci"
          aciklama="Sembolün üçüncü hâli. 8 yana yattığında sonsuz oluyordu; ayakta durduğunda öğrenciye dönüşüyor. İskelet birebir sekizdir: baş (36,24 r15) ve gövde (36,56 r17) tam teğet iki halka — hiçbiri bozulmuyor, yalnız çevresine çizgi ekleniyor. Figür küçüldükçe ayrıntı eleniyor: 64px altında gözlük sapları, 40px altında gözlük düşüyor. Karikatür yüz, gülümseme ve giysi yok."
        >
          <div className="flex flex-wrap items-end gap-12 rounded-lg border border-kenar bg-yuzey p-8 shadow-kart">
            <figure className="text-center text-vurgu">
              <SekizFigur boyut={104} />
              <figcaption className="mt-4 text-etiket text-metin-ikincil">FİGÜR</figcaption>
            </figure>
            <figure className="text-center text-marka">
              <SekizFigur boyut={56} />
              <figcaption className="mt-4 text-etiket text-metin-ikincil">56PX · SAPSIZ</figcaption>
            </figure>
            <figure className="text-center text-marka">
              <SekizFigur boyut={32} />
              <figcaption className="mt-4 text-etiket text-metin-ikincil">32PX · GÖZLÜKSÜZ</figcaption>
            </figure>
            <figure className="text-center text-marka">
              <SekizFigur boyut={96} rozetli />
              <figcaption className="mt-4 text-etiket text-metin-ikincil">SİMGE TASLAĞI</figcaption>
            </figure>
            <figure className="text-center text-marka">
              <SekizSonsuz boyut="buyuk" hal="sekiz" />
              <figcaption className="mt-4 text-etiket text-metin-ikincil">İSKELET: 8</figcaption>
            </figure>
          </div>
        </Bolum>

        <Bolum
          baslik="Kurum kimliği"
          aciklama="Mühür değiştirilmez ve ekranı o açar. Okul adı her zaman iki satır: ilçe üstte sessiz ve harf aralığı açık, okul adı altta ağırlıkla. İkisi tek bir kurumsal blok gibi okunur."
        >
          <div className="flex flex-wrap items-center gap-10 rounded-lg border border-kenar bg-yuzey p-8 shadow-kart">
            <Muhur boyut={112} />
            <OkulAdi olcek="buyuk" />
          </div>
        </Bolum>

        <Bolum
          baslik="Renk"
          aciklama="Oran: %65–75 nötr, %15–20 kurumsal lacivert, %5–10 vurgu. Nar yalnız olay anlarında görünür — etkin gezinme, ilerleme dolgusu, açıklanan puan, odaklanılan alan. Düğmelere ve zeminlere girmez; bu yüzden değerini korur. Ayırt edici kural: anlam renkleri sakin, marka renkleri canlı."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <RenkKarti ad="Kireç" token="--color-kirec" ornekSinif="bg-kirec" kullanim="Sayfa zemini. Sıcak beyaz, saf beyaz değil." />
            <RenkKarti ad="Tebeşir" token="--color-tebesir" ornekSinif="bg-tebesir" kullanim="Kart yüzeyi." />
            <RenkKarti ad="Kil" token="--color-kil" ornekSinif="bg-kil" kullanim="İkincil yüzey, tablo şeridi." />
            <RenkKarti ad="Çizgi" token="--color-cizgi" ornekSinif="bg-cizgi" kullanim="Kenarlık, ayraç." />
            <RenkKarti ad="Mürekkep" token="--color-murekkep" ornekSinif="bg-murekkep" kullanim="Ana metin." kontrast="16,5:1" />
            <RenkKarti ad="Kurşun" token="--color-kursun" ornekSinif="bg-kursun" kullanim="İkincil metin." kontrast="4,7:1" />
            <RenkKarti ad="Gece Laciverti" token="--color-lacivert" ornekSinif="bg-lacivert" kullanim="Logodan. Wordmark, birincil düğme, tek koyu bölüm. Zemin olmaz." kontrast="15,5:1" />
            <RenkKarti ad="Duman Lacivert" token="--color-lacivert-duman" ornekSinif="bg-lacivert-duman" kullanim="Bağlantı, ikincil yapı." kontrast="8,9:1" />
            <RenkKarti ad="Nar" token="--color-nar" ornekSinif="bg-nar" kullanim="Canlı vurgu. Metin olarak da kullanılabilir." kontrast="4,7:1" />
            <RenkKarti ad="Bal" token="--color-bal" ornekSinif="bg-bal" kullanim="Uyarı ve ödül metni. Tint zemin üstünde kullanılır, dolgu olarak değil." kontrast="5,3:1" />
            <RenkKarti ad="Yaprak" token="--color-yaprak" ornekSinif="bg-yaprak" kullanim="Doğru, tamamlandı. Anlam taşır." kontrast="5,1:1" />
            <RenkKarti ad="Kiremit" token="--color-kiremit" ornekSinif="bg-kiremit" kullanim="Yanlış, eksik. Anlam taşır." kontrast="5,8:1" />
          </div>
          <p className="mt-6 olcu text-kucuk text-metin-ikincil">
            Selçuklu mirası renkte değil geometride yaşar. Çini turkuazı, kobalt ve firuze
            bilinçli olarak kullanılmaz; sekizgen, simetri ve ızgara oranı kullanılır.
          </p>
        </Bolum>

        <Bolum
          baslik="Tipografi"
          aciklama="İki aile, iki görev. Instrument Serif yalnız büyük puntoda: markanın sesi odur, iş gücü değil. Archivo yapıyı, arayüzü ve veriyi taşır; başlık hiyerarşisi boyutla değil ağırlıkla kurulur, rakamlar her yerde tabular."
        >
          <div className="rounded-lg border border-kenar bg-yuzey px-4 shadow-kart">
            <OlcekSatiri ad="afiş" deger="64 / serif" sinifAdi="font-marka text-afis leading-none" ornek="SEKİZ" />
            <OlcekSatiri ad="ekran" deger="40 / serif" sinifAdi="font-marka text-ekran leading-none" ornek="Öğrenci" />
            <OlcekSatiri ad="b1" deger="28 / 600" sinifAdi="text-b1 font-semibold" ornek="Sınıf panosu" />
            <OlcekSatiri ad="b2" deger="20 / 500" sinifAdi="text-b2" ornek="Bugün ne yapmam gerekiyor?" />
            <OlcekSatiri ad="b3" deger="16 / 600" sinifAdi="text-b3 font-semibold" ornek="9A · Türev" />
            <OlcekSatiri ad="gövde" deger="16 / 1.6" sinifAdi="text-govde" ornek="Çözüm kağıdının fotoğrafını ekle." />
            <OlcekSatiri ad="küçük" deger="14 / 1.5" sinifAdi="text-kucuk text-metin-ikincil" ornek="Son teslim 12 Eylül, 23.59" />
            <OlcekSatiri ad="etiket" deger="11 / 0.14em" sinifAdi="text-etiket text-metin-ikincil" ornek="ÖĞRENCİ NO" />
            <OlcekSatiri ad="rakam" deger="48 / tabular" sinifAdi="font-marka text-rakam text-vurgu" ornek="86" />
          </div>
          <p className="mt-4 olcu text-kucuk text-metin-ikincil">
            Türkçe denetimi: ğ Ğ ş Ş ı İ ö Ö ü Ü ç Ç — iki ailede de latin-ext alt kümesi yüklü.
            Wordmark'taki noktalı İ bilinçli korunur.
          </p>
        </Bolum>

        <Bolum
          baslik="Aralık, biçim, gölge"
          aciklama="Taban birim 4px; ara değer kullanılmaz. Yarıçaplar ölçülü (aşırı yuvarlatma yok). Gölge tek katmandır; derinlik kenarlık ve yüzey farkıyla anlatılır."
        >
          <div className="rounded-lg border border-kenar bg-yuzey px-4 shadow-kart">
            {aralikOlcegi.map((piksel, i) => (
              <div key={piksel} className="flex items-center gap-4 border-b border-kenar py-3 last:border-b-0">
                <span className="w-14 shrink-0 font-mono text-kucuk text-metin-ikincil">{piksel}</span>
                <span className="h-2 shrink-0 bg-vurgu" style={{ width: piksel }} />
                <span className="text-kucuk text-metin-ikincil">{aralikKullanimi[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            {(['xs', 'sm', 'md', 'lg'] as const).map((r, i) => (
              <div key={r} className="text-center">
                <div className={`size-16 border border-kenar bg-yuzey shadow-kart rounded-${r}`} />
                <p className="mt-2 text-etiket text-metin-ikincil">{[2, 4, 8, 12][i]}PX</p>
              </div>
            ))}
          </div>
        </Bolum>

        <Bolum
          baslik="Düğme, girdi, kart"
          aciklama="Sözlük sabittir: yayınla (herkese açar), gönder (geri dönüşü yok), kaydet (taslak), onayla (öğretmen imzası). Birincil düğme lacivert — sık tekrarlanan bir eyleme canlı renk verilmez."
        >
          <div className="flex flex-col gap-8 rounded-lg border border-kenar bg-yuzey p-4 shadow-kart">
            <div className="flex flex-wrap gap-3">
              <Buton vurgu="birincil">Ödevi yayınla</Buton>
              <Buton vurgu="ikincil">Taslak kaydet</Buton>
              <Buton vurgu="sessiz">Vazgeç</Buton>
              <Buton vurgu="yikici">Öğrenciyi sil</Buton>
              <Buton vurgu="birincil" bekliyor>Yayınlanıyor</Buton>
            </div>
            <div className="flex flex-wrap gap-2">
              <Rozet ton="olumlu">YAPILDI</Rozet>
              <Rozet ton="olumsuz">YAPILMADI</Rozet>
              <Rozet ton="uyari">BUGÜN SON GÜN</Rozet>
              <Rozet ton="notr">ONAY BEKLİYOR</Rozet>
              <Rozet ton="vurgu">YENİ</Rozet>
              <Rozet ton="odul">4 ÖDEVLİK SERİ</Rozet>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan etiket="Öğrenci numarası" placeholder="ör. 142" inputMode="numeric" ipucu="200 öğrencide numara birincil ayırt edicidir." />
              <Alan etiket="Giriş kodu" placeholder="ör. K7M2-P4RT" hata="Bu kod bulunamadı. Kartındaki kodu kontrol et." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Kart baslik="Kart" aciklama="Birbirinden bağımsız bilgi kümelerini ayırır.">
                <OranSeridi ad="9A" altMetin="24 öğrenci" oran={0.79} />
              </Kart>
              <Kart baslik="Her şey kart olmaz">
                <p className="text-kucuk text-metin-ikincil">
                  Bazı bölümler kenardan kenara, tipografiyle kurulur. Kart yığını
                  ferahlığı bitirir.
                </p>
              </Kart>
            </div>
          </div>
        </Bolum>

        <Bolum
          baslik="Gezinme"
          aciklama="Masaüstünde üst barda yatay, mobilde altta. Etkin öğe ikonla değil markanın geometrisiyle işaretlenir: sekizgen hücre dolar. Jenerik ikon kütüphanesi kullanılmaz — ürünü her uygulamaya benzetirdi."
        >
          <div className="rounded-lg border border-kenar bg-yuzey p-6 shadow-kart">
            <p className="text-kucuk text-metin-ikincil">
              Gezinme modeli role göre kurulur (<span className="font-mono">src/lib/gezinme.ts</span>).
              Okul öğrencisinin ve velisinin listesinde <strong className="text-metin">ödeme ve
              online ders öğesi hiç yoktur</strong> — gizlenmez, listeye girmez.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" role="list">
              {['·', 'Ö', '∞', 'M'].map((isaret, i) => (
                <li key={isaret} className="flex flex-col items-center gap-1">
                  <span
                    className={`sekizgen flex size-10 items-center justify-center text-kucuk font-semibold ${
                      i === 0 ? 'bg-vurgu text-tebesir' : 'bg-yuzey-yuksek text-metin-ikincil'
                    }`}
                  >
                    {isaret}
                  </span>
                  <span className="text-etiket text-metin-ikincil">
                    {['BUGÜN', 'ÖDEV', 'GELİŞİM', 'MESAJ'][i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Bolum>

        <Bolum
          baslik="Olay anı"
          aciklama="Enerji her yere yayılmaz, tek anda toplanır: puanın açıklandığı saniye. Olay geçtikten sonra aynı bilgi sakin hâline döner."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <OlayKarti />
            <Kart baslik="Sıradan hâl" aciklama="Aynı bilgi, olay geçtikten sonra. Canlı renk çekilir, sayı sakinleşir.">
              <p className="font-marka text-rakam">78</p>
              <p className="mt-2 text-kucuk text-metin-ikincil">Limit · 2. ödev · 14 Ekim</p>
            </Kart>
          </div>
        </Bolum>

        <Bolum
          baslik="Sekizgen geometri"
          aciklama="İmza, tema değil. Yoklama hücresi, rozet, gezinme işareti ve boş ekran — dekoratif büyük şekil olarak kullanılmaz. Renk tek başına konuşmaz: doluluk ve simge de durumu söyler."
        >
          <YoklamaSeridi baslik="9A · Türev — 2. Ödev" hucreler={ornekYoklama} />
          <div className="relative mt-6 h-40 overflow-hidden rounded-lg border border-kenar bg-yuzey text-marka">
            <SekizOrgu ton="okunur" />
          </div>
        </Bolum>

        <Bolum
          baslik="Dört hâl"
          aciklama="Her ekran dört durumda da tasarlanır: yükleniyor · boş · hata · dolu. Yüklemede dönen çark değil iskelet kullanılır."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Kart baslik="Yükleniyor">
              <Iskelet satir={3} />
            </Kart>
            <Kart baslik="Hata">
              <HataDurumu mesaj="Sınıf listesi alınamadı. İnternet bağlantınızı kontrol edin, sonra tekrar deneyin." />
            </Kart>
            <KartIskeleti />
            <Kart baslik="Dolu">
              <p className="text-govde">
                9A · 24 öğrenci · ortalama <span className="font-semibold">78,4</span>
              </p>
            </Kart>
          </div>
          <div className="mt-4 rounded-lg border border-kenar bg-yuzey shadow-kart">
            <BosDurum
              baslik="Henüz sınıf oluşturmadınız"
              aciklama="İlk sınıfınızı oluşturun; ödevler, öğrenciler ve panolar bunun üzerine kurulur."
              eylem={<Buton vurgu="birincil">Sınıf oluştur</Buton>}
            />
          </div>
        </Bolum>

        <Bolum
          baslik="Logo kullanımı"
          aciklama="Okul mührü değiştirilmez, yeniden çizilmez, rengi bozulmaz. Etrafında en az kendi genişliğinin dörtte biri kadar boşluk bırakılır. Her ekrana tekrarlanmaz."
        >
          <div className="flex flex-wrap items-center gap-8 rounded-lg border border-kenar bg-yuzey p-8 shadow-kart">
            <Muhur boyut={112} />
            <Muhur boyut={72} />
            <Muhur boyut={40} />
            <ul className="olcu text-kucuk text-metin-ikincil" role="list">
              <li>Tanıtım açılışı ve kürsü bölümü</li>
              <li>Giriş ekranı</li>
              <li>Alt bilgi</li>
              <li>Yazdırılan dönem raporu ve öğrenci kod kartı</li>
            </ul>
          </div>
        </Bolum>
      </div>
    </Sayfa>
  )
}
