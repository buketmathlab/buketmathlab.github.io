# Soru kâğıdınızı SEKİZ'e hızlı aktarmak

Merhaba. Bu tek sayfa, soru kâğıdınızı Claude'da hazırlıyorsanız işinizi
kısaltmak için.

## Önce: bunu kullanmak zorunda değilsiniz

**SEKİZ bu olmadan da bugünkü gibi çalışır.** Ödevi her zamanki yolla
oluşturabilirsiniz: iki PDF'i yükler, cevapları ızgaradan girer,
konuları aralıkla atar, kaydedersiniz. Hiçbir şey eksik kalmaz.

Aşağıdaki şey bir **hızlandırıcı**. Ödev oluşturma ekranında kapalı
duruyor; açmazsanız hiç karşınıza çıkmaz.

## Ne işe yarıyor

SEKİZ'in konu karnesi — öğrencinin ve velinin gördüğü "hangi konuya
çalışmalı" listesi — **her sorunun hangi konuya ait olduğunu** bilmek
zorunda. Bu bilgi bugün ödev oluştururken elle giriliyor: 20 soruluk bir
testte 20 satır.

Oysa kâğıdı hazırlarken Claude bunu zaten biliyor. "Künye" o bilgiyi
yolda kaybetmemek için var. Yapıştırırsınız, cevap anahtarı ve konular
birlikte dolar.

## Künye neye benziyor

Her satırda üç şey: **soru numarası, cevap, konu.**

```
1  A  Türev
2  C  Türev
3  B  Limit
4  D  Limit
5  A  Üslü Sayılar
```

Word'deki cevap anahtarı **tablonuzu doğrudan** yapıştırabilirsiniz;
sekmeyle ayrılmış hücreler ve başlık satırı da okunuyor:

```
Soru	Cevap	Konu
1	A	Türev
2	C	Limit
```

Şunların hepsi çalışır: `1) A - Türev` · `1. a : Türev` · `1-A-Türev` ·
küçük harf şık · fazladan boşluk · boş satırlar · Türkçe karakter ·
konu adında rakam (`2. Dereceden Denklemler`).

## Skill'inize ekleyeceğiniz paragraf

Kendi soru kâğıdı skill'inizin sonuna şunu ekleyin:

> Soru kâğıdını ve cevap anahtarını **ayrı ayrı** üret. Cevap anahtarı
> soru kâğıdının içinde olmasın.
>
> Ayrıca **künye** başlıklı üçüncü bir çıktı ver: her satırda soru
> numarası, doğru cevap ve o sorunun konusu olsun, aralarında iki boşluk
> bırak. Örnek:
>
> ```
> 1  A  Türev
> 2  C  Limit
> ```
>
> Künyede kâğıttaki her soru bulunsun, fazladan satır olmasın.
>
> Soru kâğıdının en altına, küçük puntoyla şu satırı ekle:
> `SEKİZ · Buket Topuzoğlu`

## SEKİZ'de ne yapacaksınız

Ödevler → Yeni ödev

| Adım | |
|---|---|
| 1 | Başlık, sınıf, son tarih, soru sayısı |
| 2 | İki PDF'i yükleyin |
| 3 | **"Künyeden doldur"** → künyeyi yapıştırın → **Uygula** |

Yapıştırınca önce bir **önizleme** çıkar: kaç sorunun cevabı ve konusu
okundu, eksik ya da okunamayan satır var mı. **Uygula**'ya basmadan
hiçbir alan dolmaz; beğenmezseniz vazgeçersiniz.

## İki PDF neden ayrı

Cevap anahtarı, öğrenci ödevi **teslim edene kadar** ona hiç gitmiyor —
ekranda gizlenmiyor, sunucu göndermiyor. Teslimden sonra açılıyor. Veli
cevap anahtarını hiçbir zaman görmüyor.

Bu SEKİZ'in kuralı; anahtarı ayrı bir dosya olarak yüklediğiniz sürece
kendiliğinden çalışır.

## Tek uyarı: konu adlarını tutarlı yazın

Aynı konuyu bazı satırlarda "Türev", bazılarında "Türev Alma" diye
yazarsanız konu karnesi bunları **iki ayrı konu** sayar ve öğrencinin
listesi bölünür. Bir ödev içinde aynı yazımda kalın.
