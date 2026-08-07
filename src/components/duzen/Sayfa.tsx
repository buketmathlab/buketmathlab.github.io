import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { UstBar } from './UstBar'

type Ozellikler = {
  /** Tarayıcı sekmesi ve h1 başlığı. */
  baslik: string
  /** Başlığın altındaki tek cümlelik açıklama. */
  aciklama?: string
  yan?: ReactNode
  children: ReactNode
}

/**
 * Sayfa iskeleti: üst bar + başlık bloğu + içerik.
 * Mobil öncelikli: içerik 360px'te tek sütun, geniş ekranda 1024px'te durur.
 */
export function Sayfa({ baslik, aciklama, yan, children }: Ozellikler) {
  useEffect(() => {
    document.title = `${baslik} · SEKİZ`
  }, [baslik])

  return (
    <div className="min-h-dvh bg-kagit">
      <UstBar {...(yan ? { yan } : {})} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-b1">{baslik}</h1>
          {aciklama && <p className="mt-2 text-govde text-kursun-koyu olcu">{aciklama}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}
