import { useParams } from 'react-router-dom';
import { SinifSayfasi } from '@/features/siniflar/SinifSayfasi';

/**
 * Öğretmen → bir sınıf. 0063'ten beri müdürle AYNI sayfa (`SinifSayfasi`):
 * öğrenci kartları (yaptı/yapmadı, "Yaptıkları" ve "Genel"), öğrenci başına
 * ödev ödev puan ve grafik, aylık gelişim, ödevler ve soru sayıları, konu
 * karnesi. Öğretmende öğrencinin adı onun sayfasına götürüyor (özel ders
 * öğrencisinde ders ve ödeme takibi orada).
 *
 * Sayılar bugünkü kapsamla: ortak sınıfta öğretmen yalnız kendi ve
 * platform sahibinin ödevlerini görüyor (`_odeve_erisir`, 0055).
 */
export function SinifDetay() {
  const { id = '' } = useParams();
  return (
    <SinifSayfasi
      sinifId={id}
      baglanti={{
        geri: '/ogretmen/siniflar',
        analiz: (s) => `/ogretmen/siniflar/${s}/analiz`,
        onam: (s) => `/ogretmen/veliler/sinif/${s}/onam`,
        ogrenci: (o) => `/ogretmen/ogrenciler/${o}`,
        ogrencilerSayfasi: '/ogretmen/ogrenciler',
      }}
    />
  );
}
