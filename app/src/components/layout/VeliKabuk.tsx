import { Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { SekmeCubugu, type SekmeTanim } from '@/components/layout/SekmeCubugu';
import { SEKME_IKON } from '@/components/layout/sekme-ikonlari';
import { useKendiOzet } from '@/hooks/useKendiOzet';
import { useOturum } from '@/hooks/oturum-baglam';

/**
 * Veli kabuğu.
 *
 * Öğrenci kabuğuyla aynı yapı, tek farkla: başlıkta çocuğun adının yanında
 * **"velisi"** yazıyor. Ortak bir cihazda veli ve öğrenci aynı adı görüyor;
 * hangi hesapta olduğunu bilmeden mesaj yazmak yanlış yere gider — ve
 * 0025'ten sonra bu iki AYRI yazışma demek.
 *
 * ÖDEMELER SEKMESİ YALNIZ ÖZEL DERSTE. Okul velisinde sekme hiç
 * çizilmiyor: okul öğrencisinde ödeme kavramı yok ve boş bir "Ödemeler"
 * sekmesi göstermek, veli panelinde bir kez yaptığımız hatanın aynısı
 * olurdu. Sekmenin çıkmaması bir GÖRÜNÜRLÜK tercihi; asıl sınır sunucuda:
 * `veli_paneli` okul öğrencisinde `odemeler` dizisini boş döndürüyor.
 */
export function VeliKabuk() {
  const { oturum, cikisYap } = useOturum();
  const ogrenci = oturum?.ogrenci;
  const ozet = useKendiOzet('veli_paneli');

  const sekmeler: SekmeTanim[] = [
    { yol: '/veli', etiket: 'Pano', ikon: SEKME_IKON.pano, sonu: true },
    { yol: '/veli/odevler', etiket: 'Ödevler', ikon: SEKME_IKON.odev },
    { yol: '/veli/konular', etiket: 'Konular', ikon: SEKME_IKON.karne },
    ...(ozet.tur === 'ozel'
      ? [
          {
            yol: '/veli/odemeler',
            etiket: 'Ödemeler',
            ikon: SEKME_IKON.odeme,
          },
        ]
      : []),
    {
      yol: '/veli/mesajlar',
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
          <SekizWordmark boyut="sm" bicim="sade" />
          <div className="flex min-w-0 items-center gap-3">
            {ogrenci && (
              <p className="min-w-0 text-right text-[13px] leading-tight">
                <span className="block font-semibold text-ink">{ogrenci.ad}</span>
                <span className="block text-muted">
                  {ogrenci.sinif ? `${ogrenci.sinif} · velisi` : 'velisi'}
                </span>
              </p>
            )}
            <Button tur="sade" olcu="sm" onClick={cikisYap}>
              Çıkış
            </Button>
          </div>
        </div>
      </header>

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
