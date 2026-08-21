/**
 * Tanıtım sayfasının kendini bir kez tazelemesi — saf mantık.
 *
 * NEDEN GEREKLİ (ölçüldü, tahmin değil): GitHub Pages HTML'i
 * `cache-control: max-age=600` ile gönderiyor. Yeni sürüm yayınlandıktan
 * sonra tarayıcı 10 dakika boyunca ESKİ HTML'i verebiliyor; o HTML de
 * dosya adı hash'li ESKİ paketi çağırıyor. Sonuç: sayfa yayında yenilenmiş
 * olduğu hâlde kullanıcı eskisini görüyor. Öğretmen tam olarak bunu yaşadı.
 *
 * NEDEN ŞERİT DEĞİL SESSİZ. Uygulamanın içinde (`SurumSeridi`) kullanıcıya
 * "Yeni sürüm hazır · Yenile" diye SORULUYOR ve bu doğru: orada yarım
 * kalmış bir ödev formu, girilmiş bir cevap anahtarı olabilir ve haber
 * vermeden atmak kabul edilemez. Tanıtım sayfasında kaybedilecek hiçbir
 * şey yok — form yok, oturum yok, girilmiş veri yok. Bir ziyaretçiye
 * "lütfen yenileyin" düğmesi göstermek karşılığı olmayan bir sürtünme
 * olurdu.
 *
 * DEPOLAMA KULLANILMIYOR. Ne çerez ne `localStorage`. Uygulamadaki
 * "Şimdi değil" tercihi depolamaya yazıyor; burada kapatılacak bir şerit
 * olmadığı için o yola hiç girilmiyor. Sayfanın kendi cümlesi ("çerez
 * kullanmaz ve ziyaretçi takibi yapmaz") olduğu gibi ayakta kalıyor.
 */

/**
 * Tazelenmesi gereken adresi döndürür; gerek yoksa `null`.
 *
 * SONSUZ DÖNGÜ KİLİDİ ÜÇÜNCÜ KURALDA ve bu fonksiyonun asıl varlık
 * sebebi o. `?s=` eklenmiş adres önbelleği atladığı için normalde yeni
 * paket gelir ve sürümler eşitlenir. Ama eşitlenmezse — yayın yarım
 * kalmışsa, `surum.json` paketten önce güncellenmişse, araya bir vekil
 * sunucu girmişse — kilit olmasaydı sayfa kendini sonsuza kadar yeniden
 * yüklerdi. Adres istenen değeri ZATEN taşıyorsa duruyoruz: en fazla bir
 * kez tazeleniyor.
 */
export function tazelemeAdresi(
  simdikiAdres: string,
  calisanSurum: string,
  yayindakiSurum: string | null,
): string | null {
  // 1. Sürüm okunamadı (çevrimdışı, 404, bozuk JSON). Çevrimdışı olmak
  //    normal bir durum, hata değil: hiçbir şey yapmıyoruz.
  if (!yayindakiSurum) return null;

  // 2. Zaten güncel.
  if (yayindakiSurum === calisanSurum) return null;

  const u = new URL(simdikiAdres);

  // 3. SONSUZ DÖNGÜ KİLİDİ — yukarıdaki nota bakın.
  if (u.searchParams.get('s') === yayindakiSurum) return null;

  // 4. Tazele. `searchParams.set` diğer parametreleri ve `#` çapasını
  //    koruyor; adresi elle birleştirseydik ikisi de kaybolurdu.
  u.searchParams.set('s', yayindakiSurum);
  return u.toString();
}
