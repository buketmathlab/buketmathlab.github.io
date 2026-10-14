import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { GenelOzet, Kutucuk } from '@/features/genel/GenelOzet';
import { listeDurumu, useMudurPaneli } from '@/features/mudur/mudur-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { OKUL_ADI } from '@/lib/sinif-yazdirma-metni';
import { ortalamaYazisi } from '@/lib/odev-kiyasi-metni';
import type { ProjeRaporu as ProjeRaporuVerisi } from '@/types/api';

const SAYI = new Intl.NumberFormat('tr-TR');
const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const ZAMAN = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

/** "%84" — payda sıfırsa "—". */
function oran(pay: number, payda: number): string {
  return payda > 0 ? `%${Math.round((100 * pay) / payda)}` : '—';
}

/**
 * PROJE RAPORU (0075) — Okul Gelişim Projesi izleme-değerlendirme.
 *
 * Öğretmenin isteği: proje ProIz'e işlendi ve izleme-değerlendirme
 * komisyonu dayanak istiyor — "kaç ödev hazırladım… kontrol edilen soru
 * sayıları, öğrencilerin başarı performansları… velilerden veli onam
 * bilgisi alındığını mutlaka yaz."
 *
 * Müdür kabuğunun bir sekmesi: müdür kendi hesabında, platform sahibi
 * müdür ekranı önizlemesinde açıyor. Üstte projeye özgü sayılar
 * (`proje_raporu`), altta okulun genel özeti — kabuğun zaten çektiği
 * `mudur_paneli`, yani Genel sekmesiyle aynı an.
 *
 * KÂĞIDA ÇIKMAK İÇİN YAPILDI: "Yazdır / PDF" ve A4 düzeni (`.sk-rapor`);
 * kâğıtta okul, proje ve rapor zamanı başlığı var, kabuk çıkmıyor.
 * Öğrenci adı YOK — yalnız toplu sayılar (KVKK).
 */
export function ProjeRaporu() {
  const { oturum } = useOturum();
  const panel = useMudurPaneli();
  const rapor = useVeri<ProjeRaporuVerisi>('proje_raporu', { p_token: oturum?.token });
  const r =
    rapor.veri && typeof rapor.veri === 'object' && 'kayit' in rapor.veri ? rapor.veri : null;
  const ucYok = rapor.hata !== null && /could not find the function|schema cache/i.test(rapor.hata);

  return (
    <div className="sk-rapor">
      <div className="print:hidden">
        <SayfaBasligi
          baslik="Proje raporu"
          aciklama="Okul Gelişim Projesi izleme-değerlendirme için SEKİZ'in sayıları. Yazdırıp ya da PDF olarak kaydedip dosyaya ekleyebilirsiniz."
          eylem={
            <Button onClick={() => window.print()} disabled={!r}>
              Yazdır / PDF
            </Button>
          }
        />
      </div>

      {/* Kâğıt başlığı — ekranda da görünüyor: ne yazdırılacağı belli olsun.
          `header` DEĞİL `div`: yazdırma kuralı kabuğun `header`'ını gizliyor
          (index.css) ve başlık kâğıttan düşüyordu — denetim R3 yakaladı. */}
      <div className="sk-rapor-baslik mb-4 border-b border-line pb-3 text-center">
        <p className="text-[13px] font-semibold tracking-wide text-muted">T.C. İSTANBUL VALİLİĞİ</p>
        <p className="text-[13px] font-semibold text-muted">Beşiktaş / {OKUL_ADI} Müdürlüğü</p>
        <p className="font-display text-[20px] font-semibold text-ink">
          Okul Gelişim Projesi: SEKİZ — İzleme ve Değerlendirme Raporu
        </p>
        {r && (
          <p className="text-[13px] text-muted">
            Rapor zamanı: {ZAMAN.format(new Date(r.rapor_zamani))} · Kaynak: SEKİZ veritabanı
            (sekizkyal.com)
          </p>
        )}
      </div>

      {ucYok ? (
        <Card>
          <p className="text-[14px] text-ink">
            Bu sayfa, SQL 0075 Supabase panelinde çalıştırıldıktan sonra kullanılabilir.
          </p>
        </Card>
      ) : (
        <AsyncBoundary
          durum={rapor.durum}
          bosBaslik="Rapor boş"
          tekrarDene={rapor.yenile}
          {...(rapor.hata ? { hataAciklama: rapor.hata } : {})}
        >
          {r && <RaporGovdesi r={r} />}
        </AsyncBoundary>
      )}

      <section className="sk-rapor-bolum mt-6">
        <h2 className="mb-3 text-[20px] text-ink">Okulun genel özeti</h2>
        <AsyncBoundary
          durum={listeDurumu(panel.durum, (panel.veri?.siniflar.length ?? 0) === 0)}
          bosBaslik="Henüz sınıf yok"
          {...(panel.hata ? { hataAciklama: panel.hata } : {})}
          tekrarDene={panel.yenile}
        >
          {panel.veri && <GenelOzet veri={panel.veri} />}
        </AsyncBoundary>
      </section>
    </div>
  );
}

