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
    <section className="border-t border-kenar pt-8">
      <h2 className="text-b2">{baslik}</h2>
      {aciklama && <p className="mt-2 text-govde text-kursun-koyu olcu">{aciklama}</p>}
      <div className="mt-6">{children}</div>
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
    <div className="rounded-md border border-kenar bg-kagit-yuksek p-3">
      <div
        className={sinif('mb-3 h-14 rounded-sm border border-kenar', ornekSinif)}
        aria-hidden="true"
      />
      <p className="text-kucuk font-semibold text-murekkep">{ad}</p>
      <p className="font-mono text-kucuk text-kursun-koyu">{token}</p>
      <p className="mt-2 text-kucuk text-kursun-koyu">{kullanim}</p>
      {kontrast && (
        <p className="mt-1 text-kucuk font-semibold text-murekkep-700">Kontrast {kontrast}</p>
      )}
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
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-kenar py-3 last:border-b-0">
      <p className={sinifAdi}>{ornek}</p>
      <p className="shrink-0 font-mono text-kucuk text-kursun-koyu">
        {ad} · {deger}
      </p>
    </div>
  )
}
