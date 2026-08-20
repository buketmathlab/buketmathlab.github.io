import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Dialog } from '@/components/ui/Dialog';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { dosyaAdresi } from '@/services/dosya';
import type { OdevSatiri, Sinif } from '@/types/api';

const TARIH = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

function tarihYaz(iso: string): string {
  return TARIH.format(new Date(iso));
}

/** Son tarih geçti mi? Gün bazında karşılaştırılır, saat önemsiz. */
function gecti(sonTarih: string): boolean {
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  return new Date(sonTarih) < bugun;
}

/**
 * Ödev listesi.
 *
 * Taslak ve yayında ayrımı görsel olarak baskın: yayınlanmamış bir ödevi
 * yayınlanmış sanmak, sınıfın ödevden habersiz kalması demek.
 *
 * Silme onaylı: ödev silinince gönderimler de gider (ON DELETE CASCADE),
 * yani öğrencilerin emeği. Onay metni bunu açıkça söylüyor.
 */
export function Odevler() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();
  const [filtre, setFiltre] = useState<'hepsi' | 'taslak' | 'yayinda'>('hepsi');
  const [sinifId, setSinifId] = useState('');
  const [silinecek, setSilinecek] = useState<OdevSatiri | null>(null);
  const [islemde, setIslemde] = useState(false);

  const { veri, durum, hata, yenile } = useVeri<OdevSatiri[]>(
    'odevler_listesi',
    {
      p_token: oturum?.token,
      p_sinif_id: sinifId || null,
      p_yayinda: filtre === 'hepsi' ? null : filtre === 'yayinda',
    },
    (v) => v.length === 0,
  );

  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  async function yayinla(o: OdevSatiri) {
    setIslemde(true);
    try {
      await rpc('odev_yayinla', { p_token: oturum?.token, p_id: o.id });
      bildir(`${o.baslik} yayınlandı — ${o.sinif} sınıfı artık görebilir`, 'basari');
      yenile();
    } catch (e) {
      // Sunucu eksik anahtarı burada reddeder; mesajı olduğu gibi gösteriyoruz.
      bildir(e instanceof Error ? e.message : 'Yayınlanamadı.', 'hata');
    } finally {
      setIslemde(false);
    }
  }

  async function sil() {
    if (!silinecek) return;
    setIslemde(true);
    try {
      await rpc('odev_sil', { p_token: oturum?.token, p_id: silinecek.id });
      bildir(`${silinecek.baslik} silindi`);
      setSilinecek(null);
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Silinemedi.', 'hata');
    } finally {
      setIslemde(false);
    }
  }

  async function pdfAc(o: OdevSatiri, tur: 'odev' | 'anahtar') {
    try {
      // Yol istemcide tutulmuyor; imzalı adres her seferinde yeniden alınır.
      const { yol } = await rpc<{ yol: string | null }>('odev_dosya_yolu', {
        p_token: oturum?.token,
        p_id: o.id,
        p_tur: tur,
      });
      if (!yol) return bildir('Bu ödevde o dosya yok.', 'hata');
      window.open(await dosyaAdresi(yol), '_blank', 'noopener');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Dosya açılamadı.', 'hata');
    }
  }

  return (
    <>
      <SayfaBasligi
        baslik="Ödevler"
        aciklama="Ödev taslak olarak kaydedilir; yayınlayana kadar öğrenci göremez."
        eylem={<Button onClick={() => git('/ogretmen/odevler/yeni')}>Yeni ödev</Button>}
      />

      {/* Sınıf filtresi: öğretmenin isteği — Öğrenciler sekmesindekiyle
          aynı desen, aynı yerde. İki ekranda iki farklı filtre olması
          öğrenilmesi gereken ikinci bir alışkanlık yaratırdı. */}
      <div className="mb-3">
        <select
          value={sinifId}
          onChange={(e) => setSinifId(e.target.value)}
          aria-label="Sınıfa göre filtrele"
          className="min-h-[44px] w-full rounded-sk-sm border border-line bg-surface px-3 text-[15px] text-ink sm:w-56"
        >
          <option value="">Tüm sınıflar</option>
          {siniflar.veri?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ad}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-2" role="group" aria-label="Ödev filtresi">
        {(
          [
            ['hepsi', 'Hepsi'],
            ['taslak', 'Taslaklar'],
            ['yayinda', 'Yayında'],
          ] as const
        ).map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            onClick={() => setFiltre(deger)}
            aria-pressed={filtre === deger}
            className={
              'min-h-[44px] rounded-sk-sm border px-3 text-[14px] ' +
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-ink ' +
              (filtre === deger
                ? 'border-ink bg-ink font-semibold text-paper'
                : 'border-line bg-surface text-muted hover:border-ink-soft')
            }
          >
            {etiket}
          </button>
        ))}
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik={filtre === 'hepsi' ? 'Henüz ödev yok' : 'Bu filtrede ödev yok'}
        bosAciklama={
          filtre === 'hepsi'
            ? 'İlk ödevinizi oluşturun. Cevap anahtarını PDF’ten çıkarabilirsiniz.'
            : 'Başka bir filtre deneyin.'
        }
        bosEylem={
          filtre === 'hepsi' ? (
            <Button onClick={() => git('/ogretmen/odevler/yeni')}>Yeni ödev</Button>
          ) : undefined
        }
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {veri?.map((o) => (
            <Card key={o.id} vurgu={o.yayinda ? 'yok' : 'uyari'}>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* Öğretmen "ödevin üzerine tıklayıp" düzenlemek istedi. */}
                  {/* `min-h-[44px]`: başlık 28 px'ti ve kartın ana dokunma
                      hedefi bu. Erişilebilirlik denetimi Ödevler ekranını
                      kapsamadığı için ölçülmemişti; kapsama alınınca çıktı. */}
                  <button
                    type="button"
                    onClick={() => git(`/ogretmen/odevler/${o.id}`)}
                    className="flex min-h-[44px] items-center text-left font-display text-[18px] font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {o.baslik}
                  </button>
                  <p className="text-[13px] text-muted">
                    {o.sinif}
                    {/* KARDEŞ İŞARETİ (0030). Aynı gruptaki ödevler AYRI
                        satırlar olarak duruyor — her birinin kendi gönderim
                        sayısı ve kendi ortalaması var, katlamak onları
                        gizlerdi. Bu işaret yalnız "bu ödev yalnız bu sınıfa
                        özel değil" diyor. */}
                    {o.kardesler && o.kardesler.length > 0 && (
                      <span title={[o.sinif, ...o.kardesler].join(', ')}>
                        {' · +'}
                        <span className="sk-sayi">{o.kardesler.length}</span> sınıf
                      </span>
                    )}
                    {' · '}
                    {o.tur === 'test' ? 'Test' : 'Açık uçlu'}
                    {o.soru_sayisi !== null && (
                      <>
                        {' · '}
                        <span className="sk-sayi">{o.soru_sayisi}</span> soru
                      </>
                    )}
                  </p>
                </div>
                <Tag tur={o.yayinda ? 'basari' : 'uyari'}>{o.yayinda ? 'Yayında' : 'Taslak'}</Tag>
              </div>

              <p className="mb-3 text-[13px] text-muted">
                Son tarih: {tarihYaz(o.son_tarih)}
                {gecti(o.son_tarih) && <span className="text-danger"> · süresi doldu</span>}
                {/* Geç teslim yalnız KAPALIYKEN yazılıyor: açık olan
                    varsayılan durum, her karta not düşmek gürültü olurdu. */}
                {!o.gec_teslim && (
                  <span className="text-warning"> · geç teslim kapalı</span>
                )}
              </p>

              {/* Gönderim sayısı tıklanabilir: öğretmenin bir sonraki sorusu
                  "kim gönderdi, kim göndermedi" ve cevabı o ekranda. */}
              {o.yayinda && (
                <p className="mb-3 -mt-2">
                  <button
                    type="button"
                    onClick={() => git(`/ogretmen/odevler/${o.id}/gonderimler`)}
                    className="min-h-[44px] text-[13px] font-semibold text-link underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span className="sk-sayi">{o.gonderim_sayisi}</span>/
                    <span className="sk-sayi">{o.sinif_mevcudu}</span> gönderdi — kimler?
                  </button>
                </p>
              )}

              {/* Geç teslime izin vermek, gecikmeyi görmezden gelmek değil.
                  Öğretmenin isteği: geç gelen teslim listede mutlaka
                  görünsün. Sayı sunucuda hesaplanıyor. */}
              {o.gec_gonderim_sayisi > 0 && (
                <p className="mb-3 -mt-2">
                  <Tag tur="uyari">
                    <span className="sk-sayi">
                      {`${o.gec_gonderim_sayisi} gecikmeli teslim`}
                    </span>
                  </Tag>
                </p>
              )}

              {/* SINIF ORTALAMASI — yalnız süre dolduktan sonra.
                  İki sayı veriliyor çünkü ikisi farklı soruya cevap veriyor:
                  "çözenler ne yapmış" ve "sınıf nerede". Yarısı göndermemiş
                  bir sınıfta tek bir sayı yanıltıcı olurdu. Sunucu süre
                  dolmadan hiçbirini hesaplamıyor — eksik veriden ortalama
                  üretip onu "sınıfın durumu" diye göstermek yanlış olurdu. */}
              {o.ortalama_tum !== null && (
                <div className="mb-3 rounded-sk-sm bg-line-soft p-3">
                  <p className="text-[13px] font-bold text-muted">Ödev ortalaması</p>
                  <p className="mt-1 text-[14px] text-ink">
                    <span className="sk-sayi text-[18px] font-semibold">{o.ortalama_tum}</span>{' '}
                    <span className="text-muted">— sınıfın tamamı, göndermeyen 0</span>
                  </p>
                  {o.ortalama_yapan !== null && (
                    <p className="text-[13px] text-muted">
                      <span className="sk-sayi font-semibold">{o.ortalama_yapan}</span> — yalnız
                      gönderenler
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {o.odev_pdf_var && (
                  <Button tur="sade" olcu="sm" onClick={() => pdfAc(o, 'odev')}>
                    Soruları aç
                  </Button>
                )}
                {o.anahtar_pdf_var && (
                  <Button tur="sade" olcu="sm" onClick={() => pdfAc(o, 'anahtar')}>
                    Anahtarı aç
                  </Button>
                )}
                <Button tur="sade" olcu="sm" onClick={() => git(`/ogretmen/odevler/${o.id}`)}>
                  Düzenle
                </Button>
                {!o.yayinda && (
                  <Button olcu="sm" onClick={() => yayinla(o)} disabled={islemde}>
                    Yayınla
                  </Button>
                )}
                {/* Dolu kırmızı DEĞİL: listede her kartta bir tane olurdu ve
                    sayfa alarm panosuna dönerdi. Gerçek koruma onay
                    diyaloğunda — orada dolu kırmızı kullanılıyor. Buradaki
                    ayırt edici işaret kırmızı metin ve kenarlık. */}
                <Button
                  tur="sade"
                  olcu="sm"
                  onClick={() => setSilinecek(o)}
                  className="border-danger/40 text-danger hover:border-danger"
                >
                  Sil
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </AsyncBoundary>

      <Dialog
        acik={silinecek !== null}
        onKapat={() => setSilinecek(null)}
        baslik="Ödevi sil"
        aciklama={
          silinecek
            ? `“${silinecek.baslik}” silinecek. ${
                silinecek.gonderim_sayisi > 0
                  ? `Bu ödeve yapılmış ${silinecek.gonderim_sayisi} gönderim ve puan da silinir.`
                  : 'Henüz gönderim yok.'
              } Bu işlem geri alınamaz.`
            : ''
        }
        onayEtiketi="Sil"
        onayTuru="tehlike"
        onOnay={sil}
        onayYukleniyor={islemde}
      />
    </>
  );
}
