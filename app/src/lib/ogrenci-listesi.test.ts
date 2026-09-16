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

describe('listeyiCoz — e-Okul sınıf listesi', () => {
  /**
   * GERÇEK BİR LİSTENİN YAPISI, UYDURMA ADLARLA.
   *
   * Depo herkese açık; buraya gerçek öğrenci adı yazılmaz. Yapı gerçek bir
   * 9. sınıf listesinden ölçülerek çıkarıldı: 27 öğrencilik o listeden
   * ayrıştırıcı 44 "öğrenci" üretiyordu.
   */
  const LISTE = [
    'T.C.',
    'İSTANBUL VALİLİĞİ',
    'Beşiktaş / Örnek Anadolu Lisesi Müdürlüğü',
    '15 - 9. Sınıf / A Şubesi (Sayısal) Sınıf Listesi',
    'Sınıf Öğretmeni: NURAY ÖRNEK Sınıf Başkanı:',
    'Sınıf Müdür Yrd: KEMAL DENEME Sınıf Başkan Yrd:',
    'S.No Öğrenci No Adı Soyadı Cinsiyeti Pansiyon Durum',
    '1 601 ALİ YILMAZ Erkek',
    '2 602 AYŞE IŞIK Kız',
    '3 603 MEHMET ÇOBANOĞLU Erkek',
    'Kız Öğrenci Sayısı : 1 Erkek Öğrenci Sayısı : 2 Toplam Öğrenci Sayısı : 3',
    '15/09/2026 15:37:18 1',
    'ABC01001R020',
  ].join('\n');

  it('yalnız öğrencileri alıyor — başlık, kurum ve altbilgi girmiyor', () => {
    const v = listeyiCoz(LISTE, { duzelt: true });
    expect(v.satirlar.map((s) => s.ad)).toEqual([
      'Ali Yılmaz',
      'Ayşe Işık',
      'Mehmet Çobanoğlu',
    ]);
  });

  it('ÖĞRETMEN ADINI öğrenci sanmıyor', () => {
    // Bu turun en tehlikeli kusuru buydu: bir meslektaşın adı öğrenci
    // olarak kaydediliyordu.
    const v = listeyiCoz(LISTE, { duzelt: true });
    const adlar = v.satirlar.map((s) => s.ad).join(' | ');
    expect(adlar).not.toMatch(/Nuray|Kemal/);
    expect(v.atlanan.map((a) => a.sebep)).toContain('Öğretmen/başkan satırı');
  });

  it('okul numarası ve cinsiyet ADIN İÇİNDE kalmıyor', () => {
    const v = listeyiCoz(LISTE, { duzelt: true });
    for (const s of v.satirlar) {
      expect(s.ad).not.toMatch(/\d/);
      expect(s.ad).not.toMatch(/(Kız|Erkek)$/);
    }
  });

  it('Türkçe büyük harf tuzağı: İSTANBUL VALİLİĞİ eleniyor', () => {
    // `/Valiliği/i` bunu YAKALAMIYORDU — ölçüldü, listeye "öğrenci" olarak
    // girmişti. Küçük harfe Türkçe kurallarıyla çevirmek şart.
    const v = listeyiCoz('İSTANBUL VALİLİĞİ\nALİ YILMAZ', { duzelt: true });
    expect(v.satirlar.map((s) => s.ad)).toEqual(['Ali Yılmaz']);
  });

  it('tek başına duran cinsiyet satırını öğrenci saymıyor', () => {
    // Öğretmenin bildirdiği kusur: sütun ayrı satıra düştüğünde
    // "Kız"/"Erkek" birer öğrenci oluyordu.
    const v = listeyiCoz('ALİ YILMAZ\nErkek\nAYŞE IŞIK\nKız', { duzelt: true });
    expect(v.satirlar.map((s) => s.ad)).toEqual(['Ali Yılmaz', 'Ayşe Işık']);
    expect(v.atlanan.map((a) => a.sebep)).toEqual(['Cinsiyet sütunu', 'Cinsiyet sütunu']);
  });

  it('sekmeli yapıştırmada TEK ADLI öğrencinin adı "Erkek" olmuyor', () => {
    // "Ali" (3 harf) < "Erkek" (5 harf): cinsiyet elenmeseydi en uzun alan
    // seçilir ve çocuğun adı "Erkek" diye kaydedilirdi.
    const v = listeyiCoz('1\t601\tALİ\tErkek', { duzelt: true });
    expect(v.satirlar[0]?.ad).toBe('Ali');
  });

  it('elenen satırlar SESSİZCE yok olmuyor, sebebiyle raporlanıyor', () => {
    const v = listeyiCoz(LISTE, { duzelt: true });
    expect(v.atlanan.length).toBe(10);
    for (const a of v.atlanan) {
      expect(a.sebep).not.toBe('');
      expect(a.ham).not.toBe('');
    }
  });

  it('cinsiyet sütunu OLMAYAN listeyi de okuyor', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ\n2 602 AYŞE IŞIK', { duzelt: true });
    expect(v.satirlar.map((s) => s.ad)).toEqual(['Ali Yılmaz', 'Ayşe Işık']);
  });
});

