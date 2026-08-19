import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { VeliPaneli } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const PARA = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/**
 * Velinin ödeme dökümü — özel derste.
 *
 * PARA VELİNİN VE ÖĞRETMENİN MESELESİ. Öğretmenin kalıcı kuralı:
 * "Ödeme detaylarını öğrenci görmesin." Bu ekranın öğrenci karşılığı
 * YOK ve olmayacak; sınır arayüzde değil sunucuda: `ogrenci_odevleri`
 * öğrenciye tutar, ödendi, tarih diye bir alan hiç göndermiyor
 * (`ozel_ders_takibi_testleri.sql` 4. grubu alan adını ve gerçek tutar
 * değerini ayrı ayrı arıyor).
 *
 * ROTASI OKUL VELİSİNDE DE TANIMLI, sekmesi çıkmasa bile. Rotayı
 * kaldırmak, adresi elle yazan ya da eski bir bağlantıyı açan veliye
 * beyaz ekran verirdi. Ekran o durumda açıklayıcı bir cümle gösteriyor
 * ve zaten gösterecek verisi de yok — sunucu okul öğrencisinde boş dizi
 * döndürüyor.
 *
 * ÖDEME `id`'Sİ GELMİYOR. Veli ödeme kaydını değiştiremez; `odeme_*`
 * uçları öğretmene özel ve `veli_paneli` id taşımıyor.
 */
export function VeliOdemeler() {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<VeliPaneli>('veli_paneli', {
    p_token: oturum?.token,
  });

  const odemeler = veri?.odemeler ?? [];
  const toplam = odemeler.reduce((t, p) => t + Number(p.tutar), 0);
  const odenen = odemeler
    .filter((p) => p.odendi)
    .reduce((t, p) => t + Number(p.tutar), 0);
  const kalan = toplam - odenen;

  return (
    <>
      <h1 className="mb-5 text-[24px] text-ink">Ödemeler</h1>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Ödeme bilgisi yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            {odemeler.length === 0 ? (
              <Card>
                <p className="text-[14px] text-muted">
                  {veri.ogrenci.tur === 'ozel'
                    ? 'Henüz kayıtlı bir ödeme yok.'
                    : 'Ödeme takibi yalnızca özel ders öğrencilerinde tutuluyor.'}
                </p>
              </Card>
            ) : (
              <>
                {/* TEK KART, ÜÇ SATIR — üç sütunlu ızgara DEĞİL. 360 px'de
                    üç sütunda kart içi genişlik 69 px kalıyor ve
                    "₺12.500,00" 114 px; ölçülmüştü, taşıyordu (0021). */}
                <Card className="mb-4">
                  <ul className="divide-y divide-line">
                    <Satir etiket="Toplam" tutar={toplam} />
                    <Satir etiket="Ödenen" tutar={odenen} />
                    <Satir etiket="Kalan" tutar={kalan} vurgu={kalan > 0} />
                  </ul>
                </Card>

                <Card>
                  <ul className="divide-y divide-line">
                    {odemeler.map((p, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-[14px] text-ink">
                          {TARIH.format(new Date(p.tarih))}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="sk-sayi text-[14px] text-ink">
                            {PARA.format(p.tutar)}
                          </span>
                          <Tag tur={p.odendi ? 'basari' : 'uyari'}>
                            {p.odendi ? 'Ödendi' : 'Bekliyor'}
                          </Tag>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function Satir({
  etiket,
  tutar,
  vurgu,
}: {
  etiket: string;
  tutar: number;
  vurgu?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-[14px] text-muted">{etiket}</span>
      <span
        className={`sk-sayi text-[16px] font-semibold ${
          vurgu ? 'text-danger' : 'text-ink'
        }`}
      >
        {PARA.format(tutar)}
      </span>
    </li>
  );
}
