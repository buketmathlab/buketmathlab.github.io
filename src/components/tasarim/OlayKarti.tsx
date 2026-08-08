import { Rozet } from '@/components/ui/Rozet'

/**
 * OLAY KARTI — enerjinin patladığı tek an
 *
 * Tasarım kararı: Bu kartın tek işi bir saniyeyi işaretlemek — puanın
 * açıklandığı an. Gözün gideceği ilk yer sayı; ikincil bilgi konu ve rozet.
 * Nar yalnız burada bu yoğunlukta görünür. Olay geçtikten sonra aynı bilgi
 * sıradan kartta, sakin renkle durur — karşılaştırması tasarım sistemindedir.
 */
export function OlayKarti() {
  return (
    <section className="animate-belir rounded-lg border border-nar/25 bg-nar-sis p-4">
      <p className="text-etiket text-vurgu">PUANIN AÇIKLANDI</p>
      <p className="mt-4 font-marka text-rakam text-vurgu">86</p>
      <p className="mt-3 text-kucuk text-metin">
        Türev · 1. ödev · 12 doğru, 2 yanlış, 1 boş
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Rozet ton="odul">KONU TAMAMLANDI</Rozet>
        <Rozet ton="notr">CEVAP ANAHTARI AÇILDI</Rozet>
      </div>
    </section>
  )
}
