import { Card } from '@/components/ui/Card';
import {
  ETIKET,
  TUM_ACIKLAMA,
  farkCumlesi,
  puanBekleyenNotu,
  puanYazisi,
  type Ses,
} from '@/lib/ortalama-farki-metni';
import type { KendiKarnem } from '@/types/api';

/**
 * İKİ ORTALAMA (0080) — öğrenci ve veli karnesinde aynı kart.
 *
 * Öğretmenin isteği: öğrenci "ödevini yaparsa ortalamasının ne kadar
 * yükseleceğini" görsün. İki sayı yan yana, ikisi de etiketli; altında
 * aradaki farkı söyleyen cümle.
 *
 * YALNIZ ÇOCUĞUN KENDİSİ: sınıf ortalaması, sıralama yok — sunucudan da
 * gelmiyor (`kendi_karnem_testleri.sql` 3c).
 *
 * ESKİ SUNUCU: `tum_ortalama` gelmezse (0080 çalışmadı) kart çizilmiyor;
 * çağıran eski "Genel ortalaman" satırını gösteriyor.
 */
export function IkiOrtalamaKarti({ veri, ses }: { veri: KendiKarnem; ses: Ses }) {
  const o = {
    yapilan: veri.genel_ortalama ?? null,
    tum: veri.tum_ortalama ?? null,
    yapilmayan: veri.yapilmayan ?? 0,
    puanBekleyen: veri.puan_bekleyen ?? 0,
  };
  const cumle = farkCumlesi(o, ses);
  const not = puanBekleyenNotu(o.puanBekleyen, ses);
  const etiket = ETIKET[ses];

  return (
    <Card className="mb-3">
      <div className="grid grid-cols-2 gap-3">
        <p>
          <span className="block text-[13px] text-muted">{etiket.yapilan}</span>
          <span className="sk-sayi block text-[24px] font-bold text-ink">
            {o.yapilan === null ? '—' : puanYazisi(o.yapilan)}
          </span>
        </p>
        <p>
          <span className="block text-[13px] text-muted">{etiket.tum}</span>
          <span className="sk-sayi block text-[24px] font-bold text-ink">
            {o.tum === null ? '—' : puanYazisi(o.tum)}
          </span>
          <span className="block text-[12px] text-muted">{TUM_ACIKLAMA}</span>
        </p>
      </div>
      {cumle && <p className="mt-3 text-[14px] leading-snug text-ink">{cumle}</p>}
      {not && <p className="mt-2 text-[13px] leading-snug text-muted">{not}</p>}
    </Card>
  );
}
