import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { SEBEP_EN_AZ, SEBEP_EN_FAZLA } from '@/lib/puan-duzeltme';
import {
  SEBEP_UYARISI,
  TARIH_EKSIK,
  TARIH_ETIKETI,
  TARIH_GECMIS,
  gunMetni,
  iptalMesaji,
} from '@/lib/iptal-metni';

type Props = {
  gonderimId: string;
  ogrenci: string;
  /** Ödevin adı — öğrenciye gidecek mesajın önizlemesinde geçiyor. */
  odev: string;
  /** Gösterilen (son) puan; açık uçlu ve puanlanmamışsa null. */
  puan: number | null;
  /** Test ödevinde doğru/yanlış/boş; açık uçluda gelmez. */
  dogru?: number | null;
  yanlis?: number | null;
  bos?: number | null;
  zaman: string | null;
  onAcildi: () => void;
};

/** Bugün, `YYYY-MM-DD` — `<input type="date">`in beklediği biçim. */
function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Bugünden n gün sonrası, aynı biçimde. */
function gunSonra(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  odev,
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
  // 0081 — YENİ SON TARİH. Varsayılan bugün + 7: öğretmen her seferinde
  // sıfırdan tarih düşünmesin, ama istediğini seçebilsin.
  const [sonTarih, setSonTarih] = useState(gunSonra(7));
  const [hata, setHata] = useState<string | null>(null);
  const [isliyor, setIsliyor] = useState(false);

  function kapat() {
    if (isliyor) return;
    setAcik(false);
    setNeden('');
    setSonTarih(gunSonra(7));
    setHata(null);
  }

  async function ac() {
    const temiz = neden.trim();
    if (temiz.length < SEBEP_EN_AZ) return setHata('Yeniden açmanın sebebini yazın.');
    if (temiz.length > SEBEP_EN_FAZLA) {
      return setHata(`Sebep en fazla ${SEBEP_EN_FAZLA} karakter olabilir.`);
    }
    // TARİH: boş ve geçmiş reddediliyor. Asıl sınır yine sunucuda —
    // burası yalnız öğrenciyi bekletmeden söylemek için.
    if (!sonTarih) return setHata(TARIH_EKSIK);
    if (sonTarih < bugun()) return setHata(TARIH_GECMIS);
    setHata(null);
    setIsliyor(true);
    try {
      await rpc('gonderimi_yeniden_ac', {
        p_token: oturum?.token,
        p_gonderim: gonderimId,
        p_neden: temiz,
        p_son_tarih: sonTarih,
      });
      bildir(`${ogrenci} ${gunMetni(sonTarih) ?? ''} tarihine kadar yeniden gönderebilir`, 'basari');
      setAcik(false);
      setNeden('');
      setSonTarih(gunSonra(7));
      onAcildi();
    } catch (e) {
      const ucYok =
        e instanceof Error && /could not find the function|schema cache/i.test(e.message);
      setHata(
        ucYok
          ? // 0081 imzayı değiştirdi (`p_son_tarih` eklendi) ve eskisini
            // düşürdü. 0081 çalışmamışsa PostgREST bu çağrıyı HİÇ bulamaz;
            // mesaj 0056'yı işaret etseydi öğretmen yanlış dosyayı arardı.
            'Yeniden açma bu sistemde henüz kurulmadı. Önce 0081 SQL dosyasını çalıştırın.'
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
          {/* 0082: eski cümle "daha önce yüklediği fotoğraf kullanılmaya
              devam eder" diyordu ve artık YANLIŞ — öğrenci sayfalarının
              fotoğrafını yeniden yükleyebiliyor. Boş sayfa gönderen
              öğrencide olayın özü tam buydu. */}
          <li>
            Öğrenci ödevi <strong>aşağıda seçtiğiniz tarihe kadar</strong> yeniden gönderebilir —
            sınıfın süresi dolmuş olsa bile. <strong>Sayfalarının fotoğrafını yeniden
            yükleyebilir</strong>; isterse önceki sayfalarını kullanır. Cevaplarını yeniden
            işaretler.
          </li>
          <li>
            Gönderim yine <strong>gecikmeli</strong> görünür; yanında ek süre verdiğiniz yazar.
          </li>
        </ul>

        {/* YENİ SON TARİH (0081). `min` bugün: geçmiş bir tarih kapıyı
            anında kapatır, yani öğrenciye hak verilmiş gibi görünüp
            gönderememesi demekti. Asıl sınır yine sunucuda. */}
        <Field etiket={TARIH_ETIKETI} zorunlu>
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
              placeholder="Örn. cevaplar sisteme boş kaydedildi"
            />
          )}
        </Field>

        {/* SEBEP ÖĞRENCİYE GİDİYOR — önceden söyleniyor. Bu uyarı olmasa
            öğretmen oraya kendine not yazar ve notu öğrenci okurdu. */}
        <p className="mt-1 text-[13px] text-ink" data-test="sebep-uyarisi">
          {SEBEP_UYARISI}
        </p>

        {/* ÖNİZLEME: ne gideceği aynen görünüyor (sunucudaki cümlenin
            aynısı — `iptal-metni.test.ts` ikisini sabitliyor). */}
        {neden.trim().length >= SEBEP_EN_AZ && (
          <p
            className="mt-2 rounded-sk-sm bg-line-soft p-3 text-[13px] text-muted"
            data-test="iptal-onizleme"
          >
            {iptalMesaji(odev, neden, sonTarih)}
          </p>
        )}
      </Dialog>
    </>
  );
}
