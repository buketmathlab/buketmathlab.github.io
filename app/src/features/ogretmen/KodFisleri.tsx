import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Sekiz8Mark } from '@/components/brand/Sekiz8Mark';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import {
  fisMetni,
  fisleriUret,
  sayfalaraBol,
  IMZA,
  type Fis,
  type FisTuru,
} from '@/lib/kod-fisi';
import type { Kodlar as KodlarTipi, OgrenciListesi } from '@/types/api';

type Kayit = { ad: string; sinif: string; kodlar: KodlarTipi };

/**
 * Sınıfın kod fişleri — kesilip dağıtılmak üzere yazdırılır.
 *
 * NEDEN AYRI EKRAN: `Kodlar` sekmesi bilerek AYNI ANDA TEK ÖĞRENCİ
 * gösteriyor (0018). Yazdırma ise doğası gereği sınıfın tamamını ister.
 * İkisini tek ekranda birleştirmek, 0018'in kararını sessizce geri almak
 * olurdu; bu ekran ayrı, adı üstünde ve ONAY KAPISI arkasında.
 *
 * SUNUCUDAKİ SINIR AYNEN DURUYOR. 0017'nin bir sınıfın tüm kodlarını tek
 * yanıtta döndüren ucu 0018'de kaldırılmıştı ve GERİ GETİRİLMİYOR: burada
 * `ogrenci_kodlari` öğrenci öğrenci çağrılıyor. Yeni bir uç açmadık, yani
 * öğretmenin panelde çalıştıracağı bir şey de yok.
 *
 * DÜRÜST SINIR: yazdırma için kodların tarayıcıya inmesi kaçınılmaz. Bunu
 * gizlemiyoruz — onay diyaloğu ne olacağını açıkça söylüyor, kodlar hiçbir
 * yere KAYDEDİLMİYOR ve ekran kapanınca bellekte kalmıyorlar.
 *
 * ÖĞRENCİ VE VELİ FİŞLERİ AYRI SAYFA. Gerekçe `lib/kod-fisi.ts`'te
 * ölçümleriyle yazılı: tek fişte iki kod, çocuğun eline velinin kanalını
 * (ve özel derste ödeme bilgisini) vermek olurdu.
 */
