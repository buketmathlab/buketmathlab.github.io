-- SEKİZ · Adım 13 — Öğrenci ve veli girişi
--
-- ÖNEMLİ TASARIM NOTU: Başarısız giriş "hata fırlatarak" bitirilmez, sonuç
-- nesnesi döndürülerek bitirilir. Sebebi Postgres'in davranışı: RAISE EXCEPTION
-- çağrının tamamını geri alır ve o çağrıda yazılan "başarısız deneme" kaydı da
-- silinir — yani hata fırlatan bir giriş fonksiyonunda oran sınırlama HİÇ
-- çalışmaz. Bu, denemede yakalanan gerçek bir hataydı.
-- Kural: kimlik doğrulama sonucu {"hata": "..."} ile döner; istemci bunu hataya çevirir.

create or replace function giris_kod(p_kod text, p_parmak_izi text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_kod text := upper(btrim(coalesce(p_kod, '')));
  v_kimlik text;
  v_kilit integer;
  v_ogrenci ogrenciler;
  v_rol text;
  v_jeton text;
begin
  if length(v_kod) < 4 then
    return jsonb_build_object('hata', 'Kodu eksik girdin. Kartındaki kodun tamamını yaz.');
  end if;

  v_kimlik := sekiz_ozet(v_kod);
  v_kilit := sekiz_kilit_saniye(v_kimlik, p_parmak_izi);
  if v_kilit > 0 then
    -- Kilitliyken deneme KAYDEDİLMEZ: aksi hâlde saldırgan kilidi süresiz uzatır.
    return jsonb_build_object(
      'hata', 'Çok fazla hatalı deneme yaptın. ' || ceil(v_kilit / 60.0) ||
              ' dakika sonra tekrar dene.',
      'kilit_saniye', v_kilit);
  end if;

  select * into v_ogrenci from ogrenciler
  where upper(ogrenci_kodu) = v_kod and aktif;
  v_rol := 'ogrenci';

  if not found then
    select * into v_ogrenci from ogrenciler
    where upper(veli_kodu) = v_kod and aktif;
    v_rol := 'veli';
  end if;

  if not found then
    perform sekiz_deneme_yaz(v_kimlik, p_parmak_izi, false);
    return jsonb_build_object(
      'hata', 'Bu kod bulunamadı. Kartındaki kodu kontrol et, sonra tekrar dene.');
  end if;

  perform sekiz_deneme_yaz(v_kimlik, p_parmak_izi, true);
  v_jeton := sekiz_oturum_ac(v_rol, v_ogrenci.id, p_parmak_izi);

  return jsonb_build_object(
    'jeton', v_jeton,
    'rol', v_rol,
    'ogrenci_id', v_ogrenci.id,
    'ad', v_ogrenci.ad,
    'ogrenci_no', v_ogrenci.ogrenci_no,
    -- Okul öğrencisinde ödeme/online ders sekmesi hiç olmayacağı için tip gerekli.
    'tip', v_ogrenci.tip
  );
end;
$$;

grant execute on function giris_kod(text, text) to anon;
