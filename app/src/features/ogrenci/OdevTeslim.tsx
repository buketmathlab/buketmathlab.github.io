import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Field, Input } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { SikSatiri, SIKLAR } from '@/components/ui/SikSatiri';
import { KonuListesi } from '@/components/ui/KonuListesi';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { puanMesaji } from '@/lib/ewalu-puan';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { dosyaAdresi, dosyaYukle } from '@/services/dosya';
import { gorseliSikistir } from '@/lib/gorsel-sikistir';
import { sureDurumu } from '@/lib/son-tarih';
import type { OgrenciOdev, OgrenciOdevleri } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Çözüm fotoğrafının yolu HESAPLANIR, uydurulmaz.
 *
 * Sunucu (`_cozum_yolu_gecerli`, migration 0009) tam olarak bu kalıbı
 * bekliyor: yol öğrencinin ve ödevin kimliğini taşıdığı için başkasının
 * yoluna yükleme yapılamıyor. Rastgele bir yol üretirsek sunucu haklı
 * olarak reddeder.
 */
function cozumYolu(odevId: string, ogrenciId: string): string {
  return `cozum/${odevId}/${ogrenciId}.jpg`;
}

/**
 * Öğrencinin ödev ekranı: soruları aç, cevapla, gönder, puanını gör.
 *
 * VERİ AYRI BİR RPC'DEN GELMİYOR. `ogrenci_odevleri` zaten öğrencinin tüm
 * ödevlerini veriyor; buradan kimliğe göre seçiyoruz. Tek ödev için ayrı bir
 * RPC yazmak öğretmenden bir SQL turu daha isterdi ve karşılığı yok — bir
 * sınıfın yayındaki ödevleri küçük bir liste.
 *
 * CEVAP ANAHTARI TESLİMDEN ÖNCE TARAYICIYA HİÇ GELMİYOR. Sunucu teslim yoksa
 * alanı `null` döndürüyor (Kural 6, Part XXI); burada gizlenen bir şey yok,
 * gönderimden sonra veri yeniden çekiliyor ve anahtar o zaman geliyor.
 */
export function OdevTeslim() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [cevaplar, setCevaplar] = useState<Record<number, string>>({});
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoHatasi, setFotoHatasi] = useState<string | null>(null);
  const [gonderiyor, setGonderiyor] = useState(false);

  const { veri, durum, hata, yenile } = useVeri<OgrenciOdevleri>('ogrenci_odevleri', {
    p_token: oturum?.token,
  });

  const odev: OgrenciOdev | undefined = veri?.odevler.find((o) => o.id === id);

  async function pdfAc(yol: string) {
    try {
      window.open(await dosyaAdresi(yol), '_blank', 'noopener');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Dosya açılamadı.', 'hata');
    }
  }

  async function fotoSecildi(dosya: File) {
    setFotoHatasi(null);
    try {
      // Sıkıştırma seçim anında yapılıyor: öğrenci "Gönder"e bastığında
      // bekleyeceği süre kısalsın ve dosyanın gerçekten okunabildiği
      // gönderimden önce anlaşılsın.
      setFoto(await gorseliSikistir(dosya));
    } catch (e) {
      setFoto(null);
      setFotoHatasi(e instanceof Error ? e.message : 'Fotoğraf işlenemedi.');
    }
  }

  async function gonder() {
    if (!odev || !oturum?.ogrenci) return;
    if (!foto) return setFotoHatasi('Çözüm fotoğrafı olmadan ödev gönderilemez.');

    setGonderiyor(true);
    try {
      const yol = cozumYolu(odev.id, oturum.ogrenci.id);
      bildir('Fotoğraf yükleniyor…');
      await dosyaYukle(foto, yol);

      await rpc('odev_gonder', {
        p_token: oturum.token,
        p_odev: odev.id,
        p_foto_yolu: yol,
        p_cevaplar: odev.tur === 'test' ? cevaplar : null,
      });

      // Puanı ve cevap anahtarını sunucudan yeniden okuyoruz. Ekranda kendi
      // hesabımızı göstermiyoruz: puanı hesaplayan yer sunucu, gösterilen
      // sayı da oradan gelmeli.
      yenile();
      bildir('Ödevin gönderildi', 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Gönderilemedi.', 'hata');
    } finally {
      setGonderiyor(false);
    }
  }

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik="Ödev bulunamadı"
      bosAciklama="Bu ödev kaldırılmış olabilir."
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      {!odev ? (
        <Card>
          <p className="mb-3 text-[15px] text-ink">Bu ödevi bulamadım.</p>
          <p className="mb-4 text-[14px] text-muted">
            Ödev kaldırılmış ya da artık senin sınıfına ait olmayabilir.
          </p>
          <Button tur="sade" onClick={() => git('/ogrenci')}>
            Ödevlerime dön
          </Button>
        </Card>
      ) : (
        <OdevIcerigi
          odev={odev}
          cevaplar={cevaplar}
          foto={foto}
          fotoHatasi={fotoHatasi}
          gonderiyor={gonderiyor}
          onCevap={(no, sik) =>
            setCevaplar((c) => {
              const y = { ...c };
              if (sik === null) delete y[no];
              else y[no] = sik;
              return y;
            })
          }
          onFoto={fotoSecildi}
          onGonder={gonder}
          onPdf={pdfAc}
          onGeri={() => git('/ogrenci')}
        />
      )}
    </AsyncBoundary>
  );
}

