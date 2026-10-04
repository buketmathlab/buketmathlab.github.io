import { describe, expect, it } from 'vitest';
import {
  BASLIK,
  KABUL_EDILMEYEN,
  NEDEN,
  ONAY,
  ONAY_EKSIK,
  YOLLAR,
  YUKLEME_IPUCU,
} from './el-yazisi-metni';

const hepsi = [BASLIK, NEDEN, KABUL_EDILMEYEN, ONAY, ONAY_EKSIK, YUKLEME_IPUCU, ...YOLLAR.map((y) => y.metin)].join(' ');

describe('el yazısı kuralı metni', () => {
  it('iki geçerli yol da yazılı: kâğıt ve tablette soruların üzerine', () => {
    expect(YOLLAR.map((y) => y.baslik)).toEqual(['Kâğıtta', 'Tablette']);
    expect(YOLLAR[0]?.metin).toMatch(/kâğıda/);
    expect(YOLLAR[1]?.metin).toMatch(/soruların üzerine/);
    expect(YUKLEME_IPUCU).toMatch(/tablette soruların üzerine/);
  });

  it('kabul edilmeyenler açık: bilgisayar, kopya, yapay zekâ', () => {
    expect(KABUL_EDILMEYEN).toMatch(/Bilgisayarda yazılmış/);
    expect(KABUL_EDILMEYEN).toMatch(/kopyalanmış/);
    expect(KABUL_EDILMEYEN).toMatch(/yapay zekâ/);
  });

  it('sonuç açık: kurala uymayan ödev kabul edilmez — kart ve onay ikisi de söylüyor', () => {
    expect(KABUL_EDILMEYEN).toMatch(/ödevin kabul edilmez/);
    expect(ONAY).toMatch(/Aksi durumda ödevimin kabul edilmeyeceğini biliyorum/);
  });

  it('onay iki yolu da kapsıyor — tabletle çözen kendini dışarıda sanmasın', () => {
    expect(ONAY).toMatch(/kâğıtta ya da tablette/);
  });

  it('neden yazılı: kural gerekçesiyle veriliyor', () => {
    expect(NEDEN).toMatch(/nasıl düşündüğün/);
  });

  it('suçlayıcı dil yok', () => {
    // Sözcük sınırıyla: "kopyalanmış" içindeki "yalan" yanlış alarm vermesin.
    const sozcukler = hepsi.toLocaleLowerCase('tr').split(/[^\p{L}]+/u);
    for (const yasak of ['hile', 'yalan', 'ceza', 'cezası', 'kopyacı', 'hilekâr']) {
      expect(sozcukler).not.toContain(yasak);
    }
    expect(hepsi).not.toMatch(/kopya çek/i);
  });
});
