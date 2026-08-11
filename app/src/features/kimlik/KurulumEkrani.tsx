import { useState, type FormEvent } from 'react';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { rpc, type Oturum } from '@/services/supabase';

type Props = {
  onKuruldu: (o: Oturum) => void;
  onVazgec: () => void;
};

/**
 * İlk kurulum — öğretmen PIN'i belirleme.
 *
 * Bu ekran yalnız bir kez görülür: `pin_ayarla` PIN zaten belirlenmişse
 * hata döndürür. Bu kısıt sunucuda; arayüzdeki tek seferlik akış onun
 * yansıması.
 *
 * PIN bcrypt ile hash'lenerek saklanır — panelden okunamaz, kaybolursa
 * geri getirilemez. Bu yüzden uyarıyı açıkça yazıyoruz.
 */
export function KurulumEkrani({ onKuruldu, onVazgec }: Props) {
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function gonder(e: FormEvent) {
    e.preventDefault();

    // Giriş ekranı kodu `trim()`liyor. Kurulum trim'lemezse başta/sonda
    // boşlukla belirlenen bir PIN'e sonradan HİÇ girilemez — hash boşluklu
    // hâlin, giriş ise boşluksuz hâlin olur. İki ekran aynı metni üretmeli.
    const pin = pin1.trim();

    if (pin.length < 6) {
      setHata('PIN en az 6 haneli olmalı.');
      return;
    }
    if (pin !== pin2.trim()) {
      setHata('İki PIN aynı değil. Kontrol edip tekrar yazın.');
      return;
    }

    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await rpc<{ rol: 'ogretmen'; token: string }>('pin_ayarla', { p_yeni: pin });
      onKuruldu({ rol: 'ogretmen', token: sonuc.token });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'PIN kaydedilemedi. Tekrar deneyin.');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <SekizWordmark boyut="md" />
      </div>

      <Card vurgu="uyari">
        <div className="mb-4 flex items-start gap-3">
          <EwaluFigure poz="karsilama" boyut={56} dekoratif />
          <div>
            <h1 className="text-[19px] font-semibold text-ink">Hoş geldiniz</h1>
            <p className="mt-1 text-[14px] text-muted">
              Sistem ilk kez kuruluyor. Kendinize bir öğretmen PIN'i belirleyin.
            </p>
          </div>
        </div>

        <form onSubmit={gonder} noValidate>
          <Field etiket="Yeni PIN" zorunlu ipucu="En az 6 hane.">
            {(k) => (
              <Input
                {...k}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin1}
                onChange={(e) => setPin1(e.target.value)}
              />
            )}
          </Field>

          <Field etiket="PIN tekrar" zorunlu {...(hata ? { hata } : {})}>
            {(k) => (
              <Input
                {...k}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin2}
                onChange={(e) => setPin2(e.target.value)}
              />
            )}
          </Field>

          <p className="mb-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
            <strong>PIN'inizi bir yere not edin.</strong> Güvenlik gereği şifrelenerek saklanır;
            unutulursa panelden okunamaz.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button tur="sade" onClick={onVazgec} tamGenislik>
              Geri dön
            </Button>
            <Button type="submit" tamGenislik yukleniyor={yukleniyor} yuklenmeMetni="Kaydediliyor">
              PIN'i kaydet
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
