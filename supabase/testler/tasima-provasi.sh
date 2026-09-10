#!/usr/bin/env bash
# =============================================================================
# SEKİZ — TAŞIMA PROVASI (0032 → 0033)
#
# `felaket-provasi.sh`'den FARKI, ve bu dosyanın var oluş sebebi:
# felaket provası her iki veritabanını da BUGÜNKÜ migration zinciriyle
# (0033 dahil) kuruyor. Yani 0033'ün *taşıma* adımını hiç çalıştırmıyor —
# çünkü taşıyacak eski veri yok. Oysa canlıda olacak olan tam olarak bu:
# İÇİ DOLU, 0032 şemasındaki bir veritabanının üstünden 0033 geçecek.
#
# Bu prova o günü, canlıya dokunmadan önce, önceden yaşıyor:
#
#   1. 0001–0032 ile "canlı benzeri" DOLU bir veritabanı kurulur
#      (sınıflar, öğrenciler, ödevler, gönderimler, puanlar, iki ayrı
#      yazışma, özel ders öğrencisi + dersleri + ÖDEMELERİ)
#   2. Öğretmenin GÖRDÜĞÜ SAYILAR uçlardan okunur — parmak izi ÖNCE
#   3. `disa_aktar` ile gerçek yedek alınır
#   4. BOŞ bir "yeni proje" 0001–0032 ile kurulur, yedek geri yüklenir
#      (canlının kopyası; asıl canlıya hiç dokunulmuyor)
#   5. **0033 ORADA çalıştırılır** — asıl ölçüm bu
#   6. Aynı PIN'le girilir, aynı uçlar okunur — parmak izi SONRA
#   7. ÖNCE ile SONRA birebir aynı mı: değilse prova düşer
#
# Ayrıca iki YEDEK ZİNCİRİ sorusu ölçülüyor (varsayılmıyor):
#   8. 0033 sonrası alınan yedek, boş bir 0033 projesine geri yüklenebiliyor
#      mu — ve öğretmen kadrosuna ne oluyor
#   9. 0033 ÖNCESİ alınmış bir yedek, 0033'lü bir projeye yüklenirse ne
#      oluyor — sessizce bozuk mu yükleniyor, yoksa reddediliyor mu
#
# Kullanım:  supabase/testler/tasima-provasi.sh
# Gerekli:   postgresql-16, python3
# =============================================================================
set -euo pipefail

PORT=${PORT:-5433}
SOCK=${SOCK:-/tmp/sekiz-sock}
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CANLI=sekiz_tasima_canli     # 0032 şemasında, dolu — canlının taklidi
YENI=sekiz_tasima_yeni       # 0032 şemasında, boş → yedek → 0033
Y33=sekiz_tasima_0033        # 0033'lü boş proje — yedek zinciri soruları
IS=$(mktemp -d)
trap 'rm -rf "$IS"' EXIT

psql_() { psql -h "$SOCK" -p "$PORT" -U sekiz -v ON_ERROR_STOP=1 "$@"; }

