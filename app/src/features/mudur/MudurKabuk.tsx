import { Outlet, useNavigate } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { SekmeCubugu, type SekmeTanim } from '@/components/layout/SekmeCubugu';
import { SEKME_IKON } from '@/components/layout/sekme-ikonlari';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';
import { MUDUR_KOKU, ONIZLEME_KOKU, type MudurBaglami } from './mudur-baglam';

function sekmeler(kok: string, onizleme: boolean): SekmeTanim[] {
  const s: SekmeTanim[] = [
    { yol: kok, etiket: 'Genel', ikon: SEKME_IKON.pano, sonu: true },
    { yol: `${kok}/siniflar`, etiket: 'Sınıflar', ikon: SEKME_IKON.sinif },
    { yol: `${kok}/ogretmenler`, etiket: 'Öğretmenler', ikon: SEKME_IKON.ogrenci },
  ];
  // Önizlemede PIN sekmesi YOK: o müdürün kendi PIN'i, sahibin değil.
  if (!onizleme) s.push({ yol: `${kok}/ayarlar`, etiket: 'PIN', ikon: SEKME_IKON.kod });
  return s;
}

/**
 * Müdür kabuğu (0060) — SALT İZLEME.
 *
 * Müdür hiçbir şeyi değiştiremiyor (kendi PIN'i dışında, 0061) ve bu
 * ekranlarda değiştirme düğmesi yok. Asıl sınır sunucuda: müdür oturumu
 * 'mudur' rolüyle açılıyor ve değiştiren her uç yalnız 'ogretmen' rolünü
 * kabul ediyor (`mudur_testleri.sql` 5. grup her ucu tek tek ölçüyor).
 *
 * ÖNİZLEME (0062): platform sahibi aynı ekranı KENDİ oturumuyla açıyor
 * (`/ogretmen/mudur-onizleme`). Müdürün hesabına girilmiyor: müdürün son
 * girişi değişmiyor, onam dökümünde "alan" sahibin adı oluyor.
 */
export function MudurKabuk({ onizleme = false }: { onizleme?: boolean }) {
  const { oturum, cikisYap } = useOturum();
  const git = useNavigate();
  const panel = useVeri<MudurPaneli>('mudur_paneli', { p_token: oturum?.token });
  const { veri } = panel;
  const kok = onizleme ? ONIZLEME_KOKU : MUDUR_KOKU;
  const baglam: MudurBaglami = { ...panel, kok, onizleme };
  const SEKMELER = sekmeler(kok, onizleme);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3 px-4 py-3">
          <SekizWordmark boyut="sm" bicim="sade" />
          <div className="flex min-w-0 items-center gap-3">
            {onizleme ? (
              <>
                <p className="min-w-0 text-right text-[13px] leading-tight">
                  <span className="block font-semibold text-ink">Müdür ekranı</span>
                  <span className="block text-muted">önizleme</span>
                </p>
                <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ogretmenler')}>
                  ← Öğretmenler
                </Button>
              </>
            ) : (
              <>
                <p className="min-w-0 text-right text-[13px] leading-tight">
                  <span className="block font-semibold text-ink">{veri?.ad ?? 'Müdür'}</span>
                  <span className="block text-muted">Müdür · yalnız izleme</span>
                </p>
                <Button tur="sade" olcu="sm" onClick={cikisYap}>
                  Çıkış
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {onizleme && (
        <div className="border-b border-line bg-info-bg print:hidden" role="note">
          <p className="mx-auto w-full max-w-[880px] px-4 py-2 text-[13px] text-ink">
            <strong>Müdürün gördüğü ekranın aynısı.</strong> Siz kendi hesabınızdasınız; müdürün
            hesabına girilmedi ve burada hiçbir şey değiştirilemez.
          </p>
        </div>
      )}

      <div className="mx-auto hidden w-full max-w-[880px] px-4 lg:block print:hidden">
        <SekmeCubugu sekmeler={SEKMELER} bicim="yatay" />
      </div>

      <main className="mx-auto w-full max-w-[880px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 lg:pb-10">
        <Outlet context={baglam} />
      </main>

      <SekmeCubugu sekmeler={SEKMELER} bicim="alt" className="lg:hidden print:hidden" />
    </div>
  );
}
