// Taps every visible control on every tab (and every day of the week on Today), one level into each sheet, and reports script errors.
const {chromium,devices}=require(process.argv[2]+'/node_modules/playwright');const fs=require('fs'),path=require('path');
const REPO=process.argv[2],OUT=process.argv[3];fs.mkdirSync(OUT,{recursive:true});const DIR=path.join(REPO,'src/pwa'),EXP=path.join(REPO,'src/export');
const seed={};for(const c of fs.readdirSync(EXP))for(const f of fs.readdirSync(path.join(EXP,c)))seed[c+'/'+f.replace(/\.json$/,'')]=JSON.parse(fs.readFileSync(path.join(EXP,c,f)));
const html=fs.readFileSync(path.join(DIR,'app.html'),'utf8');
const src=fs.readFileSync(path.join(DIR,'vv2.js'),'utf8');const mockSb=eval(src.match(/const mockSb=(`[\s\S]*?`);/)[1].replace('${JSON.stringify(seed)}','__SEED__')).replace('__SEED__',JSON.stringify(seed));
const W=ms=>new Promise(r=>setTimeout(r,ms));
const SKIP_ACT=new Set(['signout']);
const SKIP_W=new Set(['discard','finish','rmex','delset']);
const NOISE=/Failed to load resource|net::ERR|ERR_FAILED|Blocked by route/;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block',colorScheme:'dark'});const pg=await ctx.newPage();
const errors=[];pg.on('pageerror',e=>errors.push('pageerror: '+e.message.split('\n')[0]));pg.on('console',m=>{if(m.type()==='error'&&!NOISE.test(m.text()))errors.push('console: '+m.text().slice(0,200));});
await pg.route('**/*',r=>{const u=r.request().url();if(u.startsWith('https://app.test/')&&/\.png$/.test(u))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(REPO,u.split('/').pop()))});if(u.startsWith('https://app.test/')&&/\.(webmanifest|js)$/.test(u))return r.fulfill({body:fs.readFileSync(path.join(REPO,u.split('/').pop()))});if(u.startsWith('https://app.test/'))return r.fulfill({contentType:'text/html',body:html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>/,`<script>${mockSb}</script>`)});return r.abort();});
await pg.addInitScript(()=>{localStorage.clear();localStorage.setItem('mock-sess',JSON.stringify({user:{id:'u1'}}));});
await pg.goto('https://app.test/');await W(900);
const log=[];let clicks=0;
await pg.evaluate(()=>{const t=new Date();const k=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');const p=__store['plan/'+k]||{date:k};p.run={miles:4,label:'Easy 4 mi',detail:'HR under 143'};p.lift='A';p.liftNote='Lift first, then run';p.extra='PT: shrug, T/Y, wall slide, hi/low carry';p.soccer=true;__store['plan/'+k]=p;__rt({eventType:'UPDATE',new:{coll:'plan',id:k,data:p}});});await W(400);
const isOpen=()=>pg.evaluate(()=>document.getElementById('dlg').open);
const forceClose=async()=>{await pg.evaluate(()=>{const d=document.getElementById('dlg');if(d.open)d.close();});await W(150);};
async function clickAll(scopeSel, label, depth){
  const sel=`${scopeSel} button:not([disabled]), ${scopeSel} [data-act]:not(button), ${scopeSel} [data-w]:not(button)`;
  const seen=new Set();
  for(let i=0;i<300;i++){
    const els=await pg.$$(sel); if(i>=els.length) break; const el=els[i];
    const info=await el.evaluate(e=>({act:e.dataset.act||'',w:e.dataset.w||'',key:(e.dataset.act||e.dataset.w||'')+'|'+(e.dataset.d||e.dataset.k||e.dataset.i||e.dataset.e||e.dataset.slot||e.dataset.id||'')+'|'+(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,24),vis:!!(e.offsetWidth||e.offsetHeight),cls:e.className,nav:!!(e.closest('.tabs,.tabbar,nav.tabs')||e.matches('.tab,.wd,.wkb,[data-pseg],[data-lday],.lnk.back,.seg button'))}));
    if(!info.vis||seen.has(info.key)) continue; seen.add(info.key);
    if(SKIP_ACT.has(info.act)||SKIP_W.has(info.w)){log.push(`${label} | ${info.key} | skipped`);continue;}
    if(info.nav) continue;
    if(depth>0&&(info.act==='close'||info.w==='close'||info.w==='peekclose')) continue;
    const before=errors.length, wasOpen=await isOpen();
    try{await el.click({timeout:1500});}catch(e){log.push(`${label} | ${info.key} | unclickable: ${e.message.split('\n')[0].slice(0,80)}`);continue;}
    clicks++; await W(220);
    const nowOpen=await isOpen();
    const title=nowOpen?await pg.evaluate(()=>((document.querySelector('.sh-nav .ttl')||document.querySelector('.sh h1')||{}).textContent||'').trim().slice(0,40)):'';
    const res=errors.length>before?`ERROR ${errors.slice(before).join(' ; ')}`:nowOpen&&!wasOpen?`opened "${title}"`:'ok';
    log.push(`${label} | ${info.key} | ${res}`);
    if(nowOpen&&!wasOpen&&depth===0){ await clickAll('#sh', `${label} > ${title}`, 1); await forceClose(); }
    else if(nowOpen&&depth>0&&!wasOpen){ /* a sheet opened from a sheet: leave it, the parent closes it */ }
  }
}
const TABS=['today','plan','health','fuel','you'];
for(const t of TABS){
  await pg.tap(`.tab[data-tab="${t}"]`);await W(400);
  if(t==='today'){
    for(let d=0;d<7;d++){ await pg.tap(`.tab[data-tab="today"]`);await W(200); const wd=await pg.$$('.wd'); if(!wd[d]) break; await wd[d].click();await W(300); await clickAll('#view',`today day${d+1}`,0); await forceClose(); }
    await pg.tap(`.tab[data-tab="today"]`);await W(200);await pg.tap('.wkb[aria-label="Previous week"]');await W(300);await clickAll('#view .tl, #view .tl.rec','today prev-week',0);await forceClose();
  } else if(t==='plan'){
    for(const seg of ['schedule','runs','lifts','program']){ await pg.tap(`.tab[data-tab="plan"]`);await W(200); await pg.tap(`[data-pseg="${seg}"]`);await W(300); await clickAll('#view',`plan ${seg}`,0); await forceClose();
      if(seg==='lifts'){ const days=await pg.$$('[data-lday]'); for(let i=0;i<days.length;i++){ const dd=await pg.$$('[data-lday]'); if(!dd[i]) break; await dd[i].click();await W(250); await clickAll('#view .group, #view .ex, #view .sets',`plan lifts day${i+1}`,0); await forceClose(); } } }
  } else { await clickAll('#view',t,0); await forceClose(); }
}
// nav + button on each tab
for(const t of TABS){ await pg.tap(`.tab[data-tab="${t}"]`);await W(250); const before=errors.length; await pg.tap('#logBtn');await W(250); const title=await pg.evaluate(()=>((document.querySelector('.sh-nav .ttl')||{}).textContent||'').trim().slice(0,40)); log.push(`${t} | #logBtn | ${errors.length>before?'ERROR':'opened "'+title+'"'}`); await clickAll('#sh',`${t} > + "${title}"`,1); await forceClose(); }
fs.writeFileSync(path.join(OUT,'crawl.log'),log.join('\n'));
const bad=log.filter(l=>/ERROR|unclickable/.test(l));
console.log(`clicks=${clicks} logged=${log.length} opened=${log.filter(l=>/opened/.test(l)).length} skipped=${log.filter(l=>/skipped/.test(l)).length} errors=${errors.length} bad=${bad.length}`);
if(bad.length) console.log(bad.join('\n')); if(errors.length) console.log(errors.join('\n'));
await b.close();})().catch(e=>{console.error('FAIL',e.message.split('\n')[0]);process.exit(1)});
