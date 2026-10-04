import { SayfaBasligi } from '@/components/layout/Kabuk';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SinifKartlari } from '@/features/siniflar/SinifKartlari';
import { listeDurumu, useMudurPaneli } from './mudur-baglam';

/**
 * Müdür → Sınıflar. Kartlar öğretmenin Sınıflar sayfasıyla AYNI bileşen
 * (0063, `SinifKartlari`); müdürde Arşivle/Sınıf ekle yok.
 */
export function MudurSiniflar() {
  const { veri, durum, hata, yenile, kok } = useMudurPaneli();

  return (
    <>
      <SayfaBasligi
        baslik="Sınıflar"
        aciklama="Şube şube ödev, soru ve gönderim özeti. Öğrenci notları için sınıfı açın."
      />
      <AsyncBoundary
        durum={listeDurumu(durum, (veri?.siniflar.length ?? 0) === 0)}
        bosBaslik="Henüz sınıf yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <SinifKartlari
            kartlar={veri.siniflar}
            baglanti={{
              sinif: (id) => `${kok}/siniflar/${id}`,
              analiz: (id) => `${kok}/siniflar/${id}/analiz`,
              odevler: (id) => `${kok}/siniflar/${id}/odevler`,
              onam: (id) => `${kok}/siniflar/${id}/onam`,
            }}
          />
        )}
      </AsyncBoundary>
    </>
  );
}
