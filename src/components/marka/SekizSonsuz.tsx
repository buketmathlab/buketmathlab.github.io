import { sinif } from '@/lib/sinif'

type Boyut = 'kucuk' | 'orta' | 'buyuk' | 'afis'
type Hal = 'sekiz' | 'sonsuz' | 'donus'

const boyutlar: Record<Boyut, string> = {
  kucuk: 'size-5',
  orta: 'size-9',
  buyuk: 'size-14',
  afis: 'size-32',
}

type Ozellikler = {
  boyut?: Boyut
  /**
   * 'sekiz'  — hareketsiz 8 (logo, boş ekran)
   * 'sonsuz' — hareketsiz ∞ (tamamlanmış bir şey)
   * 'donus'  — anlamlı anda TEK SEFERLİK 8 → ∞ dönüşü, sonra ∞ olarak durur
   */
  hal?: Hal
  /** Bekleme sürüyorsa: dönmez, yalnız nefes alır. */
  bekliyor?: boolean
  etiket?: string
  ekSinif?: string
}

/**
 * MARKA SEMBOLÜ — 8 → ∞
 *
 * İki halka üst üste "8"i kurar; 90° döndüğünde yan yana gelip "∞" olur.
 * Şekil hiç değişmez, yalnız bakış açısı değişir. Markanın tezi bu tek
 * harekettedir.
 *
 * Tasarım kararı: Sembol SÜREKLİ DÖNMEZ. Dönüş yalnız anlamlı bir anda bir kez
 * olur (uygulama açılışı, gönderim tamamlanma, konu tamamlanma) ve sonsuz olarak
 * durur. Bekleme uzarsa yalnız nefes alır. Sürekli dönen bir sembol markanın
 * fikrini bir yükleme çarkına indirger.
 */
export function SekizSonsuz({
  boyut = 'orta',
  hal = 'sekiz',
  bekliyor = false,
  etiket,
  ekSinif,
}: Ozellikler) {
  const donuyor = hal === 'donus'

  return (
    <span
      className={sinif(
        'inline-flex items-center justify-center',
        boyutlar[boyut],
        bekliyor && 'animate-nefes',
        ekSinif,
      )}
      {...(etiket ? { role: 'status' as const, 'aria-live': 'polite' as const } : {})}
    >
      <svg viewBox="0 0 48 48" className="size-full" aria-hidden="true" focusable="false">
        <g
          className={donuyor ? 'animate-sekiz-donus' : undefined}
          style={{
            transformOrigin: '24px 24px',
            transform: hal === 'sonsuz' ? 'rotate(90deg)' : undefined,
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
        >
          <circle cx="24" cy="15.25" r="8.75" />
          <circle cx="24" cy="32.75" r="8.75" />
        </g>
      </svg>
      {etiket && <span className="yalniz-okuyucu">{etiket}</span>}
    </span>
  )
}
