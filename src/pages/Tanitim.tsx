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

        {/*
         * Markanın tezi (8 → ∞) yukarıdaki işarette zaten yaşanıyor; bir de cümleyle
         * anlatmak onu zayıflatır. Bu yüzden burada slogan yok, ne olduğunu söyleyen
         * iki kısa cümle var.
         */}
        <p className="mt-8 max-w-md text-govde text-kursun-koyu">
          Ödevler, çözümler ve notlar tek yerde. Öğrenci, veli ve öğretmen aynı sayfada.
        </p>

        <Link
          to="/giris"
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-murekkep px-6 py-3 text-govde font-semibold text-kagit transition-colors duration-150 hover:bg-murekkep-700"
        >
          Giriş yap
        </Link>
      </main>

      {/*
       * Okul kimliği iki satır: üstte ilçe, altında okul adı. Mührün kendi
       * düzeni de böyledir (alt yayda BEŞİKTAŞ, çevresinde okul adı).
       * "Matematik" burada tekrar edilmez — kilit satırında zaten yazıyor.
       */}
      <footer className="border-t border-kenar px-4 py-6 text-center text-kursun-koyu">
        <p className="text-etiket">Beşiktaş</p>
        <p className="mt-1 text-kucuk">Arnavutköy Korkmaz Yiğit Anadolu Lisesi</p>
      </footer>
    </div>
  )
}
