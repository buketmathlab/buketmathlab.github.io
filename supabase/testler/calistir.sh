#!/usr/bin/env bash
# =============================================================================
# SEKİZ — migration ve güvenlik testlerini yerel PostgreSQL üzerinde çalıştırır.
#
# Supabase'e dokunmadan, sıfırdan bir veritabanı kurar, tüm migration'ları
# uygular ve davranış testlerini çalıştırır. Herhangi bir test başarısız
# olursa script sıfırdan farklı bir kodla çıkar.
#
# Kullanım:  supabase/testler/calistir.sh
# Gerekli:   postgresql-16 (initdb, pg_ctl, psql)
# =============================================================================
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PORT=${PORT:-5433}
SOCK=${SOCK:-/tmp}
DB=sekiz_test
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

psql_() { psql -h "$SOCK" -p "$PORT" -U sekiz -v ON_ERROR_STOP=1 "$@"; }

echo "==> Veritabanı sıfırlanıyor"
psql_ -d postgres -qc "drop database if exists $DB;" -c "create database $DB;"

echo "==> Supabase ortamı taklit ediliyor (roller + extensions + storage)"
# ÖNEMLİ: Supabase'de pgcrypto `extensions` şemasında kuruludur, `public`'te
# DEĞİL. İlk taklidimizde eklentiyi public'e kurmuştuk ve bu yüzden
# "function digest(text, unknown) does not exist" hatası yerelde yakalanmadı,
# ancak canlıda ortaya çıktı. Taklit artık gerçeğe sadık.
psql_ -q -d "$DB" <<'SQL'
-- `service_role` de taklit edilmeli. Yoksa Edge Function'ın yetkisi
-- yerelde hiç ölçülmez — nitekim ölçülmediği için, 0005'in service_role'ün
-- EXECUTE hakkını PUBLIC üzerinden düşürdüğü CANLIDA anlaşıldı.
-- Taklit gerçeğe ne kadar yakınsa, hata o kadar erken yakalanır.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
SQL

echo "==> Migration'lar uygulanıyor"
for f in "$KOK"/supabase/migrations/*.sql; do
  printf '    %-42s' "$(basename "$f")"
  psql_ -q -d "$DB" -f "$f" >/dev/null
  echo "OK"
done

echo "==> Davranış ve güvenlik testleri"
psql_ -d "$DB" -f "$KOK/supabase/testler/guvenlik_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Ödev PDF testleri (0007)"
psql_ -d "$DB" -f "$KOK/supabase/testler/odev_pdf_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Ödev düzenleme testleri (0008)"
psql_ -d "$DB" -f "$KOK/supabase/testler/odev_duzenleme_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Öğrenci yükleme testleri (0009)"
psql_ -d "$DB" -f "$KOK/supabase/testler/ogrenci_yukleme_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Geç teslim testleri (0010)"
psql_ -d "$DB" -f "$KOK/supabase/testler/gec_teslim_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Gönderim takibi testleri (0011)"
psql_ -d "$DB" -f "$KOK/supabase/testler/gonderim_takibi_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Özel ders sınıfı testleri (0012)"
psql_ -d "$DB" -f "$KOK/supabase/testler/ozel_ders_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Öğrenci istatistik testleri (0013)"
psql_ -d "$DB" -f "$KOK/supabase/testler/ogrenci_istatistik_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Pano detay testleri (0015)"
psql_ -d "$DB" -f "$KOK/supabase/testler/pano_detay_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Arşiv testleri (0016)"
psql_ -d "$DB" -f "$KOK/supabase/testler/arsiv_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Kodlar testleri (0017 kaldırıldı, 0018)"
psql_ -d "$DB" -f "$KOK/supabase/testler/kodlar_testleri.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo "==> Anon izolasyon testleri"
psql_ -d "$DB" -f "$KOK/supabase/testler/anon_izolasyon.sql" 2>&1 \
  | sed 's/psql:[^ ]*sql:[0-9]*: //' | grep -E 'NOTICE|ERROR' | sed 's/^NOTICE:  //'

echo ""
echo "TÜM MIGRATION VE TESTLER BAŞARILI"
