import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Tanitim } from '@/pages/Tanitim'
import { Giris } from '@/pages/Giris'
import { Bulunamadi } from '@/pages/Bulunamadi'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { KurulumUyarisi } from '@/components/duzen/KurulumUyarisi'
import { ortam } from '@/lib/ortam'

// Performans bütçesi: yalnız öğretmenin göreceği ekranlar tembel yüklenir.
const TasarimSistemi = lazy(() =>
  import('@/pages/TasarimSistemi').then((m) => ({ default: m.TasarimSistemi })),
)

function SayfaBekleme() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-kagit text-murekkep">
      <SekizSonsuz boyut="buyuk" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      {!ortam.hazir && <KurulumUyarisi eksikler={ortam.eksikler} />}
      <Suspense fallback={<SayfaBekleme />}>
        <Routes>
          <Route path="/" element={<Tanitim />} />
          <Route path="/giris" element={<Giris />} />
          <Route path="/tasarim" element={<TasarimSistemi />} />
          <Route path="*" element={<Bulunamadi />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
