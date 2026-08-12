import { useState } from 'react';
import { Field, Select } from '@/components/ui/Field';
import type { SonSecenek } from '@/lib/cevap-anahtari';

type Props = {
  deger: SonSecenek;
  onDegis: (v: SonSecenek) => void;
};

/**
 * Şık sayısı — bilinçli olarak İKİNCİL bir alan.
 *
 * Öğretmen bildirdi: "Okul öğrencilerimde test hep 5 şıklı, 4 şıklı olan
 * okul öğrencisi yok." Yani 12 sınıfın tamamında bu alanın değeri hep aynı.
 * Her ödevde soru sayısının yanında eşit ağırlıkta durması, hiç
 * dokunulmayacak bir alanı ana yola koymak demekti.
 *
 * KALDIRILMIYOR, GİZLENİYOR: öğretmen ayrıca belirtti — özel ders
 * öğrencilerinde hem 4 hem 5 şıklı test hazırlıyor. Yani seçim gerçekten
 * gerekli, yalnız her ödevde önüne çıkması gereksiz. Değer varsayılandan
 * farklıysa seçim kendiliğinden AÇIK gelir — 4 şıklı bir ödevi düzenlerken
 * ayarın gizli kalması, sessizce yanlış değere dönmesinden beter olurdu.
 */
export function SikSayisiSecimi({ deger, onDegis }: Props) {
  const [elleAcildi, setElleAcildi] = useState(false);

  /**
   * Açıklık TÜRETİLMİŞ, başlangıç durumu DEĞİL.
   *
   * Önce `useState(deger === 'D')` yazmıştım ve düzenleme ekranında sessizce
   * bozuktu: form ilk render'da 'E' ile kuruluyor, `odev_detay` sonra
   * geliyor. Başlangıç değeri bir kez okunduğu için 4 şıklı bir ödevde alan
   * kapalı kalıyor ve üstelik "A–E" yazıyordu — ızgara A–D gösterirken.
   * Ekranda yalan bir cümle. DOM kontrolüyle yakalandı.
   */
  const acik = elleAcildi || deger === 'D';

  if (!acik) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        <span>
          Şıklar <strong className="text-ink">A–E</strong> (5 şık).
        </span>
        <button
          type="button"
          onClick={() => setElleAcildi(true)}
          className="min-h-[44px] font-semibold text-link underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          4 şıklı test hazırlayacağım
        </button>
      </p>
    );
  }

  return (
    <Field
      etiket="Şık sayısı"
      ipucu="Okul sınıflarında hep 5 şık; özel ders öğrencilerinde ikisi de olabilir."
    >
      {(k) => (
        <Select {...k} value={deger} onChange={(e) => onDegis(e.target.value as SonSecenek)}>
          <option value="E">5 şık (A–E)</option>
          <option value="D">4 şık (A–D)</option>
        </Select>
      )}
    </Field>
  );
}
