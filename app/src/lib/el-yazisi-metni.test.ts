import { describe, expect, it } from 'vitest';
import {
  BASLIK,
  KABUL_EDILMEYEN,
  NEDEN,
  NUMARA_KURALI,
  ONAY,
  ONAY_EKSIK,
  YOLLAR,
  yollariSec,
} from './el-yazisi-metni';

const hepsi = [BASLIK, NEDEN, KABUL_EDILMEYEN, ONAY, ONAY_EKSIK, ...YOLLAR.map((y) => y.metin)].join(' ');

describe('el yazısı kuralı metni', () => {
  /**
   * SIRA: çıktı → tablet → boş kâğıt.
   *
   * İlk iki yolun ortak yanı, çözümün SORULARIN ÜZERİNE yazılması —
   * kâğıtta ya da ekranda. Boş kâğıt ikisinden de ayrı ve en sonda
   * (öğretmenin ikinci düzeltmesi: boş kâğıt ile tablet yer değiştirdi).
   */
  it('üç geçerli yol da yazılı: çıktı, tablet, boş kâğıt', () => {
    expect(YOLLAR.map((y) => y.baslik)).toEqual([
      'Çıktı alınmış soru kâğıdında',
      'iPad veya tablet üzerinde',
      'Boş kâğıt üzerinde',
    ]);
    expect(YOLLAR[0]?.metin).toMatch(/soruların üzerine ve altındaki/);
    expect(YOLLAR[1]?.metin).toMatch(/soruların üzerine kalemle/);
    expect(YOLLAR[1]?.metin).toMatch(/Bu da el yazısı sayılır/);
    expect(YOLLAR[2]?.metin).toMatch(/boş kâğıda çöz/);
  });

  /** Boş kâğıt SON sırada: yürüyen bir yol, ama tercih edilen değil. */
  it('boş kâğıt yolu en sonda', () => {
    expect(YOLLAR.at(-1)?.baslik).toBe('Boş kâğıt üzerinde');
  });

  /**
   * SIRA ÖĞRETMENİN KARARI, kozmetik değil: çıktı alınmış soru kâğıdı
   * ÖNERİLEN yol ve birinci sırada. Diziyi yeniden sıralamak kararı
   * sessizce geri almak olurdu.
   */
  it('önerilen yol çıktı kâğıdı ve birinci sırada', () => {
    expect(YOLLAR[0]?.onerilen).toBe(true);
    expect(YOLLAR.filter((y) => y.onerilen)).toHaveLength(1);
    expect(YOLLAR[0]?.metin).toMatch(/Soruları yazdır/);
  });

  /**
   * BOŞ KÂĞIT YOLU DURUYOR — yazıcısı olmayan öğrenci ödev gönderemez
   * hâle gelmesin (öğretmenin kararı). Ama numara kuralıyla birlikte.
   */
  it('boş kâğıt yolu duruyor ve soru numarası isteniyor', () => {
    const bos = YOLLAR.find((y) => y.baslik === 'Boş kâğıt üzerinde');
    expect(bos).toBeDefined();
    expect(bos?.metin).toContain(NUMARA_KURALI);
    expect(NUMARA_KURALI).toMatch(/soru numarasını yaz/);
  });

  /**
   * SORU DOSYASI OLMAYAN ÖDEVDE OLMAYAN DÜĞME TARİF EDİLMİYOR.
   *
   * Öğretmen bazı ödevlere soru dosyası eklemiyor. O ödevde ekranda ne
   * "Soruları yazdır" var ne "Soruları aç (PDF)"; üç yolu birden
   * göstermek, olmayan iki düğmeyi tarif etmek olurdu. Ekran görüntüsü
   * alınınca görüldü.
   */
  it('soru dosyası yoksa yalnız boş kâğıt yolu kalıyor', () => {
    const hepsi = yollariSec(true);
    expect(hepsi).toHaveLength(3);
    expect(hepsi).toEqual(YOLLAR);

    const dosyasiz = yollariSec(false);
    expect(dosyasiz.map((y) => y.baslik)).toEqual(['Boş kâğıt üzerinde']);
    // Olmayan düğmelerin adı hiç geçmiyor.
    const m = dosyasiz.map((y) => y.metin).join(' ');
    expect(m).not.toMatch(/Soruları yazdır|Soruları aç/);
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
