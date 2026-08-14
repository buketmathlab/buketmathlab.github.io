/**
 * Sayı rozeti — kabuktaki sekmelerde bekleyen iş sayısını gösterir.
 *
 * SIFIRDA HİÇ ÇİZİLMİYOR. "0" gösteren bir rozet gürültüdür: göz her
 * seferinde ona takılır ve hiçbir şey söylemez. Rozetin tek işi "burada
 * bekleyen bir şey var" demek.
 *
 * 99'dan büyük sayı `99+` oluyor — üç haneli bir rozet sekme etiketini
 * itiyor ve 360 px'de alt çubuğu bozuyor.
 *
 * `aria-hidden`: rozet YALNIZ GÖRSEL. Sayı, sekmenin kendi `aria-label`'ına
 * yazılıyor ("Veliler, 3 okunmamış mesaj") — ekran okuyucu kullanan biri
 * rozeti göremez, sayı bağlantının adında geçmeli. Rozeti ayrıca okutmak
 * da aynı sayıyı iki kez duyurmak olurdu.
 */
export function Rozet({ sayi }: { sayi: number }) {
  if (sayi <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="sk-sayi inline-flex min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-bold leading-none text-paper"
    >
      {sayi > 99 ? '99+' : sayi}
    </span>
  );
}
