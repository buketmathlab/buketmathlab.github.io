import type { ReactNode } from 'react'
import { SekizSonsuz } from '@/components/marka/SekizSonsuz'

type Ozellikler = {
  baslik: string
  /** Ne yapılacağını söyleyen tek cümle. "Veri yok" yazmak yasak. */
  aciklama: string
  eylem?: ReactNode
}

/**
 * Boş ekran bir davettir.
 *
 * İllüstrasyon yok, çizim yok: markanın kendi sembolü duruyor. Boş bir ekranda
 * 8 hareketsizdir — hikâye henüz başlamamıştır. İlk kayıt girildiğinde ekran
 * dolar ve sembol yalnız bekleme anlarında, dönerken görünür.
 */
export function BosDurum({ baslik, aciklama, eylem }: Ozellikler) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <SekizSonsuz boyut="buyuk" duragan ekSinif="text-kenar" />
      <h3 className="mt-8 text-b2 font-semibold">{baslik}</h3>
      <p className="mt-2 max-w-sm text-kucuk text-metin-ikincil">{aciklama}</p>
      {eylem && <div className="mt-8">{eylem}</div>}
    </div>
  )
}
