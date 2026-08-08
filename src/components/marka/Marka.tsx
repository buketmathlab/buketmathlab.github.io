import { sinif } from '@/lib/sinif'

type Olcek = 'kucuk' | 'orta' | 'afis'

const wordmark: Record<Olcek, string> = {
  kucuk: 'text-b2',
  orta: 'text-ekran',
  afis: 'text-afis',
}
const imza: Record<Olcek, string> = {
  kucuk: 'text-etiket',
  orta: 'text-kucuk',
  afis: 'text-kucuk',
}

type Ozellikler = {
  olcek?: Olcek
  /** İmza satırı (öğretmen adı) gizlenebilir — yalnız wordmark istendiğinde. */
  imzasiz?: boolean
  ekSinif?: string
}

/**
 * WORDMARK — SEKİZ
 *
 * Marka adı yüksek kontrastlı serifle yazılır ve harf arası açılır: kelime
 * bir logo gibi durur, bir başlık gibi değil. "İ" harfinin noktası bilerek
 * korunur — Türkçe bir marka olduğunu ilk bakışta söyleyen ayrıntı odur.
 *
 * Altındaki imza satırı wordmark'tan asla ayrılmaz ve her zaman daha küçük,
 * daha ince, daha sessizdir: kurumsal bir platform, arkasında gerçek bir öğretmen.
 */
export function Marka({ olcek = 'kucuk', imzasiz = false, ekSinif }: Ozellikler) {
  return (
    <span className={sinif('flex flex-col', ekSinif)}>
      <span
        className={sinif('font-marka leading-none text-metin', wordmark[olcek])}
        style={{ letterSpacing: olcek === 'afis' ? '0.02em' : '0.08em' }}
      >
        SEKİZ
      </span>
      {!imzasiz && (
        <span className={sinif('mt-2 text-metin-ikincil', imza[olcek])}>
          Buket Topuzoğlu · Matematik
        </span>
      )}
    </span>
  )
}
