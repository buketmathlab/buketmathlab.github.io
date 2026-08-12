import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SINIFLAR=[9,10,11].flatMap(s=>['A','B'].map(h=>({id:`${s}${h}`,ad:`${s}${h}`,seviye:s,sube:h,arsiv:false,ogrenci_sayisi:12})));
const OGR={toplam:40,sayfa:1,toplam_sayfa:2,kayitlar:[{id:'a',ad:'Elif Yıldırım',tur:'okul',sinif:'9A'},{id:'b',ad:'Ece Güneş',tur:'ozel',sinif:null}]};
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
  ozet:{mevcut:3,gonderen:2,gecikmeli:1,puan_bekleyen:1},
  satirlar:[
   {ogrenci_id:'o1',ogrenci:'Ali Yıldırım',gonderim_id:'g1',gonderdi:true,zaman:gun(-1)+'T14:20:00Z',gecikmeli:true,
    durum:'incelemede',dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:null,ogretmen_yorum:null,foto_var:true},
   {ogrenci_id:'o2',ogrenci:'Mehmet Kaya',gonderim_id:null,gonderdi:false,zaman:null,gecikmeli:false,
    durum:null,dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:null,ogretmen_yorum:null,foto_var:false},
   {ogrenci_id:'o3',ogrenci:'Ece Güneş',gonderim_id:'g3',gonderdi:true,zaman:gun(-4)+'T18:40:00Z',gecikmeli:false,
    durum:'onaylandi',dogru:null,yanlis:null,bos:null,puan:null,ogretmen_puan:90,ogretmen_yorum:'Güzel.',foto_var:true}]};
const OGRENCI_ODEVLERI={ogrenci:{id:'o1',ad:'Elif Yıldırım',sinif:'11B'},dersler:[],odevler:[
  {id:'a1',baslik:'Türev testi',aciklama:null,tur:'test',son_tarih:gun(2),soru_sayisi:5,gec_teslim:true,sik_sayisi:5,sinif_arsiv:false,
   odev_yolu:'odev/x.pdf',gonderim:null,cevap_anahtari:null,anahtar_yolu:null},
  {id:'a3',baslik:'Üslü Sayılar',aciklama:null,tur:'test',son_tarih:gun(-6),soru_sayisi:2,gec_teslim:true,sik_sayisi:4,sinif_arsiv:false,
   odev_yolu:'odev/z.pdf',
   gonderim:{id:'g1',zaman:gun(-7),durum:'puanlandi',dogru:1,yanlis:1,bos:0,puan:50,ogretmen_puan:null,ogretmen_yorum:null,cevaplar:{1:'A',2:'D'},gecikmeli:true},
   cevap_anahtari:{1:'A',2:'B'},anahtar_yolu:'odev/z-anahtar.pdf'},
  {id:'a4',baslik:'Arşivlenmiş sınıfın ödevi',aciklama:null,tur:'test',son_tarih:gun(3),soru_sayisi:5,
   gec_teslim:true,sik_sayisi:5,sinif_arsiv:true,
   odev_yolu:'odev/w.pdf',gonderim:null,cevap_anahtari:null,anahtar_yolu:null}]};
// Kod artık ÖĞRENCİ BAŞINA geliyor (0018); toplu uç kaldırıldı.
const OGRENCI_KODLARI={ogrenci:'K7001XQ',veli:'K7051XQ'};
const VELILER={toplam_okunmamis:2,
  yanit_bekleyen:[{ogrenci_id:'o1',ad:'Ada Yıldırım',sinif:'9A',okunmamis:2,son_mesaj:gun(-2)+'T09:15:00Z'}],
  gruplar:[{sinif_id:'9A',sinif:'9A',ozel:false,veli_sayisi:12,okunmamis:2},
           {sinif_id:'ozel',sinif:'Özel ders',ozel:true,veli_sayisi:3,okunmamis:0}]};
