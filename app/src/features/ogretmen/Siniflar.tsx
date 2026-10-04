import { useState } from 'react';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { SinifKartlari } from '@/features/siniflar/SinifKartlari';
import type { SinifKarti } from '@/types/api';

/**
 * Sınıf yönetimi.
 *
 * Sınıflar SİLİNMEZ, arşivlenir: geçmiş ödev kayıtları sınıfa bağlı, silmek
 * tarihi bozar.
 *
 * ARŞİV ARTIK HER YERDE GEÇERLİ (migration 0016). Arşivdeki sınıf Pano
 * sayılarında, Pano listelerinde, Ödevler'de ve Öğrenciler'de görünmez ve o
 * sınıfa yeni gönderim kabul edilmez. Önceden yalnız BU ekranın süzgeciydi;
 * öğretmen "bir yerde arşivlediğimde başka yerde de görünmemeli" dedi.
 *
 * Veri silinmiyor: geri alındığı anda her şey aynen dönüyor, kurtarma yolu
 * da bu ekranda (aşağıdaki "Göster ve geri al").
 */
export function Siniflar() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [arsivGoster, setArsivGoster] = useState(false);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [seviye, setSeviye] = useState('9');
  const [sube, setSube] = useState('');
  const [kaydediyor, setKaydediyor] = useState(false);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);

  /**
   * Liste HER ZAMAN arşivdekilerle birlikte çekiliyor, süzme istemcide.
   *
   * Önce `p_arsiv` sunucuya gönderiliyordu ve arşivde sınıf olduğu ekranda
   * hiç belli olmuyordu. Öğretmen Özel ders grubunu arşivleyince onu
   * bulamadı, "Sınıf ekle"ye gitti ve orada da yoktu. Kaç sınıfın arşivde
   * olduğunu bilmek için verinin tamamı gerekiyor — tek istek, ek maliyet
   * yok (sınıf sayısı on üç).
   */
  const { veri, durum, hata, yenile } = useVeri<SinifKarti[]>(
    'sinif_kartlari',
    { p_token: oturum?.token },
    (v) => v.length === 0,
  );

  const arsivdekiler = veri?.filter((s) => s.arsiv) ?? [];
  const gorunen = (veri ?? []).filter((s) => arsivGoster || !s.arsiv);

  async function ekle() {
    const temiz = sube.trim().toLocaleUpperCase('tr-TR');
    if (!temiz) {
      setFormHatasi('Şube harfini yazın.');
      return;
    }
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      const s = await rpc<{ ad: string }>('sinif_ekle', {
        p_token: oturum?.token,
        p_seviye: Number(seviye),
        p_sube: temiz,
      });
      bildir(`${s.ad} sınıfı eklendi`, 'basari');
      setEkleAcik(false);
      setSube('');
      yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Sınıf eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function arsivle(s: SinifKarti) {
    try {
      await rpc('sinif_arsivle', {
        p_token: oturum?.token,
        p_id: s.id,
        p_arsiv: !s.arsiv,
      });
      bildir(s.arsiv ? `${s.ad} geri alındı` : `${s.ad} arşivlendi`);
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    }
  }

  return (
    <>
      <SayfaBasligi
        baslik="Sınıflar"
        aciklama="Arşivlenen sınıf hiçbir listede görünmez; hiçbir şey silinmez, geri alabilirsiniz."
        eylem={<Button onClick={() => setEkleAcik(true)}>Sınıf ekle</Button>}
      />

      {/* ARŞİVDEKİLER GÖRÜNÜR OLMALI. Eskiden burada yalnız küçük bir onay
          kutusu vardı ve arşivde sınıf olup olmadığı hiç belli olmuyordu;
          kaybettiği sınıfı arayan öğretmen bunu kurtarma yolu olarak
          okuyamadı. Artık sayıyla birlikte söyleniyor. */}
      {arsivdekiler.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-sk-sm bg-line-soft p-3">
          <p className="text-[14px] text-ink">
            <span className="sk-sayi font-semibold">{arsivdekiler.length}</span> sınıf arşivde:{' '}
            <span className="text-muted">{arsivdekiler.map((s) => s.ad).join(', ')}</span>
          </p>
          <Button tur="sade" olcu="sm" onClick={() => setArsivGoster((a) => !a)}>
            {arsivGoster ? 'Gizle' : 'Göster ve geri al'}
          </Button>
        </div>
      )}

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz sınıf yok"
        bosAciklama="İlk sınıfınızı ekleyerek başlayın."
        bosEylem={<Button onClick={() => setEkleAcik(true)}>Sınıf ekle</Button>}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        <SinifKartlari
          kartlar={gorunen}
          baglanti={{
            sinif: (id) => `/ogretmen/siniflar/${id}`,
            analiz: (id) => `/ogretmen/siniflar/${id}/analiz`,
            onam: (id) => `/ogretmen/veliler/sinif/${id}/onam`,
          }}
          eylem={(s) =>
            /* Özel ders grubu arşivlenemez: arşivlenirse ödev verme
               ekranındaki sınıf listesinden düşer ve özel ders
               öğrencilerine ödev verilemez. Kural sunucuda da var
               (0014); düğmeyi gizlemek tek başına yeterli değil. */
            s.ozel && !s.arsiv ? (
              <p className="basis-full text-[12px] text-muted">
                Bu grup arşivlenemez — arşivlenirse özel ders öğrencilerinize ödev veremezsiniz.
              </p>
            ) : (
              <Button tur="sade" olcu="sm" onClick={() => void arsivle(s)}>
                {s.arsiv ? 'Geri al' : 'Arşivle'}
              </Button>
            )
          }
        />
      </AsyncBoundary>

      <Dialog
        acik={ekleAcik}
        onKapat={() => setEkleAcik(false)}
        baslik="Sınıf ekle"
        aciklama="Seviye ve şube seçin. Aynı sınıf zaten arşivdeyse geri alınır."
        onayEtiketi="Ekle"
        onOnay={ekle}
        onayYukleniyor={kaydediyor}
      >
        <div className="flex gap-3">
          <div className="flex-1">
            <Field etiket="Seviye">
              {(k) => (
                <Select {...k} value={seviye} onChange={(e) => setSeviye(e.target.value)}>
                  {[9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}. sınıf
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex-1">
            <Field etiket="Şube" zorunlu {...(formHatasi ? { hata: formHatasi } : {})}>
              {(k) => (
                <Input
                  {...k}
                  value={sube}
                  onChange={(e) => setSube(e.target.value)}
                  maxLength={2}
                  autoCapitalize="characters"
                  placeholder="A"
                />
              )}
            </Field>
          </div>
        </div>
      </Dialog>
    </>
  );
}
