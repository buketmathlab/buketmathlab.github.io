import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { CizgiGrafik } from '@/components/grafik/CizgiGrafik';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Gelisim } from '@/components/ui/Gelisim';
import { Tag } from '@/components/ui/Tag';
import { KonuKarnesiBolumu } from '@/features/ogretmen/KonuKarnesiBolumu';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { ayEtiketi, sayiya } from '@/lib/grafik';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { GelisimSatiri, SinifNotCizelgesi } from '@/types/api';
import type { SinifBaglantilari } from './SinifKartlari';

const SAYI = new Intl.NumberFormat('tr-TR');
const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const AY_UZUN = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const gun = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

type Ogrenci = SinifNotCizelgesi['ogrenciler'][number];
type Odev = SinifNotCizelgesi['odevler'][number];

export type SinifSayfasiBaglantilari = Omit<SinifBaglantilari, 'sinif'> & {
  /** "← Sınıflar" düğmesinin gittiği yer. */
  geri: string;
  /** Verilirse öğrencinin adı onun sayfasına bağlantı (öğretmen). */
  ogrenci?: (id: string) => string;
  /** Verilirse boş sınıfta "Öğrencilere git" düğmesi (öğretmen). */
  ogrencilerSayfasi?: string;
};

/**
 * SINIF SAYFASI — öğretmenin ve müdürün AYNI sayfası (0063).
 *
 * Öğretmenin isteği: iki Sınıflar sayfası "aynı düzende ve aynı
 * özelliklerde" olsun; seçimi ikisinin birleşimi. Bölümler:
 *   1. öğrenciler — öğretmenin bugünkü kart düzeni (yaptı/yapmadı,
 *      "Yaptıkları" ve "Genel" ortalama, yapma oranına göre vurgu) ve
 *      müdür ekranından gelen öğrenci başına ödev ödev puan ve grafik,
 *   2. aylık gelişim grafiği,
 *   3. ödevler ve soru sayıları,
 *   4. konu karnesi.
 *
 * KAPSAM ROLE GÖRE (sunucuda, `sinif_not_cizelgesi`): öğretmen ortak bir
 * sınıfta bugün olduğu gibi yalnız kendi ve platform sahibinin ödevlerini
 * görüyor; müdür ve sahibin müdür önizlemesi sınıfın bütün ödevlerini.
 * Öğretmenin sayıları `sinif_ogrencileri` ile birebir (SQL testi 13a).
 *
 * VURGU ÖDEV YAPMA ORANINA göre, puana göre değil: düşük puan öğrenme
 * meselesi, hiç ödev yapmamak takip meselesi. Kırmızıyı düşük nota
 * bağlasaydık ekran her sınıfta aynı çocukları damgalardı.
 */
