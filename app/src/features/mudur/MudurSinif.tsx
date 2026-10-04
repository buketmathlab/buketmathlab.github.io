import { useParams } from 'react-router-dom';
import { SinifSayfasi } from '@/features/siniflar/SinifSayfasi';
import { useMudurPaneli } from './mudur-baglam';

/**
 * Müdür → bir sınıf. Sayfa öğretmeninkiyle AYNI bileşen (0063,
 * `SinifSayfasi`); müdürde öğrenci adı bağlantı değil ve düzenleme yok.
 * Sahibin önizlemesinde (`onizleme`) sunucu sınıfın bütün ödevlerini
 * sayıyor — müdürün gördüğünün aynısı.
 */
export function MudurSinif() {
  const { id = '' } = useParams();
  const { kok, onizleme } = useMudurPaneli();
  return (
    <SinifSayfasi
      sinifId={id}
      onizleme={onizleme}
      baglanti={{
        geri: `${kok}/siniflar`,
        analiz: (s) => `${kok}/siniflar/${s}/analiz`,
        odevler: (s) => `${kok}/siniflar/${s}/odevler`,
        onam: (s) => `${kok}/siniflar/${s}/onam`,
      }}
    />
  );
}
