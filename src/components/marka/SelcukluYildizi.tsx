import { sinif } from '@/lib/sinif'

type Ozellikler = {
  /** Boş ekranlarda 'buyuk', rozetlerde 'kucuk'. */
  boyut?: number
  ekSinif?: string
}

/**
 * Selçuklu yıldızı (rub'ul hizb): iki karenin 45° döndürülmesiyle doğan sekiz
 * köşeli yıldız. İnce çizgiyle çizilir — dekorasyon değil, boş ekranın davetidir.
 *
 * Geometri: 100×100 kutuda merkezli iki kare; biri eksenlere paralel, diğeri 45°
 * döndürülmüş. İç sekizgen hatlarını da çizerek çini dokusunu anıştırır.
 */
export function SelcukluYildizi({ boyut = 96, ekSinif }: Ozellikler) {
  const kenar = 62 // kare kenarı
  const merkez = 50
  const yariKenar = kenar / 2
  const kare = `${merkez - yariKenar},${merkez - yariKenar} ${merkez + yariKenar},${merkez - yariKenar} ${merkez + yariKenar},${merkez + yariKenar} ${merkez - yariKenar},${merkez + yariKenar}`

  return (
    <svg
      viewBox="0 0 100 100"
      width={boyut}
      height={boyut}
      aria-hidden="true"
      focusable="false"
      className={sinif('shrink-0', ekSinif)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinejoin="round"
    >
      <polygon points={kare} />
      <polygon points={kare} transform={`rotate(45 ${merkez} ${merkez})`} />
      <circle cx={merkez} cy={merkez} r={yariKenar * 0.62} strokeWidth={0.75} opacity={0.5} />
    </svg>
  )
}
