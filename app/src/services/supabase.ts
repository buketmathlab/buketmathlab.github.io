/**
 * Supabase erişimi — SDK'sız, düz `fetch` ile.
 *
 * NEDEN SDK YOK: `@supabase/supabase-js` pakete ~280 KB ekliyordu (paket
 * 224 KB → 504 KB). Oysa bu üründe SDK'nın tek kullanılan yeteneği
 * `rpc()` — yani `/rest/v1/rpc/<fonksiyon>` adresine bir POST isteği.
 * Auth kullanılmıyor (kendi jeton katmanımız var), realtime kullanılmıyor,
 * storage erişimi imzalı URL üzerinden gidiyor. Kullanılmayan 280 KB'yi
 * mobil bağlantıya ödetmek için sebep yok (Part XVIII, Part XL).
 *
 * ANON ANAHTARI GİZLİ DEĞİLDİR. Statik sitede pakete gömülür ve tarayıcıdan
 * görülebilir. Koruma anahtarın gizliliğinden gelmez:
 *   1. Tablolara doğrudan erişim `anon` rolünden çekilmiştir (migration 0002)
 *   2. Fonksiyon çağırma hakkı yalnız izin listesindekilere verilmiştir (0005)
 *   3. Her RPC yetkiyi jetondan doğrular, parametreye güvenmez
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

/** Oturum jetonunun tarayıcıda saklandığı anahtar. */
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

/** Oturumun geçersizleştiğini belirtir; arayüz giriş ekranına döner. */
export class OturumHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'OturumHatasi';
  }
}

/** PostgREST hata gövdesi. */
type PostgrestHata = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * RPC çağrısı.
 *
 * Hata mesajları Türkçe ve eyleme dönük olmalı (Part XLI). Veritabanı
 * fonksiyonları zaten Türkçe mesaj fırlatıyor; buradaki iş ağ/altyapı
 * hatalarını insan diline çevirmek. Teknik ayrıntı kullanıcıya gitmez,
 * yalnız konsola yazılır.
 */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let yanit: Response;

  try {
    yanit = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
  } catch (e) {
    console.error(`RPC ağ hatası (${fn}):`, e);
    throw new Error('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }

  if (!yanit.ok) {
    let hata: PostgrestHata = {};
    try {
      hata = (await yanit.json()) as PostgrestHata;
    } catch {
      /* gövde okunamadıysa boş bırak */
    }
    console.error(`RPC hatası (${fn}):`, yanit.status, hata);

    // Oturum düşmüşse jetonu sil ve arayüzü haberdar et. Olay yayınlamak,
    // her çağrı noktasında ayrı kontrol yazmaktan güvenilir — bir yerde
    // unutulursa kullanıcı kilitli ekranda kalırdı.
    if (hata.code === '28000') {
      oturumSil();
      window.dispatchEvent(new CustomEvent('sekiz:oturum-dustu'));
      throw new OturumHatasi(hata.message || 'Oturumunuz sona erdi. Tekrar giriş yapın.');
    }

    // Veritabanının kendi Türkçe mesajı varsa onu göster.
    if (hata.message) throw new Error(hata.message);

    if (yanit.status >= 500) {
      throw new Error('Sunucuya ulaşılamıyor. Biraz sonra tekrar deneyin.');
    }
    throw new Error('İşlem tamamlanamadı. Tekrar deneyin.');
  }

  // Fonksiyonlarımız her zaman JSON döndürür; boş gövde `null` sayılır.
  const metin = await yanit.text();
  return (metin ? JSON.parse(metin) : null) as T;
}
