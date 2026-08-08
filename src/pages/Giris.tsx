import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { Muhur } from '@/components/marka/Muhur'
import { Alan } from '@/components/ui/Alan'
import { Buton } from '@/components/ui/Buton'
import { HataDurumu } from '@/components/ui/HataDurumu'
import { useOturum } from '@/hooks/useOturum'

type Kapi = 'kod' | 'ogretmen'

/**
 * Giriş ekranı.
 *
 * Tasarım kararı: İki ayrı kapı var ama ekran tek. Öğrenci ve veli aynı kod
 * alanını kullanır — kodun kime ait olduğuna sunucu karar verir, istemci
 * "ben veliyim" diyemez. Gözün gideceği ilk yer kod alanı; kullanıcıların
 * neredeyse tamamı oradan girer.
 */
export function Giris() {
  const { kimlik, kodlaGiris, pinleGiris } = useOturum()
  const [kapi, setKapi] = useState<Kapi>('kod')
  const [deger, setDeger] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  if (kimlik) return <Navigate to="/panel" replace />

  async function gonder(olay: React.FormEvent) {
    olay.preventDefault()
    setHata(null)
    setBekliyor(true)
    try {
      if (kapi === 'kod') {
        await kodlaGiris(deger)
      } else {
        await pinleGiris(deger)
      }
    } catch (sorun) {
      setHata(sorun instanceof Error ? sorun.message : 'Giriş yapılamadı.')
      setBekliyor(false)
    }
  }

  function kapiDegistir(yeni: Kapi) {
    setKapi(yeni)
    setDeger('')
    setHata(null)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zemin px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Muhur boyut={72} />
        <Marka olcek="orta" ekSinif="mt-8 items-center text-center" />

        <div
          className="mt-10 flex w-full rounded-md border border-kenar bg-yuzey-yuksek p-1"
          role="tablist"
          aria-label="Giriş yöntemi"
        >
          {(
            [
              ['kod', 'Öğrenci / Veli'],
              ['ogretmen', 'Öğretmen'],
            ] as const
          ).map(([secenek, etiket]) => (
            <button
              key={secenek}
              type="button"
              role="tab"
              aria-selected={kapi === secenek}
              onClick={() => kapiDegistir(secenek)}
              className={
                'min-h-11 flex-1 rounded-sm text-kucuk font-semibold transition-colors duration-150 ' +
                (kapi === secenek
                  ? 'bg-yuzey text-metin shadow-kart'
                  : 'text-metin-ikincil hover:text-metin')
              }
            >
              {etiket}
            </button>
          ))}
        </div>

        <form className="mt-6 flex w-full flex-col gap-4" onSubmit={gonder}>
          {kapi === 'kod' ? (
            <Alan
              etiket="Giriş kodun"
              name="kod"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ör. K7M2-P4RT"
              value={deger}
              onChange={(o) => setDeger(o.target.value)}
              ipucu="Kodu öğretmeninden aldığın kartın üzerinde bulabilirsin."
            />
          ) : (
            <Alan
              etiket="Öğretmen PIN'i"
              name="pin"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={deger}
              onChange={(o) => setDeger(o.target.value)}
              ipucu="En az 8 hane. Beş hatalı denemeden sonra 15 dakika kilitlenir."
            />
          )}

          {hata && <HataDurumu mesaj={hata} />}

          <Buton
            vurgu="birincil"
            olcek="genis"
            type="submit"
            bekliyor={bekliyor}
            disabled={deger.trim().length === 0}
          >
            {bekliyor ? 'Giriş yapılıyor' : 'Giriş yap'}
          </Buton>
        </form>

        <Link to="/" className="mt-8 text-kucuk text-metin-ikincil underline underline-offset-4 hover:text-vurgu">
          Ana sayfaya dön
        </Link>

        {/* Okul kimliği: üstte ilçe, altında okul adı — açılış sayfasındakiyle aynı blok. */}
        <div className="mt-12 text-center text-metin-ikincil">
          <p className="text-etiket">Beşiktaş</p>
          <p className="mt-1 text-kucuk">Arnavutköy Korkmaz Yiğit Anadolu Lisesi</p>
        </div>
      </div>
    </div>
  )
}
