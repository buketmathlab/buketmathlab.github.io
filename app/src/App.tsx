import { lazy, Suspense, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastSaglayici } from '@/components/ui/Toast';
import { OturumSaglayici } from '@/hooks/OturumSaglayici';
import { useOturum } from '@/hooks/oturum-baglam';
import { GirisEkrani } from '@/features/kimlik/GirisEkrani';
import { KurulumEkrani } from '@/features/kimlik/KurulumEkrani';
import { Kabuk } from '@/components/layout/Kabuk';
import { Pano } from '@/features/ogretmen/Pano';
import { Siniflar } from '@/features/ogretmen/Siniflar';
import { Ogrenciler } from '@/features/ogretmen/Ogrenciler';
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

  if (oturum.rol !== 'ogretmen') {
    // Öğrenci ve veli ekranları Faz 3–4'te gelecek. Şu an olmayan bir
    // ekranı varmış gibi göstermek yerine durumu açıkça söylüyoruz.
    return <HenuzYok />;
  }

  return (
    <Routes>
      <Route path="/ogretmen" element={<Kabuk />}>
        <Route index element={<Pano />} />
        <Route path="siniflar" element={<Siniflar />} />
        <Route path="ogrenciler" element={<Ogrenciler />} />
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
        {oturum?.rol === 'veli' ? 'Veli' : 'Öğrenci'} ekranı henüz hazır değil. Öğretmeniniz
        sistemi kurmayı sürdürüyor; çok yakında burada olacak.
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
        <HashRouter>
          <Yonlendirme />
        </HashRouter>
      </OturumSaglayici>
    </ToastSaglayici>
  );
}
