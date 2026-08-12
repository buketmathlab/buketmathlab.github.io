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
 * Pano kutusunun arkasındaki liste — İKİ KADEMELİ.
 *
 * Önce SINIF LİSTESİ, sınıfa dokununca o sınıfın satırları. Öğretmenin
 * isteği ve gerekçesi: bir sınıfta otuz öğrenci var; on üç sınıfın hepsini
 * alt alta açmak yüzlerce satırlık bir kaydırma demek. Aradığı öğrenciyi
 * bulmanın yolu önce sınıfı seçmekten geçiyor.
 *
 * DÖRT KUTU DA AYNI ŞEKİLDE ÇALIŞIYOR. "Açık ödev" listesi kısa olduğu
 * için doğrudan açmak cazip ama kutudan kutuya değişen davranış tahmin
 * edilemez olurdu; sınıf adı zaten dördünde de öğretmenin ilk sorusu.
 *
 * Tek RPC, tek zarf: `pano_detay` gruplu döndüğü için ikinci kademe yeni
 * bir istek atmıyor, aynı yanıtın içinden grubu buluyor.
 *
 * SIRALAMA SUNUCUDAN GELİYOR — sayısal sınıflar sırayla, Özel ders en
 * sonda; kural `siniflar.seviye` üzerinden orada kurulu.
 */
export function PanoDetay() {
  const { tur = '', sinif } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  const gecerli = (TURLER as readonly string[]).includes(tur);
  const t = (gecerli ? tur : 'ogrenci') as PanoTuru;
  /* Rotadaki sınıf adı kodlanmış geliyor ("Özel%20ders"); react-router
     çözüyor ama emin olmak için burada da normalleştirmiyoruz — çift
     çözme "%" içeren bir adı bozardı. */
  const secilenSinif = sinif ?? null;

  const { veri, durum, hata, yenile } = useVeri<PanoDetayi>(
    'pano_detay',
    { p_token: oturum?.token, p_tur: t },
    (v) => v.gruplar.length === 0,
  );

  const grup = veri && secilenSinif ? veri.gruplar.find((g) => g.sinif === secilenSinif) : null;

  return (
    <>
      <div className="mb-4">
        <Button
          tur="sade"
          olcu="sm"
          onClick={() => git(secilenSinif ? `/ogretmen/bugun/${tur}` : '/ogretmen')}
        >
          {secilenSinif ? `← ${veri?.baslik ?? 'Geri'}` : '← Bugün'}
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik={bosBaslik(t)}
        bosAciklama={bosAciklama(t)}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && !secilenSinif && (
          <>
            <div className="mb-5">
              <h1 className="font-display text-[24px] font-semibold text-ink">{veri.baslik}</h1>
              <p className="mt-1 text-[14px] text-muted">{veri.aciklama}</p>
              <p className="mt-2 text-[14px] text-ink">
                <span className="sk-sayi font-semibold">{veri.toplam}</span> {birim(t)} ·{' '}
                <span className="sk-sayi font-semibold">{veri.gruplar.length}</span> sınıf
              </p>
            </div>

            {/* Sınıf listesi. Tüm satır bir düğme: 360 px'de küçük bir
                bağlantı metnini hedeflemek zor, satırın tamamı rahat. */}
            <Card>
              <ul className="divide-y divide-line">
                {veri.gruplar.map((g) => (
                  <li key={g.sinif}>
                    <button
                      type="button"
                      onClick={() =>
                        git(`/ogretmen/bugun/${tur}/${encodeURIComponent(g.sinif)}`)
                      }
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <span className="font-display text-[18px] font-semibold text-ink">
                        {g.sinif}
                      </span>
                      <span className="flex items-center gap-2 text-[14px] text-muted">
                        <span className="sk-sayi">{g.satirlar.length}</span>
                        <Ok />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {veri && secilenSinif && (
          <>
            <div className="mb-4">
              <h1 className="font-display text-[24px] font-semibold text-ink">{secilenSinif}</h1>
              <p className="mt-1 text-[14px] text-muted">
                {veri.baslik}
                {grup && (
                  <>
                    {' · '}
                    <span className="sk-sayi">{grup.satirlar.length}</span> {birim(t)}
                  </>
                )}
              </p>
            </div>

            {/* Grup bulunamayabilir: öğretmen sayfayı yeniledi ve o sınıfta
                artık hiç kayıt kalmadıysa. Boş bir kart göstermek yerine ne
                olduğunu söylüyoruz. */}
            {!grup ? (
              <Card>
                <p className="font-semibold text-ink">Bu sınıfta kayıt kalmamış</p>
                <p className="mt-1 text-[14px] text-muted">
                  Liste siz bakarken güncellenmiş olabilir. Sınıf listesine dönüp tekrar
                  bakabilirsiniz.
                </p>
              </Card>
            ) : (
              <Card>
                <ul className="divide-y divide-line">
                  {grup.satirlar.map((s, i) => (
                    <li key={i} className="py-2 first:pt-0 last:pb-0">
                      <Satir tur={t} satir={s} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function Ok() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
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

/** Sayının yanına ne yazılacağı — "12 kayıt" değil, "12 öğrenci". */
function birim(tur: PanoTuru): string {
  if (tur === 'acik_odev') return 'ödev';
  if (tur === 'puan_bekleyen') return 'gönderim';
  return 'öğrenci';
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
