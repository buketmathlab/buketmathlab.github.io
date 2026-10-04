import { afterEach, describe, expect, it, vi } from 'vitest';
import { gorseliSikistir } from './gorsel-sikistir';

/**
 * jsdom'da ne `Image` gerçekten dosya çözer ne de `canvas.toBlob` vardır.
 * Bu yüzden ikisi de taklit ediliyor: ölçtüğümüz şey tarayıcının çizim
 * yeteneği değil, BİZİM kodumuzun kararları — hangi boyuta indiriyor, hangi
 * biçimde çıkarıyor, bozuk dosyada ne diyor.
 */
type SahteTuval = {
  width: number;
  height: number;
  getContext: () => object | null;
  toBlob: (geri: (b: Blob | null) => void, tur?: string, kalite?: number) => void;
};

const tuvaller: SahteTuval[] = [];
let sonTur: string | undefined;
let sonKalite: number | undefined;

function ortamKur(opts: { en: number; boy: number; yuklenir?: boolean; blob?: Blob | null; parlaklik?: number }) {
  const { en, boy, yuklenir = true, blob = new Blob(['x'], { type: 'image/jpeg' }), parlaklik = 220 } = opts;

  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:sahte',
    revokeObjectURL: () => undefined,
  });

  class SahteImage {
    width = en;
    height = boy;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => (yuklenir ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal('Image', SahteImage);

  vi.spyOn(document, 'createElement').mockImplementation(((etiket: string) => {
    if (etiket !== 'canvas') throw new Error(`beklenmeyen eleman: ${etiket}`);
    const t: SahteTuval = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => undefined,
        // Tek renkli 10×10 görsel: parlaklık testten seçiliyor.
        getImageData: () => ({ data: new Uint8ClampedArray(400).fill(parlaklik) }),
      }),
      toBlob: (geri, tur, kalite) => {
        sonTur = tur;
        sonKalite = kalite;
        geri(blob);
      },
    };
    tuvaller.push(t);
    return t as unknown as HTMLElement;
  }) as typeof document.createElement);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  tuvaller.length = 0;
  sonTur = undefined;
  sonKalite = undefined;
});

const dosya = () => new File([new Uint8Array([1, 2, 3])], 'foto.heic', { type: 'image/heic' });

describe('gorseliSikistir', () => {
  it('uzun kenarı 1400 pikselle sınırlar, oranı korur', async () => {
    ortamKur({ en: 4032, boy: 3024 });
    await gorseliSikistir(dosya());
    expect(tuvaller[0]?.width).toBe(1400);
    expect(tuvaller[0]?.height).toBe(1050); // 1400 × 3024/4032
  });

  it('dikey fotoğrafta uzun kenar yüksekliktir', async () => {
    ortamKur({ en: 3024, boy: 4032 });
    await gorseliSikistir(dosya());
    expect(tuvaller[0]?.height).toBe(1400);
    expect(tuvaller[0]?.width).toBe(1050);
  });

  it('küçük fotoğrafı BÜYÜTMEZ', async () => {
    ortamKur({ en: 800, boy: 600 });
    await gorseliSikistir(dosya());
    expect(tuvaller[0]?.width).toBe(800);
    expect(tuvaller[0]?.height).toBe(600);
  });

  it('çıktı her zaman JPEG, kalite 0.72', async () => {
    ortamKur({ en: 2000, boy: 2000 });
    const sonuc = await gorseliSikistir(dosya());
    expect(sonTur).toBe('image/jpeg');
    expect(sonKalite).toBeCloseTo(0.72);
    expect(sonuc.type).toBe('image/jpeg');
    expect(sonuc.name).toBe('cozum.jpg');
  });

  it('okunamayan dosyada anlaşılır Türkçe hata verir, sessizce ham dosyaya düşmez', async () => {
    ortamKur({ en: 0, boy: 0, yuklenir: false });
    await expect(gorseliSikistir(dosya())).rejects.toThrow(/Fotoğraf okunamadı/);
  });

  it('sıkıştırma başarısızsa ham dosyaya düşmez', async () => {
    ortamKur({ en: 2000, boy: 2000, blob: null });
    await expect(gorseliSikistir(dosya())).rejects.toThrow(/işlenemedi/);
  });

  it('karanlık (siyah) fotoğrafı gönderime almaz, ne yapacağını söyler', async () => {
    ortamKur({ en: 4032, boy: 3024, parlaklik: 4 });
    await expect(gorseliSikistir(dosya())).rejects.toThrow(/çok karanlık.*Aydınlık bir ortamda yeniden çekip yükle/);
  });
});
