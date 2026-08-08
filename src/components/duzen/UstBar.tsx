import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { sinif } from '@/lib/sinif'
import type { GezinmeOgesi } from '@/lib/gezinme'

type Ozellikler = {
  yan?: ReactNode
  ogeler?: readonly GezinmeOgesi[]
  /** Etkin öğenin anahtarı. */
  aktif?: string
}

/**
 * ÜST BAR
 *
 * Tasarım kararı: Üst bar AÇIK zeminlidir. Koyu lacivert bir şerit her ekranın
 * tepesine konursa arayüz ferahlığını kaybeder ve "fazla lacivert" olur.
 * Kurumsal ağırlık renkten değil tipografiden gelir: wordmark lacivert, zemin
 * kireç, altında tek bir ince çizgi.
 *
 * Mühür burada durmaz — logo tanıtım, giriş, kürsü ve basılı belgelerde görünür;
 * uygulama içinde tekrarlanmaz.
 */
export function UstBar({ yan, ogeler, aktif }: Ozellikler) {
  return (
    <header className="basilmaz sticky top-0 z-10 border-b border-kenar bg-zemin/90 backdrop-blur-sm">
      <div className="kap flex items-center gap-4 py-3">
        <Link to="/" className="flex items-center gap-3 rounded-md" aria-label="SEKİZ ana sayfa">
          <SekizSonsuz boyut="kucuk" hal="sekiz" ekSinif="text-marka" />
          <Marka />
        </Link>

        {ogeler && ogeler.length > 0 && (
          <nav aria-label="Ana gezinme" className="ml-6 hidden sm:block">
            <ul className="flex items-center gap-1" role="list">
              {ogeler.map((oge) => (
                <li key={oge.anahtar}>
                  <Link
                    to={oge.yol}
                    aria-current={oge.anahtar === aktif ? 'page' : undefined}
                    className={sinif(
                      'inline-flex min-h-11 items-center rounded-md px-3 text-kucuk font-semibold transition-colors duration-150',
                      oge.anahtar === aktif
                        ? 'bg-nar-sis text-vurgu'
                        : 'text-metin-ikincil hover:bg-yuzey-yuksek hover:text-metin',
                    )}
                  >
                    {oge.ad}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {yan && <div className="ml-auto flex items-center gap-2">{yan}</div>}
      </div>
    </header>
  )
}
