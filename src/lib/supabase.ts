import { ortam } from './ortam'

/**
 * Supabase erişim katmanı.
 *
 * Mimari kural: tablolara doğrudan erişim YOKTUR. Tüm okuma/yazma, veritabanındaki
 * SECURITY DEFINER fonksiyonlara PostgREST üzerinden yapılan RPC çağrılarıdır.
 *
 * Neden resmî kütüphane kullanılmıyor: `@supabase/supabase-js` gzip'li pakete
 * ~55 KB ekliyor (toplamın %40'ı) ve bu mimaride yalnız `.rpc()` yüzeyi
 * kullanılıyor — oturum yönetimi kendi jetonumuzla, dosya erişimi imzalı
 * adreslerle çözülüyor. Aşağıdaki 40 satır aynı işi yapıyor ve performans
 * bütçesini (ana paket < 200 KB gzip) rahat bırakıyor.
 */

/** Sunucudan dönen, kullanıcıya gösterilebilir hata. */
export class SunucuHatasi extends Error {
  readonly kod: string | undefined
  constructor(mesaj: string, kod?: string) {
    super(mesaj)
    this.name = 'SunucuHatasi'
    this.kod = kod
  }
}

type PostgrestHata = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

/**
 * Tek RPC çağrı kapısı. Her veri isteği buradan geçer; hata biçimi ve
 * günlükleme tek yerde durur.
 */
/** Zayıf mobil şebekede istek sonsuza kadar beklemesin: 15 saniyede kesilir. */
const ZAMAN_ASIMI_MS = 15_000

export async function cagir<T>(
  fonksiyon: string,
  parametreler: Record<string, unknown> = {},
): Promise<T> {
  const kesici = new AbortController()
  const sayac = setTimeout(() => kesici.abort(), ZAMAN_ASIMI_MS)

  let yanit: Response
  try {
    yanit = await fetch(`${ortam.supabaseUrl}/rest/v1/rpc/${fonksiyon}`, {
      method: 'POST',
      headers: {
        apikey: ortam.supabaseAnahtar,
        Authorization: `Bearer ${ortam.supabaseAnahtar}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(parametreler),
      signal: kesici.signal,
    })
  } catch (sorun) {
    if (sorun instanceof DOMException && sorun.name === 'AbortError') {
      throw new SunucuHatasi(
        'Sunucu yanıt vermedi. Bağlantın yavaş olabilir; birazdan tekrar dene.',
      )
    }
    throw new SunucuHatasi('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et, sonra tekrar dene.')
  } finally {
    clearTimeout(sayac)
  }

  const govde = await yanit.text()

  if (!yanit.ok) {
    let hata: PostgrestHata = {}
    try {
      hata = JSON.parse(govde) as PostgrestHata
    } catch {
      /* gövde JSON değilse ham metne düşülür */
    }
    throw new SunucuHatasi(cevirHata(hata.message ?? govde, yanit.status), hata.code)
  }

  return (govde ? JSON.parse(govde) : null) as T
}

/** Ham hata metnini öğretmenin/öğrencinin anlayacağı dile çevirir. */
function cevirHata(mesaj: string, durum: number): string {
  const m = mesaj.toLowerCase()
  if (durum === 401 || m.includes('api key') || m.includes('jwt')) {
    return 'Bağlantı ayarları eksik görünüyor. Kurulum adımlarını gözden geçirin.'
  }
  if (durum === 404 && m.includes('function')) {
    return 'Sunucu kurulumu tamamlanmamış: veritabanı fonksiyonları henüz yüklenmemiş.'
  }
  if (durum >= 500) {
    return 'Sunucuda beklenmeyen bir sorun oluştu. Birazdan tekrar deneyin.'
  }
  // RAISE EXCEPTION ile yazdığımız mesajlar zaten Türkçe ve kullanıcıya uygundur.
  return mesaj
}
