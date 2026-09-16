import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { kodlariCsv, listeyiCoz } from '@/lib/ogrenci-listesi';
import { pdfSatirlariniOku } from '@/services/pdf-metin';
import { rpc } from '@/services/supabase';
import type { OgrenciListesi, Sinif } from '@/types/api';

/**
 * `durum` 0043'te eklendi:
 *   `eklendi`     → yeni kayıt açıldı, yeni kodlar üretildi
 *   `guncellendi` → sınıfta duran öğrencinin numarası yazıldı; KOD DEĞİŞMEDİ
 *   `degismedi`   → eşleşti ama yazılacak bir şey yoktu (numara aynı ya da yok)
 */
type EklenenKayit = {
  id: string;
  ad: string;
  ogrenci_no: string | null;
  durum: 'eklendi' | 'guncellendi' | 'degismedi';
  ogrenci_kodu: string;
  veli_kodu: string;
};

/**
 * Metindeki şubeleri kararlı bir dizgiye çevirir.
 *
 * `useEffect` bağımlılığı olarak dizi kullanılsaydı her çizimde yeni bir
 * referans olur ve efekt sonsuz dönerdi.
 */
function ozetSiniflariAnahtari(metin: string, duzelt: boolean): string {
  return listeyiCoz(metin, { duzelt }).siniflar.join('|');
}
type TopluSonuc = {
  eklenen: EklenenKayit[];
  adet: number;
  eklendi: number;
  guncellendi: number;
  degismedi: number;
};

/** Sonuç satırlarından sayaçları çıkarır (şubeli dosyada toplama gerekiyor). */
function sayaclar(satirlar: EklenenKayit[]) {
  return {
    eklendi: satirlar.filter((k) => k.durum === 'eklendi').length,
    guncellendi: satirlar.filter((k) => k.durum === 'guncellendi').length,
    degismedi: satirlar.filter((k) => k.durum === 'degismedi').length,
  };
}

/** "24 öğrencinin numarası güncellendi, 3 yeni öğrenci eklendi" */
function sonucBasligi(s: TopluSonuc): string {
  const parca: string[] = [];
  if (s.eklendi > 0) parca.push(`${s.eklendi} yeni öğrenci eklendi`);
  if (s.guncellendi > 0) parca.push(`${s.guncellendi} öğrencinin numarası güncellendi`);
  if (s.degismedi > 0) parca.push(`${s.degismedi} öğrenci zaten kayıtlıydı`);
  // Boş kalamaz: sunucu her satır için bir durum döndürüyor.
  return parca.length > 0 ? parca.join(', ') : `${s.adet} satır işlendi`;
}

/**
 * Toplu öğrenci ekleme — yapıştır, önizle, onayla.
 *
 * NEDEN AYRI EKRAN: metin kutusu + 30 satırlık önizleme + uyarılar + sonuç
 * tablosu 360 px'de bir diyaloğa sığmaz. Öğrenciler ekranındaki TEK öğrenci
 * diyaloğu aynen duruyor — bir öğrenci eklemek tek tıklık bir iş olmayı
 * sürdürmeli.
 *
 * ÖĞRETMEN ONAYLAMADAN TEK BİR ÖĞRENCİ BİLE OLUŞMUYOR. Çıkarım bir
 * öneridir (Part XXVIII); ayrıştırma tamamen tarayıcıda, sunucuya yalnız
 * onaylanan adlar gidiyor.
 *
 * SUNUCU TARAFI ATOMİK (0024): 30 ad tek işlemde yazılıyor. Ağ ortada
 * koparsa yarım sınıf kalmıyor.
 */
