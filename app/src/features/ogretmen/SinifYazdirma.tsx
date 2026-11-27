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
  IKI_ORTALAMA_NOTU,
  ikiOrtalamaSatiri,
  ortalamaHucresi,
  ortalamaSatiri,
  tarihYazisi,
} from '@/lib/sinif-yazdirma-metni';
import {
  CIZELGE_BASLIGI,
  CIZELGE_NOTU,
  SUTUNLAR,
  YAZDIR_CIZELGE,
  cizelgeAltNotu,
  devamBasligi,
  durumYazisi,
  gecikmeIsareti,
  kisaGun,
  parcalaraBol,
  puanYazisi,
  seviyeBasligi,
  seviyeOrtalamasi,
  sinifOrtalamasi,
  soruDokumu,
  verilisGunu,
} from '@/lib/veli-cizelgesi-metni';
import type { SinifNotCizelgesi, SinifOgrenciOzeti } from '@/types/api';

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
  const [bolum, setBolum] = useState<'liste' | 'fis' | 'cizelge' | null>(null);

  const { veri, durum, hata, yenile } = useVeri<SinifOgrenciOzeti>(
    'sinif_ogrenci_ozeti',
    { p_token: oturum?.token, p_sinif_id: id },
    (v) => v.ogrenciler.length === 0,
  );

  function yazdir(hangi: 'liste' | 'fis' | 'cizelge') {
    setBolum(hangi);
    // Bir çizim beklemek şart: `print()` aynı karede çağrılırsa tarayıcı
    // ESKİ ağacı basar ve öbür bölüm kâğıda çıkar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  /**
   * ÖDEV ÇİZELGESİ AYRI BİR UÇTAN (0091).
   *
   * `sinif_ogrenci_ozeti` öğrenci başına ÖZETİ veriyor; ödevin kendisini
   * (başlık, veriliş, puan, kıyas) `sinif_not_cizelgesi` taşıyor. İkinci
   * bir çağrı, 300 satırlık bir gövdeyi kopyalamaktan ucuz — 0016'da
   * ezberden gövde yazmak iki hataya yol açmıştı.
   *
   * HATASI YUTULUYOR ve bu bilinçli: `durum`u burada okunmuyor. 0091
   * çalıştırılmadıysa ya da uç bir an ulaşılamazsa çizelge düğmesi
   * kapalı kalıyor; sınıf listesi ve veli fişi bundan etkilenmiyor
   * (Part VIII).
   */
  const { veri: hamCizelge } = useVeri<SinifNotCizelgesi>('sinif_not_cizelgesi', {
    p_token: oturum?.token,
    p_sinif_id: id,
  });

  /**
   * ŞEKLİ DENETLENİYOR, VARLIĞI DEĞİL.
   *
   * İlk yazımda koruma `{cizelge && …}` idi ve `{}` DOĞRU SAYILIYOR:
   * uç beklenmedik bir şey döndürdüğünde (eski sunucu, hata gövdesi,
   * boş nesne) ekran `cizelge.sinif.ad` satırında ÇÖKÜYORDU. Süpürme
   * bunu `iki-ortalama-denetimi.mjs`te yakaladı — o denetim taklit
   * etmediği uçlara `{}` döndürüyor ve bu ekrana uğruyor.
   *
   * Part VIII'in kuralı "alan gelmezse çizme" değil, "gelmeyen veri
   * ekranı BOZMASIN". Üç alanın da gerçekten beklenen biçimde olması
   * aranıyor; biri eksikse çizelge bölümü hiç çizilmiyor ve sınıf
   * listesiyle veli fişi etkilenmiyor.
   */
  const cizelge =
    hamCizelge
    && typeof hamCizelge.sinif?.ad === 'string'
    && Array.isArray(hamCizelge.odevler)
    && Array.isArray(hamCizelge.ogrenciler)
      ? hamCizelge
      : null;

  const sinifAdi = veri?.sinif.ad ?? '';
  // 0080: iki ortalama sunucudan geliyorsa kâğıtta da ikisi; eski sunucuda tek sütun.
  const iki = veri?.ogrenciler.some((o) => o.yapilan_ortalama !== undefined) ?? false;

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
          {/* 0091: AYRINTILI ÇİZELGE. Veli fişi özet taşıyor; öğretmenin
              veli toplantısı için istediği şey ödevin kendisiydi —
              "hangi ödev ne zaman verilmiş, kaç puan almış, sınıfın ve
              düzeyin ortalaması kaçmış". Fiş kaldırılmadı: ikisi ayrı
              işe yarıyor ve öğretmen hangisini basacağını seçiyor. */}
          <Button tur="ikincil" onClick={() => yazdir('cizelge')} disabled={!cizelge}>
            {YAZDIR_CIZELGE}
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
            <section className={bolum !== null && bolum !== 'liste' ? 'print:hidden' : ''}>
              <Kunye baslik={LISTE_BASLIGI} sinif={sinifAdi} an={an} />

              {/* 360 px'DE TABLO TAŞIYORDU (denetimin 6. grubu ölçtü:
                  111 px). Yedi sütunlu bir tablo telefon genişliğine
                  sığmaz; ekranda yatay kaydırılıyor, KÂĞITTA kaydırma
                  diye bir şey olmadığı için orada normale dönüyor. */}
              <Card className="mt-4 overflow-x-auto print:overflow-visible print:border-0 print:p-0 print:shadow-none">
                <table className="sk-yazdirma-tablo w-full min-w-[720px] text-left text-[14px] print:min-w-0">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="py-2 pr-2 font-semibold">No</th>
                      <th className="py-2 pr-2 font-semibold">Ad Soyad</th>
                      <th className="py-2 pr-2 font-semibold">Verilen</th>
                      <th className="py-2 pr-2 font-semibold">Yapılan</th>
                      <th className="py-2 pr-2 font-semibold">Yapılmayan</th>
                      {iki ? (
                        <>
                          <th className="py-2 pr-2 font-semibold">Yaptığı ödevler ort.</th>
                          <th className="py-2 pr-2 font-semibold">Tüm ödevler ort.</th>
                        </>
                      ) : (
                        <th className="py-2 pr-2 font-semibold">Ortalama</th>
                      )}
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
                        {iki ? (
                          <>
                            <td className="sk-sayi py-2 pr-2">
                              {ortalamaHucresi(o.yapilan_ortalama)}
                            </td>
                            <td className="sk-sayi py-2 pr-2">{ortalamaHucresi(o.ortalama)}</td>
                          </>
                        ) : (
                          <td className="sk-sayi py-2 pr-2">
                            {ortalamaSatiri(o.ortalama).replace('Ortalama: ', '')}
                          </td>
                        )}
                        <td className="py-2">
                          {o.eksik_konular.length > 0 ? o.eksik_konular.join(' · ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <p className="mt-3 text-[12px] leading-snug text-muted">
                {iki ? IKI_ORTALAMA_NOTU : KAPSAM_NOTU}
              </p>
            </section>

            {/* ---------------- VELİ FİŞLERİ ---------------- */}
            <section
              className={`mt-8 print:mt-0 ${bolum !== null && bolum !== 'fis' ? 'print:hidden' : ''}`}
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
                        {iki && o.odev_sayisi > 0
                          ? ikiOrtalamaSatiri(o.yapilan_ortalama ?? null, o.ortalama)
                          : ortalamaSatiri(o.ortalama)}
                      </p>
                      {konu && <p className="mt-1 text-[13px] text-ink">{konu}</p>}

                      <p className="mt-3 border-t border-line pt-1 text-[10px] leading-snug text-muted">
                        {fisAltNotu(sinifAdi, an)}
                      </p>
                      <p className="text-[10px] leading-snug text-muted">
                        {iki ? IKI_ORTALAMA_NOTU : KAPSAM_NOTU}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------------- VELİ ÇİZELGESİ (0091) ---------------- */}
            {cizelge && (
              <VeliCizelgeleri
                cizelge={cizelge}
                an={an}
                gizli={bolum !== null && bolum !== 'cizelge'}
              />
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/**
 * VELİ ÇİZELGESİ — her veliye kesilip verilen AYRINTILI karne (0091).
 *
 * Öğretmenin isteği: "1 A4'e 2 öğrenci olsun. Hangi ödev ne zaman
 * verilmiş. Kaç tanesini yapmış yapmamış. Kaç puan almış. O ödevde
 * sınıfının ortalaması kaçmış, o düzeydeki tüm sınıfların ortalaması
 * kaçmış."
 *
 * YARIM A4 BİR TASARIM TERCİHİ DEĞİL, GİZLİLİK KARARI. Sınıf listesi
 * HER öğrencinin puanını taşıyor; o kâğıdı bir veliye uzatmak öbür
 * çocukların bilgisini de vermek olurdu. `kod-fisi.ts` aynı dersi
 * taşıyor ve bu ekran 0053'te zaten o karara göre kurulmuştu.
 *
 * TAŞMA SESSİZCE KIRPILMIYOR: yirmi ödev yarım A4'e sığmaz, çizelge bir
 * sonraki yarıma "— 2/3" başlığıyla taşıyor (`parcalaraBol`).
 */
function VeliCizelgeleri({
  cizelge,
  an,
  gizli,
}: {
  cizelge: SinifNotCizelgesi;
  an: Date;
  gizli: boolean;
}) {
  const sinifAdi = cizelge.sinif.ad;
  const kiyaslar = cizelge.odevler.map((d) => d.kiyas);
  const seviyeAd = seviyeBasligi(kiyaslar);
  // 0091 çalıştırılmadıysa bu iki sütun HİÇ ÇİZİLMİYOR (Part VIII):
  // boş bir sütun başlığı, veliye olmayan bir bilgiyi vaat ederdi.
  const kiyasVar = cizelge.odevler.some((d) => d.kiyas !== undefined);
  const verilisVar = cizelge.odevler.some((d) => d.tarihler !== undefined);

  // Her öğrencinin yarımları: taşan çizelge bölünüyor.
  const yarimlar = cizelge.ogrenciler.flatMap((o) => {
    const satirlar = cizelge.odevler.map((d) => ({
      odev: d,
      hucre: o.puanlar.find((x) => x.odev_id === d.id) ?? null,
    }));
    const parcalar = parcalaraBol(satirlar);
    return parcalar.map((satir, i) => ({
      anahtar: `${o.id}-${i}`,
      ogrenci: o,
      satir,
      baslik: devamBasligi(o.ad, i + 1, parcalar.length),
      ilk: i === 0,
    }));
  });

  return (
    <section className={`mt-8 print:mt-0 ${gizli ? 'print:hidden' : ''}`}>
      <div className="print:hidden">
        <h2 className="font-display text-[20px] font-semibold text-ink">
          {CIZELGE_BASLIGI}
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          Bir A4'e iki öğrenci. Kesip her veliye yalnız kendi çocuğunun yarısını
          verin.
        </p>
      </div>

      <div className="sk-cizelge-izgara mt-4 grid gap-3 print:mt-0">
        {yarimlar.map((y) => (
          <div key={y.anahtar} className="sk-veli-cizelge rounded-sk-sm border border-line p-4">
            {/* ÇİZELGENİN KENDİ ANTETİ: kesilip tek başına gittiğinde de
                resmî bir kâğıt (veli fişiyle aynı gerekçe). */}
            <div className="flex items-center gap-3 border-b border-ink/20 pb-2">
              <SchoolCrest boyut={96} dekoratif className="sk-fis-muhru shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink">
                  {OKUL_ADI}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {CIZELGE_BASLIGI}
                </p>
              </div>
            </div>

            <p className="mt-2 font-display text-[16px] font-semibold text-ink">
              {y.baslik}
            </p>
            <p className="text-[12px] text-muted">
              {sinifAdi}
              {y.ogrenci.ogrenci_no ? ` · No ${y.ogrenci.ogrenci_no}` : ''}
            </p>

            {/* ÖZET YALNIZ İLK YARIMDA: ikinci yarımda tekrar etmek, aynı
                sayıyı iki kez okutmak olurdu. */}
            {y.ilk && (
              <p className="sk-sayi mt-1 text-[12px] text-ink">
                {odevSayilariYazisi(
                  y.ogrenci.yapti + y.ogrenci.yapmadi,
                  y.ogrenci.yapti,
                  y.ogrenci.yapmadi,
                )}
                {' · '}
                {ikiOrtalamaSatiri(
                  typeof y.ogrenci.ortalama_yapan === 'string'
                    ? Number(y.ogrenci.ortalama_yapan)
                    : (y.ogrenci.ortalama_yapan ?? null),
                  typeof y.ogrenci.ortalama_tum === 'string'
                    ? Number(y.ogrenci.ortalama_tum)
                    : (y.ogrenci.ortalama_tum ?? null),
                )}
              </p>
            )}

            <table className="sk-cizelge-tablo mt-2 w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-line">
                  {verilisVar && <th className="py-1 pr-1 font-semibold">{SUTUNLAR.verilis}</th>}
                  <th className="py-1 pr-1 font-semibold">{SUTUNLAR.sonTarih}</th>
                  <th className="py-1 pr-1 font-semibold">{SUTUNLAR.odev}</th>
                  <th className="py-1 pr-1 font-semibold">{SUTUNLAR.durum}</th>
                  <th className="py-1 pr-1 text-right font-semibold">{SUTUNLAR.puan}</th>
                  {kiyasVar && (
                    <>
                      <th className="py-1 pr-1 text-right font-semibold">{SUTUNLAR.sinif}</th>
                      <th className="py-1 text-right font-semibold">{seviyeAd}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {y.satir.map(({ odev, hucre }) => {
                  const dokum = soruDokumu(hucre?.yanlis_sorular, hucre?.bos_sorular);
                  const gec = gecikmeIsareti(hucre?.gecikmeli);
                  return (
                    <tr key={odev.id} className="border-b border-line/60 align-top">
                      {verilisVar && (
                        <td className="py-1 pr-1 whitespace-nowrap">{verilisGunu(odev.tarihler)}</td>
                      )}
                      <td className="py-1 pr-1 whitespace-nowrap">
                        {kisaGun(odev.son_tarih) ?? '—'}
                      </td>
                      <td className="py-1 pr-1">
                        {odev.baslik}
                        {/* Soru dökümü başlığın ALTINDA: yeni bir sütun
                            yarım A4'te yer bırakmazdı. Yalnız NUMARA
                            (Kural 6) — şık ne burada ne de yanıtta var. */}
                        {dokum && (
                          <span className="block text-[9px] text-muted">{dokum}</span>
                        )}
                      </td>
                      <td className="py-1 pr-1 whitespace-nowrap">
                        {durumYazisi(hucre?.durum)}
                        {gec && <span className="block text-[9px] text-muted">{gec}</span>}
                      </td>
                      <td className="sk-sayi py-1 pr-1 text-right">{puanYazisi(hucre?.puan)}</td>
                      {kiyasVar && (
                        <>
                          <td className="sk-sayi py-1 pr-1 text-right">
                            {sinifOrtalamasi(odev.kiyas)}
                          </td>
                          <td className="sk-sayi py-1 text-right">
                            {seviyeOrtalamasi(odev.kiyas)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* EKSİK KONULAR YALNIZ SON YARIMDA: çizelgenin kapanış
                cümlesi, ortasında değil sonunda. */}
            {y.ilk && konuSatiri(y.ogrenci.eksik_konular ?? []) && (
              <p className="mt-1 text-[11px] text-ink">
                {konuSatiri(y.ogrenci.eksik_konular ?? [])}
              </p>
            )}

            <p className="mt-2 border-t border-line pt-1 text-[9px] leading-snug text-muted">
              {cizelgeAltNotu(sinifAdi, an)}
            </p>
            <p className="text-[9px] leading-snug text-muted">{CIZELGE_NOTU}</p>
          </div>
        ))}
      </div>
    </section>
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
