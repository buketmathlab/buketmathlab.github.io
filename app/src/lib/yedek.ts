/**
 * Yedek dosyasının adı, içeriği ve tazeliği — saf mantık.
 *
 * NEDEN VAR: bu ürün bir kez CANLI VERİTABANININ TAMAMINI kaybetti.
 * Öğrenciler, kodlar, ödevler, notlar, mesajlar; hiçbiri geri gelmedi.
 * O olaydan sonra yedekleme Faz 10'dan Faz 1'e alındı ve `disa_aktar`
 * sunucuda yazıldı — ama arayüze hiç bağlanmadı. Bu dosya o eksiği
 * kapatan turun parçası.
 *
 * `lib/` ilkesi: React'siz, DOM'suz, doğrudan test edilebilir. Dosya adı
 * ve tazelik hesabı sessiz hata üreten yerlerdir — yanlış tarihli bir
 * dosya adı, hangi yedeğin yeni olduğunu belirsizleştirir.
 */

/** Yedeğin cihazda ne kadar süre "taze" sayılacağı. */
const TAZE_GUN = 7;

export type YedekOzeti = {
  ogrenci: number;
  sinif: number;
  odev: number;
  gonderim: number;
  mesaj: number;
  kod: number;
  /**
   * Denetim izi satırı (0089). 0089 çalıştırılmamış sunucuda 0 —
   * `yedekIzNotu` o durumu AYRI bir cümleyle söylüyor, çünkü "0 satır"
   * ile "bu sürüm izi hiç almıyor" aynı şey değil.
   */
  iz: number;
  /** Sunucudaki toplam iz satırı; alan gelmezse null. */
  izToplam: number | null;
  /** 50 000 sınırına takılıp kesildi mi. */
  izKesildi: boolean;
};

/**
 * `sekiz-yedek-2026-08-14.json`
 *
 * Tarih dosya adında: aynı klasörde biriken yedeklerde hangisinin yeni
 * olduğu ada bakılarak anlaşılmalı. YEREL tarih kullanılıyor (UTC değil):
 * öğretmen dosyayı kendi gününe göre arıyor, sunucunun gününe göre değil.
 */
export function yedekDosyaAdi(tarih: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `sekiz-yedek-${tarih.getFullYear()}-${p(tarih.getMonth() + 1)}-${p(tarih.getDate())}.json`;
}

/**
 * Dosyada gerçekte ne olduğunu sayar.
 *
 * Öğretmene "yedek alındı" demek yetmez; NE alındığını göstermek gerekir.
 * Boş bir yanıt da "başarılı" görünürdü — sayılar bunu imkânsız kılıyor.
 */
export function yedekOzeti(veri: unknown): YedekOzeti {
  const d = (veri ?? {}) as Record<string, unknown>;
  const say = (ad: string) => (Array.isArray(d[ad]) ? (d[ad] as unknown[]).length : 0);
  const toplam = d['denetim_izi_toplam'];
  return {
    ogrenci: say('ogrenciler'),
    sinif: say('siniflar'),
    odev: say('odevler'),
    gonderim: say('gonderimler'),
    mesaj: say('mesajlar'),
    kod: say('giris_kodlari'),
    iz: say('denetim_izi'),
    izToplam: typeof toplam === 'number' ? toplam : null,
    izKesildi: d['denetim_izi_kesildi'] === true,
  };
}

/**
 * DENETİM İZİ CÜMLESİ (0089) — üç ayrı durum, üç ayrı cümle.
 *
 * Yedek 0034'ten beri denetim izini HİÇ almıyordu ve bu ancak gerçek bir
 * kayıp yaşandığında anlaşıldı: silinen gönderimlerin tek kanıtı o
 * tablodaydı ve yedekte yoktu. Artık alınıyor, ama 50 000 satırla
 * sınırlı — sınırsız alsaydık dosya bir gün tabletin belleğini aşardı.
 *
 * KESİLDİYSE SÖYLENİYOR. Sessizce eksik yedek vermek, yedeği hiç
 * vermemekten kötü olurdu: öğretmen elinde tam bir kopya olduğunu sanır.
 *
 * Uç yoksa (0089 henüz çalıştırılmamış) ayrı bir cümle: "0 satır" demek
 * yanlış olurdu, iz orada duruyor — yedeğe girmiyor.
 */
