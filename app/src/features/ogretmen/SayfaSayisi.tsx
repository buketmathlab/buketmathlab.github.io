import { Field, Input } from "@/components/ui/Field";
import { EN_FAZLA_SAYFA } from "@/lib/cozum-sayfalari";

type Props = {
  /** Metin kutusunun değeri (boş olabilir: PDF yoksa öğretmen yazar). */
  deger: string;
  onDegis: (v: string) => void;
  /** Soru PDF'inden sayılan sayfa; PDF yoksa null. */
  pdfSayfa: number | null;
  hata?: string | null;
  /**
   * Düzenlemede ödevin gönderim sayısı. 0079'dan beri sayı gönderim olsa da
   * değişiyor; öğretmene gönderilmişlerin değişmediği söyleniyor.
   */
  gonderimSayisi?: number;
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
export function SayfaSayisi({
  deger,
  onDegis,
  pdfSayfa,
  hata,
  gonderimSayisi = 0,
}: Props) {
  const ipucu =
    pdfSayfa !== null
      ? `Soru PDF’i ${pdfSayfa} sayfa; sayı oradan geldi. Kapak ya da açıklama sayfası gibi çözüm gerektirmeyen bir sayfa varsa düzeltin. Öğrenciler her sayfanın çözümünü göndermek zorundadır.`
      : "Ödevin kaç sayfa olduğunu yazın. Öğrenciler her sayfanın çözümünü ayrı ayrı göndermek zorundadır.";
  return (
    <>
      <Field
        etiket="Ödevin sayfa sayısı"
        ipucu={ipucu}
        zorunlu
        {...(hata ? { hata } : {})}
      >
        {(k) => (
          <Input
            {...k}
            type="number"
            inputMode="numeric"
            min={1}
            max={EN_FAZLA_SAYFA}
            value={deger}
            onChange={(e) => onDegis(e.target.value)}
          />
        )}
      </Field>
      {gonderimSayisi > 0 && (
        <p className="-mt-2 mb-4 text-[13px] text-ink">
          Bu ödeve <span className="sk-sayi">{gonderimSayisi}</span> gönderim
          yapıldı. Sayfa sayısını değiştirirseniz gönderilmiş çözümler ve
          puanlar değişmez; yeni sayı henüz göndermeyen öğrenciler için geçerli
          olur. Eksik sayfa göndermiş bir öğrencinin gönderimini “Gönderimi
          yeniden aç” ile yeniden gönderime açabilirsiniz.
        </p>
      )}
    </>
  );
}
