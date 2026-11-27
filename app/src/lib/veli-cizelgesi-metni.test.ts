import { describe, it, expect } from 'vitest';
import type { OdevKiyasi } from '@/types/api';
import { YASAKLI_KELIMELER } from './karne-sozu';
import { ADRES as FIS_ADRES, fisMetni } from './kod-fisi';
import {
  ADRES,
  CIZELGE_NOTU,
  DERS,
  GIRIS_SATIRLARI,
  KOD_ETIKETI,
  KUNYE,
  KURULUM,
  KURULUM_BASLIGI,
  OGRETMEN,
  SABIT_MM,
  SATIR_MM,
  SAYFAYA_SIGAN_SATIR,
  SUTUNLAR,
  TAM_BUTCE_MM,
  YARIM_BUTCE_MM,
  girisBloguVarMi,
  YARIMA_SIGAN_SATIR,
  cizelgeAltNotu,
  devamBasligi,
  durumYazisi,
  gecikmeIsareti,
  kagitDuzeni,
  kisaGun,
  parcalaraBol,
  puanYazisi,
  seviyeBasligi,
  seviyeOrtalamasi,
  sinifOrtalamasi,
  soruDokumu,
  verilisGunu,
} from './veli-cizelgesi-metni';

const HAZIR: OdevKiyasi = {
  durum: 'hazir',
  sinif: { ad: '7C', ortalama: 75 },
  seviye: { ad: '7. sınıflar', ortalama: 50 },
} as OdevKiyasi;

describe('kisaGun / verilisGunu', () => {
  it('yalnız gün verilmişse yerel okunuyor — bir gün geriye kaymıyor', () => {
    // `new Date('2026-10-19')` UTC gece yarısı sayılır; negatif bölgelerde
    // bir gün geriye kayardı (`odev-tarihleri.ts`in aynı tuzağı).
    expect(kisaGun('2026-10-19')).toBe('19 Eki');
  });

  it('ISO zaman da okunuyor', () => {
    expect(kisaGun('2026-11-18T07:43:00+03:00')).toBe('18 Kas');
  });

  it('okunamayan değerde null', () => {
    expect(kisaGun('bozuk')).toBeNull();
    expect(kisaGun(null)).toBeNull();
  });

  it('0091 çalışmamışsa veriliş "—" — created_at UYDURULMUYOR', () => {
    expect(verilisGunu(null)).toBe('—');
    expect(verilisGunu(undefined)).toBe('—');
  });

  it('veriliş tarihi varsa yazılıyor', () => {
    expect(
      verilisGunu({
        verilis: '2026-11-18T07:43:00+03:00',
        son_tarih: '2026-11-25',
        ilk_son_tarih: null,
        degisiklik: 0,
        yon: null,
      }),
    ).toBe('18 Kas');
  });
});

describe('durumYazisi', () => {
  it('dört durumu da ayırıyor', () => {
    expect(durumYazisi('gonderdi')).toBe('Gönderildi');
    expect(durumYazisi('gondermedi')).toBe('Gönderilmedi');
    expect(durumYazisi('suresi_devam')).toBe('Süresi sürüyor');
    expect(durumYazisi('kapsam_disi')).toBe('Sınıfa sonra katıldı');
  });

  it('SÜRESİ DOLMAMIŞ ödeve "Gönderilmedi" DEMİYOR', () => {
    // Veliye bugün hâlâ açık olan bir ödev için "yapmadı" demek
    // haksızlık olurdu.
    expect(durumYazisi('suresi_devam')).not.toContain('Gönderilmedi');
  });

  it('SINIFA SONRADAN KATILAN öğrenciyi suçlamıyor', () => {
    // 0064: gelmediği tarihteki ödevden sorumlu tutulamaz.
    expect(durumYazisi('kapsam_disi')).not.toContain('Gönderilmedi');
  });

  it('bilinmeyen durumda "—"', () => {
    expect(durumYazisi(null)).toBe('—');
    expect(durumYazisi(undefined)).toBe('—');
  });
});

describe('puanYazisi', () => {
  it('puanı Türkçe ayraçla yazıyor', () => {
    expect(puanYazisi(75)).toBe('75');
    expect(puanYazisi('62.50')).toBe('62,5');
  });

  it('puan yoksa "—" — 0 YAZMIYOR', () => {
    // Göndermediği ödevi "0 puan" diye yazmak, çocuğu yapmadığı bir
    // sınavdan kalmış gibi gösterirdi.
    expect(puanYazisi(null)).toBe('—');
    expect(puanYazisi(undefined)).toBe('—');
    expect(puanYazisi('')).toBe('—');
  });

  it('gerçek 0 puanı yazıyor (null ile aynı şey değil)', () => {
    expect(puanYazisi(0)).toBe('0');
  });
});

