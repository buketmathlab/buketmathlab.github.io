/**
 * 0054 — ÖDEV BAŞINA SAYFA SINIRI: GÖVDE FARKI + TARAYICIDA UÇTAN UCA
 *
 * İKİ AYRI ÖLÇÜM.
 *
 * A. GÖVDE FARKI (tarayıcısız). 0054 dokuz fonksiyonu yeniden tanımlıyor;
 *    ~700 satır. Proje 0016'da ezberden yazılmış bir gövdenin iki hataya yol
 *    açtığını kaydetti. Bu yüzden 0054'teki her gövde, kaynağındaki (en son
 *    tanımlandığı migration) gövdeye AŞAĞIDAKİ DEĞİŞİMLER uygulanarak
 *    YENİDEN ÜRETİLİYOR ve depodakiyle birebir karşılaştırılıyor. Biri 0054'te
 *    puanlamaya, yetkiye ya da mükerrer gönderime elle dokunursa burada düşer.
 *    Değişim listesi aynı zamanda 0054'ün "neyi değiştirdi" belgesi.
 *
 * B. ARAYÜZ (Chromium, taklit RPC — 0031 denetiminin deseni).
 *    ASIL ÖLÇÜM: SINIR 1'DE AĞA GİDEN ÇAĞRI 0054 ÖNCESİYLE AYNI. Öğrencinin
 *    yükleme yolu ve `odev_gonder` gövdesi, öğretmenin oluşturma/güncelleme
 *    gövdesi — hiçbiri yeni bir alan taşımıyor. 0054 panelde çalıştırılmadan
 *    site yayına girse bile kimse fark etmemeli (Part VIII).
 *    Ardından çok sayfalı yol: sınır, sıra, yarıda kalan yükleme ve
 *    "zaten var".
 *
 * ÇALIŞTIRMA: depo kökünden `http-server -p 8788 -c-1` açıkken,
 *   node app/scripts/sayfa-siniri-denetimi.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
let hata = 0;
const tamam = (m) => console.log(`    ${m}: OK`);
const bozuk = (m) => {
  console.log(`    HATA: ${m}`);
  hata++;
};

// ============================================================================
// A. GÖVDE FARKI
// ============================================================================

/** Fonksiyonun gövdeyi en son tanımladığı migration — 0054'ün kaynağı. */
const KAYNAK = {
  _cozum_yolu_gecerli: '0009_ogrenci_cozum_yukleme.sql',
  dosya_erisim_izni: '0034_veli_onami.sql',
  odev_gonder: '0016_arsiv_her_yerde.sql',
  odev_olustur: '0033_ogretmen_kimligi.sql',
  odevler_coklu_olustur: '0033_ogretmen_kimligi.sql',
  odev_guncelle: '0033_ogretmen_kimligi.sql',
  odev_detay: '0033_ogretmen_kimligi.sql',
  gonderim_foto_yolu: '0033_ogretmen_kimligi.sql',
  odev_kardeslere_yay: '0033_ogretmen_kimligi.sql',
};

/**
 * 0054'ün kaynak gövdelere uyguladığı değişimlerin TAMAMI. Her `eski`
 * gövdede tam `adet` kez geçmek zorunda. Liste dışında tek karakterlik fark
 * denetimi düşürür.
 */
