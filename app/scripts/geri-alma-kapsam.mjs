/**
 * 0033 KAPSAM DENETİMİNİN GERİ ALMA KANITI.
 *
 * `ogretmen_kapsami_testleri.sql` ilk koşuda geçti — ama ilk koşuda geçen
 * bir test hiçbir şey kanıtlamaz. Burada her kapsam süzgeci ve her sahiplik
 * kontrolü TEK TEK bozuluyor ve testin KIRILDIĞI gösteriliyor. Kırılmayan
 * bir ölçüm bir şey ölçmüyor demektir.
 *
 * Bu turda özellikle önemli: kapsam kuralları, dört öğretmenin birbirinin
 * öğrencisini, notunu, veli yazışmasını ve ÖZEL DERS ÖDEMESİNİ görmemesini
 * sağlayan tek şey. Bir süzgeç sessizce etkisiz kalırsa, testin geçmesi
 * bize yanlış bir güven verirdi.
 *
 * MIGRATION KIRILIRSA DURUYOR — 0030 turunda öğrenilen tuzak: uygulanmayan
 * bir yama, testin ESKİ (sağlam) fonksiyonları ölçmesine yol açar ve her
 * yama "yakalandı" görünür, oysa hiçbiri gerçekten koşmamıştır.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KOK = resolve(import.meta.dirname, '..', '..');
const MIG = resolve(KOK, 'supabase/migrations/0033_ogretmen_kimligi.sql');
const TEST = resolve(KOK, 'supabase/testler/ogretmen_kapsami_testleri.sql');

const SOCK = process.env.SOCK ?? '/tmp/sekiz-sock';
const PORT = process.env.PORT ?? '5433';
const DB = 'sekiz_geri_alma';

const ASIL = readFileSync(MIG, 'utf-8');
const geriAl = () => writeFileSync(MIG, ASIL);

const psql = (args, opts = {}) =>
  execFileSync('psql', ['-h', SOCK, '-p', PORT, '-U', 'sekiz', '-v', 'ON_ERROR_STOP=1', ...args], {
    stdio: 'pipe',
    ...opts,
  });

/** Sıfırdan veritabanı kurup bütün migration'ları uygular. */
function kur() {
  psql(['-d', 'postgres', '-qc', `drop database if exists ${DB};`, '-c', `create database ${DB};`]);
  psql(['-q', '-d', DB, '-c', `
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
    alter table storage.objects enable row level security;`]);
  const dosyalar = execFileSync('ls', [resolve(KOK, 'supabase/migrations')], { encoding: 'utf-8' })
    .trim().split('\n').filter((d) => d.endsWith('.sql')).sort();
  for (const d of dosyalar) psql(['-q', '-d', DB, '-f', resolve(KOK, 'supabase/migrations', d)]);
}

let kusur = 0;

/**
 * @param {string} ad  Yamanın ne bozduğu
 * @param {string} eski  Migration'daki birebir dize
 * @param {string} yeni  Yerine konacak (kapsamı etkisizleştiren) hâli
 */
function dene(ad, eski, yeni) {
  geriAl();
  const kaynak = readFileSync(MIG, 'utf-8');
  if (!kaynak.includes(eski)) {
    kusur++;
    console.log(`  ✗ ${ad} — YAMA ÇAPASI BULUNAMADI`);
    return;
  }
  if (kaynak.split(eski).length - 1 !== 1) {
    kusur++;
    console.log(`  ✗ ${ad} — çapa birden çok kez geçiyor, hangisi bozuldu belirsiz`);
    return;
  }
  writeFileSync(MIG, kaynak.replace(eski, yeni));

  try {
    kur();
  } catch {
    // Migration kırıldı: testin ESKİ fonksiyonları ölçmesi anlamsız olurdu.
    kusur++;
    console.log(`  ✗ ${ad} — MIGRATION KIRILDI, ölçüm yapılmadı`);
    geriAl();
    return;
  }

  let kirildi = false;
  try {
    psql(['-d', DB, '-f', TEST]);
  } catch {
    kirildi = true;
  }
  console.log(kirildi ? `  ✓ ${ad} — test kırıldı` : `  ✗ ${ad} — TEST GEÇTİ, ölçüm boş`);
  if (!kirildi) kusur++;
  geriAl();
}

console.log('0033 KAPSAM GERİ ALMA KANITI\n');

