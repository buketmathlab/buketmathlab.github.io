-- SEKİZ · Adım 15 — Sınıf yönetimi

-- Sıralama doğal olmalı: 9A, 9B, 10A… Alfabetik sıralama "10A"yı "9A"nın önüne
-- koyar; bu yüzden önce kademe (sayısal), sonra ad'a göre sıralanır.
create or replace function siniflar_listele(p_jeton text, p_arsivli boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
begin
  return coalesce((
    select jsonb_agg(satir order by satir->>'kademe', satir->>'ad')
    from (
      select jsonb_build_object(
               'id', s.id, 'ad', s.ad, 'kademe', s.kademe,
               'aciklama', s.aciklama, 'arsivli', s.arsivli,
               'ogrenci_sayisi', (select count(*) from ogrenciler o
                                  where o.sinif_id = s.id and o.aktif)
             ) as satir
      from siniflar s
      where s.arsivli = coalesce(p_arsivli, false)
      order by s.kademe, s.ad
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function sinif_ekle(
  p_jeton text, p_ad text, p_kademe smallint, p_aciklama text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_ad text := btrim(coalesce(p_ad, ''));
  v_id uuid;
begin
  if v_ad = '' then
    raise exception 'Sınıf adı boş olamaz.' using errcode = '22023';
  end if;
  if exists (select 1 from siniflar where lower(ad) = lower(v_ad)) then
    raise exception '"%" adında bir sınıf zaten var.', v_ad using errcode = '23505';
  end if;

  insert into siniflar (ad, kademe, aciklama)
  values (v_ad, p_kademe, nullif(btrim(coalesce(p_aciklama, '')), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'sonuc', v_ad || ' oluşturuldu.');
end;
$$;

create or replace function sinif_guncelle(
  p_jeton text, p_id uuid, p_ad text, p_kademe smallint, p_aciklama text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
begin
  update siniflar
  set ad = btrim(p_ad), kademe = p_kademe,
      aciklama = nullif(btrim(coalesce(p_aciklama, '')), '')
  where id = p_id;

  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('sonuc', 'Sınıf güncellendi.');
end;
$$;

-- Arşivleme: dönem bitince listelerden gizlenir, verisi durur.
create or replace function sinif_arsivle(p_jeton text, p_id uuid, p_arsivli boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
begin
  update siniflar set arsivli = p_arsivli where id = p_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('sonuc',
    case when p_arsivli then 'Sınıf arşivlendi.' else 'Sınıf arşivden çıkarıldı.' end);
end;
$$;

grant execute on function siniflar_listele(text, boolean) to anon;
grant execute on function sinif_ekle(text, text, smallint, text) to anon;
grant execute on function sinif_guncelle(text, uuid, text, smallint, text) to anon;
grant execute on function sinif_arsivle(text, uuid, boolean) to anon;