export function SinifSayfasi({
  sinifId,
  baglanti,
  onizleme = false,
}: {
  sinifId: string;
  baglanti: SinifSayfasiBaglantilari;
  onizleme?: boolean;
}) {
  const git = useNavigate();
  const { oturum } = useOturum();
  const [acik, setAcik] = useState<string | null>(null);

  const { veri, durum, hata, yenile } = useVeri<SinifNotCizelgesi>('sinif_not_cizelgesi', {
    p_token: oturum?.token,
    p_sinif_id: sinifId,
    ...(onizleme ? { p_onizleme: true } : {}),
  });

  const soruToplami = veri?.odevler.reduce((t, o) => t + (o.soru_sayisi ?? 0), 0) ?? 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(baglanti.geri)}>
          ← Sınıflar
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Sınıf bulunamadı"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <div className="flex flex-col gap-4">
            <div>
              <SayfaBasligi
                baslik={veri.sinif.ad}
                aciklama={`${veri.sinif.ogretmenler.join(', ') || 'Öğretmen atanmamış'} · ${veri.mevcut} öğrenci · ${
                  veri.degerlendirilen_odev > 0
                    ? `ortalamalar ${veri.degerlendirilen_odev} ödev üzerinden`
                    : 'süresi dolmuş ödev yok'
                }`}
                eylem={
                  <div className="flex flex-wrap gap-2">
                    <Button tur="sade" olcu="sm" onClick={() => git(baglanti.analiz(sinifId))}>
                      Konu analizi
                    </Button>
                    <Button tur="sade" olcu="sm" onClick={() => git(baglanti.onam(sinifId))}>
                      Onam dökümü
                    </Button>
                  </div>
                }
              />
              <div className="-mt-3 flex flex-wrap gap-2">
                {veri.sinif.arsiv && <Tag tur="notr">Arşivde</Tag>}
                {veri.kapsam === 'ogretmen' && veri.sinif.ogretmenler.length > 1 && (
                  <p className="text-[13px] text-muted">
                    Bu sayfada sizin ve platform sahibinin verdiği ödevler sayılıyor.
                  </p>
                )}
              </div>
            </div>

            {/* 1. ÖĞRENCİLER */}
            <section aria-labelledby="ogrenciler-baslik">
              <h2 id="ogrenciler-baslik" className="mb-1 text-[18px] text-ink">
                Öğrenciler
              </h2>
              <p className="mb-3 text-[13px] text-muted">
                “Yaptıkları”: yalnız gönderdiği ödevler. “Genel”: süresi dolmuş bütün ödevler,
                gönderilmeyen 0 sayılır.
              </p>
              {veri.ogrenciler.length === 0 ? (
                <Card>
                  <p className="mb-1 font-semibold text-ink">Bu sınıfta öğrenci yok.</p>
                  {baglanti.ogrencilerSayfasi && (
                    <>
                      <p className="mb-3 text-[14px] text-muted">
                        Öğrenciler sekmesinden ekleyebilirsiniz.
                      </p>
                      <Button tur="sade" onClick={() => git(baglanti.ogrencilerSayfasi as string)}>
                        Öğrencilere git
                      </Button>
                    </>
                  )}
                </Card>
              ) : veri.degerlendirilen_odev === 0 ? (
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
                      <OgrenciKarti
                        ogrenci={o}
                        odevler={veri.odevler}
                        toplam={veri.degerlendirilen_odev}
                        ozelSinif={veri.sinif.ozel}
                        {...(baglanti.ogrenci ? { bag: baglanti.ogrenci(o.id) } : {})}
                        acik={acik === o.id}
                        degistir={() => setAcik((a) => (a === o.id ? null : o.id))}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 2. AYLIK GELİŞİM */}
            <Card>
              <h2 className="text-[18px] text-ink">Aylık gelişim</h2>
              <p className="mb-3 text-[13px] text-muted">
                Süresi dolmuş ödevlerde gönderilen çözümlerin ortalaması ve gönderim oranı.
              </p>
              <CizgiGrafik
                baslik={`${veri.sinif.ad} aylık ortalaması ve gönderim oranı`}
                etiketler={veri.aylar.map((a) => ayEtiketi(a.ay))}
                uzunEtiketler={veri.aylar.map((a) => AY_UZUN.format(gun(a.ay)))}
                seriler={[
                  {
                    ad: 'Ortalama',
                    renk: 'mavi',
                    birim: '',
                    degerler: veri.aylar.map((a) => sayiya(a.ortalama)),
                  },
                  {
                    ad: 'Gönderim oranı',
                    renk: 'turuncu',
                    birim: '%',
                    degerler: veri.aylar.map((a) => sayiya(a.gonderim_orani)),
                  },
                ]}
                ekSutunlar={[{ ad: 'Ödev', degerler: veri.aylar.map((a) => a.odev_sayisi) }]}
                bosMetni="Bu eğitim yılında süresi dolmuş ödev yok."
              />
            </Card>

            {/* 3. ÖDEVLER VE SORU SAYILARI */}
            <Card>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[18px] text-ink">Ödevler</h2>
                <p className="text-[14px] text-muted">
                  <span className="sk-sayi font-semibold text-ink">{veri.odevler.length}</span> ödev ·{' '}
                  <span className="sk-sayi font-semibold text-ink">{SAYI.format(soruToplami)}</span>{' '}
                  soru
                </p>
              </div>
              {veri.odevler.length === 0 ? (
                <p className="text-[14px] text-muted">Bu sınıfta yayınlanmış ödev yok.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {veri.odevler.map((o) => (
                    <OdevSatiri key={o.id} odev={o} mevcut={veri.mevcut} />
                  ))}
                </ul>
              )}
            </Card>

            {/* 4. KONU KARNESİ (0023). Ayrı yükleniyor; yukarıdaki liste
                onu beklemesin. */}
            <KonuKarnesiBolumu sinifId={sinifId} />
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}

function OdevSatiri({ odev: o, mevcut }: { odev: Odev; mevcut: number }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] font-semibold text-ink">{o.baslik}</p>
        <p className="text-[13px] text-muted">
          {o.ogretmen ?? '—'} · {o.tur === 'test' ? 'test' : 'açık uçlu'} · son tarih{' '}
          {TARIH.format(gun(o.son_tarih))}
        </p>
      </div>
      <p className="shrink-0 text-right text-[13px] text-muted">
        <span className="sk-sayi text-[15px] font-semibold text-ink">
          {o.soru_sayisi === null ? 'soru sayısı yok' : `${o.soru_sayisi} soru`}
        </span>
        <br />
        <span className="sk-sayi">
          {o.gonderim}/{mevcut}
        </span>{' '}
        gönderdi
        {o.sure_doldu ? <> · ort. {ortalamaYazisi(o.ortalama) ?? '—'}</> : <> · süresi sürüyor</>}
      </p>
    </li>
  );
}

