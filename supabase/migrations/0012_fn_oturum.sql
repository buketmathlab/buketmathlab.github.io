-- SEKİZ · Adım 12 — Oturum üretimi ve çözümü

-- Jeton üretir, özetini saklar ve jetonun kendisini bir kez döndürür.
create or replace function sekiz_oturum_ac(
  p_rol text, p_ogrenci_id uuid, p_parmak_izi text
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_jeton text := encode(gen_random_bytes(24), 'hex');
  -- Öğretmen oturumu kısa (12 saat): yönetici yetkisi uzun süre açık kalmasın.
  -- Öğrenci/veli oturumu uzun (30 gün): telefonda her seferinde kod girmesinler.
  v_sure interval := case when p_rol = 'ogretmen' then interval '12 hours'
                          else interval '30 days' end;
begin
  insert into oturumlar (jeton_hash, rol, ogrenci_id, parmak_izi, bitis)
  values (sekiz_ozet(v_jeton), p_rol, p_ogrenci_id,
          nullif(btrim(coalesce(p_parmak_izi, '')), ''), now() + v_sure);
  return v_jeton;
end;
$$;

-- Jetonu doğrular ve oturum satırını döndürür. Geçersizse hata verir.
create or replace function sekiz_oturum(p_jeton text)
returns oturumlar
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar;
begin
  select * into v_oturum
  from oturumlar
  where jeton_hash = sekiz_ozet(p_jeton) and not iptal and bitis > now();

  if not found then
    raise exception 'Oturumunuz sona ermiş. Yeniden giriş yapın.'
      using errcode = '28000';
  end if;

  -- Yazma yükünü azaltmak için son kullanım 5 dakikada bir tazelenir.
  if v_oturum.son_kullanim < now() - interval '5 minutes' then
    update oturumlar set son_kullanim = now() where id = v_oturum.id;
  end if;

  return v_oturum;
end;
$$;

-- Yalnız öğretmen çağırabilsin diye kapı: rol öğretmen değilse hata verir.
create or replace function sekiz_ogretmen(p_jeton text)
returns oturumlar
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_oturum(p_jeton);
begin
  if v_oturum.rol <> 'ogretmen' then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;
  return v_oturum;
end;
$$;

revoke all on function sekiz_oturum_ac(text, uuid, text) from public, anon, authenticated;
revoke all on function sekiz_oturum(text) from public, anon, authenticated;
revoke all on function sekiz_ogretmen(text) from public, anon, authenticated;

-- Doğrulama: üç fonksiyon da kurulmuş olmalı (sonuç 3 gelmeli).
select count(*) as kurulan_fonksiyon
from pg_proc
where proname in ('sekiz_oturum_ac', 'sekiz_oturum', 'sekiz_ogretmen');
