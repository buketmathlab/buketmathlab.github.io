-- SEKİZ · Adım 14 — Öğretmen girişi, PIN değiştirme, çıkış

-- PIN düz metin saklanmaz: ayarlar tablosunda bcrypt hash'i durur ve
-- karşılaştırma veritabanı içinde yapılır (crypt).
--
-- Başarısız giriş hata FIRLATMAZ, sonuç nesnesi döndürür — RAISE EXCEPTION
-- çağrıyı geri alır ve başarısız deneme kaydını da siler; o zaman oran
-- sınırlama çalışmaz. Ayrıntı için 13. adımdaki nota bakın.
create or replace function giris_pin(p_pin text, p_parmak_izi text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_kimlik constant text := 'ogretmen';
  v_kilit integer;
  v_hash text;
  v_jeton text;
begin
  v_kilit := sekiz_kilit_saniye(v_kimlik, p_parmak_izi);
  if v_kilit > 0 then
    -- Kilitliyken deneme KAYDEDİLMEZ: aksi hâlde saldırgan kilidi süresiz uzatır
    -- ve öğretmen bir daha giremez.
    return jsonb_build_object(
      'hata', 'Çok fazla hatalı deneme yapıldı. ' || ceil(v_kilit / 60.0) ||
              ' dakika sonra tekrar deneyin.',
      'kilit_saniye', v_kilit);
  end if;

  select deger into v_hash from ayarlar where anahtar = 'ogretmen_pin_hash';

  if v_hash is null then
    return jsonb_build_object(
      'hata', 'Öğretmen PIN''i henüz belirlenmemiş. Kurulum adımlarını tamamlayın.');
  end if;

  if v_hash <> crypt(coalesce(p_pin, ''), v_hash) then
    perform sekiz_deneme_yaz(v_kimlik, p_parmak_izi, false);
    return jsonb_build_object('hata', 'PIN doğru değil.');
  end if;

  perform sekiz_deneme_yaz(v_kimlik, p_parmak_izi, true);
  v_jeton := sekiz_oturum_ac('ogretmen', null, p_parmak_izi);

  return jsonb_build_object('jeton', v_jeton, 'rol', 'ogretmen');
end;
$$;

-- PIN değiştirme: eski PIN doğrulanır, yeni PIN en az 8 hane olmalıdır.
-- Değişiklikten sonra diğer tüm öğretmen oturumları kapatılır.
create or replace function pin_degistir(p_jeton text, p_eski text, p_yeni text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_ogretmen(p_jeton);
  v_hash text;
begin
  if length(coalesce(p_yeni, '')) < 8 then
    raise exception 'Yeni PIN en az 8 haneli olmalı.' using errcode = '22023';
  end if;

  select deger into v_hash from ayarlar where anahtar = 'ogretmen_pin_hash';
  if v_hash is null or v_hash <> crypt(coalesce(p_eski, ''), v_hash) then
    raise exception 'Mevcut PIN doğru değil.' using errcode = '28000';
  end if;

  update ayarlar
  set deger = crypt(p_yeni, gen_salt('bf', 10)), guncelleme = now()
  where anahtar = 'ogretmen_pin_hash';

  update oturumlar set iptal = true
  where rol = 'ogretmen' and id <> v_oturum.id and not iptal;

  return jsonb_build_object('sonuc', 'PIN değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
end;
$$;

create or replace function cikis(p_jeton text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update oturumlar set iptal = true where jeton_hash = sekiz_ozet(p_jeton);
  return jsonb_build_object('sonuc', 'Çıkış yapıldı.');
end;
$$;

grant execute on function giris_pin(text, text) to anon;
grant execute on function pin_degistir(text, text, text) to anon;
grant execute on function cikis(text) to anon;
