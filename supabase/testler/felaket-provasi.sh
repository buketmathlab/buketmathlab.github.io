#!/usr/bin/env bash
# =============================================================================
# SEKİZ — FELAKET PROVASI
#
# Yedek alma ve geri yüklemeyi UÇTAN UCA dener. Denenmemiş yedek yedek
# değildir; bu ürün bir kez canlı veritabanının tamamını kaybetti ve o
# olaydan sonra yazılan `disa_aktar` uzun süre arayüze bile bağlanmamıştı.
#
# Ne yapar:
#   1. Dolu bir veritabanı kurar (Türkçe karakter, kesme işareti, jsonb)
#   2. `disa_aktar` ile GERÇEK yedeği alır
#   3. Sıfırdan BOŞ bir "yeni proje" kurar — felaketin taklidi
#   4. geri-yukle.sql ile yedeği geri yükler
#   5. Satır sayıları ve içerik birebir aynı mı, ölçer
#   6. Geri yüklenen sistemin GERÇEKTEN ÇALIŞTIĞINI ölçer: öğrenci eski
#      koduyla giriyor mu, puanı yerinde mi, veli mesajları duruyor mu
#   7. Denetimlerin yakaladığını kanıtlar: eksik tablolu bir dosya
#      REDDEDİLİYOR mu ve reddederken hiçbir şey SİLMİYOR mu
#
# Kullanım:  supabase/testler/felaket-provasi.sh
# Gerekli:   postgresql-16, python3
# =============================================================================
set -euo pipefail

PORT=${PORT:-5433}
SOCK=${SOCK:-/tmp}
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CANLI=sekiz_prova_canli
YENI=sekiz_prova_yeni
IS=$(mktemp -d)
trap 'rm -rf "$IS"' EXIT

psql_() { psql -h "$SOCK" -p "$PORT" -U sekiz -v ON_ERROR_STOP=1 "$@"; }

kur() {
  psql_ -d postgres -qc "drop database if exists $1;" -c "create database $1;"
  psql_ -q -d "$1" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text);
