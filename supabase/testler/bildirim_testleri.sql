-- =============================================================================
-- SEKİZ — BİLDİRİM SAYILARI TESTLERİ (0022)
--
-- Asıl soru DÖNGÜ: sayı artıyor mu, ve okununca DÜŞÜYOR mu? Artıp hiç
-- düşmeyen bir rozet kalıcı olarak yanlış bir sayı gösterir; öğretmen bir
-- süre sonra ona bakmayı bırakır, yani özellik sessizce ölür.
--
-- İkinci soru TUTARLILIK: rozetteki sayı Pano ve Veliler sekmesindekiyle
-- birebir aynı mı? Ayrışırlarsa öğretmen iki farklı sayı görür ve
-- hangisinin doğru olduğunu bilemez.
--
-- NOT: hiçbir blokta `exception when others` YOK. Böyle bir yakalayıcı
-- kendinden önceki bütün grupların hatalarını yutar ve test hiçbir şey
-- ölçmemiş olur.
--
-- SAYILAR MUTLAK DEĞİL, FARK OLARAK ÖLÇÜLÜYOR. Süit bütün test dosyalarını
-- AYNI veritabanında koşturuyor; önceki dosyalardan kalan mesaj ve gönderim
-- var. "Temiz sistemde sıfır" varsayımı ilk koşuda kırıldı ve haklı olarak
-- kırıldı — ölçülen şey artık başlangıç değeri değil, DEĞİŞİM.
--
-- "OKUDUKTAN SONRA GELEN MESAJ" AYRI BİR BLOKTA. PostgreSQL'de `now()`
-- İŞLEM başlangıç zamanıdır; psql'de her `do` bloğu kendi işlemidir. Aynı
-- blokta `ogretmen_okudu`'nun yazdığı damga ile hemen sonraki mesajın
-- `created_at`'i BİREBİR AYNI çıkıyor, karşılaştırma ise `>` — eşitlik
-- sayılmıyor ve mesaj görünmez oluyor. Ölçüldü ve doğrulandı: iki blok
-- arasında `now()` ilerliyor. Bu bir ürün kusuru değil (gerçekte veli ile
-- öğretmen aynı işlemde davranmaz) ama testin kurgusunu bozuyordu.
-- =============================================================================
\set ON_ERROR_STOP on

-- Test verisi ve 1–3. gruplar
do $$
declare
  jt text; jv text; jo text;
  v_s uuid; v_o uuid; v_odev uuid; v_g uuid;
  n integer; n0 integer; p0 integer;
begin
  update public.ayarlar
     set ogretmen_pin_hash = extensions.crypt('Rozet!2026', extensions.gen_salt('bf', 10))
   where id = 1;
  jt := (public.giris('Rozet!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (6, 'R')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;

  v_o := (public.ogrenci_ekle(jt, 'Rozet Öğrenci', 'okul', v_s))->>'id';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'veli')))->>'token';
  jo := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'ogrenci')))->>'token';

  -- ---------------------------------------------------------------------------
  -- 1 — UÇ İKİ SAYI DÖNDÜRÜYOR
  -- ---------------------------------------------------------------------------
  if (public.bildirim_sayilari(jt)->'okunmamis_mesaj') is null
     or (public.bildirim_sayilari(jt)->'puan_bekleyen') is null then
    raise exception '1a: alanlar eksik: %', public.bildirim_sayilari(jt);
  end if;
  if jsonb_typeof(public.bildirim_sayilari(jt)->'okunmamis_mesaj') <> 'number' then
    raise exception '1b: okunmamis_mesaj sayı değil';
  end if;
  raise notice '1 OK — uç iki sayı döndürüyor';

  -- ---------------------------------------------------------------------------
  -- 2 — ASIL DÖNGÜ: veli yazınca artıyor, öğretmen okuyunca DÜŞÜYOR
  -- ---------------------------------------------------------------------------
  n0 := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  perform public.mesaj_gonder(jv, 'Merhaba hocam, bir sorum var.');
  perform public.mesaj_gonder(jv, 'İkinci mesajım.');

  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 + 2 then raise exception '2a: +2 bekleniyordu, %→% oldu', n0, n; end if;

  -- ÖĞRETMENİN KENDİ MESAJI OKUNMAMIŞ SAYILMAMALI. Aynı `mesaj_gonder`
  -- ucu, öğretmen çağırınca `p_ogrenci_id` ile hedefi söylüyor.
  perform public.mesaj_gonder(jt, 'Buyurun.', v_o);
  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 + 2 then raise exception '2b: öğretmenin kendi mesajı sayaca girdi (%)', n; end if;

  -- Okundu işaretlenince düşmeli — rozetin varlık sebebi bu
  perform public.ogretmen_okudu(jt, v_o);
  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 then raise exception '2c: okunduktan sonra başlangıca dönmedi (%→%)', n0, n; end if;

  raise notice '2 OK — veli yazınca artıyor, öğretmen okuyunca düşüyor';

  -- ---------------------------------------------------------------------------
  -- 3 — PUAN BEKLEYEN: açık uçlu gönderim artırıyor, puanlama düşürüyor
  -- ---------------------------------------------------------------------------
  v_odev := (public.odev_olustur(jt, 'Açık uçlu', null, v_s, 'acik',
                                 current_date + 5))->>'id';
  perform public.odev_yayinla(jt, v_odev);

  p0 := (public.bildirim_sayilari(jt)->>'puan_bekleyen')::int;

  perform public.odev_gonder(jo, v_odev, 'cozum/' || v_odev || '/' || v_o || '.jpg');
  n := (public.bildirim_sayilari(jt)->>'puan_bekleyen')::int;
  if n <> p0 + 1 then raise exception '3b: açık uçlu gönderim sayılmadı (%→%)', p0, n; end if;

  select id into v_g from public.gonderimler
   where odev_id = v_odev and ogrenci_id = v_o;
  perform public.acik_puanla(jt, v_g, 85, 'Güzel çalışma.');
  n := (public.bildirim_sayilari(jt)->>'puan_bekleyen')::int;
  if n <> p0 then raise exception '3c: puanlamadan sonra düşmedi (%→%)', p0, n; end if;

  raise notice '3 OK — açık uçlu gönderim artırıyor, puanlama düşürüyor';
