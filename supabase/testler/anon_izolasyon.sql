-- =============================================================================
-- SEKİZ — anon rolü izolasyon testleri
--
-- Bu dosya, dışarıdan (tarayıcıdan) erişilebilen `anon` rolünün NE
-- YAPAMAYACAĞINI doğrular. Faz 1'de burada gerçek bir açık yakalandı:
-- PostgreSQL yeni fonksiyonlara PUBLIC üzerinden EXECUTE veriyordu ve
-- `_oturum_ac('ogretmen', null)` dışarıdan çağrılabiliyordu — PIN bilmeden
-- öğretmen jetonu üretmek mümkündü. 0005 bunu kapattı; bu test nöbette.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
declare
  t text;
  f text;
  sonuc text;
  tablolar text[] := array['ogrenciler','odevler','gonderimler','giris_kodlari',
                           'ayarlar','oturumlar','denetim_izi','mesajlar',
                           'odemeler','dersler','siniflar','okundu',
                           'giris_denemeleri'];
  dahili text[] := array[
    '_oturum_ac(''ogretmen'',null)',
    '_yeni_kod()',
    '_token_hash(''x'')',
    '_puanla(''{}''::jsonb,''{}''::jsonb,1)',
    '_istemci_kimligi()',
    '_kilitli_mi(''x'')',
    'oturum_temizle()'
  ];
begin
  raise notice '--- Doğrudan tablo erişimi (hepsi reddedilmeli) ---';
  foreach t in array tablolar loop
    begin
      execute format('set local role anon');
      execute format('select 1 from public.%I limit 1', t);
      reset role;
      raise exception 'KRİTİK: anon % tablosunu okuyabiliyor!', t;
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm like 'KRİTİK%' then raise; end if;
    end;
  end loop;
  raise notice '    % tablonun tamamı reddedildi: OK', array_length(tablolar, 1);

  raise notice '--- Dahili fonksiyonlar (hepsi reddedilmeli) ---';
  foreach f in array dahili loop
    begin
      execute format('set local role anon');
      execute format('select public.%s', f);
      reset role;
      raise exception 'KRİTİK: anon public.% fonksiyonunu çağırabiliyor!', f;
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm like 'KRİTİK%' then raise; end if;
    end;
  end loop;
  raise notice '    % dahili fonksiyonun tamamı reddedildi: OK', array_length(dahili, 1);

  raise notice '--- Açık RPC çalışmaya devam etmeli ---';
  set local role anon;
  select (public.giris('GECERSIZKOD')) ->> 'rol' into sonuc;
  reset role;
  assert sonuc in ('yok', 'kurulum'), 'Açık giris() fonksiyonu çalışmalı';
  raise notice '    giris() anon tarafından çağrılabiliyor: OK';

  raise notice '';
  raise notice 'ANON İZOLASYON TESTLERİ GEÇTİ';
end;
$$;
