import { sinif } from '@/lib/sinif'
import type { YoklamaDurumu } from '@/types'

type Ozellikler = {
  durum: YoklamaDurumu
  /** Hücrede görünen kısa metin — öğrenci numarası. */
  kisaMetin: string
  /** Ekran okuyucu ve ipucu metni. */
  tamMetin: string
  onTiklama?: () => void
}

/**
 * Durum → görsel dil. Renk TEK BAŞINA anlam taşımaz: doluluk, simge ve ekran
 * okuyucuya giden metin de durumu söyler. Renk körü bir öğretmen şeridi aynı
 * hızda okur.
 */
const gorunum: Record<
  YoklamaDurumu,
  { dolgu: string; cizgi: string; yazi: string; ad: string; simge: 'onay' | 'capraz' | null }
> = {
  teslim: {
    dolgu: 'fill-yesim',
    cizgi: 'stroke-yesim',
    yazi: 'fill-gece',
    ad: 'ödevi yaptı',
    simge: 'onay',
  },
  yapmadi: {
    dolgu: 'fill-kizil-sis',
    cizgi: 'stroke-kizil',
    yazi: 'fill-kizil',
    ad: 'ödevi yapmadı',
    simge: 'capraz',
  },
  bekliyor: {
    dolgu: 'fill-yuzey-yuksek',
    cizgi: 'stroke-kenar',
    yazi: 'fill-metin-ikincil',
    ad: 'süresi dolmadı, henüz göndermedi',
    simge: null,
  },
}

/** Düzgün sekizgen — 48×48 kutuda, 1,5 birim içeriden (çizgi taşmasın). */
const SEKIZGEN = '15,1.5 33,1.5 46.5,15 46.5,33 33,46.5 15,46.5 1.5,33 1.5,15'

/**
 * Sekizgen hücre — 8'in geometrisinin işlevselleştiği yer.
 * Kağıt yoklama defterindeki kareyi sekizgene çevirir; yaptı / yapmadı /
 * süresi dolmadı tek bakışta okunur. Dokunma hedefi 44px'in altına düşmez.
 */
export function SekizgenHucre({ durum, kisaMetin, tamMetin, onTiklama }: Ozellikler) {
  const stil = gorunum[durum]
  const aciklama = `${tamMetin} — ${stil.ad}`

  const govde = (
    <svg viewBox="0 0 48 48" className="size-11" aria-hidden="true" focusable="false">
      <polygon points={SEKIZGEN} className={sinif(stil.dolgu, stil.cizgi)} strokeWidth={2} />
      {stil.simge === null ? (
        <text
          x="24"
          y="25"
          textAnchor="middle"
          dominantBaseline="middle"
          className={sinif('text-kucuk font-semibold', stil.yazi)}
          style={{ fontFamily: 'var(--font-govde)' }}
        >
          {kisaMetin}
        </text>
      ) : stil.simge === 'onay' ? (
        <path
          d="M16 24.5 L21.5 30 L32 18.5"
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          className="stroke-gece"
        />
      ) : (
        <path
          d="M18 18 L30 30 M30 18 L18 30"
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          className="stroke-kizil"
        />
      )}
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
