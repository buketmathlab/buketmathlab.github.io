-- SEKİZ — 0031: düzeltmeyi kardeş ödevlere yayma
--
-- NEDEN VAR
-- 0030 aynı ödevi birden çok sınıfa vermeyi getirdi ama düzeltmeyi yaymayı
-- BİLEREK dışarıda bıraktı: "ayrı ve daha büyük bir tur" diye not düşülmüştü.
-- Bu o tur.
--
-- Bugünkü durum ölçüldü: aynı test 9A, 9B, 9C'ye verildiğinde ÜÇ BAĞIMSIZ
-- `odevler` satırı oluşuyor, her birinin kendi cevap anahtarı var, aralarındaki
-- tek bağ `grup_id`. `odev_guncelle` yalnız kendi `p_id`'sinin gönderimlerini
-- yeniden puanlıyor (0020). Yani öğretmen 9B'de bir anahtar hatasını
-- düzeltince 9A ve 9C'de YANLIŞ NOTLAR SESSİZCE KALIYOR.
--
-- Ekran bunu söylüyordu ama çözmüyordu ("diğerlerini ayrı ayrı düzenleyin").
-- Paralel şubelere aynı sınav verildiğinde ve anahtar hatası yayından sonra
-- bulunduğunda, bu ürünün en ağır meselesine — not doğruluğuna — dokunuyor.
--
-- ÖĞRETMENİN İKİ KARARI
--   1. Taşınan: cevap anahtarı, soru sayısı, şık sayısı, konular, iki PDF,
--      başlık, açıklama. TAŞINMAYAN: son tarih, geç teslim, yayında olma —
--      bunlar her sınıfın kendi programı. Sınıf hiçbir koşulda değişmez.
--   2. Yayma OTOMATİK DEĞİL: öğretmen önce kendi sınıfını kaydedip sonucu
--      görüyor, sonra ayrı bir düğmeyle yaymaya karar veriyor.
--
-- `odev_guncelle`'YE DOKUNULMUYOR — ve bu bilinçli. İmzasına bir
-- `p_kardeslere_yay` parametresi eklemek 0007 tuzağını davet ederdi: PostgreSQL
-- parametre eklenince YENİ bir fonksiyon üretir, eski imza `grant`'iyle
-- birlikte ayakta kalır ve arayüz sessizce eski davranışa düşebilir. Ayrı uç
-- o tuzağı hiç açmıyor.

-- -----------------------------------------------------------------------------
-- 1. odev_kardeslere_yay — kaynaktan kardeşlere içerik kopyalama
-- -----------------------------------------------------------------------------
create or replace function public.odev_kardeslere_yay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d       public.odevler;   -- kaynak
  k       record;           -- kardeş
  eski    public.odevler;   -- kardeşin yayma ÖNCESİ hâli (denetim izi için)
  g       record;
  yeni    record;
  anahtar_degisti boolean;
  rapor   jsonb := '[]'::jsonb;
  puanlar jsonb;
