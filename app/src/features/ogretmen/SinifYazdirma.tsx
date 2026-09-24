import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  BOS_SINIF,
  FIS_BASLIGI,
  GERI,
  KAPSAM_NOTU,
  LISTE_BASLIGI,
  OKUL_ADI,
  SAYFA_ACIKLAMASI,
  SAYFA_BASLIGI,
  YAZDIR_FIS,
  YAZDIR_LISTE,
  fisAltNotu,
  konuSatiri,
  odevSayilariYazisi,
  ortalamaSatiri,
  tarihYazisi,
} from '@/lib/sinif-yazdirma-metni';
import type { SinifOgrenciOzeti } from '@/types/api';

/**
 * SINIF ÇIKTISI — sınıf listesi ve veli fişleri.
 *
 * Öğretmenin isteği: *"Öğrenciler sekmesinde sınıflara tıkladığımda çıkan
 * öğrenci listesi yazdırılabilir olsun istediğim zaman. Okulun adı …
 * olarak ve yazdırdığım tarih olsun çıktıda."*
 *
 * -----------------------------------------------------------------------------
 * NEDEN İKİ AYRI ÇIKTI — ÖĞRETMENİN KARARI
 *
 * Sordum, o seçti: *"İkisi de olsun."* Gerekçe kâğıdın kendisinde:
 * sınıf listesi HER öğrencinin ortalamasını ve yapmadığı ödevleri
 * taşıyor. Veli toplantısında o kâğıdı bir veliye uzatmak, öbür
 * çocukların bilgisini de göstermek demek. Bu yüzden ikinci bir çıktı
 * var: her öğrenci için kesilip verilebilen, YALNIZ kendi çocuğunun
 * satırını taşıyan bir fiş.
 *
 * Bu, deponun 0018'deki "aynı anda tek öğrenci" kuralının kâğıt hâli.
 *
 * -----------------------------------------------------------------------------
 * PDF KÜTÜPHANESİ YOK
 *
 * `OnamDokumu` ve `KodFisleri` deseninin aynısı: tarayıcının yazdırma
 * penceresi zaten PDF üretiyor ("PDF olarak kaydet"). Kütüphane eklemek
 * pakete yüzlerce KB bindirirdi, kazancı yok.
 *
 * -----------------------------------------------------------------------------
 * HANGİ BÖLÜM YAZDIRILIYOR
 *
 * İki düğme var ve her biri YAZDIRMADAN ÖNCE öbür bölümü kâğıttan
 * düşürüyor. "İkisini birden bas, sonra ayıkla" demedik: veli fişlerini
 * isteyen öğretmenin elinde sınıf listesi de çıkarsa, o kâğıt masada
 * kalır.
 */
