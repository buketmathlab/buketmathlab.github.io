import { sinif } from '@/lib/sinif'
import type { YoklamaDurumu } from '@/types'

type Ozellikler = {
  durum: YoklamaDurumu
  /** Hücrede görünen kısa metin — öğrenci numarası. */
  kisaMetin: string
  /** Ekran okuyucu ve ipucu metni: "12 · Ayşe Yılmaz". */
  tamMetin: string
  onTiklama?: () => void
}

/**
 * Durum → görsel dil. Renk tek başına anlam taşımaz: dolgu/boşluk farkı ve
 * ekran okuyucuya giden metin de durumu söyler (renk körlüğü ve AA gereği).
 */
const gorunum: Record<YoklamaDurumu, { dolgu: string; cizgi: string; yazi: string; ad: string }> = {
  teslim: {
    dolgu: 'fill-yesil',
    cizgi: 'stroke-yesil',
    yazi: 'fill-kagit-yuksek',
    ad: 'teslim etti',
  },
  gec: {
    dolgu: 'fill-altin-soluk',
    cizgi: 'stroke-altin',
    yazi: 'fill-altin-koyu',
    ad: 'geç teslim etti',
  },
  eksik: {
    dolgu: 'fill-kirmizi-soluk',
    cizgi: 'stroke-kirmizi',
    yazi: 'fill-kirmizi-metin',
    ad: 'göndermedi',
  },
  bekliyor: {
    dolgu: 'fill-kagit-golge',
    cizgi: 'stroke-kenar-koyu',
    yazi: 'fill-kursun-koyu',
    ad: 'süresi dolmadı',
  },
}

/** Düzgün sekizgen — 48×48 kutuda, 1,5 birim içeriden (çizgi taşmasın). */
const SEKIZGEN = '15,1.5 33,1.5 46.5,15 46.5,33 33,46.5 15,46.5 1.5,33 1.5,15'

/**
 * Sekizgen hücre — ismin geometrisinin işlevselleştiği yer.
 * Kağıt yoklama defterindeki kareyi sekizgene çevirir; dolu/boş/geç durumu
 * tek bakışta okunur. Dokunma hedefi 44px'in altına düşmez.
 */
export function SekizgenHucre({ durum, kisaMetin, tamMetin, onTiklama }: Ozellikler) {
  const stil = gorunum[durum]
  const aciklama = `${tamMetin} — ${stil.ad}`

  const govde = (
    <svg viewBox="0 0 48 48" className="size-11" aria-hidden="true" focusable="false">
      <polygon points={SEKIZGEN} className={sinif(stil.dolgu, stil.cizgi)} strokeWidth={2.5} />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className={sinif('text-kucuk font-semibold', stil.yazi)}
        style={{ fontFamily: 'var(--font-govde)' }}
      >
        {kisaMetin}
      </text>
    </svg>
  )

  if (!onTiklama) {
    return (
      <div className="shrink-0" title={aciklama} aria-label={aciklama} role="img">
        {govde}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onTiklama}
      title={aciklama}
      aria-label={aciklama}
      className="shrink-0 rounded-md transition-transform duration-150 hover:scale-110 active:scale-95"
    >
      {govde}
    </button>
  )
}
