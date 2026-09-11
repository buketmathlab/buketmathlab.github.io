import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  ONAM_BASLIK,
  ONAM_BOLUMLERI,
  ONAM_GIRIS,
  ONAM_OZET,
} from '@/lib/onam-metni';
import type { OnamDokumu as OnamDokumuTipi } from '@/types/api';

const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const GUN = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });

/**
 * Sınıfın onam dökümü — yazdırılıp PDF olarak saklanmak üzere.
 *
 * NEDEN PDF KÜTÜPHANESİ YOK: ürün PDF'i zaten tarayıcının yazdırma
 * penceresinden üretiyor (kod fişleri, `KodFisleri.tsx`). Öğretmen
 * "Yazdır" deyip "PDF olarak kaydet" seçiyor. Bir PDF kütüphanesi
 * eklemek pakete yüzlerce KB bindirirdi; burada kazancı yok.
 *
 * BELGE KENDİ KENDİNİ ANLATIYOR. Bir isim listesi tek başına bir kayıt
 * değildir; bu yüzden kâğıtta şunlar da var: sınıf, dökümü ALAN kişi,
 * ALINMA zamanı, metnin SÜRÜMÜ ve en sonda metnin TAMAMI. "Kim, ne
 * zaman, neye onay verdi" üçü de aynı kâğıtta.
 *
 * ONAM BEKLEYENLER DE LİSTEDE (öğretmenin tercihi sorulduğunda seçtiği
 * yön): belge hem kayıt hem takip listesi.
 *
 * DÜRÜST SINIR, KÂĞIDA DA YAZILI: velinin adı kendi beyanıdır, kimlik
 * doğrulaması değildir. Belgeyi okuyan bunu bilmeli.
 */
export function OnamDokumu() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OnamDokumuTipi>('onam_dokumu', {
    p_token: oturum?.token,
    p_sinif_id: id,
  });

  const bekleyen = veri ? veri.toplam - veri.onayli : 0;

  return (
    <>
      {/* Kabuğun kendi parçaları (yan menü, üst çubuk) yazdırmada zaten
          gizli; bu blok EKRANIN kendi düğmeleri için. */}
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button tur="sade" olcu="sm" onClick={() => git(`/ogretmen/veliler/sinif/${id}`)}>
            ← Sınıf
          </Button>
          {veri && <Button onClick={() => window.print()}>Yazdır</Button>}
        </div>
        <p className="mb-4 text-[14px] leading-relaxed text-muted">
          Yazdırma penceresinde hedef olarak <strong>“PDF olarak kaydet”</strong>i
          seçerseniz belge dosya olarak kaydedilir.
        </p>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bu sınıfta öğrenci yok"
        bosAciklama="Öğrenciler bölümünden bu sınıfa öğrenci ekleyebilirsiniz."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <article className="sk-onam-dokumu">
            <header className="flex items-center gap-4 border-b border-line pb-4">
              <SchoolCrest boyut={96} dekoratif className="shrink-0" />
              <div className="min-w-0">
                <h1 className="font-display text-[22px] font-semibold text-ink">
                  Veli Onam Dökümü
                </h1>
                <p className="mt-1 text-[15px] text-ink">
                  {veri.sinif.ad} sınıfı
                </p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {GUN.format(new Date(veri.alindi))} tarihinde
                  {veri.alan ? ` ${veri.alan} tarafından` : ''} alındı · metin
                  sürümü <span className="sk-sayi">{veri.surum}</span>
                </p>
              </div>
            </header>

            <p className="mt-4 text-[15px] text-ink">
              <span className="sk-sayi font-semibold">{veri.toplam}</span>{' '}
              öğrencinin{' '}
              <span className="sk-sayi font-semibold">{veri.onayli}</span>{' '}
              tanesinin velisi bu metni onayladı;{' '}
              <span className="sk-sayi font-semibold">{bekleyen}</span> onam
              bekliyor.
            </p>

            <table className="mt-4 w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-3 font-semibold">Öğrenci</th>
                  <th className="py-2 pr-3 font-semibold">Onaylayan veli</th>
                  <th className="py-2 font-semibold">Onay zamanı</th>
                </tr>
              </thead>
              <tbody>
                {veri.satirlar.map((s) => (
                  <tr key={s.ogrenci_id} className="border-b border-line align-top">
                    <td className="py-2 pr-3 text-ink">{s.ogrenci}</td>
                    <td className="py-2 pr-3 text-ink">
                      {/* Onaylamamışsa ad da tarih de boş — uydurulmuyor. */}
                      {s.onam_var
                        ? (s.veli_adi ?? 'ad kaydedilmemiş')
                        : '—'}
                    </td>
                    <td className="py-2 text-ink">
                      {s.onam_var && s.onay_zamani
                        ? ZAMAN.format(new Date(s.onay_zamani))
                        : 'Onam bekliyor'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Onaylayan velinin adı, velinin uygulamada kendi yazdığı addır;
              kimlik doğrulaması yapılmaz. Onay, veliye verilen kodla giriş
              yapılarak verilir.
            </p>

            {/* METNİN TAMAMI YENİ SAYFADA. Belge tek başına anlamlı olsun
                diye: "kim, ne zaman" ile birlikte "NEYE" de kâğıtta. */}
            <section className="sk-onam-metin mt-8 border-t border-line pt-6">
              <h2 className="font-display text-[18px] font-semibold text-ink">
                {ONAM_BASLIK} — sürüm{' '}
                <span className="sk-sayi">{veri.surum}</span>
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                {ONAM_GIRIS}
              </p>
              {ONAM_BOLUMLERI.map((b) => (
                <div key={b.baslik} className="mt-4">
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">
                    {b.baslik}
                  </h3>
                  <ul className="mt-1 grid gap-1">
                    {b.maddeler.map((m) => (
                      <li key={m} className="flex gap-2 text-[14px] leading-relaxed text-ink">
                        <span aria-hidden="true" className="text-muted">
                          •
                        </span>
                        <span className="min-w-0">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="mt-4 text-[14px] font-semibold leading-relaxed text-ink">
                {ONAM_OZET}
              </p>
            </section>
          </article>
        )}
      </AsyncBoundary>
    </>
  );
}

/** Sınıf ekranından dökümü açan düğme. */
export function OnamDokumuDugmesi({ sinifId }: { sinifId: string }) {
  const git = useNavigate();
  return (
    <Card>
      <p className="text-[15px] text-ink">
        Bu sınıfın onam dökümünü yazdırabilir, PDF olarak saklayabilirsiniz.
      </p>
      <div className="mt-3">
        <Button
          tur="ikincil"
          olcu="sm"
          onClick={() => git(`/ogretmen/veliler/sinif/${sinifId}/onam`)}
        >
          Onam dökümü
        </Button>
      </div>
    </Card>
  );
}
