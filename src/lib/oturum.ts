import { cagir, SunucuHatasi } from './supabase'
import type { OgrenciTipi, Rol } from '@/types'

const JETON_ANAHTARI = 'sekiz.jeton'
const CIHAZ_ANAHTARI = 'sekiz.cihaz'

export type Kimlik = {
  rol: Rol
  ad: string
  ogrenci_id?: string
  ogrenci_no?: string
  tip?: OgrenciTipi
}

/**
 * Giriş yanıtı ya jeton taşır ya da `hata` alanı.
 * Sunucu başarısız girişte hata fırlatmaz: fırlatsaydı Postgres çağrıyı geri alır
 * ve başarısız deneme kaydı silinirdi — oran sınırlama çalışmazdı.
 */
type GirisYaniti = Kimlik & { jeton?: string; hata?: string; kilit_saniye?: number }

/**
 * Cihaz parmak izi. Kaba kuvvet kilidini cihaz bazında uygulamak için sunucuya
 * gönderilir: bir öğrencinin hatalı denemesi diğerlerini kilitlemesin.
 * Kimlik bilgisi değildir — rastgele üretilir, kişiye bağlı hiçbir veri taşımaz.
 */
export function cihazParmakIzi(): string {
  let deger = localStorage.getItem(CIHAZ_ANAHTARI)
  if (!deger) {
    deger = crypto.randomUUID()
    localStorage.setItem(CIHAZ_ANAHTARI, deger)
  }
  return deger
}

export function jetonOku(): string | null {
  return localStorage.getItem(JETON_ANAHTARI)
}

function jetonYaz(jeton: string): void {
  localStorage.setItem(JETON_ANAHTARI, jeton)
}

function jetonSil(): void {
  localStorage.removeItem(JETON_ANAHTARI)
}

/** Öğrenci ve veli girişi. Kodun kime ait olduğuna sunucu karar verir. */
export async function kodlaGir(kod: string): Promise<Kimlik> {
  return girisiTamamla(
    await cagir<GirisYaniti>('giris_kod', {
      p_kod: kod,
      p_parmak_izi: cihazParmakIzi(),
    }),
  )
}

/** Öğretmen girişi. PIN sunucuda bcrypt hash'iyle karşılaştırılır. */
export async function pinleGir(pin: string): Promise<Kimlik> {
  return girisiTamamla(
    await cagir<GirisYaniti>('giris_pin', {
      p_pin: pin,
      p_parmak_izi: cihazParmakIzi(),
    }),
  )
}

function girisiTamamla(yanit: GirisYaniti): Kimlik {
  if (yanit.hata || !yanit.jeton) {
    throw new SunucuHatasi(yanit.hata ?? 'Giriş yapılamadı.')
  }
  jetonYaz(yanit.jeton)
  return ayikla(yanit)
}

/** Uygulama açılışında oturumu doğrular. Jeton geçersizse temizler. */
export async function kimlikGetir(): Promise<Kimlik | null> {
  const jeton = jetonOku()
  if (!jeton) return null
  try {
    return await cagir<Kimlik>('ben_kimim', { p_jeton: jeton })
  } catch {
    jetonSil()
    return null
  }
}

export async function cikisYap(): Promise<void> {
  const jeton = jetonOku()
  jetonSil()
  if (jeton) {
    // Sunucudaki oturum da kapatılır; başarısız olsa bile yerel jeton silinmiştir.
    try {
      await cagir('cikis', { p_jeton: jeton })
    } catch {
      /* çıkış her hâlükârda yereldedir */
    }
  }
}

/**
 * Oturum gerektiren her çağrı bundan geçer: jetonu ekler, oturum düşmüşse
 * yereli temizler ki uygulama kilitli ekranda kalmasın.
 */
export async function jetonluCagir<T>(
  fonksiyon: string,
  parametreler: Record<string, unknown> = {},
): Promise<T> {
  const jeton = jetonOku()
  if (!jeton) throw new Error('Oturumunuz sona ermiş. Yeniden giriş yapın.')
  try {
    return await cagir<T>(fonksiyon, { p_jeton: jeton, ...parametreler })
  } catch (hata) {
    if (hata instanceof Error && hata.message.includes('Oturumunuz sona ermiş')) {
      jetonSil()
    }
    throw hata
  }
}

function ayikla(yanit: GirisYaniti): Kimlik {
  const { jeton: _jeton, hata: _hata, kilit_saniye: _kilit, ...kimlik } = yanit
  return kimlik
}
