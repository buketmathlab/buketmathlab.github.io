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
 * ## Öğrenci çözüm fotoğrafı — yol hesaplanır, uydurulmaz
 * Bir dönem burada açık bir boşluk vardı: `dosya_erisim_izni` öğrenci için
 * `gonderimler.foto_yolu = p_yol` arıyordu, ama fotoğraf YÜKLENİRKEN o kayıt
 * henüz yok — yükleme izni hep reddediliyordu.
 *
 * Migration 0009 bunu kapattı: öğrencinin yükleyebileceği yol tek ve
 * hesaplanabilir —
 *
 *   cozum/<odev_id>/<ogrenci_id>.<uzanti>
 *
 * Yol kendi kimliğini taşıdığı için başkasının yoluna yükleme imkânsız;
 * ödevin yayında ve öğrencinin sınıfına ait olması da ayrıca aranıyor.
 * `odev_gonder` kayda yazılan yolu aynı denetimden geçiriyor, yani geçerli
 * bir yola yükleyip kayda başka bir yol yazdırmak da mümkün değil.
 *
 * 0054'ten beri ek sayfalar da aynı kalıpta: `<ogrenci_id>-<n>.<uzanti>`,
 * n = 2…8 ve ödevin sayfa sınırını aşamaz (`lib/cozum-sayfalari.ts`).
 */

import { oturumOku } from './supabase';
import { depoZatenVarMi } from '@/lib/cozum-sayfalari';

/**
 * Depo "bu yolda dosya zaten var" dedi (0054).
 *
 * Ayrı bir tür, çünkü çözüm sayfasında bu HATA DEĞİL: yarım kalmış bir
 * gönderimin yeniden denemesinde sayfa zaten yüklenmiş demek
 * (`cozumSayfasiYukle`). Öğretmenin PDF yollarında hiç oluşmaz — yolları
 * rastgele — oluşsa da mesajı olan sıradan bir `Error` gibi davranır.
 */
export class DosyaZatenVarHatasi extends Error {
  constructor() {
    super('Bu dosya zaten yüklenmiş.');
    this.name = 'DosyaZatenVarHatasi';
  }
}

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
      // İKİ BAŞLIK DA GEREKLİ. Supabase ağ geçidi `Authorization` olmadan
      // isteği fonksiyona hiç ulaştırmıyor: 401 UNAUTHORIZED_NO_AUTH_HEADER.
      // Yalnız `apikey` gönderiyordum; canlı uç noktaya gerçek istek atınca
      // ortaya çıktı — birim testi yakalayamazdı, çünkü bu kontrol bizim
      // kodumuzda değil, Supabase'in önündeki katmanda.
      // `rpc()` bunu zaten doğru yapıyor (supabase.ts).
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
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
    let hata: { hata?: string; mevcut?: boolean } = {};
    try {
      hata = (await yanit.json()) as { hata?: string; mevcut?: boolean };
    } catch {
      /* gövde okunamadı */
    }
    // Edge Function "zaten var"ı 409 + `mevcut: true` ile söylüyor (0054).
    // İKİSİ BİRDEN aranıyor: başka bir sebeple dönen 409'u "dosya yüklü"
    // sanmak, dosyası hiç yüklenmemiş bir gönderimi kabul ettirirdi.
    if (yanit.status === 409 && hata.mevcut === true) throw new DosyaZatenVarHatasi();
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
    const govde = await yanit.text().catch(() => '');
    // Adres alınabildi ama nesne o arada oluşmuş olabilir: depo bu durumda
    // yüklemeyi reddediyor. Edge Function'daki denetimle aynı dar kural.
    if (depoZatenVarMi(yanit.status, govde)) throw new DosyaZatenVarHatasi();
    console.error('Yükleme reddedildi:', yanit.status, govde);
    throw new Error('Dosya yüklenemedi. Tekrar deneyin.');
  }

  return yol;
}

/**
 * Öğrencinin çözüm sayfasını yükler (0054).
 *
 * `dosyaYukle`'den tek farkı: "zaten var" HATA SAYILMIYOR. Fotoğraf
 * yüklenip `odev_gonder` ağ hatasıyla düşerse, tekrar denemede aynı yol
 * dolu olduğu için yükleme reddediliyordu ve öğrenci o ödevi bir daha hiç
 * gönderemiyordu.
 *
 * Mevcut dosya olduğu gibi kullanılıyor, çünkü:
 *   - yol öğrencinin KENDİ kimliğini taşıyor (sunucu denetliyor), yani o
 *     dosya başkasına ait olamaz;
 *   - üzerine yazmak açılamaz (bkz. dosya-url Edge Function): gönderimden
 *     sonra fotoğrafın değiştirilmesine kapı açardı.
 * Bedeli: öğrenci iki deneme arasında fotoğrafı değiştirdiyse ilk yüklenen
 * kalır. `oncedenVardi` ekranın bunu öğrenciye SÖYLEYEBİLMESİ için dönüyor.
 */
export async function cozumSayfasiYukle(
  dosya: File,
  yol: string,
): Promise<{ yol: string; oncedenVardi: boolean }> {
  try {
    await dosyaYukle(dosya, yol);
    return { yol, oncedenVardi: false };
  } catch (e) {
    if (e instanceof DosyaZatenVarHatasi) return { yol, oncedenVardi: true };
    throw e;
  }
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
