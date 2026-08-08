import { Sayfa } from '@/components/duzen/Sayfa'
import { Bolum, RenkKarti, OlcekSatiri } from '@/components/tasarim/Parcalar'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SekizOrgu } from '@/components/marka/SekizOrgu'
import { Marka } from '@/components/marka/Marka'
import { YoklamaSeridi } from '@/components/marka/YoklamaSeridi'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { Kart } from '@/components/ui/Kart'
import { Alan } from '@/components/ui/Alan'
import { Iskelet, KartIskeleti } from '@/components/ui/Iskelet'
import { BosDurum } from '@/components/ui/BosDurum'
import { HataDurumu } from '@/components/ui/HataDurumu'
import { OlayKarti } from '@/components/tasarim/OlayKarti'
import { ornekYoklama } from '@/lib/ornekVeri'

const aralikOlcegi = [
  ['4px', 'ikon–metin arası'],
  ['8px', 'satır arası, rozet iç boşluğu'],
  ['12px', 'kart içi öğeler'],
  ['16px', 'kart iç boşluğu, sayfa kenarı'],
  ['24px', 'bölümler arası'],
  ['32px', 'başlık ile içerik arası'],
  ['48px', 'büyük bölüm arası'],
  ['96px', 'tanıtım bölümleri arası'],
] as const

/**
 * SANAT YÖNETİMİ — SEKİZ
 * Sistemin tek yerde görülebildiği vitrin. Yeni ekran yazılırken buradaki
 * ölçeklerin dışına çıkılmadığı buradan denetlenir.
 */
