import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { useDosyaAc } from '@/components/DosyaAcici';
import { Button } from '@/components/ui/Button';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { OdevSatiri } from '@/features/siniflar/OdevSatiri';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { dosyaAdresi } from '@/services/dosya';
import type { OkulOdevleri as OkulOdevleriVerisi } from '@/types/api';

const SAYI = new Intl.NumberFormat('tr-TR');

/**
 * OKULUN ÖDEVLERİ, ŞUBE ŞUBE (0067).
 *
 * Öğretmenin isteği: "Genel sekmesinde yayınlanan ödeve tıkladığımız zaman
 * sınıflara göre verilen ödevler ve cevap anahtarları görülebilsin."
 * Seçimi: müdür bütün okulu, her öğretmen yalnız derse girdiği şubeleri
 * görür — kapsam sunucuda (`okul_odevleri`). Satırlar sınıf sayfasıyla AYNI
 * bileşen ve aynı veri (`sinif_not_cizelgesi` satırları).
 *
 * Şubeler kapalı başlıyor (`<details>`): okulun bütün ödevleri tek
 * kaydırmada boğucu olurdu; şube adı, ödev ve soru sayısı yeterli özet.
 */
export function OkulOdevleri({
  geri,
  onizleme = false,
  ogretmen = false,
}: {
  geri: string;
  onizleme?: boolean;
  /** Öğretmen ekranı: yalnız derse girdiği şubeler olduğunu söyle. */
  ogretmen?: boolean;
}) {
  const git = useNavigate();
  const { oturum } = useOturum();
  const dosya = useDosyaAc();
  const { veri, durum, hata, yenile } = useVeri<OkulOdevleriVerisi>(
    'okul_odevleri',
    { p_token: oturum?.token, ...(onizleme ? { p_onizleme: true } : {}) },
    (v) => v.length === 0,
  );

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(geri)}>
          ← Genel
        </Button>
      </div>
      <SayfaBasligi
        baslik="Yayınlanan ödevler"
        aciklama={
          ogretmen
            ? 'Derse girdiğiniz şubelerin ödevleri; soru dosyası ve cevap anahtarı her ödevin altında.'
            : 'Şube şube verilen ödevler; soru dosyası ve cevap anahtarı her ödevin altında.'
        }
      />
      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz yayınlanmış ödev yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        <div className="flex flex-col gap-3">
          {(veri ?? []).map((s) => {
            const soru = s.odevler.reduce((t, o) => t + (o.soru_sayisi ?? 0), 0);
            return (
              // `Card` görünümü, iç boşluksuz (`cn` sınıfları birleştirmiyor;
              // `p-0` `p-4`'ü ezmezdi).
              <div
                key={s.sinif_id}
                className="overflow-hidden rounded-sk-md border border-line bg-surface shadow-sk-sm"
              >
                <details>
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-[18px] font-semibold text-ink">
                      {s.sinif}
                    </span>
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      <span className="sk-sayi">
                        {s.odevler.length} ödev · {SAYI.format(soru)} soru
                      </span>
                      <span aria-hidden="true">▾</span>
                    </span>
                  </summary>
                  <ul className="divide-y divide-line-soft border-t border-line px-4">
                    {s.odevler.map((o) => (
                      <OdevSatiri
                        key={o.id}
                        odev={o}
                        // "x/y gönderdi" sunucudaki `beklenen` ile yazılıyor.
                        mevcut={o.beklenen}
                        ac={(yol) => void dosya.ac(() => dosyaAdresi(yol))}
                      />
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      </AsyncBoundary>
      {dosya.yedek}
    </>
  );
}
