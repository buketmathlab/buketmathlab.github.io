import type { ButtonHTMLAttributes } from 'react'
import { sinif } from '@/lib/sinif'

type Vurgu = 'birincil' | 'ikincil' | 'sessiz' | 'yikici'
type Olcek = 'normal' | 'genis'

type Ozellikler = ButtonHTMLAttributes<HTMLButtonElement> & {
  vurgu?: Vurgu
  olcek?: Olcek
  bekliyor?: boolean
}

/**
 * Tek düğme bileşeni — sözlük burada sabitlenir.
 *   birincil : ekranın tek ana eylemi ("Ödevi yayınla")
 *   ikincil  : yan eylem ("Vazgeç")
 *   sessiz   : liste içi eylem
 *   yikici   : geri alınamaz eylem; iki adımlı onayın son düğmesi
 *
 * Camgöbeği BURADA KULLANILMAZ. Ana eylem sık tekrarlanır; canlı rengi düğmeye
 * verirsek %10 kuralı çöker ve renk sıradanlaşır. Camgöbeği yalnız olay
 * anlarında görünür — bu yüzden bir değer taşır.
 */
const vurgular: Record<Vurgu, string> = {
  birincil:
    'bg-metin text-zemin border-transparent hover:bg-white disabled:bg-mineral disabled:text-zemin',
  ikincil: 'bg-transparent text-metin border-kenar hover:bg-yuzey-yuksek disabled:text-mineral',
  sessiz:
    'bg-transparent text-metin-ikincil border-transparent hover:bg-yuzey-yuksek hover:text-metin',
  yikici: 'bg-kizil-sis text-kizil border-kizil/40 hover:bg-kizil/20 disabled:text-mineral',
}

const olcekler: Record<Olcek, string> = {
  normal: 'px-4 py-2',
  genis: 'w-full justify-center px-4 py-3',
}

export function Buton({
  vurgu = 'ikincil',
  olcek = 'normal',
  bekliyor = false,
  disabled,
  className,
  children,
  ...kalan
}: Ozellikler) {
  return (
    <button
      {...kalan}
      disabled={disabled || bekliyor}
      aria-busy={bekliyor || undefined}
      className={sinif(
        'inline-flex min-h-11 items-center gap-2 rounded-md border text-kucuk font-semibold',
        'transition-[background-color,transform,color] duration-150 active:scale-[0.985]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        vurgular[vurgu],
        olcekler[olcek],
        className,
      )}
    >
      {/* Dönen çark yok: bekleme, yanıp sönen tek nokta ile anlatılır. */}
      {bekliyor && <span className="size-1.5 animate-iskelet rounded-full bg-current" aria-hidden="true" />}
      {children}
    </button>
  )
}
