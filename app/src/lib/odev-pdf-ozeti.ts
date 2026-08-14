/**
 * Ödev (soru) PDF'inden okunabilenler.
 *
 * ÖLÇÜM ÖNCE YAPILDI. Öğretmenin gerçek ödev PDF'i
 * (`10C_uslu_koklu_SORULAR.pdf`, 4 sayfa) `pdfSatirlariniOku` hattından
 * geçirildi ve 37 satır çıktı. Sonuç, bu dosyanın ne yapıp ne yapmadığını
 * belirledi:
 *
 *   - SORULARIN METNİ PDF'TE YOK. Sorular görsel olarak gömülü (4 sayfada
 *     14 görsel çizimi, soru başına bir resim). Metin katmanında yalnız
 *     çerçeve var. Bu yüzden burada konu ÇIKARIMI yapılmıyor; yapılamaz.
 *   - Okunabilen çerçeve ise gerçekten işe yarıyor: soru sayısı, ödevin
 *     genel konusu ve sınıf.
 *
 * ÇIKTI BİR ÖNERİDİR (Part XXVIII). Hiçbir alan kendiliğinden dolmaz;
 * ekran ne bulunduğunu gösterir, öğretmen basarsa uygulanır. Cevap
 * anahtarı çıkarımında uygulanan kuralın aynısı.
 *
 * AŞIRI UYUM TEHLİKESİ AÇIKÇA KARŞILANIYOR. Elimizde tek bir PDF var ve o
 * da öğretmenin kendi şablonundan. Cevap anahtarı turunda tam tersi hata
 * yapılmıştı: kendi ürettiğim örneklere uyan bir desen, gerçek PDF'te 0/10
 * çıkmıştı. Bu yüzden desenler şablona değil iki GENEL sinyale dayanıyor,
 * ve "bulunamadı" normal bir sonuç sayılıyor.
 */

export type SoruSayisiKaynak = 'puan-tablosu' | 'soru-basliklari' | 'celiskili';

export type PdfOzeti = {
  /** Bulunamadıysa ya da sinyaller çeliştiyse null. */
  soruSayisi: number | null;
  soruSayisiKaynak: SoruSayisiKaynak | null;
  /** Çelişki hâlinde iki sinyalin ayrı ayrı bulduğu değerler. */
  puanTablosu: number | null;
  soruBasliklari: number | null;
  /** Ödevin genel konusu, örn. "Üslü ve Köklü Sayılar". */
  konu: string | null;
  /** Alt bilgideki sınıf, örn. "10C". */
  sinif: string | null;
};

/** Hiçbir sinyal bulunamadı mı — ekran kutuyu buna göre hiç çizmiyor. */
export function ozetBos(o: PdfOzeti): boolean {
  return o.soruSayisi === null && o.puanTablosu === null && o.konu === null && o.sinif === null;
}

/**
 * Makul soru sayısı sınırı.
 *
 * Üst sınır tahmin değil, mevcut şemanın sınırı: `odev_olustur` soru
 * sayısını 1–200 arasında kabul ediyor. Bunun dışında bir sayı okuduysak
 * yanlış satırı okumuşuzdur; öneri hiç yapılmaz.
 */
const EN_AZ = 1;
const EN_COK = 200;

/**
 * 1. SİNYAL — PUAN TABLOSU.
 *
 * Öğretmenin PDF'indeki satır:
 *   `SORU 1 2 3 4 5 6 7 8 9 10 TOPLAM`
 *
 * Desen şablona değil YAPIYA bakıyor: "SORU" ile başlayan ve ardından
 * 1'den N'e kadar ARDIŞIK sayılar gelen satır. Ardışıklık şartı, düz
 * metinde "soru" geçen bir cümlenin yanlışlıkla eşleşmesini engelliyor —
 * rastgele sayıların 1,2,3… diye sıralanma ihtimali yok.
 */
export function puanTablosundanSoruSayisi(satirlar: readonly string[]): number | null {
  for (const satir of satirlar) {
    const m = /^\s*SORU\b(.*)$/i.exec(satir);
    if (!m) continue;

    const sayilar = (m[1] ?? '').match(/\d+/g);
    if (!sayilar || sayilar.length < 2) continue;

    // Baştan itibaren 1, 2, 3 … diye giden en uzun diziyi al. Satırın
    // sonundaki TOPLAM sütunu (örn. 100) diziyi bozmadan dışarıda kalır.
    let n = 0;
    for (const s of sayilar) {
      if (Number(s) === n + 1) n += 1;
      else break;
    }
    if (n >= 2 && n <= EN_COK) return n;
  }
  return null;
}

/**
 * 2. SİNYAL — SORU BAŞLIKLARI.
 *
 * Öğretmenin PDF'indeki satırlar: `01 10 Puan`, `02 10 Puan` …
 *
 * BU SİNYAL GÜRÜLTÜLÜ ve bu ölçülerek görüldü: 06 numaralı soruda y
 * koordinatı kaydığı için satır ikiye bölünmüş (`10 Puan` ve `06` ayrı
 * satırlarda). Bu yüzden numaralar sayılmıyor, EN BÜYÜĞÜ alınıyor ve
 * yalnız 1..N'in tamamı bulunduysa sonuç veriliyor. Tek başına asla
 * belirleyici değil — birinci sinyalle karşılaştırılıyor.
 */