export function TasarimSistemi() {
  return (
    <Sayfa
      baslik="Sanat yönetimi"
      aciklama="SEKİZ'in görsel dili: 8'in geometrisi, renk, tipografi, aralık ve olay anları. Her ekran bu sistemden çıkar."
    >
      <div className="flex flex-col gap-10">
        <Bolum
          baslik="8 → ∞"
          aciklama="İki halka üst üste sekizi kurar; 90° döndüğünde yan yana gelip sonsuz olur. Şekil değişmez, bakış açısı değişir. Uygulamanın tek süsleyici hareketi budur ve yalnız bekleme anlarında görünür."
        >
          <div className="flex flex-wrap items-center gap-12 rounded-lg border border-kenar bg-yuzey p-8 text-vurgu">
            <SekizSonsuz boyut="buyuk" />
            <SekizSonsuz boyut="orta" />
            <SekizSonsuz boyut="kucuk" />
            <div className="text-kenar">
              <SekizSonsuz boyut="buyuk" duragan />
            </div>
            <Marka olcek="orta" ekSinif="ml-auto" />
          </div>
        </Bolum>

        <Bolum
          baslik="Doku"
          aciklama="Sekizin halkaları bir ızgaraya yayıldığında sekizgen boşluklar doğar: tezyinat ile koordinat sistemi aynı çizimde buluşur. Her zaman metnin arkasında ve düşük opaklıkta durur — kullanıcı 8 görmez, geometriyi hisseder."
        >
          <div className="relative h-48 overflow-hidden rounded-lg border border-kenar bg-yuzey text-petrol-acik">
            <SekizOrgu ton="okunur" />
          </div>
        </Bolum>

        <Bolum
          baslik="Renk"
          aciklama="Oran: %60 nötr, %30 kurumsal petrol, %10 canlı camgöbeği. Camgöbeği yalnız olay anlarında görünür — ilerleme dolgusu, etkin sekme, açıklanan puan, odaklanılan alan. Düğmelere ve zeminlere girmez; bu yüzden değerini korur."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <RenkKarti ad="Gece" token="--color-gece" ornekSinif="bg-gece" kullanim="Zemin. OLED ekranda gerçek siyaha yakın." />
            <RenkKarti ad="Grafit" token="--color-grafit" ornekSinif="bg-grafit" kullanim="Kart ve panel yüzeyi." />
            <RenkKarti ad="Duman" token="--color-duman" ornekSinif="bg-duman" kullanim="Yükseltilmiş yüzey, tablo şeridi." />
            <RenkKarti ad="Mineral" token="--color-mineral" ornekSinif="bg-mineral" kullanim="İkincil metin." kontrast="Gece üstünde 6,4:1" />
            <RenkKarti ad="Fildişi" token="--color-fildisi" ornekSinif="bg-fildisi" kullanim="Ana metin ve birincil düğme. Saf beyaz değil, sıcak." kontrast="Gece üstünde 16,8:1" />
            <RenkKarti ad="Derin Petrol" token="--color-petrol" ornekSinif="bg-petrol" kullanim="Kurumsal omurga. Geniş bloklar, doku." />
            <RenkKarti ad="Elektrik Camgöbeği" token="--color-camgobegi" ornekSinif="bg-camgobegi" kullanim="Tek canlı renk. Yalnız olay anlarında." kontrast="Gece üstünde 11,8:1" />
            <RenkKarti ad="Yeşim" token="--color-yesim" ornekSinif="bg-yesim" kullanim="Doğru, tamamlandı. Anlam taşır, süs değildir." kontrast="Gece üstünde 8,0:1" />
            <RenkKarti ad="Kızıl" token="--color-kizil" ornekSinif="bg-kizil" kullanim="Yanlış, eksik. Anlam taşır, süs değildir." kontrast="Gece üstünde 6,3:1" />
          </div>
        </Bolum>

        <Bolum
          baslik="Tipografi"
          aciklama="İki aile, iki görev. Instrument Serif yalnız büyük puntoda: markanın sesi odur, iş gücü değil. Archivo yapıyı, arayüzü ve veriyi taşır; rakamlar her yerde tabular, sütunlar hizalı."
        >
          <div className="rounded-lg border border-kenar bg-yuzey px-4">
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
            Türkçe denetimi: ğ İ ı ş ç ö ü Ğ Ş Ç Ö Ü — iki ailede de latin-ext alt kümesi yüklü.
            Wordmark'taki noktalı İ bilinçli korunur: markanın Türkçe olduğunu ilk bakışta söyler.
          </p>
        </Bolum>

        <Bolum
          baslik="Olay anı"
          aciklama="Enerji her yere yayılmaz, tek anda patlar: puanın açıklandığı saniye. Camgöbeği burada ışır — ekranın hafızada kalan yeri burasıdır."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <OlayKarti />
            <Kart baslik="Sıradan hâl" aciklama="Aynı bilgi, olay geçtikten sonra. Canlı renk çekilir, sayı sakinleşir.">
              <p className="font-marka text-rakam text-metin">78</p>
              <p className="mt-2 text-kucuk text-metin-ikincil">Limit · 2. ödev · 14 Ekim</p>
            </Kart>
          </div>
        </Bolum>

        <Bolum
          baslik="Sekizgen yoklama şeridi"
          aciklama="Sınıf panosunun imza öğesi. Her öğrenci bir sekizgen hücre; sınıfın nabzı tek bakışta okunur. Renk tek başına konuşmaz: doluluk ve simge de durumu söyler."
        >
          <YoklamaSeridi baslik="9A · Türev — 1. Ödev" hucreler={ornekYoklama} />
        </Bolum>

        <Bolum
          baslik="Aralık"
          aciklama="Taban birim 4px. Ara değer kullanılmaz; dikey ritim bu kısıttan doğar."
        >
          <div className="rounded-lg border border-kenar bg-yuzey px-4">
            {aralikOlcegi.map(([piksel, kullanim]) => (
              <div key={piksel} className="flex items-center gap-4 border-b border-kenar py-3 last:border-b-0">
                <span className="w-14 shrink-0 font-mono text-kucuk text-metin-ikincil">{piksel}</span>
                <span className="h-2 shrink-0 bg-vurgu" style={{ width: piksel }} />
                <span className="text-kucuk text-metin-ikincil">{kullanim}</span>
              </div>
            ))}
          </div>
        </Bolum>

        <Bolum
          baslik="Parçalar"
          aciklama="Sözlük sabittir: yayınla (herkese açar), gönder (geri dönüşü yok), kaydet (taslak), onayla (öğretmen imzası). Ana düğme camgöbeği değildir — sık tekrarlanan bir eyleme canlı renk verilmez."
        >
          <div className="flex flex-col gap-6 rounded-lg border border-kenar bg-yuzey p-4">
            <div className="flex flex-wrap gap-3">
              <Buton vurgu="birincil">Ödevi yayınla</Buton>
              <Buton vurgu="ikincil">Taslak kaydet</Buton>
              <Buton vurgu="sessiz">Vazgeç</Buton>
              <Buton vurgu="yikici">Öğrenciyi sil</Buton>
              <Buton vurgu="birincil" bekliyor>
                Yayınlanıyor
              </Buton>
            </div>
            <div className="flex flex-wrap gap-2">
              <Rozet ton="olumlu">YAPILDI</Rozet>
              <Rozet ton="olumsuz">YAPILMADI</Rozet>
              <Rozet ton="notr">ONAY BEKLİYOR</Rozet>
              <Rozet ton="vurgu">4 ÖDEVLİK SERİ</Rozet>
            </div>
            <div className="max-w-sm">
              <Alan etiket="Öğrenci numarası" placeholder="ör. 142" inputMode="numeric" ipucu="200 öğrencide numara birincil ayırt edicidir." />
            </div>
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
                9A · 28 öğrenci · ortalama <span className="font-semibold">78,4</span>
              </p>
            </Kart>
          </div>
          <div className="mt-4 rounded-lg border border-kenar bg-yuzey">
            <BosDurum
              baslik="Henüz sınıf oluşturmadınız"
              aciklama="İlk sınıfınızı oluşturun; ödevler, öğrenciler ve panolar bunun üzerine kurulur."
              eylem={<Buton vurgu="birincil">Sınıf oluştur</Buton>}
            />
          </div>
        </Bolum>
      </div>
    </Sayfa>
  )
}
