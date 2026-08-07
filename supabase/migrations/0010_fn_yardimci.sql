-- SEKİZ · Adım 10 — İç yardımcı fonksiyonlar
-- Bunlar tarayıcıya AÇILMAZ (anon'a EXECUTE verilmez); yalnız diğer fonksiyonlar çağırır.

-- Karışması kolay harfler (I, l, O, 0, 1) alfabede yoktur: kod telefonla okunur.
create or replace function sekiz_kod_uret()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_alfabe constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_kod text := '';
  i integer;
begin
  for i in 1..8 loop
    v_kod := v_kod || substr(v_alfabe, 1 + floor(random() * length(v_alfabe))::int, 1);
    if i = 4 then
      v_kod := v_kod || '-';
    end if;
  end loop;
  return v_kod;                                   -- örn. "K7M2-P4RT"
end;
$$;

-- SHA-256 özeti. Kod ve jetonlar veritabanında düz metin yerine özetle karşılaştırılır.
create or replace function sekiz_ozet(p_metin text)
returns text
language sql
immutable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(digest(coalesce(p_metin, ''), 'sha256'), 'hex');
$$;

revoke all on function sekiz_kod_uret() from public, anon, authenticated;
revoke all on function sekiz_ozet(text) from public, anon, authenticated;

-- Doğrulama: rastgele bir kod ve sabit bir özet döner.
select sekiz_kod_uret() as ornek_kod, sekiz_ozet('deneme') as ornek_ozet;
