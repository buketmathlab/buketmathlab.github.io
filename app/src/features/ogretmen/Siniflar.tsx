import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { Sinif } from '@/types/api';

/**
 * Sınıf yönetimi.
 *
 * Sınıflar SİLİNMEZ, arşivlenir: geçmiş ödev kayıtları sınıfa bağlı, silmek
 * tarihi bozar. Arşivli sınıf yeni ödev/öğrenci seçimlerinde çıkmaz ama
 * eski kayıtlar okunabilir kalır.
 */
export function Siniflar() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();
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
  const { veri, durum, hata, yenile } = useVeri<Sinif[]>(
    'siniflar_listesi',
    { p_token: oturum?.token, p_arsiv: true },
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

  async function arsivle(s: Sinif) {
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
        aciklama="Sınıf silinmez, arşivlenir — geçmiş ödev kayıtları korunur."
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {gorunen.map((s) => (
            <Card key={s.id} vurgu={s.arsiv ? 'uyari' : 'yok'}>
              <div className="flex items-center justify-between gap-2">
                {/* Sınıfa tıklayınca öğrenci listesi ve ödev karnesi
                    açılıyor — öğretmenin açık isteği. */}
                <button
                  type="button"
                  onClick={() => git(`/ogretmen/siniflar/${s.id}`)}
                  className="min-h-[44px] text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="block font-display text-[20px] font-semibold text-ink">
                    {s.ad}
                  </span>
                  <span className="block text-[13px] text-muted">
                    <span className="sk-sayi">{s.ogrenci_sayisi}</span> öğrenci
                  </span>
                </button>
                <div className="flex flex-col items-end gap-2">
                  {s.arsiv && <Tag tur="uyari">Arşivde</Tag>}
                  {/* Özel ders grubu arşivlenemez: arşivlenirse ödev verme
                      ekranındaki sınıf listesinden düşer ve özel ders
                      öğrencilerine ödev verilemez. Kural sunucuda da var
                      (0014); düğmeyi gizlemek tek başına yeterli değil. */}
                  {s.ozel && !s.arsiv ? (
                    <p className="max-w-[150px] text-right text-[12px] text-muted">
                      Bu grup arşivlenemez — arşivlenirse özel ders
                      öğrencilerinize ödev veremezsiniz.
                    </p>
                  ) : (
                    <Button tur="sade" olcu="sm" onClick={() => arsivle(s)}>
                      {s.arsiv ? 'Geri al' : 'Arşivle'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
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
