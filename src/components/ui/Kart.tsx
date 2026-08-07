import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

type Ozellikler = {
  baslik?: string
  /** Başlığın sağındaki ikincil bilgi ya da eylem. */
  yan?: ReactNode
  /** Başlığın altındaki açıklama satırı. */
  aciklama?: string
  children: ReactNode
  ekSinif?: string
}

/**
 * Kart — derinlik gölge yığınıyla değil, kenarlık ve zemin farkıyla anlatılır.
 * Başlık her zaman aynı ölçekte (text-b3); aynı seviyedeki iki başlık asla
 * farklı boyutta olmaz.
 */
export function Kart({ baslik, yan, aciklama, children, ekSinif }: Ozellikler) {
  return (
    <section
      className={sinif(
        'rounded-lg border border-kenar bg-kagit-yuksek p-4 shadow-kart',
        ekSinif,
      )}
    >
      {(baslik || yan) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {baslik && <h3 className="text-b3">{baslik}</h3>}
            {aciklama && <p className="mt-1 text-kucuk text-kursun-koyu olcu">{aciklama}</p>}
          </div>
          {yan && <div className="shrink-0">{yan}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
