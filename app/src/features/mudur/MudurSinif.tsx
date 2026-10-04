import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { CizgiGrafik } from '@/components/grafik/CizgiGrafik';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Gelisim } from '@/components/ui/Gelisim';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { ayEtiketi, sayiya } from '@/lib/grafik';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { GelisimSatiri, SinifNotCizelgesi } from '@/types/api';
import { useMudurPaneli } from './mudur-baglam';

const SAYI = new Intl.NumberFormat('tr-TR');
const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const AY_UZUN = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const gun = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

type Ogrenci = SinifNotCizelgesi['ogrenciler'][number];
type Odev = SinifNotCizelgesi['odevler'][number];

/**
 * Müdür → bir sınıf (0061): gelişim, ödevler (soru sayısıyla) ve
 * öğrencilerin bireysel notları.
 *
 * Öğretmenin kararı: müdür bütün öğrencilerin notlarını görür (velilere
 * duyuru yapıldı). Cevaplar, öğretmen yorumları ve mesajlar YOK; uç
 * (`sinif_not_cizelgesi`) onları hiç döndürmüyor.
 *
 * ORTALAMA sınıf listesi çıktısıyla aynı kural (`sinif_ogrenci_ozeti`):
 * süresi dolmuş ve gönderilmemiş ödev 0 sayılır. Ekran bunu yazıyor;
 * yazmasaydı "ortalama 40" göndermediği ödevlerden mi düşük puandan mı
 * belli olmazdı.
 *
 * RENK PUANA GÖRE DEĞİŞMİYOR (`Gelisim` ve `SinifDetay`'daki gerekçe).
 */
export function MudurSinif() {
  const { id = '' } = useParams();
  const git = useNavigate();
  const { oturum } = useOturum();
  const { kok } = useMudurPaneli();
  const [acik, setAcik] = useState<string | null>(null);

  const { veri, durum, hata, yenile } = useVeri<SinifNotCizelgesi>('sinif_not_cizelgesi', {
    p_token: oturum?.token,
    p_sinif_id: id,
  });

  const soruToplami = veri?.odevler.reduce((t, o) => t + (o.soru_sayisi ?? 0), 0) ?? 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(`${kok}/siniflar`)}>
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
            <SayfaBasligi
              baslik={veri.sinif.ad}
              aciklama={`${veri.sinif.ogretmenler.join(', ') || 'Öğretmen atanmamış'} · ${veri.mevcut} öğrenci`}
              eylem={
                <div className="flex flex-wrap gap-2">
                  <Button tur="sade" olcu="sm" onClick={() => git(`${kok}/siniflar/${id}/analiz`)}>
                    Konu analizi
                  </Button>
                  <Button tur="sade" olcu="sm" onClick={() => git(`${kok}/siniflar/${id}/onam`)}>
                    Onam dökümü
                  </Button>
                </div>
              }
            />

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

            <Card>
              <h2 className="text-[18px] text-ink">Öğrenci notları</h2>
              <p className="mb-3 text-[13px] text-muted">
                Ortalama, süresi dolmuş ödevlerden; gönderilmeyen ödev 0 sayılır. Ayrıntı için
                öğrenciye dokunun.
              </p>
              {veri.ogrenciler.length === 0 ? (
                <p className="text-[14px] text-muted">Bu sınıfta öğrenci yok.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {veri.ogrenciler.map((o) => (
                    <OgrenciSatiri
                      key={o.id}
                      ogrenci={o}
                      odevler={veri.odevler}
                      acik={acik === o.id}
                      degistir={() => setAcik((a) => (a === o.id ? null : o.id))}
                    />
                  ))}
                </ul>
              )}
            </Card>
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
          {o.soru_sayisi === null ? '—' : `${o.soru_sayisi} soru`}
        </span>
        <br />
        <span className="sk-sayi">
          {o.gonderim}/{mevcut}
        </span>{' '}
        gönderdi
        {o.sure_doldu ? (
          <> · ort. {ortalamaYazisi(o.ortalama) ?? '—'}</>
        ) : (
          <> · süresi sürüyor</>
        )}
      </p>
    </li>
  );
}

function OgrenciSatiri({
  ogrenci: o,
  odevler,
  acik,
  degistir,
}: {
  ogrenci: Ogrenci;
  odevler: Odev[];
  acik: boolean;
  degistir: () => void;
}) {
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
    <li>
      <button
        type="button"
        onClick={degistir}
        aria-expanded={acik}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-line-soft"
      >
        <span className="sk-sayi w-10 shrink-0 text-[13px] text-muted">{o.ogrenci_no ?? ''}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-semibold text-ink">{o.ad}</span>
          <span className="block text-[13px] text-muted">
            <span className="sk-sayi">{o.yapilan}</span>/
            <span className="sk-sayi">{o.yapilan + o.yapilmayan}</span> ödev yaptı
          </span>
        </span>
        <span className="sk-sayi shrink-0 font-display text-[22px] font-semibold text-ink">
          {ortalamaYazisi(o.ortalama) ?? '—'}
        </span>
        <span aria-hidden="true" className="w-4 shrink-0 text-muted">
          {acik ? '▴' : '▾'}
        </span>
      </button>

      {acik && (
        <div id={panelId} className="mb-3 rounded-sk-sm bg-paper p-3">
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
    </li>
  );
}