const SINIF_VELILERI={sinif:{id:'9A',ad:'9A',ozel:false},veliler:[
  {ogrenci_id:'o1',ad:'Ada Yıldırım',tur:'okul',veli_kodu_var:true,mesaj_sayisi:3,son_mesaj:gun(-2)+'T09:15:00Z',okunmamis:2},
  {ogrenci_id:'o2',ad:'Cem Şahin',tur:'okul',veli_kodu_var:false,mesaj_sayisi:0,son_mesaj:null,okunmamis:0}]};
const YAZISMA={ogrenci:{id:'o1',ad:'Ada Yıldırım',sinif:'9A'},veli_kodu_var:true,mesajlar:[
  {kimden:'veli',metin:'Merhaba hocam.',zaman:gun(-2)+'T09:15:00Z'},
  {kimden:'ogretmen',metin:'Merhaba, buyurun.',zaman:gun(-2)+'T10:02:00Z'}]};
const VELI_PANEL={ogrenci:{ad:'Ada Yıldırım',sinif:'9A',tur:'okul'},
  odevler:[{baslik:'Türev testi',son_tarih:gun(-5),olusturma:gun(-12),gonderildi:true,
            gonderim_zamani:gun(-6)+'T20:10:00Z',puan:85,durum:'puanlandi'},
           {baslik:'Üslü sayılar',son_tarih:gun(-1),olusturma:gun(-7),gonderildi:false,
            gonderim_zamani:null,puan:null,durum:null}],
  mesajlar:YAZISMA.mesajlar,odemeler:[],son_gorulme:gun(-1)+'T20:00:00Z'};
const CEVAP={veliler_listesi:VELILER,sinif_velileri:SINIF_VELILERI,mesajlar_ogretmen:YAZISMA,
  veli_paneli:VELI_PANEL,ogrenci_kodlari:OGRENCI_KODLARI,ogretmen_panosu:{ogrenci_sayisi:40,odev_verilen_ogrenci:31,acik_odev:2,bekleyen_degerlendirme:1,gecikmis_eksik:3,son_gonderimler:[]},siniflar_listesi:SINIFLAR,ogrenciler_listesi:OGR,ogrenci_odevleri:OGRENCI_ODEVLERI,odevler_listesi:ODEVLER_LISTESI,odev_gonderimleri:GONDERIMLER,sinif_ogrencileri:SINIF_DETAY,pano_detay:PANO_DETAY};
const b=await chromium.launch();
for (const [ad,yol,rol] of [['Giriş','/'],['Pano','/ogretmen'],['Sınıflar','/ogretmen/siniflar'],
                            ['Öğrenciler','/ogretmen/ogrenciler'],
                            ['Ödevler','/ogretmen/odevler'],
                            ['Gönderimler','/ogretmen/odevler/a1/gonderimler'],
                            ['Sınıf karnesi','/ogretmen/siniflar/11B'],
                            ['Pano detayı','/ogretmen/bugun/gondermeyen'],
                            ['Pano sınıfı','/ogretmen/bugun/gondermeyen/9A'],
                            ['Kodlar','/ogretmen/kodlar'],
                            ['Kod sınıfı','/ogretmen/kodlar/9A'],
                            ['Veliler','/ogretmen/veliler'],
                            ['Sınıf velileri','/ogretmen/veliler/sinif/9A'],
                            ['Yazışma','/ogretmen/veliler/yazisma/o1'],
                            ['Veli paneli','/veli','veli'],
                            ['Ödevlerim','/ogrenci','ogrenci'],
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
      return {tag:e.tagName, h:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0};});
    if(!r) continue;
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
  console.log(`${ad.padEnd(11)} odak ${halka}/${odak}${yerel?` (+${yerel} yerel video kontrolü, tarayıcı yönetiyor)`:''}  | 44px altı: ${kucuk.length} ${kucuk.length?JSON.stringify(kucuk):''} | etiketsiz alan: ${etiketsiz}`);
  await p.close();
}
await b.close();
