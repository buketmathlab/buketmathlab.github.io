-- SEKİZ · Adım 20 — Çözüm gönderme
--
-- Uygulanan kurallar (hepsi sunucuda, istemciye güvenilmez):
--  1. Yalnız ÖĞRENCİ gönderir; veli gönderemez.
--  2. Süre dolduysa gönderim reddedilir — GEÇ TESLİM YOKTUR.
--  3. Çözüm kağıdı fotoğrafı zorunludur.
--  4. Bir ödev bir kez gönderilir; ikinci gönderim puan yükseltmek için kullanılamaz.
--  5. Testte puan sunucuda hesaplanır; anahtar istemciye hiç gitmez.

create or replace function odev_gonder(
  p_jeton text, p_odev_id uuid, p_foto_yol text,
  p_cevaplar jsonb default null, p_foto_bayt integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_oturum oturumlar := sekiz_oturum(p_jeton);
  v_odev odevler;
  v_dogru integer := 0;
  v_yanlis integer := 0;
  v_bos integer := 0;
  v_puan numeric(5,2);
  v_no text;
  v_verilen text;
  v_beklenen text;
  v_ogrenci ogrenciler;
begin
  if v_oturum.rol <> 'ogrenci' then
    raise exception 'Çözümü yalnız öğrenci gönderebilir.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_foto_yol, '')), '') is null then
    raise exception 'Çözüm kağıdının fotoğrafı olmadan gönderemezsin. Fotoğraf ekle, sonra gönder.'
      using errcode = '22023';
  end if;

  select * into v_odev from odevler where id = p_odev_id and yayinda;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  if v_odev.son_tarih <= now() then
    raise exception 'Bu ödevin süresi doldu. Teslim tarihinden sonra gönderim yapılamaz.'
      using errcode = '22023';
  end if;

  if exists (select 1 from gonderimler
             where odev_id = p_odev_id and ogrenci_id = v_oturum.ogrenci_id) then
    raise exception 'Bu ödevi zaten gönderdin. Bir ödev yalnız bir kez gönderilir.'
      using errcode = '23505';
  end if;

  -- Test ödevlerinde puanlama sunucuda yapılır.
  if v_odev.tur = 'test' and v_odev.anahtar is not null then
    for v_no in select jsonb_object_keys(v_odev.anahtar) loop
      v_beklenen := upper(btrim(v_odev.anahtar ->> v_no));
      v_verilen  := upper(btrim(coalesce(p_cevaplar ->> v_no, '')));
      if v_verilen = '' then
        v_bos := v_bos + 1;
      elsif v_verilen = v_beklenen then
        v_dogru := v_dogru + 1;
      else
        v_yanlis := v_yanlis + 1;
      end if;
    end loop;

    if (v_dogru + v_yanlis + v_bos) > 0 then
      v_puan := round(v_dogru * 100.0 / (v_dogru + v_yanlis + v_bos), 2);
    end if;
  end if;

  insert into gonderimler (odev_id, ogrenci_id, cevaplar, foto_yol, foto_bayt,
                           puan, dogru_sayisi, yanlis_sayisi, bos_sayisi, onaylandi)
  values (p_odev_id, v_oturum.ogrenci_id, p_cevaplar, btrim(p_foto_yol), p_foto_bayt,
          v_puan, v_dogru, v_yanlis, v_bos, v_odev.tur = 'test');

  -- Veliye bildirim düşer.
  select * into v_ogrenci from ogrenciler where id = v_oturum.ogrenci_id;
  insert into bildirimler (hedef, ogrenci_id, tur, metin, odev_id)
  values ('veli', v_oturum.ogrenci_id, 'gonderildi',
          v_ogrenci.ad || ' "' || v_odev.baslik || '" ödevini gönderdi.' ||
          case when v_puan is not null then ' Puan: ' || v_puan else '' end,
          p_odev_id);

  return jsonb_build_object(
    'sonuc', 'Çözümün gönderildi.',
    'puan', v_puan,
    'dogru', v_dogru, 'yanlis', v_yanlis, 'bos', v_bos,
    'anahtar_acildi', true
  );
end;
$$;

grant execute on function odev_gonder(text, uuid, text, jsonb, integer) to anon;
