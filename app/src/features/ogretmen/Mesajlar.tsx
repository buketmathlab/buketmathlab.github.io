import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  ARAMA_BOS,
  ARAMA_YER_TUTUCU,
  KANAL_ETIKETI,
  KANAL_NOTU,
  bosDurum,
  zamanYazisi,
  type MesajKanali,
} from '@/lib/mesaj-listesi-metni';
import type { OgrenciListesi, YazismaListesi } from '@/types/api';

/**
 * Mesajlar sekmesi (0048).
 *
 * Öğretmenin isteği: "Kodlar sekmesi yerine mesajlar gelsin ve en son
 * mesajlaşılan öğrenciler en üstte çıksın ve sınıflarına göre
 * kategorize olsun."
 *
 * BU SEKME KODLAR'IN YERİNE GELDİ. Kodlar silinmedi, Ayarlar'a taşındı:
 * sekme çubuğu 360 px'de altı sekmeyle dolu (ölçülmüş) ve yedincisi
 * sığmıyor. Kod dağıtmak yılda bir yapılan bir iş, mesajlaşma her gün.
 *
 * İKİ KANAL AYRI DÜĞMEDE — öğretmenin kararı. 0025'te iki yazışma
 * bilerek ayrılmıştı (çocuk da öğretmenine velisinin okumayacağını
 * varsayarak yazıyor); o ayrım ekranda da görünüyor.
 *
 * SIRALAMA SUNUCUDAN GELİYOR, burada YENİDEN SIRALANMIYOR. Uç sınıfları
 * `max(son_mesaj)`, sınıf içini `son_mesaj` ile diziyor. Burada ikinci
 * bir `sort` yazmak, iki yerin bir gün ayrışması demekti — ve ekranda
 * görünen sıra sessizce yanlış olurdu.
 *
 * LİSTEDE YALNIZ YAZIŞMASI OLANLAR VAR (öğretmenin kararı). Yeni
 * yazışma arama kutusundan başlıyor; o kutu `ogrenciler_listesi`nin
 * `p_arama` parametresini kullanıyor, yeni bir uca gerek yok.
 */
export function Mesajlar() {
  const { oturum } = useOturum();
  const [kanal, setKanal] = useState<MesajKanali>('ogrenci');
  const [arama, setArama] = useState('');

  const { veri, durum, hata, yenile } = useVeri<YazismaListesi>('yazisma_listesi', {
    p_token: oturum?.token,
    p_kanal: kanal,
  });

  const aranan = arama.trim();

  return (
    <>
      <SayfaBasligi
        baslik="Mesajlar"
        aciklama="En son yazışılan sınıf ve öğrenci en üstte."
      />

      {/* KANAL DÜĞMELERİ — sekme çubuğuna YENİ SEKME eklemek yerine.
          Öğretmenin kararı: "ikisi de, ama ayrı bölümde." */}
      <div
        role="tablist"
        aria-label="Yazışma kanalı"
        className="mb-4 flex gap-2"
      >
        {(['ogrenci', 'veli'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kanal === k}
            onClick={() => setKanal(k)}
            className={`min-h-[44px] rounded-sk-sm border px-4 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              kanal === k
                ? 'border-ink bg-ink text-surface'
                : 'border-line bg-surface text-ink'
            }`}
          >
            {KANAL_ETIKETI[k]}
          </button>
        ))}
      </div>

      {/* İKİ KANALIN AYRI OLDUĞUNU SÖYLEYEN SATIR. Cümle 0048'de Veliler
          ekranından buraya taşındı — gerekçesi `mesaj-listesi-metni.ts`'te
          yazılı ve `kabuk-denetimi.mjs` onu burada ölçüyor. */}
      <p className="mb-4 text-[13px] leading-snug text-muted">{KANAL_NOTU[kanal]}</p>

      <div className="mb-4">
        <label htmlFor="mesaj-arama" className="sr-only">
          {ARAMA_YER_TUTUCU}
        </label>
        <input
          id="mesaj-arama"
          type="search"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder={ARAMA_YER_TUTUCU}
          className="min-h-[44px] w-full rounded-sk-sm border border-line bg-surface px-3 text-[15px] text-ink"
        />
      </div>

      {aranan ? (
        <AramaSonuclari arama={aranan} kanal={kanal} />
      ) : (
        <AsyncBoundary
          durum={durum}
          bosBaslik={bosDurum(kanal).baslik}
          bosAciklama={bosDurum(kanal).aciklama}
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          {veri && <Gruplar veri={veri} kanal={kanal} />}
        </AsyncBoundary>
      )}
    </>
  );
}

