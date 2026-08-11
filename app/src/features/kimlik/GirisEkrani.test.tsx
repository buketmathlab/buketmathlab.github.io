import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GirisEkrani } from './GirisEkrani';

const rpcMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabase', () => ({
  rpc: rpcMock,
  OturumHatasi: class extends Error {},
}));

describe('GirisEkrani', () => {
  // Mock sıfırlama YOK. Vitest 3'te beforeEach içinde mockReset/mockClear
  // yapıldığında, sonraki testte kurulan reddeden implementasyon sahte bir
  // "unhandled error" olarak raporlanıyor (deneyerek doğrulandı). Her test
  // sunucunun ne döndüreceğini zaten kendisi belirtiyor; "hiç çağrılmadı"
  // kontrolü de ilk testte, henüz hiç çağrı yokken yapılıyor.

  it('boş kodla gönderim yapmaz ve hatayı ekran okuyucuya duyurur', async () => {
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={vi.fn()} />);

    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kodunuzu yazın');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('giriş kutusu yazılanı BÜYÜTMEZ — PIN birebir karşılaştırılıyor', async () => {
    // GERÇEK ARIZA, tekrarlamasın diye burada kilitleniyor.
    // Kutuda bir zamanlar autoCapitalize="characters" vardı. iPad'de bu,
    // yazılan harfleri anında büyütüyordu; öğretmen PIN'i ise sunucuda
    // birebir karşılaştırılıyor (0003_guvenlik_fonksiyonlari.sql:355).
    // Sonuç: harf içeren PIN'le giriş imkânsızdı.
    // Öğrenci/veli kodları için de gereksizdi — sunucu `upper(p_kod)`
    // uyguluyor (aynı dosya:366).
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={vi.fn()} />);
    const kutu = screen.getByLabelText(/giriş kodunuz/i);

    expect(kutu).not.toHaveAttribute('autocapitalize');
  });

  it('yazılan karma karakterli PIN sunucuya olduğu gibi gider', async () => {
    // Harf + rakam + noktalama: öğretmenin PIN'i bu türden.
    rpcMock.mockImplementation(async () => ({ rol: 'ogretmen', token: 'b'.repeat(64) }));
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={vi.fn()} />);

    await k.type(screen.getByLabelText(/giriş kodunuz/i), 'Buket.8sekiz');
    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('giris', { p_kod: 'Buket.8sekiz' }));
  });

  it('bulunamayan kod için eyleme dönük mesaj gösterir', async () => {
    // Part XLI: "bir şeyler ters gitti" yasak; kullanıcı ne yapacağını bilmeli.
    rpcMock.mockImplementation(async () => ({ rol: 'yok' }));
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={vi.fn()} />);

    await k.type(screen.getByLabelText(/giriş kodunuz/i), 'YANLIS12');
    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/bulunamadı/i);
  });

  it('öğretmen girişinde jetonu yukarı iletir', async () => {
    rpcMock.mockImplementation(async () => ({ rol: 'ogretmen', token: 'a'.repeat(64) }));
    const onGiris = vi.fn();
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={onGiris} onKurulum={vi.fn()} />);

    await k.type(screen.getByLabelText(/giriş kodunuz/i), '123456');
    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    await waitFor(() =>
      expect(onGiris).toHaveBeenCalledWith({ rol: 'ogretmen', token: 'a'.repeat(64) }),
    );
  });

  it('PIN belirlenmemişse kurulum akışına yönlendirir', async () => {
    rpcMock.mockImplementation(async () => ({ rol: 'kurulum' }));
    const onKurulum = vi.fn();
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={onKurulum} />);

    await k.type(screen.getByLabelText(/giriş kodunuz/i), 'herhangi');
    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    await waitFor(() => expect(onKurulum).toHaveBeenCalled());
  });

  it('sunucu hatasını kullanıcıya okunabilir biçimde gösterir', async () => {
    // async fonksiyon içinden fırlatmak, reddedilen promise'in yalnız çağrı
    // anında doğmasını sağlar; mockRejectedValue tanım anında oluşturduğu
    // için "unhandled rejection" olarak raporlanıyordu.
    rpcMock.mockImplementation(async () => {
      throw new Error('Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.');
    });
    const k = userEvent.setup();
    render(<GirisEkrani onGiris={vi.fn()} onKurulum={vi.fn()} />);

    await k.type(screen.getByLabelText(/giriş kodunuz/i), 'ABC12345');
    await k.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/15 dakika/);
  });
});
