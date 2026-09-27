import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { dosyaAdresi } from '@/services/dosya';

type Props = {
  gonderimId: string;
  /**
   * Tetikleyici. Verilmezse "Çözümü aç" düğmesi; verilirse (panoda
   * öğrencinin adı) metin bağlantısı gibi çizilen bir düğme.
   */
  etiket?: ReactNode;
  /** Ekran okuyucu için, `etiket` bir ad olduğunda ne yapacağını söyler. */
  erisilebilirAd?: string;
};

/**
 * "Çözümü aç" — tek ya da çok sayfalı (0054), ortak (0055).
 *
 * İKİ YERDE: ödevin gönderim ekranında düğme, panoda öğrencinin ADI
 * (öğretmenin isteği: "isimlerine tıkladığımızda çözdükleri gönderdikleri
 * çözüm açılsın"). Davranış tek yerde kalsın diye bileşen ortak.
 *
 * TEK SAYFADA doğrudan açılır. Birden fazla sayfada düğmeler açılır —
 * "1. sayfa · 2. sayfa · 3. sayfa" — öğretmen öğrencinin gönderdiği sırayla
 * görür. Sekmeler TOPLU açılmıyor: tarayıcının açılır pencere engelleyicisi
 * ilkinden sonrakileri sessizce yutar.
 *
 * Yol istemcide tutulmuyor; imzalı adres (60 sn) her tıklamada yeniden
 * alınıyor. Tutulan yalnız yolların LİSTESİ — adres değil.
 */
export function CozumDugmesi({ gonderimId, etiket, erisilebilirAd }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [yollar, setYollar] = useState<string[] | null>(null);

  async function ac(yol: string) {
    try {
      window.open(await dosyaAdresi(yol), '_blank', 'noopener');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Fotoğraf açılamadı.', 'hata');
    }
  }

  async function cozumuAc() {
    try {
      const r = await rpc<{ yol: string | null; yollar?: string[] }>('gonderim_foto_yolu', {
        p_token: oturum?.token,
        p_gonderim: gonderimId,
      });
      // `yollar` 0054'le geldi. Gelmiyorsa 0054 henüz çalıştırılmamış: tek `yol`.
      const liste = r.yollar && r.yollar.length > 0 ? r.yollar : r.yol ? [r.yol] : [];
      if (liste.length === 0) return bildir('Bu gönderimde fotoğraf yok.', 'hata');
      if (liste.length === 1) return await ac(liste[0]!);
      setYollar(liste);
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Fotoğraf açılamadı.', 'hata');
    }
  }

  const sayfalar = yollar && (
    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Çözüm sayfaları">
      <span className="text-[13px] text-muted">
        <span className="sk-sayi">{yollar.length}</span> sayfa:
      </span>
      {yollar.map((y, i) => (
        <Button key={y} tur="sade" olcu="sm" onClick={() => void ac(y)}>
          {`${i + 1}. sayfa`}
        </Button>
      ))}
    </div>
  );

  if (etiket !== undefined) {
    return (
      <>
        <button
          type="button"
          onClick={() => void cozumuAc()}
          {...(erisilebilirAd ? { 'aria-label': erisilebilirAd } : {})}
          className="min-h-[44px] text-left font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {etiket}
        </button>
        {sayfalar}
      </>
    );
  }

  if (sayfalar) return sayfalar;

  return (
    <Button tur="sade" olcu="sm" onClick={() => void cozumuAc()}>
      Çözümü aç
    </Button>
  );
}
