import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

type Ton = 'notr' | 'olumlu' | 'uyari' | 'olumsuz' | 'vurgu' | 'odul'

const tonlar: Record<Ton, string> = {
  notr: 'bg-yuzey-yuksek text-metin-ikincil border-kenar',
  olumlu: 'bg-yaprak-sis text-olumlu border-yaprak/25',
  uyari: 'bg-bal-sis text-uyari border-bal/25',
  olumsuz: 'bg-kiremit-sis text-olumsuz border-kiremit/25',
  // Nar rozeti nadirdir: yeni açılan, dikkat çeken bir şey.
  vurgu: 'bg-nar-sis text-vurgu border-nar/25',
  // Ödül rozeti sıcak ama sessiz: tint zemin, koyu metin. Doygun sarı dolgu yok.
  odul: 'bg-bal-sis text-uyari border-bal/30',
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
        'inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-rozet',
        tonlar[ton],
        ekSinif,
      )}
    >
      {children}
    </span>
  )
}
