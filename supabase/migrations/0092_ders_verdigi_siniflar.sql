-- =============================================================================
-- 0092 — "DERS VERDİĞİM SINIFLAR": KÜNYEDEKİ AD GERÇEĞİ SÖYLESİN
--
-- Öğretmenin sorusu: "Tüm sınıfların diğer öğretmen arkadaşlarım için bu ödev
-- çizelgesini alabilecek miyim?" Ölçünce 0091'in künyesinin YANLIŞ ad bastığı
-- çıktı.
--
-- -----------------------------------------------------------------------------
-- 1. KUSUR: ERİŞİM KAYDI, DERS KAYDI SANILIYOR
--
-- Künye `sinif.ogretmenler`den geliyor, o da `ogretmen_siniflari`ndan.
-- Öğretmenin kendi sözleriyle:
--
--   "Zaten her sınıfın bir öğretmeni var. Ama ben sahip olduğum için tüm
--    sınıflar bende var gözüküyor. Fakat benim girdiğim sınıflar 9A, 9B,
--    10C, 11C."
--
-- Doğru: 0033'ün taşıması BÜTÜN sınıfları sahibe bağladı ("Mevcut BÜTÜN
-- sınıflar yöneticiye bağlanıyor") ve `sinif_ekle` her yeni sınıfı da
-- bağlıyor. Yani sahip için bu tablo ERİŞİM kaydı; diğer öğretmenlerde
-- erişim ile ders AYNI şey.
--
-- Sonuç: başka bir öğretmenin sınıfı için basılan kâğıtta künyede
-- "Matematik · Buket Topuzoğlu, Ayşe Demir" yazıyordu. Veli, o sınıfın
-- dersine sahibin de girdiğini sanırdı. VELİYE GİDEN KÂĞITTA YANLIŞ BİLGİ.
--
-- -----------------------------------------------------------------------------
-- 2. ÇÖZÜM: AYRIMI ŞEMAYA YAZ
--
-- `ogretmen_siniflari.ders_veriyor` ekleniyor.
--
--   • VARSAYILAN `true` — diğer öğretmenlerin davranışı DEĞİŞMİYOR.
--   • TAŞIMADA SAHİBİN KAYITLARI `false`. Sahip ayarını yapana kadar
--     künyede yalnız "Matematik" yazar: EKSİK, ama YANLIŞ DEĞİL. Veliye
--     yanlış bir ad basmaktansa hiç basmamak (Part VIII'in aynı yönü).
--
-- Süzgeç YALNIZ `sinif_not_cizelgesi`e konuyor; veliye giden kâğıdın
-- kaynağı o. `ogretmen_siniflari`ndan ad listesi üreten öbür uçlar
-- (müdür ekranları, sınıf sayfası) ERİŞİM listesi gösteriyor ve o
-- bağlamda bugünkü anlamıyla doğru çalışıyor.
--
-- -----------------------------------------------------------------------------
-- 3. `ogretmen_sinif_ata` DA DEĞİŞİYOR — YOKSA AYAR SESSİZCE SİLİNİRDİ
--
-- O uç listeyi `delete` + `insert` ile değiştiriyor. Sütun eklendikten
-- sonra bu desen, kaydedilen her atamada `ders_veriyor`u varsayılana
-- döndürür ve sahibin ayarı kaybolurdu — kimsenin görmeyeceği bir geri
-- alma. Gövde 0033'ten PROGRAMLA kopyalandı, eski işaret okunup geri
-- yazılıyor.
--
-- `sinif_ekle` de aynı sebeple güncelleniyor: yönetici her yeni sınıfa
-- bağlanıyor ve ders işareti varsayılanla `true` gelseydi, sahip her yeni
-- sınıf açtığında kusur arka kapıdan geri dönerdi. BU KUSURU 0092'NİN
-- KENDİ TESTİ BULDU — ilk yazımda yalnız `ogretmen_sinif_ata` düzeltilmişti
-- ve test "sahibin 75 kaydı hâlâ ders_veriyor" diye bağırdı.
--
-- -----------------------------------------------------------------------------
-- 4. İMZA DEĞİŞMİYOR → 0007 TUZAĞI YOK
--
-- `sinif_not_cizelgesi` gövdesi EN SON tanımından (0091) PROGRAMLA
-- kopyalandı; tek değişiklik `ogretmenler` alt sorgusuna `os.ders_veriyor`
-- eklenmesi. 0088'in dersi: `odev_detay` 0083'ten kopyalanıp 0085'i
-- sessizce geri almıştı. Öz-denetim 0091'in alanlarını tek tek arıyor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SÜTUN
-- -----------------------------------------------------------------------------
alter table public.ogretmen_siniflari
  add column if not exists ders_veriyor boolean not null default true;

comment on column public.ogretmen_siniflari.ders_veriyor is
  'Bu öğretmen bu sınıfın DERSİNE giriyor mu? Erişimden ayrı: sahip bütün '
  'sınıflara erişir ama hepsinin dersine girmez. Veli çizelgesinin künyesi '
  'bu sütuna bakar.';

-- -----------------------------------------------------------------------------
-- 2. TAŞIMA — SAHİBİN KAYITLARI `false`
--
-- YALNIZ BİR KEZ: migration yeniden koşarsa (geliştirme ortamı) sahibin
-- elle yaptığı ayarı geri almamalı. Koşul, sütunun yeni eklenmiş olması.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.uygulanan_migrationlar where dosya = '0092') then
    update public.ogretmen_siniflari os
       set ders_veriyor = false
      from public.ogretmenler g
     where g.id = os.ogretmen_id and g.yonetici;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. GÖVDELER — İKİSİ DE PROGRAMLA KOPYALANDI (ezberden yazılmadı)
