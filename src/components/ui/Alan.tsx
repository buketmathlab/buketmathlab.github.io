import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { sinif } from '@/lib/sinif'

type Ozellikler = InputHTMLAttributes<HTMLInputElement> & {
  etiket: string
  ipucu?: string
  hata?: string
}

/**
 * Metin alanı. Etiket her zaman görünür (yer tutucu etiket yerine geçmez).
 * Odaklandığında kenarlık nara döner — canlı rengin arayüzdeki görevlerinden
 * biri "şu an buradasın" demektir.
 */
export function Alan({ etiket, ipucu, hata, className, id, ...kalan }: Ozellikler) {
  const uretilen = useId()
  const alanId = id ?? uretilen
  const yardimId = `${alanId}-yardim`

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={alanId} className="text-etiket text-metin-ikincil">
        {etiket}
      </label>
      <input
        {...kalan}
        id={alanId}
        aria-invalid={hata ? true : undefined}
        aria-describedby={hata || ipucu ? yardimId : undefined}
        className={sinif(
          'min-h-11 rounded-md border bg-yuzey px-3 py-2 text-govde text-metin',
          'placeholder:text-kursun/60',
          'focus:border-vurgu focus:outline-none focus-visible:outline-none',
          hata ? 'border-kiremit' : 'border-kenar',
          className,
        )}
      />
      {(hata || ipucu) && (
        <p id={yardimId} className={sinif('text-kucuk', hata ? 'text-olumsuz' : 'text-metin-ikincil')}>
          {hata ?? ipucu}
        </p>
      )}
    </div>
  )
}
