import { Sayfa } from '@/components/duzen/Sayfa'
import { Bolum, RenkKarti, OlcekSatiri } from '@/components/tasarim/Parcalar'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SelcukluYildizi } from '@/components/marka/SelcukluYildizi'
import { YoklamaSeridi } from '@/components/marka/YoklamaSeridi'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { Kart } from '@/components/ui/Kart'
import { Alan } from '@/components/ui/Alan'
import { Iskelet, KartIskeleti } from '@/components/ui/Iskelet'
import { BosDurum } from '@/components/ui/BosDurum'
import { HataDurumu } from '@/components/ui/HataDurumu'
import { ornekYoklama } from '@/lib/ornekVeri'

const aralikOlcegi = [
  ['1', '4px', 'ikon–metin arası'],
  ['2', '8px', 'satır arası, rozet iç boşluğu'],
  ['3', '12px', 'kart içi öğeler'],
  ['4', '16px', 'kart iç boşluğu, sayfa kenarı'],
  ['6', '24px', 'bölümler arası'],
  ['8', '32px', 'büyük bölüm arası'],
  ['12', '48px', 'sayfa üstü/altı boşluk'],
] as const

/**
 * FAZ 0 onay ekranı — tasarım token'larının tek yerde görülebildiği vitrin.
 * Bu sayfa üretimde kalır: yeni bir ekran yazılırken buradaki ölçeklerin
 * dışına çıkılmadığı buradan denetlenir.
 */
