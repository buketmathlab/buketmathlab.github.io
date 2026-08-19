import { Card } from '@/components/ui/Card';
import { Gelisim } from '@/components/ui/Gelisim';
import { KonuListesi } from '@/components/ui/KonuListesi';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { karneSozu } from '@/lib/karne-sozu';
import type { KendiKarnem } from '@/types/api';

/**
 * Öğrencinin kendi konu karnesi (0026).
 *
 * 0023'te konu karnesini yazarken bunu BİLEREK dışarıda bırakmıştım:
 * dönem geneli "zayıf konular" listesini bir çocuğa göstermek ayrı bir
 * karardı. Öğretmen bu turda o kararı verdi.
 *
 * KIYAS YOK — VE SINIR SUNUCUDA. `kendi_karnem` sınıf mevcudunu,
 * ortalamasını, başka öğrencinin tek bir verisini bile göndermiyor;
 * burada gizlenen bir şey yok çünkü hiç gelmiyor (Part XXI).
 *
 * EWALU BURADA, BİR KEZ. Bu ekran çocuğun kendi eksikleriyle karşılaştığı
 * yer; tek bir cümle onu yumuşatıyor. Ama Ödevler ve Mesajlar
 * sekmelerinde Ewalu YOK — her sekmeye koymak Part VII'nin açıkça
 * uyardığı şey.
 *
 * CÜMLE `lib/karne-sozu.ts`'te ve TASLAK: öğretmen tek dosyadan
 * değiştirebilir (`ewalu-puan.ts` ile aynı desen).
 */
export function OgrenciKarnem() {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<KendiKarnem>('kendi_karnem', {
    p_token: oturum?.token,
  });

  // 0026 HENÜZ PANELDE ÇALIŞTIRILMADIYSA. PostgREST'in cevabı İngilizce ve
  // teknik; onu bir çocuğa göstermek ekranı bozuk gösterirdi. Gerçekte
  // eksik olan tek şey bir SQL dosyası (`KonuKarnesiBolumu`'ndaki desen).
  const ucYok = hata !== null && /could not find the function|schema cache/i.test(hata);

  const soz = veri ? karneSozu(veri.konular, veri.odev_sayisi) : null;

  return (
    <>
      <h1 className="mb-1 font-display text-[24px] font-semibold text-ink">Konularım</h1>
      <p className="mb-5 text-[14px] text-muted">
        Dönem boyunca hangi konuda ne durumdasın.
      </p>

      {ucYok ? (
        <Card>
          <p className="text-[15px] text-ink">Bu bölüm henüz açılmadı.</p>
          <p className="mt-1 text-[14px] text-muted">
            Öğretmenin açtığında konularını burada göreceksin.
          </p>
        </Card>
      ) : (
        <AsyncBoundary
          durum={durum}
          bosBaslik="Henüz bir şey yok"
          bosAciklama="Ödevlerin değerlendirildikçe burada göreceksin."
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          {veri && soz && (
            <>
              <Card className="mb-6">
                <div className="flex items-start gap-3">
                  <EwaluFigure poz="calisma" boyut={56} dekoratif className="shrink-0" />
                  <p className="text-[15px] text-ink">{soz.ogrenci}</p>
                </div>
              </Card>

              {/* KAÇ ÖDEV ÜZERİNDEN konuşuyoruz. Bu sayı olmadan iki konu
                  arasındaki fark yorumlanamaz — tek soruluk bir konunun ne
                  kadar zayıf bir kanıt olduğu ancak böyle görülür. */}
              <p className="mb-3 text-[13px] text-muted">
                <span className="sk-sayi">{veri.odev_sayisi}</span> değerlendirilmiş ödev
                üzerinden.
              </p>

              {veri.konular.length > 0 && (
                <Card className="mb-6">
                  <KonuListesi analiz={veri.konular} ses="ogrenci" kapsam="donem" />
                </Card>
              )}

              {veri.gelisim.length > 0 && (
                <>
                  <h2 className="mb-3 text-[18px] text-ink">Ödev ödev</h2>
                  <Card>
                    {/* `kapsam="ogrenci"`: bileşen sınıf sayılarını
                        çizmiyor — zaten sunucudan da gelmiyor. */}
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
