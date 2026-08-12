import { Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { useOturum } from '@/hooks/oturum-baglam';

/**
 * Öğrenci kabuğu.
 *
 * Öğretmen kabuğundan bilinçli olarak FARKLI: sekme çubuğu yok. Öğrencinin
 * tek bir işi var — ödevlerini görmek ve göndermek. Tek bölümlü bir ürüne
 * gezinme çubuğu koymak boş yer kaplar ve önemli olanı aşağı iter.
 *
 * Üstte kim olduğu yazıyor: ortak bir tablette birden fazla öğrenci giriş
 * yapabilir; yanlış hesapla ödev göndermek geri alınamaz (mükerrer teslim
 * engelli).
 */
export function OgrenciKabuk() {
  const { oturum, cikisYap } = useOturum();
  const ogrenci = oturum?.ogrenci;

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

      <main className="mx-auto w-full max-w-[880px] px-4 py-6 sk-alt-guvenli">
        <Outlet />
      </main>
    </div>
  );
}
