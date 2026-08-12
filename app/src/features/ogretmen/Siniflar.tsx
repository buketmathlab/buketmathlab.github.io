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

  const { veri, durum, hata, yenile } = useVeri<Sinif[]>(
    'siniflar_listesi',
    { p_token: oturum?.token, p_arsiv: arsivGoster },
    (v) => v.length === 0,
  );

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

      {/* Etiketin kendisi 44px yüksekliğinde: onay kutusu görsel olarak 20px
          ama dokunma hedefi tüm satır olmalı (Part XVII). Kutuyu büyütmek
          yerine tıklanabilir alanı büyütüyoruz — görsel denge bozulmuyor. */}
      <label className="mb-2 -ml-2 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sk-sm px-2 text-[14px] text-muted hover:bg-line-soft">
        <input
          type="checkbox"
          checked={arsivGoster}
          onChange={(e) => setArsivGoster(e.target.checked)}
          className="size-5"
        />
        Arşivdekileri de göster
      </label>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz sınıf yok"
        bosAciklama="İlk sınıfınızı ekleyerek başlayın."
        bosEylem={<Button onClick={() => setEkleAcik(true)}>Sınıf ekle</Button>}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {veri?.map((s) => (
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
                  <Button tur="sade" olcu="sm" onClick={() => arsivle(s)}>
                    {s.arsiv ? 'Geri al' : 'Arşivle'}
                  </Button>
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
