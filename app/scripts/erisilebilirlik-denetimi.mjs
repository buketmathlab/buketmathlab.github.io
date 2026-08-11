import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SINIFLAR=[9,10,11].flatMap(s=>['A','B'].map(h=>({id:`${s}${h}`,ad:`${s}${h}`,seviye:s,sube:h,arsiv:false,ogrenci_sayisi:12})));
const OGR={toplam:40,sayfa:1,toplam_sayfa:2,kayitlar:[{id:'a',ad:'Elif Yıldırım',tur:'okul',sinif:'9A'},{id:'b',ad:'Ece Güneş',tur:'ozel',sinif:null}]};
const CEVAP={ogretmen_panosu:{ogrenci_sayisi:40,acik_odev:2,bekleyen_degerlendirme:1,gecikmis_eksik:3,son_gonderimler:[]},siniflar_listesi:SINIFLAR,ogrenciler_listesi:OGR};
const b=await chromium.launch();
for (const [ad,yol] of [['Giriş','/'],['Pano','/ogretmen'],['Sınıflar','/ogretmen/siniflar'],['Öğrenciler','/ogretmen/ogrenciler']]) {
  const p=await b.newPage({viewport:{width:360,height:780}});
  await p.route('**/rest/v1/rpc/*',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(CEVAP[r.request().url().split('/').pop().split('?')[0]]??{})}));
  if(yol!=='/') await p.addInitScript(()=>localStorage.setItem('sekiz_oturum',JSON.stringify({rol:'ogretmen',token:'t'.repeat(64)})));
  await p.goto('http://127.0.0.1:8788/yeni/#'+yol,{waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  let odak=0, halka=0;
  for(let i=0;i<30;i++){
    await p.keyboard.press('Tab');
    const r=await p.evaluate(()=>{const e=document.activeElement;
      if(!e||e===document.body)return null;const s=getComputedStyle(e);
      return {h:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0};});
    if(r){odak++; if(r.h)halka++;}
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
  console.log(`${ad.padEnd(11)} odak ${halka}/${odak}  | 44px altı: ${kucuk.length} ${kucuk.length?JSON.stringify(kucuk):''} | etiketsiz alan: ${etiketsiz}`);
  await p.close();
}
await b.close();
