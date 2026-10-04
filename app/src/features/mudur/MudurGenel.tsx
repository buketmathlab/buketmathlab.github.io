import { SayfaBasligi } from '@/components/layout/Kabuk';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { GENEL_ACIKLAMA, GenelOzet } from '@/features/genel/GenelOzet';
import { listeDurumu, useMudurPaneli } from './mudur-baglam';

/**
 * Müdür → Genel bakış (0061).
 *
 * Öğretmenin isteği: "Bugüne kadar verilen toplam soru sayısı şube sınıf
 * bazlı gösterilsin. Daha detaylı müdürün işine yarayacak analizler olsun.
 * Gelişim grafikleri olsun."
 *
 * Gövde 0065'ten beri öğretmenin Genel sayfasıyla ortak: `GenelOzet`.
 */
export function MudurGenel() {
  const { veri, durum, hata, yenile } = useMudurPaneli();

  return (
    <>
      <SayfaBasligi baslik="Genel bakış" aciklama={GENEL_ACIKLAMA} />
      <AsyncBoundary
        durum={listeDurumu(durum, (veri?.siniflar.length ?? 0) === 0)}
        bosBaslik="Henüz sınıf yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && <GenelOzet veri={veri} />}
      </AsyncBoundary>
    </>
  );
}
