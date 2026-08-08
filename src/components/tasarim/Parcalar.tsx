import type { ReactNode } from 'react'
import { sinif } from '@/lib/sinif'

/** Tasarım sistemi sayfasının bölüm başlığı — her ekranda aynı ölçek. */
export function Bolum({
  baslik,
  aciklama,
  children,
}: {
  baslik: string
  aciklama?: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-kenar pt-10">
      <h2 className="font-marka text-ekran leading-none">{baslik}</h2>
      {aciklama && <p className="mt-4 olcu text-kucuk text-metin-ikincil">{aciklama}</p>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

/** Renk token'ı: örnek yüzey + ad + kullanım kuralı + kontrast oranı. */
export function RenkKarti({
  ad,
  token,
  ornekSinif,
  kullanim,
  kontrast,
}: {
  ad: string
  token: string
  ornekSinif: string
  kullanim: string
  kontrast?: string
}) {
  return (
    <div className="rounded-md border border-kenar bg-yuzey p-3 shadow-kart">
      <div className={sinif('mb-3 h-16 rounded-sm border border-kenar', ornekSinif)} aria-hidden="true" />
      <p className="text-b3 font-semibold text-metin">{ad}</p>
      <p className="font-mono text-kucuk text-metin-ikincil">{token}</p>
      <p className="mt-2 text-kucuk text-metin-ikincil">{kullanim}</p>
      {kontrast && <p className="mt-2 text-etiket text-vurgu">{kontrast}</p>}
    </div>
  )
}

/** Tipografi ölçeği satırı: örnek + teknik değer. */
export function OlcekSatiri({
  ad,
  deger,
  sinifAdi,
  ornek,
}: {
  ad: string
  deger: string
  sinifAdi: string
  ornek: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-kenar py-4 last:border-b-0">
      <p className={sinifAdi}>{ornek}</p>
      <p className="shrink-0 font-mono text-kucuk text-metin-ikincil">
        {ad} · {deger}
      </p>
    </div>
  )
}