export function KodFisleri() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [onayAcik, setOnayAcik] = useState(true);
  const [kayitlar, setKayitlar] = useState<Kayit[] | null>(null);
  const [ilerleme, setIlerleme] = useState<{ biten: number; toplam: number } | null>(null);
  const [tur, setTur] = useState<FisTuru>('ogrenci');

  const { veri, durum, hata, yenile } = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    { p_token: oturum?.token, p_arama: null, p_sinif_id: id, p_sayfa: 1, p_boyut: 100 },
    (v) => v.kayitlar.length === 0,
  );

  // KODLAR HİÇBİR YERE YAZILMIYOR — bileşen state'inde duruyorlar, o kadar.
  // `localStorage`/`sessionStorage`'a "geri gelince yeniden çekmeyelim" diye
  // koymak kolay bir iyileştirme gibi görünür ama kodları cihazda kalıcı
  // bırakırdı; denetimin 6. grubu tam olarak bunu arıyor.
  //
  // Ekrandan çıkınca temizleyen bir `useEffect` yazmıştım; geri alma kanıtı
  // onu bozduğunda hiçbir ölçüm kırılmadı — çünkü React zaten unmount'ta
  // state'i atıyor. Bir şey yapmayan kodu süs olarak bırakmıyorum.

  const sinifAdi = veri?.kayitlar[0]?.sinif ?? 'Sınıf';

  /**
   * ONAYDAN SONRA kodları getirir — öğrenci öğrenci.
   *
   * Sıralı (paralel değil) bilerek: 30 isteği aynı anda açmak hem sunucuya
   * gereksiz yükleniyor hem de ilerleme göstergesini anlamsız kılıyordu.
   */
  async function kodlariGetir() {
    if (!veri) return;
    const liste = veri.kayitlar;
    setIlerleme({ biten: 0, toplam: liste.length });
    const toplanan: Kayit[] = [];
    try {
      for (const o of liste) {
        const k = await rpc<KodlarTipi>('ogrenci_kodlari', {
          p_token: oturum?.token,
          p_id: o.id,
        });
        toplanan.push({ ad: o.ad, sinif: o.sinif ?? sinifAdi, kodlar: k });
        setIlerleme({ biten: toplanan.length, toplam: liste.length });
      }
      setKayitlar(toplanan);
    } catch (e) {
      // YARIM LİSTE KAYDEDİLMİYOR: eksik bir fiş sayfası, öğretmenin
      // "hepsini dağıttım" sanmasına yol açardı.
      setKayitlar(null);
      bildir(e instanceof Error ? e.message : 'Kodlar alınamadı.', 'hata');
    } finally {
      setIlerleme(null);
    }
  }

  const fisler = kayitlar ? fisleriUret(kayitlar, tur) : [];
  const sayfalar = sayfalaraBol(fisler);
  const kodsuz = kayitlar ? kayitlar.length - fisler.length : 0;

  return (
    <>
      {/* Yazdırmada kabuk, düğmeler ve uyarılar YOK: kâğıda yalnız fişler. */}
      <div className="print:hidden">
        <div className="mb-4">
          <Button tur="sade" olcu="sm" onClick={() => git(`/ogretmen/kodlar/${id}`)}>
            ← Sınıf kodları
          </Button>
        </div>

        <AsyncBoundary
          durum={durum}
          bosBaslik="Bu sınıfta öğrenci yok"
          bosAciklama="Öğrenciler bölümünden bu sınıfa öğrenci ekleyebilirsiniz."
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          {veri && (
            <>
              <h1 className="mb-1 font-display text-[24px] font-semibold text-ink">
                {sinifAdi} — kod fişleri
              </h1>
              <p className="mb-5 text-[14px] text-muted">
                Kesilip dağıtılmak üzere. Öğrenci ve veli fişleri{' '}
                <strong>ayrı sayfalarda</strong>.
              </p>

              {!kayitlar && !ilerleme && (
                <Card>
                  <p className="text-[15px] text-ink">Kodlar henüz getirilmedi.</p>
                  <p className="mt-1 mb-3 text-[14px] text-muted">
                    Bu sayfa sınıfın <strong>bütün</strong> kodlarını getirir.
                  </p>
                  <Button onClick={() => setOnayAcik(true)}>Kodları getir</Button>
                </Card>
              )}

              {ilerleme && (
                <Card>
                  <p className="text-[15px] text-ink">
                    Kodlar getiriliyor…{' '}
                    <span className="sk-sayi">{ilerleme.biten}</span>/
                    <span className="sk-sayi">{ilerleme.toplam}</span>
                  </p>
                </Card>
              )}

              {kayitlar && (
                <>
                  {/* İKİ SAYFA, AYNI ANDA TEK TANESİ ÇİZİLİ. Sekme değiştirmek
                      diğerini DOM'dan da çıkarıyor: yazdırılan sayfada karşı
                      tarafın kodu bulunmasın. */}
                  <div
                    className="mb-4 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Fiş türü"
                  >
                    {(['ogrenci', 'veli'] as const).map((t) => (
                      <Button
                        key={t}
                        tur={tur === t ? 'birincil' : 'sade'}
                        onClick={() => setTur(t)}
                        aria-pressed={tur === t}
                      >
                        {t === 'ogrenci' ? 'Öğrenci fişleri' : 'Veli fişleri'}
                      </Button>
                    ))}
                  </div>

                  <Card className="mb-4">
                    <p className="text-[15px] text-ink">
                      <span className="sk-sayi">{fisler.length}</span> fiş ·{' '}
                      <span className="sk-sayi">{sayfalar.length}</span> sayfa
                      {kodsuz > 0 && (
                        <>
                          {' · '}
                          <span className="text-warning">
                            <span className="sk-sayi">{kodsuz}</span> öğrencinin bu türde
                            kodu yok
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 mb-3 text-[14px] text-muted">
                      {tur === 'ogrenci'
                        ? 'Bu sayfada yalnız öğrenci kodları var; veli kodu yok.'
                        : 'Bu sayfada yalnız veli kodları var. Veli fişini çocuğa değil, veliye verin.'}
                    </p>
                    <Button onClick={() => window.print()}>Yazdır</Button>
                  </Card>

                  <p className="mb-3 text-[13px] text-muted">Önizleme:</p>
                </>
              )}
            </>
          )}
        </AsyncBoundary>
      </div>

      {kayitlar && <FisSayfalari sayfalar={sayfalar} />}

      {/* Diyalog LİSTE GELMEDEN açılmıyor: erken onaylanırsa getirecek bir
          şey olmaz ve öğretmen boşa dokunmuş olurdu. */}
      <Dialog
        acik={onayAcik && !kayitlar && veri !== null}
        onKapat={() => {
          setOnayAcik(false);
          git(`/ogretmen/kodlar/${id}`);
        }}
        baslik="Sınıfın bütün kodları getirilecek"
        aciklama="Yazdırmak için kodların tamamı bu cihaza inecek. Ekranı öğrencilere dönük bırakmayın; yazdırdıktan sonra sayfadan çıkın."
        onayEtiketi="Getir ve hazırla"
        onOnay={() => {
          setOnayAcik(false);
          void kodlariGetir();
        }}
      />
    </>
  );
}

/**
 * Yazdırılan kısım.
 *
 * ÖLÇÜ KÂĞIDA GÖRE: A4 210×297 mm, 2 sütun × 5 satır = sayfa başına 10 fiş,
 * her biri ~99×54 mm (kartvizitten biraz büyük — makasla kesmesi kolay).
 * Ölçüler `mm` cinsinden yazılı; `px` yazsaydık yazıcı ölçeğine göre kayardı.
 *
 * RENK YOK, ÇİZGİ VAR: okulda ve evde siyah-beyaz yazıcı normal. Kesme
 * çizgisi kesikli kenarlık olarak duruyor.
 */
function FisSayfalari({ sayfalar }: { sayfalar: Fis[][] }) {
  return (
    <div className="sk-fisler">
      {sayfalar.map((sayfa, i) => (
        <div key={i} className="sk-fis-sayfa" data-sayfa={i + 1}>
          {sayfa.map((f, j) => (
            <FisKarti key={f.kod + String(j)} fis={f} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FisKarti({ fis }: { fis: Fis }) {
  const m = fisMetni(fis.tur);
  return (
    <div className="sk-fis" data-fis={fis.tur}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <Sekiz8Mark boyut={14} />
          {IMZA}
        </span>
        <span className="text-[10px] text-muted">{m.baslik}</span>
      </div>

      <p className="mt-1 text-[13px] font-semibold text-ink">
        {fis.ad} <span className="font-normal text-muted">· {fis.sinif}</span>
      </p>

      <p className="mt-1 text-[10px] text-muted">{m.kodEtiketi}</p>
      {/* Kod BOŞLUKSUZ ve büyük: elle yazılacak, okunması kolay olmalı. */}
      <p className="sk-sayi text-[20px] font-bold tracking-[0.12em] text-ink">{fis.kod}</p>

      <p className="mt-1 text-[10px] leading-tight text-muted">
        {m.satirlar[0]}
        <br />
        {m.satirlar[1]}
      </p>
    </div>
  );
}