describe('listeyiCoz — okul numarası (0042)', () => {
  it('numarayı AYRI alana çıkarıyor, adın içinde bırakmıyor', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 602 AYŞE IŞIK Kız', { duzelt: true });
    expect(v.satirlar.map((s) => [s.ad, s.no])).toEqual([
      ['Ali Yılmaz', '601'],
      ['Ayşe Işık', '602'],
    ]);
  });

  it('numarasız satırda null — eksiklik değil, olağan', () => {
    // Elle yazılmış liste ve özel ders öğrencisi böyle geliyor.
    const v = listeyiCoz('Ali Yılmaz\n2. Ayşe Işık', { duzelt: true });
    expect(v.satirlar.map((s) => s.no)).toEqual([null, null]);
  });

  it('başında sıfır olan numarayı bozmuyor', () => {
    // Metin olarak saklanmasının sebebi bu: sayıya çevirmek "0601"i
    // sessizce "601" yapardı.
    const v = listeyiCoz('1 0601 ALİ YILMAZ Erkek', { duzelt: true });
    expect(v.satirlar[0]?.no).toBe('0601');
  });

  it('aynı yapıştırmadaki numara tekrarını işaretliyor ama SİLMİYOR', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 601 AYŞE IŞIK Kız', { duzelt: true });
    expect(v.satirlar).toHaveLength(2);
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, 'liste']);
    // Ad tekrarı YOK: iki uyarı birbirine karışmamalı.
    expect(v.satirlar.map((s) => s.mukerrer)).toEqual([null, null]);
  });

  it('sınıfta zaten kullanılan numarayı ayrı işaretliyor', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek', {
      duzelt: true,
      kayitliNolar: ['601'],
    });
    expect(v.satirlar[0]?.noTekrar).toBe('kayitli');
    expect(v.satirlar[0]?.mukerrer).toBe(null);
  });

  it('ad tekrarı ile numara tekrarı BAĞIMSIZ', () => {
    // Aynı adda iki öğrenci olabilir ve numaraları farklıdır.
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 602 ALİ YILMAZ Erkek', {
      duzelt: true,
    });
    expect(v.satirlar.map((s) => s.mukerrer)).toEqual([null, 'liste']);
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, null]);
  });
});

