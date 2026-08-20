import { useState } from 'react';
import { Sekiz8Mark } from '@/components/brand/Sekiz8Mark';
import { SekizWordmark } from '@/components/brand/SekizWordmark';
import { SchoolCrest } from '@/components/brand/SchoolCrest';
import { StarEight } from '@/components/brand/StarEight';
import { GeometricDivider } from '@/components/brand/GeometricDivider';
import { EwaluFigure } from '@/components/brand/EwaluFigure';
import { EWALU_POZLARI, type EwaluPoz } from '@/components/brand/ewalu';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/toast-baglam';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Durumlar';
import { RENKLER, KONTRAST_CIFTLERI, type RenkAdi } from '@/lib/tokens';
import { kontrastOrani } from '@/lib/kontrast';
import { useHareketAzalt } from '@/hooks/useHareketAzalt';

function Bolum({
  no,
  baslik,
  aciklama,
  children,
}: {
  no: string;
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4">
        <p className="text-[12px] font-bold tracking-[0.18em] text-amber sk-sayi">{no}</p>
        <h2 className="mt-1 text-[22px] text-ink">{baslik}</h2>
        {aciklama && <p className="mt-1 max-w-2xl text-[14px] text-muted">{aciklama}</p>}
      </div>
      {children}
    </section>
  );
}

function RenkKutusu({ ad }: { ad: RenkAdi }) {
  const deger = RENKLER[ad];
  const acikMi = kontrastOrani(deger, '#000000') > kontrastOrani(deger, '#ffffff');
  return (
    <div className="rounded-sk-sm border border-line bg-surface p-2">
      <div
        className="h-14 w-full rounded-[6px] border border-line/60 flex items-end justify-end p-1"
        style={{ backgroundColor: deger }}
      >
        <span
          className="text-[10px] font-bold sk-sayi"
          style={{ color: acikMi ? '#001737' : '#ffffff' }}
        >
          {deger}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] font-bold text-ink">{ad}</p>
    </div>
  );
}

