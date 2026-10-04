import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useBenKimim } from '@/hooks/useBenKimim';
import { Yedek } from './Yedek';
import { CozumDugmesi } from './CozumDugmesi';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { GENEL_ACIKLAMA, GenelOzet } from '@/features/genel/GenelOzet';
import type { OkulGeneli, Pano as PanoVerisi } from '@/types/api';

/** `Card`'ın görünümü, iç boşluksuz: satırlar kenara kadar uzansın. */
const LISTE_KUTUSU = 'overflow-hidden rounded-sk-md border border-line bg-surface shadow-sk-sm';

/**
 * BUGÜN SATIRI — dar (0065, öğretmenin isteği: "üstte kalsın fakat daha
 * dar satırlarda gösterilsin"). Eskiden dört büyük kutuydu; sayfanın
 * altına okulun genel özeti eklenince kutular ekranın yarısını alıyordu.
 *
 * Satırın TAMAMI düğme ve listenin kapısı ("11 öğrenci göndermemiş"
 * bilgisi o on bir ismi açmalı); 44 px dokunma yüksekliği korunuyor.
 */
function BugunSatiri({
  deger,
  etiket,
  vurgu,
  onAc,
}: {
  deger: number;
  etiket: string;
  vurgu?: 'tehlike' | 'uyari';
  onAc: () => void;
}) {
  const renk =
    vurgu === 'tehlike' && deger > 0
      ? 'text-danger'
      : vurgu === 'uyari' && deger > 0
        ? 'text-warning'
        : 'text-ink';
  return (
    <li>
      <button
        type="button"
        onClick={onAc}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
      >
        <span className="text-[15px] text-ink">{etiket}</span>
        <span className="flex items-center gap-2">
          <span className={`sk-sayi font-display text-[20px] font-semibold ${renk}`}>{deger}</span>
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Öğretmenin GENEL sayfası (0065'e kadar "Pano").
 *
 * Öğretmenin isteği: "Müdürün genel sekmesinde olan bilgiler öğretmenlerin
 * pano sayfasında olsun. Öğretmenlerin Pano sayfasının adı 'genel' olarak
 * değiştirilsin." Kapsam okulun tamamı (öğretmenin seçimi).
 *
 * Üstte hâlâ "bugün neye bakmalıyım?" (dar satırlarla), altında okulun
 * genel özeti — müdürün Genel sekmesiyle AYNI bileşen (`GenelOzet`).
 * İki ayrı uç ve iki ayrı yükleme: özet yavaş ya da hatalıysa bugünün
 * işleri yine görünür.
 */
export function Pano() {
  const { ben } = useBenKimim();
  const { oturum } = useOturum();
  const git = useNavigate();
  const { veri, durum, hata, yenile } = useVeri<PanoVerisi>('ogretmen_panosu', {
    p_token: oturum?.token,
  });
  const genel = useVeri<OkulGeneli>('okul_geneli', { p_token: oturum?.token });
  // 0065 panelde henüz çalıştırılmadıysa özet bölümü hiç çizilmiyor.
  const genelUcYok =
    genel.hata !== null && /could not find the function|schema cache/i.test(genel.hata);

  return (
    <>
      {/* Başlık bloğunu EWALU SÖYLÜYOR.
          `SayfaBasligi` yerine buraya özel bir blok yazılıyor: diğer
          ekranlarda başlık nötr bir etikettir, panoda ise günün özetini
          asistan aktarıyor. Görsel ile metin yan yana durunca cümlenin
          sahibi belli oluyor — giriş ekranındaki Ewalu bloğuyla aynı kalıp.

          `calisma` pozu: okul ceketi, kulağının arkasında kalem. Panonun
          işi "bugün ne yapmalıyım" olduğu için çalışma bağlamı doğru poz;
          `karsilama` girişe, `kutlama` başarıya ait.

          `dekoratif` — cümlenin kendisi zaten yanında yazıyor; ekran
          okuyucunun ayrıca "Ewalu ceketiyle defterine yazıyor" demesi
          bilgi katmaz, tekrar olurdu. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <EwaluFigure poz="calisma" boyut={56} dekoratif className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] text-ink">Genel</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            Bugün dikkat etmeniz gerekenler ve okulun genel durumu
          </p>
        </div>
        {/* DUYURU (0065): alt çubukta yedinci sekmeye yer yok (360 px'de
            ölçüldü); her gün açılan bu sayfanın başında duruyor. */}
        <Link
          to="/ogretmen/duyurular"
          className="inline-flex min-h-[44px] items-center rounded-sk-md border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:border-ink-soft"
        >
          Duyuru yap
        </Link>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz veri yok"
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
        yuklemeAdedi={2}
      >
        {veri && (
          <>
            <h2 className="mb-2 text-[18px] text-ink">Bugün</h2>
            <div className={LISTE_KUTUSU}>
              <ul className="divide-y divide-line">
                {/* Ödev verilen öğrenci: TOPLAM değil, sistemin ulaştığı
                    öğrenci — öğretmenin isteği. */}
                <BugunSatiri
                  deger={veri.odev_verilen_ogrenci}
                  etiket="Ödev verilen öğrenci"
                  onAc={() => git('/ogretmen/bugun/ogrenci')}
                />
                <BugunSatiri
                  deger={veri.acik_odev}
                  etiket="Açık ödev"
                  onAc={() => git('/ogretmen/bugun/acik_odev')}
                />
                <BugunSatiri
                  deger={veri.gecikmis_eksik}
                  etiket="Göndermeyen"
                  vurgu="tehlike"
                  onAc={() => git('/ogretmen/bugun/gondermeyen')}
                />
                <BugunSatiri
                  deger={veri.bekleyen_degerlendirme}
                  etiket="Puan bekliyor"
                  vurgu="uyari"
                  onAc={() => git('/ogretmen/bugun/puan_bekleyen')}
                />
              </ul>
            </div>

            {/* Burada İKİNCİ bir Ewalu YOK. Başlıkta zaten konuşuyor;
                aynı ekranda ikinci bir figür karakteri süse çevirir
                (Part VII: Ewalu asistandır, dekor değil). */}
            {veri.ogrenci_sayisi === 0 && (
              <Card className="mt-4">
                <p className="font-semibold text-ink">Başlamak için öğrenci ekleyin</p>
                <p className="mt-1 text-[14px] text-muted">
                  Sınıflar hazır.{' '}
                  <Link to="/ogretmen/ogrenciler" className="font-bold text-link underline">
                    Öğrenciler
                  </Link>{' '}
                  bölümünden ilk öğrencinizi ekleyebilirsiniz.
                </p>
              </Card>
            )}

            <h2 className="mb-2 mt-6 text-[18px] text-ink">Son gönderimler</h2>
            {veri.son_gonderimler.length === 0 ? (
              <Card>
                <p className="text-[14px] text-muted">Henüz gönderim yok.</p>
              </Card>
            ) : (
              <div className={LISTE_KUTUSU}>
                <ul className="divide-y divide-line">
                  {veri.son_gonderimler.map((g, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        {/* AD + SINIF, ADA TIKLAYINCA ÇÖZÜM (0055). Alanlar
                            0055 öncesinde gelmiyor: o zaman ad düz metin. */}
                        {g.gonderim_id ? (
                          <CozumDugmesi
                            gonderimId={g.gonderim_id}
                            etiket={g.ogrenci}
                            erisilebilirAd={`${g.ogrenci} — çözümü aç`}
                          />
                        ) : (
                          <span className="font-semibold text-ink">{g.ogrenci}</span>
                        )}
                        {g.sinif && <span className="ml-2 text-[13px] text-muted">{g.sinif}</span>}
                        <p className="truncate text-[13px] text-muted">{g.odev}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {g.gecikmeli && <Tag tur="uyari">Gecikmeli</Tag>}
                        {g.puan === null ? (
                          <Tag tur="uyari">Puan bekliyor</Tag>
                        ) : (
                          <Tag tur="basari">
                            {/* Sayı ve kelime TEK metin düğümünde ("92puan"
                                olmasın). */}
                            <span className="sk-sayi">{g.puan} puan</span>
                          </Tag>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* OKULUN GENEL DURUMU (0065) — müdürün Genel sekmesiyle aynı. */}
            {!genelUcYok && (
              <section aria-labelledby="okul-geneli" className="mt-8">
                <h2 id="okul-geneli" className="text-[18px] text-ink">
                  Okulun genel durumu
                </h2>
                <p className="mb-3 text-[13px] text-muted">{GENEL_ACIKLAMA}</p>
                <AsyncBoundary
                  durum={
                    genel.durum === 'hazir' && (genel.veri?.siniflar?.length ?? 0) === 0
                      ? 'bos'
                      : genel.durum
                  }
                  bosBaslik="Henüz sınıf yok"
                  {...(genel.hata ? { hataAciklama: genel.hata } : {})}
                  tekrarDene={genel.yenile}
                >
                  {/* Beklenmeyen yanıt (ör. eski sunucu) bütün sayfayı düşürmesin. */}
                  {genel.veri?.okul && <GenelOzet veri={genel.veri} />}
                </AsyncBoundary>
              </section>
            )}

            {/* YEDEK EN ALTTA, bilerek. Panonun işi "bugün ne yapmalıyım";
                yedek günlük bir iş değil. Ama görünmeyen yedek alınmayan
                yedektir — bu yüzden ayrı bir sekmeye gömülmedi, öğretmenin
                her gün açtığı ekranın sonunda duruyor. Eskidiğinde kart
                sarıya dönüp kendini hatırlatıyor. */}
            {/* YEDEK YALNIZ SAHİPTE (0033). `disa_aktar` bütün sistemi tek
                dosyada indiriyor; dört öğretmenin her birinin
                meslektaşlarının verisini indirmesi kabul edilemez. Sunucu
                zaten reddediyor — ekran reddedilecek bir düğmeyi hiç
                göstermiyor (`ucYok` deseni, Part VIII).

                VARSAYILAN GÜVENLİ TARAFTA: kart yalnız "bu kişi sahip
                DEĞİL" olduğunu BİLDİĞİMİZDE gizleniyor. 0033 panelde henüz
                çalıştırılmadıysa `ben_kimim` ucu yoktur ve `ben` null
                kalır — o durumda kart bugünkü gibi görünmeye devam eder.
                Aksi hâlde arayüz yayınlanıp SQL çalıştırılmadığı aralıkta
                öğretmen yedek alamaz hâle gelirdi. */}
            {(ben === null || ben.sahip) && (
              <>
                <h2 className="mb-3 mt-8 text-[18px] text-ink">Verinizin yedeği</h2>
                <Yedek />
              </>
            )}

            {/* Dar ekranda yan menü gizli; Ayarlar'a tek giriş burası.
                `lg:hidden` — geniş ekranda yan menüde zaten var, iki kez
                göstermek gereksiz. */}
            <p className="mt-4 text-[14px] text-muted lg:hidden">
              <Link
                to="/ogretmen/ayarlar"
                className="inline-flex min-h-[44px] items-center font-bold text-link underline"
              >
                Ayarlar
              </Link>{' '}
              — PIN’inizi buradan değiştirebilirsiniz.
            </p>

            {/* ÖĞRETMENLER EKRANINA DAR EKRANDAN GİRİŞ.
                Ölçülerek bulunan kusur: bağlantıyı yalnız yan menüye
                koymuştum ve yan menü `lg` altında gizli. Sonuç, sahibin
                arkadaşlarını TELEFONDAN hiç ekleyememesiydi — ekran
                vardı, ona giden yol yoktu. Sunucu tarafında bir kusur
                değildi, o yüzden hiçbir sızıntı testi görmedi.

                Ayarlar'la aynı desen: `lg:hidden`, çünkü geniş ekranda
                yan menüde zaten duruyor. Alt sekme çubuğuna yedinci
                sekme KONULMUYOR — 360 px'de sığmadığı ölçülmüştü. */}
            {ben?.sahip && (
              <p className="mt-2 text-[14px] text-muted lg:hidden">
                <Link
                  to="/ogretmen/ogretmenler"
                  className="inline-flex min-h-[44px] items-center font-bold text-link underline"
                >
                  Öğretmenler
                </Link>{' '}
                — öğretmen ekleyebilir, sınıf atayabilirsiniz.
              </p>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}
