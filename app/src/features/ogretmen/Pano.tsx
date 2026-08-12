import { Link } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { Pano as PanoVerisi } from '@/types/api';

function Sayi({
  deger,
  etiket,
  vurgu,
}: {
  deger: number;
  etiket: string;
  vurgu?: 'tehlike' | 'uyari';
}) {
  const renk =
    vurgu === 'tehlike' && deger > 0
      ? 'text-danger'
      : vurgu === 'uyari' && deger > 0
        ? 'text-warning'
        : 'text-ink';
  return (
    <Card className="text-center">
      <p className={`sk-sayi font-display text-[30px] font-semibold ${renk}`}>{deger}</p>
      <p className="mt-1 text-[13px] text-muted">{etiket}</p>
    </Card>
  );
}

/**
 * Öğretmen panosu.
 *
 * Tek soruya cevap verir: **bugün neye bakmalıyım?**
 * Bu yüzden dört sayı ve son gönderimlerden ibaret. Pano, veriyi sergilemek
 * için değil karar aldırmak için var; grafik yığını dikkat dağıtır.
 */
export function Pano() {
  const { oturum } = useOturum();
  const { veri, durum, hata, yenile } = useVeri<PanoVerisi>('ogretmen_panosu', {
    p_token: oturum?.token,
  });

  return (
    <>
      <SayfaBasligi baslik="Bugün" aciklama="Dikkat etmeniz gereken şeyler." />

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz veri yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
        yuklemeAdedi={2}
      >
        {veri && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Sayi deger={veri.ogrenci_sayisi} etiket="Öğrenci" />
              <Sayi deger={veri.acik_odev} etiket="Açık ödev" />
              <Sayi deger={veri.gecikmis_eksik} etiket="Göndermeyen" vurgu="tehlike" />
              <Sayi
                deger={veri.bekleyen_degerlendirme}
                etiket="Puan bekliyor"
                vurgu="uyari"
              />
            </div>

            {veri.ogrenci_sayisi === 0 && (
              <Card className="mt-4">
                <div className="flex items-center gap-4">
                  <EwaluFigure poz="kesif" boyut={72} dekoratif />
                  <div>
                    <p className="font-semibold text-ink">Başlamak için öğrenci ekleyin</p>
                    <p className="mt-1 text-[14px] text-muted">
                      Sınıflar hazır.{' '}
                      <Link to="/ogretmen/ogrenciler" className="font-bold text-link underline">
                        Öğrenciler
                      </Link>{' '}
                      bölümünden ilk öğrencinizi ekleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <h2 className="mb-3 mt-8 text-[18px] text-ink">Son gönderimler</h2>
            {veri.son_gonderimler.length === 0 ? (
              <Card>
                <p className="text-[14px] text-muted">Henüz gönderim yok.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {veri.son_gonderimler.map((g, i) => (
                  <Card key={i}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{g.ogrenci}</p>
                        <p className="truncate text-[13px] text-muted">{g.odev}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {/* Gecikme burada da görünür: pano öğretmenin
                            "bugün ne oldu" ekranı, gecikmeyi başka bir
                            yere bakarak öğrenmemeli. */}
                        {g.gecikmeli && <Tag tur="uyari">Gecikmeli</Tag>}
                        {g.puan === null ? (
                          <Tag tur="uyari">Puan bekliyor</Tag>
                        ) : (
                          <Tag tur="basari">
                            {/* Sayı ve kelime TEK metin düğümünde: Tag
                                inline-flex olduğu için aralarındaki boşluk
                                ayrı düğüm olsaydı yok olurdu ("92puan"). */}
                            <span className="sk-sayi">{g.puan} puan</span>
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}