type IcerikProps = {
  odev: OgrenciOdev;
  cevaplar: Record<number, string>;
  foto: File | null;
  fotoHatasi: string | null;
  gonderiyor: boolean;
  onCevap: (no: number, sik: string | null) => void;
  onFoto: (d: File) => void;
  onGonder: () => void;
  onPdf: (yol: string) => void;
  onGeri: () => void;
};

function OdevIcerigi({
  odev,
  cevaplar,
  foto,
  fotoHatasi,
  gonderiyor,
  onCevap,
  onFoto,
  onGonder,
  onPdf,
  onGeri,
}: IcerikProps) {
  const sure = sureDurumu(odev.son_tarih);
  const gonderildi = odev.gonderim !== null;
  // İki AYRI kapanma sebebi. Aynı kutuya sıkıştırmıyoruz: "süren doldu" ile
  // "sınıfın kapandı" öğrenci için bambaşka iki şey, ilki onun elindeydi.
  const sinifKapali = odev.sinif_arsiv;
  const kapali = sinifKapali || (sure.gecti && !odev.gec_teslim);
  const testMi = odev.tur === 'test';
  const soruSayisi = odev.soru_sayisi ?? 0;
  // Şık sayısı ödevde saklı (migration 0010). Tahmin etmiyoruz: A–D'lik bir
  // testte olmayan bir E düğmesi göstermek öğrenciyi yanıltır.
  const siklar = odev.sik_sayisi === 4 ? SIKLAR.D : SIKLAR.E;
  const bosSayisi = testMi
    ? Array.from({ length: soruSayisi }, (_, i) => i + 1).filter((n) => !cevaplar[n]).length
    : 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={onGeri}>
          ← Ödevlerim
        </Button>
      </div>

      <Card className="mb-4">
        <h1 className="font-display text-[22px] font-semibold text-ink">{odev.baslik}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {testMi ? 'Test' : 'Açık uçlu'}
          {odev.soru_sayisi !== null && ` · ${odev.soru_sayisi} soru`}
          {' · Son tarih '}
          {TARIH.format(new Date(odev.son_tarih))}
        </p>
        {odev.aciklama && <p className="mt-3 text-[15px] text-ink">{odev.aciklama}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {gonderildi ? (
            <>
              <Tag tur="basari">Gönderildi</Tag>
              {odev.gonderim!.gecikmeli && <Tag tur="uyari">Gecikmeli teslim</Tag>}
            </>
          ) : (
            <Tag tur={sure.gecti ? 'notr' : sure.acil ? 'uyari' : 'notr'}>{sure.metin}</Tag>
          )}
          {!gonderildi && sinifKapali && <Tag tur="notr">Sınıf kapandı</Tag>}
          {!gonderildi && !sinifKapali && !odev.gec_teslim && (
            <Tag tur="uyari">Geç teslim kabul edilmiyor</Tag>
          )}
        </div>

        {odev.odev_yolu && (
          <div className="mt-4">
            <Button onClick={() => onPdf(odev.odev_yolu as string)}>Soruları aç (PDF)</Button>
          </div>
        )}
      </Card>

      {gonderildi ? (
        <Sonuc odev={odev} onPdf={onPdf} />
      ) : sinifKapali ? (
        <Card vurgu="uyari">
          <p className="mb-2 font-semibold text-ink">Bu sınıf kapatılmış.</p>
          <p className="text-[14px] text-muted">
            Öğretmenin sınıfı arşivlemiş, bu yüzden şu an ödev gönderemiyorsun. Sorulara ve
            eski puanlarına bakmayı sürdürebilirsin; öğretmenin sınıfı geri açarsa
            gönderebilirsin.
          </p>
        </Card>
      ) : kapali ? (
        <Card vurgu="uyari">
          <p className="mb-2 font-semibold text-ink">Bu ödevin süresi doldu.</p>
          <p className="text-[14px] text-muted">
            Öğretmenin bu ödevde geç teslime izin vermemiş, bu yüzden gönderemiyorsun.
            Sorularla çalışmaya devam edebilir, takıldığın yeri öğretmenine sorabilirsin.
          </p>
        </Card>
      ) : (
        <Card>
          {sure.gecti && (
            <p className="mb-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
              Süresi geçti ama öğretmenin geç teslime izin veriyor. Yine de gönderebilirsin.
            </p>
          )}

          {testMi && soruSayisi > 0 && (
            <div className="mb-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tag tur={bosSayisi === 0 ? 'basari' : 'bilgi'}>
                  <span className="sk-sayi">{`${soruSayisi - bosSayisi}/${soruSayisi} soru işaretlendi`}</span>
                </Tag>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: soruSayisi }, (_, i) => i + 1).map((no) => (
                  <SikSatiri
                    key={no}
                    no={no}
                    siklar={siklar}
                    secili={cevaplar[no]}
                    onDegis={onCevap}
                  />
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-muted">
                Boş bıraktığın sorular yanlış sayılmaz, boş sayılır.
              </p>
            </div>
          )}

          <Field
            etiket="Çözüm fotoğrafı"
            ipucu="Zorunlu. Çözüm kâğıdının fotoğrafını çek; okunaklı olsun yeter."
            zorunlu
            {...(fotoHatasi ? { hata: fotoHatasi } : {})}
          >
            {(k) => (
              <Input
                {...k}
                type="file"
                // `capture` BİLİNÇLİ OLARAK YOK: iOS'ta bu öznitelik doğrudan
                // kamerayı açar ve galeriyi seçenek olmaktan çıkarır. Öğrenci
                // çözümünü çoktan fotoğraflamış olabilir; onu yeniden çekmeye
                // zorlamak gereksiz bir engel.
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFoto(f);
                }}
              />
            )}
          </Field>
          {foto && (
            <p className="mb-4 text-[13px] text-success">
              Fotoğraf hazır{' '}
              <span className="sk-sayi">({Math.round(foto.size / 1024)} KB)</span>
            </p>
          )}

          <p className="mb-4 rounded-sk-sm bg-line-soft p-3 text-[13px] text-muted">
            Gönderdikten sonra <strong>değiştiremezsin</strong>. Cevaplarını bir kez daha
            gözden geçir.
          </p>

          <Button
            onClick={onGonder}
            tamGenislik
            yukleniyor={gonderiyor}
            yuklenmeMetni="Gönderiliyor"
          >
            Ödevi gönder
          </Button>
        </Card>
      )}
    </>
  );
}

