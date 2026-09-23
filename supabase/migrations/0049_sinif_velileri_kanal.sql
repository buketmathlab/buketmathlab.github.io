-- =============================================================================
-- 0049 — ONARIM: "more than one row returned by a subquery" (21000)
--
-- BELİRTİ (öğretmen bildirdi, canlıda):
--   Veliler → 9A → "Bu bölüm yüklenemedi"
--   more than one row returned by a subquery used as an expression
--
-- -----------------------------------------------------------------------------
-- SEBEP — TAHMİN DEĞİL, YERELDE BİREBİR ÜRETİLDİ
--
-- `okundu` tablosunun birincil anahtarı bugün şu:
--
--     (ogrenci_id, rol, kanal, ogretmen_id)
--
-- Yani bir öğrenci için AYNI rolde birden çok okuma işareti olabilir.
-- Oysa bazı uçlar işareti tek değer bekleyen bir alt sorguyla arıyordu.
-- İki satır dönünce 21000.
--
-- İKİ AYRI YOLDAN İKİNCİ SATIR DOĞUYOR — İKİSİ DE ÖLÇÜLDÜ:
--
--   A) ÖĞRETMEN TARAFI (öğretmenin bugün gördüğü hata)
--      `sinif_velileri` işareti yalnız `rol = 'ogretmen'` ile arıyordu.
--      Öğretmen aynı öğrencinin hem veli hem öğrenci kanalını açınca
--      iki satır oluyor ve ekran patlıyor.
--
--      Kanal ayrımı 0025'te geldi ve okuyan uçların hepsi güncellendi;
--      BU BİRİ ATLANDI. Hata bir yıl uyudu çünkü ikinci satırın oluşması
--      için öğretmenin öğrenci kanalını da açması gerekiyordu ve o
--      yazışma başka bir sekmenin içindeydi. 0048 iki kanalı yan yana
--      iki düğme yaptı, öğretmen ikisine de bastı ve hata uyandı.
--      0048 bu hatayı YARATMADI ama ERİŞİLİR KILDI.
--
--   B) ÖĞRENCİ VE VELİ TARAFI (henüz yaşanmadı, ama yola çıkmış)
--      `okundu_isaretle` satırı öğrencinin O ANKİ öğretmeniyle yazıyor.
--      Sınıf başka bir öğretmene geçtiğinde öğrenci panosunu bir daha
--      açınca İKİNCİ satır doğuyor ve `ogrenci_odevleri`,
--      `ogrenci_mesajlari`, `veli_paneli` aynı hatayla patlıyor.
--      Ölçüldü: sınıfı devrettikten sonra öğrenci panosu 21000 verdi.
--
-- -----------------------------------------------------------------------------
-- ONARIM — İKİ TARAF İÇİN İKİ FARKLI DOĞRU CEVAP
--
-- (A) ÖĞRETMEN TARAFI: işaret gerçekten öğretmene ve kanala ait. Doğru
--     cevap süzgeci tamamlamak — anahtarın dört sütunu da süzülüyor.
--
-- (B) ÖĞRENCİ/VELİ TARAFI: işaret KİŞİYE ait, öğretmene değil. Oradaki
--     `ogretmen_id` baştan beri tesadüfi bir sütun. Doğru cevap üç
--     sorguyu tek tek düzeltmek DEĞİL — o yine "unutulabilir" bir
--     çözüm olurdu. Doğru cevap VERİNİN kendisini tekilleştirmek:
--     kısmi TEKİL DİZİN. Bundan sonra o satırların birden çok olması
--     veritabanı düzeyinde imkânsız; hangi sorgunun nasıl yazıldığı
--     fark etmiyor.
--
--     Bu bilinçli bir tercih: metin süzgeci bir alışkanlıktır, kısıt
--     bir kanıttır. Bu hatanın bir yıl saklanabilmesinin sebebi tam
--     olarak kanıt yerine alışkanlığa güvenilmesiydi.
--
-- İMZALAR DEĞİŞMİYOR — 0007 tuzağı yok.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) MEVCUT ÇİFT SATIRLARI BİRLEŞTİR (öğrenci ve veli rolleri)
--
-- En SON zaman tutuluyor. Gerekçe: iki satır, kişinin iki ayrı
-- ziyaretinden kaldı ve kişi gerçekten en son o zaman baktı. En eskiyi
-- tutmak okunmuş mesajları tekrar "yeni" gösterirdi.
-- -----------------------------------------------------------------------------
do $$
declare
  v_silinen integer;
