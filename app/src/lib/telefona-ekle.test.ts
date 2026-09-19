import { describe, expect, it } from 'vitest';
import {
  GIRIS_EKRANI_BASLIGI,
  KAPANIS_NOTU,
  TELEFON_YOLLARI,
  telefonBasligi,
} from './telefona-ekle';

/**
 * BU DOSYANIN TAMAMI DÖRT YANLIŞ TARİFİN KARŞILIĞI.
 *
 * Tarif dört turda dört kez yanlış yazıldı ve dördünü de ölçüm değil,
 * öğretmenin gerçek telefonu buldu. Buradaki her satır, o yanlışlardan
 * birinin geri dönmesini engelliyor — yani hiçbiri süs değil, hepsinin
 * bir hikâyesi var.
 */
describe('telefona-ekle', () => {
  const yol = (parca: string) =>
    TELEFON_YOLLARI.find((y) => y.ad.includes(parca));

  it('üç tarayıcı da var', () => {
    // Samsung Internet eksikti ve öğretmenin telefonundaki VARSAYILAN
    // tarayıcı oydu — yani eksik olan şey kenar durum değil, çoğunluktu.
    expect(TELEFON_YOLLARI).toHaveLength(3);
    expect(yol('iOS')).toBeDefined();
    expect(yol('Chrome')).toBeDefined();
    expect(yol('Samsung')).toBeDefined();
  });

  /**
   * SAHA BULGUSU 1: "Safari" yazmadan tarif işe yaramıyor. Öğretmen
   * bağlantıyı bir uygulamanın içinden açmıştı ve iOS'ta uygulama içi
   * tarayıcıda "Ana Ekrana Ekle" seçeneği HİÇ YOK.
   */
  it('iOS yolu Safari diyor ve uygulama içi tarayıcıyı uyarıyor', () => {
    const m = [yol('iOS')!.kisa, ...yol('iOS')!.adimlar].join(' ');
    expect(m).toContain('Safari');
    expect(m).toContain('uygulamanın içinden');
  });

  /**
   * SAHA BULGUSU 2 ve 3: düğmenin YERİ yazmalı, ve o düğme ÜÇ NOKTA.
   * Önce yeri eksikti; sonra "paylaş simgesi" yazdım, oysa bugünkü
   * iOS'ta alttaki düğme üç nokta ve Paylaş onun içinden çıkıyor.
   */
  it('iOS yolu alttaki üç noktayı ve Paylaş adımını söylüyor', () => {
    const m = [yol('iOS')!.kisa, ...yol('iOS')!.adimlar].join(' ');
    expect(m).toContain('alt');
    expect(m).toContain('üç nokta');
    expect(m).toContain('Paylaş');
  });

  /**
   * SAHA BULGUSU 4 — ÖĞRETMENİN EKRAN GÖRÜNTÜSÜYLE KANITLADIĞI KUSUR.
   *
   * Fişte "sağ üstteki üç nokta → Ana ekrana ekle" yazıyordu. Samsung
   * Internet'te üç nokta SAĞ ALTTA ve menüde "Ana ekrana ekle" diye bir
   * şey YOK; yerine "Sayfa ekle" var. Bu test o kusurun geri dönmesini
   * engelliyor.
   */
  it('Samsung yolu SAĞ ALTTAKİ üç noktayı ve "Sayfa ekle"yi söylüyor', () => {
    const m = [yol('Samsung')!.kisa, ...yol('Samsung')!.adimlar].join(' ');
    expect(m).toContain('alt');
    expect(m).toContain('Sayfa ekle');
    expect(m).toContain('Ana ekran');
  });

  /**
   * İKİ ANDROID YOLU KARIŞMAMALI: Chrome'da menü ÜSTTE, Samsung'da
   * ALTTA. Tek bir "üç nokta" araması yapsaydık, iki satırdan biri
   * silinse öteki eşleşme testi yeşil tutardı.
   */
  it('Chrome yolu ÜSTTEKİ menüyü söylüyor, Samsung ALTTAKİNİ', () => {
    expect(yol('Chrome')!.kisa).toContain('üst');
    expect(yol('Samsung')!.kisa).toContain('alt');
    expect(yol('Chrome')!.kisa).not.toContain('alt');
  });

  /**
   * ÖĞRETMENİN KARARI: "Apple/iPhone" değil "iOS".
   *
   * Gerekçesi sağlam — iPad de aynı sistemi kullanıyor ve tarif orada da
   * aynı; "iPhone" yazmak iPad'i olan veliyi dışarıda bırakırdı.
   */
  it('Apple tarafı "iOS" diye anılıyor, "iPhone" geçmiyor', () => {
    const hepsi = TELEFON_YOLLARI.flatMap((y) => [y.ad, y.kisa, ...y.adimlar]).join(' ');
    expect(hepsi).toContain('iOS');
    expect(hepsi).not.toContain('iPhone');
    expect(hepsi).not.toContain('Apple');
  });

  /**
   * TİPOGRAFİK ÜÇ NOKTA KARAKTERİ YOK. "⋮" ve "⋯" yazı tipine göre boş
   * kutu çıkıyor; kâğıtta bunu düzeltmenin yolu yok. Kelime her yerde
   * doğru.
   */
  it('tipografik üç nokta karakteri hiçbir yerde yok', () => {
    const hepsi = [
      ...TELEFON_YOLLARI.flatMap((y) => [y.ad, y.kisa, ...y.adimlar]),
      GIRIS_EKRANI_BASLIGI,
      KAPANIS_NOTU,
    ].join(' ');
    for (const k of ['⋮', '⋯', '…']) {
      expect(hepsi).not.toContain(k);
    }
  });

  /**
   * NEYİ BİLMEDİĞİMİZ DE KAYITLI.
   *
   * Yalnız iOS yolu gerçek bir cihazda görüldü (öğretmen denedi ve
   * oldu). Chrome ve Samsung yolları belgelerden ve öğretmenin ekran
   * görüntüsünden; son adımları hiçbir Android'de doğrulanmadı.
   *
   * Bu test, birinin bir gün "hepsi tamam" diye işaretlemesini
   * engelliyor. Bilinmeyeni bilinen gibi göstermek, dört yanlış tarifin
   * ortak sebebiydi.
   */
  it('cihazda doğrulanmış tek yol iOS', () => {
    expect(yol('iOS')!.cihazda_dogrulandi).toBe(true);
    expect(yol('Chrome')!.cihazda_dogrulandi).toBe(false);
    expect(yol('Samsung')!.cihazda_dogrulandi).toBe(false);
  });

  /**
   * KÂĞIT SINIRI. Fişte bir satıra 9px yazıyla ~71 harf sığıyor
   * (ölçüldü). Uzun `kisa` satırı alt satıra taşar, fiş büyür ve A4
   * ölçümü kırmızı yanar — ama o ancak derleme sonrası anlaşılır.
   * Burada, saniyeler içinde yakalanıyor.
   */
  it('fişe basılan kısa satırlar 71 harfi geçmiyor', () => {
    for (const y of TELEFON_YOLLARI) {
      expect(y.kisa.length, `${y.ad}: ${y.kisa.length} harf`).toBeLessThanOrEqual(71);
    }
  });

  it('başlık öğrenciye "sen", veliye "siz" diyor', () => {
    expect(telefonBasligi('sen')).toContain('Telefonuna');
    expect(telefonBasligi('siz')).toContain('Telefonunuza');
    expect(telefonBasligi('sen')).toContain('uygulama olarak');
    expect(telefonBasligi('siz')).toContain('uygulama olarak');
  });

  /**
   * NASIL AÇILACAĞINA DAİR SÖZ VERİLMİYOR.
   *
   * iOS'ta tarayıcı çubuğu olmadan açılıyor (etiketler ölçüldü).
   * Android'de depoda service worker olmadığı için simge sayfayı
   * tarayıcı içinde açıyor olabilir ve bu BİZDE ÖLÇÜLMEDİ. Kapanış
   * notu bu yüzden yalnız "adres yazmadan açarsınız" diyor.
   */
  it('kapanış notu tarayıcısız açılma sözü vermiyor', () => {
    const n = KAPANIS_NOTU.toLocaleLowerCase('tr');
    expect(n).not.toContain('tarayıcı çubuğu');
    expect(n).not.toContain('tam ekran');
    expect(KAPANIS_NOTU).toContain('adres yazmadan');
  });
});
