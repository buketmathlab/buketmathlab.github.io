import { sinif } from '@/lib/sinif'

type Ozellikler = {
  satir?: number
  ekSinif?: string
}

/**
 * Yükleniyor hâli — dönen çark değil iskelet.
 * İskelet, gelecek içeriğin biçimini önceden gösterir; sayfa dolunca yerleşim
 * zıplamaz. Genişlikler bilinçli olarak eşit değildir (metin izlenimi).
 */
export function Iskelet({ satir = 3, ekSinif }: Ozellikler) {
  const genislikler = ['w-full', 'w-11/12', 'w-8/12', 'w-10/12', 'w-7/12']
  return (
    <div className={sinif('space-y-3', ekSinif)} aria-hidden="true">
      {Array.from({ length: satir }, (_, i) => (
        <div
          key={i}
          className={sinif(
            'h-3 animate-iskelet rounded-xs bg-yuzey-yuksek',
            genislikler[i % genislikler.length],
          )}
        />
      ))}
    </div>
  )
}

/** Kart biçiminde iskelet — pano ve liste yüklenirken. */
export function KartIskeleti() {
  return (
    <div className="rounded-lg border border-kenar bg-yuzey p-4 shadow-kart" aria-hidden="true">
      <div className="mb-4 h-4 w-5/12 animate-iskelet rounded-xs bg-yuzey-yuksek" />
      <Iskelet satir={2} />
    </div>
  )
}
