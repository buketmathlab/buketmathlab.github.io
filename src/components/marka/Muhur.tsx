import { sinif } from '@/lib/sinif'

type Ozellikler = {
  boyut?: number
  ekSinif?: string
}

/**
 * OKUL MÜHRÜ — kurumsal imza
 *
 * Mühür arayüzün taşıyıcı öğesi DEĞİLDİR. Markayı SEKİZ wordmark'ı taşır;
 * mühür yalnız kurumsal yetkinin gerektiği yerlerde görünür: alt bilgi,
 * yazdırılan dönem raporu, veli onam metni, kod kartı.
 *
 * Gerekçe: mühür beyaz zeminli, lacivert bir baskı işidir. Koyu arayüzde her
 * ekrana konursa yamalı durur ve markanın kendi geometrisiyle yarışır.
 * Az yerde ve doğru yerde kullanıldığında ise ağırlığını korur.
 */
export function Muhur({ boyut = 48, ekSinif }: Ozellikler) {
  const kaynak = boyut <= 32 ? '/logo-64.png' : boyut <= 96 ? '/logo-192.png' : '/logo-512.png'
  return (
    <img
      src={kaynak}
      width={boyut}
      height={boyut}
      loading="lazy"
      decoding="async"
      alt="Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi mührü"
      className={sinif('shrink-0 rounded-full', ekSinif)}
      style={{ width: boyut, height: boyut }}
    />
  )
}
