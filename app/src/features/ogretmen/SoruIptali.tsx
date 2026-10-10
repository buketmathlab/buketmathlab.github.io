import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/toast-baglam';
import { useOturum } from '@/hooks/oturum-baglam';
import { rpc } from '@/services/supabase';
import { iptalSorulari, numaraListesi, soruNumaralariniOku } from '@/lib/soru-iptali';

export type SubeRaporu = {
  sinif: string;
  odev_id: string;
  atlandi?: 'arsiv' | 'zaten_iptal' | 'iptal_degil';
  yeniden_puanlanan?: number;
  ortalama_once?: number | null;
  ortalama_sonra?: number | null;
  elle_duzeltilmis?: { ogrenci: string; ogretmen_puan: number; hesaplanan: number }[];
};
type IptalSonucu = { durum: 'tamam'; subeler: SubeRaporu[] };

type Props = {
  odevId: string;
  soruSayisi: number;
  anahtar: Record<string, string> | null;
  /** Bu ödev ve arşivde olmayan kardeşleri: iptal hepsinde birlikte. */
  subeler: string[];
  /**
   * Yeniden puanlama raporu ÜST BİLEŞENDE tutuluyor: iptalden sonra sayfa
   * yeniden yükleniyor ve bu kart yeniden kuruluyor — rapor kendi
   * durumunda olsaydı öğretmen hangi notların değiştiğini hiç görmezdi
   * (denetimde yakalandı).
   */
  rapor: SubeRaporu[] | null;
  onDegisti: (rapor: SubeRaporu[]) => void;
};

const ORT = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

/**
 * SORU İPTALİ (0072).
 *
 * Gerçek olay: 65 soruluk testte 8. ve 35. soruların şıkları baskıda
 * çıkmadı; öğrenciler o soruları işaretleyemedi. Öğretmenin kararı:
 * DEĞERLENDİRME DIŞI — puan kalan sorular üzerinden (63), aynı ödevin
 * bütün şubelerinde birlikte.
 *
 * Kayıt düğmesinden AYRI bir işlem: iptal, formdaki diğer alanları
 * kaydetmeden yapılabilmeli ve kendi onayını, sebebini, raporunu taşımalı.
 * Sebep denetim izine yazılıyor; not değişiklikleri öğrenci öğrenci izli.
 */
