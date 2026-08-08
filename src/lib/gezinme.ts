import type { OgrenciTipi, Rol } from '@/types'

export type GezinmeOgesi = {
  /** Ekranın hangi öğeyi etkin göstereceğini bu anahtar belirler. */
  anahtar: string
  yol: string
  ad: string
  /** Alt gezinmede sekizgen hücrenin içindeki kısa işaret. */
  isaret: string
}

/**
 * GEZİNME MODELİ
 *
 * Kritik iş kuralı burada uygulanır: **okul öğrencisinin ve velisinin gezinme
 * listesinde ödeme ve online ders öğesi HİÇ YOKTUR.** Bu bir arayüz koşulu
 * ("varsa gizle") değildir — öğe listeye hiç girmez, dolayısıyla sekme,
 * bağlantı veya arama sonucu olarak da hiçbir yerde belirmez. Aynı sınır
 * veritabanında bileşik yabancı anahtarla ayrıca zorlanır.
 *
 * Etkin öğe adresten değil `anahtar`dan belirlenir: adres eşleştirmesi, aynı
 * sayfaya bakan birden çok öğeyi yanlışlıkla birlikte etkin gösterir.
 */
export function gezinme(rol: Rol, tip?: OgrenciTipi): readonly GezinmeOgesi[] {
  if (rol === 'ogretmen') {
    return [
      { anahtar: 'bugun', yol: '/ornek/ogretmen', ad: 'Bugün', isaret: '·' },
      { anahtar: 'siniflar', yol: '/ornek/sinif', ad: 'Sınıflar', isaret: '9A' },
      { anahtar: 'odevler', yol: '/ornek/ogretmen', ad: 'Ödevler', isaret: 'Ö' },
      { anahtar: 'mesajlar', yol: '/ornek/ogretmen', ad: 'Mesajlar', isaret: 'M' },
    ]
  }

  if (rol === 'ogrenci') {
    const ogeler: GezinmeOgesi[] = [
      { anahtar: 'bugun', yol: '/ornek/ogrenci', ad: 'Bugün', isaret: '·' },
      { anahtar: 'odevler', yol: '/ornek/ogrenci', ad: 'Ödevler', isaret: 'Ö' },
      { anahtar: 'gelisim', yol: '/ornek/ogrenci', ad: 'Gelişim', isaret: '∞' },
      { anahtar: 'mesajlar', yol: '/ornek/ogrenci', ad: 'Mesajlar', isaret: 'M' },
    ]
    // Online ders yalnız özel ders öğrencisinde vardır.
    if (tip === 'ozel') {
      ogeler.splice(2, 0, {
        anahtar: 'dersler',
        yol: '/ornek/ogrenci',
        ad: 'Dersler',
        isaret: 'D',
      })
    }
    return ogeler
  }

  const veli: GezinmeOgesi[] = [
    { anahtar: 'ozet', yol: '/ornek/veli', ad: 'Özet', isaret: '·' },
    { anahtar: 'odevler', yol: '/ornek/veli', ad: 'Ödevler', isaret: 'Ö' },
    { anahtar: 'mesajlar', yol: '/ornek/veli', ad: 'Mesajlar', isaret: 'M' },
  ]
  // Ödeme yalnız özel ders velisinde vardır.
  if (tip === 'ozel') {
    veli.push({ anahtar: 'odeme', yol: '/ornek/veli', ad: 'Ödeme', isaret: '₺' })
  }
  return veli
}