-- -----------------------------------------------------------------------------
create or replace function public.sinif_not_cizelgesi(
  p_token text,
  p_sinif_id uuid,
  p_onizleme boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bugun_tr  date := (now() at time zone 'Europe/Istanbul')::date;
  v_okuyan  uuid;
  v_sinif   record;
  v_yil_bas date;
  v_hepsi   boolean;
  v_dolan   integer;
begin
  v_okuyan := public._sinif_okuyucusu(p_token, p_sinif_id);

  -- 0063 — ÖDEV KAPSAMI. Müdür (ve sahibin müdür önizlemesi) sınıfın
  -- BÜTÜN ödevlerini görür; öğretmen bugünkü kuralla yalnız erişebildiği
  -- ödevleri (`_odeve_erisir`, 0055 — `sinif_ogrencileri` ile aynı).
  v_hepsi := (select o.rol from public._oturum(p_token) o) = 'mudur'
          or (p_onizleme and exists (select 1 from public.ogretmenler g
                                      where g.id = v_okuyan and g.yonetici));

  -- 0063: arşivdeki sınıf da açılıyor (öğretmenin sınıf sayfası bugün açıyor).
  select s.id, s.ad, s.ozel, s.arsiv into v_sinif
    from public.siniflar s where s.id = p_sinif_id;
  if not found then
    raise exception 'Sınıf bulunamadı.' using errcode = 'P0002';
  end if;

  -- 0086: çalışma kağıdı "süresi dolmuş değerlendirilen ödev" değil.
  select count(*)::integer into v_dolan
    from public.odevler d
   where d.sinif_id = p_sinif_id and d.yayinda and d.son_tarih < bugun_tr
     and d.tur <> 'calisma'
     and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id));

  v_yil_bas := make_date(
    case when extract(month from bugun_tr) >= 9 then extract(year from bugun_tr)::integer
         else extract(year from bugun_tr)::integer - 1 end, 9, 1);

  return jsonb_build_object(
    'sinif', jsonb_build_object(
      'id', v_sinif.id,
      'ad', v_sinif.ad,
      'ozel', v_sinif.ozel,
      'arsiv', v_sinif.arsiv,
      'ogretmenler', coalesce((
          select jsonb_agg(g.ad order by g.yonetici desc, g.ad)
            from public.ogretmen_siniflari os
            join public.ogretmenler g on g.id = os.ogretmen_id
           where os.sinif_id = p_sinif_id and os.ders_veriyor
             and g.aktif and not g.mudur
        ), '[]'::jsonb)),
    'kapsam', case when v_hepsi then 'tum' else 'ogretmen' end,
    'degerlendirilen_odev', v_dolan,
    'mevcut', (select count(*)::integer from public.ogrenciler o
                where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)),
    'odevler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'baslik', d.baslik,
               'tur', d.tur,
               'ogretmen', (select g.ad from public.ogretmenler g where g.id = d.ogretmen_id),
               'soru_sayisi', d.soru_sayisi,
               -- 0063: müdür ödevi ve cevap anahtarını görebiliyor.
               'odev_yolu', d.odev_url,
               'anahtar_yolu', d.anahtar_url,
               'cevap_anahtari', d.cevap_anahtari,
               'son_tarih', d.son_tarih,
               'sure_doldu', d.son_tarih < bugun_tr,
               -- 0091: ÖDEV NE ZAMAN VERİLDİ (öğretmenin isteği:
               -- "hangi ödev ne zaman verilmiş"). Hesap 0085'in
               -- yardımcısında; `created_at` TASLAĞIN açıldığı an,
               -- veriliş tarihi değil. İkisini karıştırmak veliye
               -- yanlış bir gün söylemek olurdu.
               'tarihler', public._odev_tarihleri(d.id, d.son_tarih),
               -- 0091: SINIF VE DÜZEY ORTALAMASI (öğretmenin isteği:
               -- "o düzeydeki tüm sınıfların ortalaması kaçmış").
               -- 0047'nin yardımcısı; kendi kapılarını getiriyor —
               -- özel derste ve çalışma kağıdında kıyas yok, süresi
               -- dolmadan yok, tek şubeye verilmişse düzey null.
               --
               -- TESLİM SAYILARI BURADAN DA GELMİYOR: `_odev_kiyasi`
               -- onları bilerek döndürmüyor (öğretmenin kararı:
               -- "Teslim sayısı veliye ya da öğrenciye
               -- gösterilmesin"). Gövdesindeki gerekçe aynen duruyor.
               'kiyas', public._odev_kiyasi(d.id),
               -- 0064: SINIF LİSTESİ ESAS. Yalnız bugün sınıfta olan ve ödevin
               -- son tarihinde sınıfa gelmiş öğrenciler sayılıyor.
               'beklenen', (select count(*)::integer from public.ogrenciler o
                             where (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'gonderim', (select count(*)::integer from public.gonderimler g
                             join public.ogrenciler o on o.id = g.ogrenci_id
                            where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                              and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)),
               'ortalama', (select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                              from public.gonderimler g
                              join public.ogrenciler o on o.id = g.ogrenci_id
                             where g.odev_id = d.id and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                               and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                               and coalesce(g.ogretmen_puan, g.puan) is not null)
             ) order by d.son_tarih, d.created_at, d.id)
        from public.odevler d
       where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    -- 0086: çalışma kağıdı puan ızgarasında sütun açmıyor.
                    and d.tur <> 'calisma'
    ), '[]'::jsonb),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id,
               'ad', o.ad,
               'ogrenci_no', o.ogrenci_no,
               'tur', o.tur,
               -- 0063 — ÖĞRETMENİN SINIF SAYFASININ SAYILARI,
               -- `sinif_ogrencileri` (0055) ile BİREBİR aynı formül.
               'yapti', i.yapti,
               'yapmadi', i.beklenen - i.yapti,
               'ortalama_yapan', i.ortalama_yapan,
               'ortalama_tum', i.ortalama_tum,
               -- 0086 — ÇALIŞMA KAĞIDI: AYRI SATIR, ortalamanın dışında.
               'calisma_sayisi', i.calisma_sayisi,
               'calisma_yapilan', i.calisma_yapilan,
               -- 0091: EN ÇOK TAKILDIĞI KONULAR (öğretmenin isteği).
               -- İfade `sinif_ogrenci_ozeti`dekinin BİREBİR AYNISI;
               -- iki uç aynı şeyi iki türlü hesaplarsa bir gün
               -- ayrışır ve veliye başka, öğretmene başka konu
               -- yazılır. Alt sınır 5 soru: tek soruluk bir konudan
               -- "eksik" çıkarmak ölçemeyeceğimiz bir iddia olurdu.
               'eksik_konular', coalesce((
                 select jsonb_agg(t.konu order by t.eksik desc, t.konu)
                   from (
                     select e->>'konu' as konu,
                            sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer)
                              as eksik
                       from public.odevler d
                       join public.gonderimler g
                         on g.odev_id = d.id and g.ogrenci_id = o.id
                       cross join lateral jsonb_array_elements(
                         public._konu_analizi(d.konular, d.cevap_anahtari,
                                              g.cevaplar, d.soru_sayisi)
                       ) e
                      where d.sinif_id = p_sinif_id
                        and d.yayinda
                        and d.son_tarih < bugun_tr
                        and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                        and d.tur = 'test'
                      group by e->>'konu'
                     having sum((e->>'toplam')::integer) >= 5
                        and sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) > 0
                      order by sum((e->>'toplam')::integer) - sum((e->>'dogru')::integer) desc,
                               e->>'konu'
                      limit 3
                   ) t
               ), '[]'::jsonb),
               -- ORTALAMA — `sinif_ogrenci_ozeti` (0051) ile birebir.
               'ortalama', (
                 select round(avg(coalesce(
                          (select coalesce(g.ogretmen_puan, g.puan)
                             from public.gonderimler g
                            where g.odev_id = d.id and g.ogrenci_id = o.id),
                          0)), 2)
                   from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
                    and d.yayinda
                    and d.son_tarih < bugun_tr
                    and d.tur <> 'calisma'
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
               ),
               'yapilan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and d.tur <> 'calisma'
                    and exists (select 1 from public.gonderimler g
                                 where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'yapilmayan', (
                 select count(*)::integer from public.odevler d
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    and d.son_tarih < bugun_tr
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and d.tur <> 'calisma'
                    and not exists (select 1 from public.gonderimler g
                                     where g.odev_id = d.id and g.ogrenci_id = o.id)
               ),
               'puanlar', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'odev_id', d.id,
                          'puan', g.p,
                          -- 0091: VELİ ÇİZELGESİNİN HÜCRESİ.
                          -- Gecikmeli teslim ayrı bir bilgi: ödev
                          -- yapıldı ama sınıfın tarihinden sonra.
                          'gecikmeli', coalesce(g.gec, false),
                          'dogru', g.dogru,
                          'yanlis', g.yanlis,
                          'bos', g.bos,
                          -- HANGİ SORULAR — YALNIZ NUMARA.
                          -- Şık da cevap anahtarı da yok (Kural 6):
                          -- dört şıklı bir soruda işaretlenen şıkkı
                          -- göndermek anahtara doğru bir adım olurdu.
                          -- Yalnız test ödevinde anlamlı; açık uçluda
                          -- anahtar yok ve her soru "boş" görünürdü.
                          'yanlis_sorular', case when g.var and d.tur = 'test'
                            then public._soru_dokumu(d.cevap_anahtari, g.cevaplar,
                                                     d.soru_sayisi) -> 'yanlis'
                            else '[]'::jsonb end,
                          'bos_sorular', case when g.var and d.tur = 'test'
                            then public._soru_dokumu(d.cevap_anahtari, g.cevaplar,
                                                     d.soru_sayisi) -> 'bos'
                            else '[]'::jsonb end,
                          'durum', case
                                     when g.var then 'gonderdi'
                                     -- 0064: sınıfa gelmeden önce son tarihi dolan ödev.
                                     when not public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                                       then 'kapsam_disi'
                                     when d.son_tarih < bugun_tr then 'gondermedi'
                                     else 'suresi_devam'
                                   end
                        ) order by d.son_tarih, d.created_at, d.id)
                   from public.odevler d
                   left join lateral (
                     select true as var, coalesce(gg.ogretmen_puan, gg.puan) as p,
                            -- 0091: veli çizelgesi için gereken alanlar.
                            gg.cevaplar, gg.dogru, gg.yanlis, gg.bos,
                            public._gecikmeli(gg.created_at, d.son_tarih) as gec
                       from public.gonderimler gg
                      where gg.odev_id = d.id and gg.ogrenci_id = o.id
                   ) g on true
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                    -- 0086: sütun yoksa hücre de yok.
                    and d.tur <> 'calisma'
               ), '[]'::jsonb)
             )
             -- SIRA: öğretmenin sınıf sayfasıyla aynı (0044, sayısal numara).
             order by public._numara_sira(o.ogrenci_no) nulls last, o.ad)
        from public.ogrenciler o
        cross join lateral (
          select
            -- 0086: her sayıda çalışma kağıdı DIŞARIDA.
            (count(*) filter (where d.tur <> 'calisma'))::integer as beklenen,
            (count(g.id) filter (where d.tur <> 'calisma'))::integer as yapti,
            round(avg(coalesce(g.ogretmen_puan, g.puan))
                  filter (where g.id is not null and d.tur <> 'calisma'), 1) as ortalama_yapan,
            case when count(*) filter (where d.tur <> 'calisma') > 0 then
              round(sum(coalesce(g.ogretmen_puan, g.puan, 0)) filter (where d.tur <> 'calisma')
                    / count(*) filter (where d.tur <> 'calisma'), 1)
            end as ortalama_tum,
            (count(*) filter (where d.tur = 'calisma'))::integer as calisma_sayisi,
            (count(g.id) filter (where d.tur = 'calisma'))::integer as calisma_yapilan
          from public.odevler d
          left join public.gonderimler g
            on g.odev_id = d.id and g.ogrenci_id = o.id
          where d.sinif_id = p_sinif_id
            and d.yayinda
            and d.son_tarih < bugun_tr
            and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id))
            and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
        ) i
       where o.sinif_id = p_sinif_id and (o.aktif and not o.deneme)
    ), '[]'::jsonb),
    -- SINIFIN AYLIK GELİŞİMİ — süresi dolmuş ödevler, aktif öğrenciler.
    'aylar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ay', a.ay,
               'odev_sayisi', (select count(*)::integer from public.odevler d
                                where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda
                                  and date_trunc('month', d.son_tarih)::date = a.ay),
               'ortalama', (
                 select round(avg(coalesce(g.ogretmen_puan, g.puan)), 1)
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at)
                    and coalesce(g.ogretmen_puan, g.puan) is not null),
               'gonderim_orani', (
                 -- 0064: payda öğrenci × ödev ÇİFTLERİ; sınıfa sonradan gelenin
                 -- gelmeden önceki ödevi paydada yok.
                 select round(100.0 * count(g.id) / nullif(
                          (select count(*) from public.odevler d2
                             join public.ogrenciler o2
                               on o2.sinif_id = p_sinif_id and (o2.aktif and not o2.deneme)
                              and public._odev_ogrenciye_dusar(o2.sinif_giris, d2.son_tarih, d2.created_at)
                            where d2.sinif_id = p_sinif_id
                              and (v_hepsi or public._odeve_erisir(v_okuyan, d2.ogretmen_id, d2.sinif_id)) and d2.yayinda
                              and d2.son_tarih < bugun_tr
                              and date_trunc('month', d2.son_tarih)::date = a.ay), 0))
                   from public.odevler d
                   join public.gonderimler g on g.odev_id = d.id
                   join public.ogrenciler o on o.id = g.ogrenci_id
                  where d.sinif_id = p_sinif_id
                    and (v_hepsi or public._odeve_erisir(v_okuyan, d.ogretmen_id, d.sinif_id)) and d.yayinda and d.son_tarih < bugun_tr
                    and date_trunc('month', d.son_tarih)::date = a.ay
                    and (o.aktif and not o.deneme) and o.sinif_id = p_sinif_id
                    and public._odev_ogrenciye_dusar(o.sinif_giris, d.son_tarih, d.created_at))
             ) order by a.ay)
        from (select generate_series(v_yil_bas, date_trunc('month', bugun_tr)::date,
                                     interval '1 month')::date as ay) a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ogretmen_sinif_ata(p_token text, p_id uuid, p_sinif_idler jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip    uuid;
  n          integer;
  v_ders     uuid[];
  v_yonetici boolean;
begin
  v_sahip := public._yonetici(p_token);

  if jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ogretmenler where id = p_id) then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;

  -- ÖZEL DERS GRUBU ATANAMAZ: özel ders tamamen sahipte (öğretmenin kuralı).
  if exists (
    select 1 from jsonb_array_elements_text(p_sinif_idler) e
    join public.siniflar s on s.id = e::uuid
    where s.ozel
  ) then
    raise exception 'Özel ders grubu başka bir öğretmene atanamaz.' using errcode = '42501';
  end if;

  -- DERS İŞARETİ KORUNUYOR (0092).
  --
  -- Bu uç listeyi `delete` + `insert` ile değiştiriyor. Sütun eklendikten
  -- sonra o desen, sahibin "bu sınıfın dersine girmiyorum" ayarını SESSİZCE
  -- varsayılana (true) döndürürdü ve künyede yine yanlış ad çıkardı.
  -- Eski işaret önce okunuyor, sonra geri yazılıyor.
  select array_agg(sinif_id) into v_ders
    from public.ogretmen_siniflari where ogretmen_id = p_id and ders_veriyor;
  select yonetici into v_yonetici from public.ogretmenler where id = p_id;

  delete from public.ogretmen_siniflari where ogretmen_id = p_id;

  -- YENİ EKLENEN SINIF: yöneticide `false`, öğretmende `true`. Öğretmende
  -- erişim ile ders aynı şey; yöneticide değil (0033 taşıması bütün
  -- sınıfları sahibe bağlamıştı).
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id, ders_veriyor)
  select p_id, e::uuid,
         case when e::uuid = any(coalesce(v_ders, '{}'::uuid[])) then true
              else not coalesce(v_yonetici, false) end
    from jsonb_array_elements_text(p_sinif_idler) e
  on conflict do nothing;

  select count(*) into n from public.ogretmen_siniflari where ogretmen_id = p_id;

  perform public._denetim('ogretmen_siniflari_degisti', 'ogretmenler', p_id, public._aktor(v_sahip),
                          null, jsonb_build_object('sinif_sayisi', n));
  return jsonb_build_object('sinif_sayisi', n);
