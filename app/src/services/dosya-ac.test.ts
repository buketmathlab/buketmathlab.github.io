import { describe, expect, it, vi } from 'vitest';
import { dosyayiAc } from './dosya-ac';

/** Sahte sekme: `location.replace` ve `close` kaydediliyor. */
function sahteSekme() {
  const replace = vi.fn();
  const sekme = {
    closed: false,
    opener: {} as unknown,
    document: { title: '', body: { style: {} as Record<string, string>, textContent: '' } },
    location: { replace },
    close: vi.fn(() => {
      sekme.closed = true;
    }),
  };
  return sekme;
}

describe('dosyayiAc', () => {
  it('sekme ADRES BEKLENMEDEN açılır, sonra adrese yönlendirilir', async () => {
    const sekme = sahteSekme();
    const sira: string[] = [];
    const pencereAc = vi.fn(() => {
      sira.push('sekme');
      return sekme as unknown as Window;
    });
    const sonuc = await dosyayiAc(async () => {
      sira.push('adres');
      return 'https://depo/imzali.pdf';
    }, pencereAc);

    expect(sira).toEqual(['sekme', 'adres']);
    expect(pencereAc).toHaveBeenCalledWith('', '_blank');
    expect(sekme.document.body.textContent).toContain('Dosya açılıyor');
    expect(sekme.opener).toBeNull();
    expect(sekme.location.replace).toHaveBeenCalledWith('https://depo/imzali.pdf');
    expect(sonuc).toEqual({ url: 'https://depo/imzali.pdf', sekme: true });
  });

  it('sekme engellendiyse (null) adres bağlantı için döner', async () => {
    const sonuc = await dosyayiAc(async () => 'https://depo/a.pdf', () => null);
    expect(sonuc).toEqual({ url: 'https://depo/a.pdf', sekme: false });
  });

  it('sekme beklerken kullanıcı kapattıysa bağlantı için döner', async () => {
    const sekme = sahteSekme();
    const sonuc = await dosyayiAc(async () => {
      sekme.closed = true;
      return 'https://depo/a.pdf';
    }, () => sekme as unknown as Window);
    expect(sonuc).toEqual({ url: 'https://depo/a.pdf', sekme: false });
    expect(sekme.location.replace).not.toHaveBeenCalled();
  });

  it('hata: boş sekme kapanır, hata çağırana gider', async () => {
    const sekme = sahteSekme();
    await expect(
      dosyayiAc(async () => {
        throw new Error('Bu dosyaya erişim izniniz yok.');
      }, () => sekme as unknown as Window),
    ).rejects.toThrow('Bu dosyaya erişim izniniz yok.');
    expect(sekme.close).toHaveBeenCalled();
  });

  it('dosya yoksa (null) boş sekme kapanır, sonuç null', async () => {
    const sekme = sahteSekme();
    expect(await dosyayiAc(async () => null, () => sekme as unknown as Window)).toBeNull();
    expect(sekme.close).toHaveBeenCalled();
  });

  it('pencere açmak hata fırlatırsa (bazı uygulama içi tarayıcılar) bağlantıya düşer', async () => {
    const sonuc = await dosyayiAc(async () => 'https://depo/a.pdf', () => {
      throw new Error('engellendi');
    });
    expect(sonuc).toEqual({ url: 'https://depo/a.pdf', sekme: false });
  });
});
