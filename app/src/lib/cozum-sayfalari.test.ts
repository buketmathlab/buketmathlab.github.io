import { describe, expect, it } from 'vitest';
import { NUMARA_KURALI } from './el-yazisi-metni';
import {
  EN_FAZLA_SAYFA,
  cozumSayfaYolu,
  HER_SAYFA_GEREKCESI,
  depoZatenVarMi,
  eksikSayfaMetni,
  oncedenYuklenenMetni,
  sahnedenCikar,
  sahneyeEkle,
  sayfaIpucuMetni,
  sayfaKuraliniOku,
  sayfaSayacMetni,
  sayfaSiniriniOku,
  tasmaMetni,
  yarimKalanMetni,
} from './cozum-sayfalari';

const O = '11111111-1111-1111-1111-111111111111';
const S = '22222222-2222-2222-2222-222222222222';

describe('cozumSayfaYolu', () => {
  it('1. sayfa 0009\'dan beri kullanılan EKSİZ yol — varsayılan yol değişmedi', () => {
    expect(cozumSayfaYolu(O, S, 1)).toBe(`cozum/${O}/${S}.jpg`);
  });

  it('ek sayfalar -n eki taşır', () => {
    expect(cozumSayfaYolu(O, S, 2)).toBe(`cozum/${O}/${S}-2.jpg`);
    expect(cozumSayfaYolu(O, S, 8)).toBe(`cozum/${O}/${S}-8.jpg`);
    expect(cozumSayfaYolu(O, S, 40)).toBe(`cozum/${O}/${S}-40.jpg`);
  });

  it('sunucunun tanımadığı sayfa numarası üretmez', () => {
    for (const n of [0, 41, -1, 1.5, Number.NaN]) {
      expect(() => cozumSayfaYolu(O, S, n)).toThrow(RangeError);
    }
  });

  it('sunucudaki kalıpla eşleşir (_cozum_yolu_gecerli, 0078)', () => {
    // Migration'daki düzenli ifadenin birebir JS karşılığı.
    const kalip =
      /^cozum\/([0-9a-f-]{36})\/([0-9a-f-]{36})(?:-([2-9]|[1-3][0-9]|40))?\.(jpg|jpeg|png|webp)$/;
    for (let n = 1; n <= EN_FAZLA_SAYFA; n++) {
      const m = kalip.exec(cozumSayfaYolu(O, S, n));
      expect(m).not.toBeNull();
      expect(Number(m![3] ?? 1)).toBe(n);
    }
  });
});

describe('sayfaSiniriniOku', () => {
  it('geçerli sınırı olduğu gibi okur', () => {
    expect(sayfaSiniriniOku(1)).toBe(1);
    expect(sayfaSiniriniOku(3)).toBe(3);
    expect(sayfaSiniriniOku(8)).toBe(8);
    expect(sayfaSiniriniOku(40)).toBe(40);
  });

  it('okunamayan her durumda 1 — bugünkü tek sayfalık davranış', () => {
    for (const ham of [null, undefined, 0, 41, -2, 2.5, '3', {}, Number.NaN]) {
      expect(sayfaSiniriniOku(ham)).toBe(1);
    }
  });
});

describe('sayfaKuraliniOku (0078)', () => {
  it('yeni uç: sayfa ve zorunluluk', () => {
    expect(sayfaKuraliniOku({ sayfa: 8, tum_sayfalar: true })).toEqual({ sayfa: 8, tumSayfalar: true });
    expect(sayfaKuraliniOku({ sayfa: 3, tum_sayfalar: false })).toEqual({ sayfa: 3, tumSayfalar: false });
  });

  it('yeni uç yoksa eski sınıra düşer, zorunlu sayılmaz', () => {
    expect(sayfaKuraliniOku(null, 4)).toEqual({ sayfa: 4, tumSayfalar: false });
    expect(sayfaKuraliniOku({ sayfa: 99, tum_sayfalar: true }, 2)).toEqual({ sayfa: 2, tumSayfalar: false });
  });

  it('hiçbiri okunamazsa 1, zorunlu değil', () => {
    expect(sayfaKuraliniOku(undefined, undefined)).toEqual({ sayfa: 1, tumSayfalar: false });
  });
});

describe('sahneyeEkle', () => {
  it('sona ekler, sırayı korur', () => {
    expect(sahneyeEkle(['a'], ['b', 'c'], 3)).toEqual({ liste: ['a', 'b', 'c'], tasan: 0 });
  });

  it('sınırı aşanları EKLEMEZ ve kaç tane olduğunu söyler', () => {
    expect(sahneyeEkle(['a', 'b'], ['c', 'd', 'e', 'f'], 3)).toEqual({
      liste: ['a', 'b', 'c'],
      tasan: 3,
    });
  });

  it('dolu sahneye hiçbir şey eklemez', () => {
    expect(sahneyeEkle(['a', 'b', 'c'], ['d'], 3)).toEqual({ liste: ['a', 'b', 'c'], tasan: 1 });
  });

  it('girdiyi değiştirmez', () => {
    const mevcut = ['a'];
    sahneyeEkle(mevcut, ['b'], 3);
    expect(mevcut).toEqual(['a']);
  });
});