// --- Sahiplik yardımcıları ---------------------------------------------------
dene(
  'Özel ders sahiplik dalı herkese açılırsa',
  `      when o.tur = 'ozel' then exists (
        select 1 from public.ogretmenler g
        where g.id = p_ogretmen_id and g.yonetici
      )`,
  `      when o.tur = 'ozel' then true`,
);

dene(
  'Ödev sahiplik kontrolü etkisizleşirse',
  `    raise exception 'Bu ödev size ait değil.' using errcode = '42501';`,
  `    null;`,
);

dene(
  'Öğrenci sahiplik kontrolü etkisizleşirse',
  `    raise exception 'Bu öğrenci sizin sınıflarınızda değil.' using errcode = '42501';`,
  `    null;`,
);

// --- Listeleme süzgeçleri ----------------------------------------------------
dene(
  'Öğrenci listesi süzgeci kalkarsa',
  `    and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');`,
  `    and not public._sinif_arsivde(o.sinif_id)
    and (p_sinif_id is null or o.sinif_id = p_sinif_id)
    and (p_arama is null or o.ad ilike '%' || p_arama || '%');`,
);

dene(
  'Ödev listesi süzgeci kalkarsa',
  `    where d.ogretmen_id = v_ogretmen
      and not s.arsiv`,
  `    where not s.arsiv`,
);

dene(
  'Sınıf listesi süzgeci kalkarsa',
  `    where (p_arsiv or not s.arsiv)
      and public._ogretmenin_sinifi(v_ogretmen, s.id)`,
  `    where (p_arsiv or not s.arsiv)`,
);

dene(
  'Veli listesi öğretmen süzgeci kalkarsa',
  `      and public._ogretmenin_ogrencisi(v_ogretmen, o.id)
  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb),
    'gruplar', coalesce((`,
  `  )
  select jsonb_build_object(
    'toplam_okunmamis', (select coalesce(sum(okunmamis), 0)::integer from ozet),
    'yanit_bekleyen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', ogrenci_id, 'ad', ad, 'sinif', sinif,
               'okunmamis', okunmamis, 'son_mesaj', son_mesaj)
             order by son_mesaj)
      from ozet where okunmamis > 0
    ), '[]'::jsonb),
    'gruplar', coalesce((`,
);

dene(
  'Panodaki öğrenci sayısı süzgeci kalkarsa',
  `                        where o.aktif and not public._sinif_arsivde(o.sinif_id)
                          and public._ogretmenin_ogrencisi(v_ogretmen, o.id)),`,
  `                        where o.aktif and not public._sinif_arsivde(o.sinif_id)),`,
);

// --- Sahiplik (yönetici) kilitleri -------------------------------------------
dene(
  'Özel ders detayı öğretmene açılırsa',
  `  -- ÖZEL DERS TAMAMEN SAHİPTE: ders programı ve ödemeler
  -- meslektaşa hiçbir uçtan görünmüyor.
  perform public._yonetici(p_token);`,
  `  perform public._ogretmen(p_token);`,
);

dene(
  'Yedek indirme öğretmene açılırsa',
  `  v_id := public._yonetici(p_token);
  perform public._denetim('disa_aktarildi', null, null, public._aktor(v_id));`,
  `  v_id := public._ogretmen(p_token);
  perform public._denetim('disa_aktarildi', null, null, public._aktor(v_id));`,
);

dene(
  'Öğretmen listesi herkese açılırsa',
  `declare
  v_sahip uuid;
begin
  v_sahip := public._yonetici(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,`,
  `declare
  v_sahip uuid;
begin
  v_sahip := public._ogretmen(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,`,
);

dene(
  'Vekâlet ucu herkese açılırsa',
  `  v_sahip := public._yonetici(p_token);

  select * into hedef from public.ogretmenler where id = p_ogretmen_id;`,
  `  v_sahip := public._ogretmen(p_token);

  select * into hedef from public.ogretmenler where id = p_ogretmen_id;`,
);

geriAl();
try {
  kur();
} catch {
  console.log('\n✗ GERİ ALMA SONRASI MIGRATION KIRIK — dosya bozuk kalmış olabilir');
  process.exit(1);
}
if (readFileSync(MIG, 'utf-8') !== ASIL) {
  console.log('\n✗ Migration dosyası aslına dönmedi');
  process.exit(1);
}

console.log(`\nGERİ ALMA KANITI — ${kusur === 0 ? 'hepsi yakalandı' : `${kusur} ölçüm BOŞ`}`);
console.log('Migration dosyası aslına birebir döndü.');
process.exit(kusur === 0 ? 0 : 1);
