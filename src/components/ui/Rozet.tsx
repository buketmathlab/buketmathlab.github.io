import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

type Ton = 'notr' | 'olumlu' | 'olumsuz' | 'vurgu'

const tonlar: Record<Ton, string> = {
  notr: 'bg-yuzey-yuksek text-metin-ikincil border-kenar',
  olumlu: 'bg-yesim-sis text-yesim border-yesim/30',
  olumsuz: 'bg-kizil-sis text-kizil border-kizil/30',
  // Camgöbeği rozeti nadirdir: seri, madalya, yeni açılan bir şey.
  vurgu: 'bg-camgobegi-sis text-vurgu border-vurgu/30',
}

type Ozellikler = {
  ton?: Ton
  children: ReactNode
  ekSinif?: string
}

/** Durum etiketi: "Yapıldı", "Onay bekliyor", "Özel ders". Renk tek anlam taşıyıcı değildir. */
export function Rozet({ ton = 'notr', children, ekSinif }: Ozellikler) {
  return (
    <span
      className={sinif(
        'inline-flex items-center rounded-sm border px-2 py-1 text-etiket',
        tonlar[ton],
        ekSinif,
      )}
    >
      {children}
    </span>
  )
}
