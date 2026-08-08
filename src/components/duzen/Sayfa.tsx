import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { UstBar } from './UstBar'
import { AltGezinme } from './AltGezinme'
import type { GezinmeOgesi } from '@/lib/gezinme'

type Ozellikler = {
  baslik: string
  aciklama?: string
  /** Başlığın üstündeki bağlam etiketi ("9A", "ÖĞRETMEN"). */
  ustEtiket?: string
  yan?: ReactNode
  /** Gezinme öğeleri; verilirse masaüstünde üst barda, mobilde altta görünür. */
  ogeler?: readonly GezinmeOgesi[]
  /** Etkin gezinme öğesinin anahtarı. */
  aktif?: string
  children: ReactNode
}

/**
 * Sayfa iskeleti: üst bar + başlık bloğu + içerik (+ mobil alt gezinme).
 * Mobil öncelikli: 360px'te tek sütun, geniş ekranda 1120px'te durur.
 * Alt gezinme varsa içerik onun altında kalmasın diye alt boşluk bırakılır.
 */
export function Sayfa({ baslik, aciklama, ustEtiket, yan, ogeler, aktif, children }: Ozellikler) {
  useEffect(() => {
    document.title = `${baslik} · SEKİZ`
  }, [baslik])

  return (
    <div className="min-h-dvh bg-zemin">
      <UstBar {...(yan ? { yan } : {})} {...(ogeler ? { ogeler } : {})} {...(aktif ? { aktif } : {})} />
      <main className={ogeler ? 'kap py-8 pb-28 sm:pb-8' : 'kap py-8'}>
        <div className="mb-8">
          {ustEtiket && <p className="mb-2 text-etiket text-vurgu">{ustEtiket}</p>}
          <h1 className="text-b1 font-semibold">{baslik}</h1>
          {aciklama && <p className="mt-3 olcu text-kucuk text-metin-ikincil">{aciklama}</p>}
        </div>
        {children}
      </main>
      {ogeler && <AltGezinme ogeler={ogeler} aktif={aktif ?? ''} />}
    </div>
  )
}