# Boş bir Supabase taklidi kurar, sonra $2 numarasına KADAR migration uygular.
# Sınırın parametre olması provanın bütün fikri: 0032'de duran bir
# veritabanı kurabilmek için gerekiyor.
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
  for f in "$KOK"/supabase/migrations/*.sql; do
    n=$(basename "$f" | cut -c1-4)
    [ "$n" -le "$2" ] || continue
    psql_ -q -d "$1" -f "$f" >/dev/null 2>&1
  done
}

# ---------------------------------------------------------------------------
# PARMAK İZİ — öğretmenin EKRANDA gördüğü sayılar.
#
# Neden ham `count(*)` DEĞİL: 0033'ün asıl riski satırların kaybolması
# değil, satırların KAPSAM DIŞINDA kalması. `odevler` tablosunda 3 ödev
# durur ama `ogretmen_id` yanlış taşınmışsa `odevler_listesi` 0 döndürür ve
# öğretmen ödevlerini "kaybolmuş" görür. Tablo sayan bir ölçüm bunu
# ıskalardı; uçtan okuyan ölçüm ıskalamıyor.
#
# Uçlar 0032 ve 0033'te AYNI İMZAYA sahip olanlardan seçildi ki iki
# tarafta da aynı çağrı yapılabilsin.
# ---------------------------------------------------------------------------
PARMAK=$(cat <<'SQL'
select string_agg(satir, E'\n' order by sira) from (
  select 1 as sira, format('pano %s|%s|%s|%s|%s',
      v->>'ogrenci_sayisi', v->>'odev_verilen_ogrenci', v->>'acik_odev',
      v->>'bekleyen_degerlendirme', v->>'gecikmis_eksik') as satir
    from (select public.ogretmen_panosu(public.jeton()) as v) t
  union all
  select 2, format('sinif %s|%s|%s', x->>'ad', x->>'ogrenci_sayisi', x->>'arsiv')
    from (select public.siniflar_listesi(public.jeton(), false) as v) t,
         jsonb_array_elements(t.v) x
  union all
  select 3, format('ogrenci-toplam %s', v->>'toplam')
    from (select public.ogrenciler_listesi(public.jeton(), null, null, 1, 100) as v) t
  union all
  select 4, format('ogrenci %s|%s|%s', x->>'ad', x->>'tur', x->>'sinif')
    from (select public.ogrenciler_listesi(public.jeton(), null, null, 1, 100) as v) t,
         jsonb_array_elements(t.v->'kayitlar') x
  union all
  select 5, format('odev %s|%s|%s|%s|%s', x->>'baslik', x->>'sinif',
      x->>'gonderim_sayisi', x->>'soru_sayisi', x->>'yayinda')
    from (select public.odevler_listesi(public.jeton(), null, false) as v) t,
         jsonb_array_elements(t.v) x
  union all
  select 6, format('veli-okunmamis %s', v->>'toplam_okunmamis')
    from (select public.veliler_listesi(public.jeton()) as v) t
  union all
  select 7, format('veli %s|%s|%s', x->>'ad', x->>'sinif', x->>'okunmamis')
    from (select public.veliler_listesi(public.jeton()) as v) t,
         jsonb_array_elements(t.v->'yanit_bekleyen') x
  union all
  select 8, format('karne-odev %s', v->>'odev_sayisi')
    from (select public.konu_karnesi(public.jeton(),
            (select id from public.siniflar where not ozel order by seviye, sube limit 1),
            null) as v) t
  union all
  select 9, format('konu %s|%s|%s|%s|%s', x->>'konu', x->>'toplam',
      x->>'dogru', x->>'yanlis', x->>'bos')
    from (select public.konu_karnesi(public.jeton(),
            (select id from public.siniflar where not ozel order by seviye, sube limit 1),
            null) as v) t,
         jsonb_array_elements(t.v->'konular') x
  union all
  select 10, format('ozel %s|%s|%s|%s|%s', v->'ozet'->>'toplam', v->'ozet'->>'odenen',
      v->'ozet'->>'kalan', v->'ozet'->>'ders_toplam', v->'ozet'->>'gelecek_ders')
    from (select public.ozel_ders_detay(public.jeton(),
            (select id from public.ogrenciler where tur = 'ozel' order by ad limit 1)) as v) t
  union all
  -- Öğrencinin ve velinin GÖZÜNDEN de bakılıyor: taşıma öğretmen tarafını
  -- doğru tutup öğrenci tarafını bozabilirdi ve öğretmen bunu fark etmezdi.
  select 11, format('ogrenci-odev %s|%s|%s', x->>'baslik', x->>'gonderildi',
      x->'gonderim'->>'puan')
    from (select public.ogrenci_odevleri(public.ogrenci_jetonu()) as v) t,
         jsonb_array_elements(t.v->'odevler') x
  union all
  select 12, format('veli-mesaj %s', jsonb_array_length(v->'mesajlar'))
    from (select public.veli_paneli(public.veli_jetonu()) as v) t
) q
SQL
)

# Parmak izi sorgusu üç jetona ihtiyaç duyuyor; her çağrıda yeniden giriş
# yapmamak için küçük yardımcılar. Provaya özel, migration'lara girmiyor.
JETONLAR=$(cat <<'SQL'
create or replace function public.jeton() returns text language sql as
  $$ select (public.giris('Prova!2026'))->>'token' $$;
create or replace function public.ogrenci_jetonu() returns text language sql as
  $$ select (public.giris((select k.kod from public.giris_kodlari k
       join public.ogrenciler o on o.id = k.ogrenci_id
       where o.tur = 'okul' and k.rol = 'ogrenci' order by o.ad limit 1)))->>'token' $$;
create or replace function public.veli_jetonu() returns text language sql as
  $$ select (public.giris((select k.kod from public.giris_kodlari k
       join public.ogrenciler o on o.id = k.ogrenci_id
       where o.tur = 'okul' and k.rol = 'veli' order by o.ad limit 1)))->>'token' $$;
SQL
)

echo "==> 1. CANLI BENZERİ veritabanı — 0001–0032 (0033 YOK)"
kur "$CANLI" 0032
# 0033 gerçekten uygulanmadı mı: `ogretmenler` tablosu OLMAMALI. Bu satır
# olmasaydı, `kur` sınırı sessizce çalışmadığında prova hiçbir şey
# ölçmeden yeşil görünürdü.
n=$(psql_ -t -A -d "$CANLI" -c "select count(*) from information_schema.tables
     where table_schema='public' and table_name='ogretmenler'")
[ "$n" = "0" ] || { echo "    HATA: canlı taklidi 0033'lü kuruldu, prova anlamsız"; exit 1; }
echo "    0032 şeması doğrulandı (ogretmenler tablosu yok)"

psql_ -q -d "$CANLI" <<'SQL'
do $$
declare jt text; jo text; s1 uuid; s2 uuid; a uuid; b uuid; c uuid; oz uuid;
        o1 uuid; o2 uuid;
begin
  -- 0032 dünyası: PIN `ayarlar` tablosunda, öğretmen tablosu yok.
  update public.ayarlar set ogretmen_pin_hash =
    extensions.crypt('Prova!2026', extensions.gen_salt('bf', 10));
  jt := (public.giris('Prova!2026'))->>'token';

  -- `on conflict`: 0006 başlangıç verisi bazı sınıfları zaten kuruyor.
  -- Canlıda da öyle; prova o hâlin üstüne yazıyor.
  insert into public.siniflar (seviye, sube) values (9, 'A')
    on conflict (seviye, sube) do update set arsiv = false returning id into s1;
  insert into public.siniflar (seviye, sube) values (11, 'B')
    on conflict (seviye, sube) do update set arsiv = false returning id into s2;

  -- Türkçe karakter ve kesme işareti bilerek: taşıma sırasında bir yerde
  -- metin yeniden yazılırsa burada patlar.
  a  := (public.ogrenci_ekle(jt, 'Ayşe O''Brien Çağlar', 'okul', s1))->>'id';
  b  := (public.ogrenci_ekle(jt, 'Öğünç Şıklıoğlu', 'okul', s1))->>'id';
  c  := (public.ogrenci_ekle(jt, 'Mehmet Kaya', 'okul', s2))->>'id';
  oz := (public.ogrenci_ekle(jt, 'Zeynep Ünal', 'ozel', null))->>'id';

  o1 := (public.odev_olustur(jt, 'Üslü Sayılar "1. Test"', 'Açıklama: tırnak''lı',
      s1, 'test', (current_date + 5)::date, 3,
      '{"1":"A","2":"B","3":"C"}'::jsonb, 'odev/anahtar.pdf', 'odev/soru.pdf',
      true, 5::smallint, '{"1":"Üslü","2":"Üslü","3":"Köklü"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, o1);

  o2 := (public.odev_olustur(jt, 'Türev — açık uçlu', null,
      s2, 'acik', (current_date - 2)::date, null,
      null, null, 'odev/turev.pdf', false, null, null))->>'id';
  perform public.odev_yayinla(jt, o2);

  -- Gönderim + puan: konu analizi ve gelişim eğrisi dolsun.
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = a and rol = 'ogrenci')))->>'token';
  perform public.odev_gonder(jo, o1,
    'cozum/' || o1::text || '/' || a::text || '.jpg', '{"1":"A","2":"D","3":"C"}'::jsonb);

  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = b and rol = 'ogrenci')))->>'token';
  perform public.odev_gonder(jo, o1,
    'cozum/' || o1::text || '/' || b::text || '.jpg', '{"1":"A","2":"B","3":"B"}'::jsonb);

  -- İKİ AYRI YAZIŞMA (0025): öğretmen↔veli ve öğretmen↔öğrenci. 0033
  -- `mesajlar`a `ogretmen_id` ekliyor ve `okundu` anahtarını büyütüyor —
  -- ikisi de burada ölçülüyor.
  perform public.mesaj_gonder(jt, 'Ayşe''nin ödevi güzeldi.', a);
  perform public.ewalu_mesaj_yaz(jt, 50::smallint, 'Yarı yoldasın, kalanı birlikte.');

  -- Velinin CEVABI. `mesaj_gonder` rolü jetondan okuyor; veli jetonuyla
  -- çağrıldığında hedef zaten kendi öğrencisi, o yüzden öğrenci kimliği
  -- verilmiyor. Cevap ŞART: okunmamış sayacı ancak karşı taraf yazınca
  -- doluyor ve 0033 `okundu` birincil anahtarını büyütüyor — sayaç
  -- boşken bu değişiklik ölçülmeden geçerdi.
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = a and rol = 'veli')))->>'token';
  perform public.mesaj_gonder(jo, 'Teşekkür ederim hocam.');

  -- Özel ders: ders programı ve ÖDEME. 0033 bunları sahibe kilitliyor;
  -- sahibin kendi gözünden rakamlar aynı kalmalı.
  insert into public.dersler (ogrenci_id, zaman, mod, link) values
    (oz, now() + interval '2 days', 'online', 'https://ornek/ders'),
    (oz, now() - interval '5 days', 'yuzyuze', null);
  insert into public.odemeler (ogrenci_id, tutar, tarih, odendi) values
    (oz, 1500.50, current_date, false),
    (oz,  800.00, current_date - 30, true);
end $$;
SQL
echo "    2 sınıf, 4 öğrenci, 2 ödev, 2 gönderim, 2 yazışma, 2 ders, 2 ödeme"

echo "==> 2. Parmak izi ÖNCE (0032, taşımadan önce)"
psql_ -q -d "$CANLI" -c "$JETONLAR" >/dev/null
psql_ -t -A -d "$CANLI" -c "$PARMAK" > "$IS/once.txt"
[ -s "$IS/once.txt" ] || { echo "    HATA: parmak izi boş çıktı"; exit 1; }
echo "    $(wc -l < "$IS/once.txt") satır ölçüldü"

echo "==> 3. GERÇEK yedek alınıyor (disa_aktar, 0032 biçiminde)"
psql_ -t -A -d "$CANLI" -c \
  "select public.disa_aktar(public.jeton())" > "$IS/yedek32.json"
echo "    $(wc -c < "$IS/yedek32.json") bayt"

echo "==> 4. BOŞ yeni proje (0001–0032) + yedek geri yükleniyor"
kur "$YENI" 0032
python3 - "$KOK" "$IS" <<'PY'
import json, sys
kok, is_ = sys.argv[1], sys.argv[2]
sql = open(f'{kok}/supabase/geri-yukleme/geri-yukle.sql').read()
def yaz(ad, veri):
    s = sql.split('\n')
    h = [i for i, l in enumerate(s) if l.strip() == 'BURAYA-YAPISTIRIN'][0]
    s[h] = json.dumps(veri, ensure_ascii=False)
    open(ad, 'w').write('\n'.join(s).replace(
        'onayliyorum boolean := false;', 'onayliyorum boolean := true;'))
yaz(f'{is_}/geri32.sql', json.load(open(f'{is_}/yedek32.json')))
PY
psql_ -q -d "$YENI" -f "$IS/geri32.sql" 2>&1 | sed 's/^psql[^:]*: NOTICE:  /    /'

# Yedekte PIN YOK (bilinçli karar, felaket provasında ölçülü). Canlının
# durumunu taklit edebilmek için AYNI PIN yeniden kuruluyor — 0033'ün
# taşıması PIN'i buradan okuyacak.
psql_ -q -d "$YENI" -c "select public.pin_ayarla('Prova!2026')" >/dev/null
psql_ -q -d "$YENI" -c "$JETONLAR" >/dev/null

# Geri yükleme gerçekten canlının kopyasını üretti mi — 0033'ten ÖNCE
# ölçülüyor. Buradaki bir fark, sonraki ölçümün gerekçesini çürütürdü.
psql_ -t -A -d "$YENI" -c "$PARMAK" > "$IS/kopya.txt"
if ! diff -q "$IS/once.txt" "$IS/kopya.txt" >/dev/null; then
  echo "    HATA: geri yüklenen kopya canlıdan farklı (0033'ten ÖNCE)"
  diff "$IS/once.txt" "$IS/kopya.txt"; exit 1
fi
echo "    kopya canlıyla birebir aynı: OK"

echo "==> 5. 0033 ÇALIŞTIRILIYOR — provanın asıl ölçümü"
psql_ -d "$YENI" -f "$KOK/supabase/migrations/0033_ogretmen_kimligi.sql" \
  > "$IS/0033.log" 2>&1 || { echo "    HATA: 0033 dolu veritabanında ÇALIŞMADI"
                             tail -30 "$IS/0033.log"; exit 1; }
echo "    0033 dolu veritabanının üstünden temiz geçti"

echo "==> 6. Taşıma ne yaptı"
psql_ -t -A -d "$YENI" <<'SQL' | sed 's/^/    /'
select 'ogretmen sayısı = ' || count(*) from public.ogretmenler
union all select 'sahip = ' || ad from public.ogretmenler where yonetici
union all select 'sahibin PIN''i taşındı = ' || (pin_hash is not null)::text
  from public.ogretmenler where yonetici
union all select 'sahibe bağlı sınıf = ' || count(*) from public.ogretmen_siniflari
union all select 'sahipsiz ödev = ' || count(*) from public.odevler where ogretmen_id is null
union all select 'sahipsiz mesaj = ' || count(*) from public.mesajlar where ogretmen_id is null
union all select 'sahipsiz ders = ' || count(*) from public.dersler where ogretmen_id is null
union all select 'sahipsiz ödeme = ' || count(*) from public.odemeler where ogretmen_id is null
union all select 'ekleyeni olmayan öğrenci = ' || count(*) from public.ogrenciler where ekleyen_id is null
union all select 'ayarlar.ogretmen_pin_hash sütunu = ' || count(*) from information_schema.columns
  where table_schema='public' and table_name='ayarlar' and column_name='ogretmen_pin_hash';
SQL

echo "==> 7. Parmak izi SONRA — AYNI PIN, aynı uçlar"
# `jeton()` aynı PIN'i kullanıyor: "öğretmen aynı PIN'le girmeye devam
# ediyor" iddiası burada ölçülüyor, varsayılmıyor.
psql_ -t -A -d "$YENI" -c "$PARMAK" > "$IS/sonra.txt"
if ! diff -q "$IS/once.txt" "$IS/sonra.txt" >/dev/null; then
  echo ""
  echo "    HATA: TAŞIMADAN SONRA ÖĞRETMENİN GÖRDÜĞÜ SAYILAR DEĞİŞTİ"
  diff "$IS/once.txt" "$IS/sonra.txt"
  exit 1
fi
echo "    ÖNCE ile SONRA birebir aynı — $(wc -l < "$IS/once.txt") satır: OK"

echo "==> 8. Taşımadan sonra sistem ÇALIŞIYOR mu (yeni yetkilerle)"
psql_ -d "$YENI" <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR' | sed 's/^psql[^:]*: NOTICE:  /    /'
do $$
declare jt text; v jsonb; yid uuid;
begin
  jt := (public.giris('Prova!2026'))->>'token';

  -- Sahip, taşımadan gelen kimliğiyle SAHİP görünüyor mu.
  v := public.ben_kimim(jt);
  if not (v->>'sahip')::boolean then raise exception 'taşınan öğretmen sahip değil'; end if;
  if (v->>'vekalet')::boolean then raise exception 'vekâlet açık görünüyor'; end if;

  -- Yeni yönetim uçları taşınmış sahiple çalışıyor mu.
  if jsonb_array_length(public.ogretmenler_listesi(jt)) <> 1 then
    raise exception 'öğretmen listesi 1 satır olmalıydı';
  end if;

  -- Yeni öğretmen eklenebiliyor ve sahibin verisini GÖREMİYOR.
  yid := (public.ogretmen_ekle(jt, 'Ahmet Yılmaz', 'Yeni!2026'))->>'id';
  declare jy text; begin
    jy := (public.giris('Yeni!2026'))->>'token';
    if jy is null then raise exception 'yeni öğretmen giremedi'; end if;
    if jsonb_array_length(public.odevler_listesi(jy, null, false)) <> 0 then
      raise exception 'YENİ ÖĞRETMEN SAHİBİN ÖDEVLERİNİ GÖRÜYOR';
    end if;
    if (public.ogretmen_panosu(jy)->>'ogrenci_sayisi')::int <> 0 then
      raise exception 'YENİ ÖĞRETMEN SAHİBİN ÖĞRENCİLERİNİ GÖRÜYOR';
    end if;
    begin
      perform public.ozel_ders_detay(jy,
        (select id from public.ogrenciler where tur='ozel' limit 1));
      raise exception 'YENİ ÖĞRETMEN ÖZEL DERSİ GÖRÜYOR';
    exception when insufficient_privilege then null;
    end;
  end;

  raise notice 'ben_kimim, öğretmen yönetimi, kapsam yalıtımı ve özel ders kilidi: OK';
end $$;
SQL

echo "==> 9. YEDEK ZİNCİRİ — 0033 sonrası yedek, boş bir 0033 projesine"
psql_ -t -A -d "$YENI" -c "select public.disa_aktar(public.jeton())" > "$IS/yedek33.json"
kur "$Y33" 9999
python3 - "$KOK" "$IS" <<'PY'
import json, sys
kok, is_ = sys.argv[1], sys.argv[2]
sql = open(f'{kok}/supabase/geri-yukleme/geri-yukle.sql').read()
def yaz(ad, veri):
    s = sql.split('\n')
    h = [i for i, l in enumerate(s) if l.strip() == 'BURAYA-YAPISTIRIN'][0]
    s[h] = json.dumps(veri, ensure_ascii=False)
    open(ad, 'w').write('\n'.join(s).replace(
        'onayliyorum boolean := false;', 'onayliyorum boolean := true;'))
yaz(f'{is_}/geri33.sql', json.load(open(f'{is_}/yedek33.json')))
yaz(f'{is_}/geri32-uzerine33.sql', json.load(open(f'{is_}/yedek32.json')))
PY

# YEDEK ZİNCİRİ KOPMAMALI. Bu blok "not" düşmüyor, ÖLÇÜYOR: 0033'ten
# sonra alınan yedek boş bir projeye geri yüklenemiyorsa öğretmenin tek
# güvencesi yok demektir ve prova düşmelidir.
if ! psql_ -q -d "$Y33" -f "$IS/geri33.sql" 2>"$IS/h33.txt" | sed 's/^psql[^:]*: NOTICE:  /    /'; then
  echo "    HATA: 0033 YEDEĞİ GERİ YÜKLENEMİYOR — yedek zinciri kopuk"
  grep -m3 'ERROR\|DETAIL' "$IS/h33.txt" | sed 's/^/      /'
  exit 1
fi
# Kadro geri geldi mi — satırlar geldiği hâlde kadro gelmezse öğretmen
# meslektaşlarını elle yeniden kurmak zorunda kalırdı.
psql_ -t -A -d "$Y33" <<'SQL' | sed 's/^/    /'
select 'geri gelen öğretmen = ' || count(*) from public.ogretmenler
union all select 'sahip = ' || ad from public.ogretmenler where yonetici
union all select 'sınıf bağı = ' || count(*) from public.ogretmen_siniflari;
SQL
# PIN yedekte YOK (bilinçli karar): herkes yeniden belirliyor. Ölçülüyor —
# hash'in sessizce yedeğe sızması ciddi bir kusur olurdu.
n=$(psql_ -t -A -d "$Y33" -c "select count(*) from public.ogretmenler where pin_hash is not null")
[ "$n" = "0" ] || { echo "    HATA: yedekten PIN hash'i geldi ($n satır)"; exit 1; }
python3 - "$IS" <<'PY'
import json, sys
d = json.load(open(f'{sys.argv[1]}/yedek33.json'))
for g in d.get('ogretmenler', []):
    assert 'pin_hash' not in g, 'YEDEKTE PIN HASH VAR — sızıntı'
print(f"    yedekte {len(d.get('ogretmenler', []))} öğretmen, hiçbirinde pin_hash yok: OK")
PY
psql_ -q -d "$Y33" -c "select public.pin_ayarla('Prova!2026')" >/dev/null
psql_ -q -d "$Y33" -c "$JETONLAR" >/dev/null
psql_ -t -A -d "$Y33" -c "$PARMAK" > "$IS/y33.txt"
if ! diff -q "$IS/once.txt" "$IS/y33.txt" >/dev/null; then
  echo "    HATA: geri yüklenen 0033 projesi canlıdan farklı"
  diff "$IS/once.txt" "$IS/y33.txt"; exit 1
fi
echo "    0033 yedeği geri yüklendi, sayılar canlıyla birebir aynı: OK"

echo "==> 10. YEDEK ZİNCİRİ — 0033 ÖNCESİ yedek, 0033'lü projeye"
# ÖĞRETMENİN BUGÜN ELİNDE DURAN DOSYA. 0033 çalıştırıldıktan sonra o
# dosya işe yaramaz hâle gelseydi, tek güvencesi kaybolurdu — üstelik
# bunu ancak felaket günü öğrenirdi. `geri-yukle.sql` kadrosuz dosyayı
# tek öğretmenli sisteme çeviriyor; ölçülen şey o.
kur "$Y33" 9999
if ! psql_ -q -d "$Y33" -f "$IS/geri32-uzerine33.sql" 2>"$IS/h32.txt" \
     | sed 's/^psql[^:]*: NOTICE:  /    /'; then
  echo "    HATA: 0033 ÖNCESİ YEDEK 0033'LÜ PROJEYE YÜKLENEMEDİ"
  grep -m3 'ERROR\|DETAIL' "$IS/h32.txt" | sed 's/^/      /'
  exit 1
fi
# Yüklendi demek yetmez: satırlar sahibe damgalandı mı, öğretmen onları
# ekranında GÖRÜYOR mu. `not null` sütunlar kısıt hatası vermeden
# geçseydi bile, kapsam yanlışsa ödevler ekranda görünmezdi.
psql_ -q -d "$Y33" -c "select public.pin_ayarla('Prova!2026')" >/dev/null
psql_ -q -d "$Y33" -c "$JETONLAR" >/dev/null
psql_ -t -A -d "$Y33" -c "$PARMAK" > "$IS/y32.txt"
if ! diff -q "$IS/once.txt" "$IS/y32.txt" >/dev/null; then
  echo "    HATA: eski yedek yüklendi ama öğretmenin gördüğü sayılar farklı"
  diff "$IS/once.txt" "$IS/y32.txt"; exit 1
fi
n=$(psql_ -t -A -d "$Y33" -c "select count(*) from public.ogretmenler where yonetici")
[ "$n" = "1" ] || { echo "    HATA: tam bir sahip kurulmalıydı, $n var"; exit 1; }
echo "    eski yedek tek öğretmenli sisteme yüklendi, sayılar birebir aynı: OK"

echo ""
echo "TAŞIMA PROVASI GEÇTİ — dolu 0032 veritabanının üstünden 0033 geçti,"
echo "öğretmenin gördüğü sayılar birebir korundu, aynı PIN çalışmaya devam etti,"
echo "ve yedek zinciri her iki yönde de kopmadı."
