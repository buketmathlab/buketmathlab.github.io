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
    expect(YOLLAR.map((y) => y.baslik)).toEqual(['Kâğıt üzerinde', 'iPad veya tablet üzerinde']);
    expect(YOLLAR[0]?.metin).toMatch(/kâğıda kalemle/);
    expect(YOLLAR[1]?.metin).toMatch(/soruların üzerine kalemle/);
    expect(YOLLAR[1]?.metin).toMatch(/Bu da el yazısı sayılır/);
    expect(YUKLEME_IPUCU).toMatch(/iPad\/tablette/);
  });

  it('kabul edilmeyenler açık: klavye, başkasından alınmış, yapay zekâ', () => {
    expect(KABUL_EDILMEYEN).toMatch(/Klavyeyle yazılmış/);
    expect(KABUL_EDILMEYEN).toMatch(/başkasından alınmış/);
    expect(KABUL_EDILMEYEN).toMatch(/yapay zekâ/);
  });

  it('cihaz adıyla yasak yok — iPad\'de kalemle yazan kendini dışarıda sanmasın', () => {
    expect(hepsi).not.toMatch(/bilgisayar/i);
  });

  it('sonuç açık: kurala uymayan ödev kabul edilmez — kart ve onay ikisi de söylüyor', () => {
    expect(KABUL_EDILMEYEN).toMatch(/ödevin kabul edilmez/);
    expect(ONAY).toMatch(/Aksi durumda ödevimin kabul edilmeyeceğini biliyorum/);
  });

  it('onay el yazısını söylüyor', () => {
    expect(ONAY).toMatch(/kendi el yazımdır/);
  });

  it('neden yazılı: kural gerekçesiyle veriliyor', () => {
    expect(NEDEN).toMatch(/nasıl düşündüğünü/);
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
