import { Card } from '@/components/ui/Card';
import { Gelisim } from '@/components/ui/Gelisim';
import { KonuListesi } from '@/components/ui/KonuListesi';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { karneSozu } from '@/lib/karne-sozu';
import type { KendiKarnem } from '@/types/api';

/**
 * Velinin gördüğü konu karnesi (0026).
 *
 * ÖĞRENCİYLE AYNI UÇ, AYNI VERİ. `kendi_karnem` parametresiz; veli de
 * öğrenci de oturumdan gelen aynı çocuğa bağlı. İki ayrı uç yazsaydık bir
 * gün iki farklı sayı üretebilirlerdi — test ikisinin AYNI karneyi
 * gördüğünü ayrıca ölçüyor.
 *
 * EWALU YOK. Velinin Panosunda zaten var; ikinci bir yerde daha çıkarmak
 * Part VII'nin uyardığı "her ekranda Ewalu" durumu olurdu. Cümle burada
 * üçüncü tekille ve figürsüz.
 *
 * KIYAS YOK: sınıf mevcudu da ortalaması da sunucudan hiç gelmiyor.
 * "Çocuğum sınıfın neresinde" sorusu bu ekranın cevaplamadığı bir soru ve
 * bu bilinçli — veli çocuğun KENDİ gidişatını görüyor.
 *
 * KURAL 6: cevap anahtarı burada da yok. `kendi_karnem` yalnız sayı
 * döndürüyor (`kendi_karnem_testleri.sql` 2. grubu ölçüyor).
 */
export function VeliKarne() {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<KendiKarnem>('kendi_karnem', {
    p_token: oturum?.token,
  });

  const ucYok = hata !== null && /could not find the function|schema cache/i.test(hata);
  const soz = veri ? karneSozu(veri.konular, veri.odev_sayisi) : null;

  return (
    <>
      <h1 className="mb-1 text-[24px] text-ink">Konular</h1>
      <p className="mb-5 text-[14px] text-muted">
        Çocuğunuzun dönem boyunca hangi konuda ne durumda olduğu.
      </p>

      {ucYok ? (
        <Card>
          <p className="text-[15px] text-ink">Bu bölüm henüz açılmadı.</p>
          <p className="mt-1 text-[14px] text-muted">
            Öğretmen açtığında konu dökümü burada görünecek.
          </p>
        </Card>
      ) : (
        <AsyncBoundary
          durum={durum}
          bosBaslik="Henüz bilgi yok"
          bosAciklama="Ödevler değerlendirildikçe burada göreceksiniz."
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          {veri && soz && (
            <>
              <Card className="mb-6">
                <p className="text-[15px] text-ink">{soz.veli}</p>
              </Card>

              {/* GENEL ORTALAMA (0029). Öğrencinin ekranındakiyle AYNI
                  sayı, aynı uçtan — iki yerde iki farklı ortalama
                  çıkması en olası hataydı ve testi ayrıca var.
                  Sınıf ortalaması burada da yok. */}
              {(veri.genel_ortalama ?? null) !== null && (
                <p className="mb-2 text-[15px] text-ink">
                  Genel ortalaması{' '}
                  <span className="sk-sayi font-bold">{veri.genel_ortalama}</span>
                </p>
              )}

              <p className="mb-3 text-[13px] text-muted">
                <span className="sk-sayi">{veri.odev_sayisi}</span> değerlendirilmiş ödev
                üzerinden.
              </p>

              {veri.konular.length > 0 && (
                <Card className="mb-6">
                  {/* `ses="ucuncu"`: veli ekranında "sen" diye seslenmek
                      yanlış muhatap olurdu. */}
                  <KonuListesi analiz={veri.konular} ses="ucuncu" kapsam="donem" />
                </Card>
              )}

              {veri.gelisim.length > 0 && (
                <>
                  <h2 className="mb-3 text-[18px] text-ink">Ödev ödev</h2>
                  <Card>
                    <Gelisim satirlar={veri.gelisim} kapsam="ogrenci" />
                  </Card>
                </>
              )}
            </>
          )}
        </AsyncBoundary>
      )}
    </>
  );
}
