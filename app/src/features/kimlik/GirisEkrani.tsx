import { useState, type FormEvent } from 'react';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { rpc, type Oturum } from '@/services/supabase';
import type { GirisSonucu } from '@/types/api';

type Props = {
  onGiris: (o: Oturum) => void;
  onKurulum: () => void;
};

/**
 * Giriş ekranı — tek alan.
 *
 * Öğretmen PIN'i, öğrenci kodu ve veli kodu aynı alandan girilir; rolü
 * sunucu belirler. Kullanıcıya "hangisisiniz?" diye sormuyoruz çünkü
 * kullanıcı zaten yalnız bir koda sahip; ek soru gereksiz sürtünme olurdu.
 */
export function GirisEkrani({ onGiris, onKurulum }: Props) {
  const [kod, setKod] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    const temiz = kod.trim();
    if (!temiz) {
      setHata('Kodunuzu yazın.');
      return;
    }

    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await rpc<GirisSonucu>('giris', { p_kod: temiz });

      if (sonuc.rol === 'kurulum') {
        onKurulum();
        return;
      }
      if (sonuc.rol === 'yok') {
        setHata('Bu kod bulunamadı. Büyük/küçük harfe dikkat edip tekrar deneyin.');
        return;
      }
      if (sonuc.rol === 'ogretmen') {
        onGiris({ rol: 'ogretmen', token: sonuc.token });
        return;
      }
      onGiris({ rol: sonuc.rol, token: sonuc.token, ogrenci: sonuc.ogrenci });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Giriş yapılamadı. Tekrar deneyin.');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="flex justify-center">
          <SekizWordmark boyut="lg" acilistaDonsun />
        </div>
      </div>

      <Card>
        <form onSubmit={gonder} noValidate>
          <Field
            etiket="Giriş kodunuz"
            ipucu="Öğrenci ve veli kodları öğretmeniniz tarafından verilir."
            {...(hata ? { hata } : {})}
          >
            {(k) => (
              <Input
                {...k}
                value={kod}
                onChange={(e) => setKod(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Örn. K7RM2XPQ"
                enterKeyHint="go"
              />
            )}
          </Field>

          <Button type="submit" tamGenislik yukleniyor={yukleniyor} yuklenmeMetni="Giriş yapılıyor">
            Giriş yap
          </Button>
        </form>
      </Card>

      <div className="mt-8 flex items-center justify-center gap-3 text-center">
        <EwaluFigure poz="karsilama" boyut={44} dekoratif />
        <p className="text-[13px] text-muted">
          Ödevini görürsün, çözersin, gönderirsin.
          <br />
          Puanın anında gelir.
        </p>
      </div>

      <footer className="mt-10 flex flex-col items-center gap-3">
        <SchoolCrest boyut={96} />
        <p className="text-center text-[12px] text-muted">
          Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi
        </p>
      </footer>
    </main>
  );
}
