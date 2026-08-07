import { sinif } from '@/lib/sinif'

type Ozellikler = {
  /** 'kucuk' üst barda, 'buyuk' giriş ve tanıtım ekranında. */
  olcek?: 'kucuk' | 'buyuk'
  /** Koyu zeminde (üst bar) kullanılıyorsa. */
  koyuZemin?: boolean
  ekSinif?: string
}

/**
 * Kilit satırı: "SEKİZ" markadır, altındaki imza satırı öğretmenin adıdır.
 * İkisi asla ayrılmaz; alt satır her zaman daha küçük ve daha incedir.
 * Bu ayrım tüm kimliğin temeli: kurumsal bir platform, arkasında gerçek bir öğretmen.
 */
export function KilitSatiri({ olcek = 'kucuk', koyuZemin = false, ekSinif }: Ozellikler) {
  const buyukMu = olcek === 'buyuk'
  return (
    <span className={sinif('flex flex-col', ekSinif)}>
      <span
        className={sinif(
          'font-baslik leading-none',
          buyukMu ? 'text-ekran' : 'text-b3',
          koyuZemin ? 'text-kagit' : 'text-murekkep',
        )}
        style={{ fontWeight: 600, letterSpacing: buyukMu ? '0.06em' : '0.05em' }}
      >
        SEKİZ
      </span>
      <span
        className={sinif(
          'mt-1 leading-tight',
          buyukMu ? 'text-kucuk' : 'text-etiket',
          koyuZemin ? 'text-kagit/70' : 'text-kursun-koyu',
        )}
        style={{ fontWeight: 400, letterSpacing: '0.02em' }}
      >
        Buket Topuzoğlu · Matematik
      </span>
    </span>
  )
}
