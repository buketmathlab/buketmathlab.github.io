import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Tag } from '@/components/ui/Tag';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { MudurPaneli } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

/**
 * Müdür → Öğretmenler: kim kaç ödev vermiş, hangi sınıflara giriyor.
 * Giriş saatleri BİLEREK yok (öğretmenin seçtiği kapsam).
 */
export function MudurOgretmenler() {
  const { oturum } = useOturum();
  const { veri, durum, hata, yenile } = useVeri<MudurPaneli>(
    'mudur_paneli',
    { p_token: oturum?.token },
    (v) => v.ogretmenler.length === 0,
  );

  return (
    <>
      <SayfaBasligi
        baslik="Öğretmenler"
        aciklama="Öğretmenlerin girdiği sınıflar ve yayınladıkları ödev sayıları."
      />
      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz öğretmen yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <ul className="grid gap-3 [&>li]:min-w-0">
            {veri.ogretmenler.map((o) => (
              <li key={o.ad}>
                <Card>
                  <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
                    {o.ad}
                    {o.sahip && <Tag tur="bilgi">Platform sahibi</Tag>}
                  </p>
                  <p className="mt-1 break-words text-[14px] text-muted">
                    {o.siniflar.length > 0 ? o.siniflar.join(', ') : 'Sınıf atanmamış'}
                  </p>
                  <p className="mt-2 text-[14px] text-ink">
                    <span className="sk-sayi font-semibold">{o.odev_sayisi}</span> ödev yayınladı
                    {' · '}son 30 günde <span className="sk-sayi font-semibold">{o.son_30_gun}</span>
                    {o.son_odev && <> · son ödev {TARIH.format(new Date(o.son_odev))}</>}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </>
  );
}
