import type { ReactNode } from 'react'
import { SelcukluYildizi } from '@/components/marka/SelcukluYildizi'

type Ozellikler = {
  baslik: string
  /** Ne yapılacağını söyleyen tek cümle. "Veri yok" yazmak yasak. */
  aciklama: string
  /** Kullanıcıyı ilk adıma çağıran düğme. */
  eylem?: ReactNode
}

/**
 * Boş ekran bir davettir.
 * Tasarım kararı: Ekranın tek işi kullanıcıyı ilk adıma çağırmak. Gözün gideceği
 * ilk yer başlık, ikincil bilgi açıklama, eylem en altta ve tek.
 * İllüstrasyon ince çizgili Selçuklu yıldızıdır — markanın geometrisi.
 */
export function BosDurum({ baslik, aciklama, eylem }: Ozellikler) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <SelcukluYildizi boyut={88} ekSinif="text-kenar-koyu" />
      <h3 className="mt-6 text-b2">{baslik}</h3>
      <p className="mt-2 max-w-sm text-govde text-kursun-koyu">{aciklama}</p>
      {eylem && <div className="mt-6">{eylem}</div>}
    </div>
  )
}
