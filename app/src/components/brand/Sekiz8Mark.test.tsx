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

  it('etiket verilmezse dekoratif sayılır', () => {
    const { container } = render(<Sekiz8Mark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('etiket verilirse ekran okuyucuya görünür', () => {
    render(<Sekiz8Mark etiket="SEKİZ" />);
    expect(screen.getByRole('img', { name: 'SEKİZ' })).toBeInTheDocument();
  });
});
