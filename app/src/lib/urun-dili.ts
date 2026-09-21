/**
 * ÜRÜN DİLİ NÖBETÇİSİ — övgü yok, gerekçe yok.
 *
 * Öğretmenin kuralı: *"Genel olarak tüm cümleler öyle olmalı."* Yazılı
 * olmayan bir kural bir sonraki turda yeniden bozulur; bu dosya kuralı
 * yazıya ve ölçüme çeviriyor. `urun-dili.test.ts` bütün kaynağı tarıyor
 * ve buradaki kalıplardan biri geri gelirse KIRMIZI yanıyor.
 *
 * -----------------------------------------------------------------------------
 * DÜRÜST SINIR — bu nöbetçinin ÖLÇMEDİĞİ şey
 *
 * Burada ölçülen tek şey GERİLEME: daha önce hakkında karar verdiğimiz
 * bir kalıbın geri gelmesi. Hiç görmediği yeni bir övgü cümlesini
 * yakalayamaz; bir düzenli ifadenin üslup yargısı yoktur. "Eline
 * sağlık"ı yakalar, "Ne güzel yapmışsın"ı yakalamaz.
 *
 * Bunu yazmak, ölçümü gereksiz kılmıyor — ne söz verdiğini netleştiriyor.
 * Bu deponun kuralı: ölçemediğimiz şeyi ölçtüğümüzü söylemeyiz.
 *
 * -----------------------------------------------------------------------------
 * NEDEN `karne-sozu.ts`'TEKİ LİSTE YENİDEN KULLANILMIYOR
 *
 * Depoda "ikinci liste yazma" diye bir uyarı var ve haklı (aynı hata
 * `eslint.config.js`'te iki kez yaşandı). Ama o uyarı AYNI KAPSAM için
 * geçerli; bunlar farklı kapsamlar:
 *
 *   `karne-sozu.ts` → `YASAKLI_KELIMELER` = `ortalama`, `sıralama`,
 *   `sınıfın`, `yükseliyor`… Konu karnesi cümlesine özel, çünkü orada
 *   kıyas ve eğilim iddiası yasak. Bu liste BÜTÜN kaynağa uygulansaydı
 *   öğretmenin KENDİ sınıf ortalaması ekranını kırardı — orada sınıf
 *   ortalaması meşru ve gerekli bir bilgi.
 *
 *   Buradaki liste → çocuğa/veliye söylenen övgü ve dayatılan gerekçe.
 *   Ekran ayrımı değil, CÜMLE TÜRÜ ayrımı.
 *
 * İki liste birleştirilirse ya biri gevşer ya öteki yanlış yerde ısırır.
 *
 * -----------------------------------------------------------------------------
 * `Harika!` YASAK DEĞİL, `Harikasın` YASAK — çizgi tam burada
 *
 * `ewalu-puan.ts`'te 100 puan alan öğrenciye "Harika! Konuyu gerçekten
 * iyi kavramışsın." deniyor. O cümle ÖĞRETMENİNDİR (Kural 9) ve
 * ÖLÇÜLMÜŞ bir sonucun karşılığı — hak edilmiş.
 *
 * Yasaklanan `Harikasın`: biri İŞİ nitelendiriyor, öbürü ÇOCUĞU. Bu
 * ayrım uydurulmadı; deponun kendi yazılı kuralı (`karne-sozu.ts`:
 * "ÇOCUĞU DEĞİL İŞİ İŞARET EDİYOR") burada yeniden kullanılıyor.
 */

export type YasakKalip = {
  /** Kaynakta aranan metin (küçük harfe çevrilmiş hâliyle karşılaştırılır). */
  kalip: string;
  /** Neden yasak — hata çıktısında öğretmenin gerekçesi görünsün diye. */
  neden: string;
};

/**
 * HAK EDİLMEMİŞ ÖVGÜ.
 *
 * Ürün, ölçülmüş bir sonuç olmadan çocuk hakkında iyi bir şey
 * söylememeli. "Bekleyen ödevin yok. Eline sağlık." tam olarak buydu:
 * hiç ödev verilmemiş öğrenci, hiçbir şey yapmadan tebrik ediliyordu.
 */
export const OVGU_KALIPLARI: readonly YasakKalip[] = [
  { kalip: 'eline sağlık', neden: 'hak edilmemiş övgü (öğretmenin düzeltmesi)' },
  { kalip: 'aferin', neden: 'çocuğu değil işi işaret et' },
  { kalip: 'bravo', neden: 'hak edilmemiş övgü' },
  { kalip: 'harikasın', neden: 'çocuğu niteliyor; "Harika!" (işi niteleyen) serbest' },
  { kalip: 'süpersin', neden: 'çocuğu niteliyor' },
  { kalip: 'tebrikler', neden: 'ölçülmüş bir sonuç olmadan kutlama' },
  { kalip: 'kolay gelsin', neden: 'konuşma dili; ürün cümlesi değil' },
];

