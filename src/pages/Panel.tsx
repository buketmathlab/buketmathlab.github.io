import { Navigate } from 'react-router-dom'
import { Sayfa } from '@/components/duzen/Sayfa'
import { Kart } from '@/components/ui/Kart'
import { Buton } from '@/components/ui/Buton'
import { Rozet } from '@/components/ui/Rozet'
import { useOturum } from '@/hooks/useOturum'

const rolAdi = { ogretmen: 'Öğretmen', ogrenci: 'Öğrenci', veli: 'Veli' } as const

/**
 * Geçici panel — Faz 1'in doğrulama ekranı.
 *
 * Tek işi: girişin gerçekten çalıştığını ve sunucunun kimliği doğru
 * belirlediğini göstermek. Öğretmen panosu Faz 2'de, öğrenci ve veli ekranları
 * Faz 3'te bu sayfanın yerini alacak.
 */
export function Panel() {
  const { kimlik, yukleniyor, cikis } = useOturum()

  if (yukleniyor) return null
  if (!kimlik) return <Navigate to="/giris" replace />

  return (
    <Sayfa
      baslik={`Hoş geldiniz, ${kimlik.ad}`}
      aciklama="Oturumunuz açık. Ekranlar sıradaki fazlarda bu panelin yerine geçecek."
      yan={
        <Buton vurgu="ikincil" onClick={() => void cikis()}>
          Çıkış yap
        </Buton>
      }
    >
      <Kart baslik="Oturum bilgisi">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-govde">
          <dt className="text-etiket text-metin-ikincil">Rol</dt>
          <dd>{rolAdi[kimlik.rol]}</dd>

          {kimlik.ogrenci_no && (
            <>
              <dt className="text-etiket text-metin-ikincil">Öğrenci no</dt>
              <dd>{kimlik.ogrenci_no}</dd>
            </>
          )}

          {kimlik.tip && (
            <>
              <dt className="text-etiket text-metin-ikincil">Öğrenci tipi</dt>
              <dd>
                <Rozet ton={kimlik.tip === 'ozel' ? 'vurgu' : 'notr'}>
                  {kimlik.tip === 'ozel' ? 'Özel ders' : 'Okul öğrencisi'}
                </Rozet>
              </dd>
            </>
          )}
        </dl>
      </Kart>
    </Sayfa>
  )
}