export function SoruIptali({ odevId, soruSayisi, anahtar, subeler, rapor, onDegisti }: Props) {
  const { oturum } = useOturum();
  const { bildir } = useToast();
  const mevcut = iptalSorulari(anahtar);
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState('');
  const [sebep, setSebep] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState<number[] | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const kalan = (sorular: number[]) => soruSayisi - new Set([...mevcut, ...sorular]).size;

  function hazirla() {
    const okunan = soruNumaralariniOku(metin, soruSayisi);
    if (okunan.hata !== null) return setHata(okunan.hata);
    if (sebep.trim().length < 3)
      return setHata('İptalin sebebini yazın (ör. "Şıklar baskıda çıkmadı").');
    if (kalan(okunan.sorular) < 1) return setHata('Bütün sorular iptal edilemez.');
    setHata(null);
    setOnay(okunan.sorular);
  }

  async function iptalEt(sorular: number[]) {
    setCalisiyor(true);
    try {
      const s = await rpc<IptalSonucu>('sorulari_iptal_et', {
        p_token: oturum?.token,
        p_odev: odevId,
        p_sorular: sorular,
        p_sebep: sebep.trim(),
      });
      setOnay(null);
      setAcik(false);
      setMetin('');
      setSebep('');
      bildir(
        `${numaraListesi(sorular)}. sorular iptal edildi; puanlar yeniden hesaplandı.`,
        'basari',
      );
      onDegisti(s.subeler);
    } catch (e) {
      setOnay(null);
      bildir(e instanceof Error ? e.message : 'İptal edilemedi.', 'hata');
    } finally {
      setCalisiyor(false);
    }
  }

  async function geriAl(no: number) {
    setCalisiyor(true);
    try {
      const s = await rpc<IptalSonucu>('soru_iptalini_geri_al', {
        p_token: oturum?.token,
        p_odev: odevId,
        p_soru: no,
      });
      bildir(`${no}. sorunun iptali geri alındı; puanlar yeniden hesaplandı.`, 'basari');
      onDegisti(s.subeler);
    } catch (e) {
      bildir(e instanceof Error ? e.message : 'Geri alınamadı.', 'hata');
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="text-[17px] font-semibold text-ink">Soru iptali</h2>
      <p className="mt-1 text-[14px] text-muted">
        Baskı hatası gibi bir nedenle cevaplanamayan soru değerlendirme dışı bırakılır: puan kalan
        sorular üzerinden hesaplanır. Bu ödevin verildiği bütün şubelerde birlikte uygulanır
        {subeler.length > 0 && <> ({subeler.join(', ')})</>}.
      </p>

      {mevcut.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="İptal edilen sorular">
          {mevcut.map((no) => (
            <li
              key={no}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sk-sm border border-line px-3 py-1"
            >
              <span className="text-[14px] text-ink">
                <strong className="sk-sayi">{no}.</strong> soru · iptal · değerlendirme dışı
              </span>
              <Button
                tur="sade"
                olcu="sm"
                onClick={() => void geriAl(no)}
                disabled={calisiyor}
                aria-label={`${no}. sorunun iptalini geri al`}
              >
                Geri al
              </Button>
            </li>
          ))}
          <li className="text-[13px] text-muted">
            Puan <span className="sk-sayi">{soruSayisi - mevcut.length}</span> soru üzerinden
            hesaplanıyor.
          </li>
        </ul>
      )}

      {!acik ? (
        <Button tur="ikincil" olcu="sm" className="mt-3" onClick={() => setAcik(true)}>
          Soru iptal et
        </Button>
      ) : (
        <div className="mt-3">
          <Field etiket="İptal edilecek soru numaraları" ipucu="Örnek: 8, 35" zorunlu>
            {(p) => (
              <Input
                {...p}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>
          <Field etiket="Sebep" ipucu='Örnek: "Şıklar baskıda çıkmadı"' zorunlu>
            {(p) => (
              <Input
                {...p}
                value={sebep}
                onChange={(e) => setSebep(e.target.value)}
                maxLength={500}
              />
            )}
          </Field>
          {hata && (
            <p role="alert" className="mb-3 text-[14px] font-semibold text-danger">
              {hata}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button tur="sade" olcu="sm" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
            <Button olcu="sm" onClick={hazirla}>
              Devam
            </Button>
          </div>
        </div>
      )}

      {rapor && (
        <div className="mt-4 border-t border-line pt-3" role="status">
          <p className="mb-1 text-[14px] font-semibold text-ink">Yeniden puanlama</p>
          <ul className="space-y-1 text-[14px] text-ink">
            {rapor.map((r) => (
              <li key={r.odev_id}>
                <strong>{r.sinif}</strong>:{' '}
                {r.atlandi === 'arsiv'
                  ? 'arşivde, değiştirilmedi'
                  : r.atlandi
                    ? 'değişiklik yok'
                    : `${r.yeniden_puanlanan ?? 0} öğrencinin puanı yeniden hesaplandı · ortalama ${ORT(r.ortalama_once)} → ${ORT(r.ortalama_sonra)}`}
                {(r.elle_duzeltilmis ?? []).map((e) => (
                  <span key={e.ogrenci} className="block text-[13px] text-warning">
                    {`${e.ogrenci}: elle verdiğiniz ${ORT(e.ogretmen_puan)} puan korunuyor (yeni hesap ${ORT(e.hesaplanan)}).`}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        acik={onay !== null}
        onKapat={() => setOnay(null)}
        baslik="Sorular iptal edilecek"
        aciklama={
          onay
            ? `${numaraListesi(onay)}. ${onay.length > 1 ? 'sorular' : 'soru'} ${subeler.join(', ')} şubelerinde değerlendirme dışı bırakılacak. Puanlar ${kalan(onay)} soru üzerinden yeniden hesaplanacak.`
            : ''
        }
        onayEtiketi="İptal et"
        onOnay={() => onay && void iptalEt(onay)}
        onayYukleniyor={calisiyor}
      >
        <p className="text-[14px] text-muted">
          Her not değişikliği kayda geçer. İsterseniz sonra &quot;Geri al&quot; ile eski hâline
          döndürebilirsiniz.
        </p>
      </Dialog>
    </Card>
  );
}
