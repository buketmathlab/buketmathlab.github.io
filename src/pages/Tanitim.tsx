import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Marka } from '@/components/marka/Marka'
import { MarkaAfis } from '@/components/marka/MarkaAfis'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'
import { SekizOrgu } from '@/components/marka/SekizOrgu'
import { Muhur } from '@/components/marka/Muhur'
import { Aktorler, Yetenekler, Kazanc } from '@/components/tanitim/Bolumler'

/**
 * AÇILIŞ EKRANI
 *
 * Tasarım kararı: İlk ekranda kart yok, üç kutu yok, özellik listesi yok.
 * Yalnız markanın kendisi var: afiş ölçeğinde wordmark, üstünde 8 sembolü,
 * arkada çok soluk sekiz örgüsü. Gözün gideceği ilk yer wordmark; ikincil bilgi
 * tek cümlelik tanım; eylem tek.
 *
 * Zemin kireç beyazı — lacivert yalnız tipografide ve aşağıdaki tek koyu
 * bölümde görünür. Aşağı kaydırdıkça anlatı açılır ve her bölüm bir soruya
 * cevap verir: kim var, ne yapar, öğretmen ne kazanır, arkasında kim var.
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
        {/* Örgü aşağı doğru kirece karışır: doku var, zemin ferah kalır. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 70% at 50% 0%, transparent 25%, var(--color-kirec) 80%)',
          }}
          aria-hidden="true"
        />

        <div className="kap relative flex flex-1 flex-col py-8">
          <div className="flex items-start gap-3">
            <Muhur boyut={32} ekSinif="shrink-0" />
            <span className="text-etiket text-metin-ikincil">
              Beşiktaş · Arnavutköy Korkmaz Yiğit Anadolu Lisesi
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-center py-12">
            <SekizSonsuz boyut="afis" hal="donus" ekSinif="text-vurgu" />
            <h1 className="mt-6 text-marka">
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
                  className="inline-flex min-h-11 items-center rounded-md bg-marka px-6 py-3 text-kucuk font-semibold text-tebesir transition-colors duration-150 hover:bg-lacivert-duman"
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
        <div className="kap flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
