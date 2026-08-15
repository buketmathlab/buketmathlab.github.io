import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { KonuKarnesiBolumu } from '@/features/ogretmen/KonuKarnesiBolumu';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { SinifDetayi, SinifOgrencisi } from '@/types/api';

/**
 * Bir sınıfın öğrenci listesi ve ödev karnesi.
 *
 * Hem Sınıflar hem Öğrenciler sekmesinden buraya geliniyor — öğretmen
 * ikisinde de aynı şeyi istedi. Tek bileşen: iki kopya zamanla ayrışır ve
 * bir gün iki ekran aynı öğrenci için farklı ortalama gösterir.
 *
 * İKİ ORTALAMA YAN YANA. Bir öğrenci iki ödevden 90 alıp sekizini hiç
 * yapmadıysa tek bir sayı bunu gizler. "Yaptıklarında 90, genelde 18"
 * cümlesi öğretmene ne konuşacağını söyler; "90" tek başına yanıltır.
 */
export function SinifDetay() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<SinifDetayi>('sinif_ogrencileri', {
    p_token: oturum?.token,
    p_sinif_id: id,
  });

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(-1)}>
          ← Geri
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Sınıf bulunamadı"
        bosAciklama="Bu sınıf arşivlenmiş ya da kaldırılmış olabilir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[24px] font-semibold text-ink">
                  {veri.sinif.ad}
                </h1>
                {/* Başlık zaten "Özel ders" yazıyor (`siniflar.ad` özel
                    sınıfta bu değeri üretiyor); aynı sözü etikete tekrar
                    yazmıyoruz. */}
                {veri.sinif.arsiv && <Tag tur="notr">Arşivde</Tag>}
              </div>
              <p className="mt-1 text-[14px] text-muted">
                <span className="sk-sayi">{veri.ogrenciler.length}</span> öğrenci ·{' '}
                {veri.degerlendirilen_odev > 0 ? (
                  <>
                    ortalamalar <span className="sk-sayi">{veri.degerlendirilen_odev}</span> ödev
                    üzerinden
                  </>
                ) : (
                  'süresi dolmuş ödev yok'
                )}
              </p>
            </div>

            {veri.degerlendirilen_odev === 0 ? (
              <Card>
                <p className="mb-1 font-semibold text-ink">Henüz karne çıkarılamaz.</p>
                <p className="text-[14px] text-muted">
                  Ortalamalara yalnız <strong>süresi dolmuş</strong> ödevler girer. Süresi devam
                  eden bir ödevi “yapmadı” sayıp sıfır vermek öğrenciye haksızlık olurdu.
                </p>
              </Card>
            ) : (
              <ul className="grid gap-2">
                {veri.ogrenciler.map((o) => (
                  <li key={o.id}>
                    <OgrenciSatiri
                      ogrenci={o}
                      toplam={veri.degerlendirilen_odev}
                      ozelSinif={veri.sinif.ozel}
                    />
                  </li>
                ))}
              </ul>
            )}

            {veri.ogrenciler.length === 0 && (
              <Card>
                <p className="mb-1 font-semibold text-ink">Bu sınıfta öğrenci yok.</p>
                <p className="mb-3 text-[14px] text-muted">
                  Öğrenciler sekmesinden ekleyebilirsiniz.
                </p>
                <Button tur="sade" onClick={() => git('/ogretmen/ogrenciler')}>
                  Öğrencilere git
                </Button>
              </Card>
            )}

            {/* DÖNEM GENELİ KONU KARNESİ (0023). Yukarıdaki karne "kim kaç
                ödev yaptı, ortalaması ne" diyor; bu bölüm "sınıf hangi
                KONUDA zayıf" diyor. İkisi ayrı sorular ve öğretmen bugüne
                kadar ikincisini hiçbir ekranda soramıyordu.

                AYRI YÜKLENİYOR: karne sorgusu ölçüldü, en kötü durumda
                169 ms. Yukarıdaki liste onu beklemesin. */}
            <KonuKarnesiBolumu sinifId={id} />
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function OgrenciSatiri({
  ogrenci: o,
  toplam,
  ozelSinif,
}: {
  ogrenci: SinifOgrencisi;
  toplam: number;
  ozelSinif: boolean;
}) {
  const oran = toplam > 0 ? o.yapti / toplam : 0;

  /**
   * Vurgu ÖDEV YAPMA ORANINA göre, puana göre değil.
   *
   * Düşük puan bir öğrenme meselesidir ve öğretmenin işidir; hiç ödev
   * yapmamak ise takip meselesidir ve ekranın işaret etmesi gereken şeydir.
   * Kırmızıyı düşük nota bağlasaydık ekran her sınıfta aynı çocukları
   * damgalardı.
   */
  const vurgu = o.yapti === 0 ? 'tehlike' : oran < 0.5 ? 'uyari' : 'yok';

  return (
    <Card vurgu={vurgu}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Ad detaya götürüyor; özel ders öğrencisinde ders ve ödeme
              takibi orada. Öğrenciler listesiyle aynı desen. */}
          <Link
            to={`/ogretmen/ogrenciler/${o.id}`}
            className="inline-flex min-h-[44px] items-center font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
          >
            {o.ad}
          </Link>
          <p className="mt-1 text-[13px] text-muted">
            <span className="sk-sayi font-semibold text-ink">{o.yapti}</span> yaptı ·{' '}
            <span className="sk-sayi font-semibold text-ink">{o.yapmadi}</span> yapmadı
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Yaptıkları</p>
            <p className="sk-sayi text-[20px] font-semibold text-ink">
              {o.ortalama_yapan ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Genel</p>
            <p className="sk-sayi text-[20px] font-semibold text-ink">{o.ortalama_tum ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Özel ders sınıfının sayfasında HERKES özel; her satıra aynı
          etiketi basmak sayfa başlığını tekrar etmekti. Etiket yalnız
          karışık bir sınıfta bilgi taşıyor. */}
      {o.tur === 'ozel' && !ozelSinif && (
        <div className="mt-2">
          <Tag tur="uyari">Özel ders</Tag>
        </div>
      )}
    </Card>
  );
}
