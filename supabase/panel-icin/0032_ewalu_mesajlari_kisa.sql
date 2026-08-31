-- SEKİZ — 0032: Ewalu'nun puan cümlelerini öğretmen yazsın
-- Supabase panelinde SQL Editor'a yapıştırıp Run deyin.
-- Beklenen sonuç: "Success. No rows returned."
-- Açıklamalı tam sürüm: supabase/migrations/0032_ewalu_mesajlari.sql
--
-- Çalıştırılmazsa hiçbir şey bozulmaz: Ewalu mesajları ekranı "henüz hazır
-- değil" der, öğrenciler bugünkü cümleleri görmeye devam eder.
--
-- Yazdığınız cümleler YEDEĞE GİRER — bu dosya `disa_aktar`'ı da güncelliyor.

create table if not exists public.ewalu_mesajlari (
  bant       smallint primary key check (bant in (0, 50, 70, 85, 100)),
  cumle      text not null check (btrim(cumle) <> '' and length(cumle) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ewalu_mesajlari_updated_at on public.ewalu_mesajlari;
create trigger ewalu_mesajlari_updated_at before update on public.ewalu_mesajlari
  for each row execute function public.tetik_updated_at();

-- RLS: 0002'deki desenin aynısı — doğrudan erişim yok, her şey
-- SECURITY DEFINER fonksiyonlardan.
alter table public.ewalu_mesajlari enable row level security;
alter table public.ewalu_mesajlari force row level security;
drop policy if exists ewalu_mesajlari_dogrudan_erisim_yok on public.ewalu_mesajlari;
create policy ewalu_mesajlari_dogrudan_erisim_yok on public.ewalu_mesajlari
  for all to anon, authenticated using (false) with check (false);

revoke all on table public.ewalu_mesajlari from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ewalu_mesajlari(p_token) — okuma
--
-- ÖĞRETMEN VE ÖĞRENCİ çağırabiliyor; VELİ ÇAĞIRAMIYOR.
--
-- Veli sınırı keyfî değil, ölçülmüş: bu cümle yalnız öğrencinin teslim
-- sonucu kartında çıkıyor (`OdevTeslim.tsx`, `EwaluSozu`) ve cümleler
-- "sen" diye sesleniyor. Velinin hiçbir ekranında yok, dolayısıyla
-- velinin bu veriyi istemesi için bir sebep de yok. En dar yetki.
--
-- Yalnız DEĞİŞTİRİLMİŞ bantlar dönüyor. İstemci varsayılanların üstüne
-- bunları yazıyor; boş dizi "hiçbir şey değişmemiş" demek ve ekran
-- bugünkü cümleleri gösteriyor.
-- -----------------------------------------------------------------------------
create or replace function public.ewalu_mesajlari(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  o record;
begin
  select * into o from public._oturum(p_token);
  if o.rol not in ('ogretmen', 'ogrenci') then
    raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
  end if;

  return coalesce(
    (select jsonb_agg(jsonb_build_object('bant', e.bant, 'cumle', e.cumle)
                      order by e.bant desc)
       from public.ewalu_mesajlari e),
    '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. ewalu_mesaj_yaz(p_token, p_bant, p_cumle) — yazma, öğretmene özel
--
-- `p_cumle` DOLUYSA yazar/günceller, `null` İSE SATIRI SİLER.
--
-- Silme "varsayılana dön" demek ve ayrı bir uç yazmaya gerek bırakmıyor:
-- tablo zaten yalnız değişiklikleri tutuyor, satır gidince kod içindeki
-- varsayılan geri geliyor. İki uç yerine bir uç, iki kod yolu yerine bir
-- kod yolu.
--
-- DENETİM İZİ ZORUNLU (Part XLIII ruhu). Bu metin HER ÇOCUĞUN okuduğu
-- metin; "ne zaman ne yazıldı, öncesi neydi" izsiz kalmamalı. `kayit_id`
-- uuid olduğu için bant bilgisi gövdeye konuyor.
-- -----------------------------------------------------------------------------
create or replace function public.ewalu_mesaj_yaz(
  p_token text,
  p_bant  smallint,
  p_cumle text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  temiz text;
  eski  text;
begin
  perform public._ogretmen(p_token);

  if p_bant is null or p_bant not in (0, 50, 70, 85, 100) then
    raise exception 'Geçersiz puan bandı. Bantlar: 0, 50, 70, 85, 100.'
      using errcode = '22023';
  end if;

  select e.cumle into eski from public.ewalu_mesajlari e where e.bant = p_bant;

  -- VARSAYILANA DÖNÜŞ.
  if p_cumle is null then
    if eski is null then
      -- Zaten varsayılanda; sessizce "tamam" demek yerine durumu bildiriyoruz.
      return jsonb_build_object('bant', p_bant, 'cumle', null, 'degisti', false);
    end if;
    delete from public.ewalu_mesajlari where bant = p_bant;
    perform public._denetim('ewalu_mesaji_varsayilana_dondu', 'ewalu_mesajlari',
              null, 'ogretmen',
              jsonb_build_object('bant', p_bant, 'cumle', eski),
              jsonb_build_object('bant', p_bant, 'cumle', null));
    return jsonb_build_object('bant', p_bant, 'cumle', null, 'degisti', true);
  end if;

  -- `btrim` önce: baştaki/sondaki boşluk hem boşluk denetimini hem uzunluk
  -- denetimini yanıltırdı. 0027'de aynı tuzak (sekme ve satır sonu boş
  -- sayılmıyordu) ürünün başka bir yerinde yaşanmıştı.
  temiz := btrim(p_cumle);

  if temiz = '' then
    raise exception 'Cümle boş olamaz. Varsayılana dönmek için "Varsayılana dön" düğmesini kullanın.'
      using errcode = '22023';
  end if;

  if length(temiz) > 400 then
    raise exception 'Cümle en fazla 400 karakter olabilir (şu an %).', length(temiz)
      using errcode = '22023';
  end if;

  insert into public.ewalu_mesajlari (bant, cumle) values (p_bant, temiz)
  on conflict (bant) do update set cumle = excluded.cumle;

  perform public._denetim('ewalu_mesaji_degisti', 'ewalu_mesajlari',
            null, 'ogretmen',
            jsonb_build_object('bant', p_bant, 'cumle', eski),
            jsonb_build_object('bant', p_bant, 'cumle', temiz));

  return jsonb_build_object('bant', p_bant, 'cumle', temiz, 'degisti', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. disa_aktar — yeni tablo YEDEĞE giriyor
--
-- Gövde 0004:901'den BİREBİR kopyalandı, tek ekleme son satır. İmza
-- değişmiyor, yani 0007 tuzağı açılmıyor.
--
-- Bu ekleme bu turun sessiz ama en önemli maddesi: yapılmasaydı öğretmenin
-- yazdığı cümleler yedekte olmaz ve bir felakette geri gelmezdi.
-- `supabase/geri-yukleme/geri-yukle.sql` de aynı turda güncelleniyor.
-- -----------------------------------------------------------------------------
create or replace function public.disa_aktar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._ogretmen(p_token);
  perform public._denetim('disa_aktarildi', null, null, 'ogretmen');

  return jsonb_build_object(
    'alindi', now(),
    'siniflar',  coalesce((select jsonb_agg(to_jsonb(s) order by s.seviye, s.sube) from public.siniflar s), '[]'::jsonb),
    'ogrenciler', coalesce((select jsonb_agg(to_jsonb(o) order by o.ad) from public.ogrenciler o), '[]'::jsonb),
    'giris_kodlari', coalesce((select jsonb_agg(to_jsonb(k)) from public.giris_kodlari k), '[]'::jsonb),
    'odevler',   coalesce((select jsonb_agg(to_jsonb(d)) from public.odevler d), '[]'::jsonb),
    'gonderimler', coalesce((select jsonb_agg(to_jsonb(g)) from public.gonderimler g), '[]'::jsonb),
    'mesajlar',  coalesce((select jsonb_agg(to_jsonb(m)) from public.mesajlar m), '[]'::jsonb),
    'dersler',   coalesce((select jsonb_agg(to_jsonb(l)) from public.dersler l), '[]'::jsonb),
    'odemeler',  coalesce((select jsonb_agg(to_jsonb(p)) from public.odemeler p), '[]'::jsonb),
    'ewalu_mesajlari', coalesce((select jsonb_agg(to_jsonb(e) order by e.bant desc) from public.ewalu_mesajlari e), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Yetkiler — 0005 deseni: önce toptan geri al, sonra açıkça ver
-- -----------------------------------------------------------------------------
revoke all on function public.ewalu_mesajlari(text)                  from public, anon, authenticated;
revoke all on function public.ewalu_mesaj_yaz(text, smallint, text)  from public, anon, authenticated;

grant execute on function public.ewalu_mesajlari(text)                 to anon, authenticated;
grant execute on function public.ewalu_mesaj_yaz(text, smallint, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. KENDİ KENDİNİ DENETLEME
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.ewalu_mesajlari(text)') is null
     or to_regprocedure('public.ewalu_mesaj_yaz(text,smallint,text)') is null then
    raise exception '0032: uçlar oluşmadı.';
  end if;

  -- YEDEĞE GİRDİĞİNİN KİLİDİ. Bu denetim olmasaydı, biri bir gün
  -- `disa_aktar`'ı başka bir turda yeniden yazıp bu satırı düşürebilir ve
  -- öğretmenin cümleleri sessizce yedekten çıkardı. Anahtar adı
  -- TIRNAKLARIYLA aranıyor: 0031'de çıplak desenin yeniden adlandırılmış
  -- bir alanla da eşleştiği ölçülmüştü.
  if pg_get_functiondef(to_regprocedure('public.disa_aktar(text)'))
     not like '%''ewalu_mesajlari''%' then
    raise exception '0032: disa_aktar ewalu_mesajlari tablosunu yedeklemiyor.';
  end if;

  -- PIN YEDEĞE GİRMİYOR — mevcut güvence bozulmadı (docs/yedekleme.md).
  if pg_get_functiondef(to_regprocedure('public.disa_aktar(text)'))
     like '%ogretmen_pin_hash%' then
    raise exception '0032: disa_aktar PIN hash''ini yedeğe koyuyor.';
  end if;

  -- Tablo boş başlamalı: varsayılanlar KODDA, burada değil.
  if exists (select 1 from public.ewalu_mesajlari) then
    raise notice '0032: ewalu_mesajlari boş değil — öğretmenin yazdığı cümleler korunuyor.';
  end if;
end;
$$;

do $$ begin raise notice 'Ewalu mesajları hazır: öğretmen cümleleri yazabiliyor, varsayılana dönebiliyor.'; end $$;