alter table storage.objects enable row level security;
SQL
  # NOTICE gürültüsü bastırılıyor; provanın kendi çıktısı okunur kalsın.
  for f in "$KOK"/supabase/migrations/*.sql; do psql_ -q -d "$1" -f "$f" >/dev/null 2>&1; done
}

echo "==> 1. Dolu veritabanı kuruluyor"
kur "$CANLI"
psql_ -q -d "$CANLI" <<'SQL'
do $$
declare jt text; v_s uuid; v_a uuid; v_b uuid; v_o uuid; jo text;
begin
  update public.ayarlar set ogretmen_pin_hash =
    extensions.crypt('Prova!2026', extensions.gen_salt('bf', 10)) where id = 1;
  jt := (public.giris('Prova!2026'))->>'token';
  insert into public.siniflar (seviye, sube) values (7, 'P')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  -- Kesme işareti ve Türkçe karakter: JSON kaçışını da sınıyor
  v_a := (public.ogrenci_ekle(jt, 'Ayşe O''Brien Çağlar', 'okul', v_s))->>'id';
  v_b := (public.ogrenci_ekle(jt, 'Öğünç Şıklıoğlu', 'ozel', null))->>'id';
  v_o := (public.odev_olustur(jt, 'Üslü Sayılar "1. Test"', 'Açıklama: <b>kalın</b> & tırnak''lı',
      v_s, 'test', (current_date + 5)::date, 3,
      '{"1":"A","2":"B","3":"C"}'::jsonb, 'odev/anahtar.pdf', 'odev/soru.pdf',
      true, 5::smallint, '{"1":"Üslü","2":"Üslü","3":"Köklü"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, v_o);
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_a and rol = 'ogrenci')))->>'token';
  perform public.odev_gonder(jo, v_o,
    'cozum/' || v_o::text || '/' || v_a::text || '.jpg', '{"1":"A","2":"D"}'::jsonb);
  perform public.mesaj_gonder(jt, 'Merhaba, Ayşe''nin ödevi güzeldi.', v_a);
  insert into public.dersler (ogrenci_id, zaman, mod, link)
    values (v_b, now() + interval '2 days', 'online', 'https://ornek/ders');
  insert into public.odemeler (ogrenci_id, tutar, tarih, odendi)
    values (v_b, 1500.50, current_date, true);

  -- 0032: öğretmenin KENDİ YAZDIĞI Ewalu cümlesi. Provanın konusu tam da
  -- bu: cümleler `ayarlar` tablosuna konsaydı yedeğe hiç girmez ve burada
  -- kaybolurlardı. Metin bilerek kesme işaretli ve Türkçe karakterli.
  insert into public.ewalu_mesajlari (bant, cumle) values
    (50, 'Öğretmenin''in yazdığı özel cümle — şığ değil, sağlam çalış.');
end $$;
SQL

PARMAK="select 'siniflar='||count(*) from public.siniflar
 union all select 'ogrenciler='||count(*) from public.ogrenciler
 union all select 'kodlar='||count(*) from public.giris_kodlari
 union all select 'odevler='||count(*) from public.odevler
 union all select 'gonderimler='||count(*) from public.gonderimler
 union all select 'mesajlar='||count(*) from public.mesajlar
 union all select 'dersler='||count(*) from public.dersler
 union all select 'odemeler='||count(*) from public.odemeler
 union all select 'ewalu='||count(*) from public.ewalu_mesajlari
 union all select 'ewalu_cumle='||cumle from public.ewalu_mesajlari
 union all select 'ad='||ad from public.ogrenciler order by 1"
psql_ -t -A -d "$CANLI" -c "$PARMAK" > "$IS/once.txt"

echo "==> 2. GERÇEK yedek alınıyor (disa_aktar)"
psql_ -t -A -d "$CANLI" -c \
  "select public.disa_aktar((public.giris('Prova!2026'))->>'token')" > "$IS/yedek.json"
echo "    $(wc -c < "$IS/yedek.json") bayt"

echo "==> 3. FELAKET: sıfırdan boş proje"
kur "$YENI"

echo "==> 4. Denetim: EKSİK TABLOLU dosya reddedilmeli, hiçbir şey silmeden"
python3 - "$KOK" "$IS" <<'PY'
import json, sys
kok, is_ = sys.argv[1], sys.argv[2]
sql = open(f'{kok}/supabase/geri-yukleme/geri-yukle.sql').read()
d = json.load(open(f'{is_}/yedek.json'))
def yaz(ad, veri):
    s = sql.split('\n')
    h = [i for i, l in enumerate(s) if l.strip() == 'BURAYA-YAPISTIRIN'][0]
    s[h] = json.dumps(veri, ensure_ascii=False)
    open(ad, 'w').write('\n'.join(s).replace(
        'onayliyorum boolean := false;', 'onayliyorum boolean := true;'))
yaz(f'{is_}/iyi.sql', d)
yaz(f'{is_}/eksik.sql', {k: v for k, v in d.items() if k != 'mesajlar'})
# 0032 ÖNCESİ bir yedek: `ewalu_mesajlari` anahtarı hiç yok. Öğretmenin
# ELİNDEKİ MEVCUT yedek tam olarak böyle. Reddedilmemeli.
yaz(f'{is_}/eski.sql', {k: v for k, v in d.items() if k != 'ewalu_mesajlari'})
PY

if psql_ -q -d "$YENI" -f "$IS/eksik.sql" 2>"$IS/hata.txt"; then
  echo "    HATA: eksik tablolu dosya kabul edildi!"; exit 1
fi
grep -q 'tablosu eksik' "$IS/hata.txt" || { echo "    HATA: yanlış gerekçe"; cat "$IS/hata.txt"; exit 1; }
n=$(psql_ -t -A -d "$YENI" -c "select count(*) from public.siniflar")
[ "$n" = "13" ] || { echo "    HATA: reddederken veri sildi (sınıf=$n)"; exit 1; }
echo "    reddedildi ve hiçbir şey silmedi: OK"

echo "==> 4b. ESKİ yedek (0032 öncesi) KABUL edilmeli"
# Öğretmenin elinde bugün duran yedek `ewalu_mesajlari` taşımıyor. Sıkı
# denetim onu da reddetseydi, dosya tam işe yarayacağı gün — felaket
# gününde — geri yüklenemezdi. Bu ölçüm o kapıyı açık tutuyor.
if ! psql_ -q -d "$YENI" -f "$IS/eski.sql" 2>"$IS/eski-hata.txt"; then
  echo "    HATA: 0032 öncesi yedek reddedildi!"; cat "$IS/eski-hata.txt"; exit 1
fi
n=$(psql_ -t -A -d "$YENI" -c "select count(*) from public.ewalu_mesajlari")
[ "$n" = "0" ] || { echo "    HATA: eski yedekten $n cümle geldi, 0 olmalıydı"; exit 1; }
# Eski yedek gerçekten yüklendi mi — sessizce "kabul edip hiçbir şey
# yapmamak" da bir kusur olurdu.
n=$(psql_ -t -A -d "$YENI" -c "select count(*) from public.ogrenciler")
[ "$n" != "0" ] || { echo "    HATA: eski yedek kabul edildi ama hiçbir şey yazılmadı"; exit 1; }
echo "    kabul edildi, Ewalu cümlesi boş (varsayılana düşecek): OK"

echo "==> 5. Geri yükleme"
psql_ -q -d "$YENI" -f "$IS/iyi.sql" 2>&1 | sed 's/^psql[^:]*: NOTICE:  /    /'

echo "==> 6. Satır satır karşılaştırma"
psql_ -t -A -d "$YENI" -c "$PARMAK" > "$IS/sonra.txt"
if ! diff -q "$IS/once.txt" "$IS/sonra.txt" >/dev/null; then
  echo "    HATA: geri yüklenen veri farklı"; diff "$IS/once.txt" "$IS/sonra.txt"; exit 1
fi
echo "    birebir aynı: OK"

echo "==> 7. Geri yüklenen sistem GERÇEKTEN çalışıyor mu"
psql_ -d "$YENI" <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR' | sed 's/^psql[^:]*: NOTICE:  /    /'
do $$
declare jt text; jo text; jv text; v jsonb; e jsonb;
begin
  if (public.giris('herhangi'))->>'rol' <> 'kurulum' then
    raise exception 'PIN yedekte olmamalıydı';
  end if;
  perform public.pin_ayarla('Kurtarma!2026');
  jt := (public.giris('Kurtarma!2026'))->>'token';

  jo := (public.giris((select k.kod from public.giris_kodlari k
         join public.ogrenciler o on o.id = k.ogrenci_id
         where o.ad like 'Ayşe%' and k.rol = 'ogrenci')))->>'token';
  if jo is null then raise exception 'öğrenci eski koduyla giremedi'; end if;

  v := public.ogrenci_odevleri(jo);
  if (v->'odevler'->0->'gonderim'->>'puan')::numeric <> 33.33 then
    raise exception 'puan geri gelmedi: %', v->'odevler'->0->'gonderim';
  end if;
  if v->'odevler'->0->'cevap_anahtari'->>'1' <> 'A' then
    raise exception 'cevap anahtarı geri gelmedi';
  end if;

  select e2 into e from jsonb_array_elements(v->'odevler') o,
       lateral jsonb_array_elements(o->'konu_analizi') e2 where e2->>'konu' = 'Üslü';
  if e is null or (e->>'dogru')::int <> 1 then raise exception 'konu analizi geri gelmedi'; end if;

  jv := (public.giris((select k.kod from public.giris_kodlari k
         join public.ogrenciler o on o.id = k.ogrenci_id
         where o.ad like 'Ayşe%' and k.rol = 'veli')))->>'token';
  if jsonb_array_length((public.veli_paneli(jv))->'mesajlar') <> 1 then
    raise exception 'veli mesajı geri gelmedi';
  end if;

  jv := (public.giris((select k.kod from public.giris_kodlari k
         join public.ogrenciler o on o.id = k.ogrenci_id
         where o.ad like 'Öğünç%' and k.rol = 'veli')))->>'token';
  if ((public.veli_paneli(jv))->'odemeler'->0->>'tutar')::numeric <> 1500.50 then
    raise exception 'ödeme geri gelmedi';
  end if;

  if ((public.ogretmen_panosu(jt))->>'ogrenci_sayisi')::int <> 2 then
    raise exception 'pano çalışmıyor';
  end if;

  raise notice 'öğrenci girişi, puan, anahtar, konu analizi, veli mesajı, ödeme, pano: OK';
end $$;
SQL

echo ""
echo "FELAKET PROVASI GEÇTİ — yedek alınıyor, geri yükleniyor, sistem çalışıyor"
