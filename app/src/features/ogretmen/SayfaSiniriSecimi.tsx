import { useState } from 'react';
import { Field, Select } from '@/components/ui/Field';
import { EN_FAZLA_SAYFA } from '@/lib/cozum-sayfalari';

type Props = {
  deger: number;
  onDegis: (v: number) => void;
};

/**
 * Sayfa sınırı (0054) — öğrencinin bu ödevde kaç çözüm görseli
 * yükleyebileceği.
 *
 * `SikSayisiSecimi` ile aynı kalıp, aynı sebeple: öğretmen varsayılanın 1
 * kalmasını istedi — öğrenciler sayfalarını birleştirip tek görsel
 * gönderiyor ve bu alışkanlık bozulmayacak. Her ödevde önüne çıkan bir
 * alan, hiç dokunulmayacak bir kararı ana yola koymak olurdu.
 *
 * Değer 1'den farklıysa KENDİLİĞİNDEN AÇIK gelir: 3 sayfalık bir ödevi
 * düzenlerken ayarın gizli kalması, sessizce 1'e dönmesinden beter olurdu.
 * Açıklık TÜRETİLMİŞ, başlangıç durumu değil — form ilk render'da 1 ile
 * kuruluyor, `odev_detay` sonra geliyor (SikSayisiSecimi'nin notu).
 *
 * Oluşturma ve düzenleme ekranlarının ortak parçası: metin iki yerde
 * kopyalanırsa biri değişip diğeri kalır.
 */
export function SayfaSiniriSecimi({ deger, onDegis }: Props) {
  const [elleAcildi, setElleAcildi] = useState(false);
  const acik = elleAcildi || deger !== 1;

  if (!acik) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
        <span>
          Öğrenci çözümünü <strong className="text-ink">tek görsel</strong> olarak gönderir.
        </span>
        <button
          type="button"
          onClick={() => setElleAcildi(true)}
          className="min-h-[44px] font-semibold text-link underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Birden fazla sayfaya izin ver
        </button>
      </p>
    );
  }

  return (
    <Field
      etiket="Sayfa sınırı"
      ipucu="Öğrenci bu ödevde en fazla bu kadar görsel yükleyebilir. 1 bırakırsanız sayfalarını birleştirip tek görsel gönderir."
    >
      {(k) => (
        <Select {...k} value={deger} onChange={(e) => onDegis(Number(e.target.value))}>
          {Array.from({ length: EN_FAZLA_SAYFA }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? '1 sayfa (tek görsel)' : `${n} sayfa`}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
