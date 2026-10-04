import { useMemo, useState } from 'react';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { Field, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useBenKimim } from '@/hooks/useBenKimim';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import {
  DUYURU_SINIRI,
  SAYFA_ACIKLAMASI,
  aliciOzeti,
  duyuruMetni,
  duyuruZamani,
  formHatasi,
  gorenMetni,
  onaySorusu,
} from '@/lib/duyuru-metni';
import { rpc } from '@/services/supabase';
import type { OgretmenDuyurusu, SinifKarti } from '@/types/api';

/**
 * DUYURULAR — öğretmenden şubelere TEK YÖNLÜ (0065).
 *
 * Öğretmenin isteği: "Acil durumlarda sadece öğretmenlerin tek taraflı
 * bildirimde bulunabileceği bir duyuru panosu oluştur. Sadece hangi sınıfa
 * duyuru yapılacaksa o sınıfın öğrencilerine o duyuru gitsin." Birden çok
 * şube birlikte seçilebiliyor; yalnız öğrenciler görüyor.
 *
 * Gönderim ONAYLA gidiyor: duyuru geri çağrılabilir (Kaldır) ama okunmuş
 * olabilir. Onay penceresi kime gittiğini ve kaç öğrenci olduğunu söylüyor.
 *
 * Altta gönderilenler ve şube başına kaç öğrencinin gördüğü — acil
 * durumda "kime ulaştı?" sorusunun cevabı.
 */
