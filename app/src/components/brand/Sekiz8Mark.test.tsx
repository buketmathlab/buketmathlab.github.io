import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Sekiz8Mark } from './Sekiz8Mark';
import { matchMediaAyarla } from '@/test/setup';

function donusAcisi(kap: HTMLElement): string {
  const g = kap.querySelector('g');
  return g?.getAttribute('style') ?? '';
}

describe('Sekiz8Mark', () => {
  it('varsayılan olarak 8 çizer (dönüş yok)', () => {
    const { container } = render(<Sekiz8Mark />);
    expect(donusAcisi(container)).toContain('rotate(0deg)');
  });

  it('sonsuz istendiğinde 90 derece döner', () => {
    const { container } = render(<Sekiz8Mark sonsuz />);
    expect(donusAcisi(container)).toContain('rotate(90deg)');
  });

  it('açılışta dönüşüm istendiğinde 8’den ∞’a geçer', async () => {
    const { container } = render(<Sekiz8Mark acilistaDonsun gecikme={0} />);
    await waitFor(() => expect(donusAcisi(container)).toContain('rotate(90deg)'));
  });

  it('hareket azaltma açıkken hiç animasyon kurmaz, doğrudan ∞ çizer', () => {
    // Erişilebilirlik sözleşmesi: aynı anlam, hareketsiz (Part XXXIV).
    matchMediaAyarla(true);
    const { container } = render(<Sekiz8Mark acilistaDonsun />);
    const stil = donusAcisi(container);
    expect(stil).toContain('rotate(90deg)');
    expect(stil).toContain('transition: none');
  });

  /**
   * GÖRÜNÜNCE DÖNME — iki yol da ölçülüyor.
   *
   * Ölçülen kusur şuydu: sayfanın altındaki işaret `acilistaDonsun` ile
   * sayfa YÜKLENİRKEN dönüyor, okuyucu oraya kaydırdığında hareket
   * çoktan bitmiş oluyordu. Yani dönüş hiç görülmüyordu.
   */
  it('görününce dönme: ekrana girmeden DÖNMÜYOR, girince dönüyor', async () => {
    // Sahte gözlemci: geri çağrıyı elimizde tutup istediğimiz anda
    // tetikliyoruz. Gerçek kesişimi jsdom'da üretmenin yolu yok.
    let tetikle: (() => void) | null = null;
    const eski = window.IntersectionObserver;
    class SahteGozlemci {
      constructor(cb: IntersectionObserverCallback) {
        tetikle = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver = SahteGozlemci as never;

    try {
      const { container } = render(<Sekiz8Mark gorununceDonsun gecikme={0} />);
      // Ekrana girmeden dönmemeli — ölçümün asıl konusu bu.
      expect(donusAcisi(container)).toContain('rotate(0deg)');

      tetikle!();
      await waitFor(() => expect(donusAcisi(container)).toContain('rotate(90deg)'));
    } finally {
      window.IntersectionObserver = eski;
    }
  });

  it('görününce dönme: IntersectionObserver yoksa işaret hareketsiz KALMIYOR', async () => {
    // Yedek davranış (Part VIII): gözlemci yoksa dönüş doğrudan oynar.
    // Aksi hâlde eski bir tarayıcıda kapanıştaki işaret sonsuza kadar 8
    // olarak kalırdı.
    const eski = window.IntersectionObserver;
    // @ts-expect-error — yokluğu bilerek üretiliyor.
    delete window.IntersectionObserver;
    try {
      const { container } = render(<Sekiz8Mark gorununceDonsun gecikme={0} />);
      await waitFor(() => expect(donusAcisi(container)).toContain('rotate(90deg)'));
    } finally {
      window.IntersectionObserver = eski;
    }
  });

  it('hareket azaltma açıkken görününce dönme de doğrudan ∞ çizer', () => {
    matchMediaAyarla(true);
    const { container } = render(<Sekiz8Mark gorununceDonsun />);
    const stil = donusAcisi(container);
    expect(stil).toContain('rotate(90deg)');
    expect(stil).toContain('transition: none');
  });

  it('etiket verilmezse dekoratif sayılır', () => {
    const { container } = render(<Sekiz8Mark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('etiket verilirse ekran okuyucuya görünür', () => {
    render(<Sekiz8Mark etiket="SEKİZ" />);
    expect(screen.getByRole('img', { name: 'SEKİZ' })).toBeInTheDocument();
  });
});
