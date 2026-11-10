// V&V for the Healthspan upgrade: pause, rest timer, delete sets, swaps, add exercise, split stretches, PT tags,
// goal suggestions, Health page, Coming Up, drafts that survive a restart, discard, rename.
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const DIR=__dirname, EXP=path.join(DIR,'../export'), out=path.join(DIR,'shots/v3');fs.mkdirSync(path.dirname(out),{recursive:true});
const seed={};for(const c of fs.readdirSync(EXP))for(const f of fs.readdirSync(path.join(EXP,c)))seed[c+'/'+f.replace(/\.json$/,'')]=JSON.parse(fs.readFileSync(path.join(EXP,c,f)));
const iso=d=>d.toISOString().slice(0,10);const T=new Date();
// 60 days of watch data with clear trends so pillar statuses are testable
for(let i=0;i<60;i++){const d=new Date(T);d.setDate(d.getDate()-i);const k=iso(d);seed['daily/'+k]=Object.assign({},seed['daily/'+k]||{},{date:k,rhr:52+Math.round(i/10),hrv:68-Math.round(i/8),sleep:+(7.4-(i%3)*.2).toFixed(1),weight:+(182+i*.03).toFixed(1),steps:9000+i*10,vo2:+(46-i*.03).toFixed(1)});}
seed['settings/ptDaily']={items:[{id:'doorway-am',slot:'am',name:'Doorway stretch',dose:'5 x 30 s',target:1,freq:'Round 1 of 2'}]};
if(seed['loads/a10'])seed['loads/a10'].name='Dead hang 2x30s, doorway stretch 5x30s, thoracic extension 2x8, upper trap and levator stretch 3x30s/side';
[['p1','Shrug','35s','3 x 10','A1'],['p2','Banded wall slide','Band','3 x 12','A2']].forEach(([id,n,l,sc,bl],i)=>seed['loads/'+id]={day:'P',order:i+1,block:bl,name:n,load:l,scheme:sc,pt:true,rest:60});
if(seed['loads/b3'])seed['loads/b3'].history=[...(seed['loads/b3'].history||[]),{date:'2026-10-01',load:150,reps:10,scheme:'150x10'}];
if(seed['loads/b1'])seed['loads/b1'].history=[...(seed['loads/b1'].history||[]),{date:'2026-10-01',load:150,reps:6,scheme:'150x6'}];
seed['settings/goalSuggestions']={items:[{id:'g1',title:'Average 7.5 h of sleep',detail:'7-day average',why:'Sleep has been under 7 h on 3 nights this week.'},{id:'g2',title:'Check in 5 days a week',detail:'',why:'Check-ins let the plan adjust to how you feel.'}]};
const html=fs.readFileSync(path.join(DIR,'app.html'),'utf8');
const src=fs.readFileSync(path.join(DIR,'vv2.js'),'utf8');const mockSb=eval(src.match(/const mockSb=(`[\s\S]*?`);/)[1].replace('${JSON.stringify(seed)}','__SEED__')).replace('__SEED__',JSON.stringify(seed));
const R=[];process.on('unhandledRejection',e=>{console.log(R.join('\n'));console.log('FAIL crash: '+String(e&&e.message||e).split('\n')[0]);process.exit(1);});const ok=(n,c,x)=>R.push((c?'PASS ':'FAIL ')+n+(x?' :: '+x:''));
async function route(pg){await pg.route('**/*',r=>{const u=r.request().url();
 if(u.startsWith('https://app.test/')&&/\.png$/.test(u))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(DIR,'../..',u.split('/').pop()))});
 if(u.startsWith('https://app.test/')&&/\.(webmanifest|js)$/.test(u))return r.fulfill({body:fs.readFileSync(path.join(DIR,'../..',u.split('/').pop()))});
 if(u.startsWith('https://app.test/'))return r.fulfill({contentType:'text/html',body:html});
 if(u.includes('supabase-js'))return r.fulfill({contentType:'application/javascript',body:mockSb});
 return r.abort();});}