export function sorubasliklarindanSoruSayisi(satirlar: readonly string[]): number | null {
  const bulunan = new Set<number>();

  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i] ?? '';
    if (!/\bPuan\b/i.test(satir)) continue;

    // Aynı satırdaki baştaki numara: "01 10 Puan" → 1
    const bas = /^\s*(\d{1,3})\b/.exec(satir);
    if (bas) {
      const n = Number(bas[1]);
      if (n >= EN_AZ && n <= EN_COK) bulunan.add(n);
    }

    // Satır bölünmüşse numara komşu satırda tek başına duruyor: "06"
    for (const komsu of [satirlar[i - 1], satirlar[i + 1]]) {
      const m = /^\s*(\d{1,3})\s*$/.exec(komsu ?? '');
      if (!m) continue;
      const n = Number(m[1]);
      if (n >= EN_AZ && n <= EN_COK) bulunan.add(n);
    }
  }

  if (bulunan.size < 2) return null;
  const enBuyuk = Math.max(...bulunan);
  // 1..enBuyuk'ün TAMAMI bulunmalı. Eksik varsa yanlış satırları
  // okumuşuzdur ve sayı uydurmak yerine sinyali düşürüyoruz.
  for (let n = 1; n <= enBuyuk; n++) if (!bulunan.has(n)) return null;
  return enBuyuk;
}

/**
 * ÖDEVİN KONUSU — başlık satırının ilk `·` parçası.
 *
 * Öğretmenin satırı:
 *   `Üslü ve Köklü Sayılar · Değerlendirme Sınavı · 10. Sınıf · 2026`
 *
 * `·` ayracı markanın da ayracı ve öğretmenin şablonunda başlığı
 * bölümlere ayırıyor. İlk parça konu, gerisi sınav türü / sınıf / yıl.
 *
 * Okul adının geçtiği satırlar eleniyor: alt bilgi de `·` taşıyor
 * (`Buket Topuzoğlu · Matematik Öğretmeni · …`) ama konu değil.
 */
const OKUL_IZLERI = /lise|okul|öğretmen|ogretmen|matemat[iı]k\s*·|bölüm|bolum|beşiktaş|besiktas/i;

export function konuAdayi(satirlar: readonly string[]): string | null {
  for (const satir of satirlar) {
    if (!satir.includes('·')) continue;
    if (OKUL_IZLERI.test(satir)) continue;

    const ilk = (satir.split('·')[0] ?? '').trim();
    // Tek kelimelik ya da çok uzun bir parça konu adı olmaz; sayıdan
    // ibaret olan da (sayfa numarası gibi) elenir.
    if (ilk.length < 3 || ilk.length > 60) continue;
    if (!/\p{L}/u.test(ilk)) continue;
    return ilk.replace(/\s+/g, ' ');
  }
  return null;
}

/**
 * SINIF — alt bilgideki `· 10C ·` parçası.
 *
 * Öğretmenin satırı:
 *   `Buket Topuzoğlu · Matematik Öğretmeni MATEMATİK · 10C · ÜSLÜ-KÖKLÜ SAYILAR 01`
 *
 * Biçim `siniflar` tablosundaki `ad` ile aynı: seviye + şube harfi.
 * Eşleşme ekranda yapılıyor; burada yalnız aday çıkarılıyor.
 */
export function sinifAdayi(satirlar: readonly string[]): string | null {
  for (const satir of satirlar) {
    const m = /·\s*(\d{1,2}\s*[A-ZÇĞİÖŞÜ])\s*·/u.exec(satir);
    if (m?.[1]) return m[1].replace(/\s+/g, '').toUpperCase();
  }
  return null;
}

/**
 * Hepsini birleştirir.
 *
 * İKİ SİNYAL ÇELİŞİRSE HİÇBİRİ SEÇİLMEZ. Sessizce birini seçmek, yanlış
 * soru sayısıyla cevap anahtarının kırpılmasına yol açabilirdi
 * (`_konu_temizle` ve `odev_guncelle` soru sayısına göre kırpıyor). Ekran
 * ikisini de gösterip kararı öğretmene bırakıyor.
 */
export function odevPdfOzeti(satirlar: readonly string[]): PdfOzeti {
  const tablo = puanTablosundanSoruSayisi(satirlar);
  const basliklar = sorubasliklarindanSoruSayisi(satirlar);

  let soruSayisi: number | null = null;
  let kaynak: SoruSayisiKaynak | null = null;

  if (tablo !== null && basliklar !== null) {
    if (tablo === basliklar) {
      soruSayisi = tablo;
      kaynak = 'puan-tablosu';
    } else {
      kaynak = 'celiskili';
    }
  } else if (tablo !== null) {
    soruSayisi = tablo;
    kaynak = 'puan-tablosu';
  } else if (basliklar !== null) {
    soruSayisi = basliklar;
    kaynak = 'soru-basliklari';
  }

  return {
    soruSayisi,
    soruSayisiKaynak: kaynak,
    puanTablosu: tablo,
    soruBasliklari: basliklar,
    konu: konuAdayi(satirlar),
    sinif: sinifAdayi(satirlar),
  };
}