/** Sunucudan gelen sırayı OLDUĞU GİBİ çiziyor. */
function Gruplar({ veri, kanal }: { veri: YazismaListesi; kanal: MesajKanali }) {
  const git = useNavigate();
  const bos = bosDurum(kanal);

  if (veri.gruplar.length === 0) {
    return (
      <Card>
        <p className="font-semibold text-ink">{bos.baslik}</p>
        <p className="mt-1 text-[14px] text-muted">{bos.aciklama}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {veri.gruplar.map((g) => (
        <section key={g.sinif_id} aria-label={`${g.sinif} yazışmaları`}>
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted">
            {g.sinif}
            {g.okunmamis > 0 && (
              <Tag tur="uyari">
                <span className="sk-sayi">{g.okunmamis} yeni</span>
              </Tag>
            )}
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {g.satirlar.map((s) => (
                <li key={s.ogrenci_id}>
                  <button
                    type="button"
                    onClick={() => git(yazismaYolu(kanal, s.ogrenci_id))}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{s.ad}</span>
                      <span className="block text-[13px] text-muted">
                        {zamanYazisi(s.son_mesaj)}
                      </span>
                    </span>
                    {s.okunmamis > 0 && (
                      <Tag tur="uyari">
                        <span className="sk-sayi">{s.okunmamis} yeni</span>
                      </Tag>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

/**
 * Arama — yazışması OLMAYAN öğrenciye de ulaşmanın tek yolu.
 *
 * Liste bilerek yalnız yazışmalıları gösteriyor (öğretmenin kararı);
 * yeni bir yazışma başlatmak için burası var. Ayrı bir uç yazılmadı,
 * `ogrenciler_listesi` zaten arama yapıyor.
 */
function AramaSonuclari({ arama, kanal }: { arama: string; kanal: MesajKanali }) {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    {
      p_token: oturum?.token,
      p_arama: arama,
      p_sinif_id: null,
      p_sayfa: 1,
      p_boyut: 25,
      p_sirala: 'ad',
    },
    (v) => v.kayitlar.length === 0,
  );

  return (
    <AsyncBoundary
      durum={durum}
      bosBaslik={ARAMA_BOS}
      {...(hata ? { hataAciklama: hata } : {})}
      tekrarDene={yenile}
    >
      {veri && (
        <Card>
          <ul className="divide-y divide-line">
            {veri.kayitlar.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => git(yazismaYolu(kanal, o.id))}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{o.ad}</span>
                    <span className="block text-[13px] text-muted">
                      {o.sinif ?? 'Özel ders'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AsyncBoundary>
  );
}

/**
 * Yazışma ekranının adresi kanala göre değişiyor.
 *
 * İKİ AYRI ROTA KORUNDU (0025): `.../ogrenciler/yazisma/:id` öğrenci
 * kanalını, `.../veliler/yazisma/:id` veli kanalını açıyor ve her biri
 * `mesajlar_ogretmen`'i kendi kanalıyla çağırıyor. Tek rotaya indirip
 * kanalı sorgu parametresine taşımak, iki kanalın ayrı olduğunu
 * söyleyen bütün ölçümleri elden geçirmeyi gerektirirdi — bu turun işi
 * değil.
 */
function yazismaYolu(kanal: MesajKanali, ogrenciId: string): string {
  return kanal === 'ogrenci'
    ? `/ogretmen/ogrenciler/yazisma/${ogrenciId}`
    : `/ogretmen/veliler/yazisma/${ogrenciId}`;
}
