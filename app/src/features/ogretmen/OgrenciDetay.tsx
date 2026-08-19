import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { KonuKarnesiBolumu } from '@/features/ogretmen/KonuKarnesiBolumu';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { OzelDersDetayi } from '@/types/api';

const ZAMAN = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const TARIH = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const PARA = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

/**
 * Öğrenci detayı — özel ders öğrencisinde ders programı ve ödeme takibi.
 *
 * NEDEN VAR: beş yazma ucu (`ders_ekle/sil`, `odeme_ekle/degistir/sil`)
 * 0004'ten beri hazırdı ama ÜÇÜ `p_id` istiyor ve öğretmenin o id'yi
 * öğrenebileceği hiçbir uç yoktu. `ozel_ders_detay` (0021) o boşluğu
 * kapatıyor; bu ekran da onu kullanan taraf.
 *
 * ÖĞRETMENİN KURALI — ÖĞRENCİ PARAYI GÖRMEZ. Bu ekran yalnız öğretmenin.
 * Öğrencinin ucu ödemeyle ilgili hiçbir alan taşımıyor ve veli kendi
 * ödemelerini kendi ucundan görüyor. Sınır sunucuda (Part XXI).
 *
 * DERS VE ÖDEME BÖLÜMLERİ YALNIZ `tur = 'ozel'` ÖĞRENCİDE ÇIKIYOR. Okul
 * öğrencisinde bu kavramlar yok; boş bir bölüm göstermek, veli panelinde
 * bugüne kadar olan hatanın (hiç dolmayan ödeme listesi) aynısı olurdu.
 */
