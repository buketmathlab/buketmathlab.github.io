import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'

type Ozellikler = {
  yan?: ReactNode
}

/**
 * Üst bar. Yükseklik sabittir; içerik değişse de sayfa zıplamaz.
 * Sembol + wordmark birlikte durur; camgöbeği buraya girmez — üst bar
 * mimaridir, olay değil.
 */
export function UstBar({ yan }: Ozellikler) {
  return (
    <header className="basilmaz sticky top-0 z-10 border-b border-kenar bg-zemin/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3 rounded-md" aria-label="SEKİZ ana sayfa">
          <SekizSonsuz boyut="kucuk" duragan ekSinif="text-vurgu" />
          <Marka />
        </Link>
        {yan && <div className="ml-auto flex items-center gap-2">{yan}</div>}
      </div>
    </header>
  )
}
