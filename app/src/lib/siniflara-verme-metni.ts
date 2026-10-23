/**
 * ÖDEVİ BAŞKA SINIFLARA VERME CÜMLELERİ (0083) — React'siz, testli.
 *
 * Öğretmenin isteği: "10C'ye ödev gönderdim. Bu ödevin aynısını DAHA
 * SONRA istediğim diğer sınıflara da gönderebileyim."
 *
 * -----------------------------------------------------------------------------
 * NE TAŞINIR, NE TAŞINMAZ — EKRANDA YAZILI
 *
 * 0031'in yayma kartındaki kararın aynısı: kural sunucuda zorlanıyor,
 * burada yalnız SÖYLENİYOR. Öğretmen onaylamadan önce ne olacağını
 * bilmeli; "kopyalanır" demek yetmez, neyin kopyalanmadığı da bilgi.
 *
 * TASLAK OLDUĞU AYRICA YAZILI (öğretmenin kararı): kopya anında
 * öğrencinin ekranına düşmüyor, o yayınlayana kadar bekliyor.
 */

export const BASLIK = 'Bu ödevi başka sınıflara da ver';

export const ACIKLAMA =
  'Seçtiğiniz her sınıf için bu ödevin bir kopyası oluşur. ' +
  'Her sınıfın gönderimleri, puanları ve karnesi ayrı tutulur.';

/** Diyalogda, onaydan önce. */
export const TASLAK_UYARISI =
  'Kopyalar taslak olarak oluşur; her birini kendi sayfasından yayınlarsınız.';

/** Kopyaya taşınanlar — soru dosyaları yeniden yüklenmiyor. */
export const TASINAN = [
  'Başlık, açıklama ve sorular',
  'Cevap anahtarı ve konular',
  'Soru ve anahtar PDF’leri (yeniden yüklenmez)',
  'Sayfa sayısı ve geç teslim ayarı',
] as const;

/** Taşınmayanlar — her sınıfın kendi programı. */
export const TASINMAYAN = [
  'Son tarih — aşağıda siz veriyorsunuz',
  'Öğrenci gönderimleri ve puanlar',
] as const;

export const TARIH_ETIKETI = 'Yeni sınıfların son tarihi';
export const TARIH_EKSIK = 'Son tarihi seçin.';
export const TARIH_GECMIS = 'Son tarih bugünden önce olamaz.';
export const SINIF_EKSIK = 'En az bir sınıf seçin.';

/** Kardeş olacağı söyleniyor: sonraki düzeltmeler yayılabilsin. */
export const KARDES_NOTU =
  'Kopyalar bu ödevle bağlantılı kalır: bir anahtar düzeltmesini sonradan ' +
  'hepsine birden yayabilirsiniz.';

/** "3 sınıf seçildi" — sayı değişince cümle bozulmasın. */
export function secimSayaci(adet: number): string | null {
  return adet === 0 ? null : `${adet} sınıf seçildi`;
}

/**
 * Kopyalama sonrası bildirim. Sınıf adları yazılı: "2 sınıfa verildi"
 * hangi sınıflar olduğunu söylemez ve öğretmen yanlış seçtiğini fark
 * etmez.
 */
export function sonucMetni(siniflar: readonly string[]): string {
  if (siniflar.length === 0) return 'Hiçbir sınıfa verilmedi.';
  return `${siniflar.join(', ')} sınıfına taslak olarak eklendi. Yayınlamayı unutmayın.`;
}