export function OgrenciDetay() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<OzelDersDetayi>('ozel_ders_detay', {
    p_token: oturum?.token,
    p_ogrenci_id: id,
  });

  const [dersAcik, setDersAcik] = useState(false);
  const [odemeAcik, setOdemeAcik] = useState(false);
  const [silinecek, setSilinecek] = useState<
    { tur: 'ders' | 'odeme'; id: string; ad: string } | null
  >(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);

  const [dersZaman, setDersZaman] = useState('');
  const [dersMod, setDersMod] = useState<'yuzyuze' | 'online'>('yuzyuze');
  const [dersLink, setDersLink] = useState('');
  const [tutar, setTutar] = useState('');
  const [odemeTarih, setOdemeTarih] = useState(() => new Date().toISOString().slice(0, 10));

  async function dersEkle() {
    if (!dersZaman) return setFormHatasi('Ders zamanını seçin.');
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      await rpc('ders_ekle', {
        p_token: oturum?.token,
        p_ogrenci: id,
        p_zaman: new Date(dersZaman).toISOString(),
        p_mod: dersMod,
        p_link: dersMod === 'online' ? dersLink.trim() || null : null,
      });
      setDersAcik(false);
      setDersZaman('');
      setDersLink('');
      bildir('Ders eklendi', 'basari');
      yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Ders eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function odemeEkle() {
    // Virgülle yazılan tutar (1500,50) Türkiye'de doğal olan yazım; nokta
    // beklemek öğretmeni tuşa göre düşünmeye zorlardı.
    const t = Number(tutar.replace(',', '.'));
    if (!Number.isFinite(t) || t < 0) return setFormHatasi('Geçerli bir tutar yazın.');
    if (!odemeTarih) return setFormHatasi('Tarih seçin.');
    setFormHatasi(null);
    setKaydediyor(true);
    try {
      await rpc('odeme_ekle', {
        p_token: oturum?.token,
        p_ogrenci: id,
        p_tutar: t,
        p_tarih: odemeTarih,
      });
      setOdemeAcik(false);
      setTutar('');
      bildir('Ödeme eklendi', 'basari');
      yenile();
    } catch (e) {
      setFormHatasi(e instanceof Error ? e.message : 'Ödeme eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  async function odendiCevir(odemeId: string) {
    try {
      await rpc('odeme_degistir', { p_token: oturum?.token, p_id: odemeId });
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Değiştirilemedi.', 'hata');
    }
  }

  async function silmeyiOnayla() {
    if (!silinecek) return;
    setKaydediyor(true);
    try {
      await rpc(silinecek.tur === 'ders' ? 'ders_sil' : 'odeme_sil', {
        p_token: oturum?.token,
        p_id: silinecek.id,
      });
      setSilinecek(null);
      bildir(silinecek.tur === 'ders' ? 'Ders silindi' : 'Ödeme silindi', 'basari');
      yenile();
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Silinemedi.', 'hata');
    } finally {
      setKaydediyor(false);
    }
  }

  const ozelMi = veri?.ogrenci.tur === 'ozel';

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git(-1)}>
          ← Geri
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Öğrenci bulunamadı"
        bosAciklama="Bu öğrenci silinmiş olabilir."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-5">
              <h1 className="text-[24px] text-ink">{veri.ogrenci.ad}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {/* TEK ETİKET. Özel ders öğrencisinin sınıfı 0012'den beri
                    adı harfi harfine "Özel ders" olan gerçek bir sınıf ve o
                    migration `tur='ozel'` olan herkesi oraya bağlıyor. Sınıf
                    etiketiyle özel ders etiketini birlikte çizmek, ekranda
                    yan yana iki "Özel ders" demekti — canlı uçtan ölçüldü. */}
                {ozelMi ? (
                  <Tag tur="uyari">Özel ders</Tag>
                ) : (
                  veri.ogrenci.sinif && <Tag tur="notr">{veri.ogrenci.sinif}</Tag>
                )}
                {!veri.ogrenci.aktif && <Tag tur="tehlike">Pasif</Tag>}
              </div>
            </div>

            {/* MESAJLAR (0025) — öğretmenin kararıyla ÖĞRENCİLER
                bölümünde. Ekran zaten öğrenci başına; yazışmayı buraya
                bağlamak yeni bir gezinme kademesi açmıyor.

                Yazışmanın kendisi ayrı ekranda: burada göstermek, bu
                sayfayı ders/ödeme/konu karnesi/yazışma diye dört bölümlü
                bir yığına çevirirdi ve mesaj metinlerini ekran her
                açıldığında indirmek gerekirdi. */}
            <div className="mb-6">
              <Button
                tur="ikincil"
                onClick={() => git(`/ogretmen/ogrenciler/yazisma/${id}`)}
              >
                Öğrenciyle mesajlar
              </Button>
              {/* Velinin yazışması AYRI ve Veliler sekmesinde. Öğretmen
                  hangisine yazdığını bilmeli: çocuğa yazdığı bir cümle
                  veliye, veliye yazdığı çocuğa gitmiyor. */}
              <p className="mt-2 text-[13px] text-muted">
                Bu yazışmayı yalnız öğrenci görüyor. Velinin yazışması Veliler
                bölümünde, ayrı.
              </p>
            </div>

            {!ozelMi ? (
              /* Okul öğrencisinde ders ve ödeme kavramı yok. Boş bölüm
                 göstermek yerine neden olmadığı yazılıyor. */
              <Card>
                <p className="text-[14px] text-muted">
                  Ders programı ve ödeme takibi yalnız özel ders öğrencileri için tutulur.
                </p>
              </Card>
            ) : (
              <>
                {/* ÖZET — öğretmenin asıl bakacağı sayı KALAN. Satırları
                    toplamasını istemiyoruz; para meselesinde toplama hatası
                    sessiz ve can sıkıcıdır.

                    ÜÇ SÜTUN DEĞİL, ÜÇ SATIR — ölçülerek seçildi. Üç sütunda
                    kart içi genişlik 360 px'de 69 px, 390 px'de 79 px kalıyor;
                    `₺1.500,50` metni ise 100 px istiyor. Yani en küçük
                    gerçekçi tutar bile telefonda taşıyordu (ölçülen: 2 px
                    yatay taşma). `sm` kırılımına ertelemek de yetmiyor —
                    480 px'de 109 px yer var ama bir dönemlik ücret
                    (`₺12.500,00`, 114 px) yine sığmıyor. Tek kartta içerik
                    genişliği 360 px'de 296 px; her tutar, her genişlikte
                    sığıyor. */}
                <Card className="mb-6">
                  <dl className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[14px] text-muted">Toplam</dt>
                      <dd className="sk-sayi font-display text-[18px] font-semibold text-ink">
                        {PARA.format(veri.ozet.toplam)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[14px] text-muted">Ödenen</dt>
                      <dd className="sk-sayi font-display text-[18px] font-semibold text-success">
                        {PARA.format(veri.ozet.odenen)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                      <dt className="text-[15px] font-semibold text-ink">Kalan</dt>
                      <dd
                        className={`sk-sayi font-display text-[22px] font-semibold ${
                          veri.ozet.kalan > 0 ? 'text-warning' : 'text-ink'
                        }`}
                      >
                        {PARA.format(veri.ozet.kalan)}
                      </dd>
                    </div>
                  </dl>
                </Card>

                {/* DERSLER */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[18px] text-ink">
                    Dersler{' '}
                    <span className="sk-sayi text-[14px] text-muted">
                      ({veri.ozet.gelecek_ders} yaklaşan / {veri.ozet.ders_toplam} toplam)
                    </span>
                  </h2>
                  <Button olcu="sm" onClick={() => setDersAcik(true)}>
                    Ders ekle
                  </Button>
                </div>

                {veri.dersler.length === 0 ? (
                  <Card className="mb-6">
                    <p className="text-[14px] text-muted">Henüz ders eklenmedi.</p>
                  </Card>
                ) : (
                  <div className="mb-6 space-y-2">
                    {veri.dersler.map((d) => (
                      <Card key={d.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            {/* Geçmiş ders SÖNÜK: liste zamana göre iniyor,
                                öğretmenin gözü önce yaklaşanı bulmalı. */}
                            <p
                              className={
                                d.gecti
                                  ? 'text-[15px] text-muted'
                                  : 'text-[15px] font-semibold text-ink'
                              }
                            >
                              {ZAMAN.format(new Date(d.zaman))}
                            </p>
                            <p className="text-[13px] text-muted">
                              {d.mod === 'online' ? 'Online' : 'Yüz yüze'}
                            </p>
                            {d.link && (
                              <a
                                href={d.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-[44px] items-center text-[13px] font-bold text-link underline"
                              >
                                Bağlantıyı aç
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {d.gecti ? (
                              <Tag tur="notr">Geçti</Tag>
                            ) : (
                              <Tag tur="basari">Yaklaşan</Tag>
                            )}
                            <Button
                              tur="sade"
                              olcu="sm"
                              onClick={() =>
                                setSilinecek({
                                  tur: 'ders',
                                  id: d.id,
                                  ad: ZAMAN.format(new Date(d.zaman)),
                                })
                              }
                            >
                              Sil
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* ÖDEMELER */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[18px] text-ink">Ödemeler</h2>
                  <Button olcu="sm" onClick={() => setOdemeAcik(true)}>
                    Ödeme ekle
                  </Button>
                </div>

                {veri.odemeler.length === 0 ? (
                  <Card>
                    <p className="text-[14px] text-muted">Henüz ödeme kaydı yok.</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {veri.odemeler.map((o) => (
                      <Card key={o.id} vurgu={o.odendi ? 'yok' : 'uyari'}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="sk-sayi text-[16px] font-semibold text-ink">
                              {PARA.format(o.tutar)}
                            </p>
                            <p className="text-[13px] text-muted">
                              {TARIH.format(new Date(o.tarih))}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Tek dokunuş: ödendi ↔ ödenmedi. Öğretmenin en
                                sık yapacağı işlem bu. */}
                            <Button
                              tur={o.odendi ? 'sade' : 'ikincil'}
                              olcu="sm"
                              onClick={() => odendiCevir(o.id)}
                            >
                              {o.odendi ? 'Ödendi ✓' : 'Ödendi işaretle'}
                            </Button>
                            <Button
                              tur="sade"
                              olcu="sm"
                              onClick={() =>
                                setSilinecek({
                                  tur: 'odeme',
                                  id: o.id,
                                  ad: PARA.format(o.tutar),
                                })
                              }
                            >
                              Sil
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* KONU KARNESİ (0023) — HER ÖĞRENCİDE.
                Bu ekran okul öğrencisinde bugüne kadar tek bir cümleden
                ibaretti: "ders ve ödeme yalnız özel derste tutulur". Konu
                karnesi o boşluğu dolduruyor ve ekranı her öğrenci için
                anlamlı kılıyor — "bu çocuk hangi konuda zayıf" sorusunun
                cevabı artık adının olduğu sayfada. */}
            <KonuKarnesiBolumu ogrenciId={id} />
          </>
        )}
      </AsyncBoundary>

      <Dialog
        acik={dersAcik}
        onKapat={() => setDersAcik(false)}
        baslik="Ders ekle"
        onayEtiketi="Ekle"
        onOnay={dersEkle}
        onayYukleniyor={kaydediyor}
      >
        <Field etiket="Ders zamanı" zorunlu>
          {(k) => (
            <Input
              {...k}
              type="datetime-local"
              value={dersZaman}
              onChange={(e) => setDersZaman(e.target.value)}
            />
          )}
        </Field>
        <Field etiket="Nasıl yapılacak">
          {(k) => (
            <Select
              {...k}
              value={dersMod}
              onChange={(e) => setDersMod(e.target.value as 'yuzyuze' | 'online')}
            >
              <option value="yuzyuze">Yüz yüze</option>
              <option value="online">Online</option>
            </Select>
          )}
        </Field>
        {dersMod === 'online' && (
          <Field
            etiket="Bağlantı"
            ipucu="Öğrenci bu bağlantıyı ödev ekranında görür."
            {...(formHatasi ? { hata: formHatasi } : {})}
          >
            {(k) => (
              <Input
                {...k}
                type="url"
                placeholder="https://…"
                value={dersLink}
                onChange={(e) => setDersLink(e.target.value)}
              />
            )}
          </Field>
        )}
        {dersMod !== 'online' && formHatasi && (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {formHatasi}
          </p>
        )}
      </Dialog>

      <Dialog
        acik={odemeAcik}
        onKapat={() => setOdemeAcik(false)}
        baslik="Ödeme ekle"
        onayEtiketi="Ekle"
        onOnay={odemeEkle}
        onayYukleniyor={kaydediyor}
      >
        <Field etiket="Tutar" zorunlu ipucu="Örn. 1500 ya da 1500,50">
          {(k) => (
            <Input
              {...k}
              inputMode="decimal"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
            />
          )}
        </Field>
        <Field etiket="Tarih" zorunlu {...(formHatasi ? { hata: formHatasi } : {})}>
          {(k) => (
            <Input
              {...k}
              type="date"
              value={odemeTarih}
              onChange={(e) => setOdemeTarih(e.target.value)}
            />
          )}
        </Field>
        <p className="text-[13px] text-muted">
          Yeni kayıt <strong>ödenmedi</strong> olarak eklenir; tahsil edince işaretlersiniz.
        </p>
      </Dialog>

      {/* SİLME ONAY İSTER. Ödeme kaydı silmek para geçmişini siler ve geri
          alınamaz; ders silmek de öğrencinin ekranından o dersi kaldırır. */}
      <Dialog
        acik={silinecek !== null}
        onKapat={() => setSilinecek(null)}
        baslik={silinecek?.tur === 'ders' ? 'Dersi sil' : 'Ödemeyi sil'}
        onayEtiketi="Sil"
        onayTuru="tehlike"
        onOnay={silmeyiOnayla}
        onayYukleniyor={kaydediyor}
      >
        <p className="text-[14px] text-ink">
          <strong>{silinecek?.ad}</strong> kaydı silinecek. Bu işlem geri alınamaz.
        </p>
      </Dialog>
    </>
  );
}
