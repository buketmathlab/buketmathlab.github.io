-- SEKİZ — 0023: konu karnesi (dönem geneli konu dökümü ve gelişim)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0023_konu_karnesi.sql

create or replace function public.konu_karnesi(
  p_token text,
  p_sinif_id uuid default null,
  p_ogrenci_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr     date := (now() at time zone 'Europe/Istanbul')::date;
  v_sinif_id   uuid;
  v_ad         text;
  v_sinif_ad   text;
  v_tur        text;
  v_mevcut     integer;
  v_odev_sayisi integer;
  o            public.ogrenciler;
  s            public.siniflar;
begin
  perform public._ogretmen(p_token);

  -- İKİSİNDEN TAM OLARAK BİRİ. Sessizce birini seçmek, öğretmenin baktığını
  -- sandığı şeyle ekranda gösterileni ayırırdı; ikisini birden kabul etmek
  -- de "hangisi kazandı" sorusunu doğururdu.
  if (p_sinif_id is null) = (p_ogrenci_id is null) then
    raise exception 'Sınıf ya da öğrenci: ikisinden tam olarak biri verilmeli.'
      using errcode = '22023';
  end if;

  if p_ogrenci_id is not null then
    select * into o from public.ogrenciler where id = p_ogrenci_id;
    if not found then
      raise exception 'Öğrenci bulunamadı.' using errcode = 'P0002';
    end if;
    v_sinif_id := o.sinif_id;
    v_ad       := o.ad;
    v_tur      := 'ogrenci';
    v_mevcut   := 1;
    select ad into v_sinif_ad from public.siniflar where id = v_sinif_id;
  else
    select * into s from public.siniflar where id = p_sinif_id;
    if not found then
      raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
    end if;
    v_sinif_id := s.id;
    v_ad       := s.ad;
    v_sinif_ad := s.ad;
    v_tur      := 'sinif';
    select count(*)::integer into v_mevcut
      from public.ogrenciler g where g.sinif_id = v_sinif_id and g.aktif;
  end if;

  -- 0013 İLE BİREBİR AYNI ÖLÇÜT.
  select count(*)::integer into v_odev_sayisi
  from public.odevler d
  where d.sinif_id = v_sinif_id and d.yayinda and d.son_tarih < bugun_tr;

  return jsonb_build_object(
    'kapsam', jsonb_build_object(
      'tur', v_tur, 'ad', v_ad, 'sinif', v_sinif_ad, 'mevcut', v_mevcut
    ),

    -- Öğretmen "kaç ödev üzerinden konuşuyoruz" sorusunu görmeden hiçbir
    -- ortalamayı yorumlayamaz (0013'teki aynı gerekçe).
    'odev_sayisi', v_odev_sayisi,

    -- -----------------------------------------------------------------
    -- KONU DÖKÜMÜ — yalnız TEST ödevlerinden
    --
    -- Açık uçlu ödevin konu eşlemesi yok: anahtarı olmayan bir ödevde
    -- `_konu_analizi` her soruyu "boş" sayardı ve döküm, öğretmenin hiç
    -- sormadığı bir soruya uydurma bir cevap verirdi.
    --
    -- Sıralama `konu_ozeti` ile aynı: en çok eksik olan konu başta.
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
        join public.ogrenciler  k on k.id = g.ogrenci_id
        cross join lateral jsonb_array_elements(
          public._konu_analizi(d.konular, d.cevap_anahtari, g.cevaplar, d.soru_sayisi)
        ) e
        where d.sinif_id = v_sinif_id
          and d.yayinda
          and d.son_tarih < bugun_tr
          and d.tur = 'test'
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
        group by e->>'konu'
      ) t
    ), '[]'::jsonb),

    -- -----------------------------------------------------------------
    -- GELİŞİM — ödev ödev, kronolojik
    --
    -- AÇIK UÇLU ÖDEV BURADA VAR. Konu eşlemesi yok ama puanı var, ve
    -- "bu öğrenci dönem boyunca nereye gidiyor" sorusunun cevabından
    -- açık uçlu ödevleri çıkarmak resmin yarısını silerdi.
    --
    -- `coalesce(ogretmen_puan, puan)` — arayüzün ve 0013'ün hesabıyla
    -- aynı: öğretmenin verdiği puan sistemin hesapladığını ezer.
    --
    -- GÖNDERİLMEYEN ÖDEV 0 DEĞİL, BOŞ (`deger: null`). Sıfır yazmak
    -- "sıfır aldı" demektir; göndermemek başka bir şeydir ve ekranın
    -- ikisini karıştırmaması gerekiyor. Kaç kişinin gönderdiği ayrı
    -- alanda duruyor, yani bilgi kaybolmuyor.
    -- -----------------------------------------------------------------
    'gelisim', coalesce((
      select jsonb_agg(jsonb_build_object(
               'odev', d.baslik,
               'tarih', d.son_tarih,
               'tur', d.tur,
               'deger', i.deger,
               'gonderen', i.gonderen,
               'mevcut', v_mevcut)
             order by d.son_tarih, d.baslik)
      from public.odevler d
      cross join lateral (
        select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1) as deger,
               count(g.id)::integer as gonderen
        from public.gonderimler g
        join public.ogrenciler k on k.id = g.ogrenci_id
        where g.odev_id = d.id
          and case when p_ogrenci_id is not null
                   then k.id = p_ogrenci_id
                   else k.sinif_id = v_sinif_id and k.aktif end
      ) i
      where d.sinif_id = v_sinif_id
        and d.yayinda
        and d.son_tarih < bugun_tr
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.konu_karnesi(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.konu_karnesi(text, uuid, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.konu_karnesi(text, uuid, uuid)') is null then
    raise exception 'konu_karnesi oluşmadı.';
  end if;

  -- Bu uç konuyu KENDİ hesaplamıyor; `_konu_analizi`'yi çağırıyor. Yardımcı
  -- kaybolursa ya da imzası değişirse karne sessizce boşalırdı — puanlamayla
  -- analiz arasındaki tek kural garantisi o fonksiyon (0020).
  if to_regprocedure('public._konu_analizi(jsonb, jsonb, jsonb, integer)') is null then
    raise exception '_konu_analizi yok; konu karnesi puanlamayla çelişirdi.';
  end if;

  -- Sayıların karşılaştırıldığı iki uç da yerinde mi (test bunlara dayanıyor)
  if to_regprocedure('public.sinif_ogrencileri(text, uuid)') is null
     or to_regprocedure('public.odev_gonderimleri(text, uuid)') is null then
    raise exception 'Karşılaştırma uçlarından biri kayboldu.';
  end if;

  raise notice 'Konu karnesi hazır.';
end $$;
