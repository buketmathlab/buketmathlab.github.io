import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cikisYap, kimlikGetir, kodlaGir, pinleGir, type Kimlik } from '@/lib/oturum'

type OturumDurumu = {
  kimlik: Kimlik | null
  yukleniyor: boolean
  kodlaGiris: (kod: string) => Promise<void>
  pinleGiris: (pin: string) => Promise<void>
  cikis: () => Promise<void>
}

const OturumBaglami = createContext<OturumDurumu | null>(null)

/** Oturum durumunu tüm uygulamaya taşır. Açılışta jetonu sunucuya doğrulatır. */
export function OturumSaglayici({ children }: { children: ReactNode }) {
  const [kimlik, setKimlik] = useState<Kimlik | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    let iptal = false
    kimlikGetir()
      .then((sonuc) => {
        if (!iptal) setKimlik(sonuc)
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false)
      })
    return () => {
      iptal = true
    }
  }, [])

  const kodlaGiris = useCallback(async (kod: string) => {
    setKimlik(await kodlaGir(kod))
  }, [])

  const pinleGiris = useCallback(async (pin: string) => {
    setKimlik(await pinleGir(pin))
  }, [])

  const cikis = useCallback(async () => {
    await cikisYap()
    setKimlik(null)
  }, [])

  const deger = useMemo<OturumDurumu>(
    () => ({ kimlik, yukleniyor, kodlaGiris, pinleGiris, cikis }),
    [kimlik, yukleniyor, kodlaGiris, pinleGiris, cikis],
  )

  return <OturumBaglami.Provider value={deger}>{children}</OturumBaglami.Provider>
}

export function useOturum(): OturumDurumu {
  const deger = useContext(OturumBaglami)
  if (!deger) throw new Error('useOturum, OturumSaglayici içinde kullanılmalı.')
  return deger
}
