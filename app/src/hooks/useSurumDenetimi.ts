import { useCallback, useEffect, useState } from 'react';

/**
 * Yeni sürüm denetimi — `?y=22` zahmetinin sonu.
 *
 * NEDEN GEREKLİ: GitHub Pages HTML'i `cache-control: max-age=600` ile
 * gönderiyor (ölçüldü). Yeni sürüm yayınlandıktan sonra 10 dakika boyunca
 * tarayıcı eskisini gösterebiliyor; öğretmen bunu adres çubuğuna elle
 * `?y=N` yazarak aşıyordu. Bu zahmeti ürünün kendisi üstleniyor.
 *
 * NASIL: `surum.json` `cache: 'no-store'` ile okunuyor. O bayrak isteğin
 * tarayıcı önbelleğini ATLAMASINI sağlıyor — yani HTML 10 dakika eski
 * olsa bile yeni sürüm saniyeler içinde fark ediliyor.
 *
 * NE ZAMAN: açılışta, sekmeye geri dönüldüğünde ve yarım saatte bir.
 * Sürekli yoklamıyoruz; öğretmen uygulamayı gün boyu açık bırakıyor ve
 * dakikada bir istek atmanın karşılığı yok.
 */

/** Yarım saat. Sekmeye dönüş zaten asıl tetikleyici; bu yalnız yedek. */
const ARALIK_MS = 30 * 60 * 1000;

/** Kapatılan şeridin hangi sürüm için kapatıldığı burada tutuluyor. */
const YOK_SAYILAN = 'sekiz_surum_yoksayilan';

async function yayindakiSurum(): Promise<string | null> {
  try {
    // `no-store`: bu turun bütün fikri bu satırda.
    const y = await fetch(`${import.meta.env.BASE_URL}surum.json`, { cache: 'no-store' });
    if (!y.ok) return null;
    const j: unknown = await y.json();
    if (typeof j === 'object' && j !== null && 'surum' in j) {
      const s = (j as { surum: unknown }).surum;
      return typeof s === 'string' ? s : null;
    }
    return null;
  } catch {
    // Çevrimdışı olmak normal bir durum, hata değil. Sessizce geçiyoruz:
    // "sürüm kontrol edilemedi" uyarısı kullanıcıya hiçbir şey kazandırmaz.
    return null;
  }
}

export type SurumDurumu = {
  /** Yayında çalışandan farklı bir sürüm varsa onun kimliği. */
  yeniSurum: string | null;
  /** Şeridi kapat — daha yeni bir sürüm çıkana kadar bir daha gösterilmez. */
  yoksay: () => void;
  /** Yeni sürüme geç. */
  yenile: () => void;
};

export function useSurumDenetimi(): SurumDurumu {
  const [yeniSurum, setYeniSurum] = useState<string | null>(null);

  const bak = useCallback(async () => {
    const yayin = await yayindakiSurum();
    if (!yayin || yayin === __SEKIZ_SURUM__) return;
    // Kapatılmış olan sürümü tekrar göstermiyoruz; ama DAHA YENİSİ
    // çıkarsa gösteriyoruz — bu yüzden karşılaştırma eşitlik üzerinden.
    let yoksayilan: string | null = null;
    try {
      yoksayilan = localStorage.getItem(YOK_SAYILAN);
    } catch {
      // Depolama kapalıysa (gizli sekme) şeridi göstermeye devam ederiz.
    }
    setYeniSurum(yayin === yoksayilan ? null : yayin);
  }, []);

  useEffect(() => {
    void bak();
    const zamanlayici = window.setInterval(() => void bak(), ARALIK_MS);
    const gorunurluk = () => {
      if (document.visibilityState === 'visible') void bak();
    };
    document.addEventListener('visibilitychange', gorunurluk);
    return () => {
      window.clearInterval(zamanlayici);
      document.removeEventListener('visibilitychange', gorunurluk);
    };
  }, [bak]);

  const yoksay = useCallback(() => {
    if (yeniSurum) {
      try {
        localStorage.setItem(YOK_SAYILAN, yeniSurum);
      } catch {
        // Depolama yoksa kapatma bu oturumla sınırlı kalır; kabul.
      }
    }
    setYeniSurum(null);
  }, [yeniSurum]);

  const yenile = useCallback(() => {
    // `location.reload()` YETMEZ: önbellekteki HTML'i yine getirebilir ve
    // kullanıcı "yeniledim ama değişmedi" derdi. Adrese sürüm ekleyip
    // değiştiriyoruz — öğretmenin elle yaptığı şeyin aynısı, artık
    // uygulamanın kendisi yapıyor.
    const u = new URL(window.location.href);
    u.searchParams.set('s', yeniSurum ?? String(Date.now()));
    window.location.replace(u.toString());
  }, [yeniSurum]);

  return { yeniSurum, yoksay, yenile };
}
