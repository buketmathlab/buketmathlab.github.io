import { Card } from '@/components/ui/Card';
import { Gelisim } from '@/components/ui/Gelisim';
import { KonuListesi } from '@/components/ui/KonuListesi';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import type { KonuKarnesi } from '@/types/api';

/**
 * Dönem geneli konu karnesi ve gelişim — sınıf ya da tek öğrenci için.
 *
 * TEK BİLEŞEN, İKİ EKRAN. `SinifDetay` ve `OgrenciDetay` aynı iki bölümü
 * gösteriyor; iki kopya zamanla ayrışır ve bir gün aynı öğrenci için iki
 * farklı döküm çizerdi (0013'te aynı gerekçeyle tek bileşen seçilmişti).
 *
 * AYRI YÜKLENİYOR. Karne, ölçülen en kötü durumda (35 öğrenci × 40 ödev ×
 * 20 soru) 169 ms sürüyor; sayfanın geri kalanı onu beklememeli. Kendi
 * `useVeri`'si var, üstteki bölümler kendi hızlarında geliyor.
 *
 * BOŞ DURUMDA GRAFİK ÇİZİLMİYOR. Okullar henüz açılmadı; bu ekranların
 * çoğu bir süre boş kalacak. Boş bir çubuk listesi çizmek yerine neden boş
 * olduğu yazıyor (Part XLI: dört durumun dördü de düşünülmüş olmalı).
 */
export function KonuKarnesiBolumu({
  sinifId,
  ogrenciId,
}: {
  sinifId?: string;
  ogrenciId?: string;
}) {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<KonuKarnesi>('konu_karnesi', {
    p_token: oturum?.token,
    ...(sinifId ? { p_sinif_id: sinifId } : {}),
    ...(ogrenciId ? { p_ogrenci_id: ogrenciId } : {}),
  });

  // 0023 HENÜZ PANELDE ÇALIŞTIRILMADIYSA. PostgREST'in cevabı İngilizce ve
  // teknik ("Could not find the function … in the schema cache"); onu
  // olduğu gibi göstermek öğretmene bir arıza gibi görünürdü. Gerçekte
  // eksik olan tek şey bir SQL dosyası ve yapılacak iş belli.
  const ucYok = hata !== null && /could not find the function|schema cache/i.test(hata);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[18px] text-ink">Konu karnesi</h2>

      {ucYok ? (
        <Card>
          <p className="mb-1 font-semibold text-ink">Konu karnesi henüz açık değil.</p>
          <p className="text-[14px] text-muted">
            Bu bölüm için <strong>0023</strong> numaralı SQL’in Supabase panelinde bir kez
            çalıştırılması gerekiyor. Sayfanın geri kalanı bundan etkilenmiyor.
          </p>
        </Card>
      ) : (
        <AsyncBoundary
          durum={durum}
          bosBaslik="Karne çıkarılamadı"
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
          yuklemeAdedi={2}
        >
          {veri && <Icerik veri={veri} />}
        </AsyncBoundary>
      )}
    </section>
  );
}

function Icerik({ veri }: { veri: KonuKarnesi }) {
  // ÖLÇÜT 0013 İLE AYNI: yayında VE süresi dolmuş. Süresi devam eden ödevi
  // saymak ortalamayı her gün oynatırdı.
  if (veri.odev_sayisi === 0) {
    return (
      <Card>
        <p className="mb-1 font-semibold text-ink">Henüz değerlendirilmiş ödev yok.</p>
        <p className="text-[14px] text-muted">
          Karneye yalnız <strong>süresi dolmuş</strong> ödevler girer. İlk ödevin süresi
          dolduğunda konu dökümü ve gelişim burada görünecek.
        </p>
      </Card>
    );
  }

  return (
    <>
      <p className="mb-3 text-[13px] text-muted">
        <span className="sk-sayi">{veri.odev_sayisi}</span> değerlendirilmiş ödev üzerinden
        {veri.kapsam.tur === 'sinif' && (
          <>
            {' · '}
            <span className="sk-sayi">{veri.kapsam.mevcut}</span> öğrenci
          </>
        )}
      </p>

      <Card className="mb-4">
        {veri.konular.length > 0 ? (
          <KonuListesi analiz={veri.konular} ses="ucuncu" kapsam="donem" />
        ) : (
          <>
            <p className="mb-1 font-semibold text-ink">Konu dökümü çıkarılamıyor.</p>
            <p className="text-[14px] text-muted">
              Konu dökümü, ödevi hazırlarken hangi sorunun hangi konuya ait olduğunu
              girdiğiniz <strong>test</strong> ödevlerinden çıkar. Bu ödevlerde konu eşlemesi
              yok ya da hepsi açık uçlu.
            </p>
          </>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 text-[15px] font-bold text-ink">Ödev ödev gelişim</h3>
        {/* EĞİLİM YORUMU YOK — ne burada ne bileşende. Sayılar duruyor,
            yorumu öğretmen yapıyor. */}
        <p className="mb-3 text-[13px] text-muted">
          {veri.kapsam.tur === 'sinif'
            ? 'Her ödevde gönderenlerin ortalaması, tarih sırasıyla.'
            : 'Ödev ödev puanlar, tarih sırasıyla.'}
        </p>
        <Gelisim satirlar={veri.gelisim} kapsam={veri.kapsam.tur} />
      </Card>
    </>
  );
}
