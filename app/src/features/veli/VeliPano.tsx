import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { sureDurumu } from '@/lib/son-tarih';
import type { VeliPaneli } from '@/types/api';

const PARA = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/**
 * Velinin Panosu — öğretmenin seçimi: "Çocuğun durumu özeti".
 *
 * Veli uzun listeyi okumadan "durum ne?" sorusuna cevap alsın. Ödevlerin
 * tamamı Ödevler sekmesinde; buraya da liste koymak iki sekmeyi
 * birbirinin kopyası yapardı.
 *
 * ORTALAMA BİLEREK YOK: veli için anlamlı olan çocuğun ödevini yapıp
 * yapmadığı; sınıf içi sıralama çağrıştıran bir sayı bu ekrana ait değil.
 *
 * KURAL 6 — VELİYE CEVAP ANAHTARI GİTMEZ. `veli_paneli` anahtarı,
 * anahtar dosya yolunu ve anahtarın içeriğini hiç döndürmüyor;
 * `veliler_testleri.sql` 7. grubu dördünü de ayrı ayrı ölçüyor. Burada
 * gizlenecek bir şey yok çünkü hiç gelmiyor.
 */
export function VeliPano() {
  const { oturum } = useOturum();

  const { veri, durum, hata, yenile } = useVeri<VeliPaneli>('veli_paneli', {
    p_token: oturum?.token,
  });

  const odevler = veri?.odevler ?? [];
  const gonderdi = odevler.filter((o) => o.gonderildi).length;
  const kacirdi = odevler.filter(
    (o) => !o.gonderildi && sureDurumu(o.son_tarih).gecti,
  ).length;
  const bekleyen = odevler.filter(
    (o) => !o.gonderildi && !sureDurumu(o.son_tarih).gecti,
  ).length;

  // Son puan: puanı olan en yeni gönderim.
  const puanli = odevler
    .filter((o) => o.puan !== null)
    .sort((a, b) => (b.gonderim_zamani ?? '').localeCompare(a.gonderim_zamani ?? ''));
  const sonPuanli = puanli[0];

  // KALAN BORÇ — yalnız ödeme kaydı olan (yani özel ders) velide.
  // Okul velisinde `odemeler` boş geliyor ve satır hiç çizilmiyor.
  const odemeler = veri?.odemeler ?? [];
  const kalan = odemeler
    .filter((p) => !p.odendi)
    .reduce((toplam, p) => toplam + Number(p.tutar), 0);

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik="Henüz bilgi yok"
      bosAciklama="Öğretmen ödev yayınlayınca burada göreceksiniz."
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      {veri && (
        <>
          <div className="mb-5 flex items-center gap-3">
            <EwaluFigure poz="karsilama" boyut={56} dekoratif className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[24px] text-ink">{veri.ogrenci.ad}</h1>
              <p className="mt-0.5 text-[14px] text-muted">
                {veri.ogrenci.sinif ?? 'Özel ders'} · durum özeti
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Kutu deger={gonderdi} etiket="Gönderdi" />
            <Kutu deger={bekleyen} etiket="Bekleyen" />
            <Kutu deger={kacirdi} etiket="Kaçırdı" tehlike />
          </div>

          <ul className="mt-6 grid gap-3">
            <li>
              <Card>
                <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                  Son puanı
                </p>
                {sonPuanli ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] text-ink">
                      {sonPuanli.baslik}
                    </span>
                    <Tag tur="basari">
                      <span className="sk-sayi">{sonPuanli.puan} puan</span>
                    </Tag>
                  </div>
                ) : (
                  <p className="mt-2 text-[15px] text-ink">
                    Henüz puanlanmış ödev yok.
                  </p>
                )}
              </Card>
            </li>

            {veri.okunmamis_mesaj > 0 && (
              <li>
                <Card vurgu="uyari">
                  <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                    Öğretmenden mesaj
                  </p>
                  <p className="mt-2 text-[15px] text-ink">
                    <span className="sk-sayi font-semibold">{veri.okunmamis_mesaj}</span>{' '}
                    okunmamış mesajınız var. Mesajlar sekmesinden okuyabilirsiniz.
                  </p>
                </Card>
              </li>
            )}

            {/* KALAN BORÇ — yalnız VELİDE. Öğrencinin hiçbir ekranında
                para bilgisi geçmiyor (öğretmenin kalıcı kuralı) ve bu
                sunucudan geliyor: öğrencinin ucu tutar diye bir alan
                taşımıyor. */}
            {odemeler.length > 0 && (
              <li>
                <Card vurgu={kalan > 0 ? 'uyari' : 'yok'}>
                  <p className="text-[13px] font-bold uppercase tracking-wide text-muted">
                    Kalan ödeme
                  </p>
                  <p className="mt-2 sk-sayi text-[20px] font-semibold text-ink">
                    {PARA.format(kalan)}
                  </p>
                </Card>
              </li>
            )}
          </ul>
        </>
      )}
    </AsyncBoundary>
  );
}

function Kutu({
  deger,
  etiket,
  tehlike,
}: {
  deger: number;
  etiket: string;
  tehlike?: boolean;
}) {
  return (
    <Card className="text-center">
      <p
        className={`sk-sayi font-display text-[28px] font-semibold ${
          tehlike && deger > 0 ? 'text-danger' : 'text-ink'
        }`}
      >
        {deger}
      </p>
      <p className="mt-1 text-[13px] text-muted">{etiket}</p>
    </Card>
  );
}
