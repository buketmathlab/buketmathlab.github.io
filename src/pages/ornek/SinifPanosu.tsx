import { Sayfa } from '@/components/duzen/Sayfa'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { YoklamaSeridi } from '@/components/marka/YoklamaSeridi'
import { gezinme } from '@/lib/gezinme'
import { ornekYoklama, sinifPanosu } from '@/lib/ornekVeri'
import { sayi, yuzde } from '@/lib/bicim'

/**
 * SINIF PANOSU — 9A
 *
 * Tasarım kararı: 200 öğrenci tek listede değil; her sınıf kendi bağlamında.
 * Ekranın tek işi "9A ne durumda?" sorusuna cevap vermek. Gözün gideceği ilk
 * yer sekizgen yoklama şeridi — sınıfın nabzı tek bakışta okunur. İkincil bilgi
 * ödev listesi, üçüncül bilgi zorlanılan sorular.
 *
 * Şerit bilinçli olarak tek ödevin durumunu gösterir, tüm dönemi değil:
 * hücreleri çoğaltmak "aşırı sekizgen" ve görsel kalabalık üretirdi.
 */
export function SinifPanosu() {
  const { ad, ogrenciSayisi, ortalama, odevler, zorSorular } = sinifPanosu

  return (
    <Sayfa
      ustEtiket="SINIF PANOSU"
      baslik={ad}
      aciklama={`${sayi(ogrenciSayisi)} öğrenci · dönem ortalaması ${sayi(ortalama, 1)}`}
      ogeler={gezinme('ogretmen')}
      aktif="siniflar"
      yan={<Buton vurgu="birincil">Bu sınıfa ödev ver</Buton>}
    >
      <div className="flex flex-col gap-12">
        <YoklamaSeridi baslik="Türev — 2. ödev" hucreler={ornekYoklama} />

        <section>
          <h2 className="text-b2">Verilen ödevler</h2>
          <ul className="mt-4 divide-y divide-kenar border-y border-kenar" role="list">
            {odevler.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{o.baslik}</p>
                  <p className="text-kucuk text-metin-ikincil">
                    {o.konu} · {o.tur} · son teslim {o.sonTarih}
                  </p>
                </div>
                <span className="ml-auto text-kucuk text-metin-ikincil tabular-nums">
                  {sayi(o.yapan)} / {sayi(o.toplam)}
                </span>
                {o.yapan === o.toplam ? (
                  <Rozet ton="olumlu">TAMAM</Rozet>
                ) : (
                  <Rozet>{yuzde(o.yapan / o.toplam)}</Rozet>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-b2">Sınıfı zorlayan sorular</h2>
          <p className="mt-3 olcu text-govde text-metin-ikincil">
            Bu iki soruyu sınıfın yarısından fazlası yanlışladı. Konuyu tekrar anlatmadan
            önce bunlara bakmak isteyebilirsiniz.
          </p>
          <ul className="mt-4 flex flex-wrap gap-3" role="list">
            {zorSorular.map((z) => (
              <li
                key={z.soru}
                className="flex items-center gap-3 rounded-md border border-kenar bg-yuzey px-4 py-3 shadow-kart"
              >
                <span className="sekizgen flex size-10 items-center justify-center bg-kiremit-sis font-semibold text-olumsuz">
                  {z.soru}
                </span>
                <span className="text-kucuk text-metin-ikincil">
                  {yuzde(z.yanlisOran)} yanlış
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sayfa>
  )
}
