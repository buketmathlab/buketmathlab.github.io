import { createClient } from '@supabase/supabase-js';

/**
 * Supabase istemcisi.
 *
 * ANON ANAHTARI GİZLİ DEĞİLDİR. Statik bir sitede paket içine gömülür ve
 * tarayıcıdan zaten görülebilir. Koruma anahtarın gizliliğinden gelmez;
 * şunlardan gelir:
 *
 *   1. Tablolara doğrudan erişim `anon` rolünden çekilmiştir (migration 0002)
 *   2. Fonksiyon çağırma hakkı yalnız izin listesindekilere verilmiştir (0005)
 *   3. Her RPC yetkiyi jetondan doğrular, parametreden gelen kimliğe güvenmez
 *
 * SERVICE_ROLE ANAHTARI BU DOSYAYA — ya da istemci tarafındaki başka
 * herhangi bir dosyaya — HİÇBİR KOŞULDA KONMAZ.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase yapılandırması eksik. app/.env dosyasında VITE_SUPABASE_URL ve ' +
      'VITE_SUPABASE_ANON_KEY tanımlı olmalı.',
  );
}

export const sb = createClient(url, anonKey, {
  auth: {
    // Supabase Auth kullanılmıyor; oturum yönetimi kendi jeton katmanımızda.
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** Oturum jetonunun tarayıcıdaki saklandığı anahtar. */
const JETON_ANAHTARI = 'sekiz_oturum';

export type Rol = 'ogretmen' | 'ogrenci' | 'veli';

export type Oturum = {
  rol: Rol;
  token: string;
  ogrenci?: { id: string; ad: string; sinif: string | null; tur: string };
};

export function oturumOku(): Oturum | null {
  try {
    const ham = localStorage.getItem(JETON_ANAHTARI);
    return ham ? (JSON.parse(ham) as Oturum) : null;
  } catch {
    return null;
  }
}

export function oturumYaz(o: Oturum): void {
  localStorage.setItem(JETON_ANAHTARI, JSON.stringify(o));
}

export function oturumSil(): void {
  localStorage.removeItem(JETON_ANAHTARI);
}

/**
 * RPC çağrısı.
 *
 * Hata mesajları Türkçe ve eyleme dönük olmalı (Part XLI). Veritabanından
 * gelen mesajlar zaten Türkçe yazıldı; buradaki dönüşüm ağ/altyapı
 * hatalarını insan diline çevirir. Teknik ayrıntı kullanıcıya gösterilmez,
 * yalnız konsola yazılır.
 */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);

  if (error) {
    console.error(`RPC hatası (${fn}):`, error);

    // Oturum düşmüşse çağıran taraf bunu ayırt edebilsin.
    if (error.code === '28000') {
      oturumSil();
      throw new OturumHatasi(error.message || 'Oturumunuz sona erdi. Tekrar giriş yapın.');
    }

    // Veritabanının kendi Türkçe mesajı varsa onu kullan.
    if (error.message && !/^(TypeError|NetworkError|Failed to fetch)/.test(error.message)) {
      throw new Error(error.message);
    }

    throw new Error('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }

  return data as T;
}

/** Oturumun geçersizleştiğini belirtir; arayüz giriş ekranına döner. */
export class OturumHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'OturumHatasi';
  }
}
