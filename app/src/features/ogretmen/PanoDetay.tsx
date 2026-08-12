import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { PanoDetayi, PanoSatiri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

const TURLER = ['ogrenci', 'acik_odev', 'gondermeyen', 'puan_bekleyen'] as const;
type PanoTuru = (typeof TURLER)[number];

/**
 * Pano kutusunun arkasındaki liste.
 *
 * Dört kutunun dördü de buraya geliyor; sunucu dördü için aynı zarfı
 * döndürüyor (`gruplar → satirlar`). Tek ekran, dört içerik: dört ayrı
 * ekran yazsaydık gruplama ve boş durum dört yerde ayrı bakım isterdi.
 *
 * GRUPLAMA SUNUCUDAN GELİYOR — sıralama kuralı (sayısal sınıflar sırayla,
 * Özel ders en sonda) `siniflar.seviye` üzerinden orada kurulu; istemcide
 * yeniden kurmak iki farklı sıralama riski demekti.
 */
export function PanoDetay() {
  const { tur = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  const gecerli = (TURLER as readonly string[]).includes(tur);

  const { veri, durum, hata, yenile } = useVeri<PanoDetayi>(
    'pano_detay',
    { p_token: oturum?.token, p_tur: gecerli ? tur : 'ogrenci' },
    (v) => v.gruplar.length === 0,
  );

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen')}>
          ← Bugün
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik={bosBaslik(tur as PanoTuru)}
        bosAciklama={bosAciklama(tur as PanoTuru)}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-5">
              <h1 className="font-display text-[24px] font-semibold text-ink">{veri.baslik}</h1>
              <p className="mt-1 text-[14px] text-muted">{veri.aciklama}</p>
              <p className="mt-2 text-[14px] text-ink">
                <span className="sk-sayi font-semibold">{veri.toplam}</span> kayıt
              </p>
            </div>

            <div className="grid gap-4">
              {veri.gruplar.map((g) => (
                <section key={g.sinif}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[18px] font-semibold text-ink">{g.sinif}</h2>
                    {/* Özel grupta etiket YOK: başlığın kendisi zaten
                        "Özel ders" yazıyor, ikisi birden tekrar olurdu. */}
                    <span className="sk-sayi text-[13px] text-muted">{g.satirlar.length}</span>
                  </div>
                  <Card>
                    <ul className="divide-y divide-line">
                      {g.satirlar.map((s, i) => (
                        <li key={i} className="py-2 first:pt-0 last:pb-0">
                          <Satir tur={tur as PanoTuru} satir={s} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              ))}
            </div>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function Satir({ tur, satir: s }: { tur: PanoTuru; satir: PanoSatiri }) {
  if (tur === 'acik_odev') {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{s.ad}</span>
        <span className="text-[13px] text-muted">
          {s.son_tarih && TARIH.format(new Date(s.son_tarih))}
          {s.gonderim_sayisi !== undefined && (
            <>
              {' · '}
              <span className="sk-sayi">{s.gonderim_sayisi}</span> gönderim
            </>
          )}
        </span>
      </div>
    );
  }

  if (tur === 'gondermeyen') {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{s.ad}</span>
        <span className="text-[13px] text-danger">
          <span className="sk-sayi">{s.eksik}</span> ödev eksik
        </span>
      </div>
    );
  }

  if (tur === 'puan_bekleyen') {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{s.ad}</span>
        <span className="text-[13px] text-muted">{s.odev}</span>
      </div>
    );
  }

  return <span className="text-ink">{s.ad}</span>;
}

function bosBaslik(tur: PanoTuru): string {
  if (tur === 'gondermeyen') return 'Herkes göndermiş';
  if (tur === 'puan_bekleyen') return 'Puan bekleyen yok';
  if (tur === 'acik_odev') return 'Açık ödev yok';
  return 'Ödev verilen öğrenci yok';
}

function bosAciklama(tur: PanoTuru): string {
  if (tur === 'gondermeyen') return 'Süresi dolmuş ödevlerin hepsi teslim edilmiş.';
  if (tur === 'puan_bekleyen') return 'Açık uçlu gönderimlerin hepsi puanlanmış.';
  if (tur === 'acik_odev') return 'Süresi devam eden bir ödev yok.';
  return 'Bir sınıfa ödev yayınlayınca öğrencileri burada göreceksiniz.';
}
