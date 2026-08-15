import { useMemo, useState } from 'react';
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
import { rpc } from '@/services/supabase';
import type { OgrenciListesi, Sinif } from '@/types/api';

type EklenenKayit = { id: string; ad: string; ogrenci_kodu: string; veli_kodu: string };
type TopluSonuc = { eklenen: EklenenKayit[]; adet: number };

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
  const [cikarilan, setCikarilan] = useState<Set<number>>(new Set());
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<TopluSonuc | null>(null);
  const [kodlarGizli, setKodlarGizli] = useState(false);

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
  const olcum = useMemo(() => listeyiCoz(metin, { duzelt: false }), [metin]);
  const duzelt = duzeltElle ?? olcum.cogunlukBuyuk;

  const kayitliAdlar = useMemo(
    () => (sinifId ? (mevcut.veri?.kayitlar ?? []).map((k) => k.ad) : []),
    [sinifId, mevcut.veri],
  );

  const ozet = useMemo(
    () => listeyiCoz(metin, { duzelt, kayitliAdlar }),
    [metin, duzelt, kayitliAdlar],
  );

  const secilenler = ozet.satirlar.filter((_, i) => !cikarilan.has(i));
  const sinifAdi = siniflar.veri?.find((s) => s.id === sinifId)?.ad ?? '';

  function satirCikar(i: number) {
    setCikarilan((e) => new Set(e).add(i));
  }

  async function ekle() {
    if (!sinifId) return setHata('Sınıf seçin.');
    if (secilenler.length === 0) return setHata('Eklenecek ad yok.');
    setHata(null);
    setKaydediyor(true);
    try {
      const v = await rpc<TopluSonuc>('ogrenciler_toplu_ekle', {
        p_token: oturum?.token,
        p_tur: 'okul',
        p_sinif_id: sinifId,
        p_adlar: secilenler.map((s) => s.ad),
      });
      setSonuc(v);
      bildir(`${v.adet} öğrenci eklendi`, 'basari');
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
          baslik={`${sonuc.adet} öğrenci eklendi`}
          aciklama={`${sinifAdi} sınıfına eklendi. Her öğrenci için ayrı öğrenci ve veli kodu üretildi.`}
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
                      <td className="py-2 pr-3 text-[14px] text-ink">{k.ad}</td>
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
                      <p className="text-[15px] font-semibold text-ink">{s.ad}</p>
                      {s.ad !== s.ham && (
                        <p className="text-[12px] text-muted">yapıştırılan: {s.ham}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* MÜKERRER ENGEL DEĞİL, UYARI. Bir okulda aynı adda
                          iki öğrenci gerçekten olur; kararı öğretmen verir. */}
                      {s.mukerrer === 'liste' && <Tag tur="uyari">Listede tekrar</Tag>}
                      {s.mukerrer === 'kayitli' && <Tag tur="uyari">Sınıfta kayıtlı</Tag>}
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
          {secilenler.length > 0 ? `${secilenler.length} öğrenci ekle` : 'Öğrenci ekle'}
        </Button>
        <Button tur="sade" onClick={() => git('/ogretmen/ogrenciler')}>
          Vazgeç
        </Button>
      </div>
    </>
  );
}
