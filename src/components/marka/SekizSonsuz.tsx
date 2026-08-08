import { sinif } from '@/lib/sinif'

type Boyut = 'kucuk' | 'orta' | 'buyuk' | 'afis'

const boyutlar: Record<Boyut, string> = {
  kucuk: 'size-5',
  orta: 'size-9',
  buyuk: 'size-16',
  afis: 'size-40',
}

type Ozellikler = {
  boyut?: Boyut
  etiket?: string
  /** Animasyonsuz, duran hâli — logo ve rozet kullanımında. */
  duragan?: boolean
  ekSinif?: string
}

/**
 * MARKA SEMBOLÜ — 8 → ∞
 *
 * İki halka üst üste "8"i kurar; 90° döndüğünde yan yana gelip "∞" olur.
 * Şekil hiç değişmez, yalnız bakış açısı değişir. Markanın tezi bu tek
 * harekettedir; başka hiçbir yerde süs animasyonu yoktur.
 *
 * Halkaların çizgisi ince ve eşit: sembol bir ikon değil, bir geometri.
 * Kesişim noktasında çizgi kesilmez — iki halka birbirine teğettir, bu yüzden
 * dönerken form bozulmadan sonsuza akar.
 */
export function SekizSonsuz({ boyut = 'orta', etiket = 'Yükleniyor', duragan, ekSinif }: Ozellikler) {
  return (
    <span
      className={sinif('inline-flex items-center justify-center', boyutlar[boyut], ekSinif)}
      {...(duragan ? {} : { role: 'status', 'aria-live': 'polite' as const })}
    >
      <svg viewBox="0 0 48 48" className="size-full" aria-hidden="true" focusable="false">
        <g
          className={duragan ? undefined : 'animate-sekiz-sonsuz'}
          style={{ transformOrigin: '24px 24px' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
        >
          <circle cx="24" cy="15.25" r="8.75" />
          <circle cx="24" cy="32.75" r="8.75" />
        </g>
      </svg>
      {!duragan && <span className="yalniz-okuyucu">{etiket}</span>}
    </span>
  )
}
