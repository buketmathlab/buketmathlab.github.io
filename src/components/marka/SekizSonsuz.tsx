import { sinif } from '@/lib/sinif'

type Boyut = 'kucuk' | 'orta' | 'buyuk'

const boyutlar: Record<Boyut, string> = {
  kucuk: 'size-6',
  orta: 'size-10',
  buyuk: 'size-16',
}

type Ozellikler = {
  boyut?: Boyut
  /** Ekran okuyucuya okunacak metin. Bekleme dışında kullanılıyorsa değiştirin. */
  etiket?: string
  /** Animasyonsuz, duran hâli (logo/rozet olarak kullanım). */
  duragan?: boolean
  ekSinif?: string
}

/**
 * Markanın imza hareketi: aynı çizim 90° dönünce 8 → ∞ olur.
 *
 * Tasarım kararı: iki eşit daire üst üste "8"i kurar; 90° döndüğünde yan yana
 * gelip "∞" olur. Şekil değişmez, yalnız bakış açısı değişir — markanın tezi budur.
 * Bu, uygulamadaki TEK süsleyici animasyondur; başka yerde hareket ancak anlam
 * taşıdığında kullanılır. `prefers-reduced-motion` açıkken hareket durur (temel.css).
 */
export function SekizSonsuz({ boyut = 'orta', etiket = 'Yükleniyor', duragan, ekSinif }: Ozellikler) {
  return (
    <span
      className={sinif('inline-flex items-center justify-center', boyutlar[boyut], ekSinif)}
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 48 48" className="size-full" aria-hidden="true" focusable="false">
        <g
          className={duragan ? undefined : 'animate-sekiz-sonsuz'}
          style={{ transformOrigin: '24px 24px' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
        >
          <circle cx="24" cy="15.5" r="8.5" />
          <circle cx="24" cy="32.5" r="8.5" />
        </g>
      </svg>
      <span className="yalniz-okuyucu">{etiket}</span>
    </span>
  )
}
