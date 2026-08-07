import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Muhur } from '@/components/marka/Muhur'
import { KilitSatiri } from '@/components/marka/KilitSatiri'
import { Alan } from '@/components/ui/Alan'
import { Buton } from '@/components/ui/Buton'

type Kapi = 'kod' | 'ogretmen'

/**
 * Giriş ekranı — Faz 1'de sunucu tarafına bağlanacak (şu an yalnız arayüz).
 *
 * Tasarım kararı: İki ayrı kapı var ama ekran tek. Öğrenci ve veli aynı kod
 * alanını kullanır (kodun kendisi kimin olduğunu söyler); öğretmen ayrı sekmede
 * PIN girer. Gözün gideceği ilk yer kod alanı — kullanıcıların %95'i oradan girer.
 */
export function Giris() {
  const [kapi, setKapi] = useState<Kapi>('kod')
  const [kod, setKod] = useState('')
  const [pin, setPin] = useState('')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-kagit px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Muhur boyut={64} />
        <KilitSatiri olcek="buyuk" ekSinif="mt-4 items-center text-center" />

        <div
          className="mt-8 flex w-full rounded-md border border-kenar-koyu bg-kagit-golge p-1"
          role="tablist"
          aria-label="Giriş yöntemi"
        >
          {(
            [
              ['kod', 'Öğrenci / Veli'],
              ['ogretmen', 'Öğretmen'],
            ] as const
          ).map(([deger, etiket]) => (
            <button
              key={deger}
              type="button"
              role="tab"
              aria-selected={kapi === deger}
              onClick={() => setKapi(deger)}
              className={
                'min-h-11 flex-1 rounded-sm text-kucuk font-semibold transition-colors duration-150 ' +
                (kapi === deger
                  ? 'bg-kagit-yuksek text-murekkep shadow-kart'
                  : 'text-kursun-koyu hover:text-murekkep')
              }
            >
              {etiket}
            </button>
          ))}
        </div>

        <form
          className="mt-6 flex w-full flex-col gap-4"
          onSubmit={(olay) => olay.preventDefault()}
        >
          {kapi === 'kod' ? (
            <Alan
              etiket="Giriş kodun"
              name="kod"
              autoComplete="off"
              inputMode="text"
              placeholder="ör. 9A-K7M2"
              value={kod}
              onChange={(o) => setKod(o.target.value)}
              ipucu="Kodu öğretmeninden aldığın kartın üzerinde bulabilirsin."
            />
          ) : (
            <Alan
              etiket="Öğretmen PIN'i"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••••••"
              value={pin}
              onChange={(o) => setPin(o.target.value)}
              ipucu="En az 8 hane. Beş hatalı denemeden sonra 15 dakika kilitlenir."
            />
          )}

          <Buton vurgu="birincil" olcek="genis" type="submit" disabled>
            Giriş yap
          </Buton>
          <p className="text-center text-kucuk text-kursun-koyu">
            Giriş, veri modeli kurulduğunda açılacak.
          </p>
        </form>

        <Link to="/" className="mt-8 text-kucuk text-murekkep-500 underline underline-offset-4">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  )
}
