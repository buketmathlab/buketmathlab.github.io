import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { GeometricDivider } from '@/components/brand/GeometricDivider';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { useBenKimim } from '@/hooks/useBenKimim';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/toast-baglam';
import { rpc } from '@/services/supabase';
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
  DERS,
  GIRIS_BASLIGI,
  GIRIS_SATIRLARI,
  KOD_ETIKETI,
  KURULUM,
  KURULUM_BASLIGI,
  MASKOT_EKRAN_PX,
  girisBloguVarMi,
  SUTUNLAR,
  YAZDIR_CIZELGE,
  cizelgeAltNotu,
  devamBasligi,
  durumYazisi,
  gecikmeIsareti,
  kagitDuzeni,
  kisaGun,
  kunyeSatiri,
  parcalaraBol,
  puanYazisi,
  seviyeBasligi,
  seviyeOrtalamasi,
  sinifOrtalamasi,
  soruDokumu,
  verilisGunu,
} from '@/lib/veli-cizelgesi-metni';
import type { Kodlar, SinifNotCizelgesi, SinifOgrenciOzeti } from '@/types/api';

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
  const { bildir } = useToast();

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
  /**
   * SAHİP TAM KAPSAMLA BASIYOR (öğretmenin kararı: "İkisi de olsun").
   *
   * `_odeve_erisir` (0055) bir öğretmene yalnız KENDİ ve PLATFORM
   * SAHİBİNİN ödevlerini gösteriyor. Sahip de bu kuraldan muaf değildi:
   * başka bir öğretmenin sınıfı için bastığı çizelgede O ÖĞRETMENİN
   * ödevleri HİÇ ÇIKMIYORDU — veliye eksik bir karne, eksik olduğunu
   * söylemeden.
   *
   * Uç bunun kapısını zaten taşıyor (`p_onizleme` → `v_hepsi`) ve
   * yalnız YÖNETİCİYE açıyor; yani burada yeni bir yetki verilmiyor.
   * Sahip o veriyi müdür önizlemesinden hâlihazırda görüyor.
   */
  const { ben } = useBenKimim();
  const { veri: hamCizelge } = useVeri<SinifNotCizelgesi>('sinif_not_cizelgesi', {
    p_token: oturum?.token,
    p_sinif_id: id,
    p_onizleme: ben?.sahip === true,
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

  /**
   * VELİ KODLARI — öğretmenin isteği: "bu çizelgede veli kodu ve
   * sekizkyal giriş yönlendirmesi yazsın."
   *
   * KOD FİŞLERİ EKRANININ KORUMALARI AYNEN GETİRİLİYOR, çünkü bu kâğıt
   * artık bir KİMLİK BİLGİSİ taşıyor:
   *   • onay diyaloğu olmadan kod ağa GİTMİYOR,
   *   • 0017'nin sınırı korunuyor: toplu uç yok, `ogrenci_kodlari`
   *     öğrenci öğrenci çağrılıyor (sıralı, paralel değil),
   *   • kodlar tarayıcı deposuna YAZILMIYOR (denetim ölçüyor),
   *   • yalnız VELİ kodu basılıyor; öğrenci kodu bu kâğıda girmiyor
   *     (`kod-fisi.ts`in ayrımı).
   *
   * Onaylanmazsa çizelge yine basılıyor, giriş bloğu olmadan.
   */
  const [kodOnayi, setKodOnayi] = useState(false);
  const [kodlar, setKodlar] = useState<Record<string, string> | null>(null);
  const [kodAliniyor, setKodAliniyor] = useState(false);

  async function kodlariGetir() {
    if (!veri) return;
    setKodAliniyor(true);
    try {
      const toplanan: Record<string, string> = {};
      for (const o of veri.ogrenciler) {
        const k = await rpc<Kodlar>('ogrenci_kodlari', {
          p_token: oturum?.token,
          p_id: o.id,
        });
        // YALNIZ VELİ KODU ALINIYOR. Öğrenci kodu yanıtta gelse bile
        // buraya yazılmıyor: bu kâğıt veliye gidiyor.
        if (k?.veli) toplanan[o.id] = k.veli;
      }
      setKodlar(toplanan);
    } catch (e) {
      // YARIM LİSTE TUTULMUYOR: bazı velilerin kodu olan, bazılarının
      // olmayan bir tomar, öğretmenin "hepsini dağıttım" sanmasına yol
      // açardı (`KodFisleri`in aynı gerekçesi).
      setKodlar(null);
      bildir(e instanceof Error ? e.message : 'Kodlar alınamadı.', 'hata');
    } finally {
      setKodAliniyor(false);
      setKodOnayi(false);
    }
  }

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
          {/* KOD AYRI BİR ADIM. Çizelgeyi yalnız ödev durumu için basan
              öğretmenin eline habersiz bir kimlik bilgisi geçmesin;
              basmak isteyen açıkça istiyor. */}
          {kodlar === null && (
            <Button
              tur="sade"
              onClick={() => setKodOnayi(true)}
              disabled={!veri || kodAliniyor}
            >
              {kodAliniyor ? 'Kodlar alınıyor…' : 'Veli kodlarını da ekle'}
            </Button>
          )}
        </div>
      </div>

      {/* KOD FİŞLERİ EKRANININ DİYALOĞUNUN AYNISI. Kodların cihaza
          inmesi yazdırmak için kaçınılmaz; bunu gizlemek yerine
          söylüyoruz. */}
      <Dialog
        acik={kodOnayi}
        onKapat={() => setKodOnayi(false)}
        baslik="Sınıfın veli kodları getirilecek"
        aciklama="Yazdırmak için veli kodları bu cihaza inecek. Ekranı öğrencilere dönük bırakmayın; yazdırdıktan sonra sayfadan çıkın. Çizelgeye yalnız VELİ kodu basılır, öğrenci kodu basılmaz."
        onayEtiketi="Getir ve hazırla"
        onOnay={() => void kodlariGetir()}
        onayYukleniyor={kodAliniyor}
      />

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
                kodlar={kodlar}
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
 * ÖĞRENCİ BAŞINA AYRI KÂĞIT PARÇASI BİR TASARIM TERCİHİ DEĞİL, GİZLİLİK
 * KARARI. Sınıf listesi HER öğrencinin puanını taşıyor; o kâğıdı bir
 * veliye uzatmak öbür çocukların bilgisini de vermek olurdu.
 * `kod-fisi.ts` aynı dersi taşıyor ve bu ekran 0053'te zaten o karara
 * göre kurulmuştu.
 *
 * KÂĞIT BAŞINA KAÇ ÖĞRENCİ: öğretmen veli kodunu da basıyorsa giriş
 * bloğu yarımın üçte birini kaplıyor, o yüzden kâğıt başına BİR
 * öğrenciye geçiliyor (15 ödev satırı). Kodsuz basımda iki öğrenci (6
 * satır). İkisi de ölçüldü; rakamlar `veli-cizelgesi-metni.ts`te.
 *
 * TAŞMA SESSİZCE KIRPILMIYOR: sığmayan ödevler bir sonraki parçaya
 * "— 2/3" başlığıyla taşıyor (`parcalaraBol`).
 */
function VeliCizelgeleri({
  cizelge,
  an,
  kodlar,
  gizli,
}: {
  cizelge: SinifNotCizelgesi;
  an: Date;
  /** Öğrenci kimliği → VELİ kodu. Onaylanmadıysa `null`. */
  kodlar: Record<string, string> | null;
  gizli: boolean;
}) {
  const sinifAdi = cizelge.sinif.ad;
  const kiyaslar = cizelge.odevler.map((d) => d.kiyas);
  const seviyeAd = seviyeBasligi(kiyaslar);
  // 0091 çalıştırılmadıysa bu iki sütun HİÇ ÇİZİLMİYOR (Part VIII):
  // boş bir sütun başlığı, veliye olmayan bir bilgiyi vaat ederdi.
  const kiyasVar = cizelge.odevler.some((d) => d.kiyas !== undefined);
  const verilisVar = cizelge.odevler.some((d) => d.tarihler !== undefined);

  /**
   * KÂĞIT BAŞINA BİR ÖĞRENCİ — öğretmenin kararı: "Bir A4 sayfasında
   * sadece bir öğrencinin bilgileri olsun."
   *
   * Önceki tasarım koşulluydu (kod basılmıyorsa bir kâğıda iki öğrenci).
   * O koşul kalktı; kesme çizgisi de kalktı, çünkü kâğıdın tamamı tek
   * veliye gidiyor. Değişmeyen tek şey satır sayısının kodlu/kodsuz
   * olmasına bağlı olması: giriş bloğu sayfanın 46,8 mm'sini alıyor.
   * Rakamlar `veli-cizelgesi-metni.ts`te, ölçüm denetimde.
   */
  const kodluMod = kodlar !== null && Object.keys(kodlar).length > 0;
  const duzen = kagitDuzeni(kodluMod);

  /**
   * ANTETTEKİ KÜNYE O SINIFIN ÖĞRETMENİNDEN GELİYOR, SABİT DEĞİL.
   *
   * Öğretmen: "her diğer öğretmenlerin de dersine giren öğretmen kimse
   * onun adı yazsın." Kayıt `ogretmen_siniflari`nda ve uçtan
   * `sinif.ogretmenler` olarak geliyor. Kâğıdı BASAN öğretmene değil,
   * sınıfa giren öğretmene bakılıyor: "Hepsine ödev gönderiyorum fakat
   * ders işlediğim sınıflar bunlar."
   */
  const kunye = kunyeSatiri(cizelge.sinif.ogretmenler);
  const ogretmenKaydiYok = kunye === DERS;

  // Her öğrencinin parçaları: taşan çizelge bölünüyor.
  const yarimlar = cizelge.ogrenciler.flatMap((o) => {
    const satirlar = cizelge.odevler.map((d) => ({
      odev: d,
      hucre: o.puanlar.find((x) => x.odev_id === d.id) ?? null,
    }));
    const parcalar = parcalaraBol(satirlar, duzen.siganSatir);
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
        <p className="mt-1 text-[14px] text-muted">{duzen.aciklama}</p>
        {/* EKSİK KAYIT KÂĞIDA ÇIKMADAN ÖNCE SÖYLENİYOR. Antette ad
            yazmamasının sebebi uydurma değil, kayıt eksikliği; öğretmen
            bunu basmadan görsün ve isterse sınıfa kendini ekleyip
            yeniden bassın. */}
        {ogretmenKaydiYok && (
          <p className="mt-1 text-[13px] text-muted">
            Bu sınıfın dersine giren öğretmen işaretlenmemiş; antette yalnız ders
            yazacak. Öğretmenler ekranından “ders verdiği sınıflar”ı işaretleyin.
          </p>
        )}
        {/* KAPSAM BASMADAN ÖNCE SÖYLENİYOR.
            Çizelge ortak bir sınıfta eksik olabilir; öğretmen bunu kâğıt
            elinde kalmadan görsün. Kâğıda YAZILMIYOR: öğretmenin bildirdiği
            gerçek düzende her sınıfın tek öğretmeni var, yani eksik kapsam
            oluşmuyor; veliye durmadan bir uyarı basmak gürültü olurdu. */}
        <p className="mt-1 text-[13px] text-muted">
          {cizelge.kapsam === 'tum'
            ? 'Bu çizelgede sınıfın bütün ödevleri var.'
            : 'Bu çizelgede yalnız sizin ve platform sahibinin verdiği ödevler var.'}
        </p>
      </div>

      <div className="sk-cizelge-izgara mt-4 grid gap-3 print:mt-0">
        {yarimlar.map((y) => (
          <div key={y.anahtar} className="sk-veli-cizelge rounded-sk-sm border border-line p-4">
            {/* ÇİZELGENİN KENDİ ANTETİ: kesilip tek başına gittiğinde de
                resmî bir kâğıt (veli fişiyle aynı gerekçe). */}
            {/* `sk-cizelge-antet` ÖLÇÜM KANCASI. Künyede sabit ad
                olmadığını denetleyen kapılar (0092) bu bloğu okuyor;
                tüm sayfayı okusalardı alt imzadaki ürün sahibini de
                "künyeye sızmış ad" sanarlardı — nitekim ilk koşuda tam
                bunu yaptılar. */}
            <div className="sk-cizelge-antet flex items-center gap-3 border-b border-ink/20 pb-2">
              <SchoolCrest boyut={96} dekoratif className="sk-fis-muhru shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink">
                  {OKUL_ADI}
                </p>
                {/* KÜNYE İKİ TONLU: belgenin ADI koyu, kim verdiği ikincil.
                    Tek blok hâlinde hepsi kalın-büyük harfken antet kendi
                    içinde yarışıyordu; okul adı öne çıkmalı. */}
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">
                  <span className="font-semibold text-ink">{CIZELGE_BASLIGI}</span>
                  {' · '}
                  {kunye}
                </p>
              </div>
              {/* EWALU — öğretmenin isteği: "Ödev çizelgesinde Ewalu
                  maskotunun da görüntüsü olsun... arkasında okul adı
                  gözüken resim."

                  BOYU ARMANIN BOYU: antetin yüksekliğini arma belirliyor,
                  maskot onu AŞMIYOR, yani çizelgeye bir milimetre bile
                  eklemiyor ve yarıma sığan ödev satırı düşmüyor. Büyütmek
                  doğrudan ödev satırından yiyor (ölçüm denetimde).

                  `acele`: yazdırırken tembel yükleme görseli boş basardı.
                  Karakterin kendisine dokunulmuyor (Kural 9); bu, var olan
                  "okul" pozunun ta kendisi. */}
              <EwaluFigure
                poz="okul"
                bicim="tam"
                boyut={MASKOT_EKRAN_PX}
                acele
                className="sk-cizelge-maskot ml-auto shrink-0"
              />
            </div>

            {/* AD VE SINIF AYNI SATIRDA, TABANDAN HİZALI.
                Alt alta iki satırken kâğıdın en üstü üç ayrı blokla
                başlıyordu (antet, ad, sınıf). Yan yana durunca hem bir
                satır yer açılıyor — doğrudan ödev satırına dönüyor — hem
                de ad tek başına öne çıkıyor. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <p className="font-display text-[17px] font-semibold leading-tight text-ink">
                {y.baslik}
              </p>
              <p className="text-[12px] text-muted">
                {sinifAdi}
                {y.ogrenci.ogrenci_no ? ` · No ${y.ogrenci.ogrenci_no}` : ''}
              </p>
            </div>

            {/* ÖZET YALNIZ İLK YARIMDA: ikinci yarımda tekrar etmek, aynı
                sayıyı iki kez okutmak olurdu. */}
            {y.ilk && (
              /* ÖZET İKİ SÜTUN — AYNI YÜKSEKLİK, OKUNUR.
                 Tek satırda beş sayı art arda geliyordu ("Verilen ödev: 7 ·
                 Yapılan: 6 · Yapılmayan: 1 · Yaptığı ödevlerin ortalaması:
                 80,4 · Tüm ödevlerin ortalaması: 71,6") ve veli hangisinin
                 ne olduğunu ayırt edemeden okuyordu. İki sütun satır
                 yüksekliğini değiştirmiyor ama sayımı ortalamadan ayırıyor.
                 Metinler `sinif-yazdirma-metni.ts`ten geliyor, burada
                 yeniden yazılmıyor. */
              /* SÜTUN ORANI 2:3 — EŞİT DEĞİL.
                 Eşit bölündüğünde sol sütun ("Verilen ödev: 7 · Yapılan:
                 6 · Yapılmayan: 1") yarıyı doldurmuyor, sağdaki iki
                 ortalama ise sarıyordu: solda boşluk, sağda iki satır.
                 İçeriğin gerçek uzunluğuna göre bölündü. */
              <div className="sk-sayi mt-1 grid grid-cols-[2fr_3fr] gap-x-4 text-[11px] leading-snug text-ink">
                <p>
                  {odevSayilariYazisi(
                    y.ogrenci.yapti + y.ogrenci.yapmadi,
                    y.ogrenci.yapti,
                    y.ogrenci.yapmadi,
                  )}
                </p>
                <p>
                  {ikiOrtalamaSatiri(
                    typeof y.ogrenci.ortalama_yapan === 'string'
                      ? Number(y.ogrenci.ortalama_yapan)
                      : (y.ogrenci.ortalama_yapan ?? null),
                    typeof y.ogrenci.ortalama_tum === 'string'
                      ? Number(y.ogrenci.ortalama_tum)
                      : (y.ogrenci.ortalama_tum ?? null),
                  )}
                </p>
              </div>
            )}

            {/* TABLO BAŞLIĞI İKİNCİL TONDA.
                Başlıklar gövdeyle aynı koyulukta ve kalındı; göz önce
                onlara takılıyordu. Veli bu kâğıtta ÖDEV ADINI ve PUANI
                arıyor — başlık yol gösterir, yarışmaz. Küçük harf
                aralığı resmî belge dilinin kendi işareti. */}
            <table className="sk-cizelge-tablo mt-2 w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-ink/25 text-[9px] uppercase tracking-[0.07em] text-muted">
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
                      {/* PUAN KOYU: velinin bu kâğıtta ilk aradığı sayı.
                          Renk KULLANILMIYOR — düşük puanı kırmızıya
                          boyamak çocuğu etiketlemek olurdu. Vurgu yalnız
                          ağırlıkla. */}
                      <td className="sk-sayi py-1 pr-1 text-right font-semibold text-ink">
                        {puanYazisi(hucre?.puan)}
                      </td>
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

            {/* VELİ GİRİŞİ — kod, adres, uygulama kurulumu.
                YALNIZ İLK YARIMDA: aynı öğrencinin ikinci yarımı da aynı
                veliye gidiyor, kodu iki kez basmak yer kaybı olurdu.
                Kod yoksa (onaylanmadı ya da velinin kodu yok) blok HİÇ
                çizilmiyor — boş bir "Veli kodunuz:" satırı işe yaramaz. */}
            {y.ilk && girisBloguVarMi(kodlar?.[y.ogrenci.id]) && (
              <div className="mt-2">
                {/* KÂĞIDIN TEK GEOMETRİK VURGUSU (Kural 10: bir ekranda
                    en fazla bir tane). Düz bir çizgi yerine markanın
                    kendi ayracı: ince hat + sekiz köşeli yıldız düğümü.
                    Yeri bilinçli — belgenin "okul kaydı" kısmı burada
                    bitiyor, "eve götürülecek yönerge" burada başlıyor. */}
                <GeometricDivider className="mb-1" />
                <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink">
                  {GIRIS_BASLIGI}
                </p>
                <p className="mt-0.5 text-[11px] text-ink">
                  {KOD_ETIKETI}:{' '}
                  <span className="sk-sayi font-semibold tracking-[0.12em]">
                    {kodlar?.[y.ogrenci.id]}
                  </span>
                </p>
                <ul className="mt-0.5 text-[9px] leading-snug text-muted">
                  {GIRIS_SATIRLARI.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="mt-0.5 text-[9px] font-semibold text-ink">
                  {KURULUM_BASLIGI}
                </p>
                <ul className="text-[9px] leading-snug text-muted">
                  {KURULUM.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ALT İMZA — ÜRÜNÜN ADI KÂĞITTA (öğretmenin isteği:
                "8 uygulamasının logosunu da ekle bir yere").

                YERİ ANTET DEĞİL ALT BİLGİ. Antette okul arması var ve bu
                kâğıt OKULUN belgesi; SEKİZ onu hazırlayan araç. İkisini
                üst üste koymak, veliye "bu kâğıdı kim veriyor" sorusunu
                iki kez sordururdu. Alt imza, basılı belgelerin kendi
                geleneği.

                `bicim="sahip"` — işaretin altında ÜRÜNÜN SAHİBİNİN adı
                (öğretmenin isteği: "8 logosunun altına Buket Topuzoğlu
                diye de yaz"). Branşsız, çünkü antette "MATEMATİK" zaten
                var. BU AD ANTETTEKİYLE AYNI ŞEY DEĞİL: antet o sınıfın
                ders öğretmenini yazıyor (0092), alt imza her kâğıtta
                sabit kalıyor — öğretmen bu ayrımı bilerek seçti. `xs` ölçüsü kesilip dağıtılan kâğıt için
                zaten ölçülmüştü (kod fişi, `SekizWordmark`).

                İŞARET DÖNMÜYOR: `acilistaDonsun` varsayılan false, yani
                sabit 8 (Kural 12 — dönüş yalnız dört yerde). Kâğıtta
                hareket zaten olamaz; önemli olan bileşenin kâğıt için
                doğru kipte çağrılması. */}
            <div className="mt-2 border-t border-line pt-1 text-[9px] leading-snug text-muted">
              {/* İMZA KISA SATIRIN HİZASINDA, UZUN NOT TAM GENİŞLİKTE.
                  İkisi tek blokken imza metni daraltıyordu ve kapanış
                  notunun son kelimesi tek başına üçüncü satıra düşüyordu.
                  Tarih satırı kısa; imza onun yanında boş duran yere
                  oturuyor ve kâğıt bir satır uzamıyor. */}
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0">{cizelgeAltNotu(sinifAdi, an)}</p>
                <SekizWordmark bicim="sahip" boyut="sm" className="shrink-0" />
              </div>
              <p>{CIZELGE_NOTU}</p>
            </div>
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
