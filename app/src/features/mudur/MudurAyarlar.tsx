import { SayfaBasligi } from '@/components/layout/Kabuk';
import { PinDegistirKarti } from '@/components/PinDegistirKarti';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';

/**
 * Müdür → PIN (0061). Müdürün değiştirebildiği TEK şey kendi PIN'i; uç
 * `mudur_pin_degistir` ve `_mudur` kapısından geçiyor. Unutursa platform
 * sahibi Öğretmenler ekranından sıfırlar.
 */
export function MudurAyarlar() {
  const { oturum } = useOturum();
  const { veri } = useVeri<MudurPaneli>('mudur_paneli', { p_token: oturum?.token });

  return (
    <>
      <SayfaBasligi
        baslik="PIN"
        aciklama={`${veri?.ad ? `${veri.ad} olarak girdiniz · müdür. ` : ''}PIN'inizi unutursanız platformu yöneten öğretmen sıfırlayabilir.`}
      />
      <PinDegistirKarti uc="mudur_pin_degistir" />
    </>
  );
}
