import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Field, Textarea } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import { YASAKLI_KELIMELER } from '@/lib/karne-sozu';
import {
  BANT_NOKTALARI,
  bantAraligi,
  puanMesaji,
  varsayilanCumle,
  type OzelCumleler,
} from '@/lib/ewalu-puan';

type OzelSatir = { bant: number; cumle: string };

/** Sunucudan gelen listeyi bant → cümle nesnesine çeviriyor. */
function nesneye(liste: OzelSatir[] | null | undefined): OzelCumleler {
  const o: OzelCumleler = {};
  for (const s of liste ?? []) o[s.bant] = s.cumle;
  return o;
}

/**
 * Yasaklı kelime UYARIR, ENGELLEMEZ.
 *
 * Liste `lib/karne-sozu.ts`'ten geliyor — İKİNCİ BİR LİSTE YAZILMADI.
 * İki ayrı yasak listesi zamanla ayrışır; aynı hata `eslint.config.js`'te
 * iki kez yaşandı.
 *
 * Engellememesi bilinçli: kural öğretmenin kendi kuralı ("başarısız,
 * yetersiz, zayıf öğrenci" gibi ifadeler öğrenciyi ETİKETLER). Kendi
 * ürününün metnini yazarken onu bloke etmek haddimiz olmazdı; hatırlatmak
 * yeterli. Son söz onda.
 */
function yasakliGecenler(metin: string): string[] {
  const k = metin.toLocaleLowerCase('tr');
  return YASAKLI_KELIMELER.filter((y) => k.includes(y.toLocaleLowerCase('tr')));
}

/**
 * Ewalu'nun puan cümlelerini öğretmen yazsın (0032).
 *
 * BUGÜNKÜ BEŞ CÜMLE VARSAYILAN OLARAK KALIYOR. Bu ekrana hiç girilmezse
 * öğrenciler bugün gördükleri cümlelerin aynısını görür; sunucudaki tablo
 * boş başlıyor ve yalnız DEĞİŞTİRİLEN bantları tutuyor. "Varsayılana dön"
 * de bu yüzden basit: satır siliniyor, koddaki cümle geri geliyor.
 *
 * YENİ SEKME AÇILMADI — menü zaten altı sekme ve yedincisi 360 px'de alt
 * çubuğa sığmıyor (ölçülmüştü). Buraya Ayarlar'dan geliniyor; cümle
 * yazmak nadir ve kasıtlı bir iş.
 *
 * PUAN ARALIKLARI DEĞİŞTİRİLEMİYOR ve poz seçilemiyor. `kutlama` yalnız
 * 85 ve üstünde — öğretmenin kendi kararıydı, bu ekran onu gevşetmiyor.
 */
