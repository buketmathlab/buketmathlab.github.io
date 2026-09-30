import { Link } from 'react-router-dom';

/**
 * "Konular" sayfalarındaki ödevler bağlantısı: süresi dolmamış gönderilmiş
 * ödevin konu dökümü şu an ödevin kendisinde (bkz. `lib/bekleyen-degerlendirme.ts`).
 */
export function OdevlereGit({ hedef, etiket }: { hedef: string; etiket: string }) {
  return (
    <Link
      to={hedef}
      className="mt-2 inline-flex min-h-[44px] items-center text-[14px] font-bold text-link underline"
    >
      {etiket}
    </Link>
  );
}
