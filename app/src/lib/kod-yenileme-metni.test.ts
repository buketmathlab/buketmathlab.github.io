import { describe, expect, it } from 'vitest';
import { yenilemeMetni } from './kod-yenileme-metni';

describe('yenilemeMetni', () => {
  /**
   * ÖĞRETMENİN SORUSUNUN ÖLÇÜMÜ: *"Kaydetmeleri gerektiğini hatırlatıyor
   * değil mi?"*
   *
   * İKİ AYRI ANDA hatırlatılıyor ve ikisi ayrı ayrı aranıyor — yalnız
   * birini ölçmek, ötekini silen bir değişikliği görmezdi.
   *
   *   ÖNCE: onay penceresinde, geri alınamaz işlemden önce
   *   SONRA: kod ekrandayken, kapatmadan önce
   */
  it('not alma hatırlatması HEM onayda HEM sonuçta var', () => {
    // Fiiller muhataba göre ayrıldığı için ("not et" / "not edin") her
    // tür kendi kipiyle aranıyor. Ortak bir ön ek ('not e') aramak
    // gevşek olurdu: veliye "not et" yazan bir kusuru geçirirdi.
    const o = yenilemeMetni('ogrenci');
    expect(o.onayUyarilari.join(' ')).toContain('not et.');
    expect(o.sonucNotlari.join(' ')).toContain('not et.');

    const v = yenilemeMetni('veli');
    expect(v.onayUyarilari.join(' ')).toContain('not edin.');
    expect(v.sonucNotlari.join(' ')).toContain('not edin.');
  });

  /**
   * GERİ ALINAMAZLIK ÖNCEDEN SÖYLENİYOR.
   *
   * "Eski kod ölecek" bilgisi SONUÇ penceresinde de var ama orada geç:
   * iş olmuş bitmiş olur. Ölçüm ONAY penceresini arıyor.
   */
  it('eski kodun öleceği ONAY penceresinde yazıyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const onay = yenilemeMetni(tur).onayUyarilari.join(' ');
      expect(onay).toContain('çalışmaz olur');
    }
  });

  /**
   * FİŞ ÖZELLİKLE ANILIYOR. Kâğıt güncellenmiyor; bunu söylememek,
   * eline kâğıdı alıp güvenen veliyi sonradan şaşırtmak olurdu.
   */
  it('fişteki kodun da öleceği söyleniyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const onay = yenilemeMetni(tur).onayUyarilari.join(' ').toLocaleLowerCase('tr');
      expect(onay).toContain('fiş');
    }
  });

  /**
   * ÖTEKİ TELEFONUN DÜŞECEĞİ SÖYLENİYOR — özelliğin varlık sebebi bu.
   * Kullanıcı ne satın aldığını bilmeli: bu bir "şifre değiştirme"
   * değil, "sızanı dışarı atma".
   */
  it('öteki girişin kapanacağı yazıyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const onay = yenilemeMetni(tur).onayUyarilari.join(' ');
      expect(onay).toContain('başka bir telefondan');
      expect(onay).toContain('kapanır');
    }
  });

  /**
   * KURTARMA YOLU YAZILI — ve bu cümle DOĞRU olduğu için var.
   * `ogrenci_kodlari` (0033) kodu saklamıyor, her açılışta tablodan
   * okuyor; öğretmen yürürlükteki kodu her zaman görüyor. Boş bir
   * teselli değil, ölçülmüş bir gerçek.
   */
  it('öğretmenin görebildiği sonuçta söyleniyor (panik önleyici)', () => {
    expect(yenilemeMetni('ogrenci').sonucNotlari.join(' ')).toContain('öğretmenin görebiliyor');
    expect(yenilemeMetni('veli').sonucNotlari.join(' ')).toContain('öğretmeniniz görebiliyor');
  });

  /**
   * MUHATAP: öğrenciye sen, veliye siz. Fişte verilen kararın aynısı.
   *
   * ÖLÇÜM İKİ YÖNLÜ: yalnız velide "siz" aramak yetmezdi — her iki
   * metni de "siz" yapan bir değişiklik o testi geçerdi.
   */
  it('öğrenciye sen, veliye siz diye sesleniyor', () => {
    const o = yenilemeMetni('ogrenci');
    const v = yenilemeMetni('veli');

    expect(o.baslik).toBe('Giriş kodun');
    expect(v.baslik).toBe('Giriş kodunuz');
    expect(o.aciklama).toContain('yenileyebilirsin.');
    expect(v.aciklama).toContain('yenileyebilirsiniz.');
    expect(o.kapatDugmesi).toBe(v.kapatDugmesi); // düğme fiilsiz, ortak
  });

  /**
   * NEGATİF KONTROL — VELİ METNİNDE "SEN" KALINTISI YOK.
   *
   * Öğrenci metnini kopyalayıp yalnız bir iki fiili değiştirmek kolay ve
   * kalıntı bırakır. Veli metninin tamamı taranıyor.
   */
  it('veli metninde sen diline kayma yok', () => {
    const v = yenilemeMetni('veli');
    const hepsi = [
      v.baslik,
      v.aciklama,
      v.onayBasligi,
      ...v.onayUyarilari,
      v.sonucBasligi,
      ...v.sonucNotlari,
    ].join(' ');

    for (const kalinti of ['kodun ', 'kodunu ', 'fişindeki', 'öğretmenin ', 'not et.', 'unutursan ']) {
      expect(hepsi).not.toContain(kalinti);
    }
  });

  /**
   * KART, İŞİ YAPMADAN ÖNCE NE OLACAĞINI SÖYLÜYOR.
   *
   * Düğmenin tek başına durduğu bir kart, kullanıcıyı onay penceresini
   * okumaya mecbur bırakırdı. Açıklama kartın üstünde.
   */
  it('kartta düğmeden önce bir açıklama var', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = yenilemeMetni(tur);
      expect(m.aciklama.length).toBeGreaterThan(20);
      expect(m.dugme).toContain('yenile');
    }
  });

  /** Kâğıda basılmıyor ama ekranda da paragraf olmamalı. */
  it('hiçbir satır paragrafa dönüşmüyor', () => {
    for (const tur of ['ogrenci', 'veli'] as const) {
      const m = yenilemeMetni(tur);
      for (const s of [m.aciklama, ...m.onayUyarilari, ...m.sonucNotlari]) {
        expect(s.length).toBeLessThanOrEqual(80);
      }
    }
  });
});