const DEGISIMLER = [
  {
    fn: '_cozum_yolu_gecerli',
    eski: `  v_parca   text[];
begin`,
    yeni: `  v_parca   text[];
  v_sayfa   integer;
begin`,
    adet: 1,
  },
  {
    fn: '_cozum_yolu_gecerli',
    eski: `  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>
`,
    yeni: `  -- Beklenen: cozum/<uuid>/<uuid>.<uzanti>          (1. sayfa — 0009'dan beri)
  --       ya: cozum/<uuid>/<uuid>-<2..8>.<uzanti>   (ek sayfa — 0054)
`,
    adet: 1,
  },
  {
    fn: '_cozum_yolu_gecerli',
    eski: `'^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})\\.(jpg|jpeg|png|webp)$'`,
    yeni: `'^cozum/([0-9a-f-]{36})/([0-9a-f-]{36})(?:-([2-8]))?\\.(jpg|jpeg|png|webp)$'`,
    adet: 1,
  },
  {
    fn: '_cozum_yolu_gecerli',
    eski: `  v_odev_id := v_parca[1]::uuid;
`,
    yeni: `  v_odev_id := v_parca[1]::uuid;
  -- Eksiz yol 1. sayfa. \`-1\` diye bir ek YOK: kalıp yalnız 2–8'i tanıyor,
  -- yani 1. sayfanın iki farklı yazımı olamaz.
  v_sayfa   := coalesce(v_parca[3]::integer, 1);
`,
    adet: 1,
  },
  {
    fn: '_cozum_yolu_gecerli',
    eski: `      and o.aktif
  );`,
    yeni: `      and o.aktif
      -- 0054: sayfa numarası ödevin sınırını aşamaz. Sınır YÜKLEME
      -- anında da aranıyor, yalnız gönderimde değil: sınırı 2 olan ödevde
      -- öğrenci 3. sayfa için yükleme adresi bile alamaz. Depoya sınırın
      -- ötesinde dosya bırakmanın yolu burada kapanıyor.
      and v_sayfa <= d.sayfa_limiti
  );`,
    adet: 1,
  },
  {
    fn: 'dosya_erisim_izni',
    eski: `where g.ogrenci_id = o.ogrenci_id and g.foto_yolu = p_yol`,
    yeni: `where g.ogrenci_id = o.ogrenci_id
          and (g.foto_yolu = p_yol or p_yol = any(g.ek_sayfa_yollari))`,
    adet: 2,
  },
  {
    fn: 'odev_gonder',
    eski: `  p_cevaplar jsonb default null
)`,
    yeni: `  p_cevaplar jsonb default null,
  -- 0054: 2. ve sonraki sayfaların yolları, SIRAYLA. null ya da boş dizi
  -- = tek sayfa; bugünkü çağrılar bu parametreyi hiç göndermiyor.
  p_ek_sayfa_yollari text[] default null
)`,
    adet: 1,
  },
  {
    fn: 'odev_gonder',
    eski: `  yeni_id uuid;
begin`,
    yeni: `  yeni_id uuid;
  v_ek      text[];
  v_ek_sayi integer;
  i         integer;
begin`,
    adet: 1,
  },
  {
    fn: 'odev_gonder',
    eski: `  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) not like 'cozum/' || p_odev::text || '/%' then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;
`,
    yeni: `  -- Yol kendi kimliğini ve bu ödevi taşımalı.
  --
  -- 0054: 1. SAYFA EKSİZ OLMALI. 0054'ten önce \`_cozum_yolu_gecerli\`
  -- yalnız eksiz yolu tanıdığı için \`like\` yetiyordu. Artık \`-2\` gibi ek
  -- sayfa yolları da geçerli ve \`like\` onları da kabul ederdi. \`foto_yolu\`
  -- her zaman 1. sayfa — onu okuyan her yer (öğretmen, veli) buna güveniyor.
  if not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(p_foto_yolu))
     or btrim(p_foto_yolu) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                              || '\\.(jpg|jpeg|png|webp)$') then
    raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
  end if;

  -- EK SAYFALAR (0054).
  --
  -- SINIR ÖNCE, YOL SONRA. Öğretmen sınırı öğrenci sayfaları hazırladıktan
  -- sonra düşürmüş olabilir; o zaman fazla sayfanın yolu da geçersizdir ama
  -- öğrenciye söylenecek doğru şey "geçersiz yol" değil, "fazla sayfa".
  v_ek := coalesce(p_ek_sayfa_yollari, '{}'::text[]);
  v_ek_sayi := coalesce(array_length(v_ek, 1), 0);

  if 1 + v_ek_sayi > d.sayfa_limiti then
    raise exception 'Bu ödevde en fazla % sayfa gönderilebilir. Fazla sayfaları çıkarıp tekrar deneyin.',
      d.sayfa_limiti using errcode = '22023';
  end if;

  -- SIRA BOŞLUKSUZ: i. ek sayfa TAM OLARAK \`-(i+1)\` ekini taşımalı.
  -- Böylece aynı sayfa iki kez yazılamaz, sayfa atlanamaz ve öğretmenin
  -- gördüğü sıra öğrencinin gönderdiği sırayla aynıdır.
  for i in 1 .. v_ek_sayi loop
    if v_ek[i] is null
       or btrim(v_ek[i]) !~ ('^cozum/' || p_odev::text || '/' || o.ogrenci_id::text
                            || '-' || (i + 1)::text || '\\.(jpg|jpeg|png|webp)$')
       or not public._cozum_yolu_gecerli(o.ogrenci_id, btrim(v_ek[i])) then
      raise exception 'Geçersiz dosya yolu.' using errcode = '42501';
    end if;
    v_ek[i] := btrim(v_ek[i]);
  end loop;
`,
    adet: 1,
  },
  {
    fn: 'odev_gonder',
    eski: `      (odev_id, ogrenci_id, cevaplar, foto_yolu, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')`,
    yeni: `      (odev_id, ogrenci_id, cevaplar, foto_yolu, ek_sayfa_yollari, dogru, yanlis, bos, puan, durum)
    values
      (p_odev, o.ogrenci_id, p_cevaplar, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]),
       s.dogru, s.yanlis, s.bos, s.puan, 'puanlandi')`,
    adet: 1,
  },
  {
    fn: 'odev_gonder',
    eski: `      (odev_id, ogrenci_id, foto_yolu, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), 'incelemede')`,
    yeni: `      (odev_id, ogrenci_id, foto_yolu, ek_sayfa_yollari, durum)
    values
      (p_odev, o.ogrenci_id, btrim(p_foto_yolu), nullif(v_ek, '{}'::text[]), 'incelemede')`,
    adet: 1,
  },
  {
    fn: 'odev_olustur',
    eski: `  p_konular jsonb default null
)`,
    yeni: `  p_konular jsonb default null,
  -- 0054: öğrencinin bu ödevde yükleyebileceği görsel sayısı.
  p_sayfa_limiti smallint default 1
)`,
    adet: 1,
  },
  {
    fn: 'odev_olustur',
    eski: `    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;
`,
    yeni: `    raise exception 'Bu sınıf sizin sınıflarınız arasında değil.' using errcode = '42501';
  end if;

  -- 0054: 1–8. Tablo kısıtı da yakalar, ama kısıtın ham adını öğretmene
  -- göstermemek için burada Türkçe söylüyoruz.
  if coalesce(p_sayfa_limiti, 1) not between 1 and 8 then
    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';
  end if;
`,
    adet: 1,
  },
  {
    fn: 'odev_olustur',
    eski: `     ogretmen_id)
`,
    yeni: `     ogretmen_id, sayfa_limiti)
`,
    adet: 1,
  },
  {
    fn: 'odev_olustur',
    eski: `     v_ogretmen)
  returning id into yeni_id;`,
    yeni: `     v_ogretmen,
     coalesce(p_sayfa_limiti, 1))
  returning id into yeni_id;`,
    adet: 1,
  },
  {
    fn: 'odevler_coklu_olustur',
    eski: `  p_konular jsonb default null
)`,
    yeni: `  p_konular jsonb default null,
  -- 0054: her sınıfa aynı sınır. Denetim odev_olustur'da; ilk sınıfta
  -- düşerse işlemin tamamı geri alınıyor, yarım grup kalmıyor.
  p_sayfa_limiti smallint default 1
)`,
    adet: 1,
  },
  {
    fn: 'odevler_coklu_olustur',
    eski: `      p_gec_teslim, p_sik_sayisi, p_konular);`,
    yeni: `      p_gec_teslim, p_sik_sayisi, p_konular, p_sayfa_limiti);`,
    adet: 1,
  },
  {
    fn: 'odev_guncelle',
    eski: `  p_konular jsonb default null
)`,
    yeni: `  p_konular jsonb default null,
  -- 0054 — NULL = DEĞİŞTİRME (p_gec_teslim ile aynı tuzak). Sınırı
  -- düşürmek yapılmış gönderimlere dokunmaz: gönderim değiştirilemez,
  -- sınır yalnız bundan sonraki gönderimleri bağlar.
  p_sayfa_limiti smallint default null
)`,
    adet: 1,
  },
  {
    fn: 'odev_guncelle',
    eski: `    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
`,
    yeni: `    raise exception 'Sınıf ve son tarih zorunludur.' using errcode = '22023';
  end if;
  if p_sayfa_limiti is not null and p_sayfa_limiti not between 1 and 8 then
    raise exception 'Sayfa sınırı 1 ile 8 arasında olmalı.' using errcode = '22023';
  end if;
`,
    adet: 1,
  },
  {
    fn: 'odev_guncelle',
    eski: `         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi)
   where id = p_id;`,
    yeni: `         konular     = public._konu_temizle(coalesce(p_konular, d.konular), yeni_sayi),
         sayfa_limiti = coalesce(p_sayfa_limiti, d.sayfa_limiti)
   where id = p_id;`,
    adet: 1,
  },
  {
    fn: 'odev_detay',
    eski: `    'sik_sayisi', d.sik_sayisi,
`,
    yeni: `    'sik_sayisi', d.sik_sayisi,
    'sayfa_limiti', d.sayfa_limiti,
`,
    adet: 1,
  },
  {
    fn: 'gonderim_foto_yolu',
    eski: `  v_yol text;
`,
    yeni: `  v_yol text;
  v_ek  text[];
`,
    adet: 1,
  },
  {
    fn: 'gonderim_foto_yolu',
    eski: `  select g.foto_yolu into v_yol
`,
    yeni: `  select g.foto_yolu, g.ek_sayfa_yollari into v_yol, v_ek
`,
    adet: 1,
  },
  {
    fn: 'gonderim_foto_yolu',
    eski: `  return jsonb_build_object('yol', v_yol);`,
    yeni: `  -- \`yol\` AYNEN DURUYOR: 0054'ten önce yayına girmiş bir arayüz yalnız onu
  -- okuyor. \`yollar\` 1. sayfa dahil TÜM sayfalar, sırayla.
  return jsonb_build_object(
    'yol', v_yol,
    'yollar', case when v_yol is null then '[]'::jsonb
                   else to_jsonb(array[v_yol] || coalesce(v_ek, '{}'::text[])) end);`,
    adet: 1,
  },
  {
    fn: 'odev_kardeslere_yay',
    eski: `           sik_sayisi     = d.sik_sayisi,
`,
    yeni: `           sik_sayisi     = d.sik_sayisi,
           -- 0054: sayfa sınırı da ödevin İÇERİĞİ — aynı çözüm her sınıfta
           -- aynı sayıda sayfa tutar. Şık sayısı gibi taşınıyor; geç teslim
           -- gibi sınıfa özgü bir ayar DEĞİL.
           sayfa_limiti   = d.sayfa_limiti,
`,
    adet: 1,
  },
];

