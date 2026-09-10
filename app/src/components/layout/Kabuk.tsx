import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { Button } from '@/components/ui/Button';
import { SekmeCubugu, type SekmeTanim } from '@/components/layout/SekmeCubugu';
import { SEKME_IKON } from '@/components/layout/sekme-ikonlari';
import { VekaletSeridi } from '@/components/layout/VekaletSeridi';
import { useBenKimim } from '@/hooks/useBenKimim';
import { useBildirimler } from '@/hooks/useBildirimler';
import { useOturum } from '@/hooks/oturum-baglam';
import { cn } from '@/lib/cn';

/**
 * Öğretmen kabuğu.
 *
 * Mobilde altta sekme çubuğu, `lg` üstünde solda yan menü. Bu bir
 * "küçültülmüş masaüstü" değil: mobilde başparmağın ulaştığı yerde
 * gezinme, geniş ekranda yatay alanı kullanan kalıcı menü.
 *
 * Sekme çubuğunun kendisi `SekmeCubugu`'na taşındı (0025); GÖRÜNÜM
 * DEĞİŞMEDİ, yalnız öğrenci ve veli kabukları da aynı parçayı kullanıyor.
 */
export function Kabuk() {
  const { cikisYap } = useOturum();
  const bildirim = useBildirimler();
  const { ben } = useBenKimim();

  const sekmeler: SekmeTanim[] = [
    {
      yol: '/ogretmen',
      etiket: 'Pano',
      ikon: SEKME_IKON.pano,
      sonu: true,
    },
    { yol: '/ogretmen/siniflar', etiket: 'Sınıflar', ikon: SEKME_IKON.sinif },
    {
      yol: '/ogretmen/odevler',
      etiket: 'Ödevler',
      ikon: SEKME_IKON.odev,
      rozet: bildirim.puan_bekleyen,
      rozetAdi: (n) => `${n} gönderim puan bekliyor`,
    },
    {
      yol: '/ogretmen/ogrenciler',
      etiket: 'Öğrenciler',
      ikon: SEKME_IKON.ogrenci,
      // ÖĞRENCİ YAZIŞMALARI BU SEKMEDE (öğretmenin kararı, 0025). Rozet
      // hâlâ TEK: iki ayrı sayı öğretmene iki ayrı yer aratırdı. Sekmenin
      // içi hangisinin beklediğini zaten söylüyor.
      rozet: bildirim.okunmamis_mesaj,
      rozetAdi: (n) => `${n} okunmamış mesaj`,
    },
    {
      yol: '/ogretmen/veliler',
      etiket: 'Veliler',
      ikon: SEKME_IKON.veli,
      rozet: bildirim.okunmamis_mesaj,
      rozetAdi: (n) => `${n} okunmamış mesaj`,
    },
    { yol: '/ogretmen/kodlar', etiket: 'Kodlar', ikon: SEKME_IKON.kod },
  ];

  return (
    <div className="min-h-dvh lg:flex">
      {/* Yan menü — yalnız geniş ekran */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface p-4 lg:flex lg:flex-col">
        <div className="mb-8">
          <SekizWordmark boyut="sm" />
        </div>
        <SekmeCubugu sekmeler={sekmeler} bicim="yan" />
        {/* Ayarlar SEKME DEĞİL, alt bağlantı. Menü zaten altı sekme;
            yedincisi 360 px'de alt çubuğa sığmıyor (ölçüldü). PIN
            değiştirmek de nadir ve kasıtlı bir iş — her gün görünmesi
            gereken bir şey değil. Dar ekranda yan menü gizli olduğu için
            aynı yere Pano'nun altından da geliniyor. */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {/* ÖĞRETMENLER SEKME DEĞİL, alt bağlantı — ve yalnız sahipte.
              Menü zaten altı sekme; yedincisi 360 px'de alt çubuğa
              sığmıyor (ölçüldü). Öğretmen yönetimi de nadir bir iş. */}
          {ben?.sahip && (
            <NavLink
              to="/ogretmen/ogretmenler"
              className={({ isActive }) =>
                cn(
                  // 44 px: yan menü bağlantıları 38 px'di ve dokunma hedefi
                  // sınırının altında kalıyordu. `lg` bir "fare ekranı"
                  // demek değil — dokunmatik dizüstü ve yatay tablet de bu
                  // genişlikte. Kabuk denetimi 6. grupta ölçüldü.
                  'flex min-h-[44px] items-center rounded-sk-sm px-3 text-[14px] text-muted hover:bg-line-soft',
                  isActive && 'bg-line-soft font-semibold text-ink',
                )
              }
            >
              Öğretmenler
            </NavLink>
          )}
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
        {/* VEKÂLET ŞERİDİ — her genişlikte, içeriğin en üstünde ve
            kapatılamaz. Sahip hangi hesapta olduğunu unutursa yanlış
            sınıfa ödev verir. */}
        <VekaletSeridi ben={ben} />

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
        <SekmeCubugu sekmeler={sekmeler} bicim="alt" className="lg:hidden" />
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
