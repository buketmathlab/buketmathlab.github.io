import { useState } from 'react';
import { Tag } from '@/components/ui/Tag';
import { Yazisma } from '@/components/ui/Yazisma';
import {
  okunmamisSayisi,
  ogretmeninMesajlari,
  varsayilanOgretmen,
  yazismaOgretmenleri,
} from '@/lib/mesaj-ogretmenleri';
import type { Mesaj, MesajOgretmeni } from '@/types/api';

type Kim = 'veli' | 'ogrenci';

const METIN: Record<
  Kim,
  {
    soru: string;
    not: string;
    yerTutucu: string;
    bos: (ad: string) => string;
    kapali: (ad: string) => string;
  }
> = {
  veli: {
    soru: 'Hangi öğretmenle yazışmak istiyorsunuz?',
    not: 'Her öğretmenle yazışmanız ayrıdır. Yazdığınızı yalnız seçtiğiniz öğretmen görür.',
    yerTutucu: 'Sormak istediğinizi yazın.',
    bos: (ad) => `${ad} ile henüz mesajınız yok. Sormak istediğinizi aşağıdan yazabilirsiniz.`,
    kapali: (ad) => `${ad} artık çocuğunuzun öğretmenleri arasında görünmüyor; yeni mesaj gönderilemez.`,
  },
  ogrenci: {
    soru: 'Hangi öğretmeninle yazışmak istiyorsun?',
    not: 'Her öğretmeninle yazışman ayrı. Yazdığını yalnız seçtiğin öğretmen görür.',
    yerTutucu: 'Sormak istediğini yaz.',
    bos: (ad) => `${ad} ile henüz mesajın yok. Sormak istediğini aşağıdan yazabilirsin.`,
    kapali: (ad) => `${ad} artık öğretmenlerin arasında görünmüyor; yeni mesaj gönderemezsin.`,
  },
};

/**
 * Veli ve öğrencinin yazışması — ÖĞRETMEN SEÇİMİYLE (0058).
 *
 * Olay: başka öğretmenin sınıfındaki veli mesaj gönderemiyordu, çünkü
 * platform sahibi de o sınıfa bağlı ve sunucu mesajın kime gideceğini
 * bilemiyordu. Öğretmenin kararı: veli kime yazacağını seçsin.
 *
 * Her öğretmenle olan yazışma AYRI gösteriliyor: öğretmen tarafı da
 * yalnız kendi mesajlarını görüyor; ekran tek bir karışık akış gösterseydi
 * veli kime yazdığını, kimin cevap verdiğini karıştırırdı.
 *
 * Tek öğretmen varsa seçici çizilmiyor, yalnız "Kime: …" yazıyor.
 *
 * 0058 ÇALIŞMAMIŞ PANEL: `ogretmenler` gelmiyor; bileşen bugünkü tek
 * yazışmayı aynen çiziyor ve `p_ogretmen_id` GÖNDERMİYOR (eski uç bu
 * parametreyi tanımaz).
 */
export function OgretmenliYazisma({
  kim,
  token,
  mesajlar,
  ogretmenler: liste,
  sonGorulme,
  yenile,
  eski,
}: {
  kim: Kim;
  token: string | undefined;
  mesajlar: Mesaj[];
  ogretmenler: MesajOgretmeni[] | undefined;
  sonGorulme: string | null;
  yenile: () => void;
  /** 0058 öncesi panelde bugünkü metinler. */
  eski: { adlar: Record<string, string>; yazmaEtiketi: string; bosMetin: string };
}) {
  const metin = METIN[kim];
  const ogretmenler = yazismaOgretmenleri(liste, mesajlar);
  const [secilen, setSecilen] = useState<string | undefined>(undefined);

  if (ogretmenler.length === 0) {
    return (
      <Yazisma
        mesajlar={mesajlar}
        benKimim={kim}
        adlar={eski.adlar}
        yazmaEtiketi={eski.yazmaEtiketi}
        yerTutucu={metin.yerTutucu}
        gonderParametreleri={{ p_token: token }}
        gonderildi={yenile}
        bosMetin={eski.bosMetin}
      />
    );
  }

  const ilkId = ogretmenler[0]?.id;
  const seciliId =
    (secilen && ogretmenler.some((o) => o.id === secilen) ? secilen : undefined) ??
    varsayilanOgretmen(ogretmenler, mesajlar) ??
    ilkId!;
  const secili = ogretmenler.find((o) => o.id === seciliId)!;
  const gosterilen = ogretmeninMesajlari(mesajlar, seciliId, ilkId);

  return (
    <>
      {ogretmenler.length > 1 && (
        <div className="mb-4">
          <p id="ogretmen-secimi" className="mb-2 text-[15px] font-semibold text-ink">
            {metin.soru}
          </p>
          <div role="group" aria-labelledby="ogretmen-secimi" className="flex flex-wrap gap-2">
            {ogretmenler.map((o) => {
              const yeni = okunmamisSayisi(ogretmeninMesajlari(mesajlar, o.id, ilkId), sonGorulme);
              const aktif = o.id === seciliId;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => setSecilen(o.id)}
                  className={`flex min-h-[44px] max-w-full items-center gap-2 rounded-sk-sm border px-4 py-2 text-left text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    aktif ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink'
                  }`}
                >
                  <span className="min-w-0 break-words">{o.ad}</span>
                  {yeni > 0 && (
                    <Tag tur="uyari">
                      <span className="sk-sayi">{yeni} yeni</span>
                    </Tag>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">{metin.not}</p>
        </div>
      )}

      {/* `key`: öğretmen değişince yazılmış ama gönderilmemiş metin bir
          önceki öğretmenin kutusunda kalmasın — yanlış kişiye gitmesin. */}
      <Yazisma
        key={seciliId}
        mesajlar={gosterilen}
        benKimim={kim}
        adlar={{ ogretmen: secili.ad }}
        yazmaEtiketi={`Kime: ${secili.ad}`}
        yerTutucu={metin.yerTutucu}
        gonderParametreleri={{ p_token: token, p_ogretmen_id: secili.id }}
        gonderildi={yenile}
        bosMetin={metin.bos(secili.ad)}
        {...(secili.yazilabilir ? {} : { yazmaKapali: { sebep: metin.kapali(secili.ad) } })}
      />
    </>
  );
}