function OgrenciKarti({
  ogrenci: o,
  odevler,
  toplam,
  ozelSinif,
  bag,
  acik,
  degistir,
}: {
  ogrenci: Ogrenci;
  odevler: Odev[];
  toplam: number;
  ozelSinif: boolean;
  bag?: string;
  acik: boolean;
  degistir: () => void;
}) {
  const oran = toplam > 0 ? o.yapti / toplam : 0;
  const vurgu = o.yapti === 0 ? 'tehlike' : oran < 0.5 ? 'uyari' : 'yok';
  const panelId = `ogrenci-${o.id}`;

  // Grafik ve liste: süresi dolmuş ödevler + süresi sürerken gönderilenler.
  // Gönderilmemiş ödev grafikte BOŞLUK, listede "Gönderilmedi" — sıfır
  // değil (`GelisimSatiri` kuralı).
  const satirlar = o.puanlar
    .map((p, i) => ({ p, odev: odevler[i] }))
    .filter((x): x is { p: Ogrenci['puanlar'][number]; odev: Odev } => !!x.odev)
    .filter((x) => x.p.durum === 'gondermedi' || (x.p.durum === 'gonderdi' && x.p.puan !== null));
  const suruyor = o.puanlar.filter((p) => p.durum === 'suresi_devam').length;
  const puansiz = o.puanlar.filter((p) => p.durum === 'gonderdi' && p.puan === null).length;
  const gelisim: GelisimSatiri[] = satirlar.map((x) => ({
    odev: x.odev.baslik,
    tarih: x.odev.son_tarih,
    tur: x.odev.tur,
    deger: x.p.durum === 'gonderdi' ? sayiya(x.p.puan) : null,
  }));

  return (
    <Card vurgu={vurgu}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {o.ogrenci_no && (
            <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] font-semibold text-muted">
              {o.ogrenci_no}
            </span>
          )}
          {bag ? (
            <Link
              to={bag}
              className="inline-flex min-h-[44px] items-center font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              {o.ad}
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center font-semibold text-ink">{o.ad}</span>
          )}
          <p className="mt-1 text-[13px] text-muted">
            <span className="sk-sayi font-semibold text-ink">{o.yapti}</span> yaptı ·{' '}
            <span className="sk-sayi font-semibold text-ink">{o.yapmadi}</span> yapmadı
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Yaptıkları</p>
            <p className="sk-sayi text-[20px] font-semibold text-ink">
              {ortalamaYazisi(o.ortalama_yapan) ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Genel</p>
            <p className="sk-sayi text-[20px] font-semibold text-ink">
              {ortalamaYazisi(o.ortalama_tum) ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {o.tur === 'ozel' && !ozelSinif && (
        <div className="mt-2">
          <Tag tur="uyari">Özel ders</Tag>
        </div>
      )}

      <button
        type="button"
        onClick={degistir}
        aria-expanded={acik}
        aria-controls={panelId}
        className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[14px] text-link underline-offset-4 hover:underline"
      >
        Ödev ödev puanlar <span aria-hidden="true">{acik ? '▴' : '▾'}</span>
      </button>

      {acik && (
        <div id={panelId} className="mt-1 rounded-sk-sm bg-paper p-3">
          {gelisim.length === 0 ? (
            <p className="text-[14px] text-muted">Henüz değerlendirilmiş ödev yok.</p>
          ) : (
            <>
              <CizgiGrafik
                baslik={`${o.ad} ödev puanları`}
                etiketler={satirlar.map((x) => TARIH.format(gun(x.odev.son_tarih)))}
                uzunEtiketler={satirlar.map((x) => x.odev.baslik)}
                seriler={[{ ad: 'Puan', renk: 'mavi', birim: '', degerler: gelisim.map((g) => g.deger) }]}
              />
              <div className="mt-3">
                <Gelisim satirlar={gelisim} kapsam="ogrenci" />
              </div>
            </>
          )}
          {suruyor > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              <span className="sk-sayi">{suruyor}</span> ödevin süresi sürüyor; ortalamaya
              girmedi.
            </p>
          )}
          {puansiz > 0 && (
            <p className="mt-1 text-[12px] text-muted">
              <span className="sk-sayi">{puansiz}</span> gönderim henüz puanlanmadı.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
