import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { KodKutusu } from '@/components/ui/KodKutusu';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import {
  GERI,
  KONU_ACIKLAMASI,
  SINIF_KUTUSU_ACIKLAMASI,
  SINIF_KUTUSU_BASLIGI,
  SINIF_YOK,
  eksikKonuYazisi,
  odevSayisiYazisi,
  ortalamaYazisi,
} from '@/lib/sinif-ozet-metni';
import type { Kodlar, OgrenciListesi, Sinif, SinifOgrenciOzeti, YeniOgrenci } from '@/types/api';

export function Ogrenciler() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const [arama, setArama] = useState('');
  const [sinifId, setSinifId] = useState('');
  const [sayfa, setSayfa] = useState(1);

  const [ekleAcik, setEkleAcik] = useState(false);
  const [ad, setAd] = useState('');
  const [tur, setTur] = useState<'okul' | 'ozel'>('okul');
  const [yeniSinif, setYeniSinif] = useState('');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);
  /**
   * YENİ EKLENEN ÖĞRENCİNİN KODLARI — bu ekranda kalan TEK kod yolu.
   *
   * Öğretmenin isteği: "Öğrenciler sekmesinin içinde kodlara gerek yok."
   * Satırlardaki `Kodlar` düğmesi bu yüzden kalktı; kod listesinin yeri
   * Ayarlar → Giriş kodları (`/ogretmen/kodlar`).
   *
   * Bu diyalog istisna ve bir kod listesi değil: `ogrenci_ekle`nin
   * DÖNDÜRDÜĞÜ sonuç. Sunucu kodu bir kez üretip veriyor; burada
   * göstermeseydik öğretmenin onu alabileceği başka bir an olmazdı.
   * Kimlik tutulmuyor (`id` alanı yok) — yenileme artık Kodlar
   * ekranının işi.
   */
  const [yeniKodlar, setYeniKodlar] = useState<{ ad: string; kodlar: Kodlar } | null>(null);
  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  const aranan = arama.trim();

  /**
   * TAZELEME SAYACI.
   *
   * Liste artık ebeveynde DEĞİL: arama sonuçları ve sınıf özeti ayrı
   * bileşenlerde ve her biri kendi ucunu çağırıyor. Sebebi `useVeri`nin
   * çağrıyı atlayamaması — hook ebeveynde dursaydı, sınıf kutusuna
   * bakarken bile `ogrenciler_listesi` boş yere çağrılırdı.
   *
   * Öğrenci eklendiğinde bu sayaç artıyor ve çocuklara `key` olarak
   * geçtiği için yeniden kuruluyorlar. (Çıkarma artık bu ekranda değil;
   * kendi ekranında kendi sayacı var.)
   */
  const [tazele, setTazele] = useState(0);

  async function ekle() {
    if (!ad.trim()) {
      setFormHatasi('Ad soyad yazın.');
      return;
    }
    if (tur === 'okul' && !yeniSinif) {
      setFormHatasi('Okul öğrencisi için sınıf seçin.');
      return;
    }
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      const y = await rpc<YeniOgrenci>('ogrenci_ekle', {
        p_token: oturum?.token,
        p_ad: ad.trim(),
        p_tur: tur,
        p_sinif_id: tur === 'okul' ? yeniSinif : null,
      });
      setEkleAcik(false);
      // Kodları hemen göster: öğretmenin bunları öğrenciye iletmesi gerek,
      // listeye dönüp aramak zorunda kalmasın.
      setYeniKodlar({
        ad: ad.trim(),
        kodlar: { ogrenci: y.ogrenci_kodu, veli: y.veli_kodu },
      });
      setAd('');
      setTazele((t) => t + 1);
      siniflar.yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Öğrenci eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  /*
   * ÖĞRENCİ ÇIKARMA BURADAN KALKTI (öğretmenin isteği: "Öğrenci
   * çıkarmak ayarlar içerisinde bir sekmede olsun").
   *
   * Her satırın sağında bir `Çıkar` düğmesi vardı. Geri alınamaz bir iş,
   * öğretmenin en sık açtığı listenin kenarında duruyordu. Yeni yeri
   * `OgrenciCikar.tsx` — Ayarlar → Öğrenci çıkarma.
   *
   * Silinmedi, TAŞINDI: kayıt burada dursun ki bir yıl sonra "burada
   * neden çıkarma yok" diye bakan biri, hiç olmadığını değil yerinin
   * değiştiğini görsün (0048'in Mesajlar kaydıyla aynı gerekçe).
   */

  return (
    <>
      <SayfaBasligi
        baslik="Öğrenciler"
        aciklama="Her öğrenci için ayrı öğrenci ve veli kodu üretilir."
        eylem={
          <div className="flex flex-wrap gap-2">
            {/* Tek öğrenci ekleme AYNEN DURUYOR: yıl içinde gelen bir
                öğrenciyi eklemek tek tıklık bir iş olmayı sürdürmeli.
                Toplu yol dönem başı için ikinci düğme. */}
            <Button tur="ikincil" onClick={() => git('/ogretmen/ogrenciler/toplu')}>
              Toplu ekle
            </Button>
            <Button onClick={() => setEkleAcik(true)}>Öğrenci ekle</Button>
          </div>
        }
      />


      <div className="mb-4">
        <SearchInput
          deger={arama}
          onDegis={(v) => {
            setArama(v);
            setSayfa(1);
          }}
          etiket="Öğrenci ara"
          yerTutucu="Ad ile ara…"
        />
      </div>

      {/* SINIF KUTUSU — öğretmenin isteği (0051):
          "sınıflar kategorize olmuş bir şekilde çıksın… sınıflara
          tıkladığım zaman öğrencilerin listesi çıksın."

          AÇILIR LİSTENİN YERİNE GELDİ. Eskiden sınıf bir `<select>`
          süzgeciydi; on üç sınıfı görmek için açmak gerekiyordu. Kutu
          hepsini birden gösteriyor ve dokunma hedefi 44 px.

          ARAMA VARKEN KUTU ÇİZİLMİYOR: arama bütün sınıflar arasında
          çalışıyor, yanında bir sınıf kutusu durması "hangisi geçerli"
          sorusunu doğururdu. */}
      {!aranan && !sinifId && (
        <Card>
          <p className="font-semibold text-ink">{SINIF_KUTUSU_BASLIGI}</p>
          <p className="mt-1 text-[14px] text-muted">{SINIF_KUTUSU_ACIKLAMASI}</p>
          {siniflar.veri && siniflar.veri.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">{SINIF_YOK}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(siniflar.veri ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSinifId(s.id);
                    setSayfa(1);
                  }}
                  className="min-h-[44px] rounded-sk-sm border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-line-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span>{s.ad}</span>
                  <span className="sk-sayi ml-2 text-[13px] font-normal text-muted">
                    {s.ogrenci_sayisi}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Bir sınıf seçildiğinde karneye geçiş. Öğretmen bu sekmede de
          "sınıfa tıklayınca öğrenci listesi ve ödev karnesi" istedi;
          Sınıflar sekmesindeki AYNI ekrana gidiyor, ikinci bir kopya
          yazılmadı. */}
      {/* ÜÇ GÖRÜNÜM BİRBİRİNİ DIŞLIYOR (0051).
          arama varsa       → bütün sınıflar arasında arama sonuçları
          sınıf seçiliyse   → o sınıfın özeti (ortalama + en eksik konu)
          hiçbiri yoksa     → sınıf kutusu (yukarıda)

          Her biri AYRI BİLEŞEN, çünkü `useVeri` çağrıyı atlayamıyor:
          hook'lar ebeveynde dursaydı sınıf kutusuna bakarken bile iki uç
          birden çağrılırdı. */}
      {aranan ? (
        <AramaSonuclari
          key={`arama-${tazele}`}
          arama={aranan}
          sayfa={sayfa}
          onSayfa={setSayfa}
        />
      ) : sinifId ? (
        <SinifOzeti
          key={`ozet-${sinifId}-${tazele}`}
          sinifId={sinifId}
          onGeri={() => setSinifId('')}
          onKarne={() => git(`/ogretmen/siniflar/${sinifId}`)}
        />
      ) : null}

      {/* --- Öğrenci ekleme --- */}
      <Dialog
        acik={ekleAcik}
        onKapat={() => setEkleAcik(false)}
        baslik="Öğrenci ekle"
        onayEtiketi="Ekle"
        onOnay={ekle}
        onayYukleniyor={kaydediyor}
      >
        <Field etiket="Ad Soyad" zorunlu>
          {(k) => <Input {...k} value={ad} onChange={(e) => setAd(e.target.value)} />}
        </Field>
        <Field etiket="Öğrenci türü">
          {(k) => (
            <Select
              {...k}
              value={tur}
              onChange={(e) => setTur(e.target.value as 'okul' | 'ozel')}
            >
              <option value="okul">Okul öğrencisi</option>
              <option value="ozel">Özel ders öğrencisi</option>
            </Select>
          )}
        </Field>
        {tur === 'okul' && (
          <Field etiket="Sınıf" zorunlu {...(formHatasi ? { hata: formHatasi } : {})}>
            {(k) => (
              <Select {...k} value={yeniSinif} onChange={(e) => setYeniSinif(e.target.value)}>
                <option value="">Seçin…</option>
                {siniflar.veri?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {tur === 'ozel' && formHatasi && (
          <p role="alert" className="text-[12px] font-semibold text-danger">
            {formHatasi}
          </p>
        )}
      </Dialog>

      {/* --- Yeni eklenen öğrencinin kodları --- */}
      <Dialog
        acik={yeniKodlar !== null}
        onKapat={() => setYeniKodlar(null)}
        baslik={yeniKodlar ? `${yeniKodlar.ad} — giriş kodları` : ''}
        aciklama="Kodun üzerine dokunarak kopyalayabilirsiniz. Kodlar bir şifredir; güvenli kanaldan paylaşın."
      >
        <div className="flex flex-col gap-3">
          {yeniKodlar?.kodlar.ogrenci && (
            <KodKutusu etiket="Öğrenci kodu" kod={yeniKodlar.kodlar.ogrenci} />
          )}
          {yeniKodlar?.kodlar.veli && (
            <KodKutusu etiket="Veli kodu" kod={yeniKodlar.kodlar.veli} />
          )}
          {/* Kodu sonradan bulmanın yolu BURADA yazıyor. Bu diyalog
              kapandıktan sonra bu sekmede kod yok; öğretmen "kaybettim mi"
              diye düşünmesin. */}
          <p className="text-[12px] text-muted">
            Bu kodlara sonradan <strong>Ayarlar → Giriş kodları</strong> bölümünden
            ulaşabilirsiniz; kod yenileme de orada.
          </p>
        </div>
      </Dialog>
    </>
  );
}


/*
 * "YANIT BEKLEYEN ÖĞRENCİLER" BÖLÜMÜ BURADAN KALDIRILDI (0048).
 *
 * 0025'te öğretmenin kararıyla buraya konmuştu: "Öğretmen girişinde
 * öğrenci ile mesajlaşma bölümünü öğrenciler kısmına ekle." O karar bu
 * turda DEĞİŞTİ — öğretmen ayrı bir Mesajlar sekmesi istedi ve "eski
 * kapılar kalksın, tek kapı Mesajlar" dedi.
 *
 * Eski karar silinmiyor, üzerine yazılıyor: bir yıl sonra "burada neden
 * mesajlaşma yok" diye bakan biri, hiç olmadığını değil, taşındığını
 * görsün.
 *
 * Yazışma EKRANI duruyor (`/ogretmen/ogrenciler/yazisma/:id`); yalnız
 * bu sayfadaki giriş listesi kalktı. Mesajlar sekmesi oraya
 * yönlendiriyor.
 */

/**
 * ARAMA SONUÇLARI — bütün sınıflar arasında, ada göre.
 *
 * 0051'e kadar bu liste ekranın varsayılan görünümüydü ve sınıf bir
 * açılır süzgeçti. Artık yalnız ARAMA yapıldığında çiziliyor: öğretmen
 * sınıfa dokunarak geziyor, adını bildiği birini ararken buraya düşüyor.
 *
 * SIRA ADA GÖRE ve bu bilinçli: arama bütün sınıfları tarıyor, numaraya
 * göre sıralamak iki farklı sınıfın 601'ini yan yana getirirdi. Sınıf
 * içi numara sırası artık `SinifOzeti`'nin işi (sunucuda).
 */
function AramaSonuclari({
  arama,
  sayfa,
  onSayfa,
}: {
  arama: string;
  sayfa: number;
  onSayfa: (s: number) => void;
}) {
  const { oturum } = useOturum();
  const liste = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    {
      p_token: oturum?.token,
      p_arama: arama,
      p_sinif_id: null,
      p_sayfa: sayfa,
      p_boyut: 25,
      p_sirala: 'ad',
    },
    (v) => v.kayitlar.length === 0,
  );

  return (
    <AsyncBoundary
      durum={liste.durum}
      bosBaslik="Eşleşen öğrenci yok"
      bosAciklama="Aramayı değiştirmeyi deneyin."
      {...(liste.hata ? { hataAciklama: liste.hata } : {})}
      tekrarDene={liste.yenile}
    >
      {liste.veri && (
        <>
          <p className="mb-2 text-[13px] text-muted">
            <span className="sk-sayi">{liste.veri.toplam}</span> öğrenci
          </p>
          <div className="space-y-2">
            {liste.veri.kayitlar.map((o) => (
              <Card key={o.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {o.ogrenci_no && (
                      <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                        {o.ogrenci_no}
                      </span>
                    )}
                    <Link
                      to={`/ogretmen/ogrenciler/${o.id}`}
                      className="inline-flex min-h-[44px] items-center font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                    >
                      {o.ad}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {o.tur === 'ozel' ? (
                        <Tag tur="uyari">Özel ders</Tag>
                      ) : (
                        o.sinif && <Tag>{o.sinif}</Tag>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination
            sayfa={liste.veri.sayfa}
            toplamSayfa={liste.veri.toplam_sayfa}
            onDegis={onSayfa}
            etiket="Öğrenci listesi"
          />
        </>
      )}
    </AsyncBoundary>
  );
}

/**
 * BİR SINIFIN ÖĞRENCİ ÖZETİ (0051).
 *
 * Öğretmenin isteği: "sınıflara tıkladığım zaman öğrencilerin listesi
 * çıksın. Sınıf listesine göre listesi çıksın. Ve bireysel olarak ödev
 * ortalamaları öğrenci isimlerinin karşısında yazsın. Aynı zamanda en
 * çok eksik olduğu konunun adı da yazsın."
 *
 * SIRA SUNUCUDAN GELİYOR, BURADA YENİDEN SIRALANMIYOR. Uç okul
 * numarasına göre diziyor, numarasızı sona koyuyor. İkinci bir `sort`
 * yazmak iki yerin bir gün ayrışması demekti — ve sınıf listesi sırası
 * öğretmenin yoklama alırken kullandığı sıra.
 *
 * SAYFALAMA YOK: bir sınıf en fazla otuz küçük satır. Sayfalama, bir
 * ekranda görülebilecek bir listeyi ikiye bölerdi.
 */
function SinifOzeti({
  sinifId,
  onGeri,
  onKarne,
}: {
  sinifId: string;
  onGeri: () => void;
  onKarne: () => void;
}) {
  const { oturum } = useOturum();
  const ozet = useVeri<SinifOgrenciOzeti>(
    'sinif_ogrenci_ozeti',
    { p_token: oturum?.token, p_sinif_id: sinifId },
    (v) => v.ogrenciler.length === 0,
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button tur="sade" olcu="sm" onClick={onGeri}>
          {GERI}
        </Button>
        {ozet.veri && (
          <Button tur="sade" olcu="sm" onClick={onKarne}>
            {`${ozet.veri.sinif.ad} karnesi — kim ne yaptı`}
          </Button>
        )}
      </div>

      <AsyncBoundary
        durum={ozet.durum}
        bosBaslik="Bu sınıfta öğrenci yok"
        bosAciklama="Öğrenci ekle ya da Toplu ekle ile bu sınıfa öğrenci ekleyebilirsiniz."
        {...(ozet.hata ? { hataAciklama: ozet.hata } : {})}
        tekrarDene={ozet.yenile}
      >
        {ozet.veri && (
          <>
            <h2 className="mb-3 font-display text-[20px] font-semibold text-ink">
              {ozet.veri.sinif.ad}
            </h2>
            <div className="space-y-2">
              {ozet.veri.ogrenciler.map((o) => (
                <Card key={o.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      {o.ogrenci_no && (
                        <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                          {o.ogrenci_no}
                        </span>
                      )}
                      <Link
                        to={`/ogretmen/ogrenciler/${o.id}`}
                        className="inline-flex min-h-[44px] items-center font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                      >
                        {o.ad}
                      </Link>
                      {/* EN EKSİK KONU — adın altında, küçük.
                          Boşsa tire; sebebi listenin altında yazılı. */}
                      <p className="mt-1 text-[13px] text-muted">
                        {eksikKonuYazisi(o.en_eksik_konu)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* ORTALAMA — adın KARŞISINDA (öğretmenin isteği). */}
                      <p className="text-right">
                        <span className="sk-sayi block text-[18px] font-semibold text-ink">
                          {ortalamaYazisi(o.ortalama)}
                        </span>
                        {o.ortalama !== null && (
                          <span className="sk-sayi block text-[12px] text-muted">
                            {odevSayisiYazisi(o.odev_sayisi)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-snug text-muted">{KONU_ACIKLAMASI}</p>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}
