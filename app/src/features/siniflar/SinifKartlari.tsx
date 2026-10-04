import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { SinifKarti } from '@/types/api';

const SAYI = new Intl.NumberFormat('tr-TR');

export type SinifBaglantilari = {
  sinif: (id: string) => string;
  analiz: (id: string) => string;
  onam: (id: string) => string;
};

/**
 * SINIF KARTLARI — öğretmenin ve müdürün Sınıflar sayfası (0063).
 *
 * Öğretmenin isteği: "Öğretmen hesaplarında da sınıflar sekmesine
 * tıkladığımda gördüğüm sayfa ile müdürdeki ... sayfa düzeni aynı olsun ve
 * aynı özelliklere sahip olsun." Kart TEK bileşen; sayılar sunucuda tek
 * yardımcıdan (`_sinif_kart_ozetleri`). Fark yalnız bağlantılarda ve
 * öğretmenin `eylem` yuvasında (Arşivle / Geri al) — müdürde düzenleme yok.
 *
 * Gönderim oranı ve ortalama, son tarihi geçmiş ödevlerden — sınıf
 * analiziyle aynı pencere; süresi dolmamış ödev "eksik gönderim" gibi
 * görünmesin.
 */
export function SinifKartlari({
  kartlar,
  baglanti,
  eylem,
}: {
  kartlar: SinifKarti[];
  baglanti: SinifBaglantilari;
  eylem?: (s: SinifKarti) => ReactNode;
}) {
  const git = useNavigate();

  return (
    <ul className="grid gap-3 sm:grid-cols-2 [&>li]:min-w-0">
      {kartlar.map((s) => {
        const ort = ortalamaYazisi(s.ortalama);
        return (
          <li key={s.id}>
            <Card vurgu={s.arsiv ? 'uyari' : 'yok'}>
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => git(baglanti.sinif(s.id))}
                  className="min-h-[44px] min-w-0 text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {/* Ad + "N öğrenci": Öğrenciler sekmesindeki sınıf kutusuyla
                      AYNI ölçü (öğretmenin önceki isteği; ogrenci-sirasi
                      denetimi 3b iki sekmeyi karşılaştırıyor). */}
                  <span className="block font-display text-[20px] font-semibold text-ink">{s.ad}</span>
                  <span className="block text-[13px] text-muted">
                    <span className="sk-sayi">{s.ogrenci_sayisi}</span> öğrenci
                  </span>
                </button>
                {s.arsiv && <Tag tur="uyari">Arşivde</Tag>}
              </div>
              <p className="mt-1 break-words text-[13px] text-muted">
                {s.ogretmenler.length > 0 ? s.ogretmenler.join(', ') : 'Öğretmen atanmamış'}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button olcu="sm" onClick={() => git(baglanti.sinif(s.id))}>
                  Sınıfı aç
                </Button>
                <Button tur="sade" olcu="sm" onClick={() => git(baglanti.analiz(s.id))}>
                  Konu analizi
                </Button>
                <Button tur="sade" olcu="sm" onClick={() => git(baglanti.onam(s.id))}>
                  Onam dökümü
                </Button>
                {eylem?.(s)}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
