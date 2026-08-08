import { Sayfa } from '@/components/duzen/Sayfa'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { OranSeridi } from '@/components/ornek/OranSeridi'
import { gezinme } from '@/lib/gezinme'
import { ogretmeninGunu } from '@/lib/ornekVeri'
import { sayi } from '@/lib/bicim'

/**
 * ÖĞRETMEN — BUGÜN
 *
 * Tasarım kararı: Bu ekranın tek işi "bugün ilgilenmem gereken ne var?"
 * sorusunu ilk beş saniyede cevaplamak. Bu yüzden on kart yok, grafik yok:
 * tek kolon, aciliyet sırasına dizilmiş üç blok var. Gözün gideceği ilk yer
 * onay bekleyen sayısı; ikincil bilgi sınıfların nabzı; geri kalan her şey
 * gezinmede.
 *
 * Sayılar serif ve büyük — öğretmen iPad'i masaya koyup uzaktan bakabilmeli.
 */
export function OgretmenBugun() {
  const { onayBekleyen, yeniGonderim, suresiDolan, siniflar } = ogretmeninGunu

  return (
    <Sayfa
      ustEtiket="ÖĞRETMEN"
      baslik="Bugün"
      aciklama="7 Ekim Salı. Sizi bekleyen üç iş var."
      ogeler={gezinme('ogretmen')}
      aktif="bugun"
      yan={<Buton vurgu="birincil">Ödev ver</Buton>}
    >
      <div className="flex flex-col gap-12">
        {/* 1 — Sizden imza bekleyen */}
        <section>
          <header className="mb-4 flex items-baseline gap-3">
            <span className="font-marka text-rakam text-vurgu">{onayBekleyen.length}</span>
            <h2 className="text-b2">açık uçlu gönderim imzanızı bekliyor</h2>
          </header>
          <ul className="divide-y divide-kenar border-y border-kenar" role="list">
            {onayBekleyen.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="font-semibold">{g.ogrenci}</span>
                <Rozet>{g.sinif}</Rozet>
                <span className="text-kucuk text-metin-ikincil">{g.odev}</span>
                <Buton vurgu="ikincil" className="ml-auto">
                  Puanla
                </Buton>
              </li>
            ))}
          </ul>
        </section>

        {/* 2 — Yeni gelenler */}
        <section>
          <h2 className="text-b2">Yeni gönderimler</h2>
          <p className="mt-3 olcu text-govde text-metin-ikincil">
            Son giriş yaptığınızdan beri <strong className="text-metin">{sayi(yeniGonderim.sayi)}</strong>{' '}
            gönderim geldi ({yeniGonderim.sinif}). Sonuncusu {yeniGonderim.sonSaat}'de.
            Testler kendiliğinden puanlandı; açık uçlular yukarıda sizi bekliyor.
          </p>
        </section>

        {/* 3 — Süresi dolanlar */}
        <section>
          <h2 className="text-b2">Süresi dolan ödevler</h2>
          <ul className="mt-4 divide-y divide-kenar border-y border-kenar" role="list">
            {suresiDolan.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="font-semibold">{o.odev}</span>
                <Rozet>{o.sinif}</Rozet>
                <span className="text-kucuk text-metin-ikincil">
                  {sayi(o.yapmayan)} öğrenci yapmadı
                </span>
                <Buton vurgu="sessiz" className="ml-auto">
                  Kimler yapmadı
                </Buton>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 — Sınıfların nabzı */}
        <section>
          <h2 className="text-b2">Sınıflar</h2>
          <ul className="mt-4 flex flex-col gap-4" role="list">
            {siniflar.map((s) => (
              <li key={s.ad}>
                <OranSeridi
                  ad={s.ad}
                  altMetin={`${sayi(s.ogrenci)} öğrenci · ortalama ${sayi(s.ortalama, 1)}`}
                  oran={s.oran}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sayfa>
  )
}
