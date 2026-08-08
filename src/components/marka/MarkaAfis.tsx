import { sinif } from '@/lib/sinif'

type Ozellikler = {
  ekSinif?: string
}

/**
 * AFİŞ WORDMARK — SEKİZ
 *
 * Tasarım kararı: Açılış ekranında marka adı kabını TAM doldurur. Bunu punto
 * tahminiyle değil ölçüyle yapıyoruz: kelime SVG içinde çizilir ve `textLength`
 * ile kabın genişliğine oturtulur. Harf biçimleri bozulmaz, yalnız harf arası
 * açılır (`lengthAdjust="spacing"`) — afiş dizgisinin kendi tekniği budur.
 *
 * Sonuç: 360px telefonda da 1600px ekranda da wordmark ızgaraya milimetrik
 * hizalanır; hiçbir ekran için ayrı punto ayarı gerekmez.
 */
export function MarkaAfis({ ekSinif }: Ozellikler) {
  return (
    <svg
      viewBox="0 0 100 44"
      className={sinif('w-full', ekSinif)}
      role="img"
      aria-label="SEKİZ"
      preserveAspectRatio="xMidYMid meet"
    >
      {/*
       * Punto ölçüyle seçildi: Instrument Serif'te "SEKİZ" 100 puntoda 202,6
       * birim genişliğinde. 43,9 punto doğal genişliği 89 birime getirir; kalan
       * %12 harf arasına dağılır. Afiş dizgisinde aranan açıklık budur —
       * daha fazlası kelimeyi dağıtır, daha azı sıkışık gösterir.
       */}
      <text
        x="0"
        y="42"
        textLength="100"
        lengthAdjust="spacing"
        fill="currentColor"
        style={{ fontFamily: 'var(--font-marka)', fontSize: '43.9px' }}
      >
        SEKİZ
      </text>
    </svg>
  )
}
