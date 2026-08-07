import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { sinif } from '@/lib/sinif'

type Ozellikler = InputHTMLAttributes<HTMLInputElement> & {
  etiket: string
  /** Alanın altındaki açıklama — hata yoksa görünür. */
  ipucu?: string
  /** Hata metni; ne olduğunu ve ne yapılacağını söyler. */
  hata?: string
}

/**
 * Metin alanı. Etiket her zaman görünür (yer tutucu etiket yerine geçmez).
 * Hata durumunda alan `aria-invalid` alır ve hata metni alanla ilişkilendirilir.
 */
export function Alan({ etiket, ipucu, hata, className, id, ...kalan }: Ozellikler) {
  const uretilen = useId()
  const alanId = id ?? uretilen
  const yardimId = `${alanId}-yardim`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={alanId} className="text-kucuk font-semibold text-murekkep">
        {etiket}
      </label>
      <input
        {...kalan}
        id={alanId}
        aria-invalid={hata ? true : undefined}
        aria-describedby={hata || ipucu ? yardimId : undefined}
        className={sinif(
          'min-h-11 rounded-md border bg-kagit-yuksek px-3 py-2 text-govde',
          'placeholder:text-kursun',
          hata ? 'border-kirmizi' : 'border-kenar-koyu',
          className,
        )}
      />
      {(hata || ipucu) && (
        <p
          id={yardimId}
          className={sinif('text-kucuk', hata ? 'text-kirmizi-metin' : 'text-kursun-koyu')}
        >
          {hata ?? ipucu}
        </p>
      )}
    </div>
  )
}