begin
  perform public._ogretmen(p_token);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;

  -- SESSİZ "TAMAM" YOK. Kardeşi olmayan bir ödevde hiçbir şey yapmayıp
  -- başarı dönmek, öğretmene yayıldığını sandırırdı.
  if d.grup_id is null then
    raise exception 'Bu ödev tek sınıfa verilmiş; yayılacak kardeş ödev yok.'
      using errcode = '22023';
  end if;

  for k in
    select d2.id, d2.sinif_id, s2.ad as sinif_ad
      from public.odevler d2
      join public.siniflar s2 on s2.id = d2.sinif_id
     where d2.grup_id = d.grup_id and d2.id <> p_id
     order by s2.seviye, s2.sube
  loop
    -- ARŞİVDEKİ SINIF ATLANIYOR (0016 kuralı).
    -- Arşivdeki sınıf öğretmenin hiçbir listesinde görünmüyor; görünmeyen bir
    -- sınıfın notunu sessizce değiştirmek o kuralı delerdi. Atlandığı raporda
    -- yazıyor — sessiz atlama da yok.
    if public._sinif_arsivde(k.sinif_id) then
      rapor := rapor || jsonb_build_object(
        'sinif', k.sinif_ad, 'odev_id', k.id,
        'yeniden_puanlanan', '[]'::jsonb, 'atlandi', 'arsiv');
      continue;
    end if;

    select * into eski from public.odevler where id = k.id;

    -- Anahtar bu kardeş için gerçekten değişiyor mu? Yalnız test ödevinde
    -- anlamlı; açık uçluda anahtar da soru sayısı da null.
    anahtar_degisti := eski.tur = 'test'
      and ((d.cevap_anahtari is distinct from eski.cevap_anahtari)
        or (d.soru_sayisi is distinct from eski.soru_sayisi));

    -- TAŞINAN ALANLAR — öğretmenin kararı, birebir.
    -- sinif_id, son_tarih, gec_teslim, yayinda ve grup_id BİLEREK YOK.
    update public.odevler
       set baslik         = d.baslik,
           aciklama       = d.aciklama,
           soru_sayisi    = d.soru_sayisi,
           cevap_anahtari = d.cevap_anahtari,
           sik_sayisi     = d.sik_sayisi,
           konular        = public._konu_temizle(d.konular, d.soru_sayisi),
           anahtar_url    = d.anahtar_url,
           odev_url       = d.odev_url
     where id = k.id;

    perform public._denetim('kardeslere_yayildi', 'odevler', k.id, 'ogretmen',
                            to_jsonb(eski),
                            (select to_jsonb(o) from public.odevler o where o.id = k.id));

    -- -------------------------------------------------------------------
    -- YENİDEN PUANLAMA — gövde odev_guncelle'den (0020) BİREBİR kopyalandı.
    -- Ezberden yazmak 0016'da iki hataya yol açmıştı; o adım atlanmıyor.
    -- -------------------------------------------------------------------
    puanlar := '[]'::jsonb;
    if anahtar_degisti then
      for g in
        select gn.id, gn.ogrenci_id, gn.cevaplar, gn.puan, gn.dogru, gn.yanlis, gn.bos,
               o.ad as ogrenci_ad
          from public.gonderimler gn
          join public.ogrenciler o on o.id = gn.ogrenci_id
         where gn.odev_id = k.id
      loop
        select * into yeni
        from public._puanla(coalesce(d.cevap_anahtari, '{}'::jsonb),
                            coalesce(g.cevaplar, '{}'::jsonb),
                            d.soru_sayisi);

        if yeni.puan is distinct from g.puan then
          update public.gonderimler
             set dogru = yeni.dogru, yanlis = yeni.yanlis,
                 bos = yeni.bos, puan = yeni.puan
           where id = g.id;

          -- Not değişikliği HER ZAMAN iz bırakır (Part XLIII).
          perform public._denetim(
            'yeniden_puanlandi', 'gonderimler', g.id, 'ogretmen',
            jsonb_build_object('puan', g.puan, 'dogru', g.dogru,
                               'yanlis', g.yanlis, 'bos', g.bos),
            jsonb_build_object('puan', yeni.puan, 'dogru', yeni.dogru,
                               'yanlis', yeni.yanlis, 'bos', yeni.bos));

          puanlar := puanlar || jsonb_build_object(
            'ogrenci', g.ogrenci_ad,
            'eski_puan', g.puan,
            'yeni_puan', yeni.puan);
        end if;
      end loop;
    end if;

    rapor := rapor || jsonb_build_object(
      'sinif', k.sinif_ad, 'odev_id', k.id,
      'yeniden_puanlanan', puanlar, 'atlandi', null);
  end loop;

  return rapor;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. odev_detay — gövde 0030'dan BİREBİR, tek ekleme `kardes_detay`
