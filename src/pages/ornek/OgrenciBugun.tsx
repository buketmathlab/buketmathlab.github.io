import { Sayfa } from '@/components/duzen/Sayfa'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { OranSeridi } from '@/components/ornek/OranSeridi'
import { gezinme } from '@/lib/gezinme'
import { ogrencininGunu } from '@/lib/ornekVeri'
import { sayi } from '@/lib/bicim'

/**
 * ÖĞRENCİ — BUGÜN
 *
 * Tasarım kararı: Ekranın tek işi "bugün ne yapmalıyım?" sorusunu bir saniyede
 * cevaplamak. Bu yüzden ilk ekranda TEK ödev var; liste değil. Gözün gideceği
 * ilk yer ödevin adı ve kalan süre, ikincil bilgi son puan, üçüncül bilgi konu
 * gelişimi.
 *
 * Öğrenciye "takip ediliyorsun" değil "sürecin sahibi sensin" hissi vermek için
 * dil ikinci tekil ve ödül dili kullanılıyor: seri rozeti, gelişim çizgisinin
 * sonsuza açılması. Ceza dili yok.
 */
export function OgrenciBugun() {
  const { ad, bugun, yaklasan, sonPuan, konular, seri } = ogrencininGunu

  return (
    <Sayfa
      ustEtiket={`MERHABA ${ad.toLocaleUpperCase('tr')}`}
      baslik="Bugün"
      ogeler={gezinme('ogrenci', 'okul')}
      aktif="bugun"
    >
      <div className="flex flex-col gap-12">
        {/* Tek iş: bugünün ödevi */}
        <section className="rounded-lg border border-kenar bg-yuzey p-6 shadow-kart">
          <div className="flex flex-wrap items-center gap-2">
            <Rozet ton="vurgu">BUGÜN SON GÜN</Rozet>
            <span className="text-kucuk text-metin-ikincil">
              {bugun.kalanSaat} saat kaldı · {bugun.sonTarih}
            </span>
          </div>
          <h2 className="mt-4 font-marka text-ekran leading-none">{bugun.baslik}</h2>
          <p className="mt-3 text-kucuk text-metin-ikincil">
            {bugun.konu} · {bugun.tur} · {sayi(bugun.soruSayisi)} soru
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Buton vurgu="birincil">Soru kağıdını aç</Buton>
            <span className="text-kucuk text-metin-ikincil">
              Çözümünün fotoğrafı olmadan gönderemezsin.
            </span>
          </div>
        </section>

        {/* Son puan — olay geçmiş, sakin hâli */}
        <section className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-etiket text-metin-ikincil">SON PUANIN</p>
            <p className="mt-2 font-marka text-rakam">{sayi(sonPuan.deger)}</p>
          </div>
          <div className="text-kucuk text-metin-ikincil">
            <p className="text-metin">{sonPuan.odev}</p>
            <p className="mt-1">
              {sayi(sonPuan.dogru)} doğru · {sayi(sonPuan.yanlis)} yanlış · {sayi(sonPuan.bos)} boş
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Rozet ton="odul">{sayi(seri)} ÖDEVLİK SERİ</Rozet>
            <SekizSonsuz boyut="kucuk" hal="sonsuz" ekSinif="text-vurgu" />
          </div>
        </section>

        <section>
          <h2 className="text-b2">Yaklaşanlar</h2>
          <ul className="mt-4 divide-y divide-kenar border-y border-kenar" role="list">
            {yaklasan.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="font-semibold">{o.baslik}</span>
                <span className="text-kucuk text-metin-ikincil">{o.konu}</span>
                <span className="ml-auto text-kucuk text-metin-ikincil">{o.ne}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-b2">Konularda nerede duruyorsun</h2>
          <p className="mt-3 olcu text-kucuk text-metin-ikincil">
            Bu çizgiler not değil, yön gösterir. Türev şu an en çok çalışman gereken konu.
          </p>
          <ul className="mt-6 flex flex-col gap-4" role="list">
            {konular.map((k) => (
              <li key={k.ad}>
                <OranSeridi ad={k.ad} altMetin="" oran={k.oran} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sayfa>
  )
}
