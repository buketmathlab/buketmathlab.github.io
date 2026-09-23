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
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type {
  Kodlar,
  KodYenileme,
  OgrenciListesi,
  OgrenciSatiri,
  Sinif,
  YeniOgrenci,
} from '@/types/api';

export function Ogrenciler() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
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
  const [yeniKodlar, setYeniKodlar] = useState<{
    id: string | null;
    ad: string;
    kodlar: Kodlar;
  } | null>(null);
  /**
   * YENİLEME ONAYI (0045). Geri alınamaz bir iş: onay olmadan yapılmaz.
   * `id` null ise (yeni eklenen öğrencinin kodları gösteriliyor) yenileme
   * düğmesi hiç çizilmiyor — zaten yeni üretilmiş bir kodu yenilemenin
   * anlamı yok ve elimizde kimlik de olmazdı.
   */
  const [yenilenecek, setYenilenecek] = useState<{ rol: 'ogrenci' | 'veli' } | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [silinecek, setSilinecek] = useState<OgrenciSatiri | null>(null);

  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  const liste = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    {
      p_token: oturum?.token,
      p_arama: arama.trim() || null,
      p_sinif_id: sinifId || null,
      p_sayfa: sayfa,
      p_boyut: 25,
      /**
       * SINIF SEÇİLİYSE NUMARAYA GÖRE (0044).
       *
       * Karar "ekran" düzeyinde değil "sınıf seçili mi" düzeyinde
       * veriliyor ve bunun sebebi ölçüldü: ilk yazımda bu ekranın tamamı
       * ada göre bırakılmıştı, gerekçe "sınıf seçmeden bakarken farklı
       * sınıfların aynı numaraları iç içe geçer" idi. Gerekçe doğru ama
       * kural fazla kabaydı — öğretmen buradan 9A'yı seçip numara sırası
       * bekledi ve haklıydı: sınıf seçiliyken o itiraz ortadan kalkıyor.
       *
       * Sınıf seçili DEĞİLKEN ada göre kalıyor; orada numara sıralaması
       * iki farklı sınıfın 601'ini yan yana getirirdi.
       */
      p_sirala: sinifId ? 'numara' : 'ad',
    },
    (v) => v.kayitlar.length === 0,
  );

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
        id: null,
        ad: ad.trim(),
        kodlar: { ogrenci: y.ogrenci_kodu, veli: y.veli_kodu },
      });
      setAd('');
      liste.yenile();
      siniflar.yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Öğrenci eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function kodlariGoster(o: OgrenciSatiri) {
    try {
      const k = await rpc<Kodlar>('ogrenci_kodlari', { p_token: oturum?.token, p_id: o.id });
      setYeniKodlar({ id: o.id, ad: o.ad, kodlar: k });
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kodlar alınamadı.', 'hata');
    }
  }

  /**
   * KODU YENİLE (0045) — iptal ve yeniden verme.
   *
   * Sunucu eski kodu öldürüp yenisini üretiyor ve O ROLÜN açık oturumunu
   * kapatıyor. Burada kritik olan şey yeni kodun EKRANDA KALMASI:
   * öğretmen onu hemen yazacak ya da fişini basacak. Diyalog kapanıp
   * kodun kaybolması, yenilemeyi kullanılamaz yapardı — kod bir daha
   * hiçbir yerden okunamaz değil ama öğretmeni listeye geri gönderirdi.
   */
  async function kodYenile() {
    if (!yenilenecek || !yeniKodlar?.id) return;
    setYenileniyor(true);
    try {
      const y = await rpc<KodYenileme>('kod_yenile', {
        p_token: oturum?.token,
        p_id: yeniKodlar.id,
        p_rol: yenilenecek.rol,
      });
      setYeniKodlar((o) => (o ? { ...o, kodlar: { ...o.kodlar, [y.rol]: y.kod } } : o));
      bildir(
        y.rol === 'veli'
          ? 'Veli kodu yenilendi. Eski kod artık çalışmıyor; yeni fişi veliye ulaştırın.'
          : 'Öğrenci kodu yenilendi. Eski kod artık çalışmıyor; yeni fişi öğrenciye verin.',
        'basari',
      );
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kod yenilenemedi.', 'hata');
    } finally {
      setYenileniyor(false);
      setYenilenecek(null);
    }
  }

  async function pasiflestir() {
    if (!silinecek) return;
    try {
      await rpc('ogrenci_pasiflestir', { p_token: oturum?.token, p_id: silinecek.id });
      bildir(`${silinecek.ad} listeden çıkarıldı`);
      setSilinecek(null);
      liste.yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    }
  }

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


      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
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
        <select
          value={sinifId}
          onChange={(e) => {
            setSinifId(e.target.value);
            setSayfa(1);
          }}
          aria-label="Sınıfa göre filtrele"
          className="min-h-[44px] rounded-sk-sm border border-line bg-surface px-3 text-[15px] text-ink sm:w-44"
        >
          <option value="">Tüm sınıflar</option>
          {siniflar.veri?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ad}
            </option>
          ))}
        </select>
      </div>

      {/* Bir sınıf seçildiğinde karneye geçiş. Öğretmen bu sekmede de
          "sınıfa tıklayınca öğrenci listesi ve ödev karnesi" istedi;
          Sınıflar sekmesindeki AYNI ekrana gidiyor, ikinci bir kopya
          yazılmadı. */}
      {sinifId && (
        <div className="mb-4">
          <Button tur="sade" onClick={() => git(`/ogretmen/siniflar/${sinifId}`)}>
            {`${siniflar.veri?.find((s) => s.id === sinifId)?.ad ?? 'Sınıf'} karnesi — kim ne yaptı`}
          </Button>
        </div>
      )}

      <AsyncBoundary
        durum={liste.durum}
        bosBaslik={arama || sinifId ? 'Eşleşen öğrenci yok' : 'Henüz öğrenci yok'}
        bosAciklama={
          arama || sinifId
            ? 'Aramayı veya sınıf filtresini değiştirmeyi deneyin.'
            : 'İlk öğrencinizi ekleyin; kodları hemen göstereceğim.'
        }
        {...(arama || sinifId
          ? {}
          : { bosEylem: <Button onClick={() => setEkleAcik(true)}>Öğrenci ekle</Button> })}
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
                      {/* Ad artık detaya götürüyor: özel ders öğrencisinde
                          ders ve ödeme takibi orada. Ödev kartı başlığının
                          düzenlemeye gitmesiyle aynı desen. */}
                      {/* 0042: okul numarası — yoksa hiç çizilmiyor. */}
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
                        {/* Özel ders öğrencisinde sınıf adı zaten "Özel ders"
                            (0012'den beri gerçek bir sınıf) — ikisini birden
                            çizmek aynı etiketi iki kez göstermekti. */}
                        {o.tur === 'ozel' ? (
                          <Tag tur="uyari">Özel ders</Tag>
                        ) : (
                          o.sinif && <Tag>{o.sinif}</Tag>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button tur="sade" olcu="sm" onClick={() => kodlariGoster(o)}>
                        Kodlar
                      </Button>
                      <Button tur="sade" olcu="sm" onClick={() => setSilinecek(o)}>
                        Çıkar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Pagination
              sayfa={liste.veri.sayfa}
              toplamSayfa={liste.veri.toplam_sayfa}
              onDegis={setSayfa}
              etiket="Öğrenci listesi"
            />
          </>
        )}
      </AsyncBoundary>

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

      {/* --- Kod gösterme --- */}
      <Dialog
        acik={yeniKodlar !== null}
        onKapat={() => setYeniKodlar(null)}
        baslik={yeniKodlar ? `${yeniKodlar.ad} — giriş kodları` : ''}
        aciklama="Kodun üzerine dokunarak kopyalayabilirsiniz. Kodlar bir şifredir; güvenli kanaldan paylaşın."
      >
        <div className="flex flex-col gap-3">
          {yeniKodlar?.kodlar.ogrenci && (
            <div className="flex items-center gap-2">
              <KodKutusu etiket="Öğrenci kodu" kod={yeniKodlar.kodlar.ogrenci} />
              {yeniKodlar.id && (
                <Button
                  tur="sade"
                  olcu="sm"
                  onClick={() => setYenilenecek({ rol: 'ogrenci' })}
                >
                  Yenile
                </Button>
              )}
            </div>
          )}
          {yeniKodlar?.kodlar.veli && (
            <div className="flex items-center gap-2">
              <KodKutusu etiket="Veli kodu" kod={yeniKodlar.kodlar.veli} />
              {yeniKodlar.id && (
                <Button tur="sade" olcu="sm" onClick={() => setYenilenecek({ rol: 'veli' })}>
                  Yenile
                </Button>
              )}
            </div>
          )}
          {yeniKodlar?.id && (
            /* Yenilemenin ne anlama geldiği, düğmeye basmadan ÖNCE
               burada yazıyor. Onay metni de aynısını söylüyor ama
               öğretmen düğmeyi görür görmez ne olacağını bilmeli. */
            <p className="text-[12px] text-muted">
              Kod sızdıysa <strong>Yenile</strong> deyin: eski kod anında geçersiz olur ve o
              kişinin açık oturumu kapanır. Yeni kodu içeren fişi kendisine ulaştırmanız gerekir.
            </p>
          )}
        </div>
      </Dialog>

      {/* --- Kod yenileme onayı (0045) --- */}
      <Dialog
        acik={yenilenecek !== null}
        onKapat={() => setYenilenecek(null)}
        baslik={yenilenecek?.rol === 'veli' ? 'Veli kodu yenilensin mi?' : 'Öğrenci kodu yenilensin mi?'}
        aciklama={
          yenilenecek
            ? `${yeniKodlar?.ad ?? ''} için yeni bir ${
                yenilenecek.rol === 'veli' ? 'veli' : 'öğrenci'
              } kodu üretilecek. Eski kod artık çalışmayacak ve açık oturum kapanacak. Bu işlem geri alınamaz; yeni fişi ${
                yenilenecek.rol === 'veli' ? 'veliye' : 'öğrenciye'
              } vermeniz gerekir.`
            : ''
        }
        onayEtiketi={yenileniyor ? 'Yenileniyor…' : 'Evet, yenile'}
        onayTuru="tehlike"
        onOnay={kodYenile}
      />

      {/* --- Pasifleştirme onayı --- */}
      <Dialog
        acik={silinecek !== null}
        onKapat={() => setSilinecek(null)}
        baslik="Öğrenci listeden çıkarılsın mı?"
        aciklama={
          silinecek
            ? `${silinecek.ad} listeden çıkarılacak ve giriş kodları iptal edilecek. Geçmiş ödevleri ve notları silinmez, kayıtlarda kalır.`
            : ''
        }
        onayEtiketi="Evet, çıkar"
        onayTuru="tehlike"
        onOnay={pasiflestir}
      />
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
