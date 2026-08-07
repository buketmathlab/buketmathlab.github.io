import { Sayfa } from '@/components/duzen/Sayfa'
import { PanoOrnegi, type Palet } from '@/components/tasarim/PanoOrnegi'

/**
 * Palet çalışması — üç yön, aynı ekran.
 *
 * Tasarım kararı: Renk kararı renk lekelerine bakarak verilmez. Aynı sınıf
 * panosu üç palette de çizilir; karar, ekranın kendisine bakılarak verilir.
 * Onaydan sonra seçilen palet token'lara işlenecek ve bu sayfa kaldırılacaktır.
 *
 * Oran disiplini her üçünde de aynı: %60 nötr (kağıt, mürekkep metin),
 * %30 kurumsal lacivert (üst bar, başlık, birincil düğme), %10 canlı
 * (ilerleme dolgusu, etkin sekme çizgisi, puan anı, seri rozeti).
 */

export const paletler: readonly Palet[] = [
  {
    kod: 'cini',
    ad: 'A · ÇİNİ',
    karakter:
      'Aydınlık ve iyimser. Serin turkuazın üstüne sıcak safran düşer — İznik çinisinin kendi ikilisi. Sabah dersi gibi: uyanık ama bağırmayan.',
    murekkep: '#16233F',
    kagit: '#F7F5F0',
    yuzey: '#EFE9DE',
    kursun: '#5A6376',
    canli: '#17A8B0',
    canliMetin: '#0B7178',
    ikinci: '#F0C169',
    ikinciMetin: '#8A6A22',
  },
  {
    kod: 'mine',
    ad: 'B · MİNE',
    karakter:
      'Serin ve iddialı. Patlıcan moru ile firuze, tezhibin gece tarafı. En "havalı" olan: 17 yaşındaki bir öğrencinin ekran görüntüsünü paylaşacağı palet.',
    murekkep: '#16233F',
    kagit: '#F6F5F4',
    yuzey: '#E9E7E4',
    kursun: '#5A6376',
    canli: '#6E2D63',
    canliMetin: '#6E2D63',
    ikinci: '#7FDDE2',
    ikinciMetin: '#0B7178',
  },
  {
    kod: 'nar',
    ad: 'C · NAR',
    karakter:
      'Yüksek nabız. Nar çiçeğinin pembe-kırmızısı firuzeyle çarpışır. Üçünün en genci ve en cesuru; kurumsal zemin olmasa fazla gelirdi.',
    murekkep: '#16233F',
    kagit: '#F7F5F0',
    yuzey: '#EFE9DE',
    kursun: '#5A6376',
    canli: '#C22E62',
    canliMetin: '#A8264F',
    ikinci: '#8FE0E4',
    ikinciMetin: '#0B7178',
  },
]

export function PaletDenemesi() {
  return (
    <Sayfa
      baslik="Palet çalışması"
      aciklama="Üç yön, aynı sınıf panosu. Renkler henüz token'lara işlenmedi — siz seçtikten sonra işlenecek. Her üçünde de oran aynı: %60 nötr, %30 lacivert, %10 canlı."
    >
      <div className="flex flex-col gap-8">
        {paletler.map((p) => (
          <section key={p.kod} className="border-t border-kenar pt-6">
            <h2 className="font-baslik text-b2">{p.ad}</h2>
            <p className="mt-2 text-govde text-kursun-koyu olcu">{p.karakter}</p>

            <ul className="mt-4 flex flex-wrap gap-2" role="list">
              {(
                [
                  ['Mürekkep Laciverti', p.murekkep],
                  ['Kağıt', p.kagit],
                  ['Sıva', p.yuzey],
                  ['Kurşun Kalem', p.kursun],
                  [p.kod === 'cini' ? 'Çini Turkuazı' : p.kod === 'mine' ? 'Patlıcan Moru' : 'Nar Çiçeği', p.canli],
                  [p.kod === 'cini' ? 'Safran' : 'Firuze', p.ikinci],
                ] as const
              ).map(([ad, hex]) => (
                <li key={ad} className="w-28">
                  <span
                    className="block h-10 rounded-sm border border-kenar"
                    style={{ background: hex }}
                    aria-hidden="true"
                  />
                  <span className="mt-1 block text-etiket text-murekkep">{ad}</span>
                  <span className="block font-mono text-kucuk text-kursun-koyu">{hex}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 max-w-md">
              <PanoOrnegi p={p} />
            </div>
          </section>
        ))}
      </div>
    </Sayfa>
  )
}
