import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { UstBar } from './UstBar'

type Ozellikler = {
  baslik: string
  aciklama?: string
  yan?: ReactNode
  children: ReactNode
}

/**
 * Sayfa iskeleti: üst bar + başlık bloğu + içerik.
 * Mobil öncelikli: 360px'te tek sütun, geniş ekranda 1024px'te durur.
 */
export function Sayfa({ baslik, aciklama, yan, children }: Ozellikler) {
  useEffect(() => {
    document.title = `${baslik} · SEKİZ`
  }, [baslik])

  return (
    <div className="min-h-dvh bg-zemin">
      <UstBar {...(yan ? { yan } : {})} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-b1 font-semibold">{baslik}</h1>
          {aciklama && <p className="mt-3 olcu text-kucuk text-metin-ikincil">{aciklama}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}
