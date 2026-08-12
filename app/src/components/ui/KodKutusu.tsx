import { useToast } from '@/components/ui/toast-baglam';

/**
 * Giriş kodu kutusu — dokununca kopyalar.
 *
 * Öğrenciler ekranı ile Kodlar sekmesi aynı kutuyu kullanıyor. İki kopya
 * yazsaydık zamanla ayrışırdı: birinde kopyalama olur öbüründe olmazdı,
 * biri 44 px kalır öbürü küçülürdü.
 */

/**
 * Kodu panoya kopyalar; pano API'si yoksa kullanıcıya kodu gösterir.
 *
 * Dışa açılmıyor: tek kullanıcısı aşağıdaki bileşen. Dosya yalnız bileşen
 * ihraç edince Fast Refresh de çalışıyor.
 */
async function kopyala(kod: string, bildir: (m: string, t?: 'basari' | 'hata') => void) {
  try {
    await navigator.clipboard.writeText(kod);
    bildir(`Kod kopyalandı: ${kod}`, 'basari');
  } catch {
    // Pano API'si yoksa (eski iOS, izin verilmemiş bağlam) kodu EKRANDA
    // gösteriyoruz: öğretmen elle yazabilsin. Sessizce başarısız olmak,
    // "bastım ama bir şey olmadı" demek.
    bildir(`Kod: ${kod}`);
  }
}

export function KodKutusu({ etiket, kod }: { etiket: string; kod: string }) {
  const { bildir } = useToast();
  return (
    <button
      type="button"
      onClick={() => kopyala(kod, bildir)}
      className="min-h-[44px] flex-1 rounded-sk-sm bg-line-soft px-3 py-2 text-left hover:bg-line"
    >
      <span className="block text-[11px] font-bold text-muted">{etiket}</span>
      <span className="sk-sayi block text-[15px] font-extrabold tracking-[2px] text-ink">
        {kod} ⧉
      </span>
    </button>
  );
}
