/**
 * Son tarihi insan diliyle anlatma.
 *
 * Ayrı bir modülde olmasının sebebi: iki ekran (ödev listesi ve teslim
 * ekranı) aynı cümleyi kullanıyor ve ikisi ayrışırsa listede "yarın son
 * gün" yazarken teslim ekranında "süresi doldu" yazabilir. Ayrıca gün
 * hesabı tarih aritmetiği içeriyor; DOM'suz test edilebilmesi gerekiyor.
 *
 * SAAT DİLİMİ: karşılaştırma cihazın yerel gününe göre yapılıyor.
 * Sunucudaki denetim de Türkiye gününü kullanıyor (`odev_gonder`,
 * migration 0010), dolayısıyla Türkiye'deki bir öğrencide ikisi aynı günü
 * gösterir. Yurt dışındaki bir cihazda ekran bir gün şaşabilir; kararı
 * yine sunucu verdiği için puanlamayı etkilemez.
 */

export type SureDurumu = {
  metin: string;
  /** Son üç gün: kart vurgulanır. */
  acil: boolean;
  gecti: boolean;
};

/** `son_tarih` (YYYY-AA-GG) ile bugün arasındaki tam gün farkı. */
export function gunFarki(sonTarih: string, bugunIso?: string): number {
  const bugun = bugunIso ? yerelTarih(bugunIso) : new Date();
  bugun.setHours(0, 0, 0, 0);
  const s = yerelTarih(sonTarih);
  s.setHours(0, 0, 0, 0);
  return Math.round((s.getTime() - bugun.getTime()) / 86_400_000);
}

/**
 * `YYYY-AA-GG` metnini YEREL tarih olarak kurar.
 *
 * `new Date('2026-08-12')` bu biçimi UTC gece yarısı sayar; UTC+3'te bu
 * hâlâ aynı gün olsa da negatif farklı bölgelerde bir gün geriye kayar.
 * Alanları tek tek vermek bu sürprizi tamamen kaldırıyor.
 */
function yerelTarih(iso: string): Date {
  const [y, a, g] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y ?? 1970, (a ?? 1) - 1, g ?? 1);
}

export function sureDurumu(sonTarih: string, bugunIso?: string): SureDurumu {
  const f = gunFarki(sonTarih, bugunIso);
  if (f < 0) return { metin: 'Süresi doldu', acil: false, gecti: true };
  if (f === 0) return { metin: 'Bugün son gün', acil: true, gecti: false };
  if (f === 1) return { metin: 'Yarın son gün', acil: true, gecti: false };
  return { metin: `${f} gün kaldı`, acil: f <= 3, gecti: false };
}
