-- =============================================================================
-- SEKİZ — 0005 FONKSİYON YETKİLERİ (izin listesi)
--
-- BU DOSYA NEDEN VAR:
--
-- PostgreSQL yeni oluşturulan her fonksiyona varsayılan olarak `PUBLIC`
-- rolüne EXECUTE hakkı verir. 0002'de yetkiler `anon` ve `authenticated`
-- rollerinden çekilmişti — ama `PUBLIC`'ten çekilmemişti ve her rol
-- PUBLIC'ten miras alır.
--
-- Sonuç, yerel testte yakalandı: `_oturum_ac('ogretmen', null)` anon
-- rolüyle çağrılabiliyordu. Yani PIN bilmeyen biri kendine ÖĞRETMEN JETONU
-- üretebilirdi — tam kimlik doğrulama atlatması.
--
-- Bu dosya tüm fonksiyon haklarını sıfırlayıp yalnız dışarıya açık olması
-- gerekenleri geri verir. Migration sırasının EN SONUNDA çalışmalıdır:
-- yeni bir fonksiyon eklendiğinde bu dosya da güncellenmeli, aksi hâlde
-- fonksiyon dışarıdan çağrılamaz (güvenli taraf — sessizce açılmaz).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hepsini kapat. PUBLIC dahil.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all routines  in schema public from public, anon, authenticated;

-- Bundan sonra oluşturulacaklar için de varsayılanı kapat.
alter default privileges in schema public revoke all on functions from public;
alter default privileges in schema public revoke all on routines  from public;

-- -----------------------------------------------------------------------------
-- 2. İZİN LİSTESİ — yalnız buradakiler dışarıdan çağrılabilir.
--
-- Listede OLMAYAN her fonksiyon (özellikle alt çizgiyle başlayan dahili
-- yardımcılar: _oturum_ac, _oturum, _ogretmen, _token_hash, _yeni_kod,
-- _puanla, _denetim, _kilitli_mi, _deneme_kaydet, _istemci_kimligi,
-- _ozel_ders_ogrencisi) dışarıdan erişilemez.
-- -----------------------------------------------------------------------------

-- Giriş / oturum
grant execute on function public.giris(text)                     to anon, authenticated;
grant execute on function public.pin_ayarla(text)                to anon, authenticated;
grant execute on function public.pin_degistir(text, text, text)  to anon, authenticated;
grant execute on function public.cikis(text)                     to anon, authenticated;

-- Öğretmen — sınıf
grant execute on function public.siniflar_listesi(text, boolean)    to anon, authenticated;
grant execute on function public.sinif_ekle(text, smallint, text)   to anon, authenticated;
grant execute on function public.sinif_arsivle(text, uuid, boolean) to anon, authenticated;

-- Öğretmen — öğrenci
grant execute on function public.ogrenci_ekle(text, text, text, uuid)                   to anon, authenticated;
grant execute on function public.ogrenci_pasiflestir(text, uuid)                        to anon, authenticated;
grant execute on function public.ogrenci_kodlari(text, uuid)                            to anon, authenticated;
grant execute on function public.ogrenciler_listesi(text, text, uuid, integer, integer) to anon, authenticated;

-- Öğretmen — pano ve ödev
grant execute on function public.ogretmen_panosu(text)                     to anon, authenticated;
grant execute on function public.odev_yayinla(text, uuid)                  to anon, authenticated;
grant execute on function public.odev_sil(text, uuid)                      to anon, authenticated;
grant execute on function public.acik_puanla(text, uuid, numeric, text)    to anon, authenticated;
grant execute on function
  public.odev_olustur(text, text, text, uuid, text, date, integer, jsonb, text)
  to anon, authenticated;

-- Öğrenci
grant execute on function public.ogrenci_odevleri(text)                to anon, authenticated;
grant execute on function public.odev_gonder(text, uuid, text, jsonb)  to anon, authenticated;

-- Veli
grant execute on function public.veli_paneli(text)      to anon, authenticated;
grant execute on function public.okundu_isaretle(text)  to anon, authenticated;

-- Mesajlaşma
grant execute on function public.mesaj_gonder(text, text, uuid)     to anon, authenticated;
grant execute on function public.mesajlar_ogretmen(text, uuid)      to anon, authenticated;

-- Özel ders
grant execute on function public.ders_ekle(text, uuid, timestamptz, text, text) to anon, authenticated;
grant execute on function public.ders_sil(text, uuid)                           to anon, authenticated;
grant execute on function public.odeme_ekle(text, uuid, numeric, date)          to anon, authenticated;
grant execute on function public.odeme_degistir(text, uuid)                     to anon, authenticated;
grant execute on function public.odeme_sil(text, uuid)                          to anon, authenticated;

-- Dosya yetkisi ve yedekleme
grant execute on function public.dosya_erisim_izni(text, text) to anon, authenticated;
grant execute on function public.disa_aktar(text)              to anon, authenticated;

-- Bakım fonksiyonu dışarıya AÇILMAZ: oturum_temizle() yalnız zamanlanmış
-- görevden ya da panelden çalıştırılır.
