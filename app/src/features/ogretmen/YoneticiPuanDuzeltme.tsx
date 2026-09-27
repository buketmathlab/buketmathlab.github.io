import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { duzeltmeyiDenetle, SEBEP_EN_FAZLA } from '@/lib/puan-duzeltme';

type Props = {
  gonderimId: string;
  mevcutPuan: number | null;
  onKaydedildi: () => void;
};

/**
 * YÖNETİCİ PUAN DÜZELTMESİ (0055) — yalnız platformun sahibinde çizilir.
 *
 * Görünürlük arayüzde, YETKİ SUNUCUDA: `puan_duzelt` gerçek kişinin
 * (vekâletteyse vekilin) sahip olduğunu kendisi arıyor. Düğmeyi gizlemek
 * güvenlik değil, düzen; bu bileşen bir öğretmene yanlışlıkla çizilse bile
 * sunucu 42501 ile reddeder.
 *
 * KAPALI BAŞLIYOR: her gönderim kartında açık bir form, listeyi okunmaz
 * kılardı. Sebep ZORUNLU ve öğretmen onu puanın yanında görüyor — form bunu
 * kaydetmeden önce söylüyor.
 */
export function YoneticiPuanDuzeltme({ gonderimId, mevcutPuan, onKaydedildi }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [acik, setAcik] = useState(false);
  const [puan, setPuan] = useState('');
  const [neden, setNeden] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);

  if (!acik) {
    return (
      <Button tur="sade" olcu="sm" onClick={() => setAcik(true)}>
        Puanı düzelt
      </Button>
    );
  }

  async function kaydet() {
    const s = duzeltmeyiDenetle(puan, neden);
    if ('hata' in s) return setHata(s.hata);
    setHata(null);
    setKaydediyor(true);
    try {
      await rpc('puan_duzelt', {
        p_token: oturum?.token,
        p_gonderim: gonderimId,
        p_puan: s.puan,
        p_neden: s.neden,
      });
      bildir(`Puan ${s.puan} olarak düzeltildi`, 'basari');
      setAcik(false);
      setPuan('');
      setNeden('');
      onKaydedildi();
    } catch (e) {
      const ucYok =
        e instanceof Error && /could not find the function|schema cache/i.test(e.message);
      bildir(
        ucYok
          ? 'Puan düzeltme bu sistemde henüz açılmadı. Önce 0055 SQL dosyasını çalıştırın.'
          : e instanceof Error
            ? e.message
            : 'Puan düzeltilemedi.',
        'hata',
      );
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <div className="mt-3 rounded-sk-sm border border-line bg-line-soft p-3">
      <p className="mb-3 text-[13px] text-muted">
        Şu anki puan: <span className="sk-sayi font-semibold text-ink">{mevcutPuan ?? '—'}</span>.
        Düzeltme denetim izine yazılır; ödevin öğretmeni puanın yanında{' '}
        <strong className="text-ink">“Yönetici düzeltti”</strong> ve sebebi görür. Öğrenci ve
        veli yalnız yeni puanı görür.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="sm:w-[140px]">
          <Field etiket="Yeni puan" zorunlu>
            {(k) => (
              <Input
                {...k}
                inputMode="decimal"
                value={puan}
                onChange={(e) => setPuan(e.target.value)}
                placeholder="0–100"
              />
            )}
          </Field>
        </div>
        <div className="flex-1">
          <Field etiket="Sebep" zorunlu {...(hata ? { hata } : {})}>
            {(k) => (
              <Textarea
                {...k}
                rows={2}
                maxLength={SEBEP_EN_FAZLA}
                value={neden}
                onChange={(e) => setNeden(e.target.value)}
                placeholder="Örn. kâğıdın arka yüzünde ek çözüm var"
              />
            )}
          </Field>
        </div>
      </div>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
        <Button tur="sade" olcu="sm" onClick={() => setAcik(false)} disabled={kaydediyor}>
          Vazgeç
        </Button>
        <Button olcu="sm" onClick={() => void kaydet()} yukleniyor={kaydediyor} yuklenmeMetni="Kaydediliyor">
          Düzeltmeyi kaydet
        </Button>
      </div>
    </div>
  );
}