describe('listeyiCoz — çok şubeli e-Okul dosyası', () => {
  /**
   * ÜÇ ŞUBELİK BİR DOSYANIN YAPISI, UYDURMA ADLARLA.
   *
   * Öğretmenin gönderdiği tek PDF üç şube taşıyordu (9A 27, 9B 30, 9C 30
   * öğrenci — toplam 87). Şube başlıkları okunmasaydı 87'sinin hepsi
   * seçilen tek sınıfa eklenirdi. Şubeler arasında numaralar da çakışıyordu.
   */
  const DOSYA = [
    'T.C.',
    'AL - 9. Sınıf / A Şubesi (Sayısal) Sınıf Listesi',
    'S.No Öğrenci No Adı Soyadı Cinsiyeti',
    '1 601 ALİ YILMAZ Erkek',
    '2 617 AYŞE IŞIK Kız',
    'AL - 9. Sınıf / B Şubesi (Sözel) Sınıf Listesi',
    'S.No Öğrenci No Adı Soyadı Cinsiyeti',
    '1 617 MEHMET ÇOBAN Erkek',
    '2 618 ALİ YILMAZ Erkek',
  ].join('\n');

  it('şubeleri göründükleri sırada buluyor', () => {
    expect(listeyiCoz(DOSYA, { duzelt: true }).siniflar).toEqual(['9A', '9B']);
  });

  it('her öğrenciyi kendi şubesine bağlıyor', () => {
    const v = listeyiCoz(DOSYA, { duzelt: true });
    expect(v.satirlar.map((s) => [s.sinif, s.no])).toEqual([
      ['9A', '601'],
      ['9A', '617'],
      ['9B', '617'],
      ['9B', '618'],
    ]);
  });

  it('ŞUBELER ARASI numara çakışması UYARI DEĞİL', () => {
    // 9A'daki 617 ile 9B'deki 617 iki ayrı öğrencinin numarası. Genel bir
    // küme kullanılsaydı üç şubelik dosya baştan aşağı yanlış uyarı verir
    // ve gerçek çakışmalar o gürültünün içinde kaybolurdu.
    const v = listeyiCoz(DOSYA, { duzelt: true });
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, null, null, null]);
  });

  it('ŞUBELER ARASI aynı ad da uyarı değil', () => {
    const v = listeyiCoz(DOSYA, { duzelt: true });
    expect(v.satirlar.map((s) => s.mukerrer)).toEqual([null, null, null, null]);
  });

  it('AYNI şubedeki çakışma hâlâ uyarı veriyor', () => {
    // Kapsamı daraltmak, gerçek çakışmayı kaçırmak demek olmamalı.
    const v = listeyiCoz(
      [
        'AL - 9. Sınıf / A Şubesi (Sayısal) Sınıf Listesi',
        '1 601 ALİ YILMAZ Erkek',
        '2 601 AYŞE IŞIK Kız',
      ].join('\n'),
      { duzelt: true },
    );
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, 'liste']);
  });

  it('şube başlığı elenenlerde ve şubeyi söylüyor', () => {
    const v = listeyiCoz(DOSYA, { duzelt: true });
    expect(v.atlanan.map((a) => a.sebep)).toContain('Şube başlığı (9A)');
    expect(v.atlanan.map((a) => a.sebep)).toContain('Şube başlığı (9B)');
  });

  it('şube başına "zaten kayıtlı" ayrı bakılıyor', () => {
    const v = listeyiCoz(DOSYA, {
      duzelt: true,
      kayitliSube: { '9B': { nolar: ['617'] } },
    });
    // 9A'daki 617 kayıtlı SAYILMAMALI — o başka bir şubenin numarası.
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, null, 'kayitli', null]);
  });

  it('"zaten kayıtlı" ADI da şube başına bakıyor (0043)', () => {
    // Dosyada "ALİ YILMAZ" hem 9A'da hem 9B'de var; kayıtlı olan yalnız
    // 9B'deki. Şube ayrımı düşseydi 9A'daki Ali de "eşleşti" sayılır ve
    // yanlış çocuğun numarası yazılırdı.
    const v = listeyiCoz(DOSYA, {
      duzelt: true,
      kayitliSube: { '9B': { adlar: ['Ali Yılmaz'] } },
    });
    expect(
      v.satirlar.map((s) => `${s.sinif}:${s.ad}:${s.kayitli ? 'kayitli' : 'yeni'}`),
    ).toEqual([
      '9A:Ali Yılmaz:yeni',
      '9A:Ayşe Işık:yeni',
      '9B:Mehmet Çoban:yeni',
      '9B:Ali Yılmaz:kayitli',
    ]);
  });

  it('şubesiz dosyada eski davranış sürüyor', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 601 AYŞE IŞIK Kız', {
      duzelt: true,
    });
    expect(v.siniflar).toEqual([]);
    expect(v.satirlar.map((s) => s.sinif)).toEqual([null, null]);
    expect(v.satirlar.map((s) => s.noTekrar)).toEqual([null, 'liste']);
  });
});

/**
 * `kayitli` alanı (0043): "kaç öğrenci eşleşecek" sayısının kaynağı.
 *
 * Bu sayı yanlış olursa öğretmen kaydetmeden önce yanlış bir şey görür —
 * ve bütün sınıfların iki katına çıkmasının sebebi tam olarak, kaydetmeden
 * önce ne olacağının söylenmemesiydi.
 */
describe('listeyiCoz — zaten kayıtlı işareti (0043)', () => {
  it('sınıfta kayıtlı adı işaretliyor, olmayanı işaretlemiyor', () => {
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 602 AYŞE IŞIK Kız', {
      duzelt: true,
      kayitliAdlar: ['Ali Yılmaz'],
    });
    expect(v.satirlar.map((s) => s.kayitli)).toEqual([true, false]);
  });

  it('büyük/küçük harf ve fazla boşluk eşleşmeyi bozmuyor', () => {
    const v = listeyiCoz('1 601 ALİ  YILMAZ Erkek', {
      duzelt: true,
      kayitliAdlar: ['ali yılmaz'],
    });
    expect(v.satirlar[0]?.kayitli).toBe(true);
  });

  it('LİSTEDE DE TEKRAR EDEN kayıtlı ad, kayıtlı sayılmayı sürdürüyor', () => {
    // `mukerrer` tek değer taşıyor ve burada 'liste' yazıyor; `kayitli`
    // ondan bağımsız olmasaydı ikinci satır sayımdan düşer ve önizleme
    // "1 eşleşti" derken sunucu iki kaydı da güncellerdi.
    const v = listeyiCoz('1 601 ALİ YILMAZ Erkek\n2 602 ALİ YILMAZ Erkek', {
      duzelt: true,
      kayitliAdlar: ['Ali Yılmaz'],
    });
    expect(v.satirlar.map((s) => s.mukerrer)).toEqual(['kayitli', 'liste']);
    expect(v.satirlar.map((s) => s.kayitli)).toEqual([true, true]);
  });

});
