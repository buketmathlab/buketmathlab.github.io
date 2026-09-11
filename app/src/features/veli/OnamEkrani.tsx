import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import {
  ONAM_AD_ACIKLAMA,
  ONAM_AD_ETIKET,
  ONAM_BASLIK,
  ONAM_BOLUMLERI,
  ONAM_GIRIS,
  ONAM_OZET,
  ONAM_SURUMU,
} from '@/lib/onam-metni';

/**
 * Velinin onam ekranı (0034).
 *
 * NEREDE DURUYOR: `VeliKabuk` içinde, sekmelerin ve `<Outlet/>`in YERİNE.
 * Ayrı bir rota değil — adres çubuğuna `/veli/odevler` yazan veli de bunu
 * görsün diye. Asıl sınır zaten sunucuda: onam yokken `veli_paneli`
 * çocuğa ait hiçbir alan döndürmüyor, diğer uçlar da 42501 veriyor. Bu
 * ekran o kararı GİZLEMİYOR, sadece anlatıyor (Part XXI).
 *
 * TEK DÜĞME. Öğretmenin kararı "onaylamayan giremesin" olduğu için
 * "Şimdi değil" diye bir çıkış yok; ama ÇIKIŞ düğmesi kabukta duruyor —
 * onaylamak istemeyen veli hiç değilse oturumu kapatabilmeli.
 *
 * METİN BURADAN GELMİYOR, `lib/onam-metni.ts`'ten geliyor: sürümü ve
 * hash'i orada kilitli. Ekran metni yeniden yazsaydı ikisi ayrışır ve
 * veli, kaydedilenden başka bir metni onaylamış olurdu.
 */
export function OnamEkrani({ onaylandi }: { onaylandi: () => void }) {
  const { oturum } = useOturum();
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [ad, setAd] = useState('');

  // Sunucudaki kuralın aynısı (`onam_ver`, 0038): kırpılmış ad en az iki
  // karakter. Burada tekrarlanıyor ki veli düğmeye basıp hata almasın —
  // ama KARAR SUNUCUDA: bu satır silinse de adsız onay kaydedilemez.
  const adGecerli = ad.trim().length >= 2;

  async function onayla() {
    if (!oturum?.token || gonderiliyor || !adGecerli) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      await rpc('onam_ver', {
        p_token: oturum.token,
        p_surum: ONAM_SURUMU,
        p_veli_adi: ad.trim(),
      });
      onaylandi();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Onay kaydedilemedi.');
      setGonderiliyor(false);
    }
  }

  return (
    <section aria-labelledby="onam-baslik" className="mx-auto max-w-[640px]">
      <h1 id="onam-baslik" className="text-[24px] text-ink">
        {ONAM_BASLIK}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">{ONAM_GIRIS}</p>

      <div className="mt-5 grid gap-3">
        {ONAM_BOLUMLERI.map((bolum) => (
          <Card key={bolum.baslik}>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">
              {bolum.baslik}
            </h2>
            <ul className="mt-2 grid gap-1.5">
              {bolum.maddeler.map((madde) => (
                <li
                  key={madde}
                  className="flex gap-2 text-[15px] leading-relaxed text-ink"
                >
                  <span aria-hidden="true" className="text-muted">
                    •
                  </span>
                  <span className="min-w-0">{madde}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {hata && (
        <p role="alert" className="mt-4 text-[15px] text-danger">
          {hata}
        </p>
      )}

      {/* ADI KİM VERDİ. Öğretmenin sınıf başına aldığı onam dökümünde
          hem çocuğun hem onaylayan velinin adı görünüyor; o ad buradan
          geliyor. Etiketi ve açıklaması da `onam-metni.ts`'te, yani hash
          kilidinin içinde: veliden ne istendiği sessizce değişemez. */}
      <div className="mt-6">
        <label
          htmlFor="onam-ad"
          className="block text-[15px] font-semibold text-ink"
        >
          {ONAM_AD_ETIKET}
        </label>
        <p id="onam-ad-not" className="mt-1 text-[13px] leading-relaxed text-muted">
          {ONAM_AD_ACIKLAMA}
        </p>
        <input
          id="onam-ad"
          type="text"
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          maxLength={120}
          autoComplete="name"
          aria-describedby="onam-ad-not"
          className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-ink"
        />
      </div>

      <div className="mt-6">
        {/* NEYE BASIYOR. Metin uzun; veli aşağı indiğinde düğmenin ne
            anlama geldiğini tekrar görmeli. Cümle `onam-metni.ts`'ten
            geliyor, yani hash kilidinin içinde. */}
        <p className="mb-3 text-[15px] font-semibold leading-relaxed text-ink">
          {ONAM_OZET}
        </p>
        <Button
          onClick={onayla}
          disabled={gonderiliyor || !adGecerli}
          className="w-full"
        >
          {gonderiliyor ? 'Kaydediliyor…' : 'Okudum, onaylıyorum'}
        </Button>
        {/* Onayın kaydedildiğini söylemek, "bir yere yazıldı mı?" sorusunu
            baştan kapatıyor. Sürüm de yazılı: metin değişirse veli yeni
            metni yeniden okur. */}
        <p className="mt-2 text-center text-[13px] text-muted">
          Onayınız tarihiyle birlikte kaydedilir. Metin sürümü:{' '}
          <span className="sk-sayi">{ONAM_SURUMU}</span>
        </p>
      </div>
    </section>
  );
}
