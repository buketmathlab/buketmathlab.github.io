import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Muhur } from '@/components/marka/Muhur'
import { KilitSatiri } from '@/components/marka/KilitSatiri'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'

/**
 * Giriş kapısı (tanıtım sayfası Faz 6'da bu sayfanın üzerine kurulacak).
 *
 * Tasarım kararı: Ekranın tek işi kullanıcıyı doğru kapıya yöneltmek.
 * Gözün gideceği ilk yer marka bloğu, ikincil bilgi tek cümlelik tanım,
 * eylem tek: "Giriş yap". Açılışta markanın tezi görünür — 8'in ∞'a dönüşü.
 */
export function Tanitim() {
  useEffect(() => {
    document.title = 'SEKİZ · Buket Topuzoğlu · Matematik'
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-kagit">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <SekizSonsuz boyut="buyuk" etiket="SEKİZ" ekSinif="text-murekkep" />

        <div className="mt-8 flex flex-col items-center gap-4">
          <Muhur boyut={72} />
          <KilitSatiri olcek="buyuk" ekSinif="items-center" />
        </div>

        <p className="mt-8 max-w-md text-govde text-kursun-koyu">
          Ödevler, çözümler ve gelişim tek yerde. Sekiz, yatay çevrildiğinde sonsuz olur —
          öğrenmenin sınırı yoktur.
        </p>

        <Link
          to="/giris"
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-murekkep px-6 py-3 text-govde font-semibold text-kagit transition-colors duration-150 hover:bg-murekkep-700"
        >
          Giriş yap
        </Link>
      </main>

      <footer className="border-t border-kenar px-4 py-6 text-center text-kucuk text-kursun-koyu">
        <p>Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi · Matematik</p>
      </footer>
    </div>
  )
}