function RaporGovdesi({ r }: { r: ProjeRaporuVerisi }) {
  const k = r.kayit;
  const o = r.odev;
  const g = r.gonderim;
  const cevaplanan = g.dogru + g.yanlis;
  return (
    <div className="flex flex-col gap-4">
      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Katılım ve kayıt</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kutucuk
            ad="Kayıtlı öğrenci"
            deger={SAYI.format(k.ogrenci_sayisi)}
            not={`${k.sube_sayisi} şube`}
          />
          <Kutucuk
            ad="Giriş yapan öğrenci"
            deger={SAYI.format(k.giris_yapan_ogrenci)}
            not={`${oran(k.giris_yapan_ogrenci, k.ogrenci_sayisi)} · en az`}
          />
          <Kutucuk
            ad="Giriş yapan veli"
            deger={SAYI.format(k.giris_yapan_veli)}
            not={`${oran(k.giris_yapan_veli, k.ogrenci_sayisi)} · en az`}
          />
          <Kutucuk
            ad="Veli onamı (KVKK)"
            deger={SAYI.format(k.veli_onami)}
            not={`${oran(k.veli_onami, k.ogrenci_sayisi)} öğrencinin velisi`}
          />
          <Kutucuk ad="Öğretmen hesabı" deger={SAYI.format(k.ogretmen_hesabi)} />
          <Kutucuk ad="Müdür hesabı" deger={SAYI.format(k.mudur_hesabi)} not="yalnız izleme" />
        </dl>
        <p className="mt-2 text-[12px] text-muted">
          “Giriş yapan” en az bir oturum, gönderim ya da onam izi olan hesap; eski oturum kayıtları
          temizlendiği için alt sınırdır. Veli onamı, veli ilk girişinde onam metnini onaylamadan
          hiçbir ekrana geçemediği için ayrıca kayıt altındadır.
          {k.ilk_veli_onami &&
            ` İlk onam: ${new Date(k.ilk_veli_onami).toLocaleDateString('tr-TR')}.`}
        </p>
      </section>

      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Ödevler</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kutucuk
            ad="Hazırlanan ödev"
            deger={SAYI.format(o.hazirlanan)}
            not={`${o.test} test · ${o.acik_uclu} açık uçlu`}
          />
          <Kutucuk
            ad="Şubelere ulaşan ödev"
            deger={SAYI.format(o.subeye_ulasan)}
            not="bir ödev birden çok şubeye"
          />
          <Kutucuk ad="Hazırlanan soru" deger={SAYI.format(o.hazirlanan_soru)} />
          <Kutucuk ad="Şubelere ulaşan soru" deger={SAYI.format(o.subeye_ulasan_soru)} />
          <Kutucuk
            ad="Çözümlü cevap anahtarı"
            deger={SAYI.format(o.cozumlu_anahtar)}
            not={`${oran(o.cozumlu_anahtar, o.hazirlanan)} ödevde`}
          />
          <Kutucuk
            ad="Soru dosyası (PDF)"
            deger={SAYI.format(o.soru_dosyasi)}
            not={`${oran(o.soru_dosyasi, o.hazirlanan)} ödevde`}
          />
          <Kutucuk
            ad="Konu-kazanım etiketli"
            deger={SAYI.format(o.konu_etiketli)}
            not={`${oran(o.konu_etiketli, o.hazirlanan)} ödevde`}
          />
        </dl>
      </section>

      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Gönderim ve değerlendirme</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kutucuk
            ad="Gönderilen ödev"
            deger={SAYI.format(g.toplam)}
            not={`${SAYI.format(g.gonderen_ogrenci)} öğrenci`}
          />
          <Kutucuk
            ad="Kontrol edilen soru"
            deger={SAYI.format(g.kontrol_edilen_soru)}
            not="gönderilen çözümlerde"
          />
          <Kutucuk
            ad="Otomatik puanlanan soru"
            deger={SAYI.format(g.otomatik_puanlanan_soru)}
            not="test ödevlerinde, anında"
          />
          <Kutucuk ad="Ortalama puan" deger={ortalamaYazisi(g.ortalama) ?? '—'} />
          <Kutucuk
            ad="Doğru cevap"
            deger={SAYI.format(g.dogru)}
            not={`cevaplananların ${oran(g.dogru, cevaplanan)}'i`}
          />
          <Kutucuk ad="Yanlış cevap" deger={SAYI.format(g.yanlis)} />
          <Kutucuk ad="Boş bırakılan" deger={SAYI.format(g.bos)} />
          <Kutucuk
            ad="Çözüme anında ulaşan"
            deger={SAYI.format(g.cozume_ulasan)}
            not="gönderimden hemen sonra"
          />
        </dl>
        <p className="mt-2 text-[12px] text-muted">
          Çözümlü cevap anahtarı yalnız harf listesi değil, soruların adım adım çözümüdür; öğrenci
          ödevini gönderdiği anda yapamadığı sorunun çözümünü görür. Veliye anahtar hiçbir zaman
          gösterilmez.
        </p>
      </section>

      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Aylara göre</h2>
        <Tablo
          basliklar={['Ay', 'Hazırlanan ödev', 'Şubelere ulaşan', 'Gönderim', 'Ortalama']}
          satirlar={r.aylar.map((a) => [
            AY.format(new Date(`${a.ay.slice(0, 10)}T12:00:00`)),
            SAYI.format(a.hazirlanan),
            SAYI.format(a.subeye_ulasan),
            SAYI.format(a.gonderim),
            ortalamaYazisi(a.ortalama) ?? '—',
          ])}
        />
      </section>

      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Sınıf düzeylerine göre</h2>
        <Tablo
          basliklar={['Düzey', 'Şube', 'Öğrenci', 'Veli onamı', 'Ödev', 'Gönderim', 'Ortalama']}
          satirlar={r.seviyeler.map((v) => [
            `${v.seviye}. sınıf`,
            SAYI.format(v.sube_sayisi),
            SAYI.format(v.ogrenci_sayisi),
            `${SAYI.format(v.veli_onami)} (${oran(v.veli_onami, v.ogrenci_sayisi)})`,
            SAYI.format(v.hazirlanan),
            SAYI.format(v.gonderim),
            ortalamaYazisi(v.ortalama) ?? '—',
          ])}
        />
      </section>

      <section className="sk-rapor-bolum">
        <h2 className="mb-2 text-[18px] text-ink">Öğretmenler</h2>
        <Tablo
          basliklar={['Öğretmen', 'Hazırlanan ödev', 'Soru', 'Şube']}
          satirlar={r.ogretmenler.map((t) => [
            t.ad,
            SAYI.format(t.hazirlanan),
            SAYI.format(t.soru),
            SAYI.format(t.sube),
          ])}
        />
      </section>
    </div>
  );
}

function Tablo({ basliklar, satirlar }: { basliklar: string[]; satirlar: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-sk-md border border-line bg-surface">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            {basliklar.map((b, i) => (
              <th
                key={b}
                scope="col"
                className={`px-3 py-2 font-semibold ${i ? 'text-right' : ''}`}
              >
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr key={s[0]} className="border-b border-line-soft last:border-0">
              {s.map((h, i) => (
                <td
                  key={i}
                  className={`px-3 py-2 ${i ? 'sk-sayi text-right' : 'font-semibold text-ink'}`}
                >
                  {h}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
