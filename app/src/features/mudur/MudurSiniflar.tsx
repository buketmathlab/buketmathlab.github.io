import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import { listeDurumu, useMudurPaneli } from './mudur-baglam';

const SAYI = new Intl.NumberFormat('tr-TR');

/**
 * Müdür → Sınıflar: her şubenin özeti ve toplam soru sayısı (0061).
 *
 * Sayılar yalnız yayındaki ödevlerden. Gönderim oranı ve ortalama, son
 * tarihi geçmiş ödevlerden — sınıf analiziyle aynı pencere; süresi
 * dolmamış ödev "eksik gönderim" gibi görünmesin. Öğrenci notları
 * sınıfın kendi sayfasında.
 */
export function MudurSiniflar() {
  const git = useNavigate();
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
                      <dt className="text-muted">Toplam soru</dt>
                      <dd className="sk-sayi text-right font-semibold text-ink">
                        {SAYI.format(s.soru_toplami)}
                      </dd>
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
                      {s.soru_sayisiz > 0 && (
                        <>
                          {' '}
                          <span className="sk-sayi">{s.soru_sayisiz}</span> ödevde soru sayısı
                          girilmemiş; toplama katılmadı.
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button olcu="sm" onClick={() => git(`${kok}/siniflar/${s.id}`)}>
                        Sınıfı aç
                      </Button>
                      <Button
                        tur="sade"
                        olcu="sm"
                        onClick={() => git(`${kok}/siniflar/${s.id}/analiz`)}
                      >
                        Konu analizi
                      </Button>
                      <Button
                        tur="sade"
                        olcu="sm"
                        onClick={() => git(`${kok}/siniflar/${s.id}/onam`)}
                      >
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
