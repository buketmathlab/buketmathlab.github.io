import type { ReactNode } from 'react';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { KartIskeleti } from './Skeleton';
import { Button } from './Button';

/**
 * BOŞ DURUM.
 *
 * Ewalu burada işlevseldir: "hiçbir şey yok" ekranı, ürünün en soğuk anıdır;
 * karakter bu anı insanileştirir ve kullanıcıya ne yapacağını söyler.
 */
export function EmptyState({
  baslik,
  aciklama,
  eylem,
  poz = 'kesif',
}: {
  baslik: string;
  aciklama?: string;
  eylem?: ReactNode;
  poz?: 'kesif' | 'kutlama' | 'calisma' | 'karsilama';
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <EwaluFigure poz={poz} boyut={96} dekoratif />
      <h3 className="mt-4 text-[18px] font-semibold text-ink">{baslik}</h3>
      {aciklama && <p className="mt-1 max-w-sm text-[14px] text-muted">{aciklama}</p>}
      {eylem && <div className="mt-5">{eylem}</div>}
    </div>
  );
}

/**
 * HATA DURUMU.
 *
 * Part XLI: mesaj Türkçe, insan tarafından okunabilir ve EYLEME DÖNÜK olmalı.
 * "Bir şeyler ters gitti" yasak. Teknik yığın izi kullanıcıya gösterilmez.
 */
export function ErrorState({
  baslik = 'Bu bölüm yüklenemedi',
  aciklama = 'İnternet bağlantınızı kontrol edip tekrar deneyin.',
  tekrarDene,
}: {
  baslik?: string;
  aciklama?: string;
  tekrarDene?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <h3 className="text-[18px] font-semibold text-ink">{baslik}</h3>
      <p className="mt-1 max-w-sm text-[14px] text-muted">{aciklama}</p>
      {tekrarDene && (
        <Button tur="sade" className="mt-5" onClick={tekrarDene}>
          Tekrar dene
        </Button>
      )}
    </div>
  );
}

/** YÜKLENİYOR DURUMU. */
export function LoadingState({
  metin = 'Yükleniyor',
  adet = 3,
}: {
  metin?: string;
  adet?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sk-gizli-metin">{metin}</span>
      <KartIskeleti adet={adet} />
    </div>
  );
}

type AsyncDurum = 'yukleniyor' | 'hata' | 'bos' | 'hazir';

/**
 * Veri gösteren her ekranın dört durumu da ele almasını YAPISAL olarak
 * zorunlu kılar (Part XLI). Geliştirici "boş durumu unutmuş" olamaz, çünkü
 * `bos` bir tip üyesi ve ele alınması gerekiyor.
 */
export function AsyncBoundary({
  durum,
  bosBaslik,
  bosAciklama,
  bosEylem,
  hataAciklama,
  tekrarDene,
  yuklemeAdedi,
  children,
}: {
  durum: AsyncDurum;
  bosBaslik: string;
  bosAciklama?: string;
  bosEylem?: ReactNode;
  hataAciklama?: string;
  tekrarDene?: () => void;
  yuklemeAdedi?: number;
  children: ReactNode;
}) {
  if (durum === 'yukleniyor') {
    return <LoadingState {...(yuklemeAdedi !== undefined ? { adet: yuklemeAdedi } : {})} />;
  }
  if (durum === 'hata') {
    return (
      <ErrorState
        {...(hataAciklama ? { aciklama: hataAciklama } : {})}
        {...(tekrarDene ? { tekrarDene } : {})}
      />
    );
  }
  if (durum === 'bos') {
    return (
      <EmptyState
        baslik={bosBaslik}
        {...(bosAciklama ? { aciklama: bosAciklama } : {})}
        {...(bosEylem ? { eylem: bosEylem } : {})}
      />
    );
  }
  return <>{children}</>;
}