export function TopluOgrenci() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [sinifId, setSinifId] = useState('');
  const [metin, setMetin] = useState('');
  const [duzeltElle, setDuzeltElle] = useState<boolean | null>(null);
  // `null` = öğretmen henüz seçmedi; varsayılan ÖLÇÜLEN eşleşme sayısından
  // türetiliyor (aşağıda), tahminden değil.
  const [eslestirElle, setEslestirElle] = useState<boolean | null>(null);
  const [cikarilan, setCikarilan] = useState<Set<number>>(new Set());
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<TopluSonuc | null>(null);
  const [kodlarGizli, setKodlarGizli] = useState(false);
  const [pdfOkunuyor, setPdfOkunuyor] = useState(false);
  const [pdfHata, setPdfHata] = useState<string | null>(null);
  const [pdfAdi, setPdfAdi] = useState<string | null>(null);

  const siniflar = useVeri<Sinif[]>('siniflar_listesi', {
    p_token: oturum?.token,
    p_arsiv: false,
  });

  // O sınıfta ZATEN KAYITLI adlar — mükerrer uyarısının ikinci kaynağı.
  // 100 en büyük sayfa boyutu (0016); bir sınıf bunun çok altında.
  const mevcut = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    sinifId
      ? { p_token: oturum?.token, p_sinif_id: sinifId, p_sayfa: 1, p_boyut: 100 }
      : { p_token: oturum?.token, p_sayfa: 1, p_boyut: 1 },
  );

  // Önce düzeltmesiz çözüp girdinin büyük harfli olup olmadığını ÖLÇÜYORUZ;
  // kutunun varsayılanı tahmine değil o ölçüme dayanıyor.
  /**
   * e-Okul sınıf listesi PDF'ini okur ve metin kutusuna DÖKER.
   *
   * KUTUYA DÖKÜLÜYOR, DOĞRUDAN KAYDEDİLMİYOR. Öğretmen okunanı görüyor,
   * gerekirse düzeltiyor, sonra onaylıyor — PDF'ten gelen de bir ÖNERİ
   * (Part XXVIII). Ayrıca ikinci bir ayrıştırıcı yok: satırlar `\n` ile
   * birleştirilip yapıştırmayla aynı yoldan geçiyor.
   *
   * PDF HİÇBİR YERE GİTMİYOR: okuma tamamen tarayıcıda.
   */
  async function pdfSecildi(dosya: File) {
    setPdfHata(null);
    setPdfOkunuyor(true);
    try {
      const satirlar = await pdfSatirlariniOku(dosya);
      setMetin(satirlar.join('\n'));
      setPdfAdi(dosya.name);
      // Listeyi kendimiz okuduğumuzda büyük/küçük harf düzeltmesini
      // ölçüme bırakıyoruz: e-Okul hep BÜYÜK HARF veriyor.
      setDuzeltElle(null);
    } catch (e) {
      setPdfAdi(null);
      setPdfHata(
        e instanceof Error
          ? e.message
          : 'PDF okunamadı. Listeyi kopyalayıp aşağıdaki kutuya yapıştırabilirsiniz.',
      );
    } finally {
      setPdfOkunuyor(false);
    }
  }

  const olcum = useMemo(() => listeyiCoz(metin, { duzelt: false }), [metin]);
  const duzelt = duzeltElle ?? olcum.cogunlukBuyuk;

  const kayitliAdlar = useMemo(
    () => (sinifId ? (mevcut.veri?.kayitlar ?? []).map((k) => k.ad) : []),
    [sinifId, mevcut.veri],
  );

  // O sınıfta ZATEN KULLANILAN numaralar — numara tekrarı uyarısının
  // ikinci kaynağı (birincisi aynı yapıştırmanın içi).
  const kayitliNolar = useMemo(
    () =>
      sinifId
        ? (mevcut.veri?.kayitlar ?? [])
            .map((k) => k.ogrenci_no)
            .filter((n): n is string => Boolean(n))
        : [],
    [sinifId, mevcut.veri],
  );

  /**
   * ŞUBE BAŞINA zaten kayıtlı ad ve numaralar.
   *
   * Şubeli bir dosyada seçilen tek sınıfın listesine bakmak yanıltıcı
   * olurdu: 9B'de kayıtlı bir numara 9A satırı için "zaten kayıtlı"
   * sayılır, öğretmen olmayan bir çakışmayı kovalardı. Her şube kendi
   * listesiyle karşılaştırılıyor.
   */
  const [subeKayitli, setSubeKayitli] = useState<
    Record<string, { adlar: string[]; nolar: string[] }>
  >({});

  const bulunanSiniflar = ozetSiniflariAnahtari(metin, duzelt);

  useEffect(() => {
    const adlar = bulunanSiniflar.split('|').filter(Boolean);
    if (adlar.length === 0 || !oturum?.token) return setSubeKayitli({});
    let iptal = false;
    void (async () => {
      const toplam: Record<string, { adlar: string[]; nolar: string[] }> = {};
      for (const ad of adlar) {
        const s = siniflar.veri?.find((x) => x.ad === ad);
        if (!s) continue;
        try {
          const v = await rpc<OgrenciListesi>('ogrenciler_listesi', {
            p_token: oturum.token,
            p_arama: null,
            p_sinif_id: s.id,
            p_sayfa: 1,
            p_boyut: 100,
          });
          toplam[ad] = {
            adlar: v.kayitlar.map((k) => k.ad),
            nolar: v.kayitlar.map((k) => k.ogrenci_no).filter((n): n is string => Boolean(n)),
          };
        } catch {
          // Okuma başarısızsa uyarı vermiyoruz: bu bir KOLAYLIK, engel
          // değil. Mükerrer uyarısı çıkmaz, ekleme yine çalışır.
        }
      }
      if (!iptal) setSubeKayitli(toplam);
    })();
    return () => {
      iptal = true;
    };
  }, [bulunanSiniflar, siniflar.veri, oturum?.token]);

  const ozet = useMemo(
    () =>
      listeyiCoz(metin, {
        duzelt,
        kayitliAdlar,
        kayitliNolar,
        kayitliSube: subeKayitli,
      }),
    [metin, duzelt, kayitliAdlar, kayitliNolar, subeKayitli],
  );

  const secilenler = ozet.satirlar.filter((_, i) => !cikarilan.has(i));
  const sinifAdi = siniflar.veri?.find((s) => s.id === sinifId)?.ad ?? '';

  /**
   * KAÇI ZATEN KAYITLI, KAÇI YENİ.
   *
   * Öğretmen bu iki sayıyı KAYDETMEDEN ÖNCE görüyor. Eksik olan tam
   * buydu: "Sınıfta kayıtlı" etiketi vardı ama ne olacağını söylemiyordu
   * ve kaydetmeyi engellemiyordu; sonuç, her sınıfın iki katına çıkmasıydı.
   */
  const eslesen = secilenler.filter((s) => s.kayitli).length;
  const yeni = secilenler.length - eslesen;

  // VARSAYILAN: eşleşen varsa güncelle. Kopya üretmek, numarayı yazmaktan
  // çok daha pahalı bir hata — geri alması elle silmek demek.
  const eslestir = eslestirElle ?? eslesen > 0;

  /**
   * DOSYA ŞUBE TAŞIYOR MU.
   *
   * Öğretmenin gönderdiği tek PDF ÜÇ şube taşıyordu (9A 27, 9B 30, 9C 30).
   * Başlıklar okunmasaydı 87 öğrencinin hepsi seçilen tek sınıfa eklenirdi.
   */
  const subeliMi = ozet.siniflar.length > 0;

  /** Her şube: dosyadaki satırları + depodaki karşılığı. */
  const subeler = useMemo(
    () =>
      ozet.siniflar.map((ad) => ({
        ad,
        satirlar: ozet.satirlar.filter((s, i) => s.sinif === ad && !cikarilan.has(i)),
        sinif: siniflar.veri?.find((s) => s.ad === ad) ?? null,
      })),
    [ozet, cikarilan, siniflar.veri],
  );

  const eksikSubeler = subeler.filter((s) => s.sinif === null);

  function satirCikar(i: number) {
    setCikarilan((e) => new Set(e).add(i));
  }

  /** Eksik bir şubeyi depoda oluşturur (idempotent: `sinif_ekle`). */
  async function subeOlustur(ad: string) {
    const m = /^(\d{1,2})([A-ZÇĞİÖŞÜ]{1,2})$/u.exec(ad);
    if (!m) return setHata(`"${ad}" bir sınıf adına benzemiyor.`);
    setHata(null);
    try {
      await rpc('sinif_ekle', {
        p_token: oturum?.token,
        p_seviye: Number(m[1]),
        p_sube: m[2],
      });
      siniflar.yenile();
      bildir(`${ad} sınıfı oluşturuldu`, 'basari');
    } catch (e) {
      setHata(e instanceof Error ? e.message : `${ad} oluşturulamadı.`);
    }
  }

  async function ekle() {
    if (secilenler.length === 0) return setHata('Eklenecek ad yok.');
    setHata(null);

    // ŞUBELİ DOSYA: her şube KENDİ sınıfına, ayrı çağrılarla.
    //
    // Sunucu tek çağrıda tek sınıfa yazıyor; bu yüzden üç şube üç çağrı.
    // Üçü BİRLİKTE atomik DEĞİL: ikincisi düşerse birincisi yazılmış
    // kalır. Onun için hata mesajı hangi şubelerin yazıldığını ADIYLA
    // söylüyor — "bir şeyler oldu" demek, öğretmeni veritabanını elle
    // kurcalamaya iter.
    if (subeliMi) {
      if (eksikSubeler.length > 0) {
        return setHata(
          `Şu sınıflar depoda yok: ${eksikSubeler.map((s) => s.ad).join(', ')}. ` +
            'Önce oluşturun ya da o satırları çıkarın.',
        );
      }
      setKaydediyor(true);
      const yazilan: string[] = [];
      const hepsi: EklenenKayit[] = [];
      try {
        for (const s of subeler) {
          if (s.satirlar.length === 0) continue;
          const v = await rpc<TopluSonuc>('ogrenciler_toplu_ekle', {
            p_token: oturum?.token,
            p_tur: 'okul',
            p_sinif_id: s.sinif!.id,
            p_adlar: s.satirlar.map((r) => ({ ad: r.ad, no: r.no })),
            p_mevcutlari_guncelle: eslestir,
          });
          yazilan.push(`${s.ad} (${v.adet})`);
          hepsi.push(...v.eklenen);
        }
        const toplu = { eklenen: hepsi, adet: hepsi.length, ...sayaclar(hepsi) };
        setSonuc(toplu);
        bildir(`${sonucBasligi(toplu)}: ${yazilan.join(', ')}`, 'basari');
      } catch (e) {
        const neden = e instanceof Error ? e.message : 'Öğrenciler eklenemedi.';
        setHata(
          yazilan.length > 0
            ? `${neden} — ŞUNLAR YAZILDI: ${yazilan.join(', ')}. Kalanları tekrar deneyin.`
            : neden,
        );
      } finally {
        setKaydediyor(false);
      }
      return;
    }

    if (!sinifId) return setHata('Sınıf seçin.');
    setKaydediyor(true);
    try {
      const v = await rpc<TopluSonuc>('ogrenciler_toplu_ekle', {
        p_token: oturum?.token,
        p_tur: 'okul',
        p_sinif_id: sinifId,
        // 0042: ad ve numara birlikte. Sunucu düz dizgi dizisini de kabul
        // ediyor (geriye uyum), ama numarayı ancak nesne biçimi taşır.
        p_adlar: secilenler.map((s) => ({ ad: s.ad, no: s.no })),
        // 0043: açıkken sınıfta zaten duran öğrenci tanınıyor, numarası
        // yazılıyor ve YENİ KAYIT AÇILMIYOR.
        p_mevcutlari_guncelle: eslestir,
      });
      setSonuc(v);
      bildir(sonucBasligi(v), 'basari');
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Öğrenciler eklenemedi.');
    } finally {
      setKaydediyor(false);
    }
  }

  function csvIndir() {
    if (!sonuc) return;
    // İNDİRME DESENİ `Yedek.tsx`'ten AYNEN: Blob → gizli <a> → tıkla →
    // bir sonraki tik'te serbest bırak. iOS'ta hemen `revoke` edilirse
    // indirme başlamadan iptal oluyor.
    const blob = new Blob([kodlariCsv(sonuc.eklenen, sinifAdi)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sekiz-kodlar-${sinifAdi || 'sinif'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ---------------------------------------------------------------------------
  // SONUÇ EKRANI
  // ---------------------------------------------------------------------------
  if (sonuc) {
    return (
      <>
        <div className="mb-4">
          <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ogrenciler')}>
            ← Öğrenciler
          </Button>
        </div>

        <SayfaBasligi
          baslik={sonucBasligi(sonuc)}
          aciklama={
            sonuc.guncellendi + sonuc.degismedi > 0
              ? 'Zaten kayıtlı öğrenciler için YENİ KAYIT AÇILMADI ve giriş kodları değişmedi; yalnız okul numaraları yazıldı.'
              : `${sinifAdi} sınıfına eklendi. Her öğrenci için ayrı öğrenci ve veli kodu üretildi.`
          }
        />

        {/* KODLAR BİR KEZ GÖSTERİLİYOR. Sayfadan çıkınca kaybolur; sonradan
            gerekirse Kodlar sekmesinden öğrenci öğrenci alınır (0018 yolu).
            Bu yüzden dosyayı şimdi indirmek önemli. */}
        <Card className="mb-4" vurgu="uyari">
          <p className="mb-1 font-semibold text-ink">Kodları şimdi kaydedin.</p>
          <p className="mb-3 text-[14px] text-muted">
            Bu liste yalnız bu sayfada duruyor; çıkınca kaybolur. Sonradan tek tek{' '}
            <strong>Kodlar</strong> sekmesinden alabilirsiniz, ama toplu liste bir daha
            çıkmaz.
            {sonuc.guncellendi + sonuc.degismedi > 0 && (
              <>
                {' '}
                Zaten kayıtlı öğrencilerin kodları <strong>değişmedi</strong> — aşağıda
                eski kodları duruyor, dağıttığınız kâğıtlar geçerli.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={csvIndir}>Kodları indir (Excel)</Button>
            <Button tur="sade" onClick={() => setKodlarGizli((g) => !g)}>
              {kodlarGizli ? 'Kodları göster' : 'Kodları gizle'}
            </Button>
          </div>
        </Card>

        {/* SINIFTA EKRANI BİRİNE ÇEVİRMEDEN ÖNCE. 0018 turunda tam olarak
            bu kapıyı kapatmıştık: bir öğrenciye kodunu gösterirken
            diğerlerininki görünmesin. Öğretmen toplu listeyi bilerek
            istedi; sakıncasını burada da yazıyoruz ve gizlemek tek dokunuş. */}
        {!kodlarGizli && (
          <Card>
            <p className="mb-3 text-[13px] text-muted">
              Bu tablo <strong>bütün sınıfın</strong> kodlarını birden gösteriyor. Sınıfta
              ekranı bir öğrenciye çevirmeden önce “Kodları gizle”ye basın.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 text-[12px] font-bold uppercase tracking-wide text-muted">
                      Ad soyad
                    </th>
                    <th className="py-2 pr-3 text-[12px] font-bold uppercase tracking-wide text-muted">
                      Durum
                    </th>
                    <th className="py-2 pr-3 text-[12px] font-bold uppercase tracking-wide text-muted">
                      Öğrenci
                    </th>
                    <th className="py-2 text-[12px] font-bold uppercase tracking-wide text-muted">
                      Veli
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.eklenen.map((k) => (
                    <tr key={k.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 text-[14px] text-ink">
                        {k.ogrenci_no && (
                          <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] text-muted">
                            {k.ogrenci_no}
                          </span>
                        )}
                        {k.ad}
                      </td>
                      <td className="py-2 pr-3 text-[14px]">
                        {k.durum === 'eklendi' ? (
                          <Tag tur="basari">Yeni</Tag>
                        ) : k.durum === 'guncellendi' ? (
                          <Tag tur="bilgi">Numarası yazıldı</Tag>
                        ) : (
                          <Tag>Zaten kayıtlı</Tag>
                        )}
                      </td>
                      <td className="sk-sayi py-2 pr-3 text-[14px] font-semibold text-ink">
                        {k.ogrenci_kodu}
                      </td>
                      <td className="sk-sayi py-2 text-[14px] font-semibold text-ink">
                        {k.veli_kodu}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // GİRİŞ VE ÖNİZLEME
  // ---------------------------------------------------------------------------
  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ogrenciler')}>
          ← Öğrenciler
        </Button>
      </div>

      <SayfaBasligi
        baslik="Toplu öğrenci ekle"
        aciklama="Sınıf listesini yapıştırın; ne kaydedileceğini onaylamadan hiçbir öğrenci oluşmaz."
      />

      <Card className="mb-4">
        <Field etiket="Sınıf" zorunlu>
          {(k) => (
            <Select {...k} value={sinifId} onChange={(e) => setSinifId(e.target.value)}>
              <option value="">Sınıf seçin</option>
              {(siniflar.veri ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* ŞUBELİ DOSYA: seçilen sınıf DEVRE DIŞI.
            Dosya kendi şubelerini taşıyorsa açılır listeden seçilen sınıf
            yanıltıcı olurdu — hangisi geçerli belli olmazdı. */}
        {subeliMi && (
          <Card className="mb-4" vurgu={eksikSubeler.length > 0 ? 'uyari' : 'basari'}>
            <h2 className="mb-1 text-[18px] text-ink">
              Dosyada <span className="sk-sayi">{ozet.siniflar.length}</span> şube var
            </h2>
            <p className="mb-3 text-[14px] text-muted">
              Her şube kendi sınıfına eklenecek; yukarıdaki sınıf seçimi
              kullanılmıyor.
            </p>
            <ul className="grid gap-2">
              {subeler.map((s) => (
                <li
                  key={s.ad}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0"
                >
                  <span className="text-[15px] text-ink">
                    <strong className="sk-sayi">{s.ad}</strong> ·{' '}
                    <span className="sk-sayi">{s.satirlar.length}</span> öğrenci
                  </span>
                  {s.sinif ? (
                    <Tag tur="basari">Sınıf var</Tag>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Tag tur="uyari">Sınıf yok</Tag>
                      <Button
                        tur="ikincil"
                        olcu="sm"
                        onClick={() => void subeOlustur(s.ad)}
                      >
                        {s.ad} oluştur
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* PDF YOLU. Kopyala-yapıştır PDF okuyucusundan okuyucusuna
            değişiyor ve harfleri bölebiliyor (ölçüldü: "K ı z"). Dosyayı
            biz okursak bu belirsizlik kalkıyor. */}
        <Field
          etiket="e-Okul sınıf listesi PDF'i"
          ipucu="İsteğe bağlı. Seçerseniz liste aşağıdaki kutuya dökülür; başlıklar, öğretmen adı, okul numarası ve cinsiyet ayıklanır."
        >
          {(k) => (
            <input
              {...k}
              type="file"
              accept="application/pdf,.pdf"
              className="block min-h-[44px] w-full text-[14px] text-ink file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-line file:bg-surface file:px-4 file:text-[14px] file:text-ink"
              onChange={(e) => {
                const d = e.target.files?.[0];
                if (d) void pdfSecildi(d);
              }}
            />
          )}
        </Field>
        {pdfOkunuyor && (
          <p className="text-[14px] text-muted">PDF okunuyor…</p>
        )}
        {pdfAdi && !pdfOkunuyor && (
          <p className="text-[14px] text-muted">
            <strong>{pdfAdi}</strong> okundu. Aşağıdaki önizlemeyi kontrol edin.
          </p>
        )}
        {pdfHata && (
          <p className="text-[14px] text-danger">
            {pdfHata} Listeyi kopyalayıp aşağıdaki kutuya da yapıştırabilirsiniz.
          </p>
        )}

        <Field
          etiket="Ad listesi"
          zorunlu
          ipucu="Her satıra bir ad. Baştaki sıra numaraları ve Excel'den gelen fazla sütunlar kendiliğinden ayıklanır."
        >
          {(k) => (
            <Textarea
              {...k}
              rows={8}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              placeholder={'1 ALİ YILMAZ\n2 AYŞE DEMİR\n3 MEHMET KAYA'}
              // PIN kutusundaki hatayı tekrarlamıyoruz: hiçbir otomatik
              // harf dönüşümü yok. Adı düzelten tek yer aşağıdaki kutu ve
              // sonucu önizlemede görünüyor.
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </Field>

        <label className="mt-1 flex min-h-[44px] items-center gap-2 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={duzelt}
            onChange={(e) => setDuzeltElle(e.target.checked)}
            className="size-5 accent-ink"
          />
          <span>
            Adları düzelt: <strong>ALİ YILMAZ</strong> → <strong>Ali Yılmaz</strong>
          </span>
        </label>
        {olcum.cogunlukBuyuk && duzeltElle === null && (
          <p className="mt-1 text-[13px] text-muted">
            Listenin çoğu büyük harf olduğu için açık geldi; kapatabilirsiniz.
          </p>
        )}
      </Card>

      {ozet.atlanan.length > 0 && (
        // OKUNAMAYAN SATIR SESSİZCE ATILMIYOR. Ham hâliyle gösteriliyor ki
        // öğretmen gerçekten atılması gereken bir şey mi, yoksa bizim
        // ayrıştıramadığımız bir ad mı olduğunu görebilsin.
        <Card className="mb-4" vurgu="uyari">
          <p className="mb-1 font-semibold text-ink">
            <span className="sk-sayi">{ozet.atlanan.length}</span> satır okunamadı
          </p>
          <p className="mb-2 text-[13px] text-muted">
            Bunlar eklenmeyecek. Ad olması gereken bir satır varsa metni düzeltip tekrar
            yapıştırın.
          </p>
          <ul className="space-y-1">
            {ozet.atlanan.map((a) => (
              <li key={a.satir} className="text-[13px] text-muted">
                <span className="sk-sayi">{a.satir}.</span> satır:{' '}
                <span className="text-ink">{a.ham}</span> — {a.sebep}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* KARAR: eşleşen varsa ne yapılacağı KAYDETMEDEN ÖNCE soruluyor.
          Bu kart olmadığı için öğretmenin bütün sınıfları iki katına çıktı:
          "Sınıfta kayıtlı" uyarısı vardı, ama bir yol yoktu. */}
      {eslesen > 0 && (
        <Card className="mb-4" vurgu="uyari">
          <h2 className="mb-1 text-[18px] text-ink">
            <span className="sk-sayi">{eslesen}</span> öğrenci sınıfta zaten kayıtlı,{' '}
            <span className="sk-sayi">{yeni}</span> tanesi yeni
          </h2>
          <p className="mb-3 text-[14px] text-muted">
            Aynı listeyi ikinci kez yüklüyorsanız bu normaldir. Ne yapılsın?
          </p>
          <div className="grid gap-2">
            <label className="flex min-h-[44px] items-start gap-2 text-[15px] text-ink">
              <input
                type="radio"
                name="eslestirme"
                className="mt-1 size-5 accent-ink"
                checked={eslestir}
                onChange={() => setEslestirElle(true)}
              />
              <span>
                <strong>Mevcut öğrencilerin numarasını güncelle</strong>
                <span className="block text-[13px] text-muted">
                  Yeni kayıt açılmaz, giriş kodları değişmez. Yalnız okul numarası
                  yazılır.
                </span>
              </span>
            </label>
            <label className="flex min-h-[44px] items-start gap-2 text-[15px] text-ink">
              <input
                type="radio"
                name="eslestirme"
                className="mt-1 size-5 accent-ink"
                checked={!eslestir}
                onChange={() => setEslestirElle(false)}
              />
              <span>
                <strong>Yeni öğrenci olarak ekle</strong>
                <span className="block text-[13px] text-muted">
                  Aynı adda ikinci bir kayıt açılır. Sınıfta gerçekten iki adaş varsa
                  bunu seçin.
                </span>
              </span>
            </label>
          </div>
        </Card>
      )}

      {ozet.satirlar.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[18px] text-ink">
              Önizleme{' '}
              <span className="sk-sayi text-[14px] text-muted">
                ({secilenler.length} öğrenci eklenecek)
              </span>
            </h2>
          </div>

          <Card className="mb-4">
            <ul className="divide-y divide-line">
              {ozet.satirlar.map((s, i) => {
                if (cikarilan.has(i)) return null;
                return (
                  <li
                    key={`${s.ham}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink">
                        {/* NUMARA ADIN İÇİNDE DEĞİL, AYRI. 0042'den önce ad
                            alanı "601 Ali Yılmaz Erkek" diye gidiyordu. */}
                        {s.sinif && (
                          <span className="mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                            {s.sinif}
                          </span>
                        )}
                        {s.no && (
                          <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] text-muted">
                            {s.no}
                          </span>
                        )}
                        {s.ad}
                      </p>
                      {s.ad !== s.ham && (
                        <p className="text-[12px] text-muted">yapıştırılan: {s.ham}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* MÜKERRER ENGEL DEĞİL, UYARI. Bir okulda aynı adda
                          iki öğrenci gerçekten olur; kararı öğretmen verir. */}
                      {s.mukerrer === 'liste' && <Tag tur="uyari">Listede tekrar</Tag>}
                      {/* ETİKET KARARI SÖYLÜYOR. "Sınıfta kayıtlı" tek
                          başına ne olacağını söylemiyordu; artık seçilen
                          yola göre sonucu yazıyor. */}
                      {s.kayitli &&
                        (eslestir ? (
                          <Tag tur="basari">Numarası güncellenecek</Tag>
                        ) : (
                          <Tag tur="uyari">İkinci kayıt açılacak</Tag>
                        ))}
                      {/* NUMARA TEKRARI AYRI BİR UYARI: aynı adda iki
                          öğrenci olabilir, aynı numarada olmaması beklenir.
                          Yine de engel değil — öğretmenin kararı. */}
                      {s.noTekrar === 'liste' && <Tag tur="uyari">Numara tekrarı</Tag>}
                      {s.noTekrar === 'kayitli' && <Tag tur="uyari">Numara kayıtlı</Tag>}
                      <Button
                        tur="sade"
                        olcu="sm"
                        onClick={() => satirCikar(i)}
                        aria-label={`${s.ad} satırını çıkar`}
                      >
                        Çıkar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      {hata && (
        <p role="alert" className="mb-3 text-[14px] font-semibold text-danger">
          {hata}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={ekle} yukleniyor={kaydediyor} disabled={secilenler.length === 0}>
          {secilenler.length === 0
            ? 'Öğrenci ekle'
            : eslestir && eslesen > 0
              ? `${yeni} ekle, ${eslesen} güncelle`
              : `${secilenler.length} öğrenci ekle`}
        </Button>
        <Button tur="sade" onClick={() => git('/ogretmen/ogrenciler')}>
          Vazgeç
        </Button>
      </div>
    </>
  );
}