function govdeCikar(dosya, fn) {
  const metin = readFileSync(resolve(MIG, dosya), 'utf8');
  const bas = `create or replace function public.${fn}(`;
  const i = metin.indexOf(bas);
  if (i < 0 || metin.indexOf(bas, i + 1) >= 0) {
    throw new Error(`${dosya}: ${fn} tam bir kez tanımlı olmalı`);
  }
  const son = metin.indexOf('\n$$;', i);
  return metin.slice(i, son + 4);
}

console.log('SAYFA SINIRI DENETİMİ (0054)\n');
console.log('--- A1. Kaynaklar gerçekten EN SON tanımlar mı ---');
{
  const dosyalar = readdirSync(MIG).filter((d) => d.endsWith('.sql')).sort();
  let sapma = 0;
  for (const [fn, kaynak] of Object.entries(KAYNAK)) {
    const sonra = dosyalar.filter(
      (d) =>
        // Yalnız kaynak ile 0054 ARASI: 0054'ten SONRAKİ migration'ların
        // (ör. 0055) bu gövdeleri yeniden tanımlaması beklenen bir şey.
        d > kaynak &&
        d < '0054' &&
        readFileSync(resolve(MIG, d), 'utf8').includes(`function public.${fn}(`),
    );
    if (sonra.length) {
      bozuk(`${fn} ${kaynak}'ten sonra ${sonra.join(', ')} içinde yeniden tanımlanmış`);
      sapma++;
    }
  }
  if (!sapma) tamam('dokuz kaynağın hiçbiri arada yeniden tanımlanmamış');
}