export function SinifYazdirma() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const git = useNavigate();

  /**
   * Yazdırma anı DONDURULUYOR: `new Date()` her çizimde yeniden
   * hesaplansaydı, liste ile fişlerin üstündeki saat farklı olabilirdi.
   * Aynı çıktının iki parçası aynı zamanı söylemeli.
   */
  const [an] = useState(() => new Date());
  const [bolum, setBolum] = useState<'liste' | 'fis' | null>(null);

  const { veri, durum, hata, yenile } = useVeri<SinifOgrenciOzeti>(
    'sinif_ogrenci_ozeti',
    { p_token: oturum?.token, p_sinif_id: id },
    (v) => v.ogrenciler.length === 0,
  );

  function yazdir(hangi: 'liste' | 'fis') {
    setBolum(hangi);
    // Bir çizim beklemek şart: `print()` aynı karede çağrılırsa tarayıcı
    // ESKİ ağacı basar ve öbür bölüm kâğıda çıkar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  const sinifAdi = veri?.sinif.ad ?? '';

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4">
          <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ogrenciler')}>
            {GERI}
          </Button>
        </div>
        <h1 className="font-display text-[24px] font-semibold text-ink">
          {sinifAdi} — {SAYFA_BASLIGI}
        </h1>
        <p className="mt-1 text-[14px] text-muted">{SAYFA_ACIKLAMASI}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => yazdir('liste')} disabled={!veri}>
            {YAZDIR_LISTE}
          </Button>
          <Button tur="ikincil" onClick={() => yazdir('fis')} disabled={!veri}>
            {YAZDIR_FIS}
          </Button>
        </div>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bu sınıfta öğrenci yok"
        bosAciklama={BOS_SINIF}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            {/* ---------------- SINIF LİSTESİ ---------------- */}
            <section className={bolum === 'fis' ? 'print:hidden' : ''}>
              <Kunye baslik={LISTE_BASLIGI} sinif={sinifAdi} an={an} />

              {/* 360 px'DE TABLO TAŞIYORDU (denetimin 6. grubu ölçtü:
                  111 px). Yedi sütunlu bir tablo telefon genişliğine
                  sığmaz; ekranda yatay kaydırılıyor, KÂĞITTA kaydırma
                  diye bir şey olmadığı için orada normale dönüyor. */}
              <Card className="mt-4 overflow-x-auto print:overflow-visible print:border-0 print:p-0 print:shadow-none">
                <table className="sk-yazdirma-tablo w-full min-w-[640px] text-left text-[14px] print:min-w-0">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="py-2 pr-2 font-semibold">No</th>
                      <th className="py-2 pr-2 font-semibold">Ad Soyad</th>
                      <th className="py-2 pr-2 font-semibold">Verilen</th>
                      <th className="py-2 pr-2 font-semibold">Yapılan</th>
                      <th className="py-2 pr-2 font-semibold">Yapılmayan</th>
                      <th className="py-2 pr-2 font-semibold">Ortalama</th>
                      <th className="py-2 font-semibold">Üzerinde çalışılacak konular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.ogrenciler.map((o) => (
                      <tr key={o.id} className="border-b border-line-soft align-top">
                        <td className="sk-sayi py-2 pr-2">{o.ogrenci_no ?? '—'}</td>
                        <td className="py-2 pr-2 font-semibold">{o.ad}</td>
                        <td className="sk-sayi py-2 pr-2">{o.odev_sayisi}</td>
                        <td className="sk-sayi py-2 pr-2">{o.yapilan}</td>
                        <td className="sk-sayi py-2 pr-2">{o.yapilmayan}</td>
                        <td className="sk-sayi py-2 pr-2">
                          {ortalamaSatiri(o.ortalama).replace('Ortalama: ', '')}
                        </td>
                        <td className="py-2">
                          {o.eksik_konular.length > 0 ? o.eksik_konular.join(' · ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <p className="mt-3 text-[12px] leading-snug text-muted">{KAPSAM_NOTU}</p>
            </section>

            {/* ---------------- VELİ FİŞLERİ ---------------- */}
            <section
              className={`mt-8 print:mt-0 ${bolum === 'liste' ? 'print:hidden' : ''}`}
            >
              <div className="print:hidden">
                <h2 className="font-display text-[20px] font-semibold text-ink">
                  {FIS_BASLIGI}
                </h2>
                <p className="mt-1 text-[14px] text-muted">
                  Her fiş yalnız kendi öğrencisinin bilgisini taşır; kesip veliye
                  verebilirsiniz.
                </p>
              </div>

              <div className="sk-fis-izgara mt-4 grid gap-3 sm:grid-cols-2 print:mt-0">
                {veri.ogrenciler.map((o) => {
                  const konu = konuSatiri(o.eksik_konular);
                  return (
                    <div
                      key={o.id}
                      className="sk-veli-fis rounded-sk-sm border border-line p-4"
                    >
                      {/* FİŞİN KENDİ ANTETİ. Fiş kesilip veliye gidiyor;
                          sayfa künyesi onunla birlikte gitmiyor. Bu
                          yüzden mühür ve okul adı fişin kendi üstünde —
                          tek başına kaldığında da resmî bir kâğıt. */}
                      <div className="flex items-center gap-3 border-b border-ink/20 pb-2">
                        <SchoolCrest boyut={96} dekoratif className="sk-fis-muhru shrink-0" />
                        <div className="min-w-0">
                          <p className="font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink">
                            {OKUL_ADI}
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                            {FIS_BASLIGI}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 font-display text-[18px] font-semibold text-ink">
                        {o.ad}
                      </p>
                      <p className="text-[13px] text-muted">
                        {sinifAdi}
                        {o.ogrenci_no ? ` · No ${o.ogrenci_no}` : ''}
                      </p>

                      <p className="sk-sayi mt-2 text-[13px] text-ink">
                        {odevSayilariYazisi(o.odev_sayisi, o.yapilan, o.yapilmayan)}
                      </p>
                      <p className="sk-sayi text-[13px] text-ink">
                        {ortalamaSatiri(o.ortalama)}
                      </p>
                      {konu && <p className="mt-1 text-[13px] text-ink">{konu}</p>}

                      <p className="mt-3 border-t border-line pt-1 text-[10px] leading-snug text-muted">
                        {fisAltNotu(sinifAdi, an)}
                      </p>
                      <p className="text-[10px] leading-snug text-muted">{KAPSAM_NOTU}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/**
 * Çıktının künyesi — YALNIZ KÂĞITTA görünüyor.
 *
 * Ekranda zaten sınıf adı ve başlık var; künyeyi ekranda da göstermek
 * aynı bilgiyi iki kez yazmak olurdu. Kâğıtta ise zorunlu: öğretmenin
 * isteği okul adının, mührün ve tarihin çıktıda olması.
 *
 * -----------------------------------------------------------------------------
 * RESMÎ BELGE DÜZENİ (öğretmenin düzeltmesi: *"okul adını sayfaya
 * ortala, logoyu kullan… Okul resmiyetini yansıtmalı."*)
 *
 * Bir okul yazısının üstü ortalanır: mühür ortada, altında okul adı,
 * altında belgenin ne olduğu, en altta tarih ve ince bir çizgi. Sol
 * hizalı bir başlık, kurumsal bir yazıdan çok bir ekran çıktısına
 * benzer.
 *
 * MÜHÜR YENİDEN ÇİZİLMİYOR, ÖLÇÜSÜ DE KÜÇÜLTÜLMÜYOR (Kural 8).
 * `SchoolCrest` 96 pikselin altını tip olarak kabul etmiyor; sebebi
 * dosyasında yazılı — dış halkadaki okul adı ve içerideki çizim o
 * boyutun altında okunmaz hâle geliyor. Burada en küçük izinli ölçü
 * kullanılıyor: A4'te yaklaşık 25 mm, bir antetli kâğıdın mührü kadar.
 *
 * `dekoratif` VERİLİYOR: okul adı mührün hemen altında GÖRÜNÜR METİN
 * olarak duruyor. Verilmeseydi ekran okuyucu okulun adını iki kez
 * okurdu (bileşenin kendi notu).
 */
function Kunye({ baslik, sinif, an }: { baslik: string; sinif: string; an: Date }) {
  return (
    <div className="sk-cikti-kunye hidden print:block">
      <div className="flex flex-col items-center text-center">
        <SchoolCrest boyut={96} dekoratif />
        <p className="sk-cikti-okul mt-2 font-display text-[16px] font-semibold uppercase tracking-[0.08em] text-ink">
          {OKUL_ADI}
        </p>
        <p className="mt-1 text-[14px] font-semibold text-ink">
          {sinif} — {baslik}
        </p>
        <p className="text-[12px] text-muted">{tarihYazisi(an)}</p>
      </div>
      {/* İnce çizgi: künyeyi belgenin gövdesinden ayırıyor. */}
      <div className="mt-3 border-b border-ink/30" />
    </div>
  );
}
