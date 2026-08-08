import { sinif } from '@/lib/sinif'

type Ozellikler = {
  boyut?: number
  /** Selamlama anında kollar ve bacaklar açılarak belirir. */
  hareketli?: boolean
  ekSinif?: string
}

/**
 * 8 → ÖĞRENCİ
 *
 * Markanın üçüncü dönüşümü. 8 yana yattığında sonsuz oluyordu; ayakta durduğunda
 * ise bir öğrenciye dönüşüyor: üstteki halka baş, alttaki halka gövde, aralarına
 * ince kollar ve bacaklar giriyor.
 *
 * Tasarım kararı: Halkalara dokunulmuyor — sembolün kendisi hiç değişmiyor,
 * yalnız çevresine dört çizgi ekleniyor. Bu yüzden figür "yeni bir ikon" gibi
 * değil, aynı sekizin bir hâli gibi okunuyor. Karikatür yüz, gülümseme veya
 * çocuksu ayrıntı yok: 15 yaşındaki biri kendisine çocuk muamelesi yapıldığını
 * anında anlar.
 *
 * Yalnız öğrencinin selamlandığı yerde kullanılır; her ekranda tekrarlanmaz.
 */
export function SekizFigur({ boyut = 56, hareketli = true, ekSinif }: Ozellikler) {
  return (
    <svg
      viewBox="0 0 48 64"
      width={boyut}
      height={(boyut * 64) / 48}
      className={sinif('shrink-0', ekSinif)}
      role="img"
      aria-label="SEKİZ öğrenci işareti"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
    >
      {/* Sekizin kendisi: baş ve gövde. Halkalar hiç değişmez. */}
      <circle cx="24" cy="12.5" r="8.5" />
      <circle cx="24" cy="33" r="12" />

      {/* Kollar ve bacaklar — sekizin çevresine eklenen dört çizgi. */}
      <g
        className={hareketli ? 'animate-belir' : undefined}
        style={hareketli ? { animationDelay: '0.25s' } : undefined}
        strokeWidth={2}
      >
        <path d="M12 30 L3 38" />
        <path d="M36 30 L45 38" />
        <path d="M19 44.5 L16 60" />
        <path d="M29 44.5 L32 60" />
      </g>
    </svg>
  )
}