/**
 * GEREKÇE DAYATAN KOŞUL.
 *
 * Öğretmenin sözü: *"Bir gerekçeye ihtiyacınız yok, kodu yenilemek
 * için."* Ürün, kullanıcıdan kendi hakkını kullanmak için mazeret
 * istemez. Ve teselli de etmez: "Merak etme" cümlesi, ortada merak
 * edilecek bir şey olduğunu varsayar.
 */
export const GEREKCE_KALIPLARI: readonly YasakKalip[] = [
  { kalip: 'öğrendiyse yenile', neden: 'kod yenilemek için sebep istemiyoruz' },
  { kalip: 'merak etme', neden: 'ortada merak edilecek bir şey olduğunu varsayıyor' },
  { kalip: 'merak etmeyin', neden: 'ortada merak edilecek bir şey olduğunu varsayıyor' },
  { kalip: 'endişelenme', neden: 'kaygı sözcüğü ürün dilinde yok' },
  { kalip: 'endişelenmeyin', neden: 'kaygı sözcüğü ürün dilinde yok' },
];

export const YASAK_KALIPLAR: readonly YasakKalip[] = [
  ...OVGU_KALIPLARI,
  ...GEREKCE_KALIPLARI,
];

/**
 * Bir metinde yasak kalıp arar.
 *
 * Türkçe küçük harfe çevirme `toLocaleLowerCase('tr')` ile yapılıyor:
 * JavaScript'in varsayılanı "I" harfini "i" yapar, Türkçede "ı" olması
 * gerekir. Bu depoda daha önce yaşanmış bir hata.
 *
 * @returns bulunan kalıplar; hiçbiri yoksa boş dizi
 */
export function yasakKaliplariBul(metin: string): YasakKalip[] {
  const kucuk = metin.toLocaleLowerCase('tr');
  return YASAK_KALIPLAR.filter((y) => kucuk.includes(y.kalip));
}

/**
 * Kaynaktan YORUMLARI atar; geri kalan her şeyi olduğu gibi bırakır.
 *
 * NEDEN GEREKTİ — ve bunu ilk tarama söyledi. Nöbetçi yazıldığı anda
 * dört bulgu verdi ve dördü de YORUMDU: bu dosyaların başlıkları,
 * yasak kalıpların neden yasak olduğunu anlatmak için onları tırnak
 * içinde ANIYOR. Kuralın gerekçesini silmek, kuralı korumanın bedeli
 * olamaz. Kural kullanıcının OKUDUĞU metin hakkında; yorumu kullanıcı
 * okumuyor.
 *
 * Dize içindeki `//` korunuyor (`'https://…'` bir yorum değildir);
 * tarayıcı dize, şablon ve yorum durumlarını ayrı ayrı takip ediyor.
 *
 * DÜRÜST SINIR: bu sözcüksel bir yaklaşım, TypeScript ayrıştırıcısı
 * değil. İçinde `//` geçen bir DÜZENLİ İFADE değişmezi (`/\/\//` gibi)
 * satırın kalanını yorum sanılıp atılabilir. Böyle bir durumda ölçüm
 * GEVŞER (kaçırır), yanlış yere ısırmaz — ve depoda o kalıpta bir
 * kullanıcı cümlesi yok.
 */
export function yorumlariAt(kaynak: string): string {
  let cikti = '';
  let i = 0;
  // 'kod' | 'satir' (//) | 'blok' (/* */) | dize kapatıcısının kendisi
  let durum: 'kod' | 'satir' | 'blok' | '"' | "'" | '`' = 'kod';

  while (i < kaynak.length) {
    const c = kaynak[i]!;
    const sonraki = kaynak[i + 1];

    if (durum === 'kod') {
      if (c === '/' && sonraki === '/') {
        durum = 'satir';
        i += 2;
        continue;
      }
      if (c === '/' && sonraki === '*') {
        durum = 'blok';
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') durum = c;
      cikti += c;
      i += 1;
      continue;
    }

    if (durum === 'satir') {
      if (c === '\n') {
        durum = 'kod';
        cikti += c;
      }
      i += 1;
      continue;
    }

    if (durum === 'blok') {
      if (c === '*' && sonraki === '/') {
        durum = 'kod';
        i += 2;
        continue;
      }
      // Satır sayısı korunsun diye satır sonları bırakılıyor: hata
      // çıktısında satır numarası anlamını korur.
      if (c === '\n') cikti += c;
      i += 1;
      continue;
    }

    // Dize içindeyiz. Ters bölü bir sonraki karakteri kaçırır.
    if (c === '\\') {
      cikti += c + (sonraki ?? '');
      i += 2;
      continue;
    }
    if (c === durum) durum = 'kod';
    cikti += c;
    i += 1;
  }

  return cikti;
}