describe('sinifOrtalamasi / seviyeOrtalamasi', () => {
  it('hazır kıyasta iki ortalamayı da veriyor', () => {
    expect(sinifOrtalamasi(HAZIR)).toBe('75');
    expect(seviyeOrtalamasi(HAZIR)).toBe('50');
  });

  it('süresi dolmamış ödevde kıyas yazılmıyor', () => {
    const k = { durum: 'sure_dolmadi' } as OdevKiyasi;
    expect(sinifOrtalamasi(k)).toBe('—');
    expect(seviyeOrtalamasi(k)).toBe('—');
  });

  it('özel derste ve çalışma kağıdında kıyas yazılmıyor', () => {
    const k = { durum: 'kiyas_yok' } as OdevKiyasi;
    expect(sinifOrtalamasi(k)).toBe('—');
    expect(seviyeOrtalamasi(k)).toBe('—');
  });

  it('TEK ŞUBEYE verilmiş ödevde düzey ortalaması YOK', () => {
    // Öğretmenin kuralı: "diğer şubelere verilmemişse sadece ödevin
    // verildiği sınıf ortalaması alınsın."
    const k = { durum: 'hazir', sinif: { ad: '7C', ortalama: 90 }, seviye: null } as OdevKiyasi;
    expect(sinifOrtalamasi(k)).toBe('90');
    expect(seviyeOrtalamasi(k)).toBe('—');
  });

  it('0091 çalışmamışsa iki sütun da "—"', () => {
    expect(sinifOrtalamasi(null)).toBe('—');
    expect(seviyeOrtalamasi(undefined)).toBe('—');
  });
});

describe('seviyeBasligi', () => {
  it('düzeyin adını sunucudan alıyor', () => {
    expect(seviyeBasligi([null, HAZIR])).toBe('7. sınıflar');
  });

  it('hiç kıyas yoksa genel başlığa düşüyor', () => {
    expect(seviyeBasligi([null, undefined])).toBe(SUTUNLAR.seviye);
  });
});

describe('gecikmeIsareti', () => {
  it('gecikmeli teslimi işaretliyor, zamanındakini işaretlemiyor', () => {
    expect(gecikmeIsareti(true)).toBe('gecikmeli');
    expect(gecikmeIsareti(false)).toBeNull();
    expect(gecikmeIsareti(null)).toBeNull();
  });
});

describe('soruDokumu', () => {
  it('yanlış ve boş numaraları ayrı yazıyor', () => {
    expect(soruDokumu([3, 4], [7])).toBe('yanlış: 3, 4 · boş: 7');
  });

  it('yalnız biri varsa yalnız onu yazıyor', () => {
    expect(soruDokumu([3], [])).toBe('yanlış: 3');
    expect(soruDokumu([], [7, 8])).toBe('boş: 7, 8');
  });

  it('ikisi de boşsa satır hiç çizilmiyor', () => {
    expect(soruDokumu([], [])).toBeNull();
    expect(soruDokumu(null, undefined)).toBeNull();
  });
});

describe('parcalaraBol', () => {
  it('sığan çizelge tek parça', () => {
    const p = parcalaraBol(Array.from({ length: YARIMA_SIGAN_SATIR }, (_, i) => i));
    expect(p).toHaveLength(1);
  });

  it('taşan çizelge ikinci yarıma geçiyor — KIRPILMIYOR', () => {
    const satir = Array.from({ length: YARIMA_SIGAN_SATIR + 3 }, (_, i) => i);
    const p = parcalaraBol(satir);
    expect(p).toHaveLength(2);
    // Hiçbir satır kaybolmamalı: sessizce kırpmak bir ödevi yok saymak olurdu.
    expect(p.flat()).toEqual(satir);
  });

  it('hiç ödev yoksa tek boş parça (kart yine çiziliyor)', () => {
    expect(parcalaraBol([])).toEqual([[]]);
  });

  it('kodlu modda tam sayfa sınırıyla bölüyor', () => {
    const satir = Array.from({ length: SAYFAYA_SIGAN_SATIR + 1 }, (_, i) => i);
    expect(parcalaraBol(satir, SAYFAYA_SIGAN_SATIR)).toHaveLength(2);
    expect(parcalaraBol(satir, SAYFAYA_SIGAN_SATIR).flat()).toEqual(satir);
    // Aynı satırlar yarım sayfada çok daha fazla parçaya bölünüyor.
    expect(parcalaraBol(satir, YARIMA_SIGAN_SATIR).length).toBeGreaterThan(2);
  });

  it('anlamsız sınır verilirse yarım sayfa sınırına düşüyor — sonsuz döngü yok', () => {
    const satir = [1, 2, 3, 4, 5, 6, 7];
    for (const kotu of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = parcalaraBol(satir, kotu);
      expect(p.flat()).toEqual(satir);
      expect(p.length).toBeLessThanOrEqual(satir.length);
    }
  });
});