describe('sahnedenCikar', () => {
  it('çıkarır; kalanlar boşluksuz yeniden numaralanır', () => {
    // Sunucu ek sayfaları BOŞLUKSUZ istiyor (-2, -3, …): ortadan silinen
    // sayfa numara deliği bırakmamalı. Numara dizideki sıradan geliyor.
    expect(sahnedenCikar(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('olmayan sıra listeyi değiştirmez', () => {
    expect(sahnedenCikar(['a'], 5)).toEqual(['a']);
  });
});

describe('depoZatenVarMi', () => {
  it('doğrudan 409', () => {
    expect(depoZatenVarMi(409, '')).toBe(true);
  });

  it('400 gövdesinde 409 ya da Duplicate', () => {
    expect(
      depoZatenVarMi(
        400,
        '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}',
      ),
    ).toBe(true);
    expect(depoZatenVarMi(400, '{"error":"Duplicate"}')).toBe(true);
  });

  it('DAR: başka her hata "zaten var" SAYILMAZ', () => {
    // Yanlış pozitif = dosyası hiç yüklenmemiş gönderimin kabulü.
    expect(depoZatenVarMi(400, '{"statusCode":"400","error":"InvalidKey"}')).toBe(false);
    expect(depoZatenVarMi(400, 'düz metin')).toBe(false);
    expect(depoZatenVarMi(400, '')).toBe(false);
    expect(depoZatenVarMi(403, '{"error":"Duplicate"}')).toBe(false);
    expect(depoZatenVarMi(500, '{"statusCode":"409"}')).toBe(false);
    expect(depoZatenVarMi(413, '')).toBe(false);
  });
});

describe('metinler', () => {
  it('sayaç', () => {
    expect(sayfaSayacMetni(2, 3)).toBe('2 / 3 sayfa seçildi');
    expect(sayfaSayacMetni(5, 8, true)).toBe('5 / 8 sayfa eklendi · 3 sayfa eksik');
    expect(sayfaSayacMetni(8, 8, true)).toBe('8 / 8 sayfa eklendi · tamam');
  });

  it('zorunlu ödevin açıklaması: sayfa sayısı ve sıra; birleştirme yok', () => {
    const m = sayfaIpucuMetni(8, true);
    expect(m).toContain('Bu ödev 8 sayfa');
    expect(m).toContain('sırayla');
    expect(m).toContain("PDF'in her sayfası ayrı bir sayfa");
    for (const x of [m, sayfaIpucuMetni(1, true), sayfaIpucuMetni(3, false), HER_SAYFA_GEREKCESI]) {
      expect(x).not.toMatch(/birleştir|tek görsel|tek PDF/i);
    }
  });

  /**
   * NUMARA KURALI ÖĞRENCİNİN OKUDUĞU İPUCUNDA.
   *
   * Kural önce `el-yazisi-metni.ts`'teki `YUKLEME_IPUCU` sabitine
   * yazılmıştı ve o sabit ÖLÜ ÇIKTI — hiçbir ekran onu çizmiyordu, yalnız
   * kendi testi okuyordu. Ekran görüntüsü alınınca görüldü. Bu iddia,
   * kuralın gerçekten çizilen metinde durduğunu sayıyor.
   */
  it('ipucu çıktı yolunu ve boş kâğıtta numara kuralını söylüyor', () => {
    for (const m of [sayfaIpucuMetni(1, true), sayfaIpucuMetni(8, true), sayfaIpucuMetni(3, false)]) {
      expect(m).toContain('Çıktı alınmış soru kâğıdına');
      expect(m).toContain(NUMARA_KURALI);
      expect(m).toContain('tablette çözdüysen');
    }
  });

  it('gerekçe öğrenme diliyle', () => {
    expect(HER_SAYFA_GEREKCESI).toContain('çözüm yolunun tamamını');
    expect(eksikSayfaMetni(3)).toBe('3 sayfa eksik. Ödevi gönderebilmek için her sayfanın çözümünü eklemelisin.');
  });

  it('taşma sayısını söyler', () => {
    expect(tasmaMetni(3, 2)).toBe(
      'Bu ödevde en fazla 3 sayfa yükleyebilirsin. 2 görsel eklenmedi.',
    );
    expect(tasmaMetni(8, 1, true)).toBe('Bu ödev 8 sayfa; fazladan seçtiğin 1 görsel eklenmedi.');
  });

  it('yarıda kalan yükleme: gönderilmediğini ve seçimin durduğunu söyler', () => {
    const m = yarimKalanMetni(2, 3);
    expect(m).toContain('2/3');
    expect(m).toContain('henüz gönderilmedi');
    expect(m).toContain('seçtiğin görseller duruyor');
  });

  it('önceden yüklenenleri tekil/çoğul söyler, yoksa susar', () => {
    expect(oncedenYuklenenMetni([])).toBeNull();
    expect(oncedenYuklenenMetni([2])).toBe(
      '2. sayfa önceki denemende yüklenmişti; o hâliyle gönderildi.',
    );
    expect(oncedenYuklenenMetni([1, 3])).toBe(
      '1., 3. sayfalar önceki denemende yüklenmişti; o hâlleriyle gönderildi.',
    );
  });
});
