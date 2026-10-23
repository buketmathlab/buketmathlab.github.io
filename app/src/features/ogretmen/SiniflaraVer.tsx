import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import * as METIN from '@/lib/siniflara-verme-metni';
import type { VerilebilirSinif } from '@/types/api';

type Props = {
  odevId: string;
  /** Kaynak ödevin kendi sınıfı — kartta "buradan kopyalanıyor" olarak yazılı. */
  kaynakSinif: string;
  /** Sunucunun süzdüğü liste: kaynağın sınıfı ve kardeşler zaten yok. */
  siniflar: VerilebilirSinif[];
  /** Kopyalama sonrası ekranın kendini tazelemesi için. */
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
 * ÖDEVİ BAŞKA SINIFLARA DA VERME (0083).
 *
 * Öğretmenin isteği: "10C'ye ödev gönderdim. Bu ödevin aynısını DAHA
 * SONRA istediğim diğer sınıflara da gönderebileyim." 0030 bunu yalnız
 * oluşturma anında yapabiliyordu; sonradan sınıf eklemek için form baştan
 * doldurulup iki PDF yeniden yükleniyordu.
 *
 * ÜÇ KARAR EKRANDA GÖRÜNÜR:
 *
 * 1. **Kopyalar TASLAK** (öğretmenin kararı). Diyalogda yazılı; yanlış
 *    sınıf seçilirse öğrenci hiç görmeden düzeltilir.
 * 2. **Tek tarih** — seçilen bütün sınıflara aynı son tarih. Kutu dolu
 *    geliyor; geçmiş tarih seçilemiyor (asıl sınır sunucuda).
 * 3. **Ne taşınır, ne taşınmaz yazılı** (0031'in kartındaki desen).
 *
 * LİSTEYİ SUNUCU SÜZÜYOR (`odev_detay.verilebilir_siniflar`): kaynağın
 * kendi sınıfı ve zaten verilmiş sınıflar gelmiyor. Burada ikinci bir
 * süzgeç yazmıyoruz — iki yerde iki türlü hesaplanan bir liste bir gün
 * ayrışır ve öğretmen sunucunun neden reddettiğini anlamaz.
 */
export function SiniflaraVer({ odevId, kaynakSinif, siniflar, onVerildi }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<string[]>([]);
  const [sonTarih, setSonTarih] = useState(gunSonra(7));
  const [hata, setHata] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);

  function kapat() {
    if (isliyor) return;
    setAcik(false);
    setSecili([]);
    setSonTarih(gunSonra(7));
    setHata(null);
  }

  async function ver() {
    if (secili.length === 0) return setHata(METIN.SINIF_EKSIK);
    if (!sonTarih) return setHata(METIN.TARIH_EKSIK);
    // `min` yalnız takvimi kısıtlıyor; klavyeyle yazılan tarihi durdurmaz.
    if (sonTarih < bugun()) return setHata(METIN.TARIH_GECMIS);
    setHata(null);
    setIsliyor(true);
    try {
      await rpc('odev_siniflara_kopyala', {
        p_token: oturum?.token,
        p_id: odevId,
        p_sinif_idler: secili,
        p_son_tarih: sonTarih,
      });
      const adlar = siniflar.filter((s) => secili.includes(s.id)).map((s) => s.ad);
      bildir(METIN.sonucMetni(adlar), 'basari');
      kapat();
      onVerildi();
    } catch (e) {
      const ucYok =
        e instanceof Error && /could not find the function|schema cache/i.test(e.message);
      setHata(
        ucYok
          ? 'Bu özellik bu sistemde henüz kurulmadı. Önce 0083 SQL dosyasını çalıştırın.'
          : e instanceof Error
            ? e.message
            : 'Ödev kopyalanamadı.',
      );
    } finally {
      setIsliyor(false);
    }
  }

  return (
    <Card className="mb-4">
      {/* `data-test` İÇERİDE: `Card` ek öznitelik almıyor ve dışarıya
          yazılan işaret DOM'a hiç ulaşmıyordu (denetim yakaladı). */}
      <div data-test="siniflara-ver">
        <p className="font-display text-[18px] font-semibold text-ink">{METIN.BASLIK}</p>
        <p className="mt-1 text-[14px] text-muted">
          {METIN.ACIKLAMA} Kaynak: <strong>{kaynakSinif}</strong>.
        </p>
        <div className="mt-3">
          <Button tur="sade" olcu="sm" onClick={() => setAcik(true)}>
            Sınıf seç
          </Button>
        </div>
      </div>

      <Dialog
        acik={acik}
        onKapat={kapat}
        baslik={METIN.BASLIK}
        aciklama={METIN.ACIKLAMA}
        onayEtiketi="Seçilen sınıflara ver"
        onOnay={() => void ver()}
        onayYukleniyor={isliyor}
      >
        <fieldset className="mb-3">
          <legend className="mb-2 text-[14px] font-semibold text-ink">Sınıflar</legend>
          {/* Seçim kutuları `OdevOlustur`'daki desenin aynısı: renk tek
              başına bilgi taşımıyor, yanında işaret de var. */}
          <div className="flex flex-wrap gap-2" data-test="sinif-secimi">
            {siniflar.map((s) => {
              const isaretli = secili.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={
                    'flex min-h-[44px] cursor-pointer items-center gap-1 rounded-sk-sm border px-3 text-[15px] ' +
                    (isaretli
                      ? 'border-ink bg-ink font-semibold text-paper'
                      : 'border-line text-ink')
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isaretli}
                    onChange={() =>
                      setSecili((y) =>
                        y.includes(s.id) ? y.filter((x) => x !== s.id) : [...y, s.id],
                      )
                    }
                  />
                  <span aria-hidden="true">{isaretli ? '✓' : '+'}</span>
                  <span>{s.ad}</span>
                </label>
              );
            })}
          </div>
          {METIN.secimSayaci(secili.length) && (
            <p className="mt-2 text-[13px] text-muted" data-test="secim-sayaci">
              <span className="sk-sayi">{secili.length}</span>
              {' sınıf seçildi'}
            </p>
          )}
        </fieldset>

        <Field etiket={METIN.TARIH_ETIKETI} zorunlu {...(hata ? { hata } : {})}>
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

        {/* NE OLACAĞI ONAYDAN ÖNCE YAZILI (0031'in kartındaki desen). */}
        <div className="mt-3 rounded-sk-sm bg-line-soft p-3 text-[14px] text-ink">
          <p className="font-semibold" data-test="taslak-uyarisi">
            {METIN.TASLAK_UYARISI}
          </p>
          <p className="mt-2 font-semibold">Kopyalanır</p>
          <ul className="list-disc space-y-1 pl-5">
            {METIN.TASINAN.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-2 font-semibold">Kopyalanmaz</p>
          <ul className="list-disc space-y-1 pl-5">
            {METIN.TASINMAYAN.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">{METIN.KARDES_NOTU}</p>
        </div>
      </Dialog>
    </Card>
  );
}