export function EwaluMesajlari() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OzelSatir[]>('ewalu_mesajlari', {
    p_token: oturum?.token,
  });

  // Sunucudaki hâl (kaydedilmiş) ve kutudaki hâl (yazılmakta olan) ayrı
  // tutuluyor; "Kaydet" düğmesinin ne zaman anlamlı olduğu buradan çıkıyor.
  const [kayitli, setKayitli] = useState<OzelCumleler>({});
  const [taslak, setTaslak] = useState<Record<number, string>>({});
  const [calisan, setCalisan] = useState<number | null>(null);

  useEffect(() => {
    if (!veri) return;
    const o = nesneye(veri);
    setKayitli(o);
    // Kutulara, kaydedilmişse öğretmenin cümlesi; değilse VARSAYILAN
    // yazılıyor. Boş kutu göstermek, öğretmene "burada bir şey yok"
    // dedirtirdi — oysa öğrencinin gördüğü bir cümle var.
    const t: Record<number, string> = {};
    for (const b of BANT_NOKTALARI) t[b] = o[b] ?? varsayilanCumle(b) ?? '';
    setTaslak(t);
  }, [veri]);

  const ucYok = hata !== null && /could not find the function|schema cache/i.test(hata);

  async function kaydet(bant: number) {
    const metin = (taslak[bant] ?? '').trim();
    if (!metin) return bildir('Cümle boş olamaz.', 'hata');
    setCalisan(bant);
    try {
      await rpc('ewalu_mesaj_yaz', {
        p_token: oturum?.token,
        p_bant: bant,
        p_cumle: metin,
      });
      bildir('Kaydedildi — öğrenciler artık bu cümleyi görüyor', 'basari');
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kaydedilemedi.', 'hata');
    } finally {
      setCalisan(null);
    }
  }

  async function varsayilanaDon(bant: number) {
    setCalisan(bant);
    try {
      // `p_cumle: null` = satırı sil = koddaki varsayılan geri gelsin.
      await rpc('ewalu_mesaj_yaz', {
        p_token: oturum?.token,
        p_bant: bant,
        p_cumle: null,
      });
      setTaslak((t) => ({ ...t, [bant]: varsayilanCumle(bant) ?? '' }));
      bildir('Varsayılan cümleye dönüldü', 'basari');
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Geri alınamadı.', 'hata');
    } finally {
      setCalisan(null);
    }
  }

  return (
    <>
      <SayfaBasligi
        baslik="Ewalu’nun söyledikleri"
        aciklama="Öğrenci ödevini gönderdiğinde, puanına göre Ewalu’nun söyleyeceği cümleler."
      />

      {ucYok ? (
        <Card vurgu="uyari">
          <p className="text-[15px] text-ink">Bu bölüm henüz hazır değil.</p>
          <p className="mt-1 text-[14px] text-muted">
            Supabase panelinde <strong>0032</strong> dosyası çalıştırıldığında burada
            cümleleri düzenleyebileceksiniz. O zamana kadar öğrenciler bugünkü
            cümleleri görmeye devam ediyor — hiçbir şey bozulmuyor.
          </p>
          <div className="mt-4">
            <Button tur="sade" onClick={() => git('/ogretmen/ayarlar')}>
              Ayarlar’a dön
            </Button>
          </div>
        </Card>
      ) : (
        <AsyncBoundary
          durum={durum}
          bosBaslik="Cümleler yüklenemedi"
          bosAciklama="Tekrar deneyin."
          {...(hata ? { hataAciklama: hata } : {})}
          tekrarDene={yenile}
        >
          <Card className="mb-4">
            <p className="text-[15px] text-ink">
              Beş cümlenin beşi de şu an ürünle birlikte gelen hâliyle çalışıyor.
              Değiştirdiğiniz bant sizin yazdığınızla görünür; dokunmadığınız
              bantlar olduğu gibi kalır.
            </p>
            <p className="mt-2 text-[14px] text-muted">
              <strong>Kaydettiğiniz an bütün öğrenciler bunu görür.</strong> İstediğiniz
              zaman “Varsayılana dön” ile eski hâline dönebilirsiniz.
            </p>
            <p className="mt-2 text-[14px] text-muted">
              Puan aralıkları ve Ewalu’nun pozu değişmiyor: kutlama pozu yalnız
              85 ve üstünde çıkar.
            </p>
          </Card>

          {BANT_NOKTALARI.map((bant) => {
            const yazilan = taslak[bant] ?? '';
            const varsayilan = varsayilanCumle(bant) ?? '';
            const ozellestirilmis = kayitli[bant] !== undefined;
            const degisti = yazilan.trim() !== (kayitli[bant] ?? varsayilan).trim();
            const uyari = yasakliGecenler(yazilan);
            // Önizleme her zaman KUTUDAKİ metni gösteriyor: öğretmen
            // kaydetmeden önce öğrencinin ne göreceğini görüyor.
            const onizleme = puanMesaji(bant, { [bant]: yazilan });

            return (
              <Card key={bant} className="mb-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="sk-sayi text-[17px] font-semibold text-ink">
                    {bantAraligi(bant)}
                  </span>
                  <span className="text-[14px] text-muted">puan</span>
                  {ozellestirilmis && <Tag tur="bilgi">Sizin yazdığınız</Tag>}
                </div>

                {/* ÖNİZLEME: öğrencinin sonuç kartındaki düzenin aynısı
                    (`OdevTeslim.tsx` → `EwaluSozu`). Figür `dekoratif`:
                    cümle zaten yanında görünür metin. */}
                <div className="mb-3 flex items-start gap-3 rounded-sk border border-line bg-paper p-3">
                  <EwaluFigure poz={onizleme.poz} boyut={52} dekoratif className="shrink-0" />
                  <p className="text-[14px] leading-relaxed text-ink">
                    {onizleme.cumle || <span className="text-muted">(cümle boş)</span>}
                  </p>
                </div>

                <Field
                  etiket={`${bantAraligi(bant)} puan alan öğrenciye`}
                  ipucu={`En fazla 400 karakter. Şu an ${yazilan.length}.`}
                >
                  {(k) => (
                    <Textarea
                      {...k}
                      rows={3}
                      maxLength={400}
                      value={yazilan}
                      onChange={(e) => setTaslak((t) => ({ ...t, [bant]: e.target.value }))}
                    />
                  )}
                </Field>

                {uyari.length > 0 && (
                  // UYARI, ENGEL DEĞİL. Kaydet düğmesi çalışmaya devam ediyor.
                  <p className="mb-3 text-[14px] text-warning">
                    {`Bu cümlede “${uyari.join('”, “')}” geçiyor. Kendi dil kuralınız bu ifadelerden kaçınmayı söylüyor — yine de kaydedebilirsiniz.`}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {ozellestirilmis && (
                    <Button
                      tur="sade"
                      onClick={() => void varsayilanaDon(bant)}
                      yukleniyor={calisan === bant}
                      yuklenmeMetni="Geri alınıyor"
                    >
                      Varsayılana dön
                    </Button>
                  )}
                  <Button
                    onClick={() => void kaydet(bant)}
                    disabled={!degisti || yazilan.trim() === ''}
                    yukleniyor={calisan === bant}
                    yuklenmeMetni="Kaydediliyor"
                  >
                    Kaydet
                  </Button>
                </div>
              </Card>
            );
          })}
        </AsyncBoundary>
      )}
    </>
  );
}
