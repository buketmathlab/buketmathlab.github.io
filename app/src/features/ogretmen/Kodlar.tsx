import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { KodKutusu } from '@/components/ui/KodKutusu';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import type { Kodlar as KodlarTipi, OgrenciListesi, Sinif } from '@/types/api';

/**
 * Kodlar sekmesi — SINIF LİSTESİ.
 *
 * Panodaki desenin aynısı: önce sınıf, sonra içerik. Otuz kişilik on üç
 * sınıfın kodlarını tek sayfaya dizmek hem kullanılmaz hem tehlikeli olurdu.
 *
 * Arşivdeki sınıflar burada YOK — `siniflar_listesi` varsayılan olarak
 * süzüyor (0016 ile kural hâline geldi).
 */
export function Kodlar() {
  const { oturum } = useOturum();
  const git = useNavigate();

  const { veri, durum, hata, yenile } = useVeri<Sinif[]>(
    'siniflar_listesi',
    { p_token: oturum?.token, p_arsiv: false },
    (v) => v.length === 0,
  );

  const dolu = (veri ?? []).filter((s) => s.ogrenci_sayisi > 0);
  const bos = (veri ?? []).filter((s) => s.ogrenci_sayisi === 0);

  return (
    <>
      <SayfaBasligi
        baslik="Kodlar"
        aciklama="Öğrenci ve veli giriş kodları. Kod bir şifredir; güvenli kanaldan paylaşın."
      />

      <AsyncBoundary
        durum={durum}
        bosBaslik="Henüz sınıf yok"
        bosAciklama="Sınıflar bölümünden sınıf ekleyince burada göreceksiniz."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <Card>
              <ul className="divide-y divide-line">
                {dolu.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => git(`/ogretmen/kodlar/${s.id}`)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <span className="font-display text-[18px] font-semibold text-ink">
                        {s.ad}
                      </span>
                      <span className="flex items-center gap-2 text-[14px] text-muted">
                        <span className="sk-sayi">{s.ogrenci_sayisi}</span> öğrenci
                        <Ok />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Öğrencisi olmayan sınıflar listeyi şişirmesin ama YOK da
                sayılmasın: öğretmen "9C nerede" diye aramasın diye ayrı
                ve sönük bir satırda duruyorlar. */}
            {bos.length > 0 && (
              <p className="mt-3 text-[13px] text-muted">
                Öğrencisi olmayan sınıflar: {bos.map((s) => s.ad).join(', ')}
              </p>
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/**
 * Bir sınıfın öğrencileri — kodlar ÖĞRENCİ ÖĞRENCİ açılıyor.
 *
 * ÖĞRETMENİN İSTEĞİ: "Bir öğrenciye kodunu gösterirken diğer öğrencilerin
 * kodunu göremesin."
 *
 * Bunu ekranda gizleyerek yapmıyoruz. Kod, dokunulan öğrenci için O AN
 * sunucudan isteniyor (`ogrenci_kodlari`); diğerlerinin kodu tarayıcıya hiç
 * inmiyor. Toplu indirip birini göstermek, kodları ağ yanıtında ve bellekte
 * bırakırdı — cevap anahtarında reddettiğimiz desenin aynısı (Part XXI).
 *
 * AYNI ANDA TEK ÖĞRENCİ: ikinci bir isme dokunmak birincinin kodunu
 * state'ten de düşürür, yalnız ekrandan değil.
 */
export function SinifKodlari() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  // Tek kayıt: açık olan öğrencinin kimliği ve kodları. İki öğrencinin
  // kodunu aynı anda tutabilecek bir yapı (dizi, sözlük) bilerek yok —
  // tutamayacağı için sızdıramaz.
  const [acik, setAcik] = useState<{ id: string; kodlar: KodlarTipi } | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);

  const { veri, durum, hata, yenile } = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    { p_token: oturum?.token, p_arama: null, p_sinif_id: id, p_sayfa: 1, p_boyut: 100 },
    (v) => v.kayitlar.length === 0,
  );

  async function ac(ogrenciId: string) {
    if (acik?.id === ogrenciId) {
      setAcik(null);
      return;
    }
    // Öncekini HEMEN düşür: ağ beklerken iki öğrencinin kodu bir arada
    // durmasın.
    setAcik(null);
    setBekleyen(ogrenciId);
    try {
      const k = await rpc<KodlarTipi>('ogrenci_kodlari', {
        p_token: oturum?.token,
        p_id: ogrenciId,
      });
      setAcik({ id: ogrenciId, kodlar: k });
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kodlar alınamadı.', 'hata');
    } finally {
      setBekleyen(null);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/kodlar')}>
          ← Kodlar
        </Button>
      </div>

      <AsyncBoundary
        durum={durum}
        bosBaslik="Bu sınıfta öğrenci yok"
        bosAciklama="Öğrenciler bölümünden bu sınıfa öğrenci ekleyebilirsiniz."
        {...(hata ? { hataAciklama: hata } : {})}
        tekrarDene={yenile}
      >
        {veri && (
          <>
            <div className="mb-4">
              <h1 className="font-display text-[24px] font-semibold text-ink">
                {veri.kayitlar[0]?.sinif ?? 'Sınıf'}
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                <span className="sk-sayi">{veri.kayitlar.length}</span> öğrenci · kodu görmek
                için öğrencinin adına dokunun
              </p>
            </div>

            <Card>
              <ul className="divide-y divide-line">
                {veri.kayitlar.map((o) => {
                  const bu = acik?.id === o.id;
                  return (
                    <li key={o.id} className="py-1 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => ac(o.id)}
                        aria-expanded={bu}
                        className="flex min-h-[44px] w-full items-center justify-between gap-3 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{o.ad}</span>
                          {o.tur === 'ozel' && <Tag tur="notr">Özel ders</Tag>}
                        </span>
                        <span className="text-[13px] text-muted">
                          {bekleyen === o.id ? 'Getiriliyor…' : bu ? 'Kapat' : 'Kodu göster'}
                        </span>
                      </button>

                      {bu && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {acik.kodlar.ogrenci ? (
                            <KodKutusu etiket="Öğrenci kodu" kod={acik.kodlar.ogrenci} />
                          ) : (
                            <Eksik etiket="Öğrenci kodu" />
                          )}
                          {acik.kodlar.veli ? (
                            <KodKutusu etiket="Veli kodu" kod={acik.kodlar.veli} />
                          ) : (
                            <Eksik etiket="Veli kodu" />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <p className="mt-3 text-[13px] text-muted">
              Aynı anda yalnız bir öğrencinin kodu açılır; başka bir isme dokununca öncekiler
              kapanır.
            </p>
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

/** Kodu olmayan satır sessizce boş kalmaz; öğretmen atlamasın. */
function Eksik({ etiket }: { etiket: string }) {
  return (
    <div className="min-h-[44px] flex-1 rounded-sk-sm border border-dashed border-line px-3 py-2">
      <span className="block text-[11px] font-bold text-muted">{etiket}</span>
      <span className="block text-[13px] text-muted">yok</span>
    </div>
  );
}

function Ok() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
