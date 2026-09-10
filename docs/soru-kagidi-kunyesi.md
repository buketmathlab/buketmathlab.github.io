# Soru kâğıdı künyesi

Soru kâğıdını Claude'da hazırlarken **üç** çıktı alın. Üçüncüsü yeni ve
en kısası: **künye.**

| Çıktı | Nereye gidiyor |
|---|---|
| Sorular (PDF) | SEKİZ → Ödev PDF'i. Öğrenci teslim etmeden de görür. |
| Cevap anahtarı (PDF) | SEKİZ → Cevap anahtarı PDF'i. **Yalnız teslimden sonra açılır.** |
| **Künye (metin)** | SEKİZ → 3. adım → *Künyeden doldur* |

## Künye neye benziyor

Her satırda üç şey var: **soru numarası, cevap, konu.**

```
1  A  Türev
2  C  Türev
3  B  Limit
4  D  Limit
5  A  Üslü Sayılar
```

Bu kadar. Word'de hazırladığınız cevap anahtarı **tablosunu** doğrudan
yapıştırabilirsiniz — sekmeyle ayrılmış hücreler de okunuyor, başlık
satırı da:

```
Soru	Cevap	Konu
1	A	Türev
2	C	Türev
```

## Neye dikkat etmiyorsunuz

Ayrıştırıcı bilerek hoşgörülü. Şunların hepsi **çalışır**:

- `1 A Türev` · `1) A - Türev` · `1. a : Türev` · `1-A-Türev`
- Sekme ya da boşluk, kaç tane olursa olsun
- Küçük harf şık (`a` → `A` olur)
- Başlık satırı, boş satırlar
- Türkçe karakter, konu adında rakam (`2. Dereceden Denklemler`)

## Neyi söylüyor, neyi sessizce geçmiyor

SEKİZ yapıştırdığınız künyeyi **önce gösteriyor**, sonra uyguluyor.
Yapıştırmak hiçbir şeyi değiştirmez; **Uygula**'ya basana kadar tek alan
dolmaz. Önizlemede şunlar yazar:

- kaç sorunun cevabı, kaç sorunun konusu okundu
- künyede geçmeyen soru numaraları (boş kalacaklar)
- konusu yazılmamış sorular
- **iki kez geçen sorular** — ilk satır kullanılır
- okunamayan satırlar, numarasıyla ve sebebiyle

Hiçbir satır okunamazsa "bu künye değil" der ve **Uygula** çalışmaz.

## Konu neden önemli

Konu karnesi (öğrencinin, velinin ve sizin gördüğünüz "hangi konuya
çalışmalı" listesi) **tamamen** bu alana dayanıyor. Bugün her ödevde tek
tek elle giriliyor, çünkü sizin PDF'lerinizde sorular görsel olarak
gömülü — metin katmanında olmadığı için konu PDF'ten çıkarılamıyor
(ölçüldü, `app/src/lib/odev-pdf-ozeti.ts`).

Kâğıdı üreten Claude hangi sorunun hangi konu olduğunu zaten biliyor.
Künye, o bilgiyi yolda kaybetmemek için var.

## Skill'inize eklenecek yönerge

Aşağıdaki paragrafı soru kâğıdı skill'inizin sonuna ekleyin:

> Soru kâğıdını ve cevap anahtarını ayrı ayrı üret. Ayrıca **künye**
> başlıklı üçüncü bir çıktı ver: her satırda soru numarası, doğru cevap
> ve o sorunun konusu olsun, aralarında iki boşluk bırak. Örnek:
>
> ```
> 1  A  Türev
> 2  C  Limit
> ```
>
> Künyede kâğıttaki her soru bulunsun, fazladan satır olmasın. Konu
> adlarını tutarlı yaz — aynı konuyu bazı satırlarda "Türev" bazılarında
> "Türev Alma" diye yazarsan konu karnesi ikiye bölünür.

## Cevap anahtarı ne zaman açılıyor

Öğrenci **teslim etmeden** cevap anahtarı cihazına hiç inmiyor — ekranda
gizlenmiyor, sunucu göndermiyor. Teslimden sonra açılıyor.

Bu ayar künyeyle değişmiyor; platformun kuralı ve gerçek veritabanına
karşı ölçülüyor (`supabase/testler/guvenlik_testleri.sql`, 8. ve 10.
bölümler). Veli cevap anahtarını hiçbir zaman görmüyor.