console.log('--- A2. 0054 gövdeleri = kaynak + listelenen değişimler, BİREBİR ---');
for (const [fn, kaynak] of Object.entries(KAYNAK)) {
  let govde = govdeCikar(kaynak, fn);
  for (const d of DEGISIMLER.filter((x) => x.fn === fn)) {
    const n = govde.split(d.eski).length - 1;
    if (n !== d.adet) {
      bozuk(`${fn}: değişim ${n} kez eşleşti (beklenen ${d.adet}): ${d.eski.slice(0, 60)}…`);
    }
    govde = govde.split(d.eski).join(d.yeni);
  }
  const depoda = govdeCikar('0054_sayfa_siniri.sql', fn);
  if (govde === depoda) tamam(`${fn} (${DEGISIMLER.filter((x) => x.fn === fn).length} değişim)`);
  else {
    const a = govde.split('\n');
    const b = depoda.split('\n');
    const k = a.findIndex((s, i) => s !== b[i]);
    bozuk(`${fn} listede olmayan bir farkla ayrışmış — ilk fark ${k + 1}. satır:\n` +
      `      beklenen: ${a[k]}\n      depoda:   ${b[k]}`);
  }
}

// ============================================================================
// B. ARAYÜZ
// ============================================================================
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const KOK = 'http://127.0.0.1:8788/yeni/';
const ODEV = '11111111-1111-4111-8111-111111111111';
const OGR = '22222222-2222-4222-8222-222222222222';
const YOL1 = `cozum/${ODEV}/${OGR}.jpg`;
const yol = (n) => `cozum/${ODEV}/${OGR}-${n}.jpg`;

/** 1×1 PNG — `gorseliSikistir` gerçekten çözüp sıkıştırıyor. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const gorsel = (ad) => ({ name: ad, mimeType: 'image/png', buffer: PNG });

const SINIFLAR = [
  { id: 's10u', ad: '10U', seviye: 10, sube: 'U', ozel: false, arsiv: false, ogrenci_sayisi: 24 },
];

/**
 * @param {object} a
 *   rol        'ogrenci' | 'ogretmen'
 *   sinir      öğrencinin sınırı; 'yok' = uç kurulmamış (PGRST202)
 *   bozukSayfa bu sayfanın yükleme adresi 500 döner
 *   zatenVar   her yükleme 409 {mevcut:true} döner
 *   detaySinir odev_detay'daki sayfa_limiti; undefined = alan yok (0054 öncesi)
 *   yollar     gonderim_foto_yolu cevabı
 */
