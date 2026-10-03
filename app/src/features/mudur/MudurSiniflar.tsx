import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { MudurPaneli } from '@/types/api';

/**
 * Müdür → Sınıflar: her sınıfın ÖZETİ (öğretmenin kararı: öğrenci adı yok).
 *
 * Sayılar yalnız yayındaki ödevlerden. Gönderim oranı ve ortalama, son
 * tarihi geçmiş ödevlerden — sınıf analiziyle aynı pencere; süresi
 * dolmamış ödev "eksik gönderim" gibi görünmesin.
 */
export function MudurSiniflar() {
  const { oturum } = useOturum();
  const git = useNavigate();
  const { veri, durum, hata, yenile } = useVeri<MudurPaneli>(
    'mudur_paneli',
    { p_token: oturum?.token },
    (v) => v.siniflar.length === 0,
  );

  return (
    <>
      <SayfaBasligi
        baslik="Sınıflar"
        aciklama="Sınıf sınıf ödev ve gönderim özeti. Öğrenci bazında bilgi bu ekranda yer almaz."
      />
      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz sınıf yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <ul className="grid gap-3 sm:grid-cols-2 [&>li]:min-w-0">
            {veri.siniflar.map((s) => {
              const ort = ortalamaYazisi(s.ortalama);
              return (
                <li key={s.id}>
                  <Card>
                    <p className="font-display text-[22px] font-semibold text-ink">{s.ad}</p>
                    <p className="mt-0.5 break-words text-[13px] text-muted">
                      {s.ogretmenler.length > 0 ? s.ogretmenler.join(', ') : 'Öğretmen atanmamış'}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
                      <dt className="text-muted">Öğrenci</dt>
                      <dd className="sk-sayi text-right font-semibold text-ink">{s.ogrenci_sayisi}</dd>
                      <dt className="text-muted">Yayındaki ödev</dt>
                      <dd className="sk-sayi text-right font-semibold text-ink">{s.odev_sayisi}</dd>
                      <dt className="text-muted">Gönderim oranı</dt>
                      <dd className="sk-sayi text-right font-semibold text-ink">
                        {s.gonderim_orani === null ? '—' : `%${s.gonderim_orani}`}
                      </dd>
                      <dt className="text-muted">Sınıf ortalaması</dt>
                      <dd className="sk-sayi text-right font-semibold text-ink">{ort ?? '—'}</dd>
                    </dl>
                    <p className="mt-2 text-[12px] text-muted">
                      Gönderim ve ortalama, süresi dolan{' '}
                      <span className="sk-sayi">{s.suresi_dolan}</span> ödevden.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button tur="ikincil" olcu="sm" onClick={() => git(`/mudur/sinif/${s.id}`)}>
                        Sınıf analizi
                      </Button>
                      <Button tur="sade" olcu="sm" onClick={() => git(`/mudur/sinif/${s.id}/onam`)}>
                        Onam dökümü
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncBoundary>
    </>
  );
}
