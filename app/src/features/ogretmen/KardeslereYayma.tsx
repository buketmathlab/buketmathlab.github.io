import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import type { KardesDetay, YaymaRaporu } from '@/types/api';

type Props = {
  odevId: string;
  /** Kaynak ödevin kendi sınıfı — listede "buradan yayılıyor" olarak yazılı. */
  kaynakSinif: string;
  kardesler: KardesDetay[];
  /** Yayma sonrası ekranın kendini tazelemesi için. */
  onYayildi: () => void;
};

/**
 * Düzeltmeyi kardeş ödevlere yayma (0031).
 *
 * 0030 aynı ödevi birden çok sınıfa vermeyi getirdi ama kopyalar BAĞIMSIZ:
 * her birinin kendi `cevap_anahtari`'sı var. Öğretmen 10V'de bir anahtar
 * hatasını düzeltince 10U ve 10W'de YANLIŞ NOTLAR SESSİZCE KALIYORDU.
 * Bu kart o sessizliği kaldırıyor.
 *
 * ÜÇ KARAR EKRANDA GÖRÜNÜR:
 *
 * 1. **Otomatik yayma yok.** Öğretmen onaylamadan başka sınıfın notu
 *    değişmiyor; düğme ayrıca bir onay diyaloğu açıyor. Sessiz not
 *    değişikliği bu üründe kabul edilemez.
 * 2. **Taşınmayanlar yazılı.** Son tarih, geç teslim ve yayında olma
 *    taşınmıyor — her sınıfın kendi programı var. Kural sunucuda
 *    zorlanıyor (0031 kendi denetimi), burada yalnız SÖYLENİYOR.
 * 3. **Arşivdeki sınıf atlanıyor** ve raporda ayrıca yazılıyor (0016).
 *    Görünmeyen bir sınıfın notunu sessizce değiştirmek o kuralı delerdi.
 */
export function KardeslereYayma({ odevId, kaynakSinif, kardesler, onYayildi }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [onayAcik, setOnayAcik] = useState(false);
  const [yayiyor, setYayiyor] = useState(false);
  const [rapor, setRapor] = useState<YaymaRaporu[] | null>(null);

  // Yayılabilecek kardeşler = arşivde OLMAYANLAR. Hepsi arşivdeyse yayacak
  // bir şey yok; düğme çıkmıyor ama sınıflar yine listeleniyor.
  const yayilabilir = kardesler.filter((k) => !k.arsiv);
  const ayrisan = yayilabilir.filter((k) => !k.anahtar_ayni);

  async function yay() {
    setYayiyor(true);
    try {
      const sonuc = await rpc<YaymaRaporu[]>('odev_kardeslere_yay', {
        p_token: oturum?.token,
        p_id: odevId,
      });
      setRapor(sonuc);
      const degisen = sonuc.reduce((t, s) => t + s.yeniden_puanlanan.length, 0);
      bildir(
        degisen > 0
          ? `Yayıldı — ${degisen} öğrencinin puanı yeniden hesaplandı`
          : 'Yayıldı — hiçbir öğrencinin puanı değişmedi',
        'basari',
      );
      setOnayAcik(false);
      onYayildi();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Yayılamadı.', 'hata');
    } finally {
      setYayiyor(false);
    }
  }

  return (
    <>
      {rapor && (
        <Card vurgu="uyari" className="mb-4">
          <p className="mb-3 font-semibold text-ink">Düzeltme kardeş sınıflara uygulandı</p>
          <ul className="space-y-3">
            {rapor.map((s) => (
              <li key={s.odev_id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <p className="text-[15px] font-semibold text-ink">{s.sinif}</p>
                {s.atlandi === 'arsiv' ? (
                  <p className="mt-1 text-[14px] text-muted">
                    Atlandı — bu sınıf arşivde. Notlarına dokunulmadı.
                  </p>
                ) : s.yeniden_puanlanan.length === 0 ? (
                  <p className="mt-1 text-[14px] text-muted">
                    İçerik güncellendi; hiçbir öğrencinin puanı değişmedi.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {s.yeniden_puanlanan.map((d) => (
                      <li key={d.ogrenci} className="text-[14px] text-ink">
                        {d.ogrenci}:{' '}
                        <span className="sk-sayi text-muted">{d.eski_puan ?? '—'}</span>
                        {' → '}
                        <span className="sk-sayi font-semibold">{d.yeni_puan}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">
            Bu değişiklikler denetim izine kaydedildi.
          </p>
        </Card>
      )}

      <Card vurgu="uyari" className="mb-4">
        <p className="text-[15px] text-ink">
          Bu ödev <strong>{[kaynakSinif, ...kardesler.map((k) => k.sinif)].join(', ')}</strong>{' '}
          sınıflarına birlikte verildi. Kaydettiğiniz değişiklik yalnız{' '}
          <strong>{kaynakSinif}</strong> sınıfını etkiledi.
        </p>

        <ul className="mt-3 space-y-2">
          {kardesler.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{k.sinif}</span>
              <span className="sk-sayi text-[14px] text-muted">
                {`${k.gonderim_sayisi} gönderim`}
              </span>
              {k.arsiv ? (
                <Tag tur="notr">Arşivde — atlanacak</Tag>
              ) : k.anahtar_ayni ? (
                <Tag tur="basari">Anahtar aynı</Tag>
              ) : (
                <Tag tur="uyari">Anahtar farklı</Tag>
              )}
            </li>
          ))}
        </ul>

        {yayilabilir.length > 0 && (
          <>
            <p className="mt-3 text-[14px] text-muted">
              {ayrisan.length > 0
                ? `${ayrisan.length} sınıfın cevap anahtarı buradakinden farklı. Yayarsanız o sınıfların gönderimleri yeniden puanlanır.`
                : 'Cevap anahtarları şu an aynı. Yaymak başlık, açıklama, konular ve PDF’leri de eşitler.'}
            </p>
            <div className="mt-3">
              <Button tur="ikincil" onClick={() => setOnayAcik(true)}>
                {`Bu düzeltmeyi ${yayilabilir.map((k) => k.sinif).join(' ve ')} sınıfına da uygula`}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Dialog
        acik={onayAcik}
        onKapat={() => setOnayAcik(false)}
        baslik="Başka sınıfların notları değişecek"
        aciklama={`${yayilabilir.map((k) => k.sinif).join(', ')} sınıflarındaki ödevin içeriği bu ödevle eşitlenecek ve gönderimler yeniden puanlanacak. Bu işlem geri alınamaz.`}
        onayEtiketi="Uygula"
        onOnay={() => void yay()}
        onayYukleniyor={yayiyor}
      >
        <p className="text-[14px] text-ink">Taşınacaklar: başlık, açıklama, cevap anahtarı, soru ve şık sayısı, konular, iki PDF.</p>
        <p className="mt-2 text-[14px] text-muted">
          <strong>Taşınmayacaklar:</strong> son tarih, geç teslim izni ve yayında olma
          durumu. Her sınıfın kendi programı korunuyor.
        </p>
      </Dialog>
    </>
  );
}
