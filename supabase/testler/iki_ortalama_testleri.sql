-- =============================================================================
-- SEKİZ — 0080 İKİ ORTALAMA TESTLERİ
--
-- Öğretmenin isteği: öğrenci listesinde "yaptığı ödevlerin ortalaması" ve
-- "tüm ödevlerin ortalaması (yapılmayan 0)" ayrı ayrı; öğrenci ve veli de
-- ikisini görsün. Puanlanmamış gönderim puan verilene kadar İKİSİNE de
-- girmez (öğretmenin kararı).
--
-- DÜNYA ELLE HESAPLANABİLİR. Ada'nın süresi dolmuş dört ödevi:
--   Ö1 — gönderdi, puan 80
--   Ö2 — gönderdi, puan 60
--   Ö3 — GÖNDERMEDİ                      → tüm ödevlerde 0
--   Ö4 — gönderdi, PUANI YOK (bekliyor)  → hiçbir ortalamada yok
--   Ö5 — süresi DEVAM EDİYOR             → hiçbir sayıda yok
--
--   yaptığı ödevler: (80 + 60) / 2      = 70
--   tüm ödevler:     (80 + 60 + 0) / 3  = 46,67  (karnede 46,7)
--   ödev 4 · yapılan 3 · yapılmayan 1 · puan bekleyen 1
--
-- İZOLASYON: kendi sınıflarını kuruyor (12-OA, 12-OB).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jo text; jv text;
  v_ben uuid;
  s_a uuid; s_b uuid;
  ada uuid; can uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid;
  v jsonb; satir jsonb; karne jsonb;
  patladi boolean;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('IkiOrt!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('IkiOrt!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (12, 'OA')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_a;
  insert into public.siniflar (seviye, sube) values (12, 'OB')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_b;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (v_ben, s_a) on conflict do nothing;
  -- 12-OB öğretmenin sınıfı DEĞİL (yetki grubu).
  delete from public.ogretmen_siniflari where sinif_id = s_b;

  -- Tekrar koşulabilsin diye dünya önce temizleniyor.
  delete from public.odevler    where sinif_id in (s_a, s_b);
  delete from public.ogrenciler where sinif_id in (s_a, s_b);

  ada := (public.ogrenci_ekle(jt, 'Ada Ikiort', 'okul', s_a, '1'))->>'id';
  can := (public.ogrenci_ekle(jt, 'Can Ikiort', 'okul', s_a, '2'))->>'id';

  o1 := (public.odev_olustur(jt, 'Iki Ort Bir',  null, s_a, 'test', current_date + 30, 2,
          '{"1":"A","2":"A"}'::jsonb))->>'id';
  o2 := (public.odev_olustur(jt, 'Iki Ort Iki',  null, s_a, 'test', current_date + 30, 2,
          '{"1":"A","2":"A"}'::jsonb))->>'id';
  o3 := (public.odev_olustur(jt, 'Iki Ort Uc',   null, s_a, 'test', current_date + 30, 2,
          '{"1":"A","2":"A"}'::jsonb))->>'id';
  o4 := (public.odev_olustur(jt, 'Iki Ort Dort', null, s_a, 'test', current_date + 30, 2,
          '{"1":"A","2":"A"}'::jsonb))->>'id';
  o5 := (public.odev_olustur(jt, 'Iki Ort Bes',  null, s_a, 'test', current_date + 30, 2,
          '{"1":"A","2":"A"}'::jsonb))->>'id';
  perform public.odev_yayinla(jt, o1);
  perform public.odev_yayinla(jt, o2);
  perform public.odev_yayinla(jt, o3);
  perform public.odev_yayinla(jt, o4);
  perform public.odev_yayinla(jt, o5);

  -- Gönderimler doğrudan: test edilen şey teslim kuralı değil ORTALAMA.
  insert into public.gonderimler (odev_id, ogrenci_id, foto_yolu, puan)
  values (o1, ada, 'cozum/' || o1 || '/' || ada || '.jpg', 80),
         (o2, ada, 'cozum/' || o2 || '/' || ada || '.jpg', 60),
         (o4, ada, 'cozum/' || o4 || '/' || ada || '.jpg', null);

  update public.odevler set son_tarih = current_date - 3 where id in (o1, o2, o3, o4);
  -- Ö5 GELECEKTE kalıyor.

  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = ada and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = ada and rol = 'veli')))->>'token';
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Test Velisi');

  -- ---------------------------------------------------------------------------
  -- 1. ÖĞRETMEN LİSTESİ — iki ortalama elle hesaplananla aynı
  -- ---------------------------------------------------------------------------
  v := public.sinif_ogrenci_ozeti(jt, s_a);
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ada::text;

  if (satir->>'yapilan_ortalama')::numeric is distinct from 70.00 then
    raise exception '1a: yaptığı ödevler ortalaması %, 70.00 olmalı', satir->>'yapilan_ortalama';
  end if;
  if (satir->>'ortalama')::numeric is distinct from 46.67 then
    raise exception '1b: tüm ödevler ortalaması %, 46.67 olmalı (puanlanmamış 0 sayılmamalı)',
      satir->>'ortalama';
  end if;
  raise notice '1 OK — yaptığı ödevler 70, tüm ödevler 46,67 (puan bekleyen hesapta yok)';

  -- ---------------------------------------------------------------------------
  -- 2. SAYILAR — süresi devam eden ödev hiçbir sayıda yok
  -- ---------------------------------------------------------------------------
  if (satir->>'odev_sayisi')::int <> 4 or (satir->>'yapilan')::int <> 3
     or (satir->>'yapilmayan')::int <> 1 or (satir->>'puan_bekleyen')::int <> 1 then
    raise exception '2: sayılar % / % / % / %, 4 / 3 / 1 / 1 olmalı',
      satir->>'odev_sayisi', satir->>'yapilan', satir->>'yapilmayan', satir->>'puan_bekleyen';
  end if;
  raise notice '2 OK — 4 ödev · 3 yapıldı · 1 yapılmadı · 1 puan bekliyor (Ö5 yok)';

  -- Hiç göndermeyen Can: tüm ödevler 0, yaptığı ödevler YOK (null).
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = can::text;
  if (satir->>'ortalama')::numeric is distinct from 0.00
     or satir->'yapilan_ortalama' <> 'null'::jsonb then
    raise exception '2b: Can % / %, 0.00 / null olmalı', satir->>'ortalama', satir->'yapilan_ortalama';
  end if;
  raise notice '2b OK — hiç göndermeyen: tüm ödevler 0, yaptığı ödevler boş';

  -- ---------------------------------------------------------------------------
  -- 3. ÖĞRENCİ VE VELİ KARNESİ — aynı sayılar, 1 basamak
  -- ---------------------------------------------------------------------------
  karne := public.kendi_karnem(jo);
  if (karne->>'genel_ortalama')::numeric is distinct from 70.0
     or (karne->>'tum_ortalama')::numeric is distinct from 46.7
     or (karne->>'odev_sayisi')::int <> 4
     or (karne->>'yapilmayan')::int <> 1
     or (karne->>'puan_bekleyen')::int <> 1 then
    raise exception '3a: karne % / % / % / % / %', karne->>'genel_ortalama',
      karne->>'tum_ortalama', karne->>'odev_sayisi', karne->>'yapilmayan', karne->>'puan_bekleyen';
  end if;
  if public.kendi_karnem(jv)::text <> karne::text then
    raise exception '3b: veli karnesi öğrencininkinden farklı';
  end if;
  raise notice '3 OK — öğrenci ve veli karnesi: 70,0 · 46,7 · 1 yapılmadı · 1 puan bekliyor';

  -- ---------------------------------------------------------------------------
  -- 4. PUAN VERİLİNCE bekleyen hesaba girer
  --   yaptığı: (80 + 60 + 100) / 3 = 80 · tüm: (80 + 60 + 0 + 100) / 4 = 60
  -- ---------------------------------------------------------------------------
  update public.gonderimler set ogretmen_puan = 100
   where odev_id = o4 and ogrenci_id = ada;
  v := public.sinif_ogrenci_ozeti(jt, s_a);
  select e into satir from jsonb_array_elements(v->'ogrenciler') e
   where e->>'id' = ada::text;
  if (satir->>'yapilan_ortalama')::numeric is distinct from 80.00
     or (satir->>'ortalama')::numeric is distinct from 60.00
     or (satir->>'puan_bekleyen')::int <> 0 then
    raise exception '4: puan sonrası % / % / %, 80 / 60 / 0 olmalı',
      satir->>'yapilan_ortalama', satir->>'ortalama', satir->>'puan_bekleyen';
  end if;
  raise notice '4 OK — öğretmen puanı verilince: yaptığı 80, tüm 60, bekleyen 0';

  -- ---------------------------------------------------------------------------
  -- 5. YETKİ
  -- ---------------------------------------------------------------------------
  patladi := false;
  begin
    perform public.sinif_ogrenci_ozeti(jt, s_b);
  exception when sqlstate '42501' then patladi := true;
  end;
  if not patladi then raise exception '5a: başka sınıfın listesi açıldı'; end if;

  if has_function_privilege('anon', 'public._ogrenci_ortalamalari(uuid, uuid, date)', 'execute')
     or has_function_privilege('authenticated', 'public._ogrenci_ortalamalari(uuid, uuid, date)', 'execute') then
    raise exception '5b: yardımcı dışarıya açık';
  end if;

  -- Karnede başka öğrencinin ya da sınıfın ortalaması yok: anahtarlar sabit.
  if replace(replace(karne::text, 'genel_ortalama', ''), 'tum_ortalama', '') ilike '%ortalama%' then
    raise exception '5c: karnede kıyas ortalaması geçiyor';
  end if;
  raise notice '5 OK — başka sınıf 42501, yardımcı kapalı, karnede kıyas yok';

  -- ---------------------------------------------------------------------------
  -- 6. DENEME HESABI listede yok
  -- ---------------------------------------------------------------------------
  update public.ogrenciler set deneme = true where id = can;
  v := public.sinif_ogrenci_ozeti(jt, s_a);
  if exists (select 1 from jsonb_array_elements(v->'ogrenciler') e where e->>'id' = can::text) then
    raise exception '6: deneme hesabı listede';
  end if;
  update public.ogrenciler set deneme = false where id = can;
  raise notice '6 OK — deneme hesabı listede yok';

  raise notice '';
  raise notice 'İKİ ORTALAMA TESTLERİ: 6 GRUP GEÇTİ';
end $$;
