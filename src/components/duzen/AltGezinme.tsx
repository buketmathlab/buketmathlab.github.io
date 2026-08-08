import { Link } from 'react-router-dom'
import { sinif } from '@/lib/sinif'
import type { GezinmeOgesi } from '@/lib/gezinme'

type Ozellikler = {
  ogeler: readonly GezinmeOgesi[]
  /** Etkin öğenin anahtarı. Adresten değil ekrandan gelir. */
  aktif: string
}

/**
 * MOBİL ALT GEZİNME
 *
 * Tasarım kararı: Öğrenci telefonu tek eliyle tutuyor; ana geçişler başparmağın
 * doğal yayında olmalı, bu yüzden gezinme altta. Etkin öğe hazır bir ikonla
 * değil markanın kendi geometrisiyle işaretlenir: sekizgen hücre nar ile dolar.
 * Jenerik "ev/zil/kişi" ikonografisi ürünü her uygulamaya benzetirdi.
 *
 * Yalnız dar ekranda görünür; tablet ve üstünde gezinme üst bara çıkar.
 */
export function AltGezinme({ ogeler, aktif }: Ozellikler) {
  return (
    <nav
      aria-label="Ana gezinme"
      className="basilmaz fixed inset-x-0 bottom-0 z-20 border-t border-kenar bg-yuzey/95 backdrop-blur-sm sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg" role="list">
        {ogeler.map((oge) => {
          const etkin = oge.anahtar === aktif
          return (
            <li key={oge.anahtar} className="flex-1">
              <Link
                to={oge.yol}
                aria-current={etkin ? 'page' : undefined}
                className={sinif(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-etiket transition-colors duration-150',
                  etkin ? 'text-vurgu' : 'text-metin-ikincil hover:text-metin',
                )}
              >
                <span
                  className={sinif(
                    'sekizgen flex size-6 items-center justify-center text-[10px] font-semibold',
                    etkin ? 'bg-vurgu text-tebesir' : 'bg-yuzey-yuksek text-metin-ikincil',
                  )}
                  aria-hidden="true"
                >
                  {oge.isaret}
                </span>
                {oge.ad}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
