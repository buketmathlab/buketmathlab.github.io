import { useId } from 'react';

type Props = {
  deger: string;
  onDegis: (deger: string) => void;
  etiket: string;
  yerTutucu?: string;
};

/**
 * Arama alanı. Görsel etiket yerine gizli etiket kullanılır; ekran okuyucu
 * alanın ne aradığını bilir, arayüz sade kalır.
 */
export function SearchInput({ deger, onDegis, etiket, yerTutucu = 'Ara…' }: Props) {
  const id = useId();

  return (
    <div className="relative">
      <label htmlFor={id} className="sk-gizli-metin">
        {etiket}
      </label>
      <input
        id={id}
        type="search"
        value={deger}
        onChange={(e) => onDegis(e.target.value)}
        placeholder={yerTutucu}
        className="min-h-[44px] w-full rounded-sk-sm border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70"
      />
    </div>
  );
}
