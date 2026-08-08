import { SekizgenHucre } from './SekizgenHucre'
import type { YoklamaDurumu } from '@/types'
import { sayi, yuzde } from '@/lib/bicim'

export type YoklamaHucresi = {
  ogrenciId: string
  ad: string
  ogrenciNo: string
  durum: YoklamaDurumu
}

type Ozellikler = {
  baslik: string
  hucreler: readonly YoklamaHucresi[]
  onSecim?: (ogrenciId: string) => void
}

const sira: readonly YoklamaDurumu[] = ['teslim', 'yapmadi', 'bekliyor']
const isimler: Record<YoklamaDurumu, string> = {
  teslim: 'Yaptı',
  yapmadi: 'Yapmadı',
  bekliyor: 'Süresi dolmadı',
}
const noktaRengi: Record<YoklamaDurumu, string> = {
  teslim: 'bg-yesim',
  yapmadi: 'bg-kizil',
  bekliyor: 'bg-kenar',
}

/**
 * SINIF PANOSUNUN İMZA ÖĞESİ — sekizgen yoklama şeridi.
 *
 * Tasarım kararı: Bu şeridin tek işi "sınıfın nabzını tek bakışta göstermek".
 * Gözün gideceği ilk yer teslim oranıdır (sağ üstteki büyük sayı), ikincil bilgi
 * tek tek hücrelerdir. Liste değil ızgaradır: 30 öğrenci tek ekrana sığar,
 * kaydırma gerekmez — kağıt yoklama defterinin dijitalde mümkün olan hâli.
 */
export function YoklamaSeridi({ baslik, hucreler, onSecim }: Ozellikler) {
  const toplam = hucreler.length
  const teslimEden = hucreler.filter((h) => h.durum === 'teslim').length
  const oran = toplam === 0 ? 0 : teslimEden / toplam

  return (
    <section className="rounded-lg border border-kenar bg-yuzey p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-b3 font-semibold">{baslik}</h3>
          <p className="text-kucuk text-metin-ikincil">
            {sayi(teslimEden)} / {sayi(toplam)} öğrenci yaptı
          </p>
        </div>
        <p className="font-marka text-rakam text-vurgu" aria-hidden="true">
          {yuzde(oran)}
        </p>
      </header>

      <ul className="flex flex-wrap gap-2" role="list">
        {hucreler.map((h) => (
          <li key={h.ogrenciId}>
            <SekizgenHucre
              durum={h.durum}
              kisaMetin={h.ogrenciNo}
              tamMetin={`${h.ogrenciNo} · ${h.ad}`}
              {...(onSecim ? { onTiklama: () => onSecim(h.ogrenciId) } : {})}
            />
          </li>
        ))}
      </ul>

      <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-kucuk text-metin-ikincil" role="list">
        {sira.map((durum) => (
          <li key={durum} className="flex items-center gap-2">
            <span className={`size-2 rounded-xs ${noktaRengi[durum]}`} aria-hidden="true" />
            {isimler[durum]}
          </li>
        ))}
      </ul>
    </section>
  )
}
