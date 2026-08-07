import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ortam } from './ortam'

/**
 * Supabase istemcisi.
 *
 * Mimari kural: tablolara doğrudan erişim YOKTUR (`.from('...')` kullanılmaz).
 * Tüm okuma/yazma, veritabanındaki SECURITY DEFINER fonksiyonlar üzerinden
 * `.rpc(...)` ile yapılır. Bu, yetki mantığını istemciden sunucuya taşır ve
 * "cevap anahtarı gönderim yapılmadan dönmez" gibi kuralları uygulanabilir kılar.
 *
 * Oturum: kendi kod/PIN akışımız var, Supabase Auth kullanılmıyor; bu yüzden
 * oturum kalıcılığı ve otomatik yenileme kapalıdır.
 */
export const supabase: SupabaseClient = createClient(ortam.supabaseUrl, ortam.supabaseAnahtar, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-uygulama': 'sekiz' },
  },
})

/** Sunucudan dönen hataların kullanıcıya gösterilebilir Türkçe karşılığı. */
export class SunucuHatasi extends Error {
  readonly kod: string | undefined
  constructor(mesaj: string, kod?: string) {
    super(mesaj)
    this.name = 'SunucuHatasi'
    this.kod = kod
  }
}

/**
 * Tek RPC çağrı kapısı. Her veri isteği buradan geçer; böylece hata biçimi,
 * günlükleme ve ileride eklenecek yeniden deneme davranışı tek yerde durur.
 */
export async function cagir<T>(fonksiyon: string, parametreler?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fonksiyon, parametreler ?? {})

  if (error) {
    // Postgres'ten gelen özel hata mesajları (RAISE EXCEPTION) doğrudan kullanıcıya uygundur.
    throw new SunucuHatasi(cevirHata(error.message), error.code)
  }
  return data as T
}

/** Ham hata metnini öğretmenin/öğrencinin anlayacağı dile çevirir. */
function cevirHata(mesaj: string): string {
  const m = mesaj.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et, sonra tekrar dene.'
  }
  if (m.includes('jwt') || m.includes('api key')) {
    return 'Bağlantı ayarları eksik görünüyor. Kurulum adımlarını gözden geçirin.'
  }
  return mesaj
}
