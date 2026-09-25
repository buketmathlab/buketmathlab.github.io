import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import {
  BOS_ACIKLAMA,
  BOS_BASLIK,
  KAPSAM_NOTU,
  SAYFA_BASLIGI,
  SINIR_NOTU,
  bildirimMetni,
  bildirimZamani,
  type BildirimRolu,
} from '@/lib/bildirim-metni';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { Bildirimlerim, BildirimSatiri } from '@/types/api';

/**
 * Bildirim listesi — ÖĞRENCİ VE VELİ İÇİN TEK BİLEŞEN (0054).
 *
 * İki kopya yazılabilirdi ve bir gün ayrışırdı: biri tarihi "dün 23:00"
 * derken öbürü "23:00" der, biri boş durumu gösterirken öbürü beyaz ekran
 * verirdi. Fark yalnızca `rol`: cümlelerin sesi (`bildirimMetni`) ve
 * sunucunun döndürdüğü satırlar ona göre değişiyor.
 *
 * VELİYE "TESLİMİ YARIN" SATIRI GELMİYOR ve bu bir arayüz süzgeci DEĞİL:
 * `_bildirimlerim` o satırı `p_rol = 'ogrenci'` koşuluyla üretiyor, yani
 * veli jetonuyla hiç doğmuyor (Part XXI: gizlenen veri gönderilmiş
 * veridir). Burada `tur === 'teslim'` diye bir ayıklama yok — olsaydı
 * satır tele gelir, yalnız çizilmezdi.
 *
 * EKRAN AÇILDI = GÖRÜLDÜ. `bildirim_goruldu` bir kez yazılıyor ve rozet
 * düşüyor; ayrı bir "okundum" düğmesi hiçbir şey kazandırmaz
 * (`ogrenci_mesajlari` deseni).
 */

/** Satırın solundaki işaret — dört tür dört ikon. */
const IKON: Record<BildirimSatiri['tur'], string> = {
  mesaj:
    'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-6 4V6a2 2 0 0 1 2-2Zm3 5h10v2H7V9Zm0 4h7v2H7v-2Z',
  odev:
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z',
  // Teslim: saat — "zaman yaklaşıyor" demenin en sade yolu.
  teslim:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.6l4.2 2.5-1 1.7L11 13.5V7h2Z',
  // Sonuç: onay işareti. Puan YOK — cümlede de yok.
  sonuc:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.6-4-4 1.4-1.4 2.6 2.6 5.6-5.6L17.8 9.6l-7 7Z',
};

export function BildirimListesi({ rol }: { rol: BildirimRolu }) {
  const { oturum } = useOturum();
  const goruldu = useRef(false);

  const { veri, durum, hata, yenile } = useVeri<Bildirimlerim>(
    'bildirimlerim',
    { p_token: oturum?.token },
    (v) => (v?.bildirimler?.length ?? 0) === 0,
  );

  useEffect(() => {
    // Bir kez: her yeniden çizimde istek atmasın.
    if (!veri || goruldu.current || !oturum?.token) return;
    goruldu.current = true;
    void rpc('bildirim_goruldu', { p_token: oturum.token }).catch(() => {
      // Damga yazılamazsa ekran çalışmaya devam etmeli; en kötü rozet bir
      // sonraki açılışta düşer.
    });
  }, [veri, oturum?.token]);

  const kok = rol === 'veli' ? '/veli' : '/ogrenci';

  return (
    <>
      <h1 className="mb-1 font-display text-[24px] font-semibold text-ink">{SAYFA_BASLIGI}</h1>
      <p className="mb-5 text-[14px] text-muted">{KAPSAM_NOTU}</p>

      <AsyncBoundary
        durum={durum}
        bosBaslik={BOS_BASLIK}
        bosAciklama={BOS_ACIKLAMA}
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <ul className="space-y-2" data-test="bildirim-listesi">
            {veri.bildirimler.map((s, i) => {
              const cumle = bildirimMetni(s, rol);
              // Ödev satırından o ödeve gitmek: öğrenci "Yeni ödev"i
              // görüp ikinci kez aramasın. Mesaj satırı yazışmaya gidiyor.
              const hedef =
                s.tur === 'mesaj'
                  ? `${kok}/mesajlar`
                  : rol === 'ogrenci' && s.odev_id
                    ? `${kok}/odev/${s.odev_id}`
                    : `${kok}/odevler`;

              return (
                <li key={`${s.tur}-${s.odev_id ?? 'm'}-${s.zaman}-${i}`}>
                  <Link
                    to={hedef}
                    className="flex items-start gap-3 rounded-sk-md border border-line bg-surface p-3 shadow-sk-sm transition-colors hover:bg-paper"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="mt-0.5 h-5 w-5 shrink-0 fill-current text-muted"
                      aria-hidden="true"
                    >
                      <path d={IKON[s.tur]} />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug text-ink">{cumle}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {bildirimZamani(s.zaman)}
                      </span>
                    </span>
                    {/* YENİ İŞARETİ YAZIYLA. Tek başına renkli bir nokta,
                        ekran okuyucuya ve renk körü birine hiçbir şey
                        söylemez. */}
                    {s.yeni && (
                      <span className="sk-sayi shrink-0 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold leading-none text-paper">
                        yeni
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncBoundary>

      {/* DÜRÜST SINIR — boş listede de yazıyor, çünkü tam o anda
          "bana haber gelmiyor mu?" sorusu doğuyor. */}
      <p className="mt-6 text-[13px] text-muted">{SINIR_NOTU}</p>
    </>
  );
}
