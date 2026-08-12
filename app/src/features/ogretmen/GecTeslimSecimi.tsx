type Props = {
  deger: boolean;
  onDegis: (v: boolean) => void;
};

/**
 * "Süre dolduktan sonra da teslim alınsın" onay kutusu.
 *
 * Oluşturma ve düzenleme ekranlarının ortak parçası: metin iki yerde
 * kopyalanırsa biri değişip diğeri kalır ve öğretmen aynı ayarı iki farklı
 * cümleyle okur.
 *
 * VARSAYILAN AÇIK. Sistemin bugüne kadarki davranışı buydu; kapalıya
 * çevirmek bilinçli bir seçim olmalı, kutuyu fark etmemenin sonucu değil.
 */
export function GecTeslimSecimi({ deger, onDegis }: Props) {
  return (
    <div className="mb-4 rounded-sk-sm border border-line bg-line-soft p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={deger}
          onChange={(e) => onDegis(e.target.checked)}
          className="mt-[2px] h-6 w-6 shrink-0 accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <span>
          <span className="block text-[15px] font-semibold text-ink">
            Süre dolduktan sonra da teslim alınsın
          </span>
          <span className="mt-1 block text-[13px] text-muted">
            {deger
              ? 'Öğrenci son tarihten sonra da gönderebilir; ödev listesinde gecikmeli görünür.'
              : 'Son tarihten sonra gönderim kapanır. Kural sunucuda uygulanır, ekranı kapatmakla yetinilmez.'}
          </span>
        </span>
      </label>
    </div>
  );
}
