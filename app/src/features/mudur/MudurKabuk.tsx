import { Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { SekmeCubugu, type SekmeTanim } from '@/components/layout/SekmeCubugu';
import { SEKME_IKON } from '@/components/layout/sekme-ikonlari';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';

const SEKMELER: SekmeTanim[] = [
  { yol: '/mudur', etiket: 'Sınıflar', ikon: SEKME_IKON.sinif, sonu: true },
  { yol: '/mudur/ogretmenler', etiket: 'Öğretmenler', ikon: SEKME_IKON.ogrenci },
];

/**
 * Müdür kabuğu (0060) — SALT İZLEME.
 *
 * Müdür hiçbir şeyi değiştiremiyor ve bu ekranlarda değiştirme düğmesi
 * yok. Asıl sınır sunucuda: müdür oturumu 'mudur' rolüyle açılıyor ve
 * değiştiren her uç yalnız 'ogretmen' rolünü kabul ediyor
 * (`mudur_testleri.sql` 5. grup her ucu tek tek ölçüyor).
 */
export function MudurKabuk() {
  const { oturum, cikisYap } = useOturum();
  const { veri } = useVeri<MudurPaneli>('mudur_paneli', { p_token: oturum?.token });

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3 px-4 py-3">
          <SekizWordmark boyut="sm" bicim="sade" />
          <div className="flex min-w-0 items-center gap-3">
            <p className="min-w-0 text-right text-[13px] leading-tight">
              <span className="block font-semibold text-ink">{veri?.ad ?? 'Müdür'}</span>
              <span className="block text-muted">Müdür · yalnız izleme</span>
            </p>
            <Button tur="sade" olcu="sm" onClick={cikisYap}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto hidden w-full max-w-[880px] px-4 lg:block print:hidden">
        <SekmeCubugu sekmeler={SEKMELER} bicim="yatay" />
      </div>

      <main className="mx-auto w-full max-w-[880px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 lg:pb-10">
        <Outlet />
      </main>

      <SekmeCubugu sekmeler={SEKMELER} bicim="alt" className="lg:hidden print:hidden" />
    </div>
  );
}
