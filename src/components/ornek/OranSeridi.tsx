import { yuzde } from '@/lib/bicim'

type Ozellikler = {
  ad: string
  altMetin: string
  /** 0–1 arası tamamlanma oranı. */
  oran: number
}

/**
 * Oran şeridi — sınıfın tamamlanma nabzı.
 *
 * Tasarım kararı: Pasta grafik değil tek çizgi. Dört sınıf alt alta gelince
 * çizgiler kendiliğinden bir karşılaştırma tablosu oluşturuyor; ayrıca grafik
 * kütüphanesi yüklemeye gerek kalmıyor. Dolan kısım nar — ilerleme markanın
 * canlı rengini hak eden birkaç yerden biri.
 */
export function OranSeridi({ ad, altMetin, oran }: Ozellikler) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-b3 font-semibold">{ad}</span>
        <span className="text-kucuk text-metin-ikincil">{altMetin}</span>
        <span className="ml-auto font-semibold tabular-nums">{yuzde(oran)}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-xs bg-yuzey-yuksek">
        <div
          className="h-1.5 rounded-xs bg-vurgu"
          style={{ width: `${Math.round(oran * 100)}%` }}
          role="img"
          aria-label={`${ad} tamamlanma oranı ${yuzde(oran)}`}
        />
      </div>
    </div>
  )
}
