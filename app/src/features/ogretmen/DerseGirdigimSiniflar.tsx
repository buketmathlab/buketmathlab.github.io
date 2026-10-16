import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  SINIF_SECIMI_ACIKLAMA,
  SINIF_SECIMI_BASLIK,
  SINIF_SECIMI_GUVENCE,
} from '@/lib/anket-kapsam-metni';
import { rpc } from '@/services/supabase';
import type { Sinif } from '@/types/api';

/**
 * DERSE GİRDİĞİM SINIFLAR (0081) — Ayarlar kartı.
 *
 * Öğretmenin sözü: *"Ben platform sahibi olarak tüm sınıfları
 * görebiliyorum, fakat bu tüm sınıfların öğretmeni değilim. Benim girdiğim
 * sınıflar 9A, 9B, 10C, 11C."*
 *
 * Veri modelinde bu ayrım YOKTU: 0033 bütün mevcut sınıfları yöneticiye
 * bağlamıştı. Bu kart o ayrımı kuruyor.
 *
 * -----------------------------------------------------------------------------
 * KART SINIF GÖRME YETKİSİNİ DEĞİŞTİRMİYOR — ve bunu açıkça yazıyor
 *
 * İşaret yalnız anket sonuçlarındaki "Kendi sınıflarım" kapsamını
 * belirliyor; öğrenciler, ödevler, mesajlar, sınıf listesi aynen duruyor.
 * Güvence cümlesi olmadan öğretmen, işareti kaldırınca o sınıfı tamamen
 * kaybedeceğini sanabilir — hiç işaretlemez ve özellik ölü doğardı.
 *
 * İYİMSER ÇİZİM: dokunulan kutu hemen değişiyor, istek arkadan gidiyor.
 * İstek düşerse kutu eski hâline dönüyor ve bildirim çıkıyor — sessizce
 * geri almak, öğretmenin yanlış bir kapsamı doğru sanmasına yol açardı.
 */
export function DerseGirdigimSiniflar() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });
  /** Sunucudan gelenin üstüne yazan yerel değişiklikler. */
  const [yerel, setYerel] = useState<Record<string, boolean>>({});
  const [isleyen, setIsleyen] = useState<string | null>(null);

  const liste = Array.isArray(siniflar.veri) ? siniflar.veri : null;
  // 0081 çalıştırılmamış bir panelde alan hiç gelmez: kart çizilmiyor.
  // Yanlış bir kapsam göstermektense hiç göstermemek doğru.
  if (!liste || liste.length === 0 || liste[0]?.dersine_giriyor === undefined) return null;

  async function degistir(s: Sinif, deger: boolean) {
    setYerel((y) => ({ ...y, [s.id]: deger }));
    setIsleyen(s.id);
    try {
      await rpc('sinif_dersine_giriyor', {
        p_token: oturum?.token,
        p_sinif_id: s.id,
        p_deger: deger,
      });
    } catch (e) {
      // GERİ ALMA SESSİZ DEĞİL: kutu eski hâline dönüyor VE sebep yazılıyor.
      setYerel((y) => ({ ...y, [s.id]: !deger }));
      bildir(e instanceof Error ? e.message : 'Değişiklik kaydedilemedi.', 'hata');
    } finally {
      setIsleyen(null);
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="mb-1 text-[18px] text-ink">{SINIF_SECIMI_BASLIK}</h2>
      <p className="mb-3 text-[14px] text-muted">{SINIF_SECIMI_ACIKLAMA}</p>

      <ul className="flex flex-col gap-1" data-test="derse-girdigim-siniflar">
        {liste.map((s) => {
          const secili = yerel[s.id] ?? s.dersine_giriyor === true;
          return (
            <li key={s.id}>
              <label className="flex min-h-[44px] items-center gap-2 text-[15px] text-ink">
                <input
                  type="checkbox"
                  checked={secili}
                  disabled={isleyen === s.id}
                  onChange={(e) => void degistir(s, e.target.checked)}
                  className="h-5 w-5 shrink-0"
                />
                <span>{s.ad}</span>
                <span className="text-[13px] text-muted">
                  <span className="sk-sayi">{s.ogrenci_sayisi}</span> öğrenci
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[13px] text-muted">{SINIF_SECIMI_GUVENCE}</p>
    </Card>
  );
}
