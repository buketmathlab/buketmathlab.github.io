import { sinif } from '@/lib/sinif'

type Olcek = 'kucuk' | 'orta' | 'buyuk'

const ilce: Record<Olcek, string> = {
  kucuk: 'text-kucuk',
  orta: 'text-b3',
  buyuk: 'text-b2',
}
const okul: Record<Olcek, string> = {
  kucuk: 'text-b3',
  orta: 'text-b2',
  buyuk: 'text-b1',
}

type Ozellikler = {
  olcek?: Olcek
  ekSinif?: string
}

/**
 * OKUL KİMLİĞİ — iki satır
 *
 * İlçe üstte, okul adı altta; ikisi asla tek satıra sıkıştırılmaz. Bu düzen
 * mührün kendi düzenidir (alt yayda BEŞİKTAŞ, çevresinde okul adı) ve kurumun
 * adı platformun adı kadar görünür olmalıdır.
 *
 * İlçe daha sessiz ve harf aralığı açık; okul adı ağırlıkla öne çıkar. Böylece
 * iki satır tek bir kurumsal blok gibi okunur.
 */
export function OkulAdi({ olcek = 'orta', ekSinif }: Ozellikler) {
  return (
    <div className={sinif('flex flex-col', ekSinif)}>
      <span
        className={sinif('font-medium tracking-[0.18em] text-metin-ikincil uppercase', ilce[olcek])}
      >
        Beşiktaş
      </span>
      <span className={sinif('mt-2 font-semibold text-marka', okul[olcek])}>
        Arnavutköy Korkmaz Yiğit Anadolu Lisesi
      </span>
    </div>
  )
}
