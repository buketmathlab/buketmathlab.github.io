import { Rozet } from '@/components/ui/Rozet'

/**
 * OLAY KARTI — enerjinin patladığı tek an
 *
 * Tasarım kararı: Bu kartın tek işi bir saniyeyi işaretlemek — puanın
 * açıklandığı an. Gözün gideceği ilk yer sayı; ikincil bilgi konu ve rozet.
 * Camgöbeği yalnız burada ışır (gölge token'ı `--shadow-vurgu` tüm sistemde
 * tek bir yerde kullanılır). Olay geçtikten sonra aynı bilgi sıradan kartta,
 * sakin renkle görünür.
 */
export function OlayKarti() {
  return (
    <section
      className="animate-belir rounded-lg border border-vurgu/30 bg-camgobegi-sis p-4"
      style={{ boxShadow: 'var(--shadow-vurgu)' }}
    >
      <p className="text-etiket text-vurgu">PUANIN AÇIKLANDI</p>
      <p className="mt-4 font-marka text-rakam text-vurgu">86</p>
      <p className="mt-3 text-kucuk text-metin">
        Türev · 1. ödev · 12 doğru, 2 yanlış, 1 boş
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Rozet ton="vurgu">KONU TAMAMLANDI</Rozet>
        <Rozet ton="notr">CEVAP ANAHTARI AÇILDI</Rozet>
      </div>
    </section>
  )
}
