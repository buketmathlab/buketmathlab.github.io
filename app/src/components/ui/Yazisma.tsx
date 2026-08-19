import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { rpc } from '@/services/supabase';

const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export type YazismaMesaji = {
  kimden: string;
  metin: string;
  zaman: string;
};

/**
 * Bir yazışma: mesaj listesi + yazma alanı.
 *
 * DÖRT YERDE KULLANILIYOR (0025): öğretmen↔veli, öğretmen↔öğrenci,
 * öğrencinin kendi ekranı, velinin kendi ekranı. Dört kopya zamanla
 * ayrışırdı — özellikle "kim yazdı" bilgisinin renkle DEĞİL yazıyla da
 * verilmesi gibi erişilebilirlik ayrıntıları üç yerde sessizce düşerdi.
 *
 * Bileşen KANALI BİLMİYOR ve bilmemeli: hangi mesajların geleceğine
 * sunucu karar veriyor (`kanal` sütunu). Burada bir süzgeç olsaydı sınır
 * arayüze inmiş olurdu — Part XXI'in tam tersi.
 */
export function Yazisma({
  mesajlar,
  benKimim,
  adlar,
  yazmaEtiketi,
  yerTutucu,
  gonderParametreleri,
  gonderildi,
  bosMetin,
  yazmaKapali,
}: {
  mesajlar: YazismaMesaji[];
  /** Hangi `kimden` değeri "ben"im: sağa hizalanan taraf. */
  benKimim: string;
  /** `kimden` değerlerinin ekranda görünecek adı. */
  adlar: Record<string, string>;
  yazmaEtiketi: string;
  yerTutucu: string;
  /** `mesaj_gonder`'e gidecek parametreler; `p_metin` burada eklenir. */
  gonderParametreleri: Record<string, unknown>;
  gonderildi: () => void;
  bosMetin: string;
  /** Yazma alanı hiç çizilmesin (ör. veli kodu yokken). */
  yazmaKapali?: { sebep: string };
}) {
  const { bildir } = useToast();
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder() {
    const t = metin.trim();
    if (!t) return;
    setGonderiliyor(true);
    try {
      await rpc('mesaj_gonder', { ...gonderParametreleri, p_metin: t });
      setMetin('');
      gonderildi();
      bildir('Mesaj gönderildi', 'basari');
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Mesaj gönderilemedi.', 'hata');
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <>
      <Card className="mb-4">
        {mesajlar.length === 0 ? (
          <p className="text-[14px] text-muted">{bosMetin}</p>
        ) : (
          <ul className="space-y-3">
            {mesajlar.map((m, i) => {
              const benim = m.kimden === benKimim;
              return (
                <li key={i} className={benim ? 'text-right' : ''}>
                  {/* Kim yazdı bilgisi RENKLE DEĞİL, yazıyla da veriliyor:
                      renk körlüğünde hizalama ve renk tek başına ayırt
                      edici olmaz. */}
                  <span className="mb-1 block text-[12px] font-bold text-muted">
                    {benim ? 'Siz' : (adlar[m.kimden] ?? m.kimden)} ·{' '}
                    {ZAMAN.format(new Date(m.zaman))}
                  </span>
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-sk-md px-3 py-2 text-left text-[15px] ${
                      benim ? 'bg-ink text-paper' : 'bg-line-soft text-ink'
                    }`}
                  >
                    {m.metin}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {yazmaKapali ? (
        <Card>
          <p className="text-[14px] text-muted">{yazmaKapali.sebep}</p>
        </Card>
      ) : (
        <Card>
          <Field etiket={yazmaEtiketi}>
            {(kimlik) => (
              <Textarea
                {...kimlik}
                rows={3}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                maxLength={4000}
                placeholder={yerTutucu}
              />
            )}
          </Field>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="sk-sayi text-[12px] text-muted">{metin.length}/4000</span>
            <Button
              onClick={gonder}
              yukleniyor={gonderiliyor}
              yuklenmeMetni="Gönderiliyor"
              {...(metin.trim() ? {} : { disabled: true })}
            >
              Gönder
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
