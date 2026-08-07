-- SEKİZ · Adım 21 — Dosya deposu
--
-- Kova ÖZEL (private) kurulur: public bucket kullanılmaz. Adres tahmin edilse bile
-- dosya açılmaz. Dosyalara erişim Faz 2'de imzalı ve süreli adreslerle olacaktır.
--
-- Sunucu tarafı boyut ve tür doğrulaması burada yapılır: istemcideki sıkıştırma
-- atlatılsa bile 3 MB üstü veya beklenmeyen türde dosya depoya giremez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'odev-dosyalari', 'odev-dosyalari', false, 3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects üzerinde RLS zaten açıktır ve bu kovaya politika TANIMLANMAZ.
-- Politika yoksa tarayıcıdaki anahtarla ne okuma ne yazma mümkündür.

-- Kimlik sorgusu: uygulama açılışında "ben kimim" der, oturumu tazeler.
create or replace function ben_kimim(p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_oturum(p_jeton);
  v_ogrenci ogrenciler;
begin
  if v_oturum.rol = 'ogretmen' then
    return jsonb_build_object('rol', 'ogretmen', 'ad', 'Buket Topuzoğlu');
  end if;

  select * into v_ogrenci from ogrenciler where id = v_oturum.ogrenci_id and aktif;
  if not found then
    raise exception 'Oturumunuz sona ermiş. Yeniden giriş yapın.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'rol', v_oturum.rol,
    'ogrenci_id', v_ogrenci.id,
    'ad', v_ogrenci.ad,
    'ogrenci_no', v_ogrenci.ogrenci_no,
    'tip', v_ogrenci.tip
  );
end;
$$;

grant execute on function ben_kimim(text) to anon;

-- Doğrulama: kova özel (public = false) görünmeli.
select id, public, file_size_limit from storage.buckets where id = 'odev-dosyalari';
