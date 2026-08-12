import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SINIFLAR=[9,10,11].flatMap(s=>['A','B'].map(h=>({id:`${s}${h}`,ad:`${s}${h}`,seviye:s,sube:h,arsiv:false,ogrenci_sayisi:12})));
const OGR={toplam:40,sayfa:1,toplam_sayfa:2,kayitlar:[{id:'a',ad:'Elif Yıldırım',tur:'okul',sinif:'9A'},{id:'b',ad:'Ece Güneş',tur:'ozel',sinif:null}]};
const bugun=new Date(); const gun=n=>{const d=new Date(bugun);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const OGRENCI_ODEVLERI={ogrenci:{id:'o1',ad:'Elif Yıldırım',sinif:'11B'},dersler:[],odevler:[
  {id:'a1',baslik:'Türev testi',aciklama:null,tur:'test',son_tarih:gun(2),soru_sayisi:5,gec_teslim:true,sik_sayisi:5,
   odev_yolu:'odev/x.pdf',gonderim:null,cevap_anahtari:null,anahtar_yolu:null},
  {id:'a3',baslik:'Üslü Sayılar',aciklama:null,tur:'test',son_tarih:gun(-6),soru_sayisi:2,gec_teslim:true,sik_sayisi:4,
   odev_yolu:'odev/z.pdf',
   gonderim:{id:'g1',zaman:gun(-7),durum:'puanlandi',dogru:1,yanlis:1,bos:0,puan:50,ogretmen_puan:null,ogretmen_yorum:null,cevaplar:{1:'A',2:'D'},gecikmeli:true},
   cevap_anahtari:{1:'A',2:'B'},anahtar_yolu:'odev/z-anahtar.pdf'}]};
const CEVAP={ogretmen_panosu:{ogrenci_sayisi:40,acik_odev:2,bekleyen_degerlendirme:1,gecikmis_eksik:3,son_gonderimler:[]},siniflar_listesi:SINIFLAR,ogrenciler_listesi:OGR,ogrenci_odevleri:OGRENCI_ODEVLERI};
const b=await chromium.launch();
for (const [ad,yol,rol] of [['Giriş','/'],['Pano','/ogretmen'],['Sınıflar','/ogretmen/siniflar'],
                            ['Öğrenciler','/ogretmen/ogrenciler'],
                            ['Ödevlerim','/ogrenci','ogrenci'],
                            ['Teslim','/ogrenci/odev/a1','ogrenci'],
                            ['Teslim sonucu','/ogrenci/odev/a3','ogrenci']]) {
  const p=await b.newPage({viewport:{width:360,height:780}});
  await p.route('**/rest/v1/rpc/*',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(CEVAP[r.request().url().split('/').pop().split('?')[0]]??{})}));
  if(yol!=='/') await p.addInitScript((r)=>localStorage.setItem('sekiz_oturum',JSON.stringify(
    r==='ogrenci' ? {rol:'ogrenci',token:'t'.repeat(64),ogrenci:{id:'o1',ad:'Elif Yıldırım',tur:'okul',sinif:'11B'}}
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