end;
$$;

create or replace function public.sinif_ekle(p_token text, p_seviye smallint, p_sube text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  yeni public.siniflar;
  v_id uuid;
begin
  v_id := public._yonetici(p_token);

  insert into public.siniflar (seviye, sube)
  values (p_seviye, upper(btrim(p_sube)))
  on conflict (seviye, sube) do update set arsiv = false
  returning * into yeni;

  -- 0092: SINIF EKLEYEN, O SINIFIN DERSİNE GİRMİYOR OLABİLİR.
  --
  -- Bu ucu yalnız yönetici çağırıyor ve yönetici bütün sınıflara bağlanıyor
  -- (erişim için). Ders işareti varsayılanla `true` gelseydi, sahip her yeni
  -- sınıf açtığında o sınıfın veli çizelgesinde kendi adı künyeye yazılırdı —
  -- tam da 0092'nin düzelttiği kusur, arka kapıdan geri gelirdi.
  insert into public.ogretmen_siniflari (ogretmen_id, sinif_id, ders_veriyor)
  values (v_id, yeni.id, false)
  on conflict (ogretmen_id, sinif_id) do nothing;

  perform public._denetim('sinif_eklendi', 'siniflar', yeni.id, public._aktor(v_id),
                          null, to_jsonb(yeni));
  return jsonb_build_object('id', yeni.id, 'ad', yeni.ad);
end;
$$;

create or replace function public.ogretmenler_listesi(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
begin
  v_sahip := public._yonetici(p_token);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'ad', g.ad,
             'sahip', g.yonetici,
             -- 0060: müdür (yalnız izler). Ekran ona sınıf atama ve
             -- "öğretmen olarak gir" düğmesi göstermiyor.
             'mudur', g.mudur,
             'aktif', g.aktif,
             'pin_var', (g.pin_hash is not null),
             -- SINIF KİMLİKLERİ (0050). Ekran bunlarla kutucukları
             -- işaretliyor. Sıra `siniflar_listesi` ile aynı olsun diye
             -- seviye/şubeye göre diziliyor — ekranda karşılaştırması
             -- kolay olsun.
             'sinif_idler', coalesce((
                 select jsonb_agg(os.sinif_id order by s.seviye, s.sube)
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ), '[]'::jsonb),
             -- DERS VERİLEN SINIFLAR (0092). `sinif_idler` ERİŞİMİ
             -- gösteriyor; sahip bütün sınıflara erişiyor ama hepsinin
             -- dersine girmiyor. Veli çizelgesinin künyesi bu ikinci
             -- listeye bakıyor, o yüzden ekranda da ayrı işaretleniyor.
             'ders_sinif_idler', coalesce((
                 select jsonb_agg(os.sinif_id order by s.seviye, s.sube)
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id and os.ders_veriyor
               ), '[]'::jsonb),
             -- SAYI ARTIK DİZİDEN TÜRETİLİYOR. Eskiden ayrı bir
             -- `count(*)` idi; iki hesabın bir gün ayrışması 0030'un
             -- dersiydi (rozet 3 derken listede 2 satır). Tek kaynak.
             'sinif_sayisi', (
                 select count(*)::integer
                   from public.ogretmen_siniflari os
                   join public.siniflar s on s.id = os.sinif_id
                  where os.ogretmen_id = g.id
               ),
             'odev_sayisi',  (select count(*) from public.odevler d where d.ogretmen_id = g.id),
             'son_gorulme',  (select max(o.son_gorulme) from public.oturumlar o
                               where o.ogretmen_id = g.id and o.vekil_id is null)
           ) order by g.yonetici desc, g.ad)
    from public.ogretmenler g
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. YENİ UÇ — DERS VERİLEN SINIFLARI AYARLA
--
-- Sahip ayarlıyor (`_yonetici`), çünkü sınıf atamasını da sahip yapıyor.
-- Yalnız öğretmenin ZATEN ATANMIŞ olduğu sınıflar işaretlenebiliyor:
-- "ders veriyor ama erişimi yok" diye bir hâl olamaz.
-- -----------------------------------------------------------------------------
create or replace function public.ogretmen_ders_siniflari_ayarla(
  p_token text,
  p_id uuid,
  p_sinif_idler jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sahip uuid;
  n integer;
begin
  v_sahip := public._yonetici(p_token);

  if jsonb_typeof(p_sinif_idler) <> 'array' then
    raise exception 'Sınıf listesi bir dizi olmalı.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ogretmenler where id = p_id) then
    raise exception 'Öğretmen bulunamadı.' using errcode = 'P0002';
  end if;

  -- ATANMAMIŞ SINIF İŞARETLENEMEZ. Sessizce yok saymak yerine söyleniyor:
  -- öğretmen "işaretledim ama olmadı" demesin.
  if exists (
    select 1 from jsonb_array_elements_text(p_sinif_idler) e
     where not exists (select 1 from public.ogretmen_siniflari os
                        where os.ogretmen_id = p_id and os.sinif_id = e::uuid)
  ) then
    raise exception 'Önce sınıf atanmalı: ders verilen sınıf, atanmış sınıflardan seçilir.'
      using errcode = '42501';
  end if;

  update public.ogretmen_siniflari os
     set ders_veriyor = (os.sinif_id in (
           select e::uuid from jsonb_array_elements_text(p_sinif_idler) e))
   where os.ogretmen_id = p_id;

  select count(*)::integer into n
    from public.ogretmen_siniflari where ogretmen_id = p_id and ders_veriyor;

  -- Part XLIII: değişiklik iz bırakıyor.
  perform public._denetim('ders_siniflari_degisti', 'ogretmenler', p_id,
                          public._aktor(v_sahip), null,
                          jsonb_build_object('ders_sinif_sayisi', n));
  return jsonb_build_object('ders_sinif_sayisi', n);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. YETKİLER
-- -----------------------------------------------------------------------------
revoke all on function public.ogretmen_ders_siniflari_ayarla(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.ogretmen_ders_siniflari_ayarla(text, uuid, jsonb)
  to anon, authenticated;

-- İmza değişmedi; yetki yine de açıkça veriliyor (0085'in deseni).
grant execute on function public.sinif_not_cizelgesi(text, uuid, boolean)
  to anon, authenticated;
grant execute on function public.ogretmen_sinif_ata(text, uuid, jsonb)
  to anon, authenticated;
grant execute on function public.sinif_ekle(text, smallint, text)
  to anon, authenticated;
grant execute on function public.ogretmenler_listesi(text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t     text;
begin
  -- SÜTUN VE VARSAYILANI.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ogretmen_siniflari'
       and column_name = 'ders_veriyor'
  ) then
    eksik := eksik || 'ders_veriyor sütunu yok'::text;
  elsif exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ogretmen_siniflari'
       and column_name = 'ders_veriyor' and column_default is distinct from 'true'
  ) then
    eksik := eksik || 'ders_veriyor varsayılanı true değil'::text;
  end if;

  -- TAŞIMA: SAHİBİN HİÇBİR KAYDI `true` KALMAMALI. Kalsaydı künyede
  -- yanlış ad basmaya devam ederdi — bu turun tek sebebi o.
  if exists (
    select 1 from public.ogretmen_siniflari os
    join public.ogretmenler g on g.id = os.ogretmen_id
   where g.yonetici and os.ders_veriyor
  ) then
    eksik := eksik || 'sahibin ders işareti taşımada temizlenmemiş'::text;
  end if;

  if to_regprocedure('public.sinif_not_cizelgesi(text,uuid,boolean)') is null then
    eksik := eksik || 'sinif_not_cizelgesi yok'::text;
  else
    t := pg_get_functiondef('public.sinif_not_cizelgesi(text,uuid,boolean)'::regprocedure);

    -- BU TURUN KENDİSİ.
    if t not like '%os.ders_veriyor%' then
      eksik := eksik || 'künye ders süzgecini uygulamıyor'::text;
    end if;

    -- 0091'İN ALANLARI DURUYOR MU (0088'in dersi: kopya geriye almasın).
    if t not like '%_odev_tarihleri(d.id, d.son_tarih)%' then
      eksik := eksik || 'çizelge veriliş tarihini kaybetti'::text;      -- 0091
    end if;
    if t not like '%_odev_kiyasi(d.id)%' then
      eksik := eksik || 'çizelge sınıf/düzey kıyasını kaybetti'::text;  -- 0091
    end if;
    if t not like '%_soru_dokumu%' then
      eksik := eksik || 'çizelge soru dökümünü kaybetti'::text;         -- 0091
    end if;
    if t not like '%case when g.var and d.tur = ''test''%' then
      eksik := eksik || 'soru dökümü tür süzgecini kaybetti'::text;     -- Kural 6
    end if;
    if t not like '%''eksik_konular''%' then
      eksik := eksik || 'çizelge eksik konuları kaybetti'::text;        -- 0091
    end if;
    if t not like '%''gecikmeli'', coalesce(g.gec, false)%' then
      eksik := eksik || 'çizelge gecikmeli teslimi kaybetti'::text;     -- 0091
    end if;
    if t not like '%''puanlar''%' or t not like '%''kapsam_disi''%'
       or t not like '%''suresi_devam''%' then
      eksik := eksik || 'çizelge puan ızgarasını kaybetti'::text;       -- 0086
    end if;
    if t not like '%''aylar''%' then
      eksik := eksik || 'çizelge aylık gelişimi kaybetti'::text;        -- 0061
    end if;
    if t not like '%''calisma_sayisi''%' then
      eksik := eksik || 'çizelge çalışma kağıdı satırını kaybetti'::text; -- 0086
    end if;
    if t not like '%''ortalama_tum''%' or t not like '%''ortalama_yapan''%' then
      eksik := eksik || 'çizelge iki ortalamadan birini kaybetti'::text;  -- 0080
    end if;
    if t not like '%''kapsam''%' or t not like '%_odeve_erisir%' then
      eksik := eksik || 'çizelge ödev kapsamını kaybetti'::text;        -- 0063
    end if;
    if t not like '%_odev_ogrenciye_dusar%' then
      eksik := eksik || 'çizelge sınıf listesi esasını kaybetti'::text; -- 0064
    end if;
    if t not like '%not o.deneme%' and t not like '%not k.deneme%' then
      eksik := eksik || 'çizelge deneme hesabını saymaya başladı'::text; -- 0073
    end if;
  end if;

  -- `ogretmen_sinif_ata` DERS İŞARETİNİ KORUYOR MU. Korumazsa her sınıf
  -- atamasında sahibin ayarı sessizce silinirdi.
  if to_regprocedure('public.ogretmen_sinif_ata(text,uuid,jsonb)') is null then
    eksik := eksik || 'ogretmen_sinif_ata yok'::text;
  else
    t := pg_get_functiondef('public.ogretmen_sinif_ata(text,uuid,jsonb)'::regprocedure);
    if t not like '%v_ders%' or t not like '%ders_veriyor%' then
      eksik := eksik || 'ogretmen_sinif_ata ders işaretini korumuyor'::text;
    end if;
    -- 0033'ün kuralı duruyor mu.
    if t not like '%Özel ders grubu başka bir öğretmene atanamaz%' then
      eksik := eksik || 'ogretmen_sinif_ata özel ders korumasını kaybetti'::text;
    end if;
  end if;

  -- `sinif_ekle` ARKA KAPIYI KAPATIYOR MU. Yönetici her yeni sınıfa
  -- bağlanıyor; ders işareti varsayılanla gelseydi kusur geri dönerdi.
  if to_regprocedure('public.sinif_ekle(text,smallint,text)') is null then
    eksik := eksik || 'sinif_ekle yok'::text;
  else
    t := pg_get_functiondef('public.sinif_ekle(text,smallint,text)'::regprocedure);
    if t not like '%ders_veriyor%' then
      eksik := eksik || 'sinif_ekle ders işaretini yazmıyor'::text;
    end if;
  end if;

  -- EKRAN BAŞLANGIÇ DURUMUNU BİLMELİ: `ogretmenler_listesi` ders
  -- listesini de veriyor, yoksa pencere işaretleri boş açılırdı ve
  -- kaydetmek ayarı silerdi (0050'nin canlı hatasının aynısı).
  if to_regprocedure('public.ogretmenler_listesi(text)') is null then
    eksik := eksik || 'ogretmenler_listesi yok'::text;
  else
    t := pg_get_functiondef('public.ogretmenler_listesi(text)'::regprocedure);
    if t not like '%ders_sinif_idler%' then
      eksik := eksik || 'ogretmenler_listesi ders listesini vermiyor'::text;
    end if;
    if t not like '%''sinif_idler''%' then
      eksik := eksik || 'ogretmenler_listesi erişim listesini kaybetti'::text;  -- 0050
    end if;
    if t not like '%''mudur''%' then
      eksik := eksik || 'ogretmenler_listesi müdür alanını kaybetti'::text;     -- 0060
    end if;
  end if;

  if to_regprocedure('public.ogretmen_ders_siniflari_ayarla(text,uuid,jsonb)') is null then
    eksik := eksik || 'ogretmen_ders_siniflari_ayarla yok'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0092 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0092');
