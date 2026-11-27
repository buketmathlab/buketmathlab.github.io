-- SEKİZ — 0091: Veli çizelgesi (not çizelgesi ayrıntılanıyor)
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Açıklamalı tam sürüm: supabase/migrations/0091_veli_cizelgesi.sql
--
-- ÖNCE YEDEK ALIN. (Öğretmen ekranı → Ayarlar → Verinizin yedeği)
-- 0090 ÇALIŞMIŞ OLMALI. Edge Function DEĞİŞMİYOR.
--
-- NE YAPIYOR
--
-- Veli toplantısı için her veliye kesilip verilen ödev çizelgesini
-- besliyor. "Sınıf çıktısı" ekranındaki veli fişi bugün de var ama ÖZET
-- taşıyor; bu dosya ödevin kendisini ekliyor:
--
--   • ÖDEV NE ZAMAN VERİLDİ — taslağın açıldığı an değil, yayına
--     alındığı gün (0085'in hesabı),
--   • O ÖDEVDE SINIFIN ve DÜZEYİN (tüm şubelerin) ortalaması, İSİMSİZ
--     (0047'nin hesabı),
--   • hangi soruları yanlış yaptı, hangilerini boş bıraktı — YALNIZ
--     NUMARA, şık yok,
--   • gecikmeli teslim işareti,
--   • en çok takıldığı konular.
--
-- HİÇBİR SATIR EKLENMİYOR, SİLİNMİYOR, DEĞİŞTİRİLMİYOR: yalnız bir
-- okuma ucu daha fazla alan döndürüyor.
--
-- TESLİM SAYILARI YİNE GİTMİYOR. Sınıf ortalaması yazıyor ama kaç
-- öğrencinin teslim ettiği yazmıyor — sizin kararınız: "Teslim sayısı
-- veliye ya da öğrenciye gösterilmesin."
--
-- CEVAP ANAHTARI VELİYE GİTMİYOR (Kural 6): çizelgede yalnız soru
-- numarası var, işaretlenen şık yok.
--
-- SINIFA SONRADAN KATILAN ÖĞRENCİ, gelmeden önce süresi dolmuş ödevde
-- "göndermedi" DEĞİL, "sınıfa sonra katıldı" olarak yazılıyor.
--
-- Beklenen sonuç: en altta tek satırlık bir tablo (_migration_kaydet → 0091).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. ÖNKOŞUL
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public._gonderim_yeniden_acma(uuid,uuid)') is null then
    raise exception '0091: önce 0090 çalıştırılmalı';
  end if;
end $$;

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
           where os.sinif_id = p_sinif_id and g.aktif and not g.mudur
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
-- İmza değişmedi; yetki yine de açıkça veriliyor (0085'in deseni) ki bir
-- gün imza değişirse 0007 tuzağı sessizce kurulmasın.
grant execute on function public.sinif_not_cizelgesi(text, uuid, boolean)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ÖZ-DENETİM
-- -----------------------------------------------------------------------------
do $$
declare
  eksik text[] := '{}';
  t     text;
begin
  if to_regprocedure('public.sinif_not_cizelgesi(text,uuid,boolean)') is null then
    eksik := eksik || 'sinif_not_cizelgesi yok'::text;
  else
    t := pg_get_functiondef('public.sinif_not_cizelgesi(text,uuid,boolean)'::regprocedure);

    -- YENİ ALANLAR.
    if t not like '%_odev_tarihleri(d.id, d.son_tarih)%' then
      eksik := eksik || 'çizelge veriliş tarihini vermiyor'::text;
    end if;
    if t not like '%_odev_kiyasi(d.id)%' then
      eksik := eksik || 'çizelge sınıf/düzey kıyasını vermiyor'::text;
    end if;
    if t not like '%_soru_dokumu%' then
      eksik := eksik || 'çizelge soru dökümünü vermiyor'::text;
    end if;
    if t not like '%''gecikmeli'', coalesce(g.gec, false)%' then
      eksik := eksik || 'çizelge gecikmeli teslimi vermiyor'::text;
    end if;
    if t not like '%''eksik_konular''%' then
      eksik := eksik || 'çizelge eksik konuları vermiyor'::text;
    end if;

    -- KURAL 6 — DÖKÜM YALNIZ TEST ÖDEVİNDE. Açık uçluda anahtar yok ve
    -- her soru "boş" görünürdü; o sayı veliye yanlış bilgi olurdu.
    if t not like '%case when g.var and d.tur = ''test''%' then
      eksik := eksik || 'soru dökümü tür süzgeci olmadan veriliyor'::text;
    end if;

    -- 0086'NIN ALANLARI DURUYOR MU (0088'in dersi: kopya geriye almasın).
    if t not like '%''puanlar''%' or t not like '%''kapsam_disi''%'
       or t not like '%''suresi_devam''%' then
      eksik := eksik || 'çizelge puan ızgarasını kaybetti'::text;
    end if;
    if t not like '%''aylar''%' then
      eksik := eksik || 'çizelge aylık gelişimi kaybetti'::text;   -- 0061
    end if;
    if t not like '%''calisma_sayisi''%' then
      eksik := eksik || 'çizelge çalışma kağıdı satırını kaybetti'::text;  -- 0086
    end if;
    if t not like '%''ortalama_tum''%' or t not like '%''ortalama_yapan''%' then
      eksik := eksik || 'çizelge iki ortalamadan birini kaybetti'::text;   -- 0080
    end if;
    if t not like '%''kapsam''%' or t not like '%_odeve_erisir%' then
      eksik := eksik || 'çizelge ödev kapsamını kaybetti'::text;    -- 0063
    end if;
    if t not like '%_odev_ogrenciye_dusar%' then
      eksik := eksik || 'çizelge sınıf listesi esasını kaybetti'::text;    -- 0064
    end if;
    if t not like '%not o.deneme%' and t not like '%not k.deneme%' then
      eksik := eksik || 'çizelge deneme hesabını saymaya başladı'::text;   -- 0073
    end if;
  end if;

  -- YARDIMCILAR İSTEMCİYE KAPALI KALDI MI. Çizelge onları `security
  -- definer` olarak çağırıyor; doğrudan açık olsalardı herhangi bir
  -- istemci başka sınıfların ortalamasını okuyabilirdi.
  if has_function_privilege('anon', 'public._odev_kiyasi(uuid)', 'execute') then
    eksik := eksik || '_odev_kiyasi anon''a açık'::text;
  end if;
  if has_function_privilege('anon',
        'public._odev_tarihleri(uuid, date)', 'execute') then
    eksik := eksik || '_odev_tarihleri anon''a açık'::text;
  end if;

  if array_length(eksik, 1) > 0 then
    raise exception '0091 eksik: %', array_to_string(eksik, ' | ');
  end if;
end $$;

select public._migration_kaydet('0091');
