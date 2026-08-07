import { Link } from 'react-router-dom'
import { Sayfa } from '@/components/duzen/Sayfa'
import { BosDurum } from '@/components/ui/BosDurum'

/** Bilinmeyen adres. Hata özür dilemez; ne olduğunu ve ne yapılacağını söyler. */
export function Bulunamadi() {
  return (
    <Sayfa baslik="Bu sayfa yok">
      <BosDurum
        baslik="Aradığınız sayfa bulunamadı"
        aciklama="Adres değişmiş ya da yanlış yazılmış olabilir. Ana sayfadan devam edin."
        eylem={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-md bg-murekkep px-6 py-3 text-govde font-semibold text-kagit"
          >
            Ana sayfaya dön
          </Link>
        }
      />
    </Sayfa>
  )
}
