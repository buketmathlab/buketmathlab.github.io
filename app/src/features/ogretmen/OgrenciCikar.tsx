import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SayfaBasligi } from '@/components/layout/Kabuk';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { AsyncBoundary } from '@/components/ui/Durumlar';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { useVeri } from '@/hooks/useVeri';
import { rpc } from '@/services/supabase';
import {
  ACIKLAMA,
  ARAMA_ETIKETI,
  ARAMA_YERTUTUCU,
  BASLIK,
  BOS_ACIKLAMA,
  BOS_BASLIK,
  CIKAR_DUGMESI,
  GERI_ALMA_YOK,
  ONAY_BASLIGI,
  ONAY_DUGMESI,
  basariMetni,
  onayAciklamasi,
} from '@/lib/ogrenci-cikarma-metni';
import type { OgrenciListesi } from '@/types/api';

/**
 * ÖĞRENCİ ÇIKARMA — AYARLAR'IN ALTINDA AYRI EKRAN.
 *
 * Öğretmenin isteği: *"Öğrenci çıkarmak ayarlar içerisinde bir sekmede
 * olsun."*
 *
 * Çıkar düğmesi Öğrenciler sekmesinde her satırın sağında duruyordu.
 * Orası öğretmenin en sık açtığı ekran ve düğme, geri alınamaz bir işi
 * günlük bir listenin kenarında tutuyordu. Kodlar da aynı gerekçeyle
 * 0048'de buraya taşınmıştı: nadir ve kasıtlı işlerin yeri Ayarlar.
 *
 * NEDEN SINIF SINIF DEĞİL, TEK ARAMALI LİSTE.
 *
 * Kodlar ekranı önce sınıf soruyor, çünkü kod dağıtmak sınıf sınıf
 * yapılan bir iş. Çıkarma öyle değil: öğretmen kimi çıkaracağını zaten
 * biliyor, sınıfını hatırlamak zorunda kalmamalı. Daha önemlisi
 * ÖLÇÜLDÜ — sınıf sınıf gidilseydi ÖZEL DERS ÖĞRENCİLERİ hiç
 * erişilemezdi: onların `sinif_id`'si yok ve `siniflar_listesi`nde
 * karşılıkları çıkmıyor. Sınıf süzgeci olmayan tek liste hepsini
 * kapsıyor.
 *
 * SUNUCU SİLMİYOR. `ogrenci_pasiflestir` yalnız `aktif = false` yapıyor,
 * giriş kodlarını siliyor ve açık oturumları kapatıyor. Ödevler,
 * gönderimler, puanlar duruyor. Ekrandaki cümleler bunu söylüyor ve
 * `ogrenci-cikarma-metni.test.ts` söylediğini ölçüyor.
 */