export function TasarimSistemi() {
  return (
    <Sayfa
      baslik="Tasarım sistemi"
      aciklama="SEKİZ'in görsel dili: renk, tipografi, aralık ve imza öğeleri. Her ekran bu ölçeklerden çıkar; buradaki değerlerin dışına çıkılmaz."
    >
      <div className="flex flex-col gap-8">
        <Bolum
          baslik="İmza hareketi — 8 → ∞"
          aciklama="Aynı çizim 90° dönünce sekiz sonsuza dönüşür. Uygulamanın tek süsleyici animasyonudur; bekleme anlarında görünür. Hareket azaltma tercihi açıksa durur."
        >
          <div className="flex flex-wrap items-center gap-8 rounded-lg border border-kenar bg-kagit-yuksek p-6 text-murekkep">
            <SekizSonsuz boyut="buyuk" />
            <SekizSonsuz boyut="orta" />
            <SekizSonsuz boyut="kucuk" />
            <div className="text-kursun-koyu">
              <SekizSonsuz boyut="orta" duragan etiket="Sekiz" />
            </div>
          </div>
        </Bolum>

        <Bolum
          baslik="İmza öğesi — sekizgen yoklama şeridi"
          aciklama="Sınıf panosunun tepesinde durur. Her öğrenci bir sekizgen hücredir; sınıfın nabzı tek bakışta okunur. Numara hücrenin içindedir — 200 öğrencide ad-soyad değil numara ayırt eder. Üç durum vardır: yaptı, yapmadı, süresi dolmadı."
        >
          <YoklamaSeridi baslik="9A · Türev — 1. Ödev" hucreler={ornekYoklama} />
        </Bolum>

        <Bolum
          baslik="Renk"
          aciklama="Lacivert kurumsal omurgadır, altın cimri kullanılır. Kontrast oranları kağıt zemin (#F7F5F0) üzerinedir; WCAG AA sınırı normal metinde 4,5:1'dir."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <RenkKarti
              ad="Mürekkep Laciverti"
              token="--color-murekkep"
              ornekSinif="bg-murekkep"
              kullanim="Başlık, üst bar, birincil düğme"
              kontrast="14,1:1"
            />
            <RenkKarti
              ad="Kağıt"
              token="--color-kagit"
              ornekSinif="bg-kagit"
              kullanim="Sayfa zemini"
            />
            <RenkKarti
              ad="Mühür Altını"
              token="--color-altin"
              ornekSinif="bg-altin"
              kullanim="Madalya, vurgu — dolgu olarak"
              kontrast="2,2:1 · metin değil"
            />
            <RenkKarti
              ad="Altın (metin)"
              token="--color-altin-koyu"
              ornekSinif="bg-altin-koyu"
              kullanim="Altın tonunda yazı"
              kontrast="4,6:1"
            />
            <RenkKarti
              ad="Onay Yeşili"
              token="--color-yesil"
              ornekSinif="bg-yesil"
              kullanim="Tamamlandı, doğru cevap"
              kontrast="4,7:1"
            />
            <RenkKarti
              ad="Kırmızı Kalem"
              token="--color-kirmizi"
              ornekSinif="bg-kirmizi"
              kullanim="Eksik ödev, yanlış cevap"
              kontrast="5,5:1"
            />
            <RenkKarti
              ad="Kurşun Kalem"
              token="--color-kursun"
              ornekSinif="bg-kursun"
              kullanim="Çizgi ve ikon — metin değil"
              kontrast="2,8:1 · metin değil"
            />
            <RenkKarti
              ad="Kurşun (metin)"
              token="--color-kursun-koyu"
              ornekSinif="bg-kursun-koyu"
              kullanim="İkincil metin"
              kontrast="5,1:1"
            />
            <RenkKarti
              ad="Kenarlık"
              token="--color-kenar"
              ornekSinif="bg-kenar"
              kullanim="Kart ve tablo kenarı"
            />
          </div>
        </Bolum>

        <Bolum
          baslik="Tipografi"
          aciklama="Başlıklarda Fraunces (karakterli serif), gövdede Inter. Rakamlar her yerde tabular — puan ve ortalama sütunları hizalı durur."
        >
          <div className="rounded-lg border border-kenar bg-kagit-yuksek p-4">
            <OlcekSatiri ad="ekran" deger="36 / 1.1" sinifAdi="text-ekran font-baslik" ornek="SEKİZ" />
            <OlcekSatiri ad="b1" deger="28 / 1.2" sinifAdi="text-b1 font-baslik" ornek="Sınıf panosu" />
            <OlcekSatiri ad="b2" deger="22 / 1.25" sinifAdi="text-b2 font-baslik" ornek="9A · Türev" />
            <OlcekSatiri ad="b3" deger="18 / 1.35" sinifAdi="text-b3 font-baslik" ornek="Bugün ne oldu?" />
            <OlcekSatiri ad="gövde" deger="16 / 1.6" sinifAdi="text-govde" ornek="Çözüm kağıdını yükle." />
            <OlcekSatiri ad="küçük" deger="14 / 1.5" sinifAdi="text-kucuk" ornek="Son teslim: 12 Eylül" />
            <OlcekSatiri
              ad="etiket"
              deger="12 / 1.4"
              sinifAdi="text-etiket text-kursun-koyu"
              ornek="ÖĞRENCİ NO"
            />
            <OlcekSatiri ad="rakam" deger="32 / 1.0" sinifAdi="text-rakam font-baslik" ornek="%86" />
          </div>
          <p className="mt-3 text-kucuk text-kursun-koyu olcu">
            Türkçe denetimi: ğ İ ı ş ç ö ü Ğ Ş Ç Ö Ü — her iki yazı tipinde de latin-ext alt kümesi
            yüklendiği için eksiksiz görünür.
          </p>
        </Bolum>

        <Bolum
          baslik="Aralık"
          aciklama="Taban birim 4px. Yalnız aşağıdaki basamaklar kullanılır; ara değer (20px, 28px) kullanılmaz — dikey ritim bundan doğar."
        >
          <div className="rounded-lg border border-kenar bg-kagit-yuksek p-4">
            {aralikOlcegi.map(([basamak, piksel, kullanim]) => (
              <div key={basamak} className="flex items-center gap-4 border-b border-kenar py-2 last:border-b-0">
                <span className="w-16 shrink-0 font-mono text-kucuk text-kursun-koyu">{piksel}</span>
                <span className="h-3 shrink-0 bg-murekkep-500" style={{ width: piksel }} />
                <span className="text-kucuk text-kursun-koyu">{kullanim}</span>
              </div>
            ))}
          </div>
        </Bolum>

        <Bolum
          baslik="Düğmeler ve etiketler"
          aciklama="Sözlük sabittir: yayınla (herkese açar), gönder (geri dönüşü yok), kaydet (taslak), onayla (öğretmen imzası). Her düğme en az 44px yüksekliğindedir."
        >
          <div className="flex flex-col gap-4 rounded-lg border border-kenar bg-kagit-yuksek p-4">
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
              <Rozet ton="olumlu">Yapıldı</Rozet>
              <Rozet ton="uyari">Bugün son gün</Rozet>
              <Rozet ton="olumsuz">Yapılmadı</Rozet>
              <Rozet ton="notr">Onay bekliyor</Rozet>
              <Rozet ton="altin">Özel ders</Rozet>
            </div>
            <div className="max-w-sm">
              <Alan
                etiket="Öğrenci numarası"
                placeholder="ör. 142"
                inputMode="numeric"
                ipucu="200 öğrencide numara birincil ayırt edicidir."
              />
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
            <Kart baslik="Dolu">
              <p className="text-govde">
                9A · 28 öğrenci · not ortalaması <span className="font-semibold">78,4</span>
              </p>
            </Kart>
            <KartIskeleti />
          </div>
          <div className="mt-4 rounded-lg border border-kenar bg-kagit-yuksek">
            <BosDurum
              baslik="Henüz sınıf oluşturmadınız"
              aciklama="İlk sınıfınızı oluşturun; ödevler, öğrenciler ve panolar bunun üzerine kurulur."
              eylem={<Buton vurgu="birincil">Sınıf oluştur</Buton>}
            />
          </div>
        </Bolum>

        <Bolum
          baslik="Geometri"
          aciklama="Selçuklu yıldızı: iki karenin 45° döndürülmesiyle doğar. Boş ekranlarda ve rozetlerde yapı öğesidir, süs değil."
        >
          <div className="flex flex-wrap items-center gap-8 rounded-lg border border-kenar bg-kagit-yuksek p-6 text-kenar-koyu">
            <SelcukluYildizi boyut={120} />
            <SelcukluYildizi boyut={72} ekSinif="text-murekkep-500" />
            <SelcukluYildizi boyut={44} ekSinif="text-altin" />
          </div>
        </Bolum>
      </div>
    </Sayfa>
  )
}