async function kur(a, yolSon) {
  const b = await chromium.launch();
  const s = await b.newContext({ viewport: { width: 390, height: 900 } });
  await s.addInitScript((a) => {
    const oturum =
      a.rol === 'ogrenci'
        ? { rol: 'ogrenci', token: 't'.repeat(64),
            ogrenci: { id: a.OGR, ad: 'Elif Sayfa', sinif: '10U', tur: 'okul' } }
        : { rol: 'ogretmen', token: 'sahte', ad: 'Buket Topuzoğlu' };
    localStorage.setItem('sekiz_oturum', JSON.stringify(oturum));
    window.__cagrilar = [];
    window.__acilan = [];
    window.open = (u) => { window.__acilan.push(String(u)); return null; };
    const asil = window.fetch;
    const json = (o, st = 200) =>
      new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    const uzakta = (u) => /depo\.sahte/.test(u);

    window.fetch = async (u, o) => {
      const url = String(typeof u === 'string' ? u : u.url);
      let govde = null;
      try { govde = JSON.parse(String(o?.body ?? 'null')); } catch { /* ikili gövde */ }

      if (uzakta(url)) {
        window.__cagrilar.push({ ad: 'PUT', url });
        return new Response('', { status: 200 });
      }
      if (/functions\/v1\/dosya-url/.test(url)) {
        window.__cagrilar.push({ ad: 'dosya-url', govde });
        if (govde.islem === 'yukle') {
          if (a.zatenVar) return json({ hata: 'Bu dosya zaten yüklenmiş.', mevcut: true }, 409);
          const n = /-(\d)\.jpg$/.exec(govde.yol)?.[1] ?? '1';
          if (String(a.bozukSayfa) === n) return json({ hata: 'Yükleme bağlantısı oluşturulamadı.' }, 500);
          return json({ imzaliUrl: 'https://depo.sahte/yukle/' + govde.yol, jeton: 'j', yol: govde.yol });
        }
        return json({ imzaliUrl: 'https://depo.sahte/oku/' + govde.yol, gecerlilikSn: 60 });
      }
      const m = url.match(/\/rpc\/([a-z_]+)/);
      if (!m) return asil(u, o);
      window.__cagrilar.push({ ad: m[1], govde });

      switch (m[1]) {
        case 'ogrenci_odevleri':
          return json({
            ogrenci: { id: a.OGR, ad: 'Elif Sayfa', sinif: '10U', tur: 'okul' },
            okunmamis_mesaj: 0,
            odevler: [{
              id: a.ODEV, baslik: 'Limit — açık uçlu', aciklama: null, tur: 'acik',
              son_tarih: '2099-12-31', soru_sayisi: null, gec_teslim: true, sik_sayisi: 5,
              sinif_arsiv: false, odev_yolu: null, gonderim: null,
              cevap_anahtari: null, anahtar_yolu: null, konu_analizi: [],
            }],
            dersler: [],
          });
        case 'odev_sayfa_siniri':
          if (a.sinir === 'yok') {
            return json({ code: 'PGRST202',
              message: 'Could not find the function public.odev_sayfa_siniri in the schema cache' }, 404);
          }
          return json(a.sinir);
        case 'odev_gonder': return json({ id: 'g1', durum: 'incelemede' });
        case 'ewalu_mesajlari': return json([]);
        case 'odev_kiyasi': return json(null);
        case 'siniflar_listesi': return json(a.SINIFLAR);
        case 'konu_onerileri': return json([]);
        case 'odevler_coklu_olustur':
          return json({ grup_id: null, odevler: [{ odev_id: 'y1', sinif_id: 's10u', sinif: '10U' }] });
        case 'odev_detay': {
          const d = {
            id: 'a1', baslik: 'Limit', aciklama: null, tur: 'acik', sinif_id: 's10u', sinif: '10U',
            son_tarih: '2099-12-31', soru_sayisi: null, gec_teslim: true, sik_sayisi: 5,
            cevap_anahtari: {}, konular: null, anahtar_yolu: null, odev_yolu: null,
            yayinda: true, gonderim_sayisi: 4, kardesler: null,
          };
          if (a.detaySinir !== undefined) d.sayfa_limiti = a.detaySinir;
          return json(d);
        }
        case 'odev_guncelle': return json({ durum: 'tamam', yeniden_puanlanan: [] });
        case 'odev_gonderimleri':
          return json({
            odev: { id: 'a1', baslik: 'Limit', tur: 'acik', sinif: '10U', son_tarih: '2099-12-31',
                    soru_sayisi: null, gec_teslim: true, yayinda: true },
            ozet: { mevcut: 1, gonderen: 1, gecikmeli: 0, puan_bekleyen: 0 },
            konu_ozeti: [],
            satirlar: [{
              ogrenci_id: 'o1', ogrenci: 'Elif Sayfa', gonderim_id: 'g1', gonderdi: true,
              zaman: '2026-09-20T10:00:00Z', gecikmeli: false, durum: 'onaylandi',
              dogru: null, yanlis: null, bos: null, puan: null, ogretmen_puan: 90,
              ogretmen_yorum: null, yanlis_sorular: [], bos_sorular: [], foto_var: true,
            }],
          });
        case 'gonderim_foto_yolu': return json(a.yollar);
        default: return json({});
      }
    };
  }, { ...a, ODEV, OGR, SINIFLAR });

  const p = await s.newPage();
  await p.goto(KOK + '#' + yolSon, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { b, p };
}

const metin = (p) => p.evaluate(() => document.body.innerText);
const cagrilar = (p) => p.evaluate(() => window.__cagrilar);
const acilan = (p) => p.evaluate(() => window.__acilan);
const bekle = (p, ms = 700) => p.waitForTimeout(ms);
const yuklemeler = async (p) =>
  (await cagrilar(p)).filter((c) => c.ad === 'dosya-url' && c.govde?.islem === 'yukle').map((c) => c.govde.yol);
const gonderim = async (p) => (await cagrilar(p)).filter((c) => c.ad === 'odev_gonder');

// ---------------------------------------------------------------------------
console.log('--- B1. Öğrenci, SINIR 1: ekran ve ağ çağrısı 0054 öncesiyle aynı ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', sinir: 1 }, `/ogrenci/odev/${ODEV}`);
  const m = await metin(p);
  if (!m.includes('Çözüm fotoğrafı') || m.includes('sayfa seçildi')) bozuk('tek alan yerine çok sayfalı ekran çizildi');
  else tamam('bugünkü tek alan çizildi, sayaç yok');
  if (await p.locator('input[type=file][multiple]').count()) bozuk('tek alanlı yolda `multiple` var');
  await p.locator('input[type=file]').setInputFiles(gorsel('cozum.png'));
  await bekle(p);
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await bekle(p, 1200);
  const y = await yuklemeler(p);
  const g = await gonderim(p);
  if (y.length !== 1 || y[0] !== YOL1) bozuk(`yükleme yolu bugünkünden farklı: ${JSON.stringify(y)}`);
  else tamam('tek yükleme, yol 0009\'dan beri aynı (`<ogrenci>.jpg`)');
  if (g.length !== 1 || g[0].govde.p_foto_yolu !== YOL1 || 'p_ek_sayfa_yollari' in g[0].govde) {
    bozuk(`odev_gonder gövdesi değişmiş: ${JSON.stringify(g[0]?.govde)}`);
  } else tamam('odev_gonder yeni alan TAŞIMIYOR — 0054 öncesi veritabanıyla uyumlu');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B2. Öğrenci, UÇ YOK (0054 çalıştırılmamış): ekran bozulmuyor, sınır 1 ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', sinir: 'yok' }, `/ogrenci/odev/${ODEV}`);
  const m = await metin(p);
  if (!m.includes('Çözüm fotoğrafı') || !m.includes('Ödevi gönder')) bozuk('uç yokken teslim ekranı çizilmedi');
  else tamam('uç yok → bugünkü tek alan, hata ekranı yok');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B3. Öğrenci, SINIR 3: sınır, çıkarma, sıra ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', sinir: 3 }, `/ogrenci/odev/${ODEV}`);
  if (!(await metin(p)).includes('0/3 sayfa seçildi')) bozuk('sayaç çizilmedi');
  if (!(await p.locator('input[type=file][multiple]').count())) bozuk('çoklu seçim yok');
  await p.locator('input[type=file]').setInputFiles(['a', 'b', 'c', 'd'].map((x) => gorsel(`${x}.png`)));
  await bekle(p, 1200);
  let m = await metin(p);
  if (!m.includes('3/3 sayfa seçildi') || !m.includes('1 görsel eklenmedi')) {
    bozuk('4 görsel seçilince 3 alınıp taşma SÖYLENMEDİ');
  } else tamam('4 seçildi → 3 alındı, "1 görsel eklenmedi" yazıldı');
  if (await p.locator('input[type=file]').count()) bozuk('sınır doluyken ekleme alanı hâlâ açık');
  else tamam('sınır doluyken ekleme kapalı');
  await p.getByRole('button', { name: '2. sayfayı çıkar' }).click();
  await bekle(p, 300);
  m = await metin(p);
  if (!m.includes('2/3 sayfa seçildi') || (await p.getByRole('button', { name: '3. sayfayı çıkar' }).count())) {
    bozuk('çıkarınca yeniden numaralanmadı');
  } else tamam('ortadan çıkarılınca 2 sayfa, boşluksuz numara');
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await bekle(p, 1500);
  const y = await yuklemeler(p);
  const g = await gonderim(p);
  if (JSON.stringify(y) !== JSON.stringify([YOL1, yol(2)])) bozuk(`yükleme sırası/yolu yanlış: ${JSON.stringify(y)}`);
  else tamam('yüklemeler sırayla: `<ogrenci>.jpg`, `<ogrenci>-2.jpg`');
  if (g.length !== 1 || g[0].govde.p_foto_yolu !== YOL1
      || JSON.stringify(g[0].govde.p_ek_sayfa_yollari) !== JSON.stringify([yol(2)])) {
    bozuk(`odev_gonder gövdesi yanlış: ${JSON.stringify(g[0]?.govde)}`);
  } else tamam('odev_gonder: 1. sayfa `p_foto_yolu`, ek sayfa `p_ek_sayfa_yollari`');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B4. YARIDA KALAN yükleme: gönderim YOK, seçim duruyor ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', sinir: 3, bozukSayfa: 2 }, `/ogrenci/odev/${ODEV}`);
  await p.locator('input[type=file]').setInputFiles([gorsel('a.png'), gorsel('b.png')]);
  await bekle(p, 1000);
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await bekle(p, 1200);
  const m = await metin(p);
  if ((await gonderim(p)).length) bozuk('YARIM YÜKLEMEYLE odev_gonder ÇAĞRILDI');
  else tamam('2. sayfa düşünce odev_gonder çağrılmadı');
  if (!m.includes('Yüklenen sayfa: 1/2') || !m.includes('henüz gönderilmedi')) bozuk('yarıda kalma söylenmedi');
  else tamam('"Yüklenen sayfa: 1/2 … henüz gönderilmedi" yazıldı');
  if (!m.includes('2/3 sayfa seçildi')) bozuk('seçim kayboldu');
  else tamam('seçilen görseller duruyor');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B5. "ZATEN VAR": yeniden denemede mevcut dosya kullanılıyor ---');
{
  const { b, p } = await kur({ rol: 'ogrenci', sinir: 1, zatenVar: true }, `/ogrenci/odev/${ODEV}`);
  await p.locator('input[type=file]').setInputFiles(gorsel('cozum.png'));
  await bekle(p);
  await p.getByRole('button', { name: 'Ödevi gönder' }).click();
  await bekle(p, 1200);
  const g = await gonderim(p);
  if (g.length !== 1 || g[0].govde.p_foto_yolu !== YOL1) bozuk('"zaten var"da gönderim yapılmadı — öğrenci kilitli kalırdı');
  else tamam('409 {mevcut} → gönderim yapıldı (tek sayfada da)');
  if (!(await metin(p)).includes('önceki denemende')) bozuk('önceki dosyanın kullanıldığı söylenmedi');
  else tamam('"önceki denemende yüklenmişti" dürüstçe yazıldı');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B6. Öğretmen, OLUŞTUR: varsayılan 1 ağa HİÇ gitmiyor, 3 gidiyor ---');
for (const sinir of [1, 3]) {
  const { b, p } = await kur({ rol: 'ogretmen' }, '/ogretmen/odevler/yeni');
  // Seçiciler KESİN: "Son tarih" geç teslim kutusunun ("…son tarihten
  // sonra…") etiketine de uyuyor.
  await p.getByRole('textbox', { name: 'Başlık (zorunlu)' }).fill('Sayfa denemesi');
  await p.getByText('10U', { exact: true }).click();
  await p.locator('input[type=date]').fill('2099-12-31');
  await p.getByRole('combobox', { name: 'Tür', exact: true }).selectOption('acik');
  const m = await metin(p);
  if (!m.includes('tek görsel')) bozuk('varsayılan cümle ("tek görsel") yok');
  if (sinir !== 1) {
    await p.getByRole('button', { name: 'Birden fazla sayfaya izin ver' }).click();
    await p.getByLabel('Sayfa sınırı').selectOption(String(sinir));
  }
  await p.getByRole('button', { name: 'Devam' }).click();
  await p.getByRole('button', { name: 'Taslağı kaydet' }).click();
  await bekle(p, 1000);
  const c = (await cagrilar(p)).find((x) => x.ad === 'odevler_coklu_olustur');
  if (!c) bozuk('odevler_coklu_olustur çağrılmadı');
  else if (sinir === 1 && 'p_sayfa_limiti' in c.govde) bozuk('varsayılan 1 AĞA GİTTİ — 0054 öncesi veritabanı düşerdi');
  else if (sinir === 3 && c.govde.p_sayfa_limiti !== 3) bozuk(`3 seçildi, giden: ${c.govde.p_sayfa_limiti}`);
  else tamam(sinir === 1 ? 'sınır 1: `p_sayfa_limiti` gönderilmedi' : 'sınır 3: `p_sayfa_limiti: 3` gönderildi');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B7. Öğretmen, DÜZENLE: kayıttaki sınır açık gelir; değişmeyen gitmez ---');
{
  const { b, p } = await kur({ rol: 'ogretmen', detaySinir: 3 }, '/ogretmen/odevler/a1');
  await bekle(p);
  const sec = p.getByLabel('Sayfa sınırı');
  if (!(await sec.count()) || (await sec.inputValue()) !== '3') bozuk('3 sayfalık ödevde seçim kapalı ya da yanlış');
  else tamam('kayıttaki 3 KENDİLİĞİNDEN AÇIK ve seçili (sessizce 1\'e dönmüyor)');
  await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await bekle(p, 800);
  let c = (await cagrilar(p)).filter((x) => x.ad === 'odev_guncelle');
  if (!c.length || 'p_sayfa_limiti' in c[0].govde) bozuk('değişmeyen sınır ağa gitti');
  else tamam('değişmeyen sınır gönderilmedi (null = dokunma)');
  await b.close();
}
{
  const { b, p } = await kur({ rol: 'ogretmen', detaySinir: 3 }, '/ogretmen/odevler/a1');
  await bekle(p);
  await p.getByLabel('Sayfa sınırı').selectOption('2');
  if (!(await metin(p)).includes('yapılmış gönderimleri değiştirmez')) bozuk('düşürmede gönderim notu çıkmadı');
  else tamam('düşürünce "yapılmış gönderimleri değiştirmez" notu çıktı');
  await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await bekle(p, 800);
  const c = (await cagrilar(p)).filter((x) => x.ad === 'odev_guncelle');
  if (!c.length || c[0].govde.p_sayfa_limiti !== 2) bozuk('değişen sınır gönderilmedi');
  else tamam('3 → 2: `p_sayfa_limiti: 2` gönderildi');
  await b.close();
}
{
  const { b, p } = await kur({ rol: 'ogretmen' }, '/ogretmen/odevler/a1');
  await bekle(p);
  if (!(await metin(p)).includes('tek görsel') || (await p.getByLabel('Sayfa sınırı').count())) {
    bozuk('0054 öncesi detayda (alan yok) ekran bozuldu');
  } else tamam('0054 öncesi detay (alan yok) → kapalı, "tek görsel"');
  await b.close();
}

// ---------------------------------------------------------------------------
console.log('--- B8. Öğretmen, GÖNDERİM: tek sayfa doğrudan, çok sayfa sırayla ---');
{
  const { b, p } = await kur({ rol: 'ogretmen', yollar: { yol: YOL1, yollar: [YOL1] } }, '/ogretmen/odevler/a1/gonderimler');
  await p.getByRole('button', { name: 'Çözümü aç' }).click();
  await bekle(p);
  const a = await acilan(p);
  if (a.length !== 1 || !a[0].endsWith(YOL1) || (await p.getByRole('button', { name: '1. sayfa' }).count())) {
    bozuk(`tek sayfada davranış değişti: ${JSON.stringify(a)}`);
  } else tamam('tek sayfa: tıklayınca doğrudan açıldı (bugünkü gibi)');
  await b.close();
}
{
  // 0054 ÖNCESİ cevap: yalnız `yol`.
  const { b, p } = await kur({ rol: 'ogretmen', yollar: { yol: YOL1 } }, '/ogretmen/odevler/a1/gonderimler');
  await p.getByRole('button', { name: 'Çözümü aç' }).click();
  await bekle(p);
  const a = await acilan(p);
  if (a.length !== 1 || !a[0].endsWith(YOL1)) bozuk('0054 öncesi cevapta (yalnız `yol`) açılmadı');
  else tamam('0054 öncesi cevap (yalnız `yol`) → doğrudan açıldı');
  await b.close();
}
{
  const { b, p } = await kur(
    { rol: 'ogretmen', yollar: { yol: YOL1, yollar: [YOL1, yol(2), yol(3)] } },
    '/ogretmen/odevler/a1/gonderimler',
  );
  await p.getByRole('button', { name: 'Çözümü aç' }).click();
  await bekle(p);
  if ((await acilan(p)).length) bozuk('çok sayfada sekmeler toplu açıldı');
  const dugmeler = await p.getByRole('group', { name: 'Çözüm sayfaları' }).getByRole('button').allInnerTexts();
  if (JSON.stringify(dugmeler) !== JSON.stringify(['1. sayfa', '2. sayfa', '3. sayfa'])) {
    bozuk(`sayfa düğmeleri yanlış: ${JSON.stringify(dugmeler)}`);
  } else tamam('3 sayfa: "1. sayfa · 2. sayfa · 3. sayfa", hiçbiri kendiliğinden açılmadı');
  await p.getByRole('button', { name: '3. sayfa' }).click();
  await bekle(p);
  const a = await acilan(p);
  if (a.length !== 1 || !a[0].endsWith(yol(3))) bozuk(`3. sayfa yanlış açıldı: ${JSON.stringify(a)}`);
  else tamam('"3. sayfa" tam olarak `-3.jpg`\'yi açtı');
  await b.close();
}

console.log('');
if (hata) {
  console.log(`SAYFA SINIRI DENETİMİ BAŞARISIZ — ${hata} sapma`);
  process.exit(1);
}
console.log('SAYFA SINIRI DENETİMİ GEÇTİ');
