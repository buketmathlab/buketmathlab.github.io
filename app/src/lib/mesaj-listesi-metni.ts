/**
 * Mesajlar sekmesinin METNİ — React'siz, doğrudan test edilebilir.
 *
 * `odev-kiyasi-metni.ts` deseninin aynısı: öğretmen bir cümleyi
 * beğenmezse tek dosyadan değişsin.
 *
 * -----------------------------------------------------------------------------
 * GÖRELİ ZAMAN NEDEN BURADA VE NEDEN "3 saat önce" DEĞİL
 *
 * Liste zaten TAZELİĞE göre sıralı; sıra bilgiyi veriyor. Satırın işi
 * "ne kadar önce" değil **"ne zaman"** demek — öğretmen "dün akşam mı
 * yazmıştı" diye hatırlıyor, "17 saat önce" diye değil.
 *
 * Üç biçim var ve üçü de öğretmenin gözünden:
 *   bugün      → "14:20"        (saat yeter, gün belli)
 *   dün        → "dün 19:05"
 *   daha eski  → "2 Ekim"       (saat gürültü)
 *
 * "az önce", "3 dakika önce" gibi sürekli değişen ifadeler yok: ekran
 * yenilenmeden eskidikleri için yalan söylemeye başlıyorlar.
 */

export type MesajKanali = 'ogrenci' | 'veli';

/**
 * Sayfa başlığının altındaki açıklama.
 *
 * İLK HÂLİ "En son yazışılan sınıf ve öğrenci en üstte." idi; öğretmen
 * "yazışılan" kelimesini beğenmedi ve daha profesyonel bir karşılık
 * istedi. "Yazışılan" edilgen bir ortaç — kim yazışıyor belirsiz ve
 * cümle konuşma diline kayıyor. Yenisi bunun yerine KURALI söylüyor:
 * sıralamanın neye göre yapıldığını.
 *
 * Cümle bu dosyada, bileşenin içinde değil: bir daha değişmek isterse
 * aranacak tek yer burası olsun.
 */
export const SAYFA_ACIKLAMASI =
  'Sınıflar ve öğrenciler son mesaja göre sıralanır; en yeni en üstte.';

/** Kanal düğmelerinin etiketleri. */
export const KANAL_ETIKETI: Readonly<Record<MesajKanali, string>> = {
  ogrenci: 'Öğrenciler',
  veli: 'Veliler',
};

/**
 * Boş durum — kanala göre ayrı.
 *
 * İKİ KANALA AYNI CÜMLE YAZILMIYOR: "Henüz yazışma yok" ikisinde de
 * doğru ama hiçbirinde yardımcı değil. Cümle ne yapılacağını söylüyor.
 */
export function bosDurum(kanal: MesajKanali): { baslik: string; aciklama: string } {
  return kanal === 'ogrenci'
    ? {
        baslik: 'Henüz öğrenci yazışması yok',
        aciklama: 'Yukarıdan bir öğrenci arayıp yazışma başlatabilirsiniz.',
      }
    : {
        baslik: 'Henüz veli yazışması yok',
        aciklama: 'Yukarıdan bir öğrenci arayıp velisine yazabilirsiniz.',
      };
}

/**
 * Kanalın altındaki tek satırlık not — İKİ KANALIN AYRI OLDUĞUNU söylüyor.
 *
 * BU CÜMLE BURAYA 0048'DE TAŞINDI, yeni yazılmadı. Veliler ekranının
 * açıklamasıydı ve oraya bir gerekçeyle konmuştu: ekran uzun süre "veli
 * kendi ÇOCUĞUNUN panelinde görür" diyordu; öğretmen sordu ve haklıydı —
 * veli kendi koduyla girip kendi panelinde okuyor. Yanlış cümle yalnız
 * kafa karıştırıcı değildi, iki kanalın ayrı olduğu güvencesinin TERSİNİ
 * ima ediyordu; doğru olsaydı gizlilik ihlali olurdu.
 *
 * 0048'de yazışma girişi Veliler ekranından kalkınca cümle orada
 * sahipsiz kaldı. Silinmedi: yazışmanın YAPILDIĞI yere taşındı ve
 * `kabuk-denetimi.mjs` onu burada ölçmeye devam ediyor — hem doğru
 * cümlenin durduğunu hem de eski yanlış cümlenin geri gelmediğini.
 *
 * Öğrenci kanalına da simetriği yazıldı: 0025'in bütün kararı iki
 * yazışmanın birbirini görmemesiydi; öğretmen kime yazdığını ekranda
 * okuyabilmeli.
 */
export const KANAL_NOTU: Readonly<Record<MesajKanali, string>> = {
  ogrenci:
    'Mesajlar uygulama içinde gider; öğrenci kendi koduyla girer, kendi panelinde okur. Veli bu yazışmayı görmez.',
  veli: 'Mesajlar uygulama içinde gider; veli kendi koduyla girer, kendi panelinde okur. Öğrenci bu yazışmayı görmez.',
};

/** Arama kutusunun yer tutucusu. */
export const ARAMA_YER_TUTUCU = 'Öğrenci ara…';

/** Aramada sonuç çıkmadığında. */
export const ARAMA_BOS = 'Bu ada uyan öğrenci yok.';

const AY = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const iki = (n: number) => String(n).padStart(2, '0');

/**
 * Bir mesaj zamanını satırda yazılacak hâle getirir.
 *
 * @param zaman  sunucudan gelen ISO damgası
 * @param simdi  "bugün"ün neye göre hesaplanacağı — TESTTE VERİLİYOR.
 *               Varsayılan `new Date()` olsaydı test gece yarısı
 *               çalıştığında kendiliğinden kırılırdı; bu depoda daha
 *               önce yaşanmış bir tuzak değil ama ucuz bir sigorta.
 *
 * GÜN FARKI TAKVİM GÜNÜYLE HESAPLANIYOR, 24 saatle değil: bu sabah
 * 01:00'de gelen mesaj "bugün", dün 23:00'te gelen "dün". Saat farkına
 * bakan bir hesap ikisini de "bugün" sayardı.
 */
export function zamanYazisi(zaman: string | null | undefined, simdi: Date = new Date()): string {
  if (!zaman) return '';
  const d = new Date(zaman);
  if (Number.isNaN(d.getTime())) return '';

  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const farkGun = Math.round((gun(simdi) - gun(d)) / 86400000);

  if (farkGun === 0) return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
  if (farkGun === 1) return `dün ${iki(d.getHours())}:${iki(d.getMinutes())}`;
  // Aynı yıl değilse yıl da yazılıyor: "2 Ekim" geçen yılın ödevini
  // bu yılınki sanmaya yol açardı.
  const ay = AY[d.getMonth()] ?? '';
  return d.getFullYear() === simdi.getFullYear()
    ? `${d.getDate()} ${ay}`
    : `${d.getDate()} ${ay} ${d.getFullYear()}`;
}
