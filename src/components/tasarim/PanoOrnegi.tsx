/**
 * Palet karşılaştırması için sınıf panosu örneği.
 * Aynı ekran üç palette de çizilir; renk kararı soyut lekelerle değil gerçek
 * bir ekranla verilir. Renkler token'lardan değil, palet nesnesinden gelir —
 * tasarım sistemi onay verilene kadar değişmez.
 */

export type Palet = {
  kod: 'cini' | 'mine' | 'nar'
  ad: string
  karakter: string
  murekkep: string
  kagit: string
  yuzey: string
  kursun: string
  /** Baskın canlı renk — dolgu olarak kullanılır. */
  canli: string
  /** Aynı rengin metin için koyulaştırılmış hâli (AA). */
  canliMetin: string
  /** İkinci canlı renk — daha da nadir kullanılır. */
  ikinci: string
  ikinciMetin: string
}

/** Anlam renkleri paletten bağımsızdır: doğru yeşil, yanlış kırmızı. */
const YESIL = '#2E7D5B'
const KIRMIZI = '#B03A32'

const SEKIZGEN = '15,1.5 33,1.5 46.5,15 46.5,33 33,46.5 15,46.5 1.5,33 1.5,15'

const hucreler = [
  'y', 'y', 'y', 'k', 'y', 'y', 'n', 'y', 'y', 'y',
  'k', 'y', 'y', 'y', 'n', 'y', 'y', 'k', 'y', 'y',
] as const

export function PanoOrnegi({ p }: { p: Palet }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: p.yuzey, background: p.kagit }}>
      {/* Üst bar — mimari lacivert taşır, canlı renk buraya girmez */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: p.murekkep }}>
        <span className="font-baslik text-kucuk tracking-widest" style={{ color: p.kagit }}>
          SEKİZ
        </span>
        <span className="text-etiket" style={{ color: `${p.kagit}99` }}>
          Buket Topuzoğlu · Matematik
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Sekmeler — etkin sekmenin altı canlı renkle çizilir (aksan) */}
        <div className="flex gap-4 border-b" style={{ borderColor: p.yuzey }}>
          {['Pano', 'Ödevler', 'Öğrenciler'].map((s, i) => (
            <span
              key={s}
              className="pb-2 text-kucuk font-semibold"
              style={{
                color: i === 0 ? p.murekkep : p.kursun,
                borderBottom: i === 0 ? `2px solid ${p.canli}` : '2px solid transparent',
              }}
            >
              {s}
            </span>
          ))}
        </div>

        <div>
          <h3 className="font-baslik text-b3" style={{ color: p.murekkep }}>
            9A · Türev
          </h3>
          <p className="text-kucuk" style={{ color: p.kursun }}>
            28 öğrenci · 1. ödev
          </p>
        </div>

        {/* Tamamlanma — ilerleme çubuğunun dolan kısmı canlı renk (olay) */}
        <div className="rounded-md border p-3" style={{ borderColor: p.yuzey, background: '#fff' }}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-kucuk" style={{ color: p.kursun }}>
              Tamamlanma
            </span>
            <span className="font-baslik text-b2" style={{ color: p.canliMetin }}>
              %79
            </span>
          </div>
          <div className="h-2 w-full rounded-xs" style={{ background: p.yuzey }}>
            <div className="h-2 rounded-xs" style={{ width: '79%', background: p.canli }} />
          </div>
        </div>

        {/* Yoklama şeridi — doğru/yanlış anlamı yeşil ve kırmızıda kalır */}
        <div>
          <div className="flex flex-wrap gap-1.5">
            {hucreler.map((durum, i) => {
              const renk = durum === 'y' ? YESIL : durum === 'n' ? KIRMIZI : p.kursun
              const dolu = durum === 'y'
              return (
                <svg key={i} viewBox="0 0 48 48" className="size-8">
                  <polygon
                    points={SEKIZGEN}
                    fill={dolu ? renk : '#fff'}
                    stroke={durum === 'k' ? p.yuzey : renk}
                    strokeWidth={2.5}
                  />
                  {durum === 'n' && (
                    <path d="M17 17 L31 31 M31 17 L17 31" stroke={renk} strokeWidth={4} strokeLinecap="round" />
                  )}
                  {durum === 'y' && (
                    <path d="M16 24 L22 30 L33 18" stroke="#fff" strokeWidth={4} strokeLinecap="round" fill="none" />
                  )}
                </svg>
              )
            })}
          </div>
        </div>

        {/* Olay kartı — enerjinin patladığı tek yer */}
        <div
          className="flex items-center gap-3 rounded-md p-3"
          style={{ background: p.ikinci, color: p.murekkep }}
        >
          <span className="font-baslik text-rakam leading-none">86</span>
          <span className="text-kucuk font-semibold">
            Ayşe'nin puanı açıklandı
            <br />
            <span style={{ opacity: 0.75 }}>Türev konusunu tamamladı</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="rounded-sm px-2 py-1 text-kucuk font-semibold"
            style={{ background: `${p.canli}22`, color: p.canliMetin }}
          >
            4 ödevlik seri
          </span>
          <span
            className="ml-auto rounded-md px-4 py-2 text-kucuk font-semibold"
            style={{ background: p.murekkep, color: p.kagit }}
          >
            Ödevi yayınla
          </span>
        </div>
      </div>
    </div>
  )
}
