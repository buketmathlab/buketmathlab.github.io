import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { Muhur } from '@/components/marka/Muhur'
import { OkulAdi } from '@/components/marka/OkulAdi'
import { Alan } from '@/components/ui/Alan'
import { Buton } from '@/components/ui/Buton'
import { HataDurumu } from '@/components/ui/HataDurumu'
import { useOturum } from '@/hooks/useOturum'
import { sinif } from '@/lib/sinif'
import type { Rol } from '@/types'

const kapilar: ReadonlyArray<{ rol: Rol; ad: string }> = [
  { rol: 'ogrenci', ad: 'Öğrenci' },
  { rol: 'veli', ad: 'Veli' },
  { rol: 'ogretmen', ad: 'Öğretmen' },
]

const alanMetni: Record<Rol, { etiket: string; ipucu: string; ornek: string }> = {
  ogrenci: {
    etiket: 'Öğrenci kodun',
    ipucu: 'Kodu öğretmeninden aldığın kartın üzerinde bulabilirsin.',
    ornek: 'ör. K7M2-P4RT',
  },
  veli: {
    etiket: 'Veli kodunuz',
    ipucu: 'Veli kodu öğrencininkinden farklıdır; kartın alt bölümünde yazar.',
    ornek: 'ör. T3XA-9BQD',
  },
  ogretmen: {
    etiket: "Öğretmen PIN'i",
    ipucu: 'En az 8 hane. Beş hatalı denemeden sonra 15 dakika kilitlenir.',
    ornek: '••••••••',
  },
}

/**
 * GİRİŞ EKRANI
 *
 * Tasarım kararı: Üç kullanıcının üç ayrı sekmesi var. Öğrenci ve veli aynı
 * alanı paylaşmıyor artık — veli "benim yerim neresi?" diye düşünmüyor ve
 * yanlış kodu yapıştırdığında ne olduğunu anlıyor.
 *
 * Rolü yine SUNUCU belirler; sekme yalnız beklentiyi söyler. Sekme ile sunucunun
 * döndürdüğü rol uyuşmazsa oturum hemen kapatılır ve ne yapılacağı yazılır.
 * Böylece sekme bir yetki iddiası değil, bir yön levhası olur.
 *
 * Kurumsal çıpa mühürdür: ekranı o açar, okul adı iki satır hâlinde altında durur.
 */
export function Giris() {
  const { kimlik, kodlaGiris, pinleGiris, cikis } = useOturum()
  const [kapi, setKapi] = useState<Rol>('ogrenci')
  const [deger, setDeger] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  if (kimlik) return <Navigate to="/panel" replace />

  const metin = alanMetni[kapi]

  async function gonder(olay: React.FormEvent) {
    olay.preventDefault()
    setHata(null)
    setBekliyor(true)
    try {
      if (kapi === 'ogretmen') {
        await pinleGiris(deger)
        return
      }
      const giren = await kodlaGiris(deger)
      if (giren.rol !== kapi) {
        // Kod geçerli ama başka bir kapıya ait: oturumu kapat, yönünü söyle.
        await cikis()
        const dogru = giren.rol === 'ogrenci' ? 'Öğrenci' : 'Veli'
        setHata(`Bu kod ${dogru.toLocaleLowerCase('tr')} kodu. "${dogru}" sekmesinden gir.`)
        setBekliyor(false)
      }
    } catch (sorun) {
      setHata(sorun instanceof Error ? sorun.message : 'Giriş yapılamadı.')
      setBekliyor(false)
    }
  }

  function kapiDegistir(yeni: Rol) {
    setKapi(yeni)
    setDeger('')
    setHata(null)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zemin px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Muhur boyut={128} ekSinif="max-w-[38vw]" />
        <OkulAdi olcek="orta" ekSinif="mt-8 items-center" />

        <span className="mt-8 block h-px w-12 bg-kenar" aria-hidden="true" />
        <Marka olcek="kucuk" ekSinif="mt-8 items-center" />

        <div
          className="mt-10 flex w-full rounded-md border border-kenar bg-yuzey-yuksek p-1"
          role="tablist"
          aria-label="Giriş yöntemi"
        >
          {kapilar.map(({ rol, ad }) => (
            <button
              key={rol}
              type="button"
              role="tab"
              aria-selected={kapi === rol}
              onClick={() => kapiDegistir(rol)}
              className={sinif(
                'min-h-11 flex-1 rounded-sm text-kucuk font-semibold transition-colors duration-150',
                kapi === rol
                  ? 'bg-yuzey text-metin shadow-kart'
                  : 'text-metin-ikincil hover:text-metin',
              )}
            >
              {ad}
            </button>
          ))}
        </div>

        <form className="mt-6 flex w-full flex-col gap-4 text-left" onSubmit={gonder}>
          <Alan
            key={kapi}
            etiket={metin.etiket}
            name={kapi === 'ogretmen' ? 'pin' : 'kod'}
            type={kapi === 'ogretmen' ? 'password' : 'text'}
            autoComplete={kapi === 'ogretmen' ? 'current-password' : 'off'}
            {...(kapi === 'ogretmen' ? {} : { autoCapitalize: 'characters', spellCheck: false })}
            placeholder={metin.ornek}
            value={deger}
            onChange={(o) => setDeger(o.target.value)}
            ipucu={metin.ipucu}
          />

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

        <Link
          to="/"
          className="mt-10 text-kucuk text-metin-ikincil underline underline-offset-4 hover:text-vurgu"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  )
}
