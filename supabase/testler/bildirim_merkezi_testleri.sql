-- =============================================================================
-- SEKİZ — 0054 BİLDİRİM MERKEZİ TESTLERİ
--
-- DOSYA ADI NEDEN "MERKEZİ": `bildirim_testleri.sql` ZATEN VARDI — 0022'nin
-- rozet sayıları süiti. Bu dosya ilk yazıldığında o adla yazıldı ve 0022'nin
-- altı grubunu SESSİZCE EZDİ; zincir yeşil kaldı çünkü yerine geçen dosya da
-- geçiyordu. Kayıp, `calistir.sh`'ın aynı dosyayı iki kez çağırdığı fark
-- edilince görüldü. Ders: yeni bir test dosyasının adı, var olan bir adla
-- çakışmamalı — ve bitiş satırı ("… TESTLERİ: N GRUP GEÇTİ") de ayrı olmalı,
-- yoksa çıktıda hangi süitin koştuğu anlaşılmaz.
--
-- Bu turun tehlikesi SESSİZLİK. Bir bildirim eksik doğarsa hiçbir şey
-- çökmez: öğrenci ödevi göremez ve kimse fark etmez. Bu yüzden dünyada
-- her türden EN AZ BİR satır var ve her biri ayrı ayrı sayılıyor.
--
-- DÜNYA — 12Y sınıfı, iki öğrenci (Mert, Nehir), üç ödev:
--   Ö1 (açık uçlu) — yayında, teslim GEÇMİŞ, Mert gönderdi ve
--                    öğretmen PUANLADI  → `sonuc` doğuruyor
--   Ö2 (test)      — yayında, teslim YARIN, Mert göndermedi
--                    → `teslim` doğuruyor (yalnız öğrenciye)
--   Ö3 (test)      — yayında, teslim UZAK  → yalnız `odev` satırı
--
-- Mesajlar: öğretmenden Mert'e ÖĞRENCİ kanalından bir mesaj, VELİ
-- kanalından bir mesaj. Kanal ayrımı 7. grupta iki yönlü ölçülüyor.
--
-- İZOLASYON: kendi sınıfını kuruyor ve dünyasını ÖNCE TEMİZLİYOR —
-- test aynı veritabanında iki kez koşabilmeli (0051'in dersi).
-- =============================================================================
\set ON_ERROR_STOP on

do $$
declare
  jt text;
  v_ben uuid;
  s_12y uuid;
  mert uuid; nehir uuid;
  o1 uuid; o2 uuid; o3 uuid;
  g1 uuid;
  kod text; jm text; jv text; jn text;
  v jsonb; satir jsonb;
  turler text[];
  sayi integer;
begin
  -- ---------------------------------------------------------------------------
  -- Hazırlık
  -- ---------------------------------------------------------------------------
  update public.ogretmenler
     set pin_hash = extensions.crypt('Bildirim!2026', extensions.gen_salt('bf', 10))
   where yonetici;
  jt := (public.giris('Bildirim!2026'))->>'token';
  select id into v_ben from public.ogretmenler where yonetici;

  insert into public.siniflar (seviye, sube) values (12, 'Y')
    on conflict (seviye, sube) do update set arsiv = false returning id into s_12y;
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id)
    values (v_ben, s_12y) on conflict do nothing;

  -- DÜNYA ÖNCE TEMİZLENİYOR (0051'in dersi: iki kez koşulabilmeli).
  delete from public.odevler    where sinif_id = s_12y;   -- gönderimler cascade
  delete from public.ogrenciler where sinif_id = s_12y;   -- mesajlar, kodlar cascade

  mert  := (public.ogrenci_ekle(jt, 'Mert Bildirim',  'okul', s_12y, '1'))->>'id';
  nehir := (public.ogrenci_ekle(jt, 'Nehir Bildirim', 'okul', s_12y, '2'))->>'id';

  -- Ö1: AÇIK UÇLU, teslimi geçmiş.
  o1 := (public.odev_olustur(jt, 'Bildirim Odev Bir', null, s_12y, 'acik',
          (current_date + 10), null, null, null, null, true, null, null))->>'id';
  -- Ö2: TEST, teslimi YARIN.
  o2 := (public.odev_olustur(jt, 'Bildirim Odev Iki', null, s_12y, 'test',
          (current_date + 1), 5,
          '{"1":"A","2":"A","3":"A","4":"A","5":"A"}'::jsonb,
          null, null, true, 5::smallint, null))->>'id';
  -- Ö3: TEST, teslimi uzak.
  o3 := (public.odev_olustur(jt, 'Bildirim Odev Uc', null, s_12y, 'test',
          (current_date + 20), 5,
          '{"1":"A","2":"A","3":"A","4":"A","5":"A"}'::jsonb,
          null, null, true, 5::smallint, null))->>'id';

  perform public.odev_yayinla(jt, o1);
  perform public.odev_yayinla(jt, o2);
  perform public.odev_yayinla(jt, o3);

  -- Mert Ö1'i gönderiyor; sonra teslim tarihi geriye çekiliyor.
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = mert and k.rol = 'ogrenci');
  jm := (public.giris(kod))->>'token';
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = mert and k.rol = 'veli');
  jv := (public.giris(kod))->>'token';
  perform public.onam_ver(jv, public._gecerli_onam_surumu(), 'Mert Velisi');
  kod := (select k.kod from public.giris_kodlari k
           where k.ogrenci_id = nehir and k.rol = 'ogrenci');
  jn := (public.giris(kod))->>'token';

  perform public.odev_gonder(jm, o1, 'cozum/' || o1 || '/' || mert || '.jpg', null);
  update public.odevler set son_tarih = current_date - 2 where id = o1;

  select g.id into g1 from public.gonderimler g
   where g.odev_id = o1 and g.ogrenci_id = mert;
  perform public.acik_puanla(jt, g1, 85, null);

  -- Öğretmenden iki kanaldan birer mesaj.
  perform public.mesaj_gonder(jt, 'Ogrenci kanali mesaji', mert, 'ogrenci');
  perform public.mesaj_gonder(jt, 'Veli kanali mesaji',    mert, 'veli');

  -- ---------------------------------------------------------------------------
  -- 1. DÖRT TÜR DE LİSTEDE
  -- ---------------------------------------------------------------------------
  v := public.bildirimlerim(jm);

  select array_agg(distinct e->>'tur' order by e->>'tur') into turler
    from jsonb_array_elements(v->'bildirimler') e;
  if turler <> array['mesaj', 'odev', 'sonuc', 'teslim'] then
    raise exception '1a: türler %, dördü de olmalı', turler;
  end if;

  -- Zaman damgaları doğru kaynaktan mı: `odev` satırının zamanı ödevin
  -- yayın damgası olmalı, `created_at`'i değil.
  select e into satir from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'odev' and e->>'odev_id' = o3::text;
  if (satir->>'zaman')::timestamptz
       is distinct from (select d.yayin_zamani from public.odevler d where d.id = o3) then
    raise exception '1b: odev bildiriminin zamanı yayın damgası değil (%)', satir->>'zaman';
  end if;
  raise notice '1 OK — dört tür de listede, odev satırı yayın damgasını taşıyor';

  -- ---------------------------------------------------------------------------
  -- 2. SIRA: EN YENİ EN ÜSTTE
  -- ---------------------------------------------------------------------------
  declare bozuk integer;
  begin
    select count(*) into bozuk
      from (
        select (e->>'zaman')::timestamptz z,
               lag((e->>'zaman')::timestamptz) over (order by ord) onceki
          from jsonb_array_elements(v->'bildirimler') with ordinality t(e, ord)
      ) x
     where x.onceki is not null and x.z > x.onceki;
    if bozuk > 0 then
      raise exception '2: sıra bozuk — % satır kendinden öncekinden yeni', bozuk;
    end if;
  end;
  raise notice '2 OK — en yeni en üstte';

  -- NOT — SIRA BİLEREK BÖYLE: 4. grup 3'ten ÖNCE koşuyor.
  --
  -- 3. grup dünyayı `bildirim_goruldu` ile işaretliyor ve "yeni sayısı 0"
  -- diyor. "Teslim her gün doğar" kusuru denendiğinde geleceğe tarihli
  -- hatırlatma satırları doğuyor, onlar da "yeni" sayılıyor ve ÖNCE 3.
  -- grup kırılıyordu — kusur yakalanıyordu ama kendi grubunda değil,
  -- yani 4. grubun kendi iddiası kanıtlanamıyordu. Sıra değişince her
  -- kusur kendi ölçümünde görünüyor.
  --
  -- Numaralar korundu: raporda ve prova tablosunda aynı grup aynı adı
  -- taşısın.

  -- ---------------------------------------------------------------------------
  -- 4. `teslim` YALNIZ SON GÜNDEN 1 GÜN ÖNCE (ve son günde)
  --
  -- Ö2'nin teslimi yarın → satır VAR. Gönderim eklenince KAYBOLUYOR.
  -- Süre geçince düşüyor.
  -- ---------------------------------------------------------------------------
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'teslim' and e->>'odev_id' = o2::text;
  if sayi <> 1 then
    raise exception '4a: teslimi yarın olan ödevin hatırlatması yok (%)', sayi;
  end if;

  -- Ö3'ün teslimi uzak — hatırlatması OLMAMALI. Bu iddia olmadan "her
  -- ödeve hatırlatma yaz" kusuru görünmezdi.
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'teslim' and e->>'odev_id' = o3::text;
  if sayi <> 0 then
    raise exception '4b: teslimi uzak ödeve hatırlatma yazıldı';
  end if;

  perform public.odev_gonder(jm, o2, 'cozum/' || o2 || '/' || mert || '.jpg',
    '{"1":"A","2":"A","3":"A","4":"A","5":"A"}'::jsonb);
  v := public.bildirimlerim(jm);
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'teslim' and e->>'odev_id' = o2::text;
  if sayi <> 0 then
    raise exception '4c: gönderim yapıldığı hâlde hatırlatma duruyor';
  end if;

  -- Süre geçince düşüyor: Ö2'yi dünkü tarihe çekip bakıyoruz.
  delete from public.gonderimler where odev_id = o2 and ogrenci_id = mert;
  update public.odevler set son_tarih = current_date - 1 where id = o2;
  v := public.bildirimlerim(jm);
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'teslim';
  if sayi <> 0 then
    raise exception '4d: süresi geçmiş ödevin hatırlatması düşmedi (%)', sayi;
  end if;

  -- Dünyayı geri al: Ö2 yine yarın teslim.
  update public.odevler set son_tarih = current_date + 1 where id = o2;
  raise notice '4 OK — hatırlatma doğru gün doğuyor, gönderimde ve süre bitince düşüyor';

  -- ---------------------------------------------------------------------------
  -- 3. `yeni` BAYRAĞI İKİ YÖNLÜ
  --
  -- İşaretten ÖNCE var → işaretten SONRA yok → yeni mesaj gelince TEKRAR
  -- var. Tek yönlü bir iddia ("işaretten sonra yok") `yeni` her zaman
  -- false yazıldığında da geçerdi.
  -- ---------------------------------------------------------------------------
  if (v->>'toplam_yeni')::int = 0 then
    raise exception '3a: işaretlemeden önce yeni sayısı 0';
  end if;

  perform public.bildirim_goruldu(jm);
  v := public.bildirimlerim(jm);
  if (v->>'toplam_yeni')::int <> 0 then
    raise exception '3b: işaretlemeden sonra yeni sayısı %, 0 olmalı', v->>'toplam_yeni';
  end if;

  -- `now()` işlem boyunca DONUK; işaretin zamanı ile yeni mesajın zamanı
  -- aynı olurdu ve `>` karşılaştırması tutmazdı. İşaret bir saat geriye
  -- çekiliyor (0049'da öğrenilen tuzak).
  update public.bildirim_gorulme set zaman = now() - interval '1 hour'
   where ogrenci_id = mert and rol = 'ogrenci';

  perform public.mesaj_gonder(jt, 'Ikinci ogrenci mesaji', mert, 'ogrenci');
  v := public.bildirimlerim(jm);
  if (v->>'toplam_yeni')::int = 0 then
    raise exception '3c: yeni mesajdan sonra yeni sayısı hâlâ 0';
  end if;
  raise notice '3 OK — yeni bayrağı üç adımda da doğru (var → yok → var)';

  -- ---------------------------------------------------------------------------
  -- 5. VELİYE `teslim` GİTMİYOR (öğretmenin kararı)
  -- ---------------------------------------------------------------------------
  v := public.bildirimlerim(jv);
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'teslim';
  if sayi <> 0 then
    raise exception '5a: veliye teslim hatırlatması gitti (%)', sayi;
  end if;

  -- POZİTİF KONTROL: veli öbür türleri ALIYOR. Bu olmadan yukarıdaki
  -- sıfır, "veliye hiç bildirim gitmiyor" yüzünden de çıkardı.
  select array_agg(distinct e->>'tur' order by e->>'tur') into turler
    from jsonb_array_elements(v->'bildirimler') e;
  if turler <> array['mesaj', 'odev', 'sonuc'] then
    raise exception '5b: velinin türleri %, {mesaj,odev,sonuc} olmalı', turler;
  end if;
  raise notice '5 OK — veli üç türü alıyor, teslim hatırlatması almıyor';

  -- ---------------------------------------------------------------------------
  -- 6. `sonuc` YALNIZ AÇIK UÇLU ÖDEVDE
  --
  -- Ö2 bir TEST ödevi; Mert onu gönderdiğinde puanı anında hesaplanıyor.
  -- O gönderim `sonuc` satırı DOĞURMAMALI.
  -- ---------------------------------------------------------------------------
  perform public.odev_gonder(jm, o2, 'cozum/' || o2 || '/' || mert || '.jpg',
    '{"1":"A","2":"A","3":"A","4":"A","5":"A"}'::jsonb);

  -- TEST GÖNDERİMİNE ÖĞRETMEN PUANI DA YAZILIYOR — ölçüm ölmesin diye.
  --
  -- Prova söyledi: `tur='acik'` süzgecini kaldıran kusur ISIRMADI, çünkü
  -- test gönderiminin `ogretmen_puan`'ı zaten boştu ve satırı asıl o
  -- koşul dışarıda tutuyordu. Yani ölçtüğümüzü sandığımız kural değil,
  -- başka bir kural çalışıyordu.
  --
  -- Öğretmen bir test ödevinin puanını elle düzeltebiliyor (0043'ten beri
  -- iz kaydıyla birlikte); dünyaya o durum konuyor. Artık satırı dışarıda
  -- tutan TEK şey `tur='acik'` ve iddia gerçekten onu ölçüyor.
  update public.gonderimler
     set ogretmen_puan = 70, durum = 'onaylandi'
   where odev_id = o2 and ogrenci_id = mert;

  v := public.bildirimlerim(jm);

  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'sonuc' and e->>'odev_id' = o2::text;
  if sayi <> 0 then
    raise exception '6a: test ödevi sonuç bildirimi doğurdu';
  end if;

  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'sonuc' and e->>'odev_id' = o1::text;
  if sayi <> 1 then
    raise exception '6b: açık uçlu ödevin sonuç bildirimi yok (%)', sayi;
  end if;
  raise notice '6 OK — sonuç yalnız açık uçlu ödevde';

  -- ---------------------------------------------------------------------------
  -- 7. KANAL AYRIMI — İKİ YÖNLÜ
  -- ---------------------------------------------------------------------------
  declare ogr_mesaj integer; veli_mesaj integer;
  begin
    v := public.bildirimlerim(jm);
    select count(*) into ogr_mesaj from jsonb_array_elements(v->'bildirimler') e
     where e->>'tur' = 'mesaj';
    v := public.bildirimlerim(jv);
    select count(*) into veli_mesaj from jsonb_array_elements(v->'bildirimler') e
     where e->>'tur' = 'mesaj';

    -- Öğrenci kanalına 2, veli kanalına 1 mesaj gönderildi.
    if ogr_mesaj <> 2 then
      raise exception '7a: öğrencinin mesaj bildirimi %, 2 olmalı', ogr_mesaj;
    end if;
    if veli_mesaj <> 1 then
      raise exception '7b: velinin mesaj bildirimi %, 1 olmalı', veli_mesaj;
    end if;
  end;
  raise notice '7 OK — her kanal yalnız kendi mesajını görüyor (2 / 1)';

  -- ---------------------------------------------------------------------------
  -- 8. ÖDEV YAYINDAN KALKINCA BİLDİRİMİ KAYBOLUYOR
  --
  -- TÜRETMENİN ASIL KAZANCI. Defter tutulsaydı satır orada kalır ve
  -- öğrenci var olmayan bir ödevin bildirimini görürdü.
  -- ---------------------------------------------------------------------------
  v := public.bildirimlerim(jm);
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'odev' and e->>'odev_id' = o3::text;
  if sayi <> 1 then
    raise exception '8a: kurulum bozuk — Ö3''ün ödev bildirimi yok';
  end if;

  update public.odevler set yayinda = false where id = o3;
  v := public.bildirimlerim(jm);
  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' = 'odev' and e->>'odev_id' = o3::text;
  if sayi <> 0 then
    raise exception '8b: yayından kaldırılan ödevin bildirimi duruyor';
  end if;

  update public.odevler set yayinda = true where id = o3;
  raise notice '8 OK — yayından kalkan ödev listeden kendiliğinden düşüyor';

  -- ---------------------------------------------------------------------------
  -- 9. ARŞİV SINIF VE PASİF ÖĞRENCİ (0016)
  -- ---------------------------------------------------------------------------
  update public.siniflar set arsiv = true where id = s_12y;
  v := public.bildirimlerim(jm);
  if jsonb_array_length(v->'bildirimler') <> 0 then
    raise exception '9a: arşivdeki sınıfın öğrencisine bildirim geldi (%)',
      jsonb_array_length(v->'bildirimler');
  end if;
  update public.siniflar set arsiv = false where id = s_12y;

  -- Pasif öğrenci: listesi boş. (Oturumu `ogrenci_pasiflestir` zaten
  -- kapatıyor; bu iddia ikinci bir kapı.)
  update public.ogrenciler set aktif = false where id = mert;
  if jsonb_array_length(public._bildirimlerim(mert, 'ogrenci')) <> 0 then
    raise exception '9b: pasif öğrenciye bildirim üretildi';
  end if;
  update public.ogrenciler set aktif = true where id = mert;
  raise notice '9 OK — arşiv sınıf ve pasif öğrenci listeye girmiyor';

  -- ---------------------------------------------------------------------------
  -- 10. BAŞKA ÖĞRENCİNİN BİLDİRİMİ SIZMIYOR
  --
  -- Nehir hiçbir şey göndermedi ve ona mesaj yazılmadı: listesinde
  -- YALNIZ sınıfın ödev satırları olmalı.
  -- ---------------------------------------------------------------------------
  v := public.bildirimlerim(jn);
  select array_agg(distinct e->>'tur' order by e->>'tur') into turler
    from jsonb_array_elements(v->'bildirimler') e;
  if turler is distinct from array['odev', 'teslim'] then
    raise exception '10a: Nehir''in türleri %, {odev,teslim} olmalı', turler;
  end if;

  select count(*) into sayi from jsonb_array_elements(v->'bildirimler') e
   where e->>'tur' in ('mesaj', 'sonuc');
  if sayi <> 0 then
    raise exception '10b: Mert''in mesajı/sonucu Nehir''e sızdı (%)', sayi;
  end if;
  raise notice '10 OK — başka öğrencinin mesajı ve sonucu sızmıyor';

  -- ---------------------------------------------------------------------------
  -- 11. KAPILAR
  -- ---------------------------------------------------------------------------
  declare patladi boolean;
  begin
    patladi := false;
    begin
      perform public.bildirimlerim(jt);   -- öğretmen jetonu
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '11a: öğretmen jetonu kabul edildi';
    end if;

    patladi := false;
    begin
      perform public.bildirim_sayim(jt);
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '11b: rozet ucu öğretmen jetonunu kabul etti';
    end if;

    patladi := false;
    begin
      perform public.bildirim_goruldu(jt);
    exception when others then patladi := true;
    end;
    if not patladi then
      raise exception '11c: görüldü ucu öğretmen jetonunu kabul etti';
    end if;

    -- ONAMSIZ VELİ: Nehir'in velisi onam vermedi.
    declare jnv text;
    begin
      kod := (select k.kod from public.giris_kodlari k
               where k.ogrenci_id = nehir and k.rol = 'veli');
      jnv := (public.giris(kod))->>'token';
      patladi := false;
      begin
        perform public.bildirimlerim(jnv);
      exception when others then patladi := true;
      end;
      if not patladi then
        raise exception '11d: onam vermemiş veli kabul edildi';
      end if;
    end;
  end;
  raise notice '11 OK — öğretmen üç uçta da reddediliyor, onamsız veli de';

  -- ---------------------------------------------------------------------------
  -- 12. `yayin_zamani` İLK YAYINDA DAMGALANIYOR, İKİNCİ ÇAĞRI DEĞİŞTİRMİYOR
  --
  -- Bu olmadan bir ödev yayından kaldırılıp tekrar yayınlandığında
  -- ikinci kez "yeni" olurdu.
  -- ---------------------------------------------------------------------------
  declare ilk timestamptz; ikinci timestamptz;
  begin
    select d.yayin_zamani into ilk from public.odevler d where d.id = o3;
    if ilk is null then
      raise exception '12a: ilk yayında damga konmadı';
    end if;

    -- Damgayı geriye çekip tekrar yayınlıyoruz: `now()` işlem boyunca
    -- donuk olduğu için aksi hâlde iki değer zaten aynı çıkar ve iddia
    -- hiçbir şey ölçmezdi.
    update public.odevler set yayin_zamani = ilk - interval '5 days' where id = o3;
    update public.odevler set yayinda = false where id = o3;
    perform public.odev_yayinla(jt, o3);

    select d.yayin_zamani into ikinci from public.odevler d where d.id = o3;
    if ikinci <> ilk - interval '5 days' then
      raise exception '12b: ikinci yayın damgayı değiştirdi (% → %)',
        ilk - interval '5 days', ikinci;
    end if;
  end;
  raise notice '12 OK — damga yalnız ilk yayında konuyor';

  -- ---------------------------------------------------------------------------
  -- 13. GERİYE DÖNÜK DOLDURMA İKİ KAYNAKTAN DA DOĞRU
  --
  -- Migration'ın kendisi bir kez koştu; burada AYNI MANTIK yeniden
  -- kuruluyor: damgası silinen iki ödevden birinin denetim izi var,
  -- öbürünün yok.
  -- ---------------------------------------------------------------------------
  declare izli timestamptz; izsiz timestamptz; beklenen timestamptz;
  begin
    update public.odevler set yayin_zamani = null where id in (o1, o3);
    delete from public.denetim_izi
     where tablo = 'odevler' and kayit_id = o1 and islem = 'odev_yayinlandi';

    update public.odevler d
       set yayin_zamani = (
             select min(i.zaman) from public.denetim_izi i
              where i.tablo = 'odevler' and i.kayit_id = d.id
                and i.islem = 'odev_yayinlandi')
     where d.yayinda and d.yayin_zamani is null
       and exists (select 1 from public.denetim_izi i
                    where i.tablo = 'odevler' and i.kayit_id = d.id
                      and i.islem = 'odev_yayinlandi');

    update public.odevler d
       set yayin_zamani = d.created_at
     where d.yayinda and d.yayin_zamani is null;

    select d.yayin_zamani into izsiz from public.odevler d where d.id = o1;
    select d.created_at    into beklenen from public.odevler d where d.id = o1;
    if izsiz is distinct from beklenen then
      raise exception '13a: izi olmayan ödev created_at''e düşmedi';
    end if;

    select d.yayin_zamani into izli from public.odevler d where d.id = o3;
    select min(i.zaman) into beklenen from public.denetim_izi i
     where i.tablo = 'odevler' and i.kayit_id = o3 and i.islem = 'odev_yayinlandi';
    if izli is distinct from beklenen then
      raise exception '13b: izi olan ödev denetim izinden damgalanmadı';
    end if;
  end;
  raise notice '13 OK — çıpası olan izden, olmayan created_at''ten damgalandı';

  -- ---------------------------------------------------------------------------
  -- 14. ROZET İLE LİSTE AYRIŞMIYOR
  --
  -- 0030'un dersi: iki yol bir gün ayrışır ve rozet "3" derken listede 2
  -- satır çıkar. İki uç aynı sorguyu çağırdığı için eşit olmalılar.
  -- ---------------------------------------------------------------------------
  update public.bildirim_gorulme set zaman = '-infinity'
   where ogrenci_id = mert and rol = 'ogrenci';

  v := public.bildirimlerim(jm);
  if (public.bildirim_sayim(jm))->>'yeni' is distinct from (v->>'toplam_yeni') then
    raise exception '14a: rozet % diyor, liste % diyor',
      (public.bildirim_sayim(jm))->>'yeni', v->>'toplam_yeni';
  end if;

  -- POZİTİF KONTROL: sayı sıfırdan büyük olmalı, yoksa "0 = 0" eşitliği
  -- hiçbir şey kanıtlamazdı.
  if (v->>'toplam_yeni')::int = 0 then
    raise exception '14b: ölçüm boş — yeni sayısı sıfır';
  end if;
  raise notice '14 OK — rozet ile liste aynı sayıyı söylüyor (%)', v->>'toplam_yeni';

  raise notice '';
  raise notice 'BİLDİRİM MERKEZİ TESTLERİ: 14 GRUP GEÇTİ';
end $$;
