import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { SEBEP_EN_AZ, SEBEP_EN_FAZLA } from '@/lib/puan-duzeltme';
import * as METIN from '@/lib/ek-sure-metni';

type Secilen = { id: string; ad: string };

type Props = {
  acik: boolean;
  onKapat: () => void;
  odevId: string;
  /** Ödevin adı — öğrenciye gidecek mesajın önizlemesinde geçiyor. */
  odev: string;
  secilenler: Secilen[];
  /** Kaydettikten sonra ekranın kendini tazelemesi için. */
  onVerildi: () => void;
};

/** Bugün, `YYYY-MM-DD` — `<input type="date">`in beklediği biçim. */
function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function gunSonra(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * GÖNDERMEYENE EK SÜRE (0084).
 *
 * Öğretmenin isteği: "Son teslim tarihi içerisinde ödevini göndermeyen
 * öğrenciye daha sonradan sadece o öğrenci bazında gönderme hakkı
 * verebilen bir seçeneğim olsun."
 *
 * ALTYAPI 0081'DEN HAZIR: `odev_ek_sure`, gönderim kapısının o tarihi
 * okuması, öğrencinin "Sana verilen süre" satırı ve bu listedeki
 * "ek süre verildi" etiketi. Eksik olan tek şey satırı OLUŞTURMAKTI —
 * 0081'in yolu var olan bir gönderim istiyordu.
 *
 * ÜÇ ŞEY EKRANDA GÖRÜNÜR:
 *   1. KİME verildiği, adlarıyla. "3 öğrenciye" demek yanlış seçimi
 *      fark etmeyi imkânsız kılardı.
 *   2. Sebebin ÖĞRENCİYE GİDECEĞİ (0081'in kararı) ve mesajın önizlemesi.
 *   3. Tarih alanı `min` bugün; geçmiş tarih kapıyı anında kapatırdı.
 */
export function EkSureVer({ acik, onKapat, odevId, odev, secilenler, onVerildi }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [sonTarih, setSonTarih] = useState(gunSonra(7));
  const [neden, setNeden] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);

  function kapat() {
    if (isliyor) return;
    setSonTarih(gunSonra(7));
    setNeden('');
    setHata(null);
    onKapat();
  }

  async function ver() {
    const temiz = neden.trim();
    if (secilenler.length === 0) return setHata(METIN.OGRENCI_EKSIK);
    if (temiz.length < SEBEP_EN_AZ) return setHata(METIN.SEBEP_EKSIK);
    if (temiz.length > SEBEP_EN_FAZLA) {
      return setHata(`Sebep en fazla ${SEBEP_EN_FAZLA} karakter olabilir.`);
    }
    if (!sonTarih) return setHata(METIN.TARIH_EKSIK);
    // `min` yalnız takvimi kısıtlıyor; klavyeyle yazılan tarihi durdurmaz.
    if (sonTarih < bugun()) return setHata(METIN.TARIH_GECMIS);
    setHata(null);
    setIsliyor(true);
    try {
      await rpc('ogrencilere_ek_sure', {
        p_token: oturum?.token,
        p_odev: odevId,
        p_ogrenci_idler: secilenler.map((s) => s.id),
        p_son_tarih: sonTarih,
        p_neden: temiz,
      });
      bildir(
        METIN.sonucMetni(
          secilenler.map((s) => s.ad),
          sonTarih,
        ),
        'basari',
      );
      kapat();
      onVerildi();
    } catch (e) {
      const ucYok =
        e instanceof Error && /could not find the function|schema cache/i.test(e.message);
      setHata(
        ucYok
          ? 'Ek süre verme bu sistemde henüz kurulmadı. Önce 0084 SQL dosyasını çalıştırın.'
          : e instanceof Error
            ? e.message
            : 'Ek süre verilemedi.',
      );
    } finally {
      setIsliyor(false);
    }
  }

  return (
    <Dialog
      acik={acik}
      onKapat={kapat}
      baslik={METIN.BASLIK}
      aciklama={METIN.ACIKLAMA}
      onayEtiketi="Ek süre ver"
      onOnay={() => void ver()}
      onayYukleniyor={isliyor}
    >
      {/* KİME — adlarıyla. */}
      <div className="mb-3 rounded-sk-sm border border-line bg-line-soft p-3 text-[14px] text-ink">
        <p className="font-semibold">Ek süre verilecek</p>
        <p className="mt-1" data-test="ek-sure-kimler">
          {METIN.kimlereMetni(secilenler.map((s) => s.ad))}
        </p>
      </div>

      <Field etiket={METIN.TARIH_ETIKETI} zorunlu>
        {(k) => (
          <Input
            {...k}
            type="date"
            min={bugun()}
            value={sonTarih}
            onChange={(e) => setSonTarih(e.target.value)}
          />
        )}
      </Field>

      <Field etiket="Sebep" zorunlu {...(hata ? { hata } : {})}>
        {(k) => (
          <Textarea
            {...k}
            rows={2}
            maxLength={SEBEP_EN_FAZLA}
            value={neden}
            onChange={(e) => setNeden(e.target.value)}
            placeholder="Örn. rahatsızdın, sonradan gönderebilirsin"
          />
        )}
      </Field>

      {/* SEBEP ÖĞRENCİYE GİDİYOR — önceden söyleniyor (0081'in kararı). */}
      <p className="mt-1 text-[13px] text-ink" data-test="ek-sure-sebep-uyarisi">
        {METIN.SEBEP_UYARISI}
      </p>

      {/* ÖNİZLEME: ne gideceği aynen görünüyor; sunucudaki cümlenin
          aynısı ve testi ikisini sabitliyor. */}
      {neden.trim().length >= SEBEP_EN_AZ && (
        <p
          className="mt-2 rounded-sk-sm bg-line-soft p-3 text-[13px] text-muted"
          data-test="ek-sure-onizleme"
        >
          {METIN.ekSureMesaji(odev, neden, sonTarih)}
        </p>
      )}
    </Dialog>
  );
}