begin
  with tekil as (
    select ogrenci_id, rol, kanal, max(zaman) as son
      from public.okundu
     where rol <> 'ogretmen'
     group by ogrenci_id, rol, kanal
    having count(*) > 1
  ),
  silinecek as (
    delete from public.okundu k
     using tekil t
     where k.ogrenci_id = t.ogrenci_id and k.rol = t.rol and k.kanal = t.kanal
       and k.rol <> 'ogretmen'
       and k.zaman < t.son
    returning 1
  )
  select count(*) into v_silinen from silinecek;

  -- Zamanları da EŞİT olan çiftler kalmış olabilir (aynı saniye).
  delete from public.okundu k
   where k.rol <> 'ogretmen'
     and k.ctid not in (
       select min(x.ctid) from public.okundu x
        where x.rol <> 'ogretmen'
        group by x.ogrenci_id, x.rol, x.kanal
     );

  raise notice '0049: birleştirilen okuma işareti: % satır silindi', v_silinen;
end $$;

-- -----------------------------------------------------------------------------
-- 2) KISITI KUR — bundan sonra çift satır İMKÂNSIZ
--
-- Kısmi: yalnız öğrenci ve veli rolleri için. Öğretmen rolünde satırın
-- öğretmen başına ayrı olması DOĞRU — meslektaşımın okuması benim
-- okumam değil.
-- -----------------------------------------------------------------------------
create unique index if not exists okundu_kisi_tek
  on public.okundu (ogrenci_id, rol, kanal)
  where rol <> 'ogretmen';

-- -----------------------------------------------------------------------------
-- 3) YAZICIYI KISITA UYDUR
--
-- Eski `on conflict (ogrenci_id, rol, kanal, ogretmen_id)` öğretmen
-- değiştiğinde çakışmayı GÖRMÜYOR, yeni satır eklemeye çalışıyordu.
-- Artık kısmi dizin üzerinden çakışıyor ve satırı güncelliyor —
-- öğretmen değişse bile tek satır kalıyor.
-- -----------------------------------------------------------------------------
create or replace function public.okundu_isaretle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
  v_kanal text;
begin
  select * into o from public._oturum(p_token);
  if o.rol not in ('ogrenci', 'veli') then
    raise exception 'Bu işlem yalnız öğrenci ve veli içindir.' using errcode = '42501';
  end if;
  perform public._onam_kapisi(o.rol, o.ogrenci_id);

  -- Kanal adı rolle aynı (0025): öğrenci 'ogrenci', veli 'veli'.
  v_kanal := o.rol;

  insert into public.okundu (ogrenci_id, rol, kanal, ogretmen_id, zaman)
  values (o.ogrenci_id, o.rol, v_kanal,
          public._ogrencinin_ogretmeni(o.ogrenci_id), now())
  -- 0049: ÇAKIŞMA ARTIK KİŞİ ÜZERİNDEN. `ogretmen_id` de güncelleniyor
  -- ki satır öğrencinin bugünkü öğretmenini göstersin.
  on conflict (ogrenci_id, rol, kanal) where rol <> 'ogretmen'
  do update set zaman = now(), ogretmen_id = excluded.ogretmen_id;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function public.okundu_isaretle(text) from public, anon, authenticated;
