import { useId } from 'react'
import { sinif } from '@/lib/sinif'

type Ozellikler = {
  /** Örgünün göze çarpma derecesi. Zeminde 'sessiz', boş ekranda 'okunur'. */
  ton?: 'sessiz' | 'okunur'
  ekSinif?: string
}

/**
 * SEKİZ ÖRGÜSÜ — markanın dokusu
 *
 * 8'in iki halkası bir ızgaraya yayıldığında ortaya sekizgen boşluklar çıkar:
 * Anadolu tezyinatının ördüğü form ile bir koordinat ızgarası aynı çizimde
 * buluşur. Süs değil zemin: her zaman çok düşük opaklıkta, metnin arkasında,
 * hiçbir zaman ön planda durmaz.
 *
 * Kullanıcı burada "8" görmez; tasarımın kendine ait bir geometrisi olduğunu
 * hisseder — istenen tam olarak budur.
 */
export function SekizOrgu({ ton = 'sessiz', ekSinif }: Ozellikler) {
  const id = useId().replace(/:/g, '')

  return (
    <svg
      className={sinif('pointer-events-none size-full', ekSinif)}
      aria-hidden="true"
      focusable="false"
      style={{ opacity: ton === 'sessiz' ? 0.14 : 0.3 }}
    >
      <defs>
        <pattern id={id} width="96" height="96" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            {/* Dikey teğet halka çifti — bir "8" */}
            <circle cx="48" cy="24" r="23" />
            <circle cx="48" cy="72" r="23" />
            {/* Yatay teğet halka çifti — aynı çizimin döndürülmüş hâli, bir "∞" */}
            <circle cx="0" cy="48" r="23" />
            <circle cx="96" cy="48" r="23" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
