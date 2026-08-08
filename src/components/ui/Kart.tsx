import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

type Ozellikler = {
  baslik?: string
  /** Başlığın sağındaki ikincil bilgi ya da eylem. */
  yan?: ReactNode
  aciklama?: string
  children: ReactNode
  ekSinif?: string
}

/**
 * Kart. Derinlik tek katman gölge + ince kenarlıkla anlatılır; gölge yığını yok.
 *
 * Her şey kart olmaz — bazı bölümler kenardan kenara, tipografiyle kurulur.
 * Kart yalnız birbirinden bağımsız bilgi kümelerini ayırmak için kullanılır.
 */
export function Kart({ baslik, yan, aciklama, children, ekSinif }: Ozellikler) {
  return (
    <section className={sinif('rounded-lg border border-kenar bg-yuzey p-4 shadow-kart', ekSinif)}>
      {(baslik || yan) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {baslik && <h3 className="text-b3 font-semibold">{baslik}</h3>}
            {aciklama && <p className="mt-1 olcu text-kucuk text-metin-ikincil">{aciklama}</p>}
          </div>
          {yan && <div className="shrink-0">{yan}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
