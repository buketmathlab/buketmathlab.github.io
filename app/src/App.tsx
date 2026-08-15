import { lazy, Suspense, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastSaglayici } from '@/components/ui/Toast';
import { OturumSaglayici } from '@/hooks/OturumSaglayici';
import { useOturum } from '@/hooks/oturum-baglam';
import { GirisEkrani } from '@/features/kimlik/GirisEkrani';
import { KurulumEkrani } from '@/features/kimlik/KurulumEkrani';
import { Kabuk } from '@/components/layout/Kabuk';
import { SurumSeridi } from '@/components/layout/SurumSeridi';
import { OgrenciKabuk } from '@/components/layout/OgrenciKabuk';
import { VeliKabuk } from '@/components/layout/VeliKabuk';
import { VeliPanel } from '@/features/veli/VeliPanel';
import { Odevlerim } from '@/features/ogrenci/Odevlerim';
import { OdevTeslim } from '@/features/ogrenci/OdevTeslim';
import { Pano } from '@/features/ogretmen/Pano';
import { Ayarlar } from '@/features/ogretmen/Ayarlar';
import { OgrenciDetay } from '@/features/ogretmen/OgrenciDetay';
import { PanoDetay } from '@/features/ogretmen/PanoDetay';
import { Siniflar } from '@/features/ogretmen/Siniflar';
import { SinifDetay } from '@/features/ogretmen/SinifDetay';
import { Ogrenciler } from '@/features/ogretmen/Ogrenciler';
import { TopluOgrenci } from '@/features/ogretmen/TopluOgrenci';
import { Odevler } from '@/features/ogretmen/Odevler';
import { Kodlar, SinifKodlari } from '@/features/ogretmen/Kodlar';
import { Veliler, SinifVelileriEkrani, VeliYazismasi } from '@/features/ogretmen/Veliler';
import { OdevOlustur } from '@/features/ogretmen/OdevOlustur';
import { OdevDuzenle } from '@/features/ogretmen/OdevDuzenle';
import { OdevGonderimleri } from '@/features/ogretmen/OdevGonderimleri';
// Tasarım vitrini nadiren açılır ve büyüktür; ayrı parçaya alınıyor.
const TasarimSistemi = lazy(() =>
  import('@/pages/TasarimSistemi').then((m) => ({ default: m.TasarimSistemi })),
);

/**
 * Yönlendirme HashRouter ile.
 *
 * GitHub Pages statik dosya sunar; `/yeni/ogretmen/siniflar` gibi bir yola
 * doğrudan girildiğinde 404 döner çünkü o dosya yok. Hash tabanlı yollar
 * (`/yeni/#/ogretmen/siniflar`) sunucuya hiç gitmediği için sayfa
 * yenilendiğinde de çalışır. Sunucu tarafı yönlendirme kuralı
 * yazamadığımız için doğru seçim bu.
 */
function Yonlendirme() {
  const { oturum, girisYap } = useOturum();
  const [kurulumda, setKurulumda] = useState(false);

  if (!oturum) {
    return kurulumda ? (
      <KurulumEkrani
        onKuruldu={(o) => {
          setKurulumda(false);
          girisYap(o);
        }}
        onVazgec={() => setKurulumda(false)}
      />
    ) : (
      <GirisEkrani onGiris={girisYap} onKurulum={() => setKurulumda(true)} />
    );
  }

  if (oturum.rol === 'ogrenci') {
    return (
      <Routes>
        <Route path="/ogrenci" element={<OgrenciKabuk />}>
          <Route index element={<Odevlerim />} />
          <Route path="odev/:id" element={<OdevTeslim />} />
        </Route>
        <Route path="*" element={<Navigate to="/ogrenci" replace />} />
      </Routes>
    );
  }

  if (oturum.rol === 'veli') {
    return (
      <Routes>
        <Route path="/veli" element={<VeliKabuk />}>
          <Route index element={<VeliPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/veli" replace />} />
      </Routes>
    );
  }

  if (oturum.rol !== 'ogretmen') {
    // Bilinmeyen bir rol: üç bilinen rolün dışında bir şey dönerse kullanıcı
    // boş ekranla kalmasın.
    return <HenuzYok />;
  }

  return (
    <Routes>
      <Route path="/ogretmen" element={<Kabuk />}>
        <Route index element={<Pano />} />
        <Route path="bugun/:tur" element={<PanoDetay />} />
        {/* İkinci kademe: sınıfın kendi listesi. Aynı bileşen — veri de
            gruplama da aynı; ayrı bir bileşen iki yerde bakım isterdi. */}
        <Route path="bugun/:tur/:sinif" element={<PanoDetay />} />
        <Route path="siniflar" element={<Siniflar />} />
        <Route path="siniflar/:id" element={<SinifDetay />} />
        <Route path="ogrenciler" element={<Ogrenciler />} />
        {/* `:id`'DEN ÖNCE. Sonra gelseydi `/ogrenciler/toplu` isteği
            `:id = "toplu"` olarak eşleşir ve "öğrenci bulunamadı" ekranı
            açılırdı. */}
        <Route path="ogrenciler/toplu" element={<TopluOgrenci />} />
        <Route path="ogrenciler/:id" element={<OgrenciDetay />} />
        <Route path="odevler" element={<Odevler />} />
        <Route path="odevler/yeni" element={<OdevOlustur />} />
        <Route path="odevler/:id" element={<OdevDuzenle />} />
        <Route path="odevler/:id/gonderimler" element={<OdevGonderimleri />} />
        {/* Kodlar da iki kademeli: önce sınıf, sonra o sınıfın kodları. */}
        <Route path="kodlar" element={<Kodlar />} />
        <Route path="kodlar/:id" element={<SinifKodlari />} />
        {/* Veliler üç kademeli: sınıf → o sınıfın velileri → yazışma.
            Yazışmaya yanıt bekleyenler listesinden tek dokunuşla da
            gidilebiliyor; acil olan sınıfın altına gömülmesin. */}
        <Route path="veliler" element={<Veliler />} />
        <Route path="ayarlar" element={<Ayarlar />} />
        <Route path="veliler/sinif/:id" element={<SinifVelileriEkrani />} />
        <Route path="veliler/yazisma/:id" element={<VeliYazismasi />} />
      </Route>
      <Route
        path="/tasarim"
        element={
          <Suspense fallback={<p className="p-8 text-muted">Yükleniyor…</p>}>
            <TasarimSistemi />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/ogretmen" replace />} />
    </Routes>
  );
}

function HenuzYok() {
  const { oturum, cikisYap } = useOturum();
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 text-center">
      <h1 className="text-[22px] text-ink">
        Merhaba{oturum?.ogrenci ? `, ${oturum.ogrenci.ad}` : ''}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        Hesabınız için bir ekran bulunamadı. Öğretmeninize durumu bildirin; giriş kodunuz
        yenilenmiş olabilir.
      </p>
      <button
        type="button"
        onClick={cikisYap}
        className="mx-auto mt-6 min-h-[44px] rounded-sk-sm border border-line px-5 font-semibold"
      >
        Çıkış
      </button>
    </main>
  );
}

export function App() {
  return (
    <ToastSaglayici>
      <OturumSaglayici>
        {/* Şerit yönlendirmenin DIŞINDA: yeni sürüm haberi hangi ekranda
            olunursa olunsun, giriş yapılmamışken bile geçerli. */}
        <SurumSeridi />
        <HashRouter>
          <Yonlendirme />
        </HashRouter>
      </OturumSaglayici>
    </ToastSaglayici>
  );
}
