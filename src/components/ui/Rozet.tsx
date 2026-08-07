import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

type Ton = 'notr' | 'olumlu' | 'uyari' | 'olumsuz' | 'altin'

const tonlar: Record<Ton, string> = {
  notr: 'bg-kagit-golge text-kursun-koyu border-kenar-koyu',
  olumlu: 'bg-yesil-soluk text-yesil-metin border-yesil/40',
  uyari: 'bg-altin-soluk text-altin-koyu border-altin/50',
  olumsuz: 'bg-kirmizi-soluk text-kirmizi-metin border-kirmizi/40',
  altin: 'bg-altin text-murekkep border-altin',
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
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-kucuk font-semibold',
        tonlar[ton],
        ekSinif,
      )}
    >
      {children}
    </span>
  )
}