end $$;

-- 2d — OKUDUKTAN SONRA GELEN MESAJ (ayrı blok: `now()` ilerlesin)
do $$
declare
  jt text; jv text; v_o uuid; n0 integer; n integer;
begin
  jt := (public.giris('Rozet!2026'))->>'token';
  select id into v_o from public.ogrenciler where ad = 'Rozet Öğrenci';

  n0 := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'veli')))->>'token';
  perform public.mesaj_gonder(jv, 'Bir şey daha soracaktım.');

  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  if n <> n0 + 1 then
    raise exception '2d: okuduktan sonra gelen mesaj sayılmadı (%→%)', n0, n;
  end if;

  raise notice '2d OK — okundu işaretlendikten sonra gelen mesaj yeniden sayılıyor';
end $$;

-- 4 — TUTARLILIK
do $$
declare
  jt text; n integer; m integer; mesaj integer;
begin
  jt := (public.giris('Rozet!2026'))->>'token';

  -- 2d'den kalan okunmamış mesaj burada karşılaştırılıyor.
  mesaj := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  m := (public.veliler_listesi(jt)->>'toplam_okunmamis')::int;
  if mesaj <> m then
    raise exception '4a: rozet % diyor, Veliler sekmesi % diyor', mesaj, m;
  end if;

  -- DENETİMİN İŞE YARADIĞI KANITI: iki taraf da sıfır olsaydı eşitlik
  -- hiçbir şey söylemezdi.
  if mesaj = 0 then
    raise exception '4b: karşılaştırma boş veriyle yapıldı — test bir şey ölçmedi';
  end if;

  n := (public.bildirim_sayilari(jt)->>'puan_bekleyen')::int;
  m := (public.ogretmen_panosu(jt)->>'bekleyen_degerlendirme')::int;
  if n <> m then
    raise exception '4c: rozet % diyor, Pano % diyor', n, m;
  end if;

  raise notice '4 OK — rozet Veliler sekmesiyle (% mesaj) ve Pano ile (% puan bekleyen) birebir aynı', mesaj, n;
end $$;

-- 5 — ARŞİV VE PASİF ÖĞRENCİ
do $$
declare
  jt text; jv text; v_s uuid; v_o uuid; n integer;
begin
  jt := (public.giris('Rozet!2026'))->>'token';

  insert into public.siniflar (seviye, sube) values (7, 'R')
    on conflict (seviye, sube) do update set arsiv = false returning id into v_s;
  v_o := (public.ogrenci_ekle(jt, 'Arşivlik Öğrenci', 'okul', v_s))->>'id';
  jv := (public.giris((select kod from public.giris_kodlari
                        where ogrenci_id = v_o and rol = 'veli')))->>'token';
  perform public.mesaj_gonder(jv, 'Arşivden önce yazıyorum.');

  -- Öğretmenin hiçbir listesinde görünmeyen bir öğrenci için rozet
  -- göstermek, tıklayınca boş ekrana götüren bir sayı üretirdi (0016).
  n := (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int;
  perform public.sinif_arsivle(jt, v_s, true);
  if (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int <> n - 1 then
    raise exception '5a: arşivlenen sınıfın mesajı hâlâ sayılıyor';
  end if;
  perform public.sinif_arsivle(jt, v_s, false);
  if (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int <> n then
    raise exception '5b: arşivden çıkınca geri gelmedi';
  end if;

  perform public.ogrenci_pasiflestir(jt, v_o);
  if (public.bildirim_sayilari(jt)->>'okunmamis_mesaj')::int <> n - 1 then
    raise exception '5c: pasif öğrencinin mesajı hâlâ sayılıyor';
  end if;

  raise notice '5 OK — arşivdeki sınıf ve pasif öğrenci sayılmıyor, geri alınca dönüyor';
end $$;

-- 6 — ÖĞRENCİ VE VELİ ÇAĞIRAMIYOR
do $$
declare
  jo text; jv text;
begin
  jo := (public.giris((select gk.kod from public.giris_kodlari gk
                        join public.ogrenciler o on o.id = gk.ogrenci_id
                       where gk.rol = 'ogrenci' and o.aktif limit 1)))->>'token';
  begin
    perform public.bildirim_sayilari(jo);
    raise exception '6a: ÖĞRENCİ bildirim sayılarını okuyabildi';
  exception when sqlstate '42501' then null;
  end;

  jv := (public.giris((select gk.kod from public.giris_kodlari gk
                        join public.ogrenciler o on o.id = gk.ogrenci_id
                       where gk.rol = 'veli' and o.aktif limit 1)))->>'token';
  begin
    perform public.bildirim_sayilari(jv);
    raise exception '6b: VELİ bildirim sayılarını okuyabildi';
  exception when sqlstate '42501' then null;
  end;

  raise notice '6 OK — öğrenci ve veli çağıramıyor';
  raise notice '';
  raise notice 'BİLDİRİM SAYILARI TESTLERİ: 6 GRUP GEÇTİ';
end $$;
