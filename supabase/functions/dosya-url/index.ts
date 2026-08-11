/**
 * SEKİZ — imzalı dosya URL'i üretme (Supabase Edge Function)
 *
 * NEDEN BU FONKSİYON VAR
 * Storage bucket'ı private. İmzalı URL üretmek Storage API gerektiriyor ve
 * bu SQL'den yapılamıyor. Ama yetki kararını Edge Function'a taşımak
 * istemiyoruz — yetki mantığı tek yerde, veritabanında kalmalı.
 *
 * Bu yüzden iş bölümü şöyle:
 *   1. Fonksiyon, veritabanındaki `dosya_erisim_izni(token, yol)` RPC'sine
 *      SORAR: "bu jeton bu dosyayı görebilir mi?"
 *   2. Cevap `true` ise `service_role` ile kısa ömürlü imzalı URL üretir.
 *
 * Yani fonksiyon karar vermiyor, yalnız imzalıyor. Yetki kuralları
 * değişirse SQL'de değişir, burada değil.
 *
 * SERVICE_ROLE anahtarı yalnız bu fonksiyonun ortam değişkeninde durur.
 * Tarayıcıya asla gitmez.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'odev-dosyalari';
const GECERLILIK_SN = 60; // imzalı URL kısa ömürlü olmalı

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (istek: Request) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (istek.method !== 'POST') return json({ hata: 'Yalnız POST kabul edilir.' }, 405);

  let token: unknown;
  let yol: unknown;
  let islem: unknown;
  try {
    ({ token, yol, islem } = await istek.json());
  } catch {
    return json({ hata: 'Geçersiz istek.' }, 400);
  }

  if (typeof token !== 'string' || typeof yol !== 'string' || !token || !yol) {
    return json({ hata: 'Eksik bilgi.' }, 400);
  }

  // Yol doğrulaması: dizin dışına çıkma denemelerini reddet.
  if (yol.includes('..') || yol.startsWith('/')) {
    return json({ hata: 'Geçersiz dosya yolu.' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const servisAnahtari = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servisAnahtari) {
    console.error('Ortam değişkenleri eksik');
    return json({ hata: 'Sunucu yapılandırması eksik.' }, 500);
  }

  const sb = createClient(url, servisAnahtari, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) YETKİ KARARINI VERİTABANINA SOR
  const { data: izinli, error: izinHatasi } = await sb.rpc('dosya_erisim_izni', {
    p_token: token,
    p_yol: yol,
  });

  if (izinHatasi) {
    // Oturum geçersizse veritabanı 28000 fırlatır.
    if (izinHatasi.code === '28000') {
      return json({ hata: 'Oturumunuz sona erdi. Tekrar giriş yapın.' }, 401);
    }
    console.error('Yetki sorgusu başarısız:', izinHatasi);
    return json({ hata: 'Dosya erişimi kontrol edilemedi.' }, 500);
  }

  if (izinli !== true) {
    // Dosyanın var olup olmadığını sızdırmamak için ayrım yapmıyoruz.
    return json({ hata: 'Bu dosyaya erişim izniniz yok.' }, 403);
  }

  // 2) YÜKLEME veya OKUMA için imzalı URL üret
  if (islem === 'yukle') {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(yol);
    if (error) {
      console.error('İmzalı yükleme URL hatası:', error);
      return json({ hata: 'Yükleme bağlantısı oluşturulamadı.' }, 500);
    }
    return json({ imzaliUrl: data.signedUrl, jeton: data.token, yol });
  }

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(yol, GECERLILIK_SN);
  if (error) {
    console.error('İmzalı URL hatası:', error);
    return json({ hata: 'Dosya bağlantısı oluşturulamadı.' }, 500);
  }

  return json({ imzaliUrl: data.signedUrl, gecerlilikSn: GECERLILIK_SN });
});
