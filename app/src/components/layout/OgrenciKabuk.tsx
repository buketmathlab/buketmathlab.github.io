import { Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { SekmeCubugu, type SekmeTanim } from '@/components/layout/SekmeCubugu';
import { SEKME_IKON } from '@/components/layout/sekme-ikonlari';
import { useKendiOzet } from '@/hooks/useKendiOzet';
import { useOturum } from '@/hooks/oturum-baglam';

/**
 * Öğrenci kabuğu.
 *
 * 0025'E KADAR SEKME ÇUBUĞU YOKTU ve bu dosyanın eski yorumu bunu
 * gerekçelendiriyordu: "öğrencinin tek bir işi var". O gerekçe artık
 * geçerli değil — öğretmenin kararıyla öğrenci de öğretmeniyle
 * yazışabiliyor, yani öğrencinin üç işi var: durumuna bakmak, ödevini
 * göndermek, öğretmenine yazmak. Üçünü tek sayfada alt alta dizmek
 * telefonda uzun bir kaydırma demek olurdu.
 *
 * Üstte kim olduğu yazıyor: ortak bir tablette birden fazla öğrenci giriş
 * yapabilir; yanlış hesapla ödev göndermek geri alınamaz (mükerrer teslim
 * engelli).
 */
export function OgrenciKabuk() {
  const { oturum, cikisYap } = useOturum();
  const ogrenci = oturum?.ogrenci;
  const ozet = useKendiOzet('ogrenci_odevleri');

  const sekmeler: SekmeTanim[] = [
    { yol: '/ogrenci', etiket: 'Pano', ikon: SEKME_IKON.pano, sonu: true },
    { yol: '/ogrenci/odevler', etiket: 'Ödevler', ikon: SEKME_IKON.odev },
    {
      yol: '/ogrenci/mesajlar',
      etiket: 'Mesajlar',
      ikon: SEKME_IKON.mesaj,
      rozet: ozet.okunmamis_mesaj,
      rozetAdi: (n) => `${n} okunmamış mesaj`,
    },
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3 px-4 py-3">
          {/* Öğretmen imzası bilinçli olarak YOK (`bicim="sade"`): 360 px'de
              "Buket Topuzoğlu · Matematik" satırı öğrencinin adını kesilmeye
              zorluyordu. Öğrenci zaten öğretmeninin kim olduğunu biliyor;
              burada kritik olan HANGİ ÖĞRENCİ olduğu — ortak bir tablette
              yanlış hesapla gönderilen ödev geri alınamaz. */}
          <SekizWordmark boyut="sm" bicim="sade" />
          <div className="flex min-w-0 items-center gap-3">
            {ogrenci && (
              <p className="min-w-0 text-right text-[13px] leading-tight">
                <span className="block font-semibold text-ink">{ogrenci.ad}</span>
                {ogrenci.sinif && <span className="block text-muted">{ogrenci.sinif}</span>}
              </p>
            )}
            <Button tur="sade" olcu="sm" onClick={cikisYap}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      {/* Geniş ekranda yatay sekme satırı. Öğretmendeki gibi YAN MENÜ
          değil: öğrenci düzeni ortalanmış 880 px'lik tek sütun, sol menü
          o sütunu kenara iterdi ve üç sekme için koca bir kenar çubuğu
          boş yer kaplardı. */}
      <div className="mx-auto hidden w-full max-w-[880px] px-4 lg:block">
        <SekmeCubugu sekmeler={sekmeler} bicim="yatay" />
      </div>

      <main className="sk-alt-guvenli mx-auto w-full max-w-[880px] px-4 pb-28 pt-6 lg:pb-10">
        <Outlet />
      </main>

      <SekmeCubugu sekmeler={sekmeler} bicim="alt" className="lg:hidden" />
    </div>
  );
}
