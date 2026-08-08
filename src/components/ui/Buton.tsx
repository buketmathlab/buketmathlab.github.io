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
 * Birincil düğme LACİVERTTİR, nar değil. Ana eylem sık tekrarlanır; canlı rengi
 * düğmeye verirsek %5–10 kuralı çöker ve nar sıradanlaşır. Nar yalnız etkin
 * gezinme, ilerleme ve açıklanan puan gibi olay anlarında görünür.
 */
const vurgular: Record<Vurgu, string> = {
  birincil:
    'bg-marka text-tebesir border-marka hover:bg-lacivert-duman disabled:bg-kursun disabled:border-kursun',
  ikincil: 'bg-yuzey text-metin border-kenar hover:bg-yuzey-yuksek disabled:text-kursun',
  sessiz:
    'bg-transparent text-metin-ikincil border-transparent hover:bg-yuzey-yuksek hover:text-metin',
  yikici: 'bg-yuzey text-olumsuz border-kiremit/40 hover:bg-kiremit-sis disabled:text-kursun',
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
      {/* Dönen çark yok: bekleme, nefes alan tek nokta ile anlatılır. */}
      {bekliyor && <span className="size-1.5 animate-nefes rounded-full bg-current" aria-hidden="true" />}
      {children}
    </button>
  )
}
