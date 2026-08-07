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
 * birincil: ekranın tek ana eylemi ("Ödevi yayınla")
 * ikincil : yan eylem ("Vazgeç", "Taslak kaydet")
 * sessiz  : liste içi eylem, çerçevesiz
 * yikici  : geri alınamaz eylem; iki adımlı onayın son düğmesi
 *
 * Her düğme 44px dokunma hedefini karşılar ve dokunuşa 100 ms içinde
 * görsel yanıt verir (active:scale).
 */
const vurgular: Record<Vurgu, string> = {
  birincil:
    'bg-murekkep text-kagit border-murekkep hover:bg-murekkep-700 disabled:bg-kursun disabled:border-kursun',
  ikincil:
    'bg-kagit-yuksek text-murekkep border-kenar-koyu hover:bg-kagit-golge disabled:text-kursun',
  sessiz:
    'bg-transparent text-murekkep-700 border-transparent hover:bg-kagit-golge disabled:text-kursun',
  yikici: 'bg-kirmizi text-kagit border-kirmizi hover:bg-kirmizi-metin disabled:bg-kursun',
}

const olcekler: Record<Olcek, string> = {
  normal: 'px-4 py-2',
  genis: 'w-full px-4 py-3 justify-center',
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
        'inline-flex min-h-11 items-center gap-2 rounded-md border text-govde font-semibold',
        'transition-[background-color,transform] duration-150 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        vurgular[vurgu],
        olcekler[olcek],
        className,
      )}
    >
      {/* Dönen çark yok: bekleme, yanıp sönen tek nokta ile anlatılır. */}
      {bekliyor && <span className="size-2 animate-iskelet rounded-full bg-current" aria-hidden="true" />}
      {children}
    </button>
  )
}