export function TasarimSistemi() {
  const { bildir } = useToast();
  const hareketAzalt = useHareketAzalt();

  const [donusAnahtari, setDonusAnahtari] = useState(0);
  const [sekme, setSekme] = useState<'ozet' | 'odevler' | 'ogrenciler'>('ozet');
  const [diyalog, setDiyalog] = useState(false);
  const [sayfa, setSayfa] = useState(1);
  const [arama, setArama] = useState('');
  const [ad, setAd] = useState('');

  const pozlar = Object.keys(EWALU_POZLARI) as EwaluPoz[];

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pb-20 pt-6">
      {/* ---------- Başlık ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <SekizWordmark boyut="md" acilistaDonsun />
        <Tag tur="bilgi">Faz 0 · Tasarım sistemi</Tag>
      </header>

      <Card vurgu="uyari" className="mt-6">
        <p className="text-[14px]">
          <strong>Bu sayfa ürün değil, temeldir.</strong> Öğretmen, öğrenci ve veli ekranları
          Faz 2–4'te gelecek. Mevcut uygulama kök adreste çalışmaya devam ediyor; burası{' '}
          <code className="rounded bg-line-soft px-1">/yeni/</code> altında ayrı bir sürüm.
        </p>
      </Card>

      {/* ---------- 8 → ∞ ---------- */}
      <Bolum
        no="01"
        baslik="8 → ∞"
        aciklama="Marka fikri geometrik olarak gerçek: üst üste binmiş iki halka dikeyken 8, doksan derece dönünce ∞. Tek şekil, iki anlam. Bu hareket yalnız dört yerde kullanılır — açılış, teslim başarısı, ilerleme tamamlanması ve tanıtım sayfası."
      >
        <Card>
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <Sekiz8Mark boyut={72} className="text-ink" />
              <p className="mt-2 text-[12px] text-muted">Durağan: 8</p>
            </div>
            <div className="text-center">
              <Sekiz8Mark boyut={72} sonsuz className="text-ink" />
              <p className="mt-2 text-[12px] text-muted">Durağan: ∞</p>
            </div>
            <div className="text-center">
              <Sekiz8Mark
                key={donusAnahtari}
                boyut={72}
                acilistaDonsun
                gecikme={350}
                className="text-amber"
              />
              <p className="mt-2 text-[12px] text-muted">Dönüşüm</p>
            </div>
            <Button tur="sade" onClick={() => setDonusAnahtari((k) => k + 1)}>
              Dönüşümü tekrar oynat
            </Button>
          </div>

          <div className="mt-4 rounded-sk-sm bg-line-soft p-3 text-[13px]">
            <strong>Hareket azaltma:</strong>{' '}
            {hareketAzalt ? (
              <>
                Sisteminizde açık. İşaret dönmüyor, doğrudan ∞ olarak çiziliyor — aynı anlam,
                hareketsiz.
              </>
            ) : (
              <>
                Sisteminizde kapalı. Açarsanız dönüş hiç oynatılmaz, işaret doğrudan ∞ olarak
                çizilir.
              </>
            )}
          </div>
        </Card>
      </Bolum>

      {/* ---------- Renk ---------- */}
      <Bolum
        no="02"
        baslik="Renk"
        aciklama="Palet iki gerçek kaynaktan türetildi: okul mührünün laciverti (piksel örneklemesiyle ölçüldü, #001737) ve Ewalu'nun kıyafet paleti. Geleneksel çini renkleri bilinçli olarak kullanılmadı — Selçuklu referansı geometrik, koloristik değil."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(RENKLER) as RenkAdi[]).map((ad) => (
            <RenkKutusu key={ad} ad={ad} />
          ))}
        </div>

        <Card className="mt-4">
          <h3 className="text-[15px] font-semibold">Kontrast denetimi (WCAG AA)</h3>
          <p className="mt-1 text-[13px] text-muted">
            Aşağıdaki çiftler her testte otomatik doğrulanır. Eşiği geçemeyen bir çift olursa
            test kırmızıya döner — palet sessizce bozulamaz.
          </p>
          <ul className="mt-3 space-y-1">
            {KONTRAST_CIFTLERI.filter((c) => c.min >= 4.5).map((c) => {
              const oran = kontrastOrani(RENKLER[c.on], RENKLER[c.arka]);
              const gecti = oran >= c.min;
              return (
                <li
                  key={`${c.on}-${c.arka}`}
                  className="flex items-center justify-between gap-3 border-b border-line-soft py-1 text-[13px] last:border-0"
                >
                  <span className="text-muted">{c.aciklama}</span>
                  <span className="flex items-center gap-2">
                    <span className="sk-sayi font-bold">{oran.toFixed(2)}</span>
                    <Tag tur={gecti ? 'basari' : 'tehlike'}>{gecti ? 'geçti' : 'kaldı'}</Tag>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Bolum>

      {/* ---------- Tipografi ---------- */}
      <Bolum
        no="03"
        baslik="Tipografi"
        aciklama="Fraunces başlıklarda, Manrope arayüzde. İkisi de Türkçe diakritiklerin tamamını taşıyor. Google Fonts CDN yerine self-host: hem daha hızlı hem ziyaretçi IP'si üçüncü tarafa gitmiyor."
      >
        <Card>
          {/* FONT ÖRNEĞİ — marka cümlesi DEĞİL. Burada eskiden
              "Öğrenmenin sonu yok" yazıyordu; o cümle artık yalnız
              bağlamıyla birlikte kullanılıyor (tanıtım sayfası, kapanış),
              tek başına bir yazı tipi örneği olarak değil. Örnek metin
              Türkçe diakritiklerin tamamını taşımayı sürdürüyor. */}
          <p className="font-display text-[38px] leading-tight">Öğrenci, ödev, gelişim</p>
          <p className="mt-1 text-[15px] text-muted">
            Manrope · gövde metni. Ödevini görürsün, çözersin, gönderirsin.
          </p>

          <GeometricDivider className="my-5" />

          <p className="text-[13px] font-bold text-muted">Türkçe karakter denetimi</p>
          <p className="mt-1 font-display text-[26px]">ğĞ ıI İi şŞ çÇ öÖ üÜ</p>
          <p className="text-[18px]">
            Çığlık, ağıl, İstanbul, şişli, öğütücü, üçgen — Buket Topuzoğlu
          </p>

          <GeometricDivider className="my-5" />

          <p className="text-[13px] font-bold text-muted">Hizalı sayılar (tabular)</p>
          <table className="mt-2 w-full text-[15px]">
            <tbody>
              {[
                ['9A · Türev testi', '88'],
                ['9B · Limit testi', '100'],
                ['10C · Logaritma', '7'],
              ].map(([a, b]) => (
                <tr key={a} className="border-b border-line-soft last:border-0">
                  <td className="py-1">{a}</td>
                  <td className="py-1 text-right font-bold">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Bolum>

      {/* ---------- Boşluk ---------- */}
      <Bolum
        no="04"
        baslik="Sekiz birimlik ritim"
        aciklama="Boşluk ölçeği 8'in katlarıyla ilerler — markanın kendisiyle aynı sayı. Tek sayı boşluk kullanılmaz; bu, ekranlar arası hizalamayı tesadüfe bırakmaz."
      >
        <Card>
          <div className="space-y-2">
            {[8, 16, 24, 32, 48, 64].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-10 text-right text-[12px] font-bold text-muted sk-sayi">
                  {n}
                </span>
                <span className="h-3 rounded-[3px] bg-ink" style={{ width: n * 2 }} />
              </div>
            ))}
          </div>
        </Card>
      </Bolum>

      {/* ---------- Geometri ---------- */}
      <Bolum
        no="05"
        baslik="Selçuklu geometrisi"
        aciklama="Sekizgen ve sekiz köşeli yıldız (Rub el Hizb) yapısal öğelerdir, süs değil. Oranlar kodda hesaplanır: yıldızın iç yarıçapı, 45° döndürülmüş iki karenin kesişiminden türetilir. Bir ekranda en fazla bir geometrik vurgu."
      >
        <Card>
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <StarEight boyut={64} className="text-ink" />
              <p className="mt-2 text-[12px] text-muted">Yıldız · dolu</p>
            </div>
            <div className="text-center">
              <StarEight boyut={64} bicim="cizgi" className="text-olive" />
              <p className="mt-2 text-[12px] text-muted">Yıldız · çizgi</p>
            </div>
            <div className="text-center">
              <EwaluFigure poz="karsilama" boyut={72} dekoratif />
              <p className="mt-2 text-[12px] text-muted">Sekizgen çerçeve</p>
            </div>
          </div>
          <GeometricDivider className="mt-6" />
          <p className="mt-2 text-center text-[12px] text-muted">Bölüm ayırıcı</p>
        </Card>
      </Bolum>

      {/* ---------- Ewalu ---------- */}
      <Bolum
        no="06"
        baslik="Ewalu"
        aciklama="Ewalu asistandır, ürünün kahramanı değil. Sekizgen çerçeve iki iş birden yapar: marka geometrisini işlevsel kılar ve kaynak görsellerin dikdörtgen arka planını kırpar — karakterin kendisine dokunmadan."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {pozlar.map((p) => (
            <Card key={p}>
              <div className="flex items-center gap-4">
                <EwaluFigure poz={p} boyut={80} dekoratif />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink">{EWALU_POZLARI[p].ad}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{EWALU_POZLARI[p].nerede}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Bolum>

      {/* ---------- Okul mührü ---------- */}
      <Bolum
        no="07"
        baslik="Okul mührü"
        aciklama="Mühür çok detaylı: dış halkada okul adı, içeride köprü, bina, meşale ve MATEMATİK yazısı. 96 pikselin altında bu detaylar okunmaz. Mührü yeniden çizmek yasak olduğuna göre doğru çözüm boyutu sınırlamak — bu kural yorumla değil, tip sistemiyle uygulanıyor."
      >
        <Card>
          {/* Mobilde alt alta: 360px'te mühür yanına sıkışan metin sütunu
              okunmaz hâle geliyordu. sm'den itibaren yan yana. */}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <SchoolCrest boyut={160} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink">
                Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Beyaz kutu zemini dairesel maskeyle kaldırıldı; çizimin kendisine dokunulmadı.
              </p>
              <p className="mt-3 text-[13px]">
                Küçük bağlamlarda mühür değil, SEKİZ marka işareti kullanılır:
              </p>
              <div className="mt-2">
                <SekizWordmark bicim="sade" boyut="sm" />
              </div>
            </div>
          </div>
        </Card>
      </Bolum>

      {/* ---------- Bileşenler ---------- */}
      <Bolum
        no="08"
        baslik="Bileşenler"
        aciklama="Hepsi klavyeyle kullanılabilir, görünür odak halkası taşır ve hiçbiri 44 pikselin altına inmez. Küçük görünüp parmakla ıskalanan buton kabul edilmiyor."
      >
        <Card>
          <p className="mb-2 text-[13px] font-bold text-muted">Butonlar</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => bildir('Ödev yayınlandı', 'basari')}>Ödevi yayınla</Button>
            <Button tur="ikincil" onClick={() => bildir('Taslak kaydedildi')}>
              Taslağa al
            </Button>
            <Button tur="sade">Vazgeç</Button>
            <Button tur="tehlike" onClick={() => setDiyalog(true)}>
              Sil
            </Button>
            <Button yukleniyor>Yükleniyor</Button>
            <Button disabled>Pasif</Button>
          </div>

          <GeometricDivider className="my-5" />

          <p className="mb-2 text-[13px] font-bold text-muted">Etiketler</p>
          <div className="flex flex-wrap gap-2">
            <Tag>Bekliyor</Tag>
            <Tag tur="basari">Gönderildi</Tag>
            <Tag tur="uyari">Değerlendiriliyor</Tag>
            <Tag tur="tehlike">Gönderilmedi</Tag>
            <Tag tur="bilgi">Test</Tag>
          </div>

          <GeometricDivider className="my-5" />

          <p className="mb-2 text-[13px] font-bold text-muted">Sekmeler</p>
          <Tabs
            etiket="Örnek sekmeler"
            secili={sekme}
            onDegis={setSekme}
            sekmeler={[
              { anahtar: 'ozet', etiket: 'Özet' },
              { anahtar: 'odevler', etiket: 'Ödevler', rozet: 3 },
              { anahtar: 'ogrenciler', etiket: 'Öğrenciler' },
            ]}
          />
          <p className="text-[13px] text-muted">
            Seçili: <strong>{sekme}</strong> — ok tuşlarıyla da geçebilirsiniz.
          </p>

          <GeometricDivider className="my-5" />

          <p className="mb-2 text-[13px] font-bold text-muted">Form alanları</p>
          <SearchInput deger={arama} onDegis={setArama} etiket="Öğrenci ara" />
          <div className="mt-4">
            <Field etiket="Ödev başlığı" zorunlu ipucu="Öğrenci listesinde bu ad görünecek.">
              {(k) => (
                <Input
                  {...k}
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  placeholder="Türev testi — sayfa 84"
                />
              )}
            </Field>
            <Field etiket="Sınıf">
              {(k) => (
                <Select {...k} defaultValue="9A">
                  <option>9A</option>
                  <option>9B</option>
                  <option>10C</option>
                </Select>
              )}
            </Field>
            <Field
              etiket="Açıklama"
              hata="Açıklama en az 10 karakter olmalı."
            >
              {(k) => <Textarea {...k} defaultValue="Kısa" />}
            </Field>
          </div>

          <GeometricDivider className="my-5" />

          <p className="mb-2 text-[13px] font-bold text-muted">Sayfalama</p>
          <Pagination sayfa={sayfa} toplamSayfa={9} onDegis={setSayfa} etiket="Öğrenci listesi" />
        </Card>
      </Bolum>

      {/* ---------- Durumlar ---------- */}
      <Bolum
        no="09"
        baslik="Dört durum"
        aciklama="Veri gösteren her ekran boş, yükleniyor, hata ve hazır durumlarını ele almak zorunda. AsyncBoundary bunu tip sistemiyle zorunlu kılıyor — geliştirici boş durumu unutamaz. Hata mesajları Türkçe ve eyleme dönük; 'bir şeyler ters gitti' yasak."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="mb-2 text-[12px] font-bold text-muted">Boş</p>
            <EmptyState
              baslik="Henüz ödev yok"
              aciklama="Öğretmeniniz ödev verdiğinde burada görünecek."
            />
          </Card>
          <Card>
            <p className="mb-2 text-[12px] font-bold text-muted">Yükleniyor</p>
            <LoadingState adet={2} />
          </Card>
          <Card>
            <p className="mb-2 text-[12px] font-bold text-muted">Hata</p>
            <ErrorState
              baslik="Ödevler yüklenemedi"
              aciklama="İnternet bağlantınızı kontrol edip tekrar deneyin."
              tekrarDene={() => bildir('Tekrar deneniyor…')}
            />
          </Card>
        </div>
      </Bolum>

      <footer className="mt-16 border-t border-line pt-6 text-center">
        <SekizWordmark boyut="sm" />
        <p className="mt-3 text-[12px] text-muted">
          SEKİZ · Faz 0 — mimari ve tasarım sistemi. Ürün ekranları henüz yok.
        </p>
      </footer>

      <Dialog
        acik={diyalog}
        onKapat={() => setDiyalog(false)}
        baslik="Ödev silinsin mi?"
        aciklama="Bu ödev ve ona ait tüm gönderimler kalıcı olarak silinir. Bu işlem geri alınamaz."
        onayEtiketi="Evet, sil"
        onayTuru="tehlike"
        onOnay={() => {
          setDiyalog(false);
          bildir('Örnek diyalog — hiçbir şey silinmedi', 'bilgi');
        }}
      />
    </div>
  );
}