export function OgrenciCikar() {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const git = useNavigate();

  const [arama, setArama] = useState('');
  const [sayfa, setSayfa] = useState(1);
  /**
   * TAZELEME SAYACI — `Ogrenciler.tsx`'teki desenin aynısı. Bir öğrenci
   * çıkarıldığında liste bileşeni `key` değiştiği için yeniden kuruluyor;
   * çıkarılan satır ekranda kalmıyor.
   */
  const [tazele, setTazele] = useState(0);
  const [silinecek, setSilinecek] = useState<{ id: string; ad: string } | null>(null);
  const [cikariyor, setCikariyor] = useState(false);

  async function pasiflestir() {
    if (!silinecek) return;
    setCikariyor(true);
    try {
      await rpc('ogrenci_pasiflestir', { p_token: oturum?.token, p_id: silinecek.id });
      bildir(basariMetni(silinecek.ad));
      setSilinecek(null);
      setTazele((t) => t + 1);
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'İşlem yapılamadı.', 'hata');
    } finally {
      setCikariyor(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Button tur="sade" olcu="sm" onClick={() => git('/ogretmen/ayarlar')}>
          ← Ayarlar
        </Button>
      </div>

      <SayfaBasligi baslik={BASLIK} aciklama={ACIKLAMA} />

      {/* GERİ ALMA YOK — düğmeye basmadan ÖNCE, listenin üstünde.
          Onay penceresi de söylüyor ama öğretmen bu ekrana girer girmez
          ne olduğunu bilmeli. */}
      <p className="mb-4 rounded-sk-sm bg-warning-bg p-3 text-[13px] text-warning">
        {GERI_ALMA_YOK}
      </p>

      <div className="mb-4">
        <SearchInput
          deger={arama}
          onDegis={(v) => {
            setArama(v);
            setSayfa(1);
          }}
          etiket={ARAMA_ETIKETI}
          yerTutucu={ARAMA_YERTUTUCU}
        />
      </div>

      <Liste
        key={`cikar-${tazele}`}
        arama={arama.trim()}
        sayfa={sayfa}
        onSayfa={setSayfa}
        onCikar={setSilinecek}
      />

      <Dialog
        acik={silinecek !== null}
        onKapat={() => setSilinecek(null)}
        baslik={ONAY_BASLIGI}
        aciklama={silinecek ? onayAciklamasi(silinecek.ad) : ''}
        onayEtiketi={cikariyor ? 'Çıkarılıyor…' : ONAY_DUGMESI}
        onayTuru="tehlike"
        onOnay={pasiflestir}
      />
    </>
  );
}

/**
 * Liste ayrı bileşen: `useVeri` çağrıyı atlayamıyor ve `key` ile
 * yeniden kurulması, çıkarma sonrası tazelemenin en ucuz yolu.
 *
 * SINIF SÜZGECİ YOK (`p_sinif_id: null`) — özel ders öğrencileri de bu
 * listede. Arama boşken bütün aktif öğrenciler geliyor; öğretmen kimi
 * arayacağını bilmiyorsa bile listeyi görebilsin.
 */
function Liste({
  arama,
  sayfa,
  onSayfa,
  onCikar,
}: {
  arama: string;
  sayfa: number;
  onSayfa: (s: number) => void;
  onCikar: (o: { id: string; ad: string }) => void;
}) {
  const { oturum } = useOturum();
  const liste = useVeri<OgrenciListesi>(
    'ogrenciler_listesi',
    {
      p_token: oturum?.token,
      p_arama: arama === '' ? null : arama,
      p_sinif_id: null,
      p_sayfa: sayfa,
      p_boyut: 25,
      p_sirala: 'ad',
    },
    (v) => v.kayitlar.length === 0,
  );

  return (
    <AsyncBoundary
      durum={liste.durum}
      bosBaslik={BOS_BASLIK}
      bosAciklama={BOS_ACIKLAMA}
      {...(liste.hata ? { hataAciklama: liste.hata } : {})}
      tekrarDene={liste.yenile}
    >
      {liste.veri && (
        <>
          <p className="mb-2 text-[13px] text-muted">
            <span className="sk-sayi">{liste.veri.toplam}</span> öğrenci
          </p>
          <div className="space-y-2">
            {liste.veri.kayitlar.map((o) => (
              <Card key={o.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {o.ogrenci_no && (
                      <span className="sk-sayi mr-2 rounded bg-line-soft px-1.5 py-0.5 text-[12px] font-semibold text-muted">
                        {o.ogrenci_no}
                      </span>
                    )}
                    <span className="font-semibold text-ink">{o.ad}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {o.tur === 'ozel' ? (
                        <Tag tur="uyari">Özel ders</Tag>
                      ) : (
                        o.sinif && <Tag>{o.sinif}</Tag>
                      )}
                    </div>
                  </div>
                  <Button tur="tehlike" olcu="sm" onClick={() => onCikar(o)}>
                    {CIKAR_DUGMESI}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <Pagination
            sayfa={liste.veri.sayfa}
            toplamSayfa={liste.veri.toplam_sayfa}
            onDegis={onSayfa}
            etiket="Öğrenci listesi"
          />
        </>
      )}
    </AsyncBoundary>
  );
}
