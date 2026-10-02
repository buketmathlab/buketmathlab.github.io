import { Card } from '@/components/ui/Card';

/**
 * "Son puanı" kartı — veli ve öğrenci panosunda ortak.
 *
 * OLAY: bir veli, Samsung telefonda puanı ancak sağa kaydırınca
 * görebildiğini söyledi. Ölçüldü: başlık `truncate` ile TEK SATIRA
 * zorlanıyordu ve kart bir `grid`in içindeydi. Grid öğesinin en küçük
 * genişliği içeriği kadar olduğu için uzun bir ödev adı ("9. Sınıf Üslü
 * ve Köklü İfadeler Deneme Testi 1") kartı 419 px'e açıyor, puan ekranın
 * DIŞINDA kalıyordu — 412 px'lik telefonda bile. Marka değil, başlık
 * uzunluğu belirliyordu.
 *
 * ŞİMDİ: puan kartın EN BÜYÜK yazısı ve kendi satırında; başlık altında
 * ve SARIYOR (kesilmiyor). Hiçbir genişlikte yatay kaydırma gerekmiyor.
 */
export function SonPuanKarti({
  etiket,
  odev,
  puan,
  bosMetin,
}: {
  etiket: string;
  odev: string | null;
  puan: number | null;
  bosMetin: string;
}) {
  return (
    <Card>
      <p className="text-[13px] font-bold uppercase tracking-wide text-muted">{etiket}</p>
      {puan !== null && odev ? (
        <>
          <p className="mt-2 font-display font-semibold leading-none text-ink">
            <span className="sk-sayi text-[40px]">{puan}</span>{' '}
            <span className="text-[18px]">puan</span>
          </p>
          <p className="mt-2 break-words text-[15px] text-muted">{odev}</p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-ink">{bosMetin}</p>
      )}
    </Card>
  );
}
