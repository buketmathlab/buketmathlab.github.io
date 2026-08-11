import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { useOturum } from '@/hooks/oturum-baglam';
import { cn } from '@/lib/cn';

type Sekme = { yol: string; etiket: string; ikon: ReactElement };

/** İkonlar kendi setimiz — ikon paketi bağımlılığı eklemiyoruz. */
const ikon = {
  pano: (
    <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" />
  ),
  sinif: (
    <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3ZM6 13.2V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" />
  ),
  ogrenci: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4.5V21h16v-2.5C20 16 16 14 12 14Z" />
  ),
  odev: (
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z" />
  ),
};

const SEKMELER: Sekme[] = [
  {
    yol: '/ogretmen',
    etiket: 'Pano',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.pano}</svg>,
  },
  {
    yol: '/ogretmen/siniflar',
    etiket: 'Sınıflar',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.sinif}</svg>,
  },
  {
    yol: '/ogretmen/odevler',
    etiket: 'Ödevler',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.odev}</svg>,
  },
  {
    yol: '/ogretmen/ogrenciler',
    etiket: 'Öğrenciler',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.ogrenci}</svg>,
  },
];

/**
 * Öğretmen kabuğu.
 *
 * Mobilde altta sekme çubuğu, `lg` üstünde solda yan menü. Bu bir
 * "küçültülmüş masaüstü" değil: mobilde başparmağın ulaştığı yerde
 * gezinme, geniş ekranda yatay alanı kullanan kalıcı menü.
 */
export function Kabuk() {
  const { cikisYap } = useOturum();

  return (
    <div className="min-h-dvh lg:flex">
      {/* Yan menü — yalnız geniş ekran */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface p-4 lg:flex lg:flex-col">
        <div className="mb-8">
          <SekizWordmark boyut="sm" />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Ana gezinme">
          {SEKMELER.map((s) => (
            <NavLink
              key={s.yol}
              to={s.yol}
              end={s.yol === '/ogretmen'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] items-center gap-3 rounded-sk-sm px-3 text-[15px] font-semibold',
                  isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-line-soft',
                )
              }
            >
              <span className="size-5">{s.ikon}</span>
              {s.etiket}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <Button tur="sade" olcu="sm" tamGenislik onClick={cikisYap}>
            Çıkış
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Üst çubuk — yalnız dar ekran */}
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <SekizWordmark bicim="sade" boyut="sm" />
          <Button tur="sade" olcu="sm" onClick={cikisYap}>
            Çıkış
          </Button>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
          <Outlet />
        </main>

        {/* Alt sekme çubuğu — yalnız dar ekran */}
        <nav
          aria-label="Ana gezinme"
          className="sk-alt-guvenli fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface lg:hidden"
        >
          {SEKMELER.map((s) => (
            <NavLink
              key={s.yol}
              to={s.yol}
              end={s.yol === '/ogretmen'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold',
                  isActive ? 'text-ink' : 'text-muted',
                )
              }
            >
              <span className="size-5">{s.ikon}</span>
              {s.etiket}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Sayfa başlığı — ekranlar arasında tutarlı üst blok. */
export function SayfaBasligi({
  baslik,
  aciklama,
  eylem,
}: {
  baslik: string;
  aciklama?: string;
  eylem?: ReactElement;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[24px] text-ink">{baslik}</h1>
        {aciklama && <p className="mt-1 text-[14px] text-muted">{aciklama}</p>}
      </div>
      {eylem}
    </div>
  );
}
