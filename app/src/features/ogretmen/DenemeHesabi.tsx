import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { denemeyeGecildi } from '@/lib/deneme-oturumu';
import { rpc } from '@/services/supabase';
import type { GirisSonucu, Sinif } from '@/types/api';

export type DenemeHesabiSatiri = {
  id: string;
  sinif_id: string;
  sinif: string;
  seviye: number;
  ogrenci_kodu: string | null;
  veli_kodu: string | null;
};

/**
 * DENEME HESAPLARI (0073, 0074) — yalnız platform sahibinde, Öğretmenler
 * sayfasında.
 *
 * Öğretmenin isteği: "Bir tane deneme yapmak için gerçek olmayan bir
 * öğrenci için öğrenci hesabı ve aynı şekilde veli hesabı olsun. Gerçek
 * öğrenci ve velilerin tüm özellikleri birebir olsun. Gerekirse ödev de
 * gönderebileyim."
 *
 * 0074: HER DÜZEYE AYRI HESAP. "9. sınıf olarak seçtiğimde… 9. sınıflara
 * en başından beri verdiğim tüm ödevler gözüksün. Diğer sınıf düzeyleri
 * için de aynı şey olsun." Deneme öğrenci seçilen GERÇEK şubede duruyor ve
 * o şubeye en baştan beri verilen bütün ödevleri görüyor; süresi geçmiş
 * olanlara da gönderebiliyor (sunucu: `sinif_giris` NULL ve `odev_gonder`
 * istisnası). Hiçbir sayıya karışmıyor ve listelerde yalnız sahip görüyor.
 *
 * "Denemeyi sıfırla" yalnız O hesabı silip AYNI kodlarla yeniden kuruyor:
 * depodaki eski çözüm fotoğrafı yeni gönderime karışmasın (gerekçe 0073'te).
 *
 * TEK TIKLA GİRİŞ. "Öğrenci olarak gir" / "Veli olarak gir", gerçek bir
 * girişin aynısı: `giris` ucu deneme koduyla çağrılıyor; sahibin jetonu
 * dönüş için saklanıyor ve öğrenci/veli ekranında kapatılamayan
 * `DenemeSeridi` çıkıyor.
 */
