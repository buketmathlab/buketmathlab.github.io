import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { KodKutusu } from '@/components/ui/KodKutusu';
import { useOturum } from '@/hooks/oturum-baglam';
import { yenilemeMetni, type YenilemeTuru } from '@/lib/kod-yenileme-metni';
import { rpc } from '@/services/supabase';
import type { KodYenileme } from '@/types/api';

/**
 * "Kodumu yenile" kartı — öğrenci ve veli panosunun altında.
 *
 * NEDEN SEKME DEĞİL, KART. Öğrenci kabuğunda 4, veli kabuğunda 5 sekme
 * var; altıncısı başparmak hedeflerini daraltırdı. Bu yılda bir, belki
 * hiç kullanılmayacak bir iş — panonun altında bir kart doğru yer.
 *
 * NEDEN PANONUN ALTINDA. Üstte olsaydı her gün açılan ekranın en görünür
 * yerini, en seyrek yapılan iş kaplardı. Aranınca bulunacak kadar
 * görünür, kazara basılmayacak kadar aşağıda.
 *
 * İKİ PENCERE, TEK İŞ:
 *
 *   ONAY — geri alınamaz işlemden ÖNCE ne olacağını söylüyor. Öğretmenin
 *   sorusu buydu: *"Kaydetmeleri gerektiğini hatırlatıyor değil mi?"*
 *
 *   SONUÇ — yeni kod, kapatılana kadar ekranda. Otomatik kapanan bir
 *   bildirim (toast) olsaydı, kodu not almaya fırsat bulamayan kişi onu
 *   bir daha göremezdi; uç mevcut kodu OKUMUYOR (0046 kararı), yani
 *   ekrandan kaçan kod bu oturumda geri gelmiyor.
 *
 * SUNUCUYA YALNIZ JETON GİDİYOR. Kimin kodu olduğu istemciden
 * söylenmiyor; sunucu oturumdan buluyor (`_oturum`). Öğrenci kimliğini
 * gövdeye koymak, onu değiştirmeyi denemeye davet olurdu.
 */
export function KodYenilemeKarti({ tur }: { tur: YenilemeTuru }) {
  const { oturum } = useOturum();
  const m = yenilemeMetni(tur);

  const [onayAcik, setOnayAcik] = useState(false);
  const [yeniKod, setYeniKod] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function yenile() {
    setYukleniyor(true);
    setHata(null);
    try {
      const y = await rpc<KodYenileme>('kendi_kodumu_yenile', { p_token: oturum?.token });
      setYeniKod(y.kod);
      setOnayAcik(false);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Kod yenilenemedi. Tekrar deneyin.');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <>
      <Card className="mt-6">
        <h2 className="text-[15px] font-bold text-ink">{m.baslik}</h2>
        <p className="mt-1 text-[13px] text-muted">{m.aciklama}</p>
        <p className="mt-1 text-[13px] text-muted">{m.onayUyarilari[0]}</p>
        <div className="mt-3">
          <Button tur="sade" olcu="sm" onClick={() => setOnayAcik(true)}>
            {m.dugme}
          </Button>
        </div>
        {hata && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {hata}
          </p>
        )}
      </Card>

      {/* ONAY — işlemden önce. */}
      <Dialog
        acik={onayAcik}
        onKapat={() => setOnayAcik(false)}
        baslik={m.onayBasligi}
        onayEtiketi={yukleniyor ? 'Yenileniyor…' : m.onayDugmesi}
        onayTuru="tehlike"
        onayYukleniyor={yukleniyor}
        onOnay={yenile}
      >
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink">
          {m.onayUyarilari.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </Dialog>

      {/* SONUÇ — kapatılana kadar ekranda.
          TEK DÜĞME, VE ADI "VAZGEÇ" DEĞİL. Bu pencere bir soru değil,
          bir sonuç: iş olmuş bitmiş. İki düğme (onayla/vazgeç) koymak
          ya da kapatana "Vazgeç" demek, kullanıcıya geri alabileceğini
          düşündürürdü — oysa eski kod çoktan öldü. */}
      <Dialog
        acik={yeniKod !== null}
        onKapat={() => setYeniKod(null)}
        baslik={m.sonucBasligi}
        kapatEtiketi={m.kapatDugmesi}
      >
        {yeniKod && (
          <div className="space-y-3">
            {/* Kutunun etiketi başlığı TEKRAR ETMİYOR: üstte zaten
                "Yeni kodun" yazıyor. Etiket bunun yerine kutunun ne
                işe yaradığını söylüyor — dokununca kopyalıyor. */}
            <KodKutusu etiket="Dokun, kopyalansın" kod={yeniKod} />
            <ul className="space-y-1 text-[13px] text-muted">
              {m.sonucNotlari.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </>
  );
}
