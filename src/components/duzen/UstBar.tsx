import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Muhur } from '@/components/marka/Muhur'
import { KilitSatiri } from '@/components/marka/KilitSatiri'

type Ozellikler = {
  /** Sağ tarafta rol menüsü, çıkış düğmesi vb. */
  yan?: ReactNode
}

/**
 * Üst bar — kilit satırı her ekranda buradadır.
 * Yükseklik sabittir; içerik değişse de sayfa zıplamaz.
 */
export function UstBar({ yan }: Ozellikler) {
  return (
    <header className="sticky top-0 z-10 border-b border-murekkep-900 bg-murekkep text-kagit basilmaz">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-md"
          aria-label="SEKİZ ana sayfa"
        >
          <Muhur boyut={40} />
          <KilitSatiri koyuZemin />
        </Link>
        {yan && <div className="ml-auto flex items-center gap-2">{yan}</div>}
      </div>
    </header>
  )
}