describe('kagitDuzeni — rakamlar ÖLÇÜMDEN geliyor', () => {
  it('kodsuz: iki öğrenci, yarım sayfa sınırı', () => {
    const d = kagitDuzeni(false);
    expect(d.ogrenciSayisi).toBe(2);
    expect(d.siganSatir).toBe(YARIMA_SIGAN_SATIR);
    expect(d.aciklama).toContain('iki öğrenci');
  });

  it('kodlu: bir öğrenci, tam sayfa sınırı', () => {
    const d = kagitDuzeni(true);
    expect(d.ogrenciSayisi).toBe(1);
    expect(d.siganSatir).toBe(SAYFAYA_SIGAN_SATIR);
    expect(d.aciklama).toContain('bir öğrenci');
  });

  /**
   * SABİTLER ÖLÇÜMLE TUTARLI OLMALI. Ölçülen rakamlar
   * (satır 10,17 mm; sabit 66,63 / 113,43 mm; bütçe 137 / 277 mm)
   * değişirse bu test kırmızı yanar ve sabit elle güncellenir — eski
   * 8 rakamı tam böyle bir denetim olmadığı için yanlış kalmıştı.
   */
  it('sığan satır sayıları ölçülen mm değerleriyle uyuşuyor', () => {
    const kodsuz = Math.floor((YARIM_BUTCE_MM - SABIT_MM.kodsuz) / SATIR_MM);
    expect(YARIMA_SIGAN_SATIR).toBeLessThanOrEqual(kodsuz);
    const kodlu = Math.floor((TAM_BUTCE_MM - SABIT_MM.kodlu) / SATIR_MM);
    expect(SAYFAYA_SIGAN_SATIR).toBeLessThanOrEqual(kodlu);
    // Kâğıda gerçekten sığıyor: sabit + satırlar bütçeyi aşmıyor.
    expect(SABIT_MM.kodsuz + YARIMA_SIGAN_SATIR * SATIR_MM).toBeLessThanOrEqual(YARIM_BUTCE_MM);
    expect(SABIT_MM.kodlu + SAYFAYA_SIGAN_SATIR * SATIR_MM).toBeLessThanOrEqual(TAM_BUTCE_MM);
  });

  it('kodlu yarım sayfa KULLANIŞSIZ — düzen değişikliğinin gerekçesi', () => {
    // Giriş bloğu yarıma sığdırılırsa öğrenci başına 2 satır kalıyor.
    const yarimdaKodlu = Math.floor((YARIM_BUTCE_MM - SABIT_MM.kodlu) / SATIR_MM);
    expect(yarimdaKodlu).toBeLessThan(3);
  });
});

describe('devamBasligi', () => {
  it('tek parçada sade ad', () => {
    expect(devamBasligi('Ayşe Yılmaz', 1, 1)).toBe('Ayşe Yılmaz');
  });

  it('çok parçada kaçıncısı olduğu yazıyor — kâğıt karışmasın', () => {
    expect(devamBasligi('Ayşe Yılmaz', 2, 3)).toBe('Ayşe Yılmaz — 2/3');
  });
});

describe('cizelgeAltNotu', () => {
  it('sınıf ve tarih yazıyor', () => {
    expect(cizelgeAltNotu('7C', new Date('2026-11-27T10:00:00+03:00'))).toBe(
      '7C · 27 Kasım 2026 tarihinde hazırlandı.',
    );
  });
});

