import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SekizOrgu } from '@/components/marka/SekizOrgu'
import { Muhur } from '@/components/marka/Muhur'
import { OkulAdi } from '@/components/marka/OkulAdi'
import { Aktorler, Yetenekler, Kazanc } from '@/components/tanitim/Bolumler'

/**
 * AÇILIŞ EKRANI
 *
 * Tasarım kararı: Kurumsal çıpa mühürdür; ekranı o açar. Gözün gideceği ilk yer
 * okul mührü, hemen ardından iki satırlık okul adı, sonra platformun adı.
 * SEKİZ wordmark mührü ezmez — marka okulun içinde yaşar, onun önünde değil.
 *
 * Ekranda markanın fikrini ANLATAN cümle yoktur. 8 → ∞ dönüşümü sembolün
 * kendisinde yaşanır; ayrıca yazıyla açıklanması onu zayıflatıyordu.
 */
export function Tanitim() {
  useEffect(() => {
    document.title = 'SEKİZ · Buket Topuzoğlu · Matematik'
  }, [])

  return (
    <div className="min-h-dvh bg-zemin">
      {/* ───────── İlk ekran ───────── */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden">
        <div className="absolute inset-0 text-marka" aria-hidden="true">
          <SekizOrgu />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(110% 65% at 50% 10%, transparent 20%, var(--color-kirec) 78%)',
          }}
          aria-hidden="true"
        />

        <div className="kap relative flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Muhur boyut={176} ekSinif="max-w-[45vw]" />

          <OkulAdi olcek="buyuk" ekSinif="mt-10" />

          {/* İnce ayraç: kurum yukarıda, platform aşağıda. */}
          <span className="mt-10 block h-px w-16 bg-kenar" aria-hidden="true" />

          <div className="mt-10 flex flex-col items-center gap-4">
            <SekizSonsuz boyut="orta" hal="donus" ekSinif="text-vurgu" />
            <Marka olcek="orta" ekSinif="items-center" />
          </div>

          <p className="mt-8 olcu text-govde text-metin-ikincil">
            Ödevler, çözümler ve notlar tek yerde. Öğrenci, veli ve öğretmen aynı sayfada.
          </p>

          <Link
            to="/giris"
            className="mt-10 inline-flex min-h-11 items-center rounded-md bg-marka px-8 py-3 text-kucuk font-semibold text-tebesir transition-colors duration-150 hover:bg-lacivert-duman"
          >
            Giriş yap
          </Link>

          <p className="mt-16 text-etiket text-metin-ikincil">Aşağı kaydırın</p>
        </div>
      </section>

      <Aktorler />
      <Kazanc />
      <Yetenekler />

      {/* ───────── Kürsü ───────── */}
      <section className="border-t border-kenar py-24">
        <div className="kap flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-16">
          <Muhur boyut={112} ekSinif="shrink-0" />
          <div>
            <p className="text-etiket text-vurgu">KÜRSÜ</p>
            <h2 className="mt-4 font-marka text-ekran leading-none">Buket Topuzoğlu</h2>
            <p className="mt-2 text-kucuk text-metin-ikincil">
              Matematik Öğretmeni · Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi
            </p>
            <p className="mt-6 olcu text-govde text-metin-ikincil">
              SEKİZ'i, kendi sınıflarında her gün karşılaştığı bir ihtiyaçtan yola çıkarak
              kurdu: ödevin verilmesi, çözülmesi ve konuşulması arasındaki mesafeyi
              kapatmak. Platformdaki her karar bir sınıfta sınandı.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-kenar py-12">
        <div className="kap flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Muhur boyut={56} />
            <OkulAdi olcek="kucuk" />
          </div>
          <Marka />
        </div>
      </footer>
    </div>
  )
}