--
-- `kardesler` AYNEN KALIYOR: `odevler_listesi` ve Odevler.tsx onu sınıf adı
-- DİZİSİ olarak kullanıyor; şeklini değiştirmek o ekranı kırardı. Yayma
-- düğmesinin ihtiyacı olan bilgi (hangi kardeş, kaç gönderim, anahtar zaten
-- aynı mı, arşivde mi) ayrı bir alanda. `odevler_listesi`'ne dokunulmuyor.
-- -----------------------------------------------------------------------------
create or replace function public.odev_detay(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  d public.odevler;
  s public.siniflar;
begin
  perform public._ogretmen(p_token);

  select * into d from public.odevler where id = p_id;
  if not found then
    raise exception 'Ödev bulunamadı.' using errcode = 'P0002';
  end if;
  select * into s from public.siniflar where id = d.sinif_id;

  return jsonb_build_object(
    'id', d.id,
    'baslik', d.baslik,
    'aciklama', d.aciklama,
    'tur', d.tur,
    'sinif_id', d.sinif_id,
    'sinif', s.ad,
    'son_tarih', d.son_tarih,
    'soru_sayisi', d.soru_sayisi,
    'gec_teslim', d.gec_teslim,
    'konular', coalesce(d.konular, '{}'::jsonb),
    'sik_sayisi', d.sik_sayisi,
    'cevap_anahtari', coalesce(d.cevap_anahtari, '{}'::jsonb),
    'anahtar_yolu', d.anahtar_url,
    'odev_yolu', d.odev_url,
    'yayinda', d.yayinda,
    'kardesler', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(s2.ad order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'kardes_detay', case when d.grup_id is not null then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', d2.id,
               'sinif', s2.ad,
               'gonderim_sayisi', (select count(*) from public.gonderimler g
                                    where g.odev_id = d2.id),
               'anahtar_ayni', (d2.cevap_anahtari is not distinct from d.cevap_anahtari),
               'arsiv', public._sinif_arsivde(d2.sinif_id)
             ) order by s2.seviye, s2.sube), '[]'::jsonb)
        from public.odevler d2
        join public.siniflar s2 on s2.id = d2.sinif_id
       where d2.grup_id = d.grup_id and d2.id <> d.id
    ) end,
    'gonderim_sayisi', (select count(*) from public.gonderimler g where g.odev_id = d.id),
    'gec_gonderim_sayisi', (
      select count(*) from public.gonderimler g
      where g.odev_id = d.id and public._gecikmeli(g.created_at, d.son_tarih)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. YETKİLER (0005 deseni)
-- -----------------------------------------------------------------------------
revoke all on function public.odev_kardeslere_yay(text, uuid) from public, anon, authenticated;
grant execute on function public.odev_kardeslere_yay(text, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.odev_kardeslere_yay(text,uuid)') is null then
    raise exception '0031: odev_kardeslere_yay oluşmadı.';
  end if;

  -- ANAHTAR ADI TIRNAKLARIYLA ARANIYOR. Geri alma kanıtında ölçüldü: çıplak
  -- `%kardes_detay%` deseni, alan `kardes_detay_yok` diye yeniden
  -- adlandırıldığında da eşleşiyordu — yani denetim bir şey ölçmüyordu.
  if pg_get_functiondef(to_regprocedure('public.odev_detay(text,uuid)'))
     not like '%''kardes_detay''%' then
    raise exception '0031: odev_detay kardes_detay alanını döndürmüyor.';
  end if;

  -- 0030'un güvencesi bozulmadı: `kardesler` hâlâ yerinde.
  if pg_get_functiondef(to_regprocedure('public.odev_detay(text,uuid)'))
     not like '%''kardesler''%' then
    raise exception '0031: odev_detay kardesler alanını kaybetti.';
  end if;

  -- TAŞINMAYANLAR KODDA DA YOK. Bu denetim öğretmenin kararının kilidi:
  -- biri bir gün `son_tarih` ya da `yayinda` alanını update listesine
  -- eklerse migration burada patlar.
  --
  -- Desen dar tutuldu (`= d.` şartı): gövdede `s2.id = d2.sinif_id` gibi
  -- masum eşleşmeler ve açıklama satırları var; geniş bir desen onlara
  -- takılıp migration'ı boş yere kırardı. Yakalanan tek şey, kaynaktan
  -- kardeşe ATAMA yapılması.
  if pg_get_functiondef(to_regprocedure('public.odev_kardeslere_yay(text,uuid)'))
     ~ '\m(son_tarih|gec_teslim|yayinda|sinif_id)\s*=\s*d\.' then
    raise exception
      '0031: yayma, taşınmaması gereken bir alanı güncelliyor (son_tarih / gec_teslim / yayinda / sinif_id).';
  end if;
end;
$$;
