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
import type { Sinif, SinifKodlari } from '@/types/api';

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
 * Bir sınıfın kodları.
 *
 * KODLAR VARSAYILAN GİZLİ. Ekran açılırken kod ÇEKİLMİYOR bile — sunucuya
 * istek ancak öğretmen "Kodları göster"e bastığında gidiyor. Ortak bir
 * tablette sekme açık unutulsa ekranda kod olmaz; ağ günlüğüne de düşmez.
 */
export function SinifKodlari() {
  const { id = '' } = useParams();
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [veri, setVeri] = useState<SinifKodlari | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function goster() {
    setYukleniyor(true);
    try {
      setVeri(await rpc<SinifKodlari>('sinif_kodlari', { p_token: oturum?.token, p_sinif_id: id }));
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Kodlar alınamadı.', 'hata');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/kodlar')}>
          ← Kodlar
        </Button>
      </div>

      {!veri ? (
        <Card>
          <h1 className="font-display text-[22px] font-semibold text-ink">Kodlar gizli</h1>
          <p className="mt-2 text-[14px] text-muted">
            Giriş kodları birer şifredir. Bu yüzden ekran açılırken getirilmiyor; görmek için
            aşağıdaki düğmeye basın. Ortak bir cihazda bu sayfayı açık bırakmayın.
          </p>
          <div className="mt-4">
            <Button onClick={goster} yukleniyor={yukleniyor} yuklenmeMetni="Getiriliyor">
              Kodları göster
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-[24px] font-semibold text-ink">
                {veri.sinif.ad}
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                <span className="sk-sayi">{veri.ogrenciler.length}</span> öğrenci · koda
                dokununca kopyalanır
              </p>
            </div>
            {/* Gizlemek geri getirmek kadar kolay olmalı: öğretmen sınıfa
                kodları gösterip hemen kapatabilsin. */}
            <Button tur="sade" olcu="sm" onClick={() => setVeri(null)}>
              Gizle
            </Button>
          </div>

          {veri.ogrenciler.length === 0 ? (
            <Card>
              <p className="text-[14px] text-muted">Bu sınıfta aktif öğrenci yok.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {veri.ogrenciler.map((o) => (
                <Card key={o.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{o.ad}</span>
                    {o.tur === 'ozel' && <Tag tur="notr">Özel ders</Tag>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.ogrenci_kodu ? (
                      <KodKutusu etiket="Öğrenci kodu" kod={o.ogrenci_kodu} />
                    ) : (
                      <Eksik etiket="Öğrenci kodu" />
                    )}
                    {o.veli_kodu ? (
                      <KodKutusu etiket="Veli kodu" kod={o.veli_kodu} />
                    ) : (
                      <Eksik etiket="Veli kodu" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
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
