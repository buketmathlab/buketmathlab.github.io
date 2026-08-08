import { Sayfa } from '@/components/duzen/Sayfa'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { gezinme } from '@/lib/gezinme'
import { velininOzeti } from '@/lib/ornekVeri'
import { sayi } from '@/lib/bicim'

/**
 * VELİ — ÖZET
 *
 * Tasarım kararı: Bu ekran öğretmen panosunun küçültülmüş hâli DEĞİLDİR.
 * Veli sayı okumak istemez, cümle okumak ister. Bu yüzden ekranın tepesinde
 * tek bir cümle var; grafik, oran, analitik yok. Gözün gideceği ilk yer o cümle.
 *
 * Ton "çocuğunuzu izliyorsunuz" değil "sürece dahilsiniz": eksikler suçlayıcı
 * değil bilgilendirici yazılır, öğretmenin sözü doğrudan aktarılır.
 *
 * Bu öğrenci okul öğrencisi olduğu için gezinmede ödeme öğesi HİÇ YOK.
 */
export function VeliOzet() {
  const { ogrenci, haftaCumlesi, sonGonderim, bekleyen, calisilacakKonu, ogretmenMesaji } =
    velininOzeti

  return (
    <Sayfa
      ustEtiket="VELİ"
      baslik={`${ogrenci}'nın durumu`}
      ogeler={gezinme('veli', 'okul')}
      aktif="ozet"
    >
      <div className="flex flex-col gap-12">
        <p className="olcu font-marka text-ekran leading-tight">{haftaCumlesi}</p>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-kenar bg-yuzey p-4 shadow-kart">
            <p className="text-etiket text-metin-ikincil">SON GÖNDERİM</p>
            <p className="mt-3 text-b3 font-semibold">{sonGonderim.odev}</p>
            <p className="mt-1 text-kucuk text-metin-ikincil">
              {sonGonderim.ne} gönderildi · puan {sayi(sonGonderim.puan)}
            </p>
            <Rozet ton="olumlu" ekSinif="mt-4">
              YAPILDI
            </Rozet>
          </div>

          <div className="rounded-lg border border-kenar bg-yuzey p-4 shadow-kart">
            <p className="text-etiket text-metin-ikincil">BEKLEYEN ÖDEV</p>
            <p className="mt-3 text-b3 font-semibold">{bekleyen.odev}</p>
            <p className="mt-1 text-kucuk text-metin-ikincil">Son teslim {bekleyen.ne}</p>
            <Rozet ton="uyari" ekSinif="mt-4">
              HENÜZ GÖNDERİLMEDİ
            </Rozet>
          </div>
        </section>

        <section>
          <h2 className="text-b2">Çalışılması iyi olur</h2>
          <p className="mt-3 olcu text-govde text-metin-ikincil">
            {ogrenci} son ödevlerde <strong className="text-metin">{calisilacakKonu}</strong>{' '}
            konusunda diğerlerine göre daha çok zorlandı. Bu bir uyarı değil, birlikte
            bakılabilecek bir başlık.
          </p>
        </section>

        <section>
          <h2 className="text-b2">Öğretmenden</h2>
          <blockquote className="mt-4 border-l-2 border-nar pl-4">
            <p className="olcu text-govde">{ogretmenMesaji}</p>
            <footer className="mt-2 text-kucuk text-metin-ikincil">Buket Öğretmen</footer>
          </blockquote>
          <Buton vurgu="ikincil" className="mt-6">
            Öğretmene yaz
          </Buton>
        </section>
      </div>
    </Sayfa>
  )
}
