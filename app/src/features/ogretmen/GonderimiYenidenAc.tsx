import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { SEBEP_EN_AZ, SEBEP_EN_FAZLA } from '@/lib/puan-duzeltme';

type Props = {
  gonderimId: string;
  ogrenci: string;
  /** Gösterilen (son) puan; açık uçlu ve puanlanmamışsa null. */
  puan: number | null;
  /** Test ödevinde doğru/yanlış/boş; açık uçluda gelmez. */
  dogru?: number | null;
  yanlis?: number | null;
  bos?: number | null;
  zaman: string | null;
  onAcildi: () => void;
};

const TARIH = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * GÖNDERİMİ YENİDEN AÇ (0056) — yalnız platformun sahibinde çizilir.
 *
 * Olay: öğrenci cevaplarını işaretledi, gönderim BOŞ kaydedildi; "gönderim
 * değiştirilemez" kuralı yüzünden öğrencinin elinde yol yoktu. Öğretmenin
 * isteği: öğrenci mağdur olmasın.
 *
 * GÖSTER → UYAR → ONAYLA → YAP → KAYDET. Diyalog neyin silineceğini
 * (öğrenci, puan, zaman) gösteriyor, sonuçlarını söylüyor, sebep istiyor;
 * sunucu eski gönderimin TAMAMINI denetim izine yazıp satırı siliyor.
 *
 * Görünürlük arayüzde, YETKİ SUNUCUDA (`puan_duzelt` ile aynı kural):
 * bileşen yanlışlıkla bir öğretmene çizilse bile sunucu 42501 döner.
 */
export function GonderimiYenidenAc({
  gonderimId,
  ogrenci,
  puan,
  dogru,
  yanlis,
  bos,
  zaman,
  onAcildi,
}: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [acik, setAcik] = useState(false);
  const [neden, setNeden] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);

  function kapat() {
    if (isliyor) return;
    setAcik(false);
    setNeden('');
    setHata(null);
  }

  async function ac() {
    const temiz = neden.trim();
    if (temiz.length < SEBEP_EN_AZ) return setHata('Yeniden açmanın sebebini yazın.');
    if (temiz.length > SEBEP_EN_FAZLA) {
      return setHata(`Sebep en fazla ${SEBEP_EN_FAZLA} karakter olabilir.`);
    }
    setHata(null);
    setIsliyor(true);
    try {
      await rpc('gonderimi_yeniden_ac', {
        p_token: oturum?.token,
        p_gonderim: gonderimId,
        p_neden: temiz,
      });
      bildir(`${ogrenci} ödevi yeniden gönderebilir`, 'basari');
      setAcik(false);
      setNeden('');
      onAcildi();
    } catch (e) {
      const ucYok =
        e instanceof Error && /could not find the function|schema cache/i.test(e.message);
      setHata(
        ucYok
          ? 'Yeniden açma bu sistemde henüz kurulmadı. Önce 0056 SQL dosyasını çalıştırın.'
          : e instanceof Error
            ? e.message
            : 'Gönderim yeniden açılamadı.',
      );
    } finally {
      setIsliyor(false);
    }
  }

  const testMi = dogru !== null && dogru !== undefined;

  return (
    <>
      <Button tur="sade" olcu="sm" onClick={() => setAcik(true)}>
        Gönderimi yeniden aç
      </Button>

      <Dialog
        acik={acik}
        onKapat={kapat}
        baslik="Gönderimi yeniden aç"
        aciklama={`${ogrenci} bu ödevi baştan gönderebilecek.`}
        onayEtiketi="Yeniden aç"
        onayTuru="tehlike"
        onOnay={() => void ac()}
        onayYukleniyor={isliyor}
      >
        {/* GÖSTER: neyin kaldırılacağı. */}
        <div className="mb-3 rounded-sk-sm border border-line bg-line-soft p-3 text-[14px] text-ink">
          <p className="font-semibold">Şu anki gönderim</p>
          <p className="mt-1">
            Puan: <span className="sk-sayi font-semibold">{puan ?? 'puanlanmadı'}</span>
            {testMi && (
              <span className="sk-sayi text-muted">
                {` · ${dogru} doğru, ${yanlis ?? 0} yanlış, ${bos ?? 0} boş`}
              </span>
            )}
          </p>
          {zaman && <p className="text-muted">{`Gönderildi: ${TARIH.format(new Date(zaman))}`}</p>}
        </div>

        {/* UYAR: sonuçları. */}
        <ul className="mb-3 list-disc space-y-1 pl-5 text-[14px] text-ink">
          <li>Bu gönderim listeden kalkar; öğrencinin puanı yeniden gönderene kadar görünmez.</li>
          <li>
            Eski gönderimin tamamı (cevaplar, puan, zaman) <strong>kayıt altında saklanır</strong>.
          </li>
          <li>
            Öğrenci ödevi yeniden gönderebilir — süre dolmuş olsa bile. Daha önce yüklediği
            fotoğraf kullanılmaya devam eder; cevaplarını yeniden işaretler.
          </li>
        </ul>

        <Field etiket="Sebep" zorunlu {...(hata ? { hata } : {})}>
          {(k) => (
            <Textarea
              {...k}
              rows={2}
              maxLength={SEBEP_EN_FAZLA}
              value={neden}
              onChange={(e) => setNeden(e.target.value)}
              placeholder="Örn. cevaplar sisteme boş kaydedildi"
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
