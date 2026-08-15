import { describe, expect, it } from 'vitest';
import { adiDuzelt, kodlariCsv, listeyiCoz } from './ogrenci-listesi';

describe('adiDuzelt — Türkçe büyük/küçük harf', () => {
  it('ölçülmüş tuzağı üretmiyor: birleşen nokta (U+0307) çıkmıyor', () => {
    // Düz `toLowerCase()` "ALİ"yi "Ali̇" yapıyor: `i` + U+0307. Ekranda
    // neredeyse aynı görünür, ama arama tutmaz ve ad bozuk kaydedilir.
    const duz = 'ALİ'.toLowerCase();
    expect(duz).toContain('̇'); // tuzağın gerçekten var olduğunun kanıtı

    const bizim = adiDuzelt('ALİ');
    expect(bizim).toBe('Ali');
    expect(bizim).not.toContain('̇');
    expect(bizim.length).toBe(3);
  });

  it('I harfini ı yapıyor, i harfini İ yapmıyor', () => {
    expect(adiDuzelt('IŞIK')).toBe('Işık');
    expect(adiDuzelt('ISIL')).toBe('Isıl');
    expect(adiDuzelt('İNCİ')).toBe('İnci');
  });

  it('tam bir e-Okul satırını doğru düzeltiyor', () => {
    expect(adiDuzelt('ALİ YILMAZ IŞIK ÖZTÜRK')).toBe('Ali Yılmaz Işık Öztürk');
    expect(adiDuzelt('MEHMET ALİ ÇOBANOĞLU')).toBe('Mehmet Ali Çobanoğlu');
    expect(adiDuzelt('ŞÜKRÜ GÜNEŞ')).toBe('Şükrü Güneş');
  });

  it('tireli adı parça parça büyütüyor', () => {
    expect(adiDuzelt('ALİ-VELİ KARA')).toBe('Ali-Veli Kara');
  });

  it('zaten düzgün yazılmış adı bozmuyor', () => {
    expect(adiDuzelt('Ali Yılmaz')).toBe('Ali Yılmaz');
  });

  it('düz JavaScript yolu YANLIŞ sonuç veriyor — karşı kanıt', () => {
    const yanlis = 'IŞIK'
      .split(' ')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase())
      .join(' ');
    expect(yanlis).toBe('Işik'); // "Işık" değil
    expect(adiDuzelt('IŞIK')).not.toBe(yanlis);
  });
});

describe('listeyiCoz — satır ayrıştırma', () => {
  it('düz listeyi okuyor', () => {
    const v = listeyiCoz('Ali Yılmaz\nAyşe Demir\nMehmet Kaya');
    expect(v.satirlar.map((s) => s.ad)).toEqual(['Ali Yılmaz', 'Ayşe Demir', 'Mehmet Kaya']);
    expect(v.atlanan).toHaveLength(0);
  });

  it('satır başındaki sıra numaralarını atıyor', () => {
    const v = listeyiCoz('1 Ali Yılmaz\n2. Ayşe Demir\n3) Mehmet Kaya\n4 - Zeynep Ak');
    expect(v.satirlar.map((s) => s.ad)).toEqual([
      'Ali Yılmaz',
      'Ayşe Demir',
      'Mehmet Kaya',
      'Zeynep Ak',
    ]);
  });

  it('Excel sekmeli yapıştırmasından adı seçiyor', () => {
    const v = listeyiCoz('1\t123456\tALİ YILMAZ\t9A\n2\t123457\tAYŞE DEMİR\t9A', {
      duzelt: true,
    });
    expect(v.satirlar.map((s) => s.ad)).toEqual(['Ali Yılmaz', 'Ayşe Demir']);
  });

  it('boş satırları sessizce geçiyor, hata saymıyor', () => {
    const v = listeyiCoz('Ali Yılmaz\n\n   \n\nAyşe Demir\n');
    expect(v.satirlar).toHaveLength(2);
    expect(v.atlanan).toHaveLength(0);
  });

  it('iç boşlukları teke indiriyor', () => {
    const v = listeyiCoz('Ali    Yılmaz');
    expect(v.satirlar[0]?.ad).toBe('Ali Yılmaz');
  });

  it('okunamayan satırı ATMIYOR, ham hâliyle raporluyor', () => {
    const v = listeyiCoz('Ali Yılmaz\n12345\n---\nA');
    expect(v.satirlar).toHaveLength(1);
    expect(v.atlanan).toHaveLength(3);
    expect(v.atlanan[0]).toMatchObject({ satir: 2, ham: '12345' });
    expect(v.atlanan.map((a) => a.sebep)).toContain('Çok kısa');
  });

  it('100 karakterden uzun adı sunucuya göndermeden eliyor', () => {
    const v = listeyiCoz('A'.repeat(101));
    expect(v.satirlar).toHaveLength(0);
    expect(v.atlanan[0]?.sebep).toBe('100 karakterden uzun');
  });
});

