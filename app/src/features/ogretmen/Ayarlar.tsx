import { useState, type FormEvent } from 'react';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';

/**
 * Ayarlar — bugünlük tek işi PIN değiştirmek.
 *
 * NEDEN VAR: `pin_degistir` 0003'te yazıldı, 0005'te yetkisi verildi ve
 * arayüzde HİÇ ÇAĞRILMADI. Yani öğretmen PIN'ini değiştiremiyordu. Tek yol
 * Supabase panelinde `ogretmen_pin_hash`'i NULL'a çekmekti — ama hash boşken
 * `giris()` HERKESE kurulum ekranı gösteriyor, yani o aralıkta siteye giren
 * biri PIN'i belirleyebilirdi. PIN'i sızmış bir öğretmen için gerçek bir
 * çıkmazdı.
 *
 * YENİ SEKME AÇILMADI. Menü zaten altı sekme; yedincisi 360 px'de alt
 * çubuğa sığmıyor (ölçüldü). Buraya yan menünün altından ve Pano'dan
 * geliniyor. PIN değiştirmek nadir ve kasıtlı bir iş; yedek gibi her gün
 * görünmesi gerekmiyor.
 */
export function Ayarlar() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [eski, setEski] = useState('');
  const [yeni1, setYeni1] = useState('');
  const [yeni2, setYeni2] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [degisti, setDegisti] = useState(false);

  async function gonder(e: FormEvent) {
    e.preventDefault();

    // `trim()` — giriş ve kurulum ekranlarıyla AYNI davranış. Kurulum
    // trim'liyor, giriş trim'liyor; burası trim'lemezse başta/sonda boşluklu
    // bir PIN belirlenir ve ona sonradan hiç girilemez. Aynı asimetri bir
    // kez yaşandı, ikinci kez açılmasın.
    const e0 = eski.trim();
    const y1 = yeni1.trim();
    const y2 = yeni2.trim();

    if (!e0) {
      setHata('Mevcut PIN’inizi yazın.');
      return;
    }
    if (y1.length < 6) {
      setHata('Yeni PIN en az 6 karakter olmalı.');
      return;
    }
    if (y1 !== y2) {
      setHata('İki yeni PIN aynı değil. Kontrol edip tekrar yazın.');
      return;
    }
    // Sunucuya GİTMEDEN önce denetleniyor: kurtarma yolu olmayan bir
    // sistemde tek harflik bir yazım hatası öğretmeni kendi ürününden
    // kilitler.
    if (y1 === e0) {
      setHata('Yeni PIN eskisiyle aynı olamaz.');
      return;
    }

    setHata(null);
    setKaydediyor(true);
    try {
      // `oturumDusurmesin` ŞART. Sunucu "mevcut PIN doğru değil" için de
      // `28000` fırlatıyor ve istemci normalde o kodu "oturumun bitti" diye
      // okuyup kullanıcıyı dışarı atıyor. Yani PIN'ini bir harf yanlış yazan
      // öğretmen sistemden atılıyordu — tarayıcıda ölçülerek görüldü.
      await rpc(
        'pin_degistir',
        { p_token: oturum?.token, p_eski: e0, p_yeni: y1 },
        { oturumDusurmesin: true },
      );
      setEski('');
      setYeni1('');
      setYeni2('');
      setDegisti(true);
      bildir('PIN değiştirildi', 'basari');
    } catch (err) {
      // Sunucunun mesajları zaten Türkçe ve doğru ("Mevcut PIN doğru
      // değil.", "Yeni PIN en az 6 haneli olmalı."); olduğu gibi gösteriliyor.
      setHata(err instanceof Error ? err.message : 'PIN değiştirilemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <>
      <SayfaBasligi baslik="Ayarlar" aciklama="Öğretmen PIN’iniz." />

      <Card>
        <h2 className="mb-1 text-[18px] text-ink">PIN değiştir</h2>
        <p className="mb-4 text-[14px] text-muted">
          Değiştirdiğinizde bu cihazdaki oturumunuz açık kalır,{' '}
          <strong>diğer cihazlardaki oturumlar kapanır</strong>. Öğrenci ve veli girişleri
          etkilenmez.
        </p>

        {degisti && (
          <p className="mb-4 rounded-sk-sm bg-success-bg p-3 text-[13px] text-success">
            PIN’iniz değişti. Bundan sonra <strong>yeni PIN</strong> ile gireceksiniz; diğer
            cihazlarınızda yeniden giriş yapmanız gerekecek.
          </p>
        )}

        {/* `noValidate` — doğrulama ve mesajlar bizim; tarayıcının İngilizce
            baloncukları öğretmene bir şey anlatmıyor. Kurulum ekranıyla
            aynı yaklaşım.

            Üç alanda da `autoCapitalize` YOK ve olmayacak. Giriş kutusundaki
            `autoCapitalize="characters"` iPad'de yazılan harfleri büyütüp
            PIN'i bozuyordu; o hata bir kez yaşandı, giriş kutusu için
            regresyon testi var, aynı güvence bu alanlar için de yazıldı. */}
        <form onSubmit={gonder} noValidate>
          <Field etiket="Mevcut PIN" zorunlu>
            {(k) => (
              <Input
                {...k}
                type="password"
                autoComplete="current-password"
                value={eski}
                onChange={(ev) => setEski(ev.target.value)}
              />
            )}
          </Field>

          <Field
            etiket="Yeni PIN"
            zorunlu
            ipucu="En az 6 karakter. Harf, rakam ve noktalama kullanabilirsiniz."
          >
            {(k) => (
              <Input
                {...k}
                type="password"
                autoComplete="new-password"
                value={yeni1}
                onChange={(ev) => setYeni1(ev.target.value)}
              />
            )}
          </Field>

          <Field etiket="Yeni PIN tekrar" zorunlu {...(hata ? { hata } : {})}>
            {(k) => (
              <Input
                {...k}
                type="password"
                autoComplete="new-password"
                value={yeni2}
                onChange={(ev) => setYeni2(ev.target.value)}
              />
            )}
          </Field>

          <p className="mb-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
            <strong>Yeni PIN’inizi bir yere not edin.</strong> Güvenlik gereği şifrelenerek
            saklanır; unutulursa panelden okunamaz ve kurtarmanın kolay bir yolu yoktur.
          </p>

          <Button type="submit" yukleniyor={kaydediyor} yuklenmeMetni="Değiştiriliyor">
            PIN’i değiştir
          </Button>
        </form>
      </Card>
    </>
  );
}
