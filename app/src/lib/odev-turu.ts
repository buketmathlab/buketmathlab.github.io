/**
 * ÖDEV TÜRLERİ (0086) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: "Çalışma kağıdı şeklinde de ödev verilebilsin. Puan
 * hesaplaması yapılmadan ödevi gönderip göndermediği şeklinde
 * tamamlansın... Ama bu ayrı bir kategoride olsun."
 *
 * -----------------------------------------------------------------------------
 * NEDEN TEK MODÜL
 *
 * 0086'dan önce tür adı sekiz ayrı yerde `tur === 'test' ? 'Test' :
 * 'Açık uçlu'` diye yazılıydı. Üçüncü tür eklenince bu kalıbın HER BİRİ
 * sessizce yalan söylerdi: çalışma kağıdına "Açık uçlu" derdi. Ad da,
 * kural da (puanlanır mı, optik var mı) artık tek yerde.
 *
 * -----------------------------------------------------------------------------
 * KURALIN ASLI SUNUCUDA
 *
 * Buradaki `puanlanirMi` yalnız EKRANI yönetiyor. Çalışma kağıdının
 * puanlanamayacağı sunucuda üç ayrı yerde duruyor: `acik_puanla` ve
 * `puan_duzelt` reddediyor, `odev_test_tutarli` kısıtı anahtarı tabloya
 * sokmuyor. Ekranı atlayan bir çağrı da puan yazamaz.
 */

export type OdevTuru = 'test' | 'acik' | 'calisma';

export const TUR_ADLARI: Record<OdevTuru, string> = {
  test: 'Test',
  acik: 'Açık uçlu',
  calisma: 'Çalışma kağıdı',
};

/** Bilinmeyen tür ekranı bozmasın: ham değeri yazmaktansa "Ödev". */
export function turAdi(tur: string | null | undefined): string {
  return TUR_ADLARI[tur as OdevTuru] ?? 'Ödev';
}

/** Küçük harfli kullanım ("… · test · son tarih …"). */
export function turAdiKucuk(tur: string | null | undefined): string {
  return turAdi(tur).toLocaleLowerCase('tr');
}

/** Çalışma kağıdında puan yok — ne sistem hesaplar ne öğretmen verir. */
export function puanlanirMi(tur: string | null | undefined): boolean {
  return tur !== 'calisma';
}

/** Optik ızgara yalnız testte. */
export function optikVarMi(tur: string | null | undefined): boolean {
  return tur === 'test';
}

export function calismaMi(tur: string | null | undefined): boolean {
  return tur === 'calisma';
}

/** Oluşturma ekranındaki seçeneğin altına yazılan açıklama. */
export const TUR_IPUCU =
  'Testte puanı sistem hesaplar; açık uçluda siz verirsiniz. ' +
  'Çalışma kağıdı puanlanmaz — yalnız gönderildi mi, gönderilmedi mi.';

export const CALISMA_ACIKLAMASI =
  'Bu ödev puanlanmaz. Öğrenci çözümünü yine yükler; siz yalnız ' +
  'gönderip göndermediğini görürsünüz. Ortalamalara girmez.';

/** Öğrencinin ve velinin gördüğü durum. */
export function gonderimDurumu(gonderildi: boolean): string {
  return gonderildi ? 'Gönderdi' : 'Göndermedi';
}

/**
 * Karnedeki ve sınıf listesindeki ayrı satır (öğretmenin kararı).
 *
 * Hiç çalışma kağıdı verilmemişse satır HİÇ ÇIKMIYOR: "0/0 gönderdi"
 * yazmak, olmayan bir işi varmış gibi göstermek olurdu.
 */
export function calismaSatiri(
  yapilan: number | null | undefined,
  toplam: number | null | undefined,
): string | null {
  if (!toplam || toplam <= 0) return null;
  return `Çalışma kağıdı: ${yapilan ?? 0}/${toplam} gönderdi`;
}