export function Duyurular() {
  const { oturum } = useOturum();
  const { ben } = useBenKimim();
  const { bildir } = useToast();
  const token = oturum?.token;

  const siniflar = useVeri<SinifKarti[]>('sinif_kartlari', { p_token: token });
  const liste = useVeri<OgretmenDuyurusu[]>(
    'ogretmen_duyurulari',
    { p_token: token },
    (v) => v.length === 0,
  );

  const [metin, setMetin] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState(false);
  const [gidiyor, setGidiyor] = useState(false);
  const [kaldirilacak, setKaldirilacak] = useState<OgretmenDuyurusu | null>(null);
  const [kaldiriliyor, setKaldiriliyor] = useState(false);

  // Arşivdeki şubeye duyuru yok; özel ders grubu yalnız sahipte (sunucuyla
  // aynı kural — burada yalnız gereksiz bir seçeneği göstermemek için).
  const subeler = useMemo(
    () => (siniflar.veri ?? []).filter((s) => !s.arsiv && (!s.ozel || ben?.sahip === true)),
    [siniflar.veri, ben?.sahip],
  );
  const seciliSubeler = subeler.filter((s) => secili.includes(s.id));
  const uzunluk = duyuruMetni(metin).length;

  function degistir(id: string, acik: boolean) {
    setSecili((e) => (acik ? [...e, id] : e.filter((x) => x !== id)));
    setHata(null);
  }

  function gonderBas() {
    const h = formHatasi(metin, seciliSubeler.length);
    setHata(h);
    if (!h) setOnay(true);
  }

  async function gonder() {
    setGidiyor(true);
    try {
      await rpc('duyuru_yayinla', {
        p_token: token,
        p_metin: duyuruMetni(metin),
        p_siniflar: seciliSubeler.map((s) => s.id),
      });
      bildir('Duyuru gönderildi', 'basari');
      setMetin('');
      setSecili([]);
      setOnay(false);
      liste.yenile();
    } catch (e) {
      setOnay(false);
      setHata(e instanceof Error ? e.message : 'Duyuru gönderilemedi.');
    } finally {
      setGidiyor(false);
    }
  }

  async function kaldir() {
    if (!kaldirilacak) return;
    setKaldiriliyor(true);
    try {
      await rpc('duyuru_kaldir', { p_token: token, p_id: kaldirilacak.id });
      bildir('Duyuru kaldırıldı', 'basari');
      liste.yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Duyuru kaldırılamadı.', 'hata');
    } finally {
      setKaldiriliyor(false);
      setKaldirilacak(null);
    }
  }

  return (
    <>
      <SayfaBasligi baslik="Duyurular" aciklama={SAYFA_ACIKLAMASI} />

      <Card>
        <h2 className="mb-3 text-[18px] text-ink">Yeni duyuru</h2>
        <Field etiket="Duyuru" zorunlu ipucu={`${uzunluk}/${DUYURU_SINIRI} karakter`}>
          {(k) => (
            <Textarea
              {...k}
              rows={5}
              value={metin}
              maxLength={DUYURU_SINIRI + 50}
              onChange={(e) => {
                setMetin(e.target.value);
                setHata(null);
              }}
            />
          )}
        </Field>

        <fieldset className="mb-4">
          <legend className="mb-1 text-[13px] font-bold text-muted">Şubeler</legend>
          <AsyncBoundary
            durum={siniflar.durum === 'hazir' && subeler.length === 0 ? 'bos' : siniflar.durum}
            bosBaslik="Duyuru yapabileceğiniz şube yok"
            {...(siniflar.hata ? { hataAciklama: siniflar.hata } : {})}
            tekrarDene={siniflar.yenile}
            yuklemeAdedi={1}
          >
            <div className="flex flex-wrap gap-2">
              {subeler.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-[44px] items-center gap-2 rounded-sk-sm border border-line px-3 text-[15px] text-ink has-[:checked]:border-ink has-[:checked]:bg-paper"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-ink"
                    checked={secili.includes(s.id)}
                    onChange={(e) => degistir(s.id, e.target.checked)}
                  />
                  <span>{s.ad}</span>
                  <span className="sk-sayi text-[13px] text-muted">({s.ogrenci_sayisi})</span>
                </label>
              ))}
            </div>
            {subeler.length > 1 && (
              <button
                type="button"
                className="mt-2 inline-flex min-h-[44px] items-center text-[14px] font-bold text-link underline"
                onClick={() => {
                  setSecili(secili.length === subeler.length ? [] : subeler.map((s) => s.id));
                  setHata(null);
                }}
              >
                {secili.length === subeler.length ? 'Seçimi kaldır' : 'Tümünü seç'}
              </button>
            )}
          </AsyncBoundary>
        </fieldset>

        {hata && (
          <p role="alert" className="mb-3 text-[14px] font-semibold text-danger">
            {hata}
          </p>
        )}
        <Button onClick={gonderBas} tamGenislik>
          Duyuruyu gönder
        </Button>
      </Card>

      <h2 className="mb-2 mt-8 text-[18px] text-ink">Gönderdiğiniz duyurular</h2>
      <p className="mb-3 text-[13px] text-muted">
        Son 30 gün. Öğrenci, Pano sayfasını açtığında duyuruyu görmüş sayılır.
      </p>
      <AsyncBoundary
        durum={liste.durum}
        bosBaslik="Henüz duyuru yok"
        {...(liste.hata ? { hataAciklama: liste.hata } : {})}
        tekrarDene={liste.yenile}
      >
        <ul className="flex flex-col gap-3 [&>li]:min-w-0">
          {(liste.veri ?? []).map((d) => (
            <li key={d.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[13px] text-muted">{duyuruZamani(d.zaman)}</p>
                  <Button tur="sade" olcu="sm" onClick={() => setKaldirilacak(d)}>
                    Kaldır
                  </Button>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">
                  {d.metin}
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                  {d.siniflar.map((s) => (
                    <li key={s.id} className="sk-sayi">
                      {gorenMetni(s.ad, s.goren, s.mevcut)}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      </AsyncBoundary>

      <Dialog
        acik={onay}
        onKapat={() => setOnay(false)}
        baslik="Duyuru gönderilsin mi?"
        aciklama={onaySorusu(aliciOzeti(seciliSubeler))}
        onayEtiketi="Gönder"
        onOnay={() => void gonder()}
        onayYukleniyor={gidiyor}
      />
      <Dialog
        acik={kaldirilacak !== null}
        onKapat={() => setKaldirilacak(null)}
        baslik="Duyuru kaldırılsın mı?"
        aciklama="Duyuru öğrencilerin ekranından hemen kalkar. Görmüş olanlar görmüş olarak kalır."
        onayEtiketi="Kaldır"
        onayTuru="tehlike"
        onOnay={() => void kaldir()}
        onayYukleniyor={kaldiriliyor}
      />
    </>
  );
}
