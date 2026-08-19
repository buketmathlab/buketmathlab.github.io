-- SEKİZ — 0026: öğrenci ve veli kendi konu karnesini görsün
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0026_kendi_karnem.sql

create or replace function public.kendi_karnem(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr      date := (now() at time zone 'Europe/Istanbul')::date;
  o             record;
  v_ogrenci_id  uuid;
  v_ad          text;
  v_sinif_id    uuid;
  v_sinif_ad    text;
  v_odev_sayisi integer;
begin
  select * into o from public._oturum(p_token);

  -- ÖĞRETMEN BURAYA GİRMİYOR. Onun ucu `konu_karnesi` ve orada sınıf ya da
  -- öğrenci seçebiliyor; burada seçilecek bir şey yok.
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu bölüm öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  if o.ogrenci_id is null then
    raise exception 'Geçersiz oturum.' using errcode = '42501';
  end if;

  v_ogrenci_id := o.ogrenci_id;

  select g.ad, g.sinif_id into v_ad, v_sinif_id
    from public.ogrenciler g where g.id = v_ogrenci_id;
  if v_ad is null then
    raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
  end if;

  select s.ad into v_sinif_ad from public.siniflar s where s.id = v_sinif_id;

  -- 0013 VE 0023 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    -- `mevcut` YOK (0023'te var). Sınıfın kaç kişi olduğu bu ekrana ait
    -- değil; kıyasın en küçük tohumu bile gönderilmiyor.
    'kapsam', jsonb_build_object('ad', v_ad, 'sinif', v_sinif_ad),

    -- "Kaç ödev üzerinden konuşuyoruz" — iki konu arasındaki farkı
    -- yorumlayabilmek için gereken tek bağlam sayısı.
    'odev_sayisi', v_odev_sayisi,

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden (0023 ile aynı gerekçe)
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama da aynı: en çok eksik olan konu başta. Arayüz bu sırayı
    -- bozmuyor — bozsaydı "en zayıf konu" iddiası ekrandan ekrana
    -- değişebilirdi.
    -- -----------------------------------------------------------------
    'konular', coalesce((
      select jsonb_agg(jsonb_build_object(
               'konu', t.konu, 'toplam', t.toplam,
               'dogru', t.dogru, 'yanlis', t.yanlis, 'bos', t.bos)
             order by (t.toplam - t.dogru) desc, t.konu)
      from (
        select e->>'konu' as konu,
               sum((e->>'toplam')::integer)::integer as toplam,
               sum((e->>'dogru')::integer)::integer  as dogru,
               sum((e->>'yanlis')::integer)::integer as yanlis,
               sum((e->>'bos')::integer)::integer    as bos
        from public.odevler d
        join public.gonderimler g on g.odev_id = d.id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          -- TEK BAĞ: kendi gönderimleri. Başka öğrencinin cevabı bu
          -- toplama hiçbir koşulda giremez.
          and g.ogrenci_id = v_ogrenci_id
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR: konu eşlemesi yok ama puanı var, ve
    -- "dönem boyunca nereye gidiyorum" sorusunun cevabından açık uçlu
    -- ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir.
    --
    -- `gonderen` VE `mevcut` YOK (0023'te var). Onlar sınıf bilgisi;
    -- burada "kaç kişiden kaçı gönderdi" demek kıyas kapısını açardı.
    -- `Gelisim` bileşeni `kapsam='ogrenci'` iken o alanları zaten
    -- çizmiyor (ölçüldü), yani ekranda bir eksiklik oluşmuyor.
    --
    -- HİÇBİR EĞİLİM İDDİASI YOK: ne "yükseliyor" ne "düşüyor". Üç
    -- noktadan yön çıkarmak ölçemeyeceğim bir iddia olurdu.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger
        from public.gonderimler g
        where g.odev_id = d.id and g.ogrenci_id = v_ogrenci_id
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.kendi_karnem(text) from public, anon, authenticated;
grant execute on function public.kendi_karnem(text) to anon, authenticated;

do $$
begin
  if to_regprocedure('public.kendi_karnem(text)') is null then
    raise exception 'kendi_karnem oluşmadı.';
  end if;

  -- KİMLİK ALAN BİR SÜRÜMÜ OLMAMALI. Biri ileride `p_ogrenci_id` ekleyip
  -- eskisini bırakırsa, "başkasının karnesi istenemez" güvencesi yapıdan
  -- denetime düşer ve 0007 tuzağı buraya da girer.
  if to_regprocedure('public.kendi_karnem(text, uuid)') is not null then
    raise exception 'kendi_karnem kimlik alan bir imzayla da duruyor.';
  end if;

  -- Bu uç konuyu KENDİ hesaplamıyor; `_konu_analizi`'yi çağırıyor. Yardımcı
  -- kaybolursa karne sessizce boşalırdı — puanlamayla analiz arasındaki tek
  -- kural garantisi o fonksiyon (0020).
  if to_regprocedure('public._konu_analizi(jsonb, jsonb, jsonb, integer)') is null then
    raise exception '_konu_analizi yok; karne puanlamayla çelişirdi.';
  end if;

  -- Öğretmenin ucu yerinde mi: test iki ucun AYNI sayıyı verdiğini ölçüyor.
  if to_regprocedure('public.konu_karnesi(text, uuid, uuid)') is null then
    raise exception 'konu_karnesi kayboldu; karşılaştırma yapılamazdı.';
  end if;

  raise notice 'Kendi konu karnem hazır: öğrenci ve veli görebiliyor.';
end $$;
