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
 * Durum → görsel dil.
 *
 * Tasarım kararı: Hücrede ÖĞRENCİ NUMARASI durur, simge değil. 200 öğrencide
 * numara birincil ayırt edicidir; öğretmenin "kim yapmadı" sorusuna cevabı
 * şeridin kendisi vermelidir, ipucu balonu değil.
 *
 * Renk tek anlam taşıyıcısı olmasın diye durum üç ayrı sinyalle anlatılır:
 *   1. DOLULUK  — yaptı dolu, yapmadı boş (renk körlüğünde okunan sinyal budur)
 *   2. ÇİZGİ    — yapmadıda kalın kırmızı çerçeve, beklemede ince gri
 *   3. METİN    — ekran okuyucuya "ödevi yapmadı" olarak gider
 */
const gorunum: Record<
  YoklamaDurumu,
  { dolgu: string; cizgi: string; yazi: string; kalinlik: number; ad: string }
> = {
  teslim: {
    dolgu: 'fill-yaprak',
    cizgi: 'stroke-yaprak',
    yazi: 'fill-tebesir',
    kalinlik: 2,
    ad: 'ödevi yaptı',
  },
  yapmadi: {
    dolgu: 'fill-tebesir',
    cizgi: 'stroke-kiremit',
    yazi: 'fill-kiremit',
    kalinlik: 3.5,
    ad: 'ödevi yapmadı',
  },
  bekliyor: {
    dolgu: 'fill-yuzey-yuksek',
    cizgi: 'stroke-kenar',
    yazi: 'fill-kursun',
    kalinlik: 1.5,
    ad: 'süresi dolmadı, henüz göndermedi',
  },
}

/** Düzgün sekizgen — 48×48 kutuda, 2 birim içeriden (kalın çizgi taşmasın). */
const SEKIZGEN = '15,2 33,2 46,15 46,33 33,46 15,46 2,33 2,15'

/**
 * Sekizgen hücre — 8'in geometrisinin işlevselleştiği yer.
 * Kağıt yoklama defterindeki kareyi sekizgene çevirir; sınıfın nabzı tek
 * bakışta okunur. Dokunma hedefi 44px'in altına düşmez.
 */
export function SekizgenHucre({ durum, kisaMetin, tamMetin, onTiklama }: Ozellikler) {
  const stil = gorunum[durum]
  const aciklama = `${tamMetin} — ${stil.ad}`

  const govde = (
    <svg viewBox="0 0 48 48" className="size-11" aria-hidden="true" focusable="false">
      <polygon
        points={SEKIZGEN}
        className={sinif(stil.dolgu, stil.cizgi)}
        strokeWidth={stil.kalinlik}
      />
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
