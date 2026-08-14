-- =============================================================================
-- SEKİZ — ÖZEL DERS TAKİBİ TESTLERİ (0021)
--
-- İki asıl soru:
--
--   1. TAM DÖNGÜ ÇALIŞIYOR MU? Bugüne kadar imkânsızdı: ödeme ekleniyor
--      ama id'si okunamadığı için "ödendi" işaretlenemiyor, silinemiyordu.
--
--   2. ÖĞRENCİ PARAYI GÖRÜYOR MU? Öğretmenin kuralı: "Ödeme detaylarını
--      öğrenci görmesin." Bu, cevap anahtarı sınırıyla (Kural 6) aynı
--      sertlikte ölçülüyor — alan adı da, değerin kendisi de.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text; jo text; jv text;
  v_ozel uuid; v_okul uuid; v_s uuid;
  v jsonb; e jsonb; s text;
  d_id uuid; p1 uuid; p2 uuid;
  n integer;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Ozel!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Ozel!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (5, 'Z')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;

  v_ozel := (public.ogrenci_ekle(jt, 'Zeynep Özelli', 'ozel', null))->>'id';
  v_okul := (public.ogrenci_ekle(jt, 'Okan Okullu', 'okul', v_s))->>'id';

  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ozel and rol = 'ogrenci')))->>'token';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_ozel and rol = 'veli')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — TAM DÖNGÜ: DERS ekle → id'yi OKU → sil
  --
  -- Bugüne kadar ikinci adım imkânsızdı; `ders_sil(p_id)` çağrılamıyordu.
  -- ---------------------------------------------------------------------------
  perform public.ders_ekle(jt, v_ozel, now() + interval '3 days', 'online',
                           'https://ornek/ders');
  perform public.ders_ekle(jt, v_ozel, now() - interval '5 days', 'yuzyuze', null);

  v := public.ozel_ders_detay(jt, v_ozel);
  if jsonb_array_length(v->'dersler') <> 2 then
    raise exception '1a: iki ders bekleniyordu: %', v->'dersler';
  end if;

  -- Geçmiş ve gelecek birlikte, `gecti` doğru
  select e2 into e from jsonb_array_elements(v->'dersler') e2
   where (e2->>'gecti')::boolean;
  if e is null then raise exception '1b: geçmiş ders dönmedi'; end if;
  select e2 into e from jsonb_array_elements(v->'dersler') e2
   where not (e2->>'gecti')::boolean;
  if e is null or e->>'mod' <> 'online' then
    raise exception '1c: gelecek ders ya da modu yanlış: %', e;
  end if;

  -- id ile SİL — bu satır bu turdan önce yazılamazdı
  d_id := (e->>'id')::uuid;
  perform public.ders_sil(jt, d_id);
  v := public.ozel_ders_detay(jt, v_ozel);
  if jsonb_array_length(v->'dersler') <> 1 then
    raise exception '1d: ders silinmedi: %', v->'dersler';
  end if;

  raise notice '1 OK — ders ekle → id oku → sil döngüsü çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 2 — TAM DÖNGÜ: ÖDEME ekle → oku → "ödendi" çevir → sil
  -- ---------------------------------------------------------------------------
  perform public.odeme_ekle(jt, v_ozel, 1500.50, current_date);
  perform public.odeme_ekle(jt, v_ozel, 800.00, current_date - 30);

  v := public.ozel_ders_detay(jt, v_ozel);
  if jsonb_array_length(v->'odemeler') <> 2 then
    raise exception '2a: iki ödeme bekleniyordu';
  end if;
  -- Yeni ödeme varsayılan olarak ÖDENMEMİŞ olmalı
  select e2 into e from jsonb_array_elements(v->'odemeler') e2
   where (e2->>'tutar')::numeric = 1500.50;
  if (e->>'odendi')::boolean then
    raise exception '2b: yeni ödeme ödendi olarak açıldı';
  end if;

  p1 := (e->>'id')::uuid;
  perform public.odeme_degistir(jt, p1);

  v := public.ozel_ders_detay(jt, v_ozel);
  select e2 into e from jsonb_array_elements(v->'odemeler') e2 where (e2->>'id')::uuid = p1;
  if not (e->>'odendi')::boolean then
    raise exception '2c: ödendi işareti konmadı';
  end if;

  raise notice '2 OK — ödeme ekle → oku → ödendi çevir döngüsü çalışıyor';

  -- ---------------------------------------------------------------------------
  -- 3 — ÖZET: kalan borç doğru
  --
  -- Elle doğrulanabilir: 1500.50 ödendi + 800.00 ödenmedi.
  -- ---------------------------------------------------------------------------
  if (v->'ozet'->>'toplam')::numeric <> 2300.50 then
    raise exception '3a: toplam yanlış: %', v->'ozet';
  end if;
  if (v->'ozet'->>'odenen')::numeric <> 1500.50 then
    raise exception '3b: ödenen yanlış: %', v->'ozet';
  end if;
  if (v->'ozet'->>'kalan')::numeric <> 800.00 then
    raise exception '3c: KALAN yanlış: %', v->'ozet';
  end if;
  if (v->'ozet'->>'ders_toplam')::int <> 1
     or (v->'ozet'->>'gelecek_ders')::int <> 0 then
    raise exception '3d: ders sayıları yanlış: %', v->'ozet';
  end if;

  raise notice '3 OK — toplam/ödenen/kalan ve ders sayıları doğru';

  -- ---------------------------------------------------------------------------
  -- 4 — ÖĞRENCİ PARAYI GÖRMÜYOR (ÖĞRETMENİN KURALI)
  --
  -- En sert durum: özel ders öğrencisi, ödenmemiş 800 TL borcu var, dersi
  -- var. Cevap anahtarı sınırındaki (Kural 6) desenin aynısı — alan adı da,
  -- değerin kendisi de ayrı ayrı aranıyor.
  -- ---------------------------------------------------------------------------
  v := public.ogrenci_odevleri(jo);
  s := v::text;

  if s ~* '"(tutar|odendi|odemeler|odeme)"' then
    raise exception '4a: öğrencinin yanıtında ödeme ALANI var: %', s;
  end if;
  if s like '%1500.5%' or s like '%800.0%' or s like '%2300.5%' then
    raise exception '4b: öğrencinin yanıtında ödeme TUTARI geçiyor';
  end if;
  -- Öğrenci `ozel_ders_detay`'ı da çağıramamalı
  begin
    perform public.ozel_ders_detay(jo, v_ozel);
    raise exception '4c: ÖĞRENCİ özel ders detayını okuyabildi';
  exception when sqlstate '42501' then null;
  end;
  -- Kendi kimliğiyle de olmaz
  begin
    perform public.ozel_ders_detay(jo, v_okul);
    raise exception '4d: öğrenci başkasının detayını okuyabildi';
  exception when sqlstate '42501' then null;
  end;

  -- DENETİMİN İŞE YARADIĞI KANITI: aynı tutar ÖĞRETMENİN ucunda BULUNMALI.
  -- Bulunmasaydı yukarıdaki aramalar boş bir metinde arıyor olurdu ve
  -- test hiçbir şey ölçmezdi.
  if public.ozel_ders_detay(jt, v_ozel)::text not like '%1500.5%' then
    raise exception '4e: denetim işe yaramıyor — tutar öğretmende de yok';
  end if;

  raise notice '4 OK — öğrenci ne alan adı ne tutar görüyor; öğretmen görüyor';

  -- ---------------------------------------------------------------------------
  -- 5 — VELİ: ödemeleri görüyor ama öğretmenin ucunu çağıramıyor
  --
  -- Veli parayı GÖRMELİ (ödeyen o), ama yönetememeli.
  -- ---------------------------------------------------------------------------
  v := public.veli_paneli(jv);
  if jsonb_array_length(v->'odemeler') <> 2 then
    raise exception '5a: veli ödemelerini görmüyor: %', v->'odemeler';
  end if;
  -- Velinin yanıtında id YOK: silme/değiştirme yolu açılmasın
  if v::text ~ '"odemeler":\s*\[\s*\{[^}]*"id"' then
    raise exception '5b: veliye ödeme id''si gidiyor';
  end if;
  begin
    perform public.ozel_ders_detay(jv, v_ozel);
    raise exception '5c: VELİ özel ders detayını okuyabildi';
  exception when sqlstate '42501' then null;
  end;

  raise notice '5 OK — veli ödemeyi görüyor, id almıyor, öğretmen ucunu çağıramıyor';

  -- ---------------------------------------------------------------------------
  -- 6 — OKUL ÖĞRENCİSİ: ders/ödeme eklenemez, detay boş döner
  -- ---------------------------------------------------------------------------
  begin
    perform public.odeme_ekle(jt, v_okul, 100, current_date);
    raise exception '6a: okul öğrencisine ödeme eklendi';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.ders_ekle(jt, v_okul, now() + interval '1 day');
    raise exception '6b: okul öğrencisine ders eklendi';
  exception when sqlstate '42501' then null;
  end;

  v := public.ozel_ders_detay(jt, v_okul);
  if jsonb_array_length(v->'dersler') <> 0
     or jsonb_array_length(v->'odemeler') <> 0
     or (v->'ozet'->>'kalan')::numeric <> 0 then
    raise exception '6c: okul öğrencisinde boş dönmedi: %', v;
  end if;

  raise notice '6 OK — okul öğrencisinde ders/ödeme yok, çökme de yok';

  -- ---------------------------------------------------------------------------
  -- 7 — DENETİM İZİ ve SİLME
  -- ---------------------------------------------------------------------------
  select count(*) into n from public.denetim_izi
   where islem in ('odeme_eklendi', 'odeme_durumu_degisti');
  if n < 3 then raise exception '7a: ödeme işlemleri denetim izine yazılmadı (%)', n; end if;

  select (e2->>'id')::uuid into p2 from jsonb_array_elements(
    (public.ozel_ders_detay(jt, v_ozel))->'odemeler') e2
   where (e2->>'tutar')::numeric = 800.00;
  perform public.odeme_sil(jt, p2);

  v := public.ozel_ders_detay(jt, v_ozel);
  if jsonb_array_length(v->'odemeler') <> 1 then
    raise exception '7b: ödeme silinmedi';
  end if;
  if (v->'ozet'->>'kalan')::numeric <> 0 then
    raise exception '7c: silmeden sonra kalan güncellenmedi: %', v->'ozet';
  end if;
  select count(*) into n from public.denetim_izi where islem = 'odeme_silindi';
  if n < 1 then raise exception '7d: silme denetim izine yazılmadı'; end if;

  raise notice '7 OK — silme çalışıyor, özet güncelleniyor, denetim izi tutuluyor';

  -- ---------------------------------------------------------------------------
  -- 8 — OLMAYAN ÖĞRENCİ ve tek imza
  -- ---------------------------------------------------------------------------
  begin
    perform public.ozel_ders_detay(jt, '00000000-0000-0000-0000-000000000000');
    raise exception '8a: olmayan öğrenci için hata verilmedi';
  exception when sqlstate 'P0002' then null;
  end;

  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'ozel_ders_detay';
  if n <> 1 then raise exception '8b: ozel_ders_detay''ın % imzası var', n; end if;

  raise notice '8 OK — olmayan öğrenci reddediliyor, tek imza';

  raise notice '';
  raise notice 'ÖZEL DERS TAKİBİ TESTLERİ: 8 GRUP GEÇTİ';
end $$;