grant execute on function public.okundu_isaretle(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) ÖĞRETMEN TARAFI: `sinif_velileri`
--
-- Kısıt burada işe yaramaz — öğretmen rolünde çok satır DOĞRU. Burada
-- süzgecin tamamlanması gerekiyor.
--
-- EKRANDAKİ SAYI, TIKLAYINCA GÖRÜLENLE AYNI OLMALI: mesaj sayıları da
-- `mesajlar_ogretmen`'in süzgeçlerine (kanal + ogretmen_id) getirildi.
-- Eskiden liste "4 mesaj" derken açılan yazışmada 2 mesaj görünüyordu —
-- öğrenci kanalındaki ve meslektaşın yazdığı mesajlar sayıya karışıyordu.
-- Çökmeyen bir yalan, çökenden daha tehlikelidir.
-- -----------------------------------------------------------------------------
create or replace function public.sinif_velileri(p_token text, p_sinif_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sinif record;
  v_ogretmen uuid;
begin
  v_ogretmen := public._ogretmen(p_token);
  if not public._ogretmenin_sinifi(v_ogretmen, p_sinif_id) then
    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
  from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_sinif.id, 'ad', v_sinif.ad, 'ozel', v_sinif.ozel),
    'veliler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ogrenci_id', o.id,
               'ad', o.ad,
               'tur', o.tur,
               -- ONAM DURUMU (0034). Onaylamayan veli panele giremiyor;
               -- öğretmen kimin beklediğini buradan görüyor. SALT OKUNUR:
               -- öğretmen onamı ne verebilir ne geri alabilir — onam
               -- velinin kendi iradesi, başkası adına tıklanamaz.
               'onam_var', exists (select 1 from public.veli_onaylari v
                                    where v.ogrenci_id = o.id
                                      and v.metin_surumu = public._gecerli_onam_surumu()),
               -- Veli kodu yoksa veli hiç giriş yapamaz; öğretmen bunu
               -- mesaj yazmadan önce bilsin.
               'veli_kodu_var', exists (select 1 from public.giris_kodlari k
                                         where k.ogrenci_id = o.id and k.rol = 'veli'),
               'mesaj_sayisi', (select count(*)::integer from public.mesajlar m
                                 where m.ogrenci_id = o.id
                                   and m.kanal = 'veli'
                                   and m.ogretmen_id = v_ogretmen),
               'son_mesaj', (select max(m.created_at) from public.mesajlar m
                              where m.ogrenci_id = o.id
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen),
               'okunmamis', (select count(*)::integer from public.mesajlar m
                              where m.ogrenci_id = o.id and m.kimden = 'veli'
                                and m.kanal = 'veli'
                                and m.ogretmen_id = v_ogretmen
                                and m.created_at > coalesce(
                                      -- 0049: anahtarın DÖRT sütunu da
                                      -- süzülüyor; kanal ya da ogretmen_id
                                      -- eksikken bu alt sorgu tek satır
                                      -- döndürmek zorunda değildi.
                                      (select k.zaman from public.okundu k
                                        where k.ogrenci_id = o.id
                                          and k.rol = 'ogretmen'
                                          and k.kanal = 'veli'
                                          and k.ogretmen_id = v_ogretmen),
                                      '-infinity'::timestamptz))
             ) order by o.ad)
      from public.ogrenciler o
      where o.sinif_id = p_sinif_id and o.aktif
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sinif_velileri(text, uuid) from public, anon, authenticated;
grant execute on function public.sinif_velileri(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- KENDİNİ DENETLEME
--
-- Bu hata bir yıl sessiz kaldı çünkü kimse "okundu'yu eksik süzgeçle
-- okuyan başka bir yer var mı" diye SORMADI. Aşağıdaki iki blok o soruyu
-- her migration koşusunda soruyor.
-- -----------------------------------------------------------------------------

-- (a) Kısıt gerçekten kuruldu mu? Öğrenci/veli tarafının bütün güvencesi
--     buna dayanıyor; sessizce düşerse üç uç birden yeniden kırılganlaşır.
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'okundu_kisi_tek'
  ) then
    raise exception '0049: okundu_kisi_tek dizini kurulmadı';
  end if;

  if exists (
    select 1 from public.okundu where rol <> 'ogretmen'
     group by ogrenci_id, rol, kanal having count(*) > 1
  ) then
    raise exception '0049: öğrenci/veli tarafında hâlâ çift okuma işareti var';
  end if;
end $$;

-- (b) ÖĞRETMEN rolünü okuyan alt sorgular anahtarın tamamını süzüyor mu?
--     Kısıt öğretmen tarafını koruyamaz (orada çok satır doğru), o yüzden
--     burası metinle taranıyor. Kaba bir tarama ve öyle olduğunu gizlemiyor;
--     ama tam bu hatanın şeklini arıyor.
do $$
declare
  r record;
  parca text;
  kotu text[] := '{}';
begin
  for r in
    select p.proname, pg_get_functiondef(p.oid) as govde
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%from public.okundu k%'
  loop
    parca := split_part(
      substr(r.govde, position('from public.okundu k' in r.govde)), ')', 1);
    if parca like '%''ogretmen''%'
       and (parca not like '%kanal%' or parca not like '%ogretmen_id%') then
      kotu := kotu || r.proname;
    end if;
  end loop;

  if array_length(kotu, 1) > 0 then
    raise exception '0049: öğretmen okuma işaretini eksik süzen uç(lar) → %',
      array_to_string(kotu, ', ');
  end if;
end $$;

do $$
declare
  v_sayi integer;
begin
  select count(*) into v_sayi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('sinif_velileri', 'okundu_isaretle');

  if v_sayi <> 2 then
    raise exception '0049: beklenen iki uç yerine % imza var', v_sayi;
  end if;
end $$;

select public._migration_kaydet('0049');
