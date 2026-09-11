import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  OKUL_BASLIK,
  OKUL_BOLUMLERI,
  OKUL_GIRIS,
  OKUL_KAPANIS,
  OKUL_ONAY_ACIKLAMA,
  OKUL_ONAY_ALANLARI,
  OKUL_ONAY_BASLIK,
  OKUL_SORUMLU,
} from '@/lib/okul-bilgilendirme';
import type { OkulBilgilendirme as OkulBilgilendirmeTipi } from '@/types/api';

const GUN = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });
const AY = new Intl.DateTimeFormat('tr-TR', { year: 'numeric', month: 'long' });

/**
 * Okul yönetimine verilecek bilgilendirme — yazdırılıp imzalatılmak üzere.
 *
 * `docs/kvkk-notlari.md`'nin dikkat listesindeki ilk madde buydu ve
 * metni yoktu.
 *
 * SAYILAR BURADAN GELMİYOR, SUNUCUDAN GELİYOR. Metin `lib/okul-
 * bilgilendirme.ts`'te kilitli ve içinde TEK BİR SAYI YOK; kaç öğretmen,
 * kaç sınıf, kaç öğrenci, kaç veli onam vermiş — hepsi `okul_bilgilendirme`
 * ucundan canlı okunuyor. Sebebi bu depoda iki kez yaşandı: bir belge
 * yazıldığı gün doğru olup sonra sessizce yanlışa döndü. Elle yazılmayan
 * sayı bayatlayamaz.
 *
 * YALNIZ SAHİP. Uç `_yonetici` kapısının arkasında; okul yönetimiyle
 * konuşan kişi platformun sahibi. Arayüz de aynı yerde duruyor (Ayarlar,
 * sahip değilse kart hiç çizilmiyor) — ama asıl sınır sunucuda.
 *
 * PDF için kütüphane yok: kod fişleri ve onam dökümüyle aynı yol —
 * tarayıcının yazdırma penceresi, "PDF olarak kaydet".
 */
export function OkulBilgilendirme() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OkulBilgilendirmeTipi>(
    'okul_bilgilendirme',
    { p_token: oturum?.token },
  );

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ayarlar')}>
            ← Ayarlar
          </Button>
          {veri && <Button onClick={() => window.print()}>Yazdır</Button>}
        </div>
        <p className="mb-4 text-[14px] leading-relaxed text-muted">
          Yazdırma penceresinde <strong>“PDF olarak kaydet”</strong>i seçerseniz
          belge dosya olarak kaydedilir. Sayılar her yazdırmada o günkü
          duruma göre yeniden hesaplanır.
        </p>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bilgi alınamadı"
        bosAciklama="Sayfayı yenilemeyi deneyin."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <article className="sk-okul-belge">
            <header className="flex items-center gap-4 border-b border-line pb-4">
              <SchoolCrest boyut={96} dekoratif className="shrink-0" />
              <div className="min-w-0">
                <h1 className="font-display text-[22px] font-semibold text-ink">
                  {OKUL_BASLIK}
                </h1>
                <p className="mt-1 text-[13px] text-muted">
                  {GUN.format(new Date(veri.alindi))}
                </p>
              </div>
            </header>

            <p className="mt-4 text-[15px] leading-relaxed text-ink">
              {OKUL_GIRIS}
            </p>

            {OKUL_BOLUMLERI.map((b) => (
              <section key={b.baslik} className="mt-5">
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">
                  {b.baslik}
                </h2>
                <ul className="mt-2 grid gap-1.5">
                  {b.maddeler.map((m) => (
                    <li
                      key={m}
                      className="flex gap-2 text-[14px] leading-relaxed text-ink"
                    >
                      <span aria-hidden="true" className="text-muted">
                        •
                      </span>
                      <span className="min-w-0">{m}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {/* CANLI SAYILAR. Metnin içinde değil, ayrı bir bölümde —
                böylece hangi bilginin o güne ait olduğu kâğıtta da
                belli oluyor. */}
            <section className="mt-6 border-t border-line pt-4">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">
                Bugünkü durum
              </h2>
              <table className="mt-2 w-full border-collapse text-[14px]">
                <tbody>
                  <Satir etiket="Uygulamayı kullanan öğretmen" deger={veri.ogretmen_sayisi} />
                  <Satir etiket="Sınıf" deger={veri.sinif_sayisi} />
                  <Satir etiket="Öğrenci" deger={veri.ogrenci_sayisi} />
                  <Satir
                    etiket="Onam veren veli"
                    deger={`${veri.onam_veren} / ${veri.ogrenci_sayisi}`}
                  />
                  {veri.ilk_kayit && (
                    <Satir
                      etiket="Kullanım başlangıcı"
                      deger={AY.format(new Date(veri.ilk_kayit))}
                    />
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[13px] text-muted">
                Bu sayılar belgenin yazdırıldığı andaki durumu gösterir.
              </p>
            </section>

            <p className="mt-6 text-[14px] leading-relaxed text-ink">
              {OKUL_KAPANIS}
            </p>

            <div className="mt-6">
              <p className="text-[15px] font-semibold text-ink">
                {OKUL_SORUMLU.ad}
              </p>
              <p className="text-[14px] text-muted">{OKUL_SORUMLU.sifat}</p>
            </div>

            {/* OKUL YÖNETİMİNİN BÖLÜMÜ. Belgenin asıl değeri burada:
                elde imzalı bir kâğıt kalıyor. */}
            <section className="sk-okul-onay mt-8 border-t border-line pt-6">
              <h2 className="font-display text-[18px] font-semibold text-ink">
                {OKUL_ONAY_BASLIK}
              </h2>
              <p className="mt-1 text-[14px] text-muted">{OKUL_ONAY_ACIKLAMA}</p>
              <dl className="mt-4 grid gap-5">
                {OKUL_ONAY_ALANLARI.map((alan) => (
                  <div key={alan}>
                    <dt className="text-[13px] text-muted">{alan}</dt>
                    <dd className="mt-3 border-b border-line" />
                  </div>
                ))}
              </dl>
            </section>
          </article>
        )}
      </AsyncBoundary>
    </>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: number | string }) {
  return (
    <tr className="border-b border-line">
      <td className="py-2 pr-3 text-muted">{etiket}</td>
      <td className="py-2 text-right">
        <span className="sk-sayi font-semibold text-ink">{deger}</span>
      </td>
    </tr>
  );
}
