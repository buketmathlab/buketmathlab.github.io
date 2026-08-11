/**
 * Dosya yükleme ve görüntüleme — imzalı URL üzerinden.
 *
 * ## Neden Edge Function
 * Storage bucket'ı private ve `storage.objects` üzerinde anon erişimi
 * politikayla kapalı (migration 0002). İmzalı URL üretmek `service_role`
 * gerektiriyor; o anahtar tarayıcıya asla gelmez. Bu yüzden akış:
 *
 *   istemci → Edge Function → `dosya_erisim_izni(token, yol)` sorar → imzalar
 *
 * Yetki kararı SQL'de kalır; fonksiyon yalnız imzalar. Kurallar değişirse
 * tek yerde, veritabanında değişir.
 *
 * ## BİLİNEN BOŞLUK — öğrenci çözüm fotoğrafı yükleyemez (Faz 2C)
 * `dosya_erisim_izni` öğrenci için `gonderimler.foto_yolu = p_yol` arıyor.
 * Yeni bir fotoğraf yüklenirken o kayıt HENÜZ YOK, dolayısıyla yükleme izni
 * reddedilir. Öğretmen etkilenmiyor (öğretmene her yol açık).
 * Öğrenci teslim akışı yazılırken çözülmesi gereken bir eksik: öğrenciye
 * yalnız kendi kimliğine ve yayındaki bir ödeve bağlı, henüz teslim
 * edilmemiş bir yola yükleme izni verilmeli. Buraya not düşülüyor ki
 * "sonra bakarız" diye kaybolmasın.
 */

import { oturumOku } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Bucket sınırıyla aynı (migration 0002): 10 MB. */
export const EN_BUYUK_BOYUT = 10 * 1024 * 1024;

/** Bucket'ın kabul ettiği türler (migration 0002). */
export const KABUL_EDILEN_TURLER = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

type YuklemeYaniti = { imzaliUrl: string; jeton: string; yol: string };
type OkumaYaniti = { imzaliUrl: string; gecerlilikSn: number };

/**
 * Yeni bir ödev dosyası için yol üretir.
 *
 * Ödev henüz oluşturulmadığı için id'si yok; rastgele bir klasör kullanıyoruz.
 * Yol tahmin edilemez olmalı — bucket private olsa da tahmin edilebilir yollar
 * gereksiz bir bilgi sızıntısıdır.
 */
export function odevDosyaYolu(tur: 'sorular' | 'anahtar', dosyaAdi: string): string {
  const uzanti = dosyaAdi.toLowerCase().endsWith('.pdf') ? 'pdf' : 'bin';
  return `odev/${crypto.randomUUID()}/${tur}.${uzanti}`;
}

/** Dosyayı yüklemeden önce yerel kontrol. Sunucu da ayrıca sınırlıyor. */
export function dosyayiDenetle(dosya: File): string | null {
  if (dosya.size > EN_BUYUK_BOYUT) {
    const mb = (dosya.size / 1024 / 1024).toFixed(1);
    return `Dosya çok büyük (${mb} MB). En fazla 10 MB yükleyebilirsiniz.`;
  }
  if (!(KABUL_EDILEN_TURLER as readonly string[]).includes(dosya.type)) {
    return 'Yalnız PDF ve görsel dosyaları yükleyebilirsiniz.';
  }
  return null;
}

async function fonksiyonuCagir<T>(govde: Record<string, unknown>): Promise<T> {
  const oturum = oturumOku();
  if (!oturum) throw new Error('Oturumunuz sona ermiş. Tekrar giriş yapın.');

  let yanit: Response;
  try {
    yanit = await fetch(`${url}/functions/v1/dosya-url`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: oturum.token, ...govde }),
    });
  } catch (e) {
    console.error('Dosya servisine ulaşılamadı:', e);
    throw new Error('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }

  if (yanit.status === 404) {
    // Fonksiyon henüz kurulmamış. Bunu "bilinmeyen hata" diye göstermek
    // öğretmeni saatlerce yanlış yerde arattırır.
    throw new Error(
      'Dosya servisi kurulu değil. Supabase panelinden `dosya-url` Edge ' +
        "Function'ını yükleyin (supabase/functions/README.md).",
    );
  }

  if (!yanit.ok) {
    let hata: { hata?: string } = {};
    try {
      hata = (await yanit.json()) as { hata?: string };
    } catch {
      /* gövde okunamadı */
    }
    console.error('Dosya servisi hatası:', yanit.status, hata);
    throw new Error(hata.hata || 'Dosya işlemi tamamlanamadı. Tekrar deneyin.');
  }

  return (await yanit.json()) as T;
}

/**
 * Dosyayı yükler ve storage yolunu döndürür.
 * Dönen yol `odev_olustur`a verilecek değerdir.
 */
export async function dosyaYukle(dosya: File, yol: string): Promise<string> {
  const sorun = dosyayiDenetle(dosya);
  if (sorun) throw new Error(sorun);

  const { imzaliUrl } = await fonksiyonuCagir<YuklemeYaniti>({ yol, islem: 'yukle' });

  let yanit: Response;
  try {
    yanit = await fetch(imzaliUrl, {
      method: 'PUT',
      headers: { 'Content-Type': dosya.type },
      body: dosya,
    });
  } catch (e) {
    console.error('Yükleme başarısız:', e);
    throw new Error('Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  }

  if (!yanit.ok) {
    console.error('Yükleme reddedildi:', yanit.status, await yanit.text().catch(() => ''));
    throw new Error('Dosya yüklenemedi. Tekrar deneyin.');
  }

  return yol;
}

/**
 * Dosyayı görüntülemek için kısa ömürlü imzalı URL üretir.
 * URL 60 saniye geçerli — paylaşılsa bile hızla ölür, bu yüzden
 * saklanmaz, her ihtiyaçta yeniden istenir.
 */
export async function dosyaAdresi(yol: string): Promise<string> {
  const { imzaliUrl } = await fonksiyonuCagir<OkumaYaniti>({ yol });
  return imzaliUrl;
}