const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();
for(const scheme of ['light','dark']){
 const ctx=await b.newContext({...devices['iPhone 13'],colorScheme:scheme,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await route(pg);
 await pg.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.clear();localStorage.setItem('mock-sess',JSON.stringify({user:{id:'u1'}}));}});
 await pg.goto('https://app.test/');await W(700);const P=scheme+': ';
 ok(P+'renamed to Healthspan',(await pg.title())==='Healthspan'&&await pg.evaluate(()=>document.querySelector('meta[name=apple-mobile-web-app-title]').content)==='Healthspan');
 ok(P+'five tabs: Today, Plan, Health, Fuel, You',(await pg.$$eval('.tab',x=>x.map(e=>e.dataset.tab).join(',')))==='today,plan,health,fuel,you');
 // Today: timeline with a button per session type
 await pg.screenshot({path:out+'-'+scheme+'-today.png',fullPage:true});
 ok(P+'Today shows race countdown and date',/Race in \d+ days/i.test(await pg.textContent('.tk'))&&/^\w+day, \w{3} \d+$/.test(await pg.textContent('.dt1')),await pg.textContent('.dt1'));
 ok(P+'race countdown bar fills toward race day',await pg.$eval('.cdb i',e=>{const w=parseFloat(e.style.width);return w>0&&w<=100;})&&/\d+ days until race day/.test(await pg.getAttribute('.cd','aria-label')));
 ok(P+'three labeled bars: miles, lifts, PT days',(await pg.$$eval('.bars .bxh span',x=>x.map(e=>e.textContent).join(',')))==='Miles,Lifts,PT days'&&(await pg.$$eval('.bars .bxh b',x=>x.every(e=>/^\d+(\.\d)? of \d+(\.\d)?$/.test(e.textContent)))));
 ok(P+'Up next sits above the week, with a full-width action',await pg.evaluate(()=>{const f=document.querySelector('.focusbox .tli.next'),b=document.querySelector('.bars');if(!f||!b)return false;const go=f.querySelector('.go');return !!(f.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!go&&go.getBoundingClientRect().width>f.querySelector('.tlc').getBoundingClientRect().width*0.8;}));
 ok(P+'timeline lists the day',(await pg.$$('.tl .tli')).length>=1);
 ok(P+'session buttons are 44 pt targets',await pg.$$eval('.tlc .go, .ckin',x=>x.length>0&&x.every(e=>e.getBoundingClientRect().height>=44)));
 const tday=await pg.evaluate(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');});
 // Pick a planned day with a run and a lift to check each type gets its own button
 const wds=await pg.$$eval('.wd',x=>x.map(e=>e.dataset.sday));
 const fut=wds.find(d=>d>tday);
 if(fut){await pg.tap(`.wd[data-sday="${fut}"]`);await W(250);
  ok(P+'tapping a day shows that day',(await pg.getAttribute(`.wd[data-sday="${fut}"]`,'aria-pressed'))==='true'&&!!(await pg.$('.lnk.back')));
  ok(P+'future sessions offer View, not Start',!(await pg.$('.tlc [data-act="workout"]'))&&!(await pg.$('.tlc [data-act="logrun"]')));
  await pg.tap('.lnk.back');await W(200);}
 ok(P+'back to today',!(await pg.$('.lnk.back')));
 await pg.evaluate(t=>{__store['plan/'+t]=Object.assign({},__store['plan/'+t]||{},{date:t,run:{miles:3,label:'Easy 3 mi'},lift:'C',extra:'PT: shrug',soccer:false});__rt({eventType:'UPDATE',new:{coll:'plan',id:t,data:__store['plan/'+t]}});},tday);await W(300);
 const acts=await pg.$$eval('.tlc .go',x=>x.map(e=>e.dataset.act+':'+(e.dataset.day||'')+':'+e.textContent));
 ok(P+'run gets Log Run, lift and PT session get Start',acts.some(a=>a.startsWith('rundone::Mark done'))&&acts.some(a=>/^workout:C:(Start|Resume)/.test(a))&&acts.some(a=>/^workout:P:(Start|Resume)/.test(a)),acts.join(' | '));
 const order=await pg.$$eval('.tl:not(.rec) .tlc .t',x=>x.map(e=>e.textContent.toLowerCase()));
 ok(P+'warm-up sits right before the run',(()=>{const i=order.findIndex(k=>k.includes('warm-up'));return i>=0&&order[i+1]&&/\d mi/.test(order[i+1]);})(),order.join(','));
 ok(P+'no eyebrow label above card titles',await pg.$$eval('.tlc .main',x=>x.every(m=>m.firstElementChild&&m.firstElementChild.classList.contains('t'))));
 await pg.tap('.tlc [data-act="warmup"]');await W(250);
 ok(P+'warm-up opens a checklist',(await pg.textContent('.sh-nav .ttl')).startsWith('Run warm-up')&&(await pg.$$('.sh [data-act="warmtick"]')).length===7);
 for(let i=0;i<7;i++){await pg.tap(`.sh [data-act="warmtick"] >> nth=${i}`);await W(150);}
 ok(P+'warm-up checks save for today',await pg.evaluate(t=>Object.keys((__store['daily/'+t]||{}).warm||{}).length===7,tday)&&(await pg.textContent('.sh-nav .ttl small')).startsWith('7 of 7'));
 await pg.tap('.sh [data-act="close"]');await W(250);
 ok(P+'finished warm-up fades, says Done, and is no longer up next',(await pg.$$eval('.tli.done',x=>x.map(e=>e.querySelector('.t').textContent.toLowerCase()))).some(c=>c.startsWith('done')&&c.includes('warm-up'))&&!(await pg.textContent('.tli.next .t')).toLowerCase().includes('warm-up')&&(await pg.textContent('.tli.next .k'))==='Up next');
 ok(P+'Day C comes before the run',order.findIndex(k=>k.includes('day c'))>=0&&order.findIndex(k=>k.includes('day c'))<order.findIndex(k=>/\d mi/.test(k)),order.join(','));
 await pg.evaluate(t=>{const row={date:t,day:'C',status:'done',exercises:[{id:'c1',name:'Speed Smith squat',sets:[{load:'95',reps:'3',done:true}]}]};__store['liftlog/'+t]=row;__rt({eventType:'INSERT',new:{coll:'liftlog',id:t,data:row}});},tday);await W(300);
 await pg.tap('.tlc [data-act="workout"][data-day="P"]');await W(400);
 ok(P+'PT session starts on a day a lift is already logged',await pg.evaluate(()=>document.getElementById('dlg').open)&&(await pg.textContent('.sh-nav .ttl')).startsWith('PT Session'));
 await pg.tap('[data-w="tick"] >> nth=1');await W(200);await pg.tap('[data-w="finish"] >> nth=0');await W(500);
 ok(P+'both sessions are kept for the day',await pg.evaluate(t=>__store['liftlog/'+t].day==='C'&&__store['liftlog/'+t+'~P']&&__store['liftlog/'+t+'~P'].day==='P'&&__store['liftlog/'+t+'~P'].date===t&&!('docId' in __store['liftlog/'+t+'~P']),tday));
 ok(P+'timeline shows both as done',(await pg.$$('.tli.done')).length>=2);
 await pg.evaluate(t=>{for(const id of [t,t+'~P']){delete __store['liftlog/'+id];__rt({eventType:'DELETE',old:{coll:'liftlog',id}});}},tday);await W(300);
 const nextWk=await pg.$eval('.wkb[aria-label="Next week"]',e=>e.dataset.sday);await pg.tap('.wkb[aria-label="Next week"]');await W(250);
 ok(P+'week arrows move a week',(await pg.getAttribute('.wd.on','data-sday'))===nextWk&&(await pg.$$('.wd')).length===7);
 const vw=await pg.$('.tlc [data-act="liftsheet"][data-view="1"]');if(vw){await vw.tap();await W(250);ok(P+'viewing a future lift has no Start button',!(await pg.$('.sh [data-act="workout"]')));await pg.tap('.sh [data-act="close"]');await W(200);}
 let rv=null;for(let i=0;i<7&&!rv;i++){const wds=await pg.$$('.wd');await wds[i].tap();await W(200);rv=await pg.$('.tlc [data-act="runsheet"]');}
 ok(P+'a future run day offers a preview',!!rv);
 if(rv){await rv.tap();await W(250);ok(P+'previewing a future run opens its sheet with no Done button',(await pg.evaluate(()=>document.getElementById('dlg').open))&&!(await pg.$('.sh [data-act="rundone"], .sh [data-act="runquick"]'))&&(await pg.textContent('.sh-nav .ttl')).trim().length>0);await pg.tap('.sh [data-act="close"]');await W(200);}
 await pg.tap('.lnk.back');await W(250);
 await pg.tap('#logBtn');await W(250);await pg.tap('.sh [data-act="logrun"]');await W(250);ok(P+'Add Run opens the run form for today',(await pg.inputValue('#rDate'))===tday&&(await pg.inputValue('#rMi'))==='3');
 ok(P+'run form offers a one-tap watch fill',!!(await pg.$('[data-act="runquick"]')));await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'the run on Today has a one-tap Done',(await pg.textContent('.tlc [data-act="rundone"]'))==='Mark done');await pg.tap('.tlc [data-act="rundone"]');await W(400);
 const qr=await pg.evaluate(t=>Object.entries(__store).find(([k,v])=>k.startsWith('runs/')&&v&&v.date===t&&v.awaitWatch),tday);
 ok(P+'quick log saves the planned miles and waits for the watch',!!qr&&qr[1].miles===3&&qr[1].timeSec===null&&!(await pg.evaluate(()=>document.getElementById('dlg').open)),JSON.stringify(qr&&qr[1]));
 await pg.tap('.tab[data-tab="plan"]');await W(200);await pg.tap('[data-pseg="runs"]');await W(250);
 ok(P+'run list shows the waiting state',(await pg.textContent('#view')).includes('waiting for the watch'));
 await pg.tap('.tab[data-tab="today"]');await W(300);const oneBefore=await pg.evaluate(t=>Object.values(__store).filter(v=>v&&v.date===t&&v.awaitWatch).length,tday);const rd2=await pg.$('.tlc [data-act="rundone"]');if(rd2){await rd2.tap();await W(300);}
 ok(P+'a second Done does not make a second waiting run',oneBefore===1&&(await pg.evaluate(t=>Object.values(__store).filter(v=>v&&v.date===t&&v.awaitWatch).length,tday))===1);
 await pg.tap('.tlc [data-act="rundetail"]');await W(300);ok(P+'a waiting run shows what the watch will fill and can be removed',(await pg.textContent('.sh')).includes('Waiting for your watch')&&!!(await pg.$('.sh [data-act="rundel"]')));
 await pg.tap('.sh [data-act="rundel"]');await W(400);ok(P+'Remove this entry deletes the waiting run and closes the sheet',!(await pg.evaluate(()=>document.getElementById('dlg').open))&&(await pg.evaluate(t=>Object.values(__store).filter(v=>v&&v.date===t&&v.awaitWatch).length,tday))===0&&!!(await pg.$('.tlc [data-act="rundone"]')));
 const tmr=await pg.evaluate(t=>{const d=new Date(t+'T12:00:00');d.setDate(d.getDate()+1);const k=d.toISOString().slice(0,10);const p=__store['plan/'+k]||{date:k};p.run={miles:6,label:'6 mi at marathon race pace',detail:''};__store['plan/'+k]=p;__rt({eventType:'UPDATE',new:{coll:'plan',id:k,data:p}});return k;},tday);await W(300);
 await pg.tap('.tab[data-tab="plan"]');await W(200);await pg.tap('[data-pseg="schedule"]');await W(250);await pg.tap(`[data-act="daysheet"][data-d="${tmr}"]`);await W(300);
 const mpTxt=await pg.textContent('.sh');
 ok(P+'marathon race pace is a marathon-pace run, not a race',/\d{1,2}:\d\d to \d{1,2}:\d\d \/mi/.test(mpTxt)&&!/All out/.test(mpTxt),mpTxt.replace(/\s+/g,' ').slice(0,160));
 await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('[data-pseg="schedule"]');await W(200);await pg.tap('.tab[data-tab="today"]');await W(250);
 // Home PT slot sheet and check-in
 await pg.tap('[data-act="ptslot"][data-slot="am"]');await W(250);
 ok(P+'home PT opens a checklist',(await pg.textContent('.sh-nav .ttl')).startsWith('Morning PT'));
 ok(P+'home PT is a one-tap checklist, one row per item',(await pg.$$('.sh .pti[data-act="pttick"]')).length===(await pg.evaluate(()=>__store['settings/ptDaily'].items.filter(x=>(x.slot||'pm')==='am').length))&&!(await pg.$('.sh .sg'))&&(await pg.$$('.sh .pti[data-id="doorway-am"]')).length===1);
 ok(P+'checkbox is a 28 pt circle inside a 44 pt row',await pg.$eval('.sh .pti[data-id="doorway-am"]',e=>{const b=e.querySelector('.box').getBoundingClientRect();return e.getBoundingClientRect().height>=44&&Math.round(b.width)===28&&getComputedStyle(e.querySelector('.box')).borderRadius==='50%';}));
 await pg.tap('.sh .pti[data-id="doorway-am"]');await W(350);
 ok(P+'one tap completes the item and fills the check',(await pg.textContent('.sh-nav .ttl small')).startsWith('1 of')&&await pg.evaluate(t=>{const d=__store['daily/'+t];return d&&d.pt&&d.pt['doorway-am']===1;},tday)&&(await pg.getAttribute('.sh .pti[data-id="doorway-am"]','aria-pressed'))==='true'&&await pg.$eval('.sh .pti[data-id="doorway-am"] .box',e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'));
 await pg.tap('.sh .pti[data-id="doorway-am"]');await W(300);
 ok(P+'second tap clears it',await pg.evaluate(t=>__store['daily/'+t].pt['doorway-am']===0,tday)&&(await pg.getAttribute('.sh .pti[data-id="doorway-am"]','aria-pressed'))==='false');
 await pg.tap('.sh [data-act="ptall"]');await W(350);
 ok(P+'Mark all done completes the slot',await pg.evaluate(t=>{const d=__store['daily/'+t];return __store['settings/ptDaily'].items.filter(x=>(x.slot||'pm')==='am').every(x=>d.pt[x.id]>=(x.target||1));},tday)&&(await pg.textContent('.sh [data-act="ptall"]')).includes('Clear'));
 await pg.tap('.sh [data-act="ptall"]');await W(300);await pg.tap('.sh .pti[data-id="doorway-am"]');await W(300);
 ok(P+'checking an item updates the sheet',(await pg.textContent('.sh-nav .ttl small')).startsWith('1 of'));
 ok(P+'checked item strikes through',await pg.$eval('.sh .pti[data-id="doorway-am"] .t',e=>getComputedStyle(e).textDecorationLine.includes('line-through')));
 await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'PT bar counts it',(await pg.textContent('.bars .bx >> nth=2 >> .bxh b')).startsWith('1 of'));
 ok(P+'PT bar counts days of the week, Monday start',(await pg.textContent('.bars .bx >> nth=2')).includes('PT days')&&(await pg.textContent('.bars .bx >> nth=2 >> .bxh b')).endsWith('of 7')&&(await pg.$eval('.wd >> nth=0',e=>e.querySelector('small').textContent))==='M');
 const hadDot=!!(await pg.$('.ckin i'));await pg.evaluate(t=>{const d=__store['daily/'+t];if(d){delete d.energy;}},tday);
 await pg.tap('.ckin');await W(250);ok(P+'check-in sheet has one Save button',(await pg.$$('.sh [data-act="feelsave"]')).length===1&&!!(await pg.$('.sh-nav [data-act="feelsave"]')));for(const [k,vv] of [['energy',4],['soreness',2],['motivation',4]]) await pg.tap(`.sh [data-feel="${k}"][data-v="${vv}"]`);
 await pg.tap('.sh-nav [data-act="feelsave"]');await W(400);
 ok(P+'check-in saves and the dot goes away',await pg.evaluate(t=>__store['daily/'+t].energy===4,tday)&&!(await pg.$('.ckin i'))&&(await pg.textContent('.ckin')).includes('Checked in'));
 // Plan: schedule, runs, lifts
 await pg.tap('.tab[data-tab="plan"]');await W(250);
 const days=await pg.$$('#view .day');ok(P+'Plan schedule shows day cards with date blocks',days.length>=5&&!!(await pg.$('#view .day .dt .n')),String(days.length));
 await pg.tap('#view .day >> nth=0');await W(250);ok(P+'tapping a day opens its detail',(await pg.textContent('.sh-nav .ttl')).length>5&&(await pg.$$('.sh .group')).length>=1);await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'plan progress bar shows week and percent',/Week \d+/.test(await pg.textContent('.prog .ph'))&&/\d+% · race in \d+ days/.test(await pg.textContent('.prog .ph'))&&!/· ·/.test(await pg.textContent('.prog .ph')),await pg.textContent('.prog .ph'));
 await pg.tap('[data-act="notfeeling"]');await W(250);await pg.tap('[data-act="nfsend"]');await W(200);ok(P+'Not feeling it needs a reason',(await pg.textContent('.toast')).includes('Pick'));
 await pg.tap('[data-act="nfpick"][data-i="1"]');await pg.fill('#nfNote','Calves tight');await pg.tap('[data-act="nfsend"]');await W(300);
 ok(P+'Not feeling it files a request for tonight',await pg.evaluate(()=>Object.values(__store).some(v=>v&&v.kind==='change'&&v.status==='pending'&&v.text==='Not feeling 100% (Sore): Calves tight. Please ease the next few days.')));
 await pg.tap('[data-pseg="runs"]');await W(200);ok(P+'paces list is read out, not hidden behind a label',!(await pg.$('#view [data-act="paces"][aria-label]')));
 ok(P+'Plan shows runs: this week, paces, at most five recent runs',(await pg.textContent('#view')).includes('Recent runs')&&(await pg.$$('#view [data-act="rundetail"]')).length<=5&&!!(await pg.$('#view [data-act="paces"]')));
 if(await pg.$('#view [data-act="allruns"]')){await pg.tap('#view [data-act="allruns"]');await W(300);ok(P+'All runs opens every run',(await pg.$$('.sh [data-act="rundetail"]')).length===(await pg.evaluate(()=>Object.keys(__store).filter(k=>k.startsWith('runs/')).length)));await pg.tap('.sh [data-act="close"]');await W(200);}
 await pg.tap('[data-pseg="lifts"]');await W(200);ok(P+'Lifts no longer repeats the strength chart',!(await pg.textContent('#view')).includes('Strength progress')&&(await pg.textContent('#view')).includes('History'));await pg.tap('[data-pseg="runs"]');await W(200);
 await pg.tap('[data-act="rundetail"] >> nth=0');await W(250);ok(P+'tapping a run opens its detail',(await pg.$$eval('.sh .row .t',x=>x.map(e=>e.textContent))).join(',').includes('Avg heart rate'));await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('[data-pseg="lifts"]');await W(200);ok(P+'Plan shows lifts',!!(await pg.$('[data-lday="A"]')));
 await pg.evaluate(()=>{location.hash='runs';});await W(250);ok(P+'old #runs link opens Plan > Runs',(await pg.getAttribute('[data-pseg="runs"]','aria-pressed'))==='true');
 await pg.tap('.tab[data-tab="today"]');await W(250);
 // PT editor (from the home PT sheet)
 const openPT=async()=>{await pg.tap('[data-act="ptslot"] >> nth=0');await W(250);await pg.tap('.sh-nav [data-act="ptedit"]');await W(250);};
 await openPT();ok(P+'PT editor opens',(await pg.textContent('.sh-nav .ttl'))==='Edit PT');
 await pg.tap('[data-act="ptitem"][data-i="new"]');await W(200);await pg.fill('#piName','Neck rotation');await pg.fill('#piDose','2 x 10');await pg.selectOption('#piSlot','am');await pg.tap('[data-act="ptitemsave"]');await W(300);
 ok(P+'daily PT item added',await pg.evaluate(()=>__store['settings/ptDaily'].items.some(x=>x.name==='Neck rotation'&&x.slot==='am')));
 await pg.tap('[data-act="ptex"][data-id="p1"]');await W(200);await pg.fill('#peLoad','40s');await pg.tap('[data-act="ptexsave"]');await W(300);
 ok(P+'PT session exercise edited',await pg.evaluate(()=>__store['loads/p1'].load==='40s'));
 await pg.tap('[data-act="ptex"][data-id="p2"]');await W(200);await pg.tap('[data-act="ptexdel"]');await W(300);
 ok(P+'one tap does not remove a PT exercise',await pg.evaluate(()=>!!__store['loads/p2'])&&(await pg.textContent('[data-act="ptexdel"]'))==='Confirm remove');
 await pg.tap('[data-act="ptexdel"]');await W(300);
 ok(P+'PT session exercise removed',await pg.evaluate(()=>!__store['loads/p2']));
 await pg.tap('[data-act="ptex"][data-id="new"]');await W(200);await pg.fill('#peName','Prone Y');await pg.fill('#peScheme','3 x 12');await pg.tap('[data-act="ptexsave"]');await W(300);
 ok(P+'PT session exercise added',await pg.evaluate(()=>Object.values(__store).some(v=>v&&v.day==='P'&&v.name==='Prone Y')));
 ok(P+'new PT exercise gets its own block',await pg.evaluate(()=>{const v=Object.values(__store).find(v=>v&&v.day==='P'&&v.name==='Prone Y');return v&&v.block[0]!=='A';}));
 await pg.screenshot({path:out+'-'+scheme+'-ptedit.png',fullPage:true});
 await pg.tap('[data-act="ptex"][data-id="p1"]');await W(200);await pg.fill('#peLoad','99s');await W(600);await pg.keyboard.press('Escape');await W(250);await openPT();
 const pyId=await pg.evaluate(()=>Object.entries(__store).find(([k,v])=>v&&v.day==='P'&&v.name==='Prone Y')[0].split('/')[1]);
 await pg.tap(`[data-act="ptex"][data-id="${pyId}"]`);await W(250);ok(P+'unsaved edits stay with their own exercise',(await pg.inputValue('#peLoad'))!=='99s'&&(await pg.inputValue('#peName'))==='Prone Y');
 ok(P+'new PT exercise id is never reused',/^p-/.test(pyId),pyId);await pg.tap('.sh [data-act="ptedit"]');await W(200);
 const ptHas=()=>pg.evaluate(()=>__store['settings/ptDaily'].items.some(x=>x.name==='Neck rotation'));
 await pg.evaluate(()=>{const d=__store['settings/ptDaily'];d.items.unshift({id:'zz-live',slot:'pm',name:'Live insert',dose:'1',target:1});});
 const nk=await pg.$eval('[data-act="ptitem"]:has-text("Neck rotation")',e=>e.dataset.i);await pg.tap(`[data-act="ptitem"][data-i="${nk}"]`);await W(200);
 await pg.tap('[data-act="ptitemdel"]');await W(250);ok(P+'one tap does not remove a PT item',await ptHas());
 await pg.tap('[data-act="ptitemdel"]');await W(300);ok(P+'PT item removed by id, others kept',!(await ptHas())&&await pg.evaluate(()=>__store['settings/ptDaily'].items.some(x=>x.id==='doorway-am')));
 await pg.tap('.sh [data-act="close"]');await W(200);
 // Health
 await pg.tap('.tab[data-tab="health"]');await W(300);
 const pil=await pg.$$eval('#view .sec-h h2',x=>x.map(e=>e.textContent));ok(P+'Health groups the numbers: Fitness, Recovery, Body',pil.join('|')==='Fitness|Recovery|Body',pil.join('|'));
 ok(P+'Running and Strength trend cards sit on top',(await pg.$$('.hcard')).length===2&&(await pg.textContent('.hcard >> nth=0')).includes('Running')&&(await pg.textContent('.hcard >> nth=1')).includes('Index')&&(await pg.$$('.hcard svg[role="img"]')).length===2);
 const pills=await pg.$$eval('#view .sec-h .pill',x=>x.map(e=>e.textContent));ok(P+'group statuses computed from trends',pills[0]==='Improving'&&pills[1]==='Improving'&&pills[2]!=='Building baseline',pills.join(','));
 ok(P+'every body number opens its trend, long run included',(await pg.$$('#view .group [data-act="metric"]')).length===8&&!!(await pg.$('#view [data-act="metric"][data-k="long"]')));
 await pg.tap('#view [data-act="metric"][data-k="long"]');await W(250);ok(P+'long run trend opens',(await pg.textContent('.sh-nav .ttl'))==='Long run'&&!!(await pg.$('.sh .chart svg')));await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'icons inside trend cards keep their size',await pg.$$eval('.hcard .chev',x=>x.every(e=>e.getBoundingClientRect().width<=16))&&await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 ok(P+'strength card shows a status and its lifts open their trend',!!(await pg.$('.hcard[data-h="strength"] .hh .pill'))&&(await pg.$$('.hcard[data-h="strength"] [data-act="metric"][data-k^="lift:"]')).length>=1);
 const nLifts=+(await pg.textContent('[data-act="alllifts"] .v'));await pg.tap('[data-act="alllifts"]');await W(300);ok(P+'All lifts lists every lift with an estimated max',nLifts>0&&(await pg.$$('.sh [data-act="metric"][data-k^="lift:"]')).length===nLifts);
 await pg.tap('.sh [data-act="metric"][data-k^="lift:"] >> nth=0');await W(300);ok(P+'a lift opens its estimated-max trend',/est\. max/.test(await pg.textContent('.sh-nav .ttl')));await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'VO2 and steps shown',(await pg.textContent('#view')).includes('VO2 max')&&/9,\d{3}/.test(await pg.textContent('#view')));
 await pg.tap('[data-act="metric"][data-k="rhr"]');await W(250);ok(P+'tapping a number opens its trend',(await pg.textContent('.sh-nav .ttl'))==='Resting heart rate'&&!!(await pg.$('.sh .chart svg')));
 await pg.tap('[data-act="mrange"][data-n="30"]');await W(200);ok(P+'trend range switches',(await pg.getAttribute('[data-act="mrange"][data-n="30"]','aria-pressed'))==='true'&&!!(await pg.$('.sh .chart svg')));
 ok(P+'improving change shown in green',await pg.evaluate(()=>[...document.querySelectorAll('.sh .row .v')].some(e=>e.classList.contains('up'))));
 await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('[data-act="metric"][data-k="pace"]');await W(250);ok(P+'easy pace trend opens',(await pg.textContent('.sh-nav .ttl'))==='Easy pace');await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('[data-act="healthwhy"]');await W(250);ok(P+'Why these numbers matter cites a study for each group',(await pg.$$eval('.sh .why',x=>x.filter(e=>/\(\w.*\d{4}\)/.test(e.textContent)).length))===4);await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.screenshot({path:out+'-'+scheme+'-health.png',fullPage:true});
 // You: suggestions
 await pg.tap('.tab[data-tab="you"]');await W(250);
 ok(P+'suggested goals listed',(await pg.$$('[data-act="sugadd"]')).length===2);
 ok(P+'suggestion rows stay on one line',await pg.$$eval('.sugm .t, .sugm .s',x=>x.length>0&&x.every(e=>e.scrollHeight<=e.clientHeight+4)));
 await pg.tap('[data-act="sug"][data-id="g1"]');await W(250);ok(P+'tapping a suggestion shows the full reason',(await pg.textContent('.sh-body')).includes('under 7 h'));await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('#view [data-act="sugadd"][data-id="g1"]');await W(300);
 ok(P+'Add moves a suggestion into Goals',await pg.evaluate(()=>__store['settings/goals'].items.some(i=>i.title==='Average 7.5 h of sleep')&&__store['settings/goalSuggestions'].items.find(i=>i.id==='g1').state==='added'));
 await pg.tap('#view [data-act="sugno"][data-id="g2"]');await W(300);
 ok(P+'No dismisses and hides it',await pg.evaluate(()=>__store['settings/goalSuggestions'].items.find(i=>i.id==='g2').state==='dismissed')&&(await pg.$$('#view [data-act="sugadd"]')).length===0);
 ok(P+'milestones show date blocks and countdown',(await pg.$$('#view .ms-when')).length>=3);
 await pg.screenshot({path:out+'-'+scheme+'-you.png',fullPage:true});
 // draft survives an app restart
 await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(200);await pg.fill('#gT','Draft goal typed then app closed');await W(100);
 await pg.reload();await W(800);await pg.tap('.tab[data-tab="you"]');await W(200);await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(250);
 ok(P+'typed goal restored after restart',(await pg.inputValue('#gT'))==='Draft goal typed then app closed');
 await pg.tap('.sh [data-act="close"]');await W(200);await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(200);
 ok(P+'Cancel clears the draft',(await pg.inputValue('#gT'))==='');await pg.tap('.sh [data-act="close"]');await W(200);
 // Lifts: alternatives as a request
 await pg.tap('.tab[data-tab="plan"]');await W(200);await pg.tap('[data-pseg="lifts"]');await W(150);await pg.tap('[data-lday="A"]');await W(150);await pg.tap('[data-act="exinfo"][data-id="a1"]');await W(250);
 const alts=await pg.$$eval('[data-act="altreq"]',x=>x.map(e=>e.textContent));
 ok(P+'Smith bench offers equivalent swaps with scaled loads',alts.some(t=>t.includes('Flat DB bench')&&t.includes('55s'))&&alts.some(t=>t.includes('Push-up')&&t.includes('4 x 12')),alts.slice(0,3).join(' | '));
 const before=await pg.evaluate(()=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length);
 await pg.tap('[data-act="altreq"] >> nth=0');await W(300);
 ok(P+'tapping a swap sends a request',await pg.evaluate(n=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length===n+1,before));
 // Workout
 await pg.tap('.tab[data-tab="plan"]');await W(150);await pg.tap('[data-pseg="lifts"]');await W(150);await pg.tap('[data-lday="B"]');await W(150);await pg.tap('[data-act="workout"][data-day="B"]');await W(400);
 ok(P+'no -15 / +15 / Skip buttons',!(await pg.$('[data-w="m15"]'))&&!(await pg.$('[data-w="p15"]'))&&!(await pg.$('button:text-is("Skip")')));
 const names=await pg.$$eval('.sets.simple div[style*="font-weight:600"]',x=>x.map(e=>e.textContent.replace('PT','').trim()));
 ok(P+'cool-down split into separate checkboxes',names.includes('Couch stretch')&&names.includes('Thoracic extension'),names.join(','));
 ok(P+'PT items tagged',(await pg.$$('.tagpt')).length>=1);
 // rest timer after logging a set
 const firstSet=await pg.$('.ex .sg:not(.hd) [data-w="tick"]');await firstSet.tap();await W(300);
 ok(P+'logging a set starts the rest timer or superset cue',await pg.isVisible('#wRest')&&(/\d:\d\d/.test(await pg.textContent('#wTm'))||/Superset/.test(await pg.textContent('#wNx'))));
 await pg.tap('#wRest .x');await W(200);ok(P+'rest timer dismisses with ×',!(await pg.isVisible('#wRest')));
 // pause
 await pg.tap('.wtool [data-w="pause"]');await W(200);const t1=await pg.textContent('#wEl');await W(2200);const t2=await pg.textContent('#wEl');
 ok(P+'pause freezes the workout clock',t1===t2&&t1.startsWith('Paused'),t1+' / '+t2);
 await pg.tap('.wtool [data-w="pause"]');await W(1300);ok(P+'resume restarts the clock',!(await pg.textContent('#wEl')).startsWith('Paused'));
 // delete a set
 const n0=await pg.$$eval('.ex >> nth=1',()=>0).catch(()=>0);
 const ex0=await pg.evaluate(()=>{const i=[...document.querySelectorAll('[data-w="swap"]')][0].dataset.e;return +i;});
 const cnt=async()=>pg.$$eval(`.ex .sg:not(.hd) [data-e="${ex0}"][data-f="load"]`,x=>x.length);
 const c0=await cnt();await pg.tap(`[data-w="setmenu"][data-e="${ex0}"][data-s="1"]`);await W(150);await pg.tap('[data-w="delset"]');await W(250);
 ok(P+'a set can be deleted',(await cnt())===c0-1,c0+' -> '+(await cnt()));
 // swipe a set left to reveal a red Delete, swipe right to hide it
 const swipe=async(e,s,dx)=>pg.evaluate(([e,s,dx])=>{const g=document.querySelector(`[data-w="setmenu"][data-e="${e}"][data-s="${s}"]`).closest('.sg');const r=g.getBoundingClientRect(),x=r.left+r.width*0.6,y=r.top+r.height/2;
  const mk=(type,cx)=>{const tt=new Touch({identifier:1,target:g,clientX:cx,clientY:y});return new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[tt],changedTouches:[tt]});};
  g.dispatchEvent(mk('touchstart',x));g.dispatchEvent(mk('touchend',x+dx));},[e,s,dx]);
 await pg.tap(`[data-w="add"][data-e="${ex0}"]`);await W(200);const c1=await cnt();
 await swipe(ex0,c1-1,-90);await W(200);ok(P+'swiping an added set left shows a red Delete',!!(await pg.$(`[data-w="delset"][data-e="${ex0}"][data-s="${c1-1}"]`))&&(await pg.$eval('[data-w="delset"]',e=>getComputedStyle(e).backgroundColor))==='rgb(255, 69, 58)');
 await swipe(ex0,c1-1,90);await W(200);ok(P+'swiping right hides it',!(await pg.$('[data-w="delset"]')));
 await swipe(ex0,c1-1,-90);await W(200);await pg.tap('[data-w="delset"]');await W(250);ok(P+'tapping Delete removes the added set',(await cnt())===c1-1);
 // weight boxes take text; redraws wait while typing
 ok(P+'weight boxes use the text keyboard, reps stay numeric',await pg.$$eval('.sg input[data-f="load"]',x=>x.length>0&&x.every(e=>e.type==='text'&&!e.inputMode))&&await pg.$$eval('.sg input[data-f="reps"]',x=>x.every(e=>e.type==='number'&&!e.inputMode)));
 ok(P+'no box locks you to the number pad',await pg.evaluate(()=>!document.documentElement.outerHTML.match(/inputmode="(numeric|decimal)"/)));
 const box=`.sg input[data-f="load"][data-e="${ex0}"][data-s="0"]`;await pg.focus(box);await pg.fill(box,'35/15');
 await pg.evaluate(()=>{const id=Object.keys(__store).find(k=>k.startsWith('plan/'));__rt({eventType:'UPDATE',new:{coll:'plan',id:id.slice(5),data:__store[id]}});});await W(300);
 ok(P+'a sync while typing does not close the keyboard',await pg.evaluate(s=>document.activeElement===document.querySelector(s)&&document.activeElement.value==='35/15',box));
 await pg.evaluate(()=>document.activeElement.blur());await W(300);ok(P+'text weights are kept after leaving the box',(await pg.inputValue(box))==='35/15');
 // swap for today + keep going forward
 await pg.tap(`[data-w="swap"][data-e="${ex0}"]`);await W(250);
 const sw=await pg.$$eval('[data-w="swappick"]',x=>x.map(e=>e.textContent));ok(P+'Swap lists same-job exercises with loads',sw.some(t=>/Barbell back squat.*\d+ · \d+ x \d+/.test(t)),sw.join(' | '));
 await pg.check('#swPerm');const rq0=await pg.evaluate(()=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length);
 await pg.tap('[data-w="swappick"] >> nth=0');await W(300);
 ok(P+'swap applied in the workout',(await pg.textContent('.sh-body')).includes('instead of Smith squat'));
 const nEx=await pg.evaluate(()=>document.querySelectorAll('.sh .ex').length);const rmE=await pg.evaluate(()=>+[...document.querySelectorAll('[data-w="swap"]')].pop().dataset.e);
 await pg.tap(`[data-w="swap"][data-e="${rmE}"]`);await W(250);await pg.tap('[data-w="rmex"]');await W(300);
 ok(P+'Remove from today drops the exercise',(await pg.evaluate(()=>document.querySelectorAll('.sh .ex').length))===nEx-1&&(await pg.textContent('.toast')).includes('Removed'));
 ok(P+'"keep going forward" files a request',await pg.evaluate(n=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length===n+1,rq0));
 // add exercise
 await pg.tap('[data-w="addex"]');await W(250);const adds=await pg.$$('[data-w="addpick"]');ok(P+'add-exercise suggestions offered',adds.length>=2,String(adds.length));
 await pg.fill('#axName','Sled push');await pg.fill('#axLoad','90');await pg.fill('#axScheme','4 x 20');await pg.tap('[data-w="addcustom"]');await W(300);
 ok(P+'custom exercise added',(await pg.textContent('.sh-body')).includes('Sled push'));
 // last time's numbers fill a set; superset caption on one line
 const pvb=await pg.$('button.pv');if(pvb){const [pe,ps,txt]=await pvb.evaluate(e=>[e.dataset.e,e.dataset.s,e.textContent]);await pvb.tap();await W(250);
  const [l,rp]=txt.split(' × ');ok(P+'tapping Previous fills the set',(await pg.inputValue(`.sg input[data-f="load"][data-e="${pe}"][data-s="${ps}"]`))===l&&(await pg.inputValue(`.sg input[data-f="reps"][data-e="${pe}"][data-s="${ps}"]`))===rp,txt);}
 else ok(P+'tapping Previous fills the set',false,'no previous values shown');
 ok(P+'superset caption stays on one line',await pg.$$eval('.ss-cap',x=>x.length>0&&x.every(e=>e.getBoundingClientRect().height<32)));
 // personal best
 const pe0=await pg.evaluate(()=>+[...document.querySelectorAll('[data-w="plates"]')].find(b=>!b.closest('.ex').textContent.includes('instead of')).dataset.e);
 const free=await pg.evaluate(e=>{const b=[...document.querySelectorAll(`[data-w="tick"][data-e="${e}"]`)].find(x=>x.getAttribute('aria-pressed')!=='true');return b?+b.dataset.s:-1;},pe0);
 await pg.fill(`.sg input[data-f="load"][data-e="${pe0}"][data-s="${free}"]`,'500');await pg.fill(`.sg input[data-f="reps"][data-e="${pe0}"][data-s="${free}"]`,'5');await W(100);
 await pg.tap(`[data-w="tick"][data-e="${pe0}"][data-s="${free}"]`);await W(250);
 ok(P+'a heavier set is flagged as a new best',(await pg.textContent('.toast')).startsWith('New best')&&!!(await pg.$('.sg.pr')));
 ok(P+'PR set carries a PR tag on its number',await pg.evaluate(()=>{const n=document.querySelector('.sg.pr .no');return !!n&&getComputedStyle(n,'::after').content.includes('PR');}));
 await pg.tap(`[data-w="tick"][data-e="${pe0}"][data-s="${free}"]`);await W(200);ok(P+'unticking clears the best flag',!(await pg.$('.sg.pr')));
 // plate calculator
 await pg.tap(`[data-w="plates"][data-e="${pe0}"]`);await W(250);await pg.fill('#plW','225');await pg.selectOption('#plBar','45');await W(100);
 ok(P+'plates: 225 with a 45 lb bar is 45 + 45 a side',(await pg.textContent('.pltxt'))==='Each side: 45 + 45');
 await pg.fill('#plW','185');await pg.selectOption('#plBar','0');await W(100);
 ok(P+'plates: 185 in plates is 45 + 45 + 2.5 a side',(await pg.textContent('.pltxt'))==='Each side: 45 + 45 + 2.5');
 await pg.fill('#plW','46');await pg.selectOption('#plBar','45');await W(100);ok(P+'plates: odd remainder is reported',(await pg.textContent('#plOut')).includes('short')||(await pg.textContent('#plOut')).includes('Just the bar'),await pg.textContent('#plOut'));
 await pg.tap('[data-w="peekclose"]');await W(250);
 // typed set survives a restart, workout reopens by itself
 const inp=await pg.$('.sg input[data-f="load"]');await inp.fill('177');await pg.reload();await W(1200);
 ok(P+'open workout reopens after app restart',await pg.evaluate(()=>document.getElementById('dlg').open&&!!document.querySelector('[data-w="finish"]')));
 ok(P+'typed weight kept after restart',(await pg.$$eval('.sg input[data-f="load"]',x=>x.map(e=>e.value))).includes('177'));
 await pg.screenshot({path:out+'-'+scheme+'-workout.png'});
 // close pauses
 await pg.tap('[data-w="close"]');await W(300);ok(P+'closing pauses the workout',await pg.evaluate(()=>!!__store['liftlog/'+new Date().toISOString().slice(0,10)]||Object.values(__store).some(v=>v&&v.status==='in_progress'&&v.pausedAt)));
 // a workout move that is also home PT checks the home item off
 await pg.tap('.tab[data-tab="plan"]');await W(150);await pg.tap('[data-pseg="lifts"]');await W(150);await pg.tap('[data-lday="A"]');await W(100);await pg.tap('[data-act="workout"][data-day="A"]');await W(400);
 const dIdx=await pg.evaluate(()=>{const r=[...document.querySelectorAll('.sets.simple')].find(x=>/^Doorway stretch/.test(x.textContent));return r?+r.querySelector('[data-w="tick"]').dataset.e:-1;});
 const homePT=()=>pg.evaluate(()=>{const k=Object.keys(__store).filter(x=>x.startsWith('daily/')).sort().pop();const d=new Date();const t=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return ((__store['daily/'+t]||{}).pt||{})['doorway-am']||0;});
 const ptBefore=await homePT();
 ok(P+'workout shows which moves count for home PT',dIdx>=0&&(await pg.$$eval('.sets.simple',x=>x.filter(e=>e.textContent.includes('Counts for home PT')).length))===1);
 await pg.tap(`[data-w="tick"][data-e="${dIdx}"]`);await W(400);ok(P+'checking the doorway stretch in a workout checks it off at home',(await homePT())===Math.min(1,ptBefore+1),ptBefore+' -> '+(await homePT()));
 await pg.tap(`[data-w="tick"][data-e="${dIdx}"]`);await W(400);ok(P+'unchecking it gives the home item back',(await homePT())===ptBefore);
 await pg.tap(`[data-w="tick"][data-e="${dIdx}"]`);await W(300);await pg.tap('[data-w="discard"]');await W(150);await pg.tap('[data-w="discard"]');await W(500);
 ok(P+'discarding the workout gives the home item back',(await homePT())===ptBefore);
 // discard
 await pg.tap('.tab[data-tab="plan"]');await W(150);await pg.tap('[data-pseg="lifts"]');await W(150);await pg.tap('[data-lday="B"]');await W(100);await pg.tap('[data-act="workout"][data-day="B"]');await W(400);
 await pg.tap('[data-w="discard"]');await W(150);ok(P+'discard asks for a second tap',(await pg.textContent('[data-w="discard"]')).includes('Confirm discard'));
 await pg.tap('[data-w="discard"]');await W(400);ok(P+'discard removes the session',await pg.evaluate(()=>!Object.values(__store).some(v=>v&&v.status==='in_progress'&&v.exercises))&&!(await pg.evaluate(()=>document.getElementById('dlg').open)));
 // Settings: notifications state, watch sync sheet; gym: PR tag
 await pg.tap('.tab[data-tab="you"]');await W(300);
 ok(P+'notifications row shows its state',((await pg.textContent('#pushS'))||'').length>3&&(await pg.textContent('#pushS'))!=='Checking…',await pg.textContent('#pushS'));
 ok(P+'watch sync row shows the last sync',/ago|Not set up/.test(await pg.textContent('[data-act="watchsync"] .s')),await pg.textContent('[data-act="watchsync"] .s'));
 await pg.tap('[data-act="watchsync"]');await W(400);
 ok(P+'watch sync sheet gives the setup steps',(await pg.textContent('.sh-nav .ttl'))==='Watch sync'&&(await pg.textContent('.sh-body')).includes('REST API')&&!!(await pg.$('#haeUrl')));
 await pg.tap('.sh [data-act="close"]');await W(200);
 // Paces and Fuel
 await pg.tap('.tab[data-tab="today"]');await W(250);
 ok(P+'planned run shows a pace and heart-rate target, each fully visible',await pg.$$eval('.tlc .s',x=>{const p=x.find(e=>/^\d{1,2}:\d\d to \d{1,2}:\d\d \/mi$/.test(e.textContent));const h=x.find(e=>/^HR /.test(e.textContent));return !!p&&!!h&&p.scrollWidth<=p.clientWidth&&h.scrollWidth<=h.clientWidth;}),await pg.$$eval('.tlc .s',x=>x.map(e=>e.textContent).join(' | ')));
 await pg.tap('.tab[data-tab="plan"]');await W(200);await pg.tap('[data-pseg="runs"]');await W(250);
 ok(P+'Plan > Runs opens with the paces card',(await pg.textContent('[data-act="paces"]')).includes('Marathon pace')&&(await pg.textContent('[data-act="paces"]')).includes('Threshold'));
 await pg.tap('[data-act="paces"]');await W(300);await pg.fill('#ref5k','23:00');await pg.tap('.sh-nav [data-act="pacesave"]');await W(400);
 ok(P+'saving a 5K time updates the paces',await pg.evaluate(()=>__store['settings/main'].ref5k==='23:00'));
 await pg.tap('.tab[data-tab="fuel"]');await W(300);
 ok(P+'Fuel tab gives carb and protein grams for today, with sources',/Carbs[\s\S]*\d+ to \d+ g/.test(await pg.textContent('.hcard'))&&/Protein/.test(await pg.textContent('.hcard'))&&/Thomas[\s\S]*2016[\s\S]*J.ger[\s\S]*2017/.test(await pg.textContent('.hcard')));
 ok(P+'Fuel shows before, during and after as one-line rows',(await pg.$$eval('#view [data-act="fueltime"] .t',x=>x.map(e=>e.textContent).join(',')))==='Before,During,After');
 await pg.tap('#view [data-act="fueltime"] >> nth=0');await W(250);ok(P+'timing sheet has the full guidance and a source',(await pg.$$eval('.sh .cap',x=>x.map(e=>e.textContent.trim()))).filter(x=>['Before','During','After'].includes(x)).length===3&&/\d{4}/.test(await pg.textContent('.sh .foot')));await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'Fuel guides open as sheets',(await pg.$$('#view [data-act="fuelinfo"]')).length===6);await pg.tap('#view [data-act="fuelinfo"][data-i="foods"]');await W(250);ok(P+'food guide lists carbs per portion',(await pg.$$('.sh .ftab tr')).length>=10);await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.tap('#view [data-act="fuelinfo"][data-i="caffeine"]');await W(250);ok(P+'caffeine guide cites a source',/Guest et al/.test(await pg.textContent('.sh')));await pg.tap('.sh [data-act="close"]');await W(200);
 // Readiness verdict, lift color split
 await pg.tap('.tab[data-tab="today"]');await W(250);
 ok(P+'Today opens with a readiness verdict',/^(Go as planned|Take it easy today|Rest or very easy|Readiness unknown)$/.test(await pg.textContent('.ready .t')),await pg.textContent('.ready .t'));
 ok(P+'readiness reads the seeded data as recovered',(await pg.textContent('.ready .t'))==='Go as planned',await pg.textContent('.ready .s'));
 await pg.tap('.ready');await W(250);ok(P+'readiness sheet explains the inputs',(await pg.textContent('.sh-nav .ttl'))==='Readiness'&&(await pg.textContent('.sh-body')).includes('HRV, 7-day average'));await pg.tap('.sh [data-act="close"]');await W(200);
 ok(P+'lifting has its own color, blue stays for interaction',await pg.evaluate(()=>{const cs=getComputedStyle(document.documentElement);return cs.getPropertyValue('--lift').trim()!==cs.getPropertyValue('--tint').trim();}));
 await pg.evaluate(t=>{const p=__store['plan/'+t];p.soccer=true;__rt({eventType:'UPDATE',new:{coll:'plan',id:t,data:p}});},tday);await W(300);
 ok(P+'soccer day offers a one-tap Played check',!!(await pg.$('[data-act="soccertick"]')));
 await pg.tap('[data-act="soccertick"]');await W(300);ok(P+'Played marks soccer done for the day',await pg.evaluate(t=>!!(__store['daily/'+t]&&__store['daily/'+t].soccer),tday)&&!!(await pg.$('.tli.done [data-act="soccertick"]')));
 await pg.tap('[data-act="soccertick"]');await W(300);ok(P+'tapping the check undoes soccer',await pg.evaluate(t=>!__store['daily/'+t].soccer,tday));
 await pg.evaluate(t=>{const p=__store['plan/'+t];p.soccer=false;__rt({eventType:'UPDATE',new:{coll:'plan',id:t,data:p}});},tday);await W(300);
 ok(P+'lift button text is dark on the lift color',await pg.evaluate(()=>{const b=document.createElement('button');b.className='go lift';document.body.appendChild(b);const c=getComputedStyle(b).color;b.remove();return c==='rgb(0, 0, 0)';}));
 // Program view, Coach conversation
 await pg.tap('.tab[data-tab="plan"]');await W(200);await pg.tap('[data-pseg="program"]');await W(300);
 ok(P+'Program shows both phases',(await pg.textContent('#view')).includes('Phase 1')&&(await pg.textContent('#view')).includes('Phase 2'));
 ok(P+'program weeks listed with planned miles',(await pg.$$('[data-act="pweek"]')).length>=20&&/\/ \d+ mi|\d+ mi/.test(await pg.textContent('[data-act="pweek"] >> nth=0')));
 ok(P+'program rows stay on one line',await pg.$$eval('[data-act="pweek"] .t, [data-act="pweek"] .s',x=>x.length>0&&x.every(e=>e.scrollHeight<=e.clientHeight+4)));
 await pg.tap('[data-act="pweek"] >> nth=0');await W(250);ok(P+'tapping a week opens its days',(await pg.textContent('.sh-nav .ttl')).startsWith('Week of'));await pg.tap('.sh [data-act="close"]');await W(200);
 await pg.evaluate(()=>{delete __store['settings/program'];__rt({eventType:'DELETE',old:{coll:'settings',id:'program'}});});await W(300);
 ok(P+'without a program the view says when it arrives',(await pg.textContent('#view')).includes('9 AM review')&&(await pg.$$('[data-act="pweek"]')).length>=4);
 await pg.tap('.tab[data-tab="you"]');await W(250);await pg.tap('[data-act="thread"]');await W(300);
 ok(P+'Coach opens one running conversation',(await pg.textContent('.sh-nav .ttl'))==='Coach'&&(await pg.$$('.sh .msg.me')).length>=1&&(await pg.textContent('.sh .msg.coach .bub')).includes('Day A now has barbell bench')&&!!(await pg.$('.sh #reqText'))&&!!(await pg.$('.sh [data-act="threadsend"]')));
 ok(P+'messages run oldest to newest with the compose box last',await pg.evaluate(()=>{const m=[...document.querySelectorAll('.sh .msg.me .meta')].map(e=>e.textContent);const c=document.querySelector('.sh .compose');return m.length>=1&&!!c&&!!(c.compareDocumentPosition(document.querySelector('.sh .msgs'))&Node.DOCUMENT_POSITION_PRECEDING);}));
 await pg.tap('.sh [data-act="req"]:has-text("Equipment: full gym")');await W(250);
 ok(P+'request detail leads with the coach reply',(await pg.textContent('.sh .cap >> nth=0')).startsWith('Coach')&&((await pg.textContent('.sh .group.reply'))||'').includes('Day A now has barbell bench'),JSON.stringify([await pg.textContent('.sh-nav .ttl'),(await pg.textContent('.sh .cap >> nth=0')).slice(0,40),((await pg.textContent('.sh-body'))||'').slice(0,160)]));
 await pg.tap('.sh [data-act="close"]');await W(200);await pg.tap('.sec-h [data-act="newreq"]');await W(250);
 ok(P+'request templates offered',(await pg.$$('[data-act="reqtpl"]')).length>=4);
 await pg.tap('[data-act="reqtpl"] >> nth=0');await W(150);ok(P+'template fills the request box',(await pg.inputValue('#reqText')).startsWith('Swap ['));
 await pg.tap('.sh [data-act="close"]');await W(200);await pg.tap('[data-act="updates"]');await W(250);
 ok(P+'Coach Log groups updates by day',(await pg.textContent('.sh-nav .ttl'))==='Coach log'&&(await pg.$$('.sh .cap')).length>=2&&(await pg.$$('.sh [data-act="upd"]')).length>=3);
 await pg.tap('.sh [data-act="close"]');await W(200);
 // native polish pass: in-flow check-in, collapsing nav, two-state tab glyphs, one radius, folded citations, full-width titles
 await pg.tap('.tab[data-tab="today"]');await W(250);
 ok(P+'check-in button sits in the page, not floating',await pg.$eval('.ckin',e=>getComputedStyle(e).position!=='fixed'));
 ok(P+'Today has no coach-log row',!(await pg.$('#view [data-act="updates"]')));
 ok(P+'PT lives in its own Recovery section under the training timeline',!!(await pg.$('.tl.rec'))&&(await pg.$$('.tl.rec [data-act="ptslot"], .tl.rec [data-act="workout"][data-day="P"]')).length>=1&&!(await pg.$('.tl:not(.rec) [data-act="ptslot"]'))&&(await pg.textContent('#view')).includes('Recovery'));
 ok(P+'week arrows live in the week card',(await pg.$$('.wkc .wkb[aria-label="Previous week"], .wkc .wkb[aria-label="Next week"]')).length===2);
 ok(P+'active tab shows its filled glyph',await pg.evaluate(()=>{const on=document.querySelector('.tab[aria-current="page"] svg .f'),off=document.querySelector('.tab:not([aria-current="page"]) svg .f');return !!on&&getComputedStyle(on).display!=='none'&&!!off&&getComputedStyle(off).display==='none';}));
 ok(P+'cards share one radius',await pg.$$eval('.group, .tlc, .bars, .wkc',x=>x.length>3&&x.every(e=>getComputedStyle(e).borderRadius==='14px')));
 await pg.tap('.tab[data-tab="health"]');await W(300);
 ok(P+'nav bar is clear at the top and collapses on scroll',!(await pg.$('#nav.scrolled'))&&await pg.evaluate(async()=>{window.scrollTo(0,300);await new Promise(r=>setTimeout(r,250));return document.getElementById('nav').classList.contains('scrolled');}));
 await pg.evaluate(()=>window.scrollTo(0,0));await W(200);
 ok(P+'health citations sit behind one row, not on the page',!!(await pg.$('[data-act="healthwhy"]'))&&!(await pg.$('#view .why')));
 await pg.tap('.tab[data-tab="you"]');await W(250);
 ok(P+'milestone titles are not cut short',await pg.$$eval('#view .ms-row .t',x=>x.length>=3&&x.every(e=>e.scrollWidth<=e.clientWidth+1)));
 for(const t of ['today','plan','health','fuel','you']){await pg.tap(`.tab[data-tab="${t}"]`);await W(150);if(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))ok(P+t+' no sideways scroll',false);}
 ok(P+'no sideways scroll on any tab',true);
 ok(P+'no script errors',errs.length===0,errs.join('|'));await ctx.close();}
ok('no em dashes',!html.includes('\u2014'));
console.log(R.join('\n'));await b.close();})();
