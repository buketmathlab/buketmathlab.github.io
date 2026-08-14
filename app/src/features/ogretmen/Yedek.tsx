import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import {
  yedekDosyaAdi,
  yedekGecerliMi,
  yedekOzeti,
  yedekTazelik,
  yedekYasiGun,
  type YedekOzeti,
} from '@/lib/yedek';

const SON_YEDEK_ANAHTARI = 'sekiz_son_yedek';

function sonYedekOku(): number | null {
  try {
    const h = localStorage.getItem(SON_YEDEK_ANAHTARI);
    return h === null ? null : Number(h);
  } catch {
    // Gizli sekmede localStorage yazılamayabilir. Yedek almayı engellememeli.
    return null;
  }
}

/**
 * Yedeği indirme.
 *
 * NEDEN BU EKRAN VAR: bu ürün bir kez canlı veritabanının tamamını
 * kaybetti — öğrenciler, kodlar, ödevler, notlar. `disa_aktar` o olaydan
 * sonra sunucuda yazıldı ve yetkisi verildi, ama arayüzde HİÇ çağrılmadı.
 * Yani yedek alma imkânı vardı, düğmesi yoktu.
 *
 * DOSYA SİSTEMİN KENDİSİ KADAR HASSAS: içinde öğrenci ve veli giriş
 * kodları ile cevap anahtarları var. Bu ekran bunu saklamıyor, açıkça
 * yazıyor — dosyayı bir veliye iletmek cevap anahtarını iletmek olurdu
 * (Kural 6).
 *
 * NE İÇERMEDİĞİ DE YAZIYOR: çözüm fotoğrafları ve PDF'ler Supabase
 * Storage'da duruyor, JSON'da yalnız yolları var. Yedeği "her şey burada"
 * diye sunmak, felaket anında yanlış güvenlik duygusu olurdu (Kural 15).
 */
export function Yedek() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const [aliniyor, setAliniyor] = useState(false);
  const [sonYedek, setSonYedek] = useState<number | null>(() => sonYedekOku());
  const [ozet, setOzet] = useState<YedekOzeti | null>(null);

  const tazelik = yedekTazelik(yedekYasiGun(sonYedek));

  async function indir() {
    setAliniyor(true);
    setOzet(null);
    try {
      const veri = await rpc<unknown>('disa_aktar', { p_token: oturum?.token });

      // ÖNCE DENETLE, SONRA İNDİR. Boş ya da eksik bir yanıtı dosya diye
      // kaydetmek, öğretmene işe yaramaz bir dosyayı yedek sandırırdı ve
      // bu ancak felaket anında anlaşılırdı — yani her zaman çok geç.
      if (!yedekGecerliMi(veri)) {
        throw new Error('Sunucudan beklenen yedek yapısı gelmedi. Yedek kaydedilmedi.');
      }

      const ad = yedekDosyaAdi();
      const blob = new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ad;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Bellek sızıntısını önlemek için serbest bırakılıyor; iOS'ta
      // indirme başlamadan iptal etmemek için bir sonraki tik'e bırakıldı.
      setTimeout(() => URL.revokeObjectURL(url), 0);

      const simdi = Date.now();
      try {
        localStorage.setItem(SON_YEDEK_ANAHTARI, String(simdi));
      } catch {
        // Yazılamazsa tazelik bilgisi kaybolur, yedeğin kendisi değil.
      }
      setSonYedek(simdi);
      setOzet(yedekOzeti(veri));
      bildir(`Yedek indirildi: ${ad}`, 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Yedek alınamadı.', 'hata');
    } finally {
      setAliniyor(false);
    }
  }

  return (
    <Card vurgu={tazelik.uyar ? 'uyari' : 'yok'}>
      <h2 className="mb-1 text-[18px] text-ink">Yedek</h2>
      <p className="mb-3 text-[14px] text-muted">{tazelik.metin}</p>

      <Button onClick={indir} yukleniyor={aliniyor} yuklenmeMetni="Hazırlanıyor">
        Yedeği indir
      </Button>

      {ozet && (
        <p className="mt-3 text-[13px] text-ink">
          Dosyaya yazıldı:{' '}
          <span className="sk-sayi font-semibold">{ozet.ogrenci}</span> öğrenci ·{' '}
          <span className="sk-sayi font-semibold">{ozet.kod}</span> kod ·{' '}
          <span className="sk-sayi font-semibold">{ozet.odev}</span> ödev ·{' '}
          <span className="sk-sayi font-semibold">{ozet.gonderim}</span> gönderim ·{' '}
          <span className="sk-sayi font-semibold">{ozet.mesaj}</span> mesaj
        </p>
      )}

      <div className="mt-4 rounded-sk-sm bg-warning-bg p-3">
        <p className="text-[13px] text-warning">
          <strong>Bu dosya sistemin kendisi kadar hassastır.</strong> İçinde öğrenci ve veli
          giriş kodları ile cevap anahtarları var. Kimseyle paylaşmayın; bir veliye iletmek
          cevap anahtarını iletmek olur.
        </p>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Dosyada <strong>kayıtlar</strong> var: öğrenciler, kodlar, sınıflar, ödevler, cevap
        anahtarları, gönderimler, puanlar, mesajlar, dersler ve ödemeler.{' '}
        <strong>Dosyalar yok</strong> — çözüm fotoğrafları ve PDF'ler Supabase Storage'da
        duruyor, burada yalnız adresleri var. PIN'iniz de yedeğe girmiyor; geri yüklemeden
        sonra yeniden belirlersiniz.
      </p>
    </Card>
  );
}
