import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SINIFLAR=[9,10,11].flatMap(s=>['A','B'].map(h=>({id:`${s}${h}`,ad:`${s}${h}`,seviye:s,sube:h,arsiv:false,ogrenci_sayisi:12})));
const OGR={toplam:40,sayfa:1,toplam_sayfa:2,kayitlar:[{id:'a',ad:'Elif Yıldırım',tur:'okul',sinif:'9A'},{id:'b',ad:'Ece Güneş',tur:'ozel',sinif:'Özel ders'}]};
const bugun=new Date(); const gun=n=>{const d=new Date(bugun);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const ODEVLER_LISTESI=[{id:'a1',baslik:'Türev testi — sayfa 84',aciklama:null,tur:'test',sinif_id:'11B',sinif:'11B',
  son_tarih:gun(8),soru_sayisi:10,gec_teslim:true,sik_sayisi:5,yayinda:true,olusturma:gun(-10),
  odev_pdf_var:true,anahtar_pdf_var:true,gonderim_sayisi:12,gec_gonderim_sayisi:3,sinif_mevcudu:20}];
const PANO_DETAY={tur:'gondermeyen',baslik:'Göndermeyen öğrenciler',
  aciklama:'Süresi dolmuş ödevlerden en az birini göndermemiş öğrenciler.',toplam:3,
  gruplar:[{sinif:'9A',ozel:false,satirlar:[{ad:'Mehmet Kaya',eksik:3},{ad:'Zeynep Şahin',eksik:1}]},
           {sinif:'Özel ders',ozel:true,satirlar:[{ad:'Ozan Demir',eksik:1}]}]};
const SINIF_DETAY={sinif:{id:'11B',ad:'11B',ozel:false,arsiv:false},degerlendirilen_odev:8,
  ogrenciler:[
   {id:'o1',ad:'Ali Yıldırım',tur:'okul',yapti:8,yapmadi:0,ortalama_yapan:86.5,ortalama_tum:86.5},
   {id:'o2',ad:'Ayşe Demir',tur:'okul',yapti:2,yapmadi:6,ortalama_yapan:90.0,ortalama_tum:22.5},
   {id:'o3',ad:'Mehmet Kaya',tur:'okul',yapti:0,yapmadi:8,ortalama_yapan:null,ortalama_tum:0.0}]};
const GONDERIMLER={odev:{id:'a1',baslik:'Limit — açık uçlu',tur:'acik',sinif:'11B',son_tarih:gun(-2),
   soru_sayisi:null,gec_teslim:true,yayinda:true},
  ozet:{mevcut:4,gonderen:3,gecikmeli:1,puan_bekleyen:1},
  satirlar:[
   {ogrenci_id:'o1',ogrenci:'Ali Yıldırım',gonderim_id:'g1',gonderdi:true,zaman:gun(-1)+'T14:20:00Z',gecikmeli:true,
    durum:'incelemede',dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:null,ogretmen_yorum:null,foto_var:true,
    yanlis_sorular:[],bos_sorular:[]},
   {ogrenci_id:'o2',ogrenci:'Mehmet Kaya',gonderim_id:null,gonderdi:false,zaman:null,gecikmeli:false,
    durum:null,dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:null,ogretmen_yorum:null,foto_var:false,
    yanlis_sorular:[],bos_sorular:[]},
   {ogrenci_id:'o3',ogrenci:'Ece Güneş',gonderim_id:'g3',gonderdi:true,zaman:gun(-4)+'T18:40:00Z',gecikmeli:false,
    durum:'onaylandi',dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:90,ogretmen_yorum:'Güzel.',foto_var:true,
    yanlis_sorular:[],bos_sorular:[]},
   {ogrenci_id:'o4',ogrenci:'Zeynep Şahin',gonderim_id:'g4',gonderdi:true,zaman:gun(-3)+'T11:05:00Z',gecikmeli:false,
    durum:'puanlandi',dogru:6,yanlis:3,bos:1,puan:60,ogretmen_puan:null,ogretmen_yorum:null,foto_var:true,
    yanlis_sorular:[2,7,9],bos_sorular:[10]}],
  konu_ozeti:[{konu:'Limit',toplam:5,dogru:2,yanlis:2,bos:1},
              {konu:'Türev',toplam:5,dogru:4,yanlis:1,bos:0}]};
const OGRENCI_ODEVLERI={ogrenci:{id:'o1',ad:'Elif Yıldırım',sinif:'11B',tur:'ozel'},okunmamis_mesaj:1,dersler:[{zaman:gun(2)+'T16:00:00Z',mod:'online',link:'https://ornek/ders'}],odevler:[
  {id:'a1',baslik:'Türev testi',aciklama:null,tur:'test',son_tarih:gun(2),soru_sayisi:5,gec_teslim:true,sik_sayisi:5,sinif_arsiv:false,
   odev_yolu:'odev/x.pdf',gonderim:null,konu_analizi:[],cevap_anahtari:null,anahtar_yolu:null},
  {id:'a3',baslik:'Üslü Sayılar',aciklama:null,tur:'test',son_tarih:gun(-6),soru_sayisi:2,gec_teslim:true,sik_sayisi:4,sinif_arsiv:false,
   odev_yolu:'odev/z.pdf',
   gonderim:{id:'g1',zaman:gun(-7),durum:'puanlandi',dogru:1,yanlis:1,bos:0,puan:50,ogretmen_puan:null,ogretmen_yorum:null,cevaplar:{1:'A',2:'D'},gecikmeli:true},
   konu_analizi:[{konu:'Üslü Sayılar',toplam:1,dogru:0,yanlis:1,bos:0},
                 {konu:'Köklü Sayılar',toplam:1,dogru:1,yanlis:0,bos:0}],
   cevap_anahtari:{1:'A',2:'B'},anahtar_yolu:'odev/z-anahtar.pdf'},
  {id:'a4',baslik:'Arşivlenmiş sınıfın ödevi',aciklama:null,tur:'test',son_tarih:gun(3),soru_sayisi:5,
   gec_teslim:true,sik_sayisi:5,sinif_arsiv:true,
   odev_yolu:'odev/w.pdf',gonderim:null,konu_analizi:[],cevap_anahtari:null,anahtar_yolu:null}]};
// Kod artık ÖĞRENCİ BAŞINA geliyor (0018); toplu uç kaldırıldı.
const OGRENCI_KODLARI={ogrenci:'K7001XQ',veli:'K7051XQ'};
const VELILER={toplam_okunmamis:2,
  yanit_bekleyen:[{ogrenci_id:'o1',ad:'Ada Yıldırım',sinif:'9A',okunmamis:2,son_mesaj:gun(-2)+'T09:15:00Z'}],
  gruplar:[{sinif_id:'9A',sinif:'9A',ozel:false,veli_sayisi:12,okunmamis:2},
           {sinif_id:'ozel',sinif:'Özel ders',ozel:true,veli_sayisi:3,okunmamis:0}]};
const SINIF_VELILERI={sinif:{id:'9A',ad:'9A',ozel:false},veliler:[
  {ogrenci_id:'o1',ad:'Ada Yıldırım',tur:'okul',veli_kodu_var:true,mesaj_sayisi:3,son_mesaj:gun(-2)+'T09:15:00Z',okunmamis:2},
  {ogrenci_id:'o2',ad:'Cem Şahin',tur:'okul',veli_kodu_var:false,mesaj_sayisi:0,son_mesaj:null,okunmamis:0}]};
const YAZISMA={ogrenci:{id:'o1',ad:'Ada Yıldırım',sinif:'9A'},kanal:'veli',veli_kodu_var:true,mesajlar:[
  {kimden:'veli',metin:'Merhaba hocam.',zaman:gun(-2)+'T09:15:00Z'},
  {kimden:'ogretmen',metin:'Merhaba, buyurun.',zaman:gun(-2)+'T10:02:00Z'}]};
const VELI_PANEL={ogrenci:{ad:'Ada Yıldırım',sinif:'9A',tur:'ozel'},okunmamis_mesaj:1,
  odevler:[{baslik:'Türev testi',son_tarih:gun(-5),olusturma:gun(-12),gonderildi:true,
            gonderim_zamani:gun(-6)+'T20:10:00Z',puan:85,durum:'puanlandi',
            yanlis_sorular:[3,7],bos_sorular:[10],
            konu_analizi:[{konu:'Limit',toplam:4,dogru:2,yanlis:1,bos:1},
                          {konu:'Türev',toplam:6,dogru:5,yanlis:1,bos:0}]},
           {baslik:'Üslü sayılar',son_tarih:gun(-1),olusturma:gun(-7),gonderildi:false,
            gonderim_zamani:null,puan:null,durum:null,
            yanlis_sorular:[],bos_sorular:[],konu_analizi:[]}],
  mesajlar:YAZISMA.mesajlar,
  odemeler:[{tutar:1500.5,tarih:gun(-2),odendi:false},{tutar:1200,tarih:gun(-32),odendi:true}],
  son_gorulme:gun(-1)+'T20:00:00Z'};
const OZEL_DETAY={ogrenci:{id:'o9',ad:'Ozan Demir',tur:'ozel',sinif:'Özel ders',aktif:true},
  dersler:[{id:'d1',zaman:gun(3)+'T16:00:00Z',mod:'online',link:'https://ornek/ders',gecti:false},
           {id:'d2',zaman:gun(-4)+'T16:00:00Z',mod:'yuzyuze',link:null,gecti:true}],
  odemeler:[{id:'p1',tutar:1500.5,tarih:gun(-2),odendi:false},
            {id:'p2',tutar:800,tarih:gun(-32),odendi:true}],
  ozet:{toplam:2300.5,odenen:800,kalan:1500.5,ders_toplam:2,gelecek_ders:1}};
const ODEV_DETAY={id:'a1',baslik:'Türev testi',aciklama:null,tur:'test',sinif_id:'11B',sinif:'11B',
  son_tarih:gun(3),soru_sayisi:6,gec_teslim:false,sik_sayisi:5,
  cevap_anahtari:{1:'A',2:'B',3:'C',4:'D',5:'E',6:'A'},
  konular:{1:'Türev',2:'Türev',3:'Türev',4:'Limit',5:'Limit',6:'Limit'},
  anahtar_yolu:'odev/anahtar.pdf',odev_yolu:'odev/soru.pdf',yayinda:true,gonderim_sayisi:3,
  // 0031: kardeşli ödev seçildi ki YAYMA KARTI da her turda ölçülsün.
  // Kardeşsiz sahte veri bırakmak, ekranın en yeni bölümünü 360 px taşma ve
  // 44 px dokunma hedefi ölçümünün tamamen dışında bırakırdı.
  // Üçü bilerek farklı: biri arşivde (atlanacak), biri anahtarı ayrışmış,
  // biri aynı — üç etiketin üçü de aynı ekranda çiziliyor.
  kardesler:['11A','11C','10D'],
  kardes_detay:[{id:'a2',sinif:'11A',gonderim_sayisi:28,anahtar_ayni:false,arsiv:false},
                {id:'a5',sinif:'11C',gonderim_sayisi:31,anahtar_ayni:true,arsiv:false},
                {id:'a6',sinif:'10D',gonderim_sayisi:19,anahtar_ayni:false,arsiv:true}]};
const EWALU_MESAJLARI=[{bant:50,cumle:'Öğretmenin yazdığı örnek cümle — yarı yoldasın, kalanı birlikte tamamlayacağız.'}];
const KONU_ONERILERI=['Türev','Limit','Üslü Sayılar','Köklü Sayılar'];
// Rozetler AÇIKKEN ölçülüyor: sıfır dönseydi denetim rozetsiz bir
// arayüzü denetlerdi ve dokunma hedefi/taşma etkisi hiç görülmezdi.
const BILDIRIM={okunmamis_mesaj:128,puan_bekleyen:7};
// KONU KARNESİ DOLU ÖLÇÜLÜYOR (0023). Boş dönseydi denetim yalnız
// "henüz değerlendirilmiş ödev yok" kartını görürdü; çubuklar, uzun ödev
// adları ve iki haneli sayılar hiç ölçülmezdi. Uzun bir ödev adı bilerek
// var: 360 px'de taşmanın en olası yeri orası.
const KONU_KARNESI={kapsam:{tur:'sinif',ad:'11B',sinif:'11B',mevcut:24},odev_sayisi:8,
  konular:[{konu:'Üslü ve Köklü Sayılar',toplam:48,dogru:19,yanlis:22,bos:7},
           {konu:'Limit',toplam:32,dogru:20,yanlis:9,bos:3},
           {konu:'Türev',toplam:40,dogru:38,yanlis:2,bos:0}],
  gelisim:[{odev:'Üslü ve Köklü Sayılar · Değerlendirme Sınavı',tarih:gun(-40),tur:'test',deger:54.5,gonderen:22,mevcut:24},
           {odev:'Limit — açık uçlu',tarih:gun(-24),tur:'acik',deger:71,gonderen:19,mevcut:24},
           {odev:'Türev testi',tarih:gun(-9),tur:'test',deger:88.3,gonderen:24,mevcut:24},
           {odev:'Deneme 4',tarih:gun(-2),tur:'test',deger:null,gonderen:0,mevcut:24}]};
const OGRENCI_YAZISMALARI={toplam_okunmamis:1,
  yanit_bekleyen:[{ogrenci_id:'o1',ad:'Ada Yıldırım',sinif:'9A',okunmamis:1,son_mesaj:gun(-1)+'T08:00:00Z'}]};
const OGRENCI_MESAJLARI={mesajlar:[
  {kimden:'ogrenci',metin:'Hocam soruyu anlamadım.',zaman:gun(-1)+'T08:00:00Z'},
  {kimden:'ogretmen',metin:'Yarın derste bakalım.',zaman:gun(-1)+'T09:00:00Z'}],
  son_gorulme:gun(-1)+'T09:30:00Z'};
const KENDI_KARNEM={kapsam:{ad:'Ada Yıldırım',sinif:'9A'},odev_sayisi:2,
  konular:[{konu:'Oran',toplam:2,dogru:0,yanlis:2,bos:0},
           {konu:'Kesirler',toplam:2,dogru:2,yanlis:0,bos:0}],
  gelisim:[{odev:'Kesirler denemesi',tarih:gun(-3),tur:'test',deger:50},
           {odev:'Kesirler yazılı',tarih:gun(-2),tur:'acik',deger:70}]};
const CEVAP={kendi_karnem:KENDI_KARNEM,ogrenci_yazismalari:OGRENCI_YAZISMALARI,ogrenci_mesajlari:OGRENCI_MESAJLARI,bildirim_sayilari:BILDIRIM,konu_karnesi:KONU_KARNESI,ozel_ders_detay:OZEL_DETAY,odev_detay:ODEV_DETAY,ewalu_mesajlari:EWALU_MESAJLARI,konu_onerileri:KONU_ONERILERI,veliler_listesi:VELILER,sinif_velileri:SINIF_VELILERI,mesajlar_ogretmen:YAZISMA,
  veli_paneli:VELI_PANEL,ogrenci_kodlari:OGRENCI_KODLARI,ogretmen_panosu:{ogrenci_sayisi:40,odev_verilen_ogrenci:31,acik_odev:2,bekleyen_degerlendirme:1,gecikmis_eksik:3,son_gonderimler:[]},siniflar_listesi:SINIFLAR,ogrenciler_listesi:OGR,ogrenci_odevleri:OGRENCI_ODEVLERI,odevler_listesi:ODEVLER_LISTESI,odev_gonderimleri:GONDERIMLER,sinif_ogrencileri:SINIF_DETAY,pano_detay:PANO_DETAY};
const b=await chromium.launch();
let tasmali=0;
for (const [ad,yol,rol] of [['Giriş','/'],['Pano','/ogretmen'],['Sınıflar','/ogretmen/siniflar'],
                            ['Öğrenciler','/ogretmen/ogrenciler'],
                            ['Ödevler','/ogretmen/odevler'],
                            ['Gönderimler','/ogretmen/odevler/a1/gonderimler'],
                            ['Sınıf karnesi','/ogretmen/siniflar/11B'],
                            ['Pano detayı','/ogretmen/bugun/gondermeyen'],
                            ['Pano sınıfı','/ogretmen/bugun/gondermeyen/9A'],
                            ['Ödev düzenle','/ogretmen/odevler/a1'],
                            // 0030'da fark edildi: ödev OLUŞTURMA ekranı bu
                            // listede hiç yoktu — en çok alanı olan ekranlardan
                            // biri her turda ölçüm dışında kalmıştı.
                            ['Yeni ödev','/ogretmen/odevler/yeni'],
                            ['Ayarlar','/ogretmen/ayarlar'],
                            // 0032: beş bant × (önizleme + metin kutusu + iki
                            // düğme) — 360 px'de taşma riski en yüksek yeni
                            // ekran, listeye giriyor.
                            ['Ewalu mesajları','/ogretmen/ayarlar/ewalu'],
                            ['Öğrenci detayı','/ogretmen/ogrenciler/o9'],
                            ['Toplu ekleme','/ogretmen/ogrenciler/toplu'],
                            ['Kodlar','/ogretmen/kodlar'],
                            ['Kod sınıfı','/ogretmen/kodlar/9A'],
                            ['Kod fişleri','/ogretmen/kodlar/9A/fisler'],
                            ['Veliler','/ogretmen/veliler'],
                            ['Sınıf velileri','/ogretmen/veliler/sinif/9A'],
                            ['Yazışma','/ogretmen/veliler/yazisma/o1'],
                            ['Öğrenci yazışması','/ogretmen/ogrenciler/yazisma/o1'],
                            ['Veli panosu','/veli','veli'],
                            ['Veli ödevler','/veli/odevler','veli'],
                            ['Veli ödemeler','/veli/odemeler','veli'],
                            ['Veli konular','/veli/konular','veli'],
                            ['Veli mesajlar','/veli/mesajlar','veli'],
                            ['Öğrenci panosu','/ogrenci','ogrenci'],
                            ['Ödevlerim','/ogrenci/odevler','ogrenci'],
                            ['Öğrenci konularım','/ogrenci/konularim','ogrenci'],
                            ['Öğrenci mesajlar','/ogrenci/mesajlar','ogrenci'],
                            ['Teslim','/ogrenci/odev/a1','ogrenci'],
                            ['Teslim sonucu','/ogrenci/odev/a3','ogrenci'],
                            ['Kapalı sınıf','/ogrenci/odev/a4','ogrenci']]) {
  const p=await b.newPage({viewport:{width:360,height:780}});
  await p.route('**/rest/v1/rpc/*',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(CEVAP[r.request().url().split('/').pop().split('?')[0]]??{})}));
  if(yol!=='/') await p.addInitScript((r)=>localStorage.setItem('sekiz_oturum',JSON.stringify(
    r==='ogrenci' ? {rol:'ogrenci',token:'t'.repeat(64),ogrenci:{id:'o1',ad:'Elif Yıldırım',tur:'okul',sinif:'11B'}}
  : r==='veli'    ? {rol:'veli',token:'t'.repeat(64),ogrenci:{id:'o1',ad:'Ada Yıldırım',tur:'okul',sinif:'9A'}}
                  : {rol:'ogretmen',token:'t'.repeat(64)})), rol??'ogretmen');
  await p.goto('http://127.0.0.1:8788/yeni/#'+yol,{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  let odak=0, halka=0, yerel=0;
  for(let i=0;i<30;i++){
    await p.keyboard.press('Tab');
    const r=await p.evaluate(()=>{const e=document.activeElement;
      if(!e||e===document.body)return null;const s=getComputedStyle(e);
      return {tag:e.tagName, odakli:e.matches(':focus'),
              h:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0};});
    if(!r) continue;
    // ÇOK BÖLÜMLÜ DENETİMLERİN ÇIKIŞ KARESİ SAYILMAZ.
    // `<input type="date">` içinde gün/ay/yıl ayrı Tab durakları; üçünde de
    // odak halkası çıkıyor. Dördüncü Tab denetimden ÇIKARIYOR ve o anda
    // `document.activeElement` hâlâ tarih alanını gösteriyor ama `:focus`
    // artık eşleşmiyor, dolayısıyla halka da yok. Denetim bunu "halkasız
    // öğe" sayıyordu ve ödev formları kalıcı olarak 29/30 görünüyordu —
    // gerçek bir kusur değil, ölçüm hatası. Ölçüldü: kural eklenmeden de
    // üç gerçek durakta `outline: solid 2px`.
    if(!r.odakli) continue;
    // <video controls> kontrolleri shadow DOM'da yaşar. Tarayıcı kendi odak
    // göstergesini çizer (Chromium'da oynat düğmesinde beyaz halka — ekran
    // görüntüsüyle doğrulandı) ama activeElement host'u bildirdiği için
    // dışarıdan ölçülemez. Başarısızlık saymak yanlış olur; ayrı sayılıyor.
    if(r.tag==='VIDEO'){ yerel++; continue; }
    odak++; if(r.h)halka++;
  }
  // Gerçek dokunma hedefi: onay kutusu/radyo bir etiketin içindeyse
  // tıklanabilir alan etikettir, kutunun kendisi değil.
  const kucuk=await p.evaluate(()=>[...document.querySelectorAll('button,a,input,select,textarea')]
    .map(e=>{
      const hedef=(e.type==='checkbox'||e.type==='radio') ? (e.closest('label')||e) : e;
      return {t:(hedef.textContent||hedef.tagName).trim().slice(0,18),
              h:Math.round(hedef.getBoundingClientRect().height)};
    })
    .filter(x=>x.h>0&&x.h<44));
  const etiketsiz=await p.evaluate(()=>[...document.querySelectorAll('input,select,textarea')]
    .filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length);
  // YATAY TAŞMA — 360 px'de sayfanın kendisi yana kaymamalı.
  //
  // NEDEN BURADA: taşma her turda elle yazılan betiklerle ölçülüyordu, yani
  // yalnız o tur bakılan ekran korunuyordu. Bu betik zaten 22 ekranın
  // hepsini güncel sahte veriyle 360 px'de geziyor; ölçüm tek satır ve
  // sınıfın tamamını kapsıyor. Eklendiğinde 21/22 ekran temizdi, bir tanesi
  // (öğrenci detayı özet ızgarası) taşıyordu ve düzeltildi.
  //
  // Taşan öğe de yazılıyor: "2 px taşıyor" tek başına aranacak yer
  // bırakmıyor, çünkü suçlu çoğu zaman sınırı aşan kutu değil kabına
  // sığmayan metin oluyor.
  const tasma=await p.evaluate(()=>{
    const kok=document.documentElement;
    const fark=kok.scrollWidth-kok.clientWidth;
    if(fark<=0) return {fark:0,suclu:null};
    // En derindeki, içeriği kabından geniş olan öğe: asıl kaynak o.
    let suclu=null;
    for(const e of document.querySelectorAll('*'))
      if(e.clientWidth>0 && e.scrollWidth>e.clientWidth+0.5) suclu=e;
    return {fark, suclu: suclu ? `<${suclu.tagName.toLowerCase()}> `+
      `${suclu.clientWidth}→${suclu.scrollWidth}px "${(suclu.textContent||'').trim().slice(0,24)}"` : null};
  });
  if(tasma.fark>0) tasmali++;
  console.log(`${ad.padEnd(11)} odak ${halka}/${odak}${yerel?` (+${yerel} yerel video kontrolü, tarayıcı yönetiyor)`:''}  | 44px altı: ${kucuk.length} ${kucuk.length?JSON.stringify(kucuk):''} | etiketsiz alan: ${etiketsiz} | taşma: ${tasma.fark}px${tasma.suclu?' ← '+tasma.suclu:''}`);
  await p.close();
}
await b.close();
console.log(tasmali===0
  ? '\n→ 360 px yatay taşma: hiçbir ekranda yok ✓'
  : `\n→ ${tasmali} ekranda YATAY TAŞMA var`);
