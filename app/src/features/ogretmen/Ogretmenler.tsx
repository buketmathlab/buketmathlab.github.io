import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { sahipJetonunuSakla } from '@/lib/vekalet';
import { rpc } from '@/services/supabase';
import type { OgretmenSatiri, Sinif } from '@/types/api';

/**
 * ÖĞRETMENLER — yalnız platform sahibinin gördüğü ekran.
 *
 * Öğretmenin kuralı: "Tüm yetki bende olmalı… istediğim zaman diğer
 * öğretmenlerin sistemine giriş yapabilmeliyim… istediğim öğretmeni
 * sistemden çıkarabilmeliyim."
 *
 * ÇIKARMA = PASİFLEŞTİRME, silme değil. Girişi kapanır, açık oturumu
 * anında düşer; ama ödevleri ve öğrencilerinin NOTLARI durur. Silseydik o
 * öğretmenden not almış çocukların karnesi de giderdi.
 *
 * VEKÂLET, o kişi olmak değil. Sunucu, vekâletteyken onun adına mesaj
 * göndermeyi reddediyor ve denetim izine "Sahip → Hedef" yazıyor. Bu ekran
 * o sınırı düğmenin yanında yazıyor — sonradan öğrenilen bir yetki,
 * baştan bilinenden çok daha rahatsız edici olur.
 */
