import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SekizOrgu } from '@/components/marka/SekizOrgu'
import { MarkaAfis } from '@/components/marka/MarkaAfis'
import { Muhur } from '@/components/marka/Muhur'
import { Aktorler, Yetenekler } from '@/components/tanitim/Bolumler'

/**
 * AÇILIŞ EKRANI
 *
 * Tasarım kararı: Sayfa açıldığında görülen tek şey markanın tezi olmalı —
 * 8'in ∞'a dönüşü. Bu yüzden ilk ekranda kart yok, özellik listesi yok, üç
 * kutu yok. Yalnız büyük tipografi, dönen sembol ve arkada 8'in örgüsü var.
 * Gözün gideceği ilk yer wordmark; ikincil bilgi tek satırlık tanım; tek eylem
 * "Giriş yap".
 *
 * Aşağıya kaydırdıkça anlatı açılır: kim var (üç aktör), ne yapılır (yetenekler),
 * arkasında kim var (kürsü). Her bölümün kendi ritmi var ama hepsi aynı ızgaradan
 * ve aynı ölçekten çıkıyor.
 */
export function Tanitim() {
  useEffect(() => {
    document.title = 'SEKİZ · Buket Topuzoğlu · Matematik'
  }, [])

  return (
    <div className="min-h-dvh bg-zemin">
      {/* ───────── İlk ekran ───────── */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden">
        <div className="absolute inset-0 text-petrol-acik" aria-hidden="true">
          <SekizOrgu />
        </div>
        {/* Örgü aşağı doğru geceye karışır: doku var ama zemin sakin kalır. */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 20%, var(--color-gece) 78%)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
          <div className="flex items-start gap-3">
            <SekizSonsuz boyut="kucuk" duragan ekSinif="shrink-0 text-vurgu" />
            <span className="text-etiket text-metin-ikincil">
              Beşiktaş · Arnavutköy Korkmaz Yiğit Anadolu Lisesi
            </span>
          </div>

          {/* Afiş bloğu: sembol wordmark'ın üstünde ve onun sol kenarına hizalı;
              ikisi tek bir işaret gibi okunur. Wordmark ekranla ölçeklenir. */}
          <div className="flex flex-1 flex-col justify-center py-12">
            <SekizSonsuz
              etiket="SEKİZ"
              ekSinif="text-vurgu"
              boyut="afis"
            />
            <h1 className="mt-6 text-metin">
              <MarkaAfis />
            </h1>

            <div className="mt-10 grid gap-8 sm:grid-cols-2 sm:items-end">
              <p className="text-govde text-metin-ikincil">
                Sekiz yana yattığında sonsuz olur. Ödev, çözüm, gelişim ve iletişim —
                öğrenci, veli ve öğretmen için tek yerde.
              </p>
              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <Link
                  to="/giris"
                  className="inline-flex min-h-11 items-center rounded-md bg-metin px-6 py-3 text-kucuk font-semibold text-zemin transition-colors duration-150 hover:bg-white"
                >
                  Giriş yap
                </Link>
                <span className="text-kucuk text-metin-ikincil">
                  Kodun kartının üzerinde yazıyor.
                </span>
              </div>
            </div>
          </div>

          <p className="text-etiket text-metin-ikincil">Aşağı kaydırın</p>
        </div>
      </section>

      <Aktorler />
      <Yetenekler />

      {/* ───────── Kürsü ───────── */}
      <section className="border-t border-kenar px-4 py-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:gap-16">
          <Muhur boyut={96} ekSinif="shrink-0" />
          <div>
            <p className="text-etiket text-vurgu">KÜRSÜ</p>
            <h2 className="mt-4 font-marka text-ekran leading-none">Buket Topuzoğlu</h2>
            <p className="mt-4 olcu text-govde text-metin-ikincil">
              Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi matematik öğretmeni. SEKİZ'i,
              kendi sınıflarında her gün karşılaştığı bir ihtiyaçtan yola çıkarak kurdu: ödevin
              verilmesi, çözülmesi ve konuşulması arasındaki mesafeyi kapatmak.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-kenar px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Marka />
          <div className="text-kucuk text-metin-ikincil">
            <p className="text-etiket">Beşiktaş</p>
            <p className="mt-1">Arnavutköy Korkmaz Yiğit Anadolu Lisesi</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
