import { useState, type FormEvent } from 'react';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { EwaluVideo } from '@/components/brand/EwaluVideo';
import { GeometricDivider } from '@/components/brand/GeometricDivider';
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
    /* Dikey ortalama YOK: sekiz blok + video viewport'tan uzun, sayfa akıyor. */
    <main className="mx-auto w-full max-w-[440px] px-4 py-8">
      {/* 1 — Okul mührü. Okul adı hemen altında görünür metin olduğu için
             mühür dekoratif: ekran okuyucu adı iki kez okumasın. */}
      <div className="flex justify-center">
        <SchoolCrest boyut={120} dekoratif />
      </div>

      {/* 2 ve 3 — Okul adı iki satır */}
      <div className="mt-3 text-center">
        <p className="text-[13px] font-bold tracking-[0.22em] text-muted">BEŞİKTAŞ</p>
        <p className="mt-0.5 text-[14px] font-semibold text-ink">
          Arnavutköy Korkmaz Yiğit Anadolu Lisesi
        </p>
      </div>

      <GeometricDivider className="my-6" />

      {/* 4 ve 5 — ∞ işareti + SEKİZ, altında öğretmen kimliği.
             Sayfanın tek h1'i burası. */}
      <h1 className="flex justify-center">
        <SekizWordmark boyut="lg" acilistaDonsun />
      </h1>

      {/* 6 — Giriş formu */}
      <Card className="mt-7">
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

      {/* 7 — Ewalu ve mesajı */}
      <div className="mt-7 flex items-center justify-center gap-3">
        <EwaluFigure poz="karsilama" boyut={52} dekoratif />
        <p className="text-[13px] text-muted">
          Ödevini görürsün, çözersin, gönderirsin.
          <br />
          Puanını anında hesaplarım.
        </p>
      </div>

      {/* 8 — Tanıtım videosu. KALICI (öğretmen kararı): Faz 9'da tanıtım
             sayfası gelse bile buradan kaldırılmayacak. preload="none"
             olduğu için sayfa açılışında indirilmiyor. */}
      <footer className="mt-9">
        <GeometricDivider className="mb-6" />
        <EwaluVideo />
      </footer>
    </main>
  );
}
