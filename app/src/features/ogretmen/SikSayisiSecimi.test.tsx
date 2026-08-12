import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SikSayisiSecimi } from './SikSayisiSecimi';

describe('SikSayisiSecimi', () => {
  it('5 şıkta gizli durur — öğretmenin hiç dokunmadığı alan yolu kapatmasın', () => {
    render(<SikSayisiSecimi deger="E" onDegis={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/5 şık/)).toBeTruthy();
  });

  it('istenince açılıyor', async () => {
    const k = userEvent.setup();
    render(<SikSayisiSecimi deger="E" onDegis={vi.fn()} />);
    await k.click(screen.getByRole('button', { name: /4 şıklı test/ }));
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  /**
   * ASIL REGRESYON. Düzenleme ekranında form önce 'E' ile kuruluyor,
   * `odev_detay` sonra geliyor. Açıklık `useState` ile başlangıçta
   * hesaplansaydı 4 şıklı bir ödevde alan kapalı kalır ve ekranda "A–E"
   * yazardı — ızgara A–D gösterirken. Bu test o sırayı taklit ediyor.
   */
  it('değer sonradan D olursa kendiliğinden açılır (geç gelen veri)', () => {
    const { rerender } = render(<SikSayisiSecimi deger="E" onDegis={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();

    rerender(<SikSayisiSecimi deger="D" onDegis={vi.fn()} />);

    const secim = screen.getByRole('combobox') as HTMLSelectElement;
    expect(secim.value).toBe('D');
    // Yanlış bilgi kalmamalı: "5 şık" cümlesi artık ekranda olmamalı.
    expect(screen.queryByText(/Şıklar/)).toBeNull();
  });

  it('seçim değişince üst bileşene bildirir', async () => {
    const k = userEvent.setup();
    const onDegis = vi.fn();
    render(<SikSayisiSecimi deger="D" onDegis={onDegis} />);
    await k.selectOptions(screen.getByRole('combobox'), 'E');
    expect(onDegis).toHaveBeenCalledWith('E');
  });
});
