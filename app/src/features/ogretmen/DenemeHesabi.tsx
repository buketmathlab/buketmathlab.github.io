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

export type DenemeHesabiDurumu =
  | { var: false }
  | {
      var: true;
      id: string;
      sinif_id: string;
      sinif: string;
      ogrenci_kodu: string | null;
      veli_kodu: string | null;
    };

/**
 * DENEME HESABI (0073) — yalnız platform sahibinde.
 *
 * Öğretmenin isteği: "Bir tane deneme yapmak için gerçek olmayan bir
 * öğrenci için öğrenci hesabı ve aynı şekilde veli hesabı olsun. Gerçek
 * öğrenci ve velilerin tüm özellikleri birebir olsun. Gerekirse ödev de
 * gönderebileyim."
 *
 * Deneme öğrenci seçilen GERÇEK sınıfta duruyor: o sınıfın ödevlerini
 * görüyor, gönderiyor, puan alıyor. Hiçbir sayıya karışmıyor ve
 * listelerde yalnız sahip görüyor; ikisi de sunucuda (`ogrenciler.deneme`).
 *
 * "Denemeyi sıfırla" hesabı silip AYNI kodlarla yeniden kuruyor: depodaki
 * eski çözüm fotoğrafı yeni gönderime karışmasın diye (gerekçe 0073'te).
 *
 * TEK TIKLA GİRİŞ. Kart, öğretmen ve müdür hesaplarının yanında
 * (Öğretmenler sayfası) duruyor. "Öğrenci olarak gir" / "Veli olarak gir",
 * gerçek bir girişin aynısı: `giris` ucu deneme koduyla çağrılıyor; sahibin
 * jetonu dönüş için saklanıyor ve öğrenci/veli ekranında kapatılamayan
 * `DenemeSeridi` çıkıyor.
 */
export function DenemeHesabi() {
  const { oturum, girisYap } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();
  const durum = useVeri<DenemeHesabiDurumu>('deneme_hesabi', { p_token: oturum?.token });
  const siniflar = useVeri<Sinif[]>('siniflar_listesi', { p_token: oturum?.token, p_arsiv: false });
  const [secili, setSecili] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [onay, setOnay] = useState<'sifirla' | 'sil' | null>(null);

  // 0073 panelde çalıştırılmadıysa uç yok: kart bozulmasın, ne yapılacağını söylesin.
  const ucYok = durum.hata !== null && /could not find the function|schema cache/i.test(durum.hata);
  // `Array.isArray`: beklenmeyen bir yanıt (eski panel, taklit) kartı
  // düşürmesin — sayfanın tamamı beyaz kalırdı.
  const okulSiniflari = (Array.isArray(siniflar.veri) ? siniflar.veri : []).filter(
    (s) => !s.ozel && !s.arsiv,
  );
  const d = durum.veri && typeof durum.veri === 'object' && 'var' in durum.veri ? durum.veri : null;

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

  const sinifSecimi = (etiket: string, varsayilan: string) => (
    <Field etiket={etiket}>
      {(p) => (
        <Select {...p} value={secili || varsayilan} onChange={(e) => setSecili(e.target.value)}>
          {okulSiniflari.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ad}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <Card>
      <h2 className="mb-1 text-[18px] text-ink">Deneme hesabı</h2>
      <p className="mb-3 text-[14px] text-muted">
        Gerçek olmayan bir öğrenci ve velisiyle sistemi öğrencinin ve velinin gözünden birebir
        deneyin: ödevleri görün, gönderin, puanı ve veli ekranını inceleyin. Deneme öğrenci hiçbir
        ortalamaya ve sayıya karışmaz; listelerde yalnız siz görürsünüz.
      </p>

      {ucYok ? (
        <p className="text-[14px] text-ink">
          Bu bölüm, SQL 0073 Supabase panelinde çalıştırıldıktan sonra kullanılabilir.
        </p>
      ) : !d ? (
        <p className="text-[14px] text-muted">Yükleniyor…</p>
      ) : !d.var ? (
        <>
          {sinifSecimi('Deneme öğrencinin sınıfı', okulSiniflari[0]?.id ?? '')}
          <Button
            olcu="sm"
            yukleniyor={calisiyor}
            disabled={okulSiniflari.length === 0}
            onClick={() =>
              void cagir(
                'deneme_hesabi_olustur',
                { p_sinif: secili || okulSiniflari[0]?.id },
                'Deneme hesabı oluşturuldu.',
              )
            }
          >
            Deneme hesabı oluştur
          </Button>
        </>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
            <dt className="text-muted">Sınıfı</dt>
            <dd className="font-semibold text-ink">{d.sinif}</dd>
            <dt className="text-muted">Öğrenci kodu</dt>
            <dd className="sk-sayi font-semibold tracking-wider text-ink">
              {d.ogrenci_kodu ?? '—'}
            </dd>
            <dt className="text-muted">Veli kodu</dt>
            <dd className="sk-sayi font-semibold tracking-wider text-ink">{d.veli_kodu ?? '—'}</dd>
          </dl>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              olcu="sm"
              disabled={calisiyor || !d.ogrenci_kodu}
              onClick={() => d.ogrenci_kodu && void olarakGir(d.ogrenci_kodu)}
            >
              Öğrenci olarak gir
            </Button>
            <Button
              olcu="sm"
              disabled={calisiyor || !d.veli_kodu}
              onClick={() => d.veli_kodu && void olarakGir(d.veli_kodu)}
            >
              Veli olarak gir
            </Button>
          </div>
          <p className="mb-3 text-[13px] text-muted">
            Tek tıkla geçersiniz; üstteki “Öğretmen hesabına dön” sizi buraya getirir. Başka bir
            cihazda öğrenci koduyla ya da veli koduyla da girebilirsiniz. Veli ilk girişte onam
            metnini onaylar; gerçek veli gibi.
          </p>
          {sinifSecimi('Sınıfını değiştir', d.sinif_id)}
          <div className="flex flex-wrap gap-2">
            <Button
              tur="sade"
              olcu="sm"
              disabled={calisiyor || !secili || secili === d.sinif_id}
              onClick={() =>
                void cagir('deneme_sinifi_degistir', { p_sinif: secili }, 'Sınıfı değişti.')
              }
            >
              Sınıfı kaydet
            </Button>
            <Button tur="sade" olcu="sm" disabled={calisiyor} onClick={() => setOnay('sifirla')}>
              Denemeyi sıfırla
            </Button>
            <Button tur="tehlike" olcu="sm" disabled={calisiyor} onClick={() => setOnay('sil')}>
              Deneme hesabını sil
            </Button>
          </div>
        </>
      )}

      <Dialog
        acik={onay !== null}
        onKapat={() => setOnay(null)}
        baslik={onay === 'sil' ? 'Deneme hesabı silinecek' : 'Deneme sıfırlanacak'}
        aciklama={
          onay === 'sil'
            ? 'Deneme öğrenci, velisi ve bütün deneme gönderimleri silinir. Gerçek öğrencilere dokunulmaz.'
            : 'Deneme gönderimleri, mesajları ve onamı silinir; kodlar ve sınıf aynı kalır. Gerçek öğrencilere dokunulmaz.'
        }
        onayEtiketi={onay === 'sil' ? 'Sil' : 'Sıfırla'}
        onOnay={() =>
          void (onay === 'sil'
            ? cagir('deneme_hesabi_sil', {}, 'Deneme hesabı silindi.')
            : cagir('deneme_sifirla', {}, 'Deneme sıfırlandı.'))
        }
        onayYukleniyor={calisiyor}
      />
    </Card>
  );
}
