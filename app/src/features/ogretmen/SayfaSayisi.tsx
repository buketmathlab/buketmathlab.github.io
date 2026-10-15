import { Field, Input } from '@/components/ui/Field';
import { EN_FAZLA_SAYFA } from '@/lib/cozum-sayfalari';

type Props = {
  /** Metin kutusunun değeri (boş olabilir: PDF yoksa öğretmen yazar). */
  deger: string;
  onDegis: (v: string) => void;
  /** Soru PDF'inden sayılan sayfa; PDF yoksa null. */
  pdfSayfa: number | null;
  hata?: string | null;
  /** Gönderim başladıysa sayı değişmez (0078, sunucu da reddediyor). */
  kilitli?: boolean;
};

/**
 * Ödevin sayfa sayısı (0078) — öğrencinin TAM bu kadar sayfa göndereceği.
 *
 * Öğretmenin isteği: "Verdiğim ödev kaç sayfalık ödevse otomatik olarak o
 * kadar sayfa gönderim hakkına sahip olsun öğrenciler." Kararları:
 *   • Sayı soru PDF'inden OTOMATİK gelir, öğretmen DÜZELTEBİLİR (kapak ya da
 *     açıklama sayfası çözüm gerektirmeyebilir).
 *   • Soru PDF'i yoksa sayıyı öğretmen yazar; boşken kayıt yapılmaz.
 *
 * Oluşturma ve düzenleme ekranlarının ortak parçası (eski
 * `SayfaSiniriSecimi`nin yerini aldı): metin iki yerde kopyalanırsa biri
 * değişip diğeri kalır.
 */
export function SayfaSayisi({ deger, onDegis, pdfSayfa, hata, kilitli }: Props) {
  const ipucu = kilitli
    ? 'Bu ödeve gönderim yapıldı; öğrencilerin hepsi aynı kurala tabi kalsın diye sayfa sayısı artık değiştirilemez.'
    : pdfSayfa !== null
      ? `Soru PDF’i ${pdfSayfa} sayfa; sayı oradan geldi. Kapak ya da açıklama sayfası gibi çözüm gerektirmeyen bir sayfa varsa düzeltin. Öğrenciler her sayfanın çözümünü göndermek zorundadır.`
      : 'Ödevin kaç sayfa olduğunu yazın. Öğrenciler her sayfanın çözümünü ayrı ayrı göndermek zorundadır.';
  return (
    <Field etiket="Ödevin sayfa sayısı" ipucu={ipucu} zorunlu {...(hata ? { hata } : {})}>
      {(k) => (
        <Input
          {...k}
          type="number"
          inputMode="numeric"
          min={1}
          max={EN_FAZLA_SAYFA}
          value={deger}
          disabled={kilitli}
          onChange={(e) => onDegis(e.target.value)}
        />
      )}
    </Field>
  );
}
