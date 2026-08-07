import { sinif } from '@/lib/sinif'

type Ozellikler = {
  /** Kenar uzunluğu (px). Doğru dosya bu değere göre seçilir. */
  boyut?: number
  ekSinif?: string
}

/**
 * Okul mührü (logo). Egress bütçesi gereği küçük ölçekte 64px'lik dosya,
 * büyük ölçekte 192px'lik dosya çekilir; tam boy 512px yalnız tanıtım sayfasında.
 */
export function Muhur({ boyut = 48, ekSinif }: Ozellikler) {
  // Retina ekranlarda bulanıklaşmasın diye dosya, istenen boyutun iki katına göre seçilir.
  const kaynak = boyut <= 32 ? '/logo-64.png' : boyut <= 96 ? '/logo-192.png' : '/logo-512.png'
  return (
    <img
      src={kaynak}
      width={boyut}
      height={boyut}
      loading="lazy"
      decoding="async"
      alt="Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi mührü"
      className={sinif('shrink-0 rounded-full bg-kagit-yuksek', ekSinif)}
      style={{ width: boyut, height: boyut }}
    />
  )
}