/** Teslimden sonraki görünüm: puan ve cevap anahtarı karşılaştırması. */
/**
 * Ewalu'nun puana göre söylediği.
 *
 * Poz da cümle de `lib/ewalu-puan.ts`'ten geliyor — metinler öğretmenin.
 * Figür `dekoratif`: cümle zaten yanında görünür metin olarak duruyor,
 * ekran okuyucunun ayrıca pozu tarif etmesi tekrar olurdu.
 */
function EwaluSozu({ puan }: { puan: number }) {
  const { poz, cumle } = puanMesaji(puan);
  return (
    <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
      <EwaluFigure poz={poz} boyut={52} dekoratif className="shrink-0" />
      <p className="text-[14px] leading-relaxed text-ink">{cumle}</p>
    </div>
  );
}

function Sonuc({ odev, onPdf }: { odev: OgrenciOdev; onPdf: (yol: string) => void }) {
  const g = odev.gonderim;
  if (!g) return null;

  const anahtar = odev.cevap_anahtari;
  const puan = g.ogretmen_puan ?? g.puan;

  return (
    <>
      {/* YEŞİL ŞERİT DE PUANA BAĞLI. Kutlama pozuyla aynı hata buradaydı:
          35 alan öğrencinin kartı da "başarı" yeşiliyle çerçeveleniyordu.
          85 ve üstü yeşil; altı NÖTR — kırmızı ya da sarı değil, çünkü
          cümlelerin özenle kaçındığı yargıyı renk geri getirirdi. Henüz
          puanlanmamış gönderim yeşil kalıyor: teslim etmek başlı başına
          olmuş bir iş. */}
      <Card vurgu={puan === null || puan >= 85 ? 'basari' : 'yok'} className="mb-4">
        {/* İKİ SES AYRI DURUYOR.
            Üstte SİSTEM: puan ve "ödevin alındı" — puan ne olursa olsun aynı
            cümle (öğretmenin kararı). Altta EWALU: puana göre değişen tek
            cümle. Sistem "ne oldu"yu söyler, Ewalu "şimdi ne yapmalı"yı;
            ikisini tek paragrafa karıştırmak hangisinin ne olduğunu
            belirsizleştirirdi. */}
        <div>
          <p className="font-display text-[20px] font-semibold text-ink">
            {puan !== null ? <span className="sk-sayi">{`${puan} puan`}</span> : 'Gönderildi'}
          </p>
          <p className="text-[14px] text-muted">
            {puan !== null
              ? 'Ödevin alındı ve puanlandı.'
              : 'Ödevin alındı. Öğretmenin değerlendirdikten sonra puanın görünecek.'}
          </p>
          {g.gecikmeli && (
            <p className="mt-1 text-[13px] font-semibold text-warning">
              Son tarihten sonra gönderildi — öğretmenin gecikmeli olarak görüyor.
            </p>
          )}
        </div>

        {/* Ewalu YALNIZ puan varsa konuşuyor. Açık uçlu ödev henüz
            puanlanmadıysa söyleyecek bir şeyi yok; olmayan bir puana cümle
            uydurmuyoruz. */}
        {puan !== null && <EwaluSozu puan={puan} />}

        {g.dogru !== null && (
          <p className="mt-3 text-[14px] text-ink">
            <span className="sk-sayi font-semibold">{g.dogru}</span> doğru ·{' '}
            <span className="sk-sayi font-semibold">{g.yanlis}</span> yanlış ·{' '}
            <span className="sk-sayi font-semibold">{g.bos}</span> boş
          </p>
        )}

        {g.ogretmen_yorum && (
          <p className="mt-3 rounded-sk-sm bg-line-soft p-3 text-[14px] text-ink">
            <strong>Öğretmenin notu:</strong> {g.ogretmen_yorum}
          </p>
        )}
      </Card>

      {/* ÇALIŞILACAK KONULAR — öğretmenin isteği: "hangi konuda eksiği olduğu,
          yani hangi konuya çalışması gerektiği bildirilmeli."

          Ewalu'nun cümlesinden SONRA ve AYRI kartta: Ewalu "şimdi ne yapmalı"
          der, bu liste "tam olarak nereye" der. Aynı kartın içinde olsaydı
          cümle listenin başlığı gibi okunurdu.

          Konusu girilmemiş ödevde liste hiç çıkmıyor — boş bir "konular"
          başlığı, eksik bir şey varmış izlenimi verirdi. */}
      {/* `?? []`: SQL'i öğretmen panelden elle çalıştırıyor, arayüz ondan
          önce yayına girebiliyor. 0020 uygulanmamışken alan hiç gelmez;
          okunmayan bir alan yüzünden ekranın tamamının beyaz kalması kabul
          edilemez — konu listesi çıkmaz, ödev ekranı çalışmaya devam eder. */}
      {(odev.konu_analizi ?? []).length > 0 && (
        <Card className="mb-4">
          <KonuListesi analiz={odev.konu_analizi ?? []} ses="ogrenci" />
        </Card>
      )}

      {/* Anahtar teslimden SONRA sunucudan geliyor; teslim etmemiş bir
          öğrencinin tarayıcısında bu veri hiç bulunmuyor.

          KARŞILAŞTIRMALI gösteriliyor: yalnız doğru cevapları listelemek
          "8 doğru 1 yanlış" bilgisini işe yaramaz kılıyordu — öğrenci hangi
          soruyu kaçırdığını göremiyordu. Öğrenmenin olduğu yer tam burası. */}
      {anahtar && Object.keys(anahtar).length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 font-display text-[18px] font-semibold text-ink">Cevaplar</h2>
          <p className="mb-3 text-[13px] text-muted">
            Senin cevabın solda, doğrusu sağda. Kaçırdığın sorular işaretli.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(anahtar)
              .map(([k, v]) => [Number(k), v] as const)
              .filter(([n]) => Number.isInteger(n))
              .sort((a, b) => a[0] - b[0])
              .map(([no, dogru]) => {
                const benim = g.cevaplar?.[String(no)] ?? null;
                // ÜÇ DURUM, ikisi değil. Boş bırakmak yanlış cevap vermekle
                // aynı şey değil: puanlama da ikisini ayırıyor (`_puanla`),
                // ekran da ayırmalı. Her boşluğu kırmızıya boyamak öğrenciye
                // yapmadığı bir hatayı yüklerdi.
                const durum = benim === null ? 'bos' : benim === dogru ? 'dogru' : 'yanlis';
                return (
                  <li
                    key={no}
                    className={
                      'flex items-center gap-2 rounded-sk-sm border px-2 py-1 text-[14px] ' +
                      (durum === 'dogru'
                        ? 'border-line'
                        : durum === 'yanlis'
                          ? 'border-danger bg-danger-bg'
                          : 'border-warning bg-warning-bg')
                    }
                  >
                    <span className="sk-sayi w-7 shrink-0 text-right font-bold text-muted">
                      {no}
                    </span>
                    <span
                      className={
                        durum === 'dogru'
                          ? 'font-semibold text-ink'
                          : durum === 'yanlis'
                            ? 'font-semibold text-danger'
                            : 'font-semibold text-warning'
                      }
                    >
                      {benim ?? 'boş'}
                    </span>
                    {durum === 'dogru' ? (
                      <span className="ml-auto text-success">doğru</span>
                    ) : (
                      <span className="ml-auto text-muted">
                        doğrusu <strong className="text-ink">{dogru}</strong>
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      )}

      {odev.anahtar_yolu && (
        <Button tur="sade" onClick={() => onPdf(odev.anahtar_yolu as string)}>
          Çözümlü anahtarı aç (PDF)
        </Button>
      )}
    </>
  );
}
