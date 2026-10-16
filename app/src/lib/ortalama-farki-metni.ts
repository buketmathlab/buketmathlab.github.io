/**
 * İKİ ORTALAMA (0080) — öğrenci ve veli karnesindeki cümleler.
 * React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: *"yaptığı ödevden aldığı ortalaması ve yapılan
 * yapılmayan tüm ödevlerden aldığı ortalaması ayrı ayrı yazılsın…
 * amacım ödevini yaparsa ortalamasının ne kadar yükseleceğini görmesi."*
 *
 * İKİ SAYI SUNUCUDAN GELİYOR (`kendi_karnem`, tek yardımcı). Burada
 * yalnız ekrandaki iki sayının farkı alınıyor — ekranda okunan iki
 * sayıdan, ki cümledeki fark gözle yapılan çıkarmayla aynı çıksın.
 *
 * DÜRÜSTLÜK: "ödevini yaparsan ortalaman X olur" DENMİYOR — yapılacak
 * ödevin puanını bilmiyoruz. "Bu fark kapanır" da denmiyor: düşük puanlı
 * yeni bir ödev farkı büyütebilir. Söylenen, aritmetik olarak her zaman
 * doğru olan şey: yapılmayan ödevler tüm ödevler ortalamasını şu kadar
 * aşağı çekiyor ve yeni yapılan her ödevle sıfırların ağırlığı azalıyor.
 */

export type IkiOrtalama = {
  /** Yaptığı ve puanlanmış ödevlerin ortalaması (`genel_ortalama`). */
  yapilan: number | null;
  /** Tüm ödevler, yapılmayan 0 (`tum_ortalama`). */
  tum: number | null;
  yapilmayan: number;
  puanBekleyen: number;
};

export type Ses = 'ogrenci' | 'veli';

/**
 * Kart çizilsin mi? `tum_ortalama` gelmezse sunucu eski (0080 çalışmadı)
 * ve ekran eski "Genel ortalaman" satırıyla kalır. Süresi dolmuş ödev
 * yoksa da kart yok: iki tire yan yana bir şey söylemez.
 */
export function ikiOrtalamaVar(v: { tum_ortalama?: number | null; odev_sayisi: number }): boolean {
  return v.tum_ortalama !== undefined && v.odev_sayisi > 0;
}

/** Türkçe ondalık, tek hane: 78 → "78,0". */
export function puanYazisi(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export const ETIKET = {
  ogrenci: {
    yapilan: 'Yaptığın ödevlerin ortalaması',
    tum: 'Tüm ödevlerin ortalaması',
  },
  veli: {
    yapilan: 'Yaptığı ödevlerin ortalaması',
    tum: 'Tüm ödevlerin ortalaması',
  },
} as const;

/** Etiketin altındaki küçük açıklama. */
export const TUM_ACIKLAMA = 'yapılmayan ödev 0 sayılır';

/**
 * İki sayının arasındaki farkı anlatan cümle.
 *
 * `null` dönerse cümle yok: yaptığı ödevin puanı henüz yok ya da sunucu
 * eski (alan gelmedi).
 */
export function farkCumlesi(o: IkiOrtalama, ses: Ses): string | null {
  if (o.yapilan === null || o.tum === null) return null;

  if (o.yapilmayan === 0) {
    return ses === 'ogrenci'
      ? 'Süresi dolan bütün ödevlerini yaptın; iki ortalama aynı.'
      : 'Süresi dolan bütün ödevlerini yapmış; iki ortalama aynı.';
  }

  const fark = Math.round((o.yapilan - o.tum) * 10) / 10;
  const n = o.yapilmayan;
  if (ses === 'ogrenci') {
    return (
      `Yapmadığın ${n} ödev 0 sayıldığı için tüm ödevlerin ortalaması ` +
      `${puanYazisi(fark)} puan daha düşük. Bundan sonraki ödevlerini ` +
      'yaptıkça sıfır sayılan ödevlerin ortalamadaki ağırlığı azalır.'
    );
  }
  return (
    `Yapmadığı ${n} ödev 0 sayıldığı için tüm ödevlerin ortalaması ` +
    `${puanYazisi(fark)} puan daha düşük. Bundan sonraki ödevlerini ` +
    'yaptıkça sıfır sayılan ödevlerin ortalamadaki ağırlığı azalır.'
  );
}

/** Puanı verilmemiş gönderim notu; yoksa `null`. */
export function puanBekleyenNotu(n: number, ses: Ses): string | null {
  if (n <= 0) return null;
  return ses === 'ogrenci'
    ? `${n} ödevin puan bekliyor; puanı verilince iki ortalamaya da girer.`
    : `${n} ödevi puan bekliyor; puanı verilince iki ortalamaya da girer.`;
}