export function yedekIzNotu(o: YedekOzeti): string {
  if (o.izToplam === null) {
    return 'Denetim izi bu yedekte YOK. Sunucuda 0089 güncellemesi henüz '
      + 'çalıştırılmamış; çalıştırıldığında silinen gönderimlerin kaydı da yedeğe girer.';
  }
  if (o.izKesildi) {
    return `Denetim izinin yalnız EN YENİ ${o.iz} satırı alındı (sunucuda toplam `
      + `${o.izToplam}). Daha eski kayıtlar bu dosyada yok.`;
  }
  return `Denetim izi tam alındı: ${o.iz} satır.`;
}

/**
 * Yedek gerçekten veri içeriyor mu.
 *
 * Sunucu boş bir nesne döndürse ya da alan adları değişse, indirilen dosya
 * sessizce işe yaramaz olurdu ve bu ancak felaket anında anlaşılırdı —
 * yani her zaman çok geç. Yedek alınmadan önce denetleniyor.
 */
export function yedekGecerliMi(veri: unknown): boolean {
  if (veri === null || typeof veri !== 'object') return false;
  const d = veri as Record<string, unknown>;
  // Sekiz tablonun sekizi de dizi olarak gelmeli; biri eksikse yanıt
  // beklediğimiz şey değildir.
  for (const ad of [
    'siniflar',
    'ogrenciler',
    'giris_kodlari',
    'odevler',
    'gonderimler',
    'mesajlar',
    'dersler',
    'odemeler',
  ]) {
    if (!Array.isArray(d[ad])) return false;
  }
  return true;
}

/** Kaç gün önce yedek alındı. Hiç alınmadıysa null. */
export function yedekYasiGun(sonMs: number | null, simdi: number = Date.now()): number | null {
  if (sonMs === null || !Number.isFinite(sonMs)) return null;
  return Math.floor((simdi - sonMs) / 86_400_000);
}

/**
 * Öğretmene gösterilecek tazelik cümlesi ve tonu.
 *
 * `uyari` yalnız gerçekten eskidiğinde. Her açılışta uyarı vermek
 * uyarıyı görünmez kılar; kaybolan tek şey de zaten uyarının kendisi olur.
 */
export function yedekTazelik(yasGun: number | null): { metin: string; uyar: boolean } {
  if (yasGun === null) {
    return { metin: 'Bu cihazdan hiç yedek almadınız.', uyar: true };
  }
  if (yasGun <= 0) return { metin: 'Bugün yedek aldınız.', uyar: false };
  if (yasGun === 1) return { metin: 'Son yedek dün alındı.', uyar: false };
  return {
    metin: `Son yedek ${yasGun} gün önce alındı.`,
    uyar: yasGun > TAZE_GUN,
  };
}

/**
 * ÖDEV SİLME SEBEBİ (0089) — gönderimi olan ödevde zorunlu.
 *
 * Sunucu da reddediyor (`odev_sil`, 22023); burada söylemek öğretmeni
 * boşuna bir ağ turundan kurtarıyor. Düğme KAPATILMIYOR: bastığında
 * neyin eksik olduğunu görsün (el yazısı onayındaki kuralın aynısı).
 *
 * Sınırlar sunucudakiyle birebir: 3–500 karakter.
 */
export function silmeSebebiHatasi(gonderimSayisi: number, sebep: string): string | null {
  if (gonderimSayisi <= 0) return null;
  const s = sebep.trim();
  if (s.length < 3) return 'Bu ödevi neden sildiğinizi yazın.';
  if (s.length > 500) return 'Sebep en fazla 500 karakter olabilir.';
  return null;
}

/**
 * Silme penceresinde öğretmene ne olacağını söyleyen cümle.
 *
 * 0089: artık "geri alınamaz" demiyoruz, çünkü doğru değil — silinen her
 * gönderim tam satırıyla denetim izine yazılıyor ve oradan geri
 * getirilebiliyor. Ödevin kendisi listeden kalkar, puanlar kayıt altında
 * kalır. Yanlış bir söz vermek de, olmayan bir güvence vermek kadar kötü.
 */
export function silmeUyarisi(baslik: string, gonderimSayisi: number): string {
  if (gonderimSayisi <= 0) {
    return `“${baslik}” silinecek. Henüz gönderim yok.`;
  }
  return (
    `“${baslik}” silinecek. Bu ödeve yapılmış ${gonderimSayisi} gönderim ve puan da `
    + 'silinir. Hepsi denetim izine yazılıyor; gerekirse geri getirilebilir.'
  );
}