describe('antet künyesi', () => {
  it('ders ve öğretmen yazıyor', () => {
    // Öğretmen sordu: "Matematik dersi olduğu yazıyor mu?" Yazmıyordu.
    expect(KUNYE).toContain('Matematik');
    expect(KUNYE).toContain('Buket Topuzoğlu');
    expect(KUNYE).toBe(`${DERS} · ${OGRETMEN}`);
  });
});

describe('veli giriş bloğu', () => {
  it('metin KOD FİŞİNDEN geliyor, kopyalanmıyor', () => {
    // İki yerde iki türlü yazılsa biri güncellenir öbürü kalırdı.
    const fis = fisMetni('veli');
    expect(KOD_ETIKETI).toBe(fis.kodEtiketi);
    expect(GIRIS_SATIRLARI).toEqual(fis.satirlar);
    expect(KURULUM_BASLIGI).toBe(fis.kurulumBasligi);
    expect(KURULUM).toEqual(fis.kurulum);
    expect(ADRES).toBe(FIS_ADRES);
  });

  it('giriş yönlendirmesi adresi taşıyor', () => {
    expect(GIRIS_SATIRLARI.join(' ')).toContain('sekizkyal.com');
  });

  it('uygulama kurulumu iOS ve Android adımlarını taşıyor', () => {
    const k = KURULUM.join(' ');
    expect(k).toContain('iOS');
    expect(k).toContain('Android');
    expect(k).toMatch(/Ana Ekrana Ekle|Uygulama olarak ekle/);
  });

  it('ÖĞRENCİ kodu bu kâğıda ait değil', () => {
    // `kod-fisi.ts`in ayrımı: iki kodu tek kâğıda basmak, velinin
    // kanalını çocuğun eline vermek olurdu.
    const ogrenciFisi = fisMetni('ogrenci');
    expect(KOD_ETIKETI).not.toBe(ogrenciFisi.kodEtiketi);
    expect(KOD_ETIKETI.toLocaleLowerCase('tr')).toContain('veli');
  });

  it('kod yoksa blok çizilmiyor — boş "Veli kodunuz:" basılmıyor', () => {
    expect(girisBloguVarMi(undefined)).toBe(false);
    expect(girisBloguVarMi(null)).toBe(false);
    expect(girisBloguVarMi('')).toBe(false);
    expect(girisBloguVarMi('   ')).toBe(false);
  });

  it('kod varsa blok çiziliyor', () => {
    expect(girisBloguVarMi('A1B2C3')).toBe(true);
  });
});

describe('dil kuralları', () => {
  /**
   * `karne-sozu.ts`in yasaklı kelimeleri burada da ölçülüyor — İKİ
   * İSTİSNAYLA: "ortalama" ve "sınıfın". Öğretmen kıyası AÇIKÇA istedi
   * ("Görünsün") ve 0047'de veli paneline aynı kararı verdi. Yasak olan
   * şey çocuğa SIRALAMA ve EĞİLİM atfetmek; isimsiz bir ortalama değil.
   */
  const KIYAS_SERBEST = ['ortalama', 'sınıfın'];
  const ARANAN = YASAKLI_KELIMELER.filter((k) => !KIYAS_SERBEST.includes(k));

  const metinler = [
    CIZELGE_NOTU,
    ...Object.values(SUTUNLAR),
    durumYazisi('gonderdi'),
    durumYazisi('gondermedi'),
    durumYazisi('suresi_devam'),
    durumYazisi('kapsam_disi'),
    cizelgeAltNotu('7C', new Date('2026-11-27T10:00:00+03:00')),
  ];

  it('hiçbir cümlede sıralama ya da eğilim iddiası yok', () => {
    for (const m of metinler) {
      for (const k of ARANAN) {
        expect(
          m.toLocaleLowerCase('tr').includes(k),
          `"${m}" içinde yasaklı kelime: ${k}`,
        ).toBe(false);
      }
    }
  });

  it('çocuğu etiketleyen kelime yok', () => {
    // Kalıcı kural: "Başarısız öğrenci", "Yetersiz öğrenci", "Zayıf öğrenci".
    for (const m of metinler) {
      const d = m.toLocaleLowerCase('tr');
      expect(d).not.toContain('başarısız');
      expect(d).not.toContain('yetersiz');
      expect(d).not.toContain('zayıf');
      expect(d).not.toContain('tembel');
    }
  });

  it('kıyasın isimsiz olduğu çizelgede açıkça yazıyor', () => {
    expect(CIZELGE_NOTU).toContain('isimsiz');
  });
});
