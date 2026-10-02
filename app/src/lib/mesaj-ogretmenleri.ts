/**
 * Veli ve öğrenci ekranında yazışmayı ÖĞRETMEN ÖĞRETMEN ayırma (0058).
 *
 * Olay: platform sahibi her sınıfa bağlı olduğu için başka öğretmenin
 * sınıfındaki öğrencinin iki öğretmeni var ve veli mesaj gönderemiyordu.
 * Öğretmenin kararı: veli (ve öğrenci) kime yazacağını SEÇSİN.
 *
 * Sunucu her mesajla `ogretmen_id` ve `ogretmen` (ad), ayrıca bugün
 * yazılabilecek öğretmenlerin listesini gönderiyor. Burada bunlardan
 * ekranın göstereceği yazışmalar çıkarılıyor. Öğretmen tarafı zaten
 * yalnız kendi `ogretmen_id`'li mesajlarını görüyor; ekran da aynı ayrımı
 * yapıyor ki veli kime yazdığını ve kimin cevap verdiğini görsün.
 */
import type { Mesaj, MesajOgretmeni } from '@/types/api';

export type YazismaOgretmeni = MesajOgretmeni & {
  /** Bugün mesaj yazılabiliyor mu (öğretmen hâlâ bu öğrencinin öğretmeni). */
  yazilabilir: boolean;
};

/**
 * Ekranda gösterilecek öğretmenler: önce sunucunun listesi (sırasıyla),
 * sonra yalnız eski mesajlarda geçen ama artık listede olmayanlar
 * (yazışmaları okunabilsin, yeni mesaj yazılamasın).
 *
 * Liste hiç gelmediyse (0058 çalışmamış panel) boş döner: ekran bugünkü
 * tek yazışmayı gösterir.
 */
export function yazismaOgretmenleri(
  liste: ReadonlyArray<MesajOgretmeni> | undefined,
  mesajlar: ReadonlyArray<Mesaj>,
): YazismaOgretmeni[] {
  if (!liste) return [];
  const sonuc: YazismaOgretmeni[] = liste.map((o) => ({ ...o, yazilabilir: true }));
  const var_ = new Set(sonuc.map((o) => o.id));
  for (const m of mesajlar) {
    if (m.ogretmen_id && !var_.has(m.ogretmen_id)) {
      var_.add(m.ogretmen_id);
      sonuc.push({ id: m.ogretmen_id, ad: m.ogretmen ?? 'Öğretmen', yazilabilir: false });
    }
  }
  return sonuc;
}

/**
 * Bir öğretmenle olan yazışma. `ogretmen_id`'si olmayan (çok eski) mesaj
 * listenin İLK öğretmeninin yazışmasında gösteriliyor — kaybolmasın.
 */
export function ogretmeninMesajlari(
  mesajlar: ReadonlyArray<Mesaj>,
  ogretmenId: string,
  ilkOgretmenId: string | undefined,
): Mesaj[] {
  return mesajlar.filter((m) =>
    m.ogretmen_id ? m.ogretmen_id === ogretmenId : ogretmenId === ilkOgretmenId,
  );
}

/** Öğretmenden gelen ve son görülmeden sonraki mesajlar. */
export function okunmamisSayisi(
  mesajlar: ReadonlyArray<Mesaj>,
  sonGorulme: string | null,
): number {
  const sinir = sonGorulme ? Date.parse(sonGorulme) : -Infinity;
  return mesajlar.filter((m) => m.kimden === 'ogretmen' && Date.parse(m.zaman) > sinir).length;
}

/**
 * Açılışta seçili öğretmen: en son mesajlaşılan yazılabilir öğretmen;
 * hiç mesaj yoksa listenin ilki (sınıf öğretmeni).
 */
export function varsayilanOgretmen(
  ogretmenler: ReadonlyArray<YazismaOgretmeni>,
  mesajlar: ReadonlyArray<Mesaj>,
): string | undefined {
  const yazilabilir = new Set(ogretmenler.filter((o) => o.yazilabilir).map((o) => o.id));
  for (let i = mesajlar.length - 1; i >= 0; i--) {
    const id = mesajlar[i]!.ogretmen_id;
    if (id && yazilabilir.has(id)) return id;
  }
  return ogretmenler.find((o) => o.yazilabilir)?.id ?? ogretmenler[0]?.id;
}
