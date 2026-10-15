import { SekizWordmark } from '@/components/brand/SekizWordmark';
import {
  AYDINLATMA_BASLIK,
  AYDINLATMA_BOLUMLERI,
  AYDINLATMA_GIRIS,
  AYDINLATMA_TARIHI,
  VERI_SORUMLUSU,
} from '@/lib/aydinlatma-metni';

/**
 * KVKK AYDINLATMA METNİ SAYFASI — herkese açık, `/yeni/aydinlatma/`.
 *
 * Ekranda okunur; "Yazdır" ile A4'e çıkar. Kâğıtta imza bloğu var: okul
 * müdürlüğü belgeyi imzalayıp veli bilgilendirme dosyasına koyabilsin
 * (denetim öncesi incelemenin önerisi).
 */
export function Aydinlatma() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-8 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href="/yeni/" aria-label="SEKİZ giriş ekranı">
          <SekizWordmark boyut="sm" bicim="sade" />
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[44px] items-center rounded-sk-md border border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:border-ink-soft"
        >
          Yazdır
        </button>
      </div>

      <article className="sk-aydinlatma">
        <p className="text-[13px] font-semibold tracking-wide text-muted">{VERI_SORUMLUSU}</p>
        <h1 className="mt-1 text-[26px] leading-tight text-ink">{AYDINLATMA_BASLIK}</h1>
        <p className="mt-1 text-[13px] text-muted">Tarih: {AYDINLATMA_TARIHI}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">{AYDINLATMA_GIRIS}</p>

        {AYDINLATMA_BOLUMLERI.map((b) => (
          <section key={b.baslik} className="mt-6 break-inside-avoid">
            <h2 className="text-[18px] text-ink">{b.baslik}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
              {b.maddeler.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-6 text-[13px] text-muted">
          Bu metin uygulamanın gerçekte yaptığını anlatır; hukuki görüş değildir.
        </p>

        {/* İmza bloğu — kâğıtta. Ekranda da görünür: ne imzalanacağı belli olsun. */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-[14px] text-ink">
          <div>
            <p className="font-semibold">Hazırlayan</p>
            <p className="mt-8 border-t border-line pt-1 text-muted">Ad Soyad · İmza · Tarih</p>
          </div>
          <div>
            <p className="font-semibold">Onaylayan (Okul Müdürü)</p>
            <p className="mt-8 border-t border-line pt-1 text-muted">Ad Soyad · İmza · Mühür</p>
          </div>
        </div>
      </article>

      <p className="mt-8 text-center print:hidden">
        <a
          href="/yeni/"
          className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-ink underline"
        >
          Giriş ekranına dön
        </a>
      </p>
    </main>
  );
}