export function Ogretmenler() {
  const { oturum, girisYap } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [ekleAcik, setEkleAcik] = useState(false);
  const [ad, setAd] = useState('');
  const [pin, setPin] = useState('');
  const [formHatasi, setFormHatasi] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);

  const [pinAcik, setPinAcik] = useState<OgretmenSatiri | null>(null);
  const [yeniPin, setYeniPin] = useState('');

  const [cikarAcik, setCikarAcik] = useState<OgretmenSatiri | null>(null);
  const [vekaletAcik, setVekaletAcik] = useState<OgretmenSatiri | null>(null);

  const [sinifAcik, setSinifAcik] = useState<OgretmenSatiri | null>(null);
  const [secili, setSecili] = useState<string[]>([]);

  const { veri, durum, hata, yenile } = useVeri<OgretmenSatiri[]>(
    'ogretmenler_listesi',
    { p_token: oturum?.token },
    (v) => v.length === 0,
  );

  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  async function ekle() {
    if (!ad.trim()) {
      setFormHatasi('Öğretmenin adını yazın.');
      return;
    }
    if (pin.length < 6) {
      setFormHatasi('PIN en az 6 haneli olmalı.');
      return;
    }
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      await rpc('ogretmen_ekle', { p_token: oturum?.token, p_ad: ad.trim(), p_pin: pin });
      bildir(`${ad.trim()} eklendi. PIN'i kendisine iletin.`, 'basari');
      setEkleAcik(false);
      setAd('');
      setPin('');
      yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Öğretmen eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function pinSifirla() {
    if (!pinAcik) return;
    if (yeniPin.length < 6) {
      setFormHatasi('PIN en az 6 haneli olmalı.');
      return;
    }
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      await rpc('ogretmen_pin_sifirla', {
        p_token: oturum?.token,
        p_id: pinAcik.id,
        p_yeni: yeniPin,
      });
      bildir(`${pinAcik.ad} için yeni PIN belirlendi. Bütün cihazlarından çıkış yapıldı.`, 'basari');
      setPinAcik(null);
      setYeniPin('');
      yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'PIN sıfırlanamadı.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function aktifDegistir(o: OgretmenSatiri, aktif: boolean) {
    setKaydediyor(true);
    try {
      await rpc('ogretmen_guncelle', { p_token: oturum?.token, p_id: o.id, p_aktif: aktif });
      bildir(
        aktif ? `${o.ad} yeniden sisteme alındı.` : `${o.ad} sistemden çıkarıldı. Verisi duruyor.`,
        'basari',
      );
      setCikarAcik(null);
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  async function sinifKaydet() {
    if (!sinifAcik) return;
    setKaydediyor(true);
    try {
      const s = await rpc<{ sinif_sayisi: number }>('ogretmen_sinif_ata', {
        p_token: oturum?.token,
        p_id: sinifAcik.id,
        p_sinif_idler: secili,
      });
      bildir(`${sinifAcik.ad}: ${s.sinif_sayisi} sınıf atandı.`, 'basari');
      setSinifAcik(null);
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Sınıf atanamadı.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  async function vekaleteGir() {
    if (!vekaletAcik || !oturum?.token) return;
    setKaydediyor(true);
    try {
      const v = await rpc<{ token: string }>('ogretmen_olarak_gir', {
        p_token: oturum.token,
        p_ogretmen_id: vekaletAcik.id,
      });
      // Kendi jetonumuzu saklıyoruz ki "Kendi hesabıma dön" çalışsın.
      sahipJetonunuSakla(oturum.token);
      girisYap({ rol: 'ogretmen', token: v.token });
      setVekaletAcik(null);
      git('/ogretmen', { replace: true });
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Hesaba geçilemedi.', 'hata');
      setKaydediyor(false);
    }
  }

  return (
    <>
      <SayfaBasligi
        baslik="Öğretmenler"
        aciklama="Platformu kimlerin kullandığı, kimin hangi sınıfa girdiği ve erişim yönetimi."
        eylem={<Button onClick={() => setEkleAcik(true)}>Öğretmen ekle</Button>}
      />

      <AsyncBoundary
        durum={durum}
        tekrarDene={yenile}
        {...(hata ? { hataAciklama: hata } : {})}
        bosBaslik="Henüz başka öğretmen yok"
        bosAciklama="Bir meslektaşınızı eklediğinizde kendi PIN'iyle girer ve yalnız kendi sınıflarını görür."
      >
        <div className="flex flex-col gap-3">
          {(veri ?? []).map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
                    {o.ad}
                    {o.sahip && <Tag tur="bilgi">Platform sahibi</Tag>}
                    {!o.aktif && <Tag tur="tehlike">Sistemden çıkarıldı</Tag>}
                    {!o.pin_var && <Tag tur="uyari">PIN belirlenmemiş</Tag>}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    <span className="sk-sayi">{o.sinif_sayisi}</span> sınıf ·{' '}
                    <span className="sk-sayi">{o.odev_sayisi}</span> ödev
                    {o.son_gorulme
                      ? ` · son giriş ${new Date(o.son_gorulme).toLocaleDateString('tr-TR')}`
                      : ' · hiç giriş yapmadı'}
                  </p>
                </div>

                {/* SAHİBİN KENDİ SATIRINDA EYLEM YOK: kendi hesabına vekâlet
                    edemez, kendini çıkaramaz. Sunucu da reddediyor; ekran
                    reddedilecek bir düğmeyi hiç göstermiyor. */}
                {!o.sahip && (
                  <div className="flex flex-wrap gap-2">
                    <Button tur="sade" olcu="sm" onClick={() => setSinifAcik(o)}>
                      Sınıfları
                    </Button>
                    <Button tur="sade" olcu="sm" onClick={() => setPinAcik(o)}>
                      PIN sıfırla
                    </Button>
                    {o.aktif ? (
                      <>
                        <Button tur="sade" olcu="sm" onClick={() => setVekaletAcik(o)}>
                          Bu öğretmen olarak gir
                        </Button>
                        <Button tur="tehlike" olcu="sm" onClick={() => setCikarAcik(o)}>
                          Çıkar
                        </Button>
                      </>
                    ) : (
                      <Button tur="sade" olcu="sm" onClick={() => void aktifDegistir(o, true)}>
                        Geri al
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </AsyncBoundary>

      {/* --- Öğretmen ekle --- */}
      <Dialog acik={ekleAcik} onKapat={() => setEkleAcik(false)} baslik="Öğretmen ekle">
        <div className="flex flex-col gap-3">
          <Field etiket="Ad soyad">
            {(k) => <Input {...k} value={ad} onChange={(e) => setAd(e.target.value)} autoComplete="off" />}
          </Field>
          <Field
            etiket="Başlangıç PIN'i"
            ipucu="En az 6 hane. Bu PIN'i kendisine siz ileteceksiniz; girdikten sonra Ayarlar'dan değiştirebilir."
          >
            {/* autoCapitalize YOK — iPad'de harfleri büyütüp PIN'i bozuyordu
                (giriş kutusunda bir kez yaşandı, regresyon testi var). */}
            {(k) => (
              <Input
                {...k}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          {formHatasi && <p className="text-[14px] text-danger">{formHatasi}</p>}
          <div className="flex justify-end gap-2">
            <Button tur="sade" onClick={() => setEkleAcik(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => void ekle()} yukleniyor={kaydediyor}>
              Ekle
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- PIN sıfırla --- */}
      <Dialog acik={!!pinAcik} onKapat={() => setPinAcik(null)} baslik="PIN sıfırla">
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-muted">
            {pinAcik?.ad} için yeni bir PIN belirleyeceksiniz. Bütün cihazlarındaki oturumu
            kapanacak ve yeni PIN'i ona iletmeniz gerekecek.
          </p>
          <Field etiket="Yeni PIN">
            {(k) => (
              <Input
                {...k}
                type="password"
                value={yeniPin}
                onChange={(e) => setYeniPin(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          {formHatasi && <p className="text-[14px] text-danger">{formHatasi}</p>}
          <div className="flex justify-end gap-2">
            <Button tur="sade" onClick={() => setPinAcik(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => void pinSifirla()} yukleniyor={kaydediyor}>
              Sıfırla
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- Sistemden çıkar --- */}
      <Dialog acik={!!cikarAcik} onKapat={() => setCikarAcik(null)} baslik="Sistemden çıkar">
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-ink">
            <span className="font-semibold">{cikarAcik?.ad}</span> bir daha giriş yapamayacak ve
            açık oturumu hemen kapanacak.
          </p>
          <p className="text-[14px] text-muted">
            Ödevleri ve öğrencilerinin notları <span className="font-semibold">silinmiyor</span> —
            siz görmeye devam edersiniz. İstediğiniz zaman geri alabilirsiniz.
          </p>
          <div className="flex justify-end gap-2">
            <Button tur="sade" onClick={() => setCikarAcik(null)}>
              Vazgeç
            </Button>
            <Button
              tur="tehlike"
              onClick={() => cikarAcik && void aktifDegistir(cikarAcik, false)}
              yukleniyor={kaydediyor}
            >
              Çıkar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- Vekâlet --- */}
      <Dialog
        acik={!!vekaletAcik}
        onKapat={() => setVekaletAcik(null)}
        baslik="Bu öğretmen olarak gir"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-ink">
            <span className="font-semibold">{vekaletAcik?.ad}</span> hesabına geçeceksiniz. Onun
            sınıflarını, ödevlerini ve notlarını görür ve düzeltebilirsiniz.
          </p>
          <p className="text-[14px] text-muted">
            Veli ve öğrenci yazışmalarını <span className="font-semibold">okuyabilirsiniz</span>,
            ama onun adına <span className="font-semibold">mesaj gönderemezsiniz</span>. Yaptığınız
            her işlem denetim izine sizin adınızla birlikte yazılır.
          </p>
          <div className="flex justify-end gap-2">
            <Button tur="sade" onClick={() => setVekaletAcik(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => void vekaleteGir()} yukleniyor={kaydediyor}>
              Hesabına geç
            </Button>
          </div>
        </div>
      </Dialog>

      {/* --- Sınıf atama --- */}
      <Dialog acik={!!sinifAcik} onKapat={() => setSinifAcik(null)} baslik="Sınıfları">
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-muted">
            {sinifAcik?.ad} hangi sınıflara giriyor? İşaretlenmeyen sınıflar listesinden düşer.
          </p>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {(siniflar.veri ?? [])
              .filter((s) => !s.ozel)
              .map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-[44px] items-center gap-3 rounded-sk-sm px-2 hover:bg-line-soft"
                >
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={secili.includes(s.id)}
                    onChange={(e) =>
                      setSecili((o) =>
                        e.target.checked ? [...o, s.id] : o.filter((x) => x !== s.id),
                      )
                    }
                  />
                  <span className="text-[15px] text-ink">{s.ad}</span>
                </label>
              ))}
          </div>
          {/* ÖZEL DERS GRUBU LİSTEDE YOK: özel ders tamamen sahipte
              (öğretmenin kuralı) ve sunucu atamayı zaten reddediyor. */}
          <p className="text-[13px] text-muted">
            Özel ders grubu listede yok — özel ders yalnız sizde.
          </p>
          <div className="flex justify-end gap-2">
            <Button tur="sade" onClick={() => setSinifAcik(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => void sinifKaydet()} yukleniyor={kaydediyor}>
              Kaydet
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
