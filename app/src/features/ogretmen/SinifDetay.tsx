import { useParams } from 'react-router-dom';
import { SinifSayfasi } from '@/features/siniflar/SinifSayfasi';
import { SinifOdevleri } from '@/features/siniflar/SinifOdevleri';
import { OkulOdevleri } from '@/features/genel/OkulOdevleri';

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
        odevler: (s) => `/ogretmen/siniflar/${s}/odevler`,
        onam: (s) => `/ogretmen/veliler/sinif/${s}/onam`,
        ogrenci: (o) => `/ogretmen/ogrenciler/${o}`,
        ogrencilerSayfasi: '/ogretmen/ogrenciler',
      }}
    />
  );
}

/** Öğretmen → Sınıflar → şube → "Ödevler ve cevap anahtarları" (0067). */
export function OgretmenSinifOdevleri() {
  const { id = '' } = useParams();
  return <SinifOdevleri sinifId={id} geri="/ogretmen/siniflar" />;
}

/** Öğretmen → Genel → "Yayınlanan ödev": derse girdiği şubeler (0067). */
export function OgretmenOkulOdevleri() {
  return <OkulOdevleri geri="/ogretmen" ogretmen />;
}
