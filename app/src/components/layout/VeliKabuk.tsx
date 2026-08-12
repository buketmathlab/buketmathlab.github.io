import { Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { useOturum } from '@/hooks/oturum-baglam';

/**
 * Veli kabuğu.
 *
 * Öğrenci kabuğuyla aynı yapı, tek farkla: başlıkta çocuğun adının yanında
 * **"velisi"** yazıyor. Ortak bir cihazda veli ve öğrenci aynı adı görüyor;
 * hangi hesapta olduğunu bilmeden mesaj yazmak yanlış yere gider.
 *
 * Sekme çubuğu yok — velinin tek bir ekranı var. Tek bölümlü bir ürüne
 * gezinme çubuğu koymak boş yer kaplar.
 */
export function VeliKabuk() {
  const { oturum, cikisYap } = useOturum();
  const ogrenci = oturum?.ogrenci;

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

      <main className="sk-alt-guvenli mx-auto w-full max-w-[880px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