export function DenemeHesabi() {
  const { oturum, girisYap } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();
  const durum = useVeri<DenemeHesabiSatiri[]>('deneme_hesaplari', { p_token: oturum?.token });
  const siniflar = useVeri<Sinif[]>('siniflar_listesi', { p_token: oturum?.token, p_arsiv: false });
  const [yeniSinif, setYeniSinif] = useState('');
  /** Satır başına "Sınıfını değiştir" seçimi; anahtar deneme hesabının kimliği. */
  const [tasi, setTasi] = useState<Record<string, string>>({});
  const [calisiyor, setCalisiyor] = useState(false);
  const [onay, setOnay] = useState<{ tur: 'sifirla' | 'sil'; h: DenemeHesabiSatiri } | null>(null);

  // 0074 panelde çalıştırılmadıysa uç yok: kart bozulmasın, ne yapılacağını söylesin.
  const ucYok = durum.hata !== null && /could not find the function|schema cache/i.test(durum.hata);
  // `Array.isArray`: beklenmeyen bir yanıt (eski panel, taklit) kartı
  // düşürmesin — sayfanın tamamı beyaz kalırdı.
  const okulSiniflari = (Array.isArray(siniflar.veri) ? siniflar.veri : [])
    .filter((s) => !s.ozel && !s.arsiv)
    .sort((a, b) => a.seviye - b.seviye || a.sube.localeCompare(b.sube, 'tr'));
  const hesaplar = Array.isArray(durum.veri) ? durum.veri : null;
  const doluDuzeyler = new Set((hesaplar ?? []).map((h) => h.seviye));
  /** Hesabı olmayan düzeylerin şubeleri — "ekle" seçimi yalnız bunlar. */
  const bosSiniflar = okulSiniflari.filter((s) => !doluDuzeyler.has(s.seviye));
  /** Her boş düzeyin ilk şubesi — "düzeylere oluştur" bunları açıyor. */
  const ilkSubeler = bosSiniflar.filter(
    (s, i) => bosSiniflar.findIndex((x) => x.seviye === s.seviye) === i,
  );

  async function cagir(uc: string, ek: Record<string, unknown>, basari: string) {
    setCalisiyor(true);
    try {
      await rpc(uc, { p_token: oturum?.token, ...ek });
      bildir(basari, 'basari');
      durum.yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    } finally {
      setCalisiyor(false);
      setOnay(null);
    }
  }

  /** Sırayla: biri hata verirse (ör. o düzey az önce açıldı) öbürleri yine açılır. */
  async function duzeylereOlustur() {
    setCalisiyor(true);
    let acilan = 0;
    for (const s of ilkSubeler) {
      try {
        await rpc('deneme_hesabi_olustur', { p_token: oturum?.token, p_sinif: s.id });
        acilan++;
      } catch (e) {
        bildir(e instanceof Error ? e.message : `${s.ad} için açılamadı.`, 'hata');
      }
    }
    if (acilan > 0) bildir(`${acilan} deneme hesabı oluşturuldu.`, 'basari');
    setCalisiyor(false);
    durum.yenile();
  }

  async function olarakGir(kod: string) {
    if (!oturum?.token) return;
    setCalisiyor(true);
    try {
      const s = await rpc<GirisSonucu>('giris', { p_kod: kod });
      if (s.rol !== 'ogrenci' && s.rol !== 'veli') {
        throw new Error('Deneme hesabına girilemedi. Denemeyi sıfırlayıp yeniden deneyin.');
      }
      denemeyeGecildi(oturum.token, s.ogrenci.id);
      girisYap({ rol: s.rol, token: s.token, ogrenci: s.ogrenci });
      git(s.rol === 'ogrenci' ? '/ogrenci' : '/veli', { replace: true });
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Deneme hesabına girilemedi.', 'hata');
      setCalisiyor(false);
    }
  }

  const secenekler = (liste: Sinif[]) =>
    liste.map((s) => (
      <option key={s.id} value={s.id}>
        {s.ad}
      </option>
    ));

  return (
    <Card>
      <h2 className="mb-1 text-[18px] text-ink">Deneme hesapları</h2>
      <p className="mb-3 text-[14px] text-muted">
        Her sınıf düzeyi için gerçek olmayan bir öğrenci ve velisi. Seçtiğiniz şubeye en başından
        beri verilen bütün ödevleri görür; süresi geçmiş olanlar dahil hepsine cevap verip
        gönderebilirsiniz. Deneme öğrenci hiçbir ortalamaya ve sayıya karışmaz; listelerde yalnız
        siz görürsünüz.
      </p>

      {ucYok ? (
        <p className="text-[14px] text-ink">
          Bu bölüm, SQL 0074 Supabase panelinde çalıştırıldıktan sonra kullanılabilir.
        </p>
      ) : !hesaplar ? (
        <p className="text-[14px] text-muted">Yükleniyor…</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {hesaplar.map((h) => {
              // Taşınabilecek şubeler: kendi düzeyi ya da hesabı olmayan bir düzey.
              const hedefler = okulSiniflari.filter(
                (s) => s.seviye === h.seviye || !doluDuzeyler.has(s.seviye),
              );
              const secili = tasi[h.id] ?? h.sinif_id;
              return (
                <section
                  key={h.id}
                  aria-label={`${h.seviye}. sınıf deneme hesabı`}
                  className="rounded-sk-md border border-line p-3"
                >
                  <h3 className="mb-2 text-[16px] font-semibold text-ink">
                    {h.seviye}. sınıf · {h.sinif}
                  </h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button
                      olcu="sm"
                      disabled={calisiyor || !h.ogrenci_kodu}
                      onClick={() => h.ogrenci_kodu && void olarakGir(h.ogrenci_kodu)}
                    >
                      Öğrenci olarak gir
                    </Button>
                    <Button
                      olcu="sm"
                      disabled={calisiyor || !h.veli_kodu}
                      onClick={() => h.veli_kodu && void olarakGir(h.veli_kodu)}
                    >
                      Veli olarak gir
                    </Button>
                  </div>
                  <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
                    <dt className="text-muted">Öğrenci kodu</dt>
                    <dd className="sk-sayi font-semibold tracking-wider text-ink">
                      {h.ogrenci_kodu ?? '—'}
                    </dd>
                    <dt className="text-muted">Veli kodu</dt>
                    <dd className="sk-sayi font-semibold tracking-wider text-ink">
                      {h.veli_kodu ?? '—'}
                    </dd>
                  </dl>
                  <Field etiket={`${h.sinif} deneme hesabının sınıfını değiştir`}>
                    {(p) => (
                      <Select
                        {...p}
                        value={secili}
                        onChange={(e) => setTasi({ ...tasi, [h.id]: e.target.value })}
                      >
                        {secenekler(hedefler)}
                      </Select>
                    )}
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      tur="sade"
                      olcu="sm"
                      disabled={calisiyor || secili === h.sinif_id}
                      onClick={() =>
                        void cagir(
                          'deneme_sinifi_degistir',
                          { p_id: h.id, p_sinif: secili },
                          'Sınıfı değişti.',
                        )
                      }
                    >
                      Sınıfı kaydet
                    </Button>
                    <Button
                      tur="sade"
                      olcu="sm"
                      disabled={calisiyor}
                      onClick={() => setOnay({ tur: 'sifirla', h })}
                    >
                      Denemeyi sıfırla
                    </Button>
                    <Button
                      tur="tehlike"
                      olcu="sm"
                      disabled={calisiyor}
                      onClick={() => setOnay({ tur: 'sil', h })}
                    >
                      Sil
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>

          {bosSiniflar.length > 0 && (
            <div className={hesaplar.length > 0 ? 'mt-4 border-t border-line pt-3' : ''}>
              <Button olcu="sm" yukleniyor={calisiyor} onClick={() => void duzeylereOlustur()}>
                {hesaplar.length === 0 ? 'Her düzeye oluştur' : 'Kalan düzeylere oluştur'} (
                {ilkSubeler.map((s) => s.seviye).join(', ')})
              </Button>
              <p className="mb-3 mt-1 text-[13px] text-muted">
                Her düzeyin ilk şubesinde açılır: {ilkSubeler.map((s) => s.ad).join(', ')}. Şubeyi
                sonra değiştirebilirsiniz.
              </p>
              <Field etiket="Ya da tek bir şubede oluşturun">
                {(p) => (
                  <Select
                    {...p}
                    value={yeniSinif || bosSiniflar[0]?.id}
                    onChange={(e) => setYeniSinif(e.target.value)}
                  >
                    {secenekler(bosSiniflar)}
                  </Select>
                )}
              </Field>
              <Button
                tur="sade"
                olcu="sm"
                disabled={calisiyor}
                onClick={() =>
                  void cagir(
                    'deneme_hesabi_olustur',
                    { p_sinif: yeniSinif || bosSiniflar[0]?.id },
                    'Deneme hesabı oluşturuldu.',
                  )
                }
              >
                Bu şubede oluştur
              </Button>
            </div>
          )}

          {hesaplar.length > 0 && (
            <p className="mt-3 text-[13px] text-muted">
              Tek tıkla geçersiniz; üstteki “Öğretmen hesabına dön” sizi buraya getirir. Başka bir
              cihazda öğrenci koduyla ya da veli koduyla da girebilirsiniz. Veli ilk girişte onam
              metnini onaylar; gerçek veli gibi. Süresi geçmiş bir ödeve gönderdiğinizde gönderim
              gerçek kayıt gibi “geç gönderildi” görünür.
            </p>
          )}
        </>
      )}

      <Dialog
        acik={onay !== null}
        onKapat={() => setOnay(null)}
        baslik={
          onay?.tur === 'sil'
            ? `${onay.h.sinif} deneme hesabı silinecek`
            : `${onay?.h.sinif ?? ''} denemesi sıfırlanacak`
        }
        aciklama={
          onay?.tur === 'sil'
            ? 'Bu deneme öğrenci, velisi ve bütün gönderimleri silinir. Öbür deneme hesapları durur. Gerçek öğrencilere dokunulmaz.'
            : 'Bu hesabın gönderimleri, mesajları ve onamı silinir; kodlar ve sınıf aynı kalır. Öbür deneme hesapları durur. Gerçek öğrencilere dokunulmaz.'
        }
        onayEtiketi={onay?.tur === 'sil' ? 'Sil' : 'Sıfırla'}
        onOnay={() => {
          if (!onay) return;
          void (onay.tur === 'sil'
            ? cagir('deneme_hesabi_sil', { p_id: onay.h.id }, 'Deneme hesabı silindi.')
            : cagir('deneme_sifirla', { p_id: onay.h.id }, 'Deneme sıfırlandı.'));
        }}
        onayYukleniyor={calisiyor}
      />
    </Card>
  );
}
