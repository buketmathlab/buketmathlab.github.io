/**
 * Ortam değişkenleri tek kapıdan okunur.
 *
 * GÜVENLİK KURALI: burada yalnız istemciye açık anahtarlar bulunur.
 * `publishable` / `anon` anahtarın tarayıcıda olması normaldir — veriyi koruyan
 * şey anahtar değil, veritabanındaki RLS ve SECURITY DEFINER fonksiyonlarıdır.
 * `service_role` ve `sb_secret` anahtarları bu depoya ASLA girmez.
 */

type Ortam = {
  readonly supabaseUrl: string
  readonly supabaseAnahtar: string
  readonly eksikler: readonly string[]
  readonly hazir: boolean
}

function oku(ad: string): string {
  const deger = import.meta.env[ad as keyof ImportMetaEnv]
  return typeof deger === 'string' ? deger.trim() : ''
}

const supabaseUrl = oku('VITE_SUPABASE_URL')
// Yeni anahtar sistemi (sb_publishable_…) önceliklidir; yoksa eski anon anahtara düşülür.
const supabaseAnahtar = oku('VITE_SUPABASE_PUBLISHABLE_KEY') || oku('VITE_SUPABASE_ANON_KEY')

const eksikler: string[] = []
if (!supabaseUrl) eksikler.push('VITE_SUPABASE_URL')
if (!supabaseAnahtar) eksikler.push('VITE_SUPABASE_PUBLISHABLE_KEY')

export const ortam: Ortam = {
  supabaseUrl,
  supabaseAnahtar,
  eksikler,
  hazir: eksikler.length === 0,
}

export const gelistirmeModu = import.meta.env.DEV