describe('listeyiCoz — düzeltme anahtarı', () => {
  it('kapalıyken hiçbir dönüşüm yapmıyor', () => {
    const v = listeyiCoz('ALİ YILMAZ', { duzelt: false });
    expect(v.satirlar[0]?.ad).toBe('ALİ YILMAZ');
  });

  it('açıkken düzeltiyor', () => {
    const v = listeyiCoz('ALİ YILMAZ', { duzelt: true });
    expect(v.satirlar[0]?.ad).toBe('Ali Yılmaz');
  });

  it('çoğunluk büyük harfse işaretliyor (varsayılanı bu belirliyor)', () => {
    expect(listeyiCoz('ALİ YILMAZ\nAYŞE DEMİR\nMEHMET KAYA').cogunlukBuyuk).toBe(true);
    expect(listeyiCoz('Ali Yılmaz\nAyşe Demir\nMehmet Kaya').cogunlukBuyuk).toBe(false);
  });

  it('tek bir büyük harfli ad bütün listeyi dönüştürmeye yetmiyor', () => {
    const v = listeyiCoz('Ali Yılmaz\nAyşe Demir\nMehmet Kaya\nZeynep Ak\nCAN ÖZ');
    expect(v.cogunlukBuyuk).toBe(false);
  });
});

describe('listeyiCoz — mükerrer uyarısı', () => {
  it('aynı yapıştırmadaki tekrarı işaretliyor ama SİLMİYOR', () => {
    const v = listeyiCoz('Ali Yılmaz\nAyşe Demir\nAli Yılmaz');
    expect(v.satirlar).toHaveLength(3); // engel değil, uyarı
    expect(v.satirlar[2]?.mukerrer).toBe('liste');
    expect(v.satirlar[0]?.mukerrer).toBeNull();
  });

  it('yazım farkını da yakalıyor (boşluk ve büyük harf)', () => {
    const v = listeyiCoz('Ali Yılmaz\nALİ  YILMAZ');
    expect(v.satirlar[1]?.mukerrer).toBe('liste');
  });

  it('sınıfta zaten kayıtlı olanı ayrı işaretliyor', () => {
    const v = listeyiCoz('Ali Yılmaz\nYeni Öğrenci', {
      duzelt: false,
      kayitliAdlar: ['ALİ YILMAZ'],
    });
    expect(v.satirlar[0]?.mukerrer).toBe('kayitli');
    expect(v.satirlar[1]?.mukerrer).toBeNull();
  });
});

describe('kodlariCsv', () => {
  const kayitlar = [
    { ad: 'Ali Yılmaz', ogrenci_kodu: 'ABCD2345', veli_kodu: 'EFGH6789' },
    { ad: 'Ayşe "Takma" Demir', ogrenci_kodu: 'JKMN2345', veli_kodu: 'PQRS6789' },
  ];

  it('Excel için UTF-8 BOM ile başlıyor', () => {
    // BOM olmadan Excel dosyayı Windows-1254 sanıyor ve "Çobanoğlu"
    // "Ãobanoğlu" oluyor.
    expect(kodlariCsv(kayitlar, '9A').charCodeAt(0)).toBe(0xfeff);
  });

  it('Türkçe Excel için noktalı virgülle ayırıyor', () => {
    const satir = kodlariCsv(kayitlar, '9A').split('\r\n')[1];
    expect(satir).toBe('"9A";"Ali Yılmaz";"ABCD2345";"EFGH6789"');
  });

  it('içindeki tırnağı kaçırıyor', () => {
    expect(kodlariCsv(kayitlar, '9A')).toContain('"Ayşe ""Takma"" Demir"');
  });

  it('her öğrenci için bir satır + başlık üretiyor', () => {
    const satirlar = kodlariCsv(kayitlar, '9A').trim().split('\r\n');
    expect(satirlar).toHaveLength(3);
    expect(satirlar[0]).toContain('Öğrenci kodu');
  });
});
