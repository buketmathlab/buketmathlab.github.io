import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useNavigate } from 'react-router-dom';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { MIGRATION_LISTESI } from '@/lib/migration-listesi';
import type { SurumDefteri as Defter, SurumSatiri } from '@/types/api';

const ZAMAN = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Sürüm defteri — hangi SQL dosyası canlıda çalıştı (0041).
 *
 * NEDEN VAR. Bu belirsizlik bir turluk fazladan iş olarak faturalandı:
 * onam metni sürüm 5 turunda 0035'in çalışıp çalışmadığı bilinmiyordu ve
 * emin olunamadığı için fazladan bir dosya (0036) yazıldı.
 *
 * FARKI SUNUCU DEĞİL BU EKRAN HESAPLIYOR — ve bu bilinçli. Sunucu yalnız
 * KENDİ defterini biliyor; depoda hangi dosyalar olduğunu bilmesinin yolu
 * yok, çünkü depo ondan bağımsız ilerliyor. İki listeyi bir araya getiren
 * tek yer burası. Sunucunun satırları ise aynen basılıyor, yeniden
 * yorumlanmıyor.
 *
 * "KESİN" İLE "ÇIKARIM" AYRI DURUYOR. 0041'den öncesi çıpa nesnelerinden
 * çıkarıldı; 0041 ve sonrası dosyanın kendi yazdığı kesin kayıt. İkisini
 * tek listede karıştırıp hepsine "uygulandı" demek, bilmediğimiz bir şeyi
 * biliyormuş gibi göstermek olurdu.
 */
export function SurumDefteri() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<Defter>('surum_defteri', {
    p_token: oturum?.token,
  });

  const defterdekiler = new Set((veri?.dosyalar ?? []).map((d) => d.dosya));
  const calistirilmamis = MIGRATION_LISTESI.filter((m) => !defterdekiler.has(m.no));
  const guncel = veri !== null && calistirilmamis.length === 0;

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ayarlar')}>
          ← Ayarlar
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Defter boş"
        bosAciklama="Hiçbir migration kaydı yok."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <div className="sk-defter">
            <h1 className="mb-1 font-display text-[22px] font-semibold text-ink">
              Sürüm defteri
            </h1>
            <p className="mb-4 text-[14px] text-muted">
              Veritabanınızda hangi kurulum dosyalarının çalıştığı.
            </p>

            {/* ÖNCE CEVAP, SONRA DÖKÜM. Buraya bakan kişinin tek sorusu
                "bir şey çalıştırmam gerekiyor mu" — döküm ikincil. */}
            <Card vurgu={guncel ? 'basari' : 'uyari'}>
              {guncel ? (
                <>
                  <h2 className="text-[18px] font-semibold text-ink">
                    Veritabanınız güncel
                  </h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">
                    Depodaki <span className="sk-sayi">{MIGRATION_LISTESI.length}</span>{' '}
                    kurulum dosyasının tamamı çalıştırılmış. Yapmanız gereken bir şey
                    yok.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[18px] font-semibold text-ink">
                    <span className="sk-sayi">{calistirilmamis.length}</span> dosya
                    çalıştırılmamış
                  </h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">
                    Supabase panelinde SQL Editor'a yapıştırıp çalıştırmanız gerekenler:
                  </p>
                  <ul className="mt-2 grid gap-1">
                    {calistirilmamis.map((m) => (
                      <li key={m.no} className="text-[14px] text-ink">
                        <code className="font-mono text-[13px]">{m.dosya}</code>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">
                    Dosyaların panele hazır sürümü depoda{' '}
                    <code className="font-mono text-[12px]">supabase/panel-icin/</code>{' '}
                    klasöründe. Önce yedek alın.
                  </p>
                </>
              )}
            </Card>

            <section className="mt-6">
              <h2 className="mb-2 font-display text-[18px] font-semibold text-ink">
                Defter
              </h2>
              <p className="mb-3 text-[13px] leading-relaxed text-muted">
                <strong>Kesin</strong> satırları dosya çalışırken kendisi yazdı.{' '}
                <strong>Çıkarım</strong> satırları defter kurulurken (0041)
                veritabanında aranan izlerden çıkarıldı — o tarihten öncesi için
                elimizde bundan iyisi yok.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th className="py-2 pr-3 font-semibold">Dosya</th>
                      <th className="py-2 pr-3 font-semibold">Kayıt</th>
                      <th className="py-2 font-semibold">Zaman</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.dosyalar.map((d) => (
                      <Satir key={d.dosya} satir={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              Defter yedeğe <strong>girmiyor</strong>: bir yedek boş bir projeye
              yüklenebiliyor ve orada şema, yedekten değil kurulum dosyalarından
              gelir. Defter yedekle taşınsaydı, hiçbir dosyayı çalıştırmamış bir
              proje "hepsi kurulu" derdi.
            </p>
          </div>
        )}
      </AsyncBoundary>
    </>
  );
}

function Satir({ satir }: { satir: SurumSatiri }) {
  const depoda = MIGRATION_LISTESI.find((m) => m.no === satir.dosya);
  return (
    <tr className="border-b border-line">
      <td className="py-2 pr-3 text-ink">
        <span className="sk-sayi">{satir.dosya}</span>
        {depoda && <span className="ml-2 text-muted">{adSade(depoda.dosya)}</span>}
      </td>
      <td className="py-2 pr-3">
        {satir.kaynak === 'migration' ? (
          <Tag tur="basari">Kesin</Tag>
        ) : (
          <Tag tur="notr">Çıkarım</Tag>
        )}
      </td>
      <td className="py-2 text-muted">{ZAMAN.format(new Date(satir.uygulandi))}</td>
    </tr>
  );
}

/** `0041_surum_defteri.sql` → `surum defteri` */
function adSade(dosya: string) {
  return dosya.replace(/^\d{4}_/, '').replace(/\.sql$/, '').replace(/_/g, ' ');
}

/** Ayarlar ekranından defteri açan kart. */
export function SurumDefteriDugmesi() {
  const git = useNavigate();
  return (
    <Card className="mt-4">
      <h2 className="mb-1 text-[18px] text-ink">Sürüm defteri</h2>
      <p className="mb-4 text-[14px] text-muted">
        Hangi kurulum dosyalarının çalıştırıldığı ve çalıştırılmayı bekleyen var mı.
        Artık hatırlamanız gerekmiyor.
      </p>
      <Button tur="ikincil" onClick={() => git('/ogretmen/ayarlar/surumler')}>
        Defteri aç
      </Button>
    </Card>
  );
}
