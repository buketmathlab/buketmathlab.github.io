import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { Rozet } from '@/components/ui/Rozet';
import { useBildirimler } from '@/hooks/useBildirimler';
import { useOturum } from '@/hooks/oturum-baglam';
import { cn } from '@/lib/cn';

type Sekme = {
  yol: string;
  etiket: string;
  ikon: ReactElement;
  /** Rozet sayısını hangi bildirim alanından alacağı. */
  rozet?: 'okunmamis_mesaj' | 'puan_bekleyen';
  /** Ekran okuyucuya okunacak sayı açıklaması: "3 okunmamış mesaj". */
  rozetAdi?: (n: number) => string;
};

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
  veli: (
    <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-6 1.3-6 3.5V19h8v-2.5c0-.9.5-1.7 1.3-2.4A9.7 9.7 0 0 0 8 13Zm8 0c-.6 0-1.3.1-2 .2 1.2.8 2 1.8 2 3.3V19h6v-2.5c0-2.2-3.3-3.5-6-3.5Z" />
  ),
  // Anahtar: kod bir şifredir, ikon da bunu söylesin.
  kod: (
    <path d="M14 2a6 6 0 0 0-5.7 7.9L2 16.2V22h5.8l1.4-1.4v-2h2v-2h2l1.3-1.3A6 6 0 1 0 14 2Zm2.5 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
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
    rozet: 'puan_bekleyen',
    rozetAdi: (n) => `${n} gönderim puan bekliyor`,
  },
  {
    yol: '/ogretmen/ogrenciler',
    etiket: 'Öğrenciler',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.ogrenci}</svg>,
  },
  {
    yol: '/ogretmen/veliler',
    etiket: 'Veliler',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.veli}</svg>,
    rozet: 'okunmamis_mesaj',
    rozetAdi: (n) => `${n} okunmamış mesaj`,
  },
  {
    yol: '/ogretmen/kodlar',
    etiket: 'Kodlar',
    ikon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ikon.kod}</svg>,
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
  const bildirim = useBildirimler();

  /** Sekmenin rozet sayısı; rozeti olmayan sekmede 0. */
  const sayi = (s: Sekme) => (s.rozet ? bildirim[s.rozet] : 0);

  /**
   * Ekran okuyucu için sekme adı. Rozet `aria-hidden`; sayı BURADA
   * geçmezse klavye/ekran okuyucu kullanan biri bekleyen işi hiç duymaz.
   */
  const etiketAdi = (s: Sekme) => {
    const n = sayi(s);
    return n > 0 && s.rozetAdi ? `${s.etiket}, ${s.rozetAdi(n)}` : undefined;
  };

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
              aria-label={etiketAdi(s)}
            >
              <span className="size-5">{s.ikon}</span>
              <span className="flex-1">{s.etiket}</span>
              <Rozet sayi={sayi(s)} />
            </NavLink>
          ))}
        </nav>
        {/* Ayarlar SEKME DEĞİL, alt bağlantı. Menü zaten altı sekme;
            yedincisi 360 px'de alt çubuğa sığmıyor (ölçüldü). PIN
            değiştirmek de nadir ve kasıtlı bir iş — her gün görünmesi
            gereken bir şey değil. Dar ekranda yan menü gizli olduğu için
            aynı yere Pano'nun altından da geliniyor. */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <NavLink
            to="/ogretmen/ayarlar"
            className={({ isActive }) =>
              cn(
                'rounded-sk-sm px-3 py-2 text-[14px] text-muted hover:bg-line-soft',
                isActive && 'bg-line-soft font-semibold text-ink',
              )
            }
          >
            Ayarlar
          </NavLink>
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
              aria-label={etiketAdi(s)}
            >
              {/* Rozet ikonun sağ üstünde. Alt çubuk dikey (ikon üstte,
                  etiket altta); rozeti kardeş öğe olarak koymak onu
                  etiketin ALTINA düşürüyordu. */}
              <span className="relative size-5">
                {s.ikon}
                {sayi(s) > 0 && (
                  <span className="absolute -right-2.5 -top-1.5">
                    <Rozet sayi={sayi(s)} />
                  </span>
                )}
              </span>
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
