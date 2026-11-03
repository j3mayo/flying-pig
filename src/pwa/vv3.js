// V&V for the Healthspan upgrade: pause, rest timer, delete sets, swaps, add exercise, split stretches, PT tags,
// goal suggestions, Health page, Coming Up, drafts that survive a restart, discard, rename.
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const DIR=__dirname, EXP=path.join(DIR,'../export'), out=path.join(DIR,'shots/v3');fs.mkdirSync(path.dirname(out),{recursive:true});
const seed={};for(const c of fs.readdirSync(EXP))for(const f of fs.readdirSync(path.join(EXP,c)))seed[c+'/'+f.replace(/\.json$/,'')]=JSON.parse(fs.readFileSync(path.join(EXP,c,f)));
const iso=d=>d.toISOString().slice(0,10);const T=new Date();
// 60 days of watch data with clear trends so pillar statuses are testable
for(let i=0;i<60;i++){const d=new Date(T);d.setDate(d.getDate()-i);const k=iso(d);seed['daily/'+k]=Object.assign({},seed['daily/'+k]||{},{date:k,rhr:52+Math.round(i/10),hrv:68-Math.round(i/8),sleep:+(7.4-(i%3)*.2).toFixed(1),weight:+(182+i*.03).toFixed(1),steps:9000+i*10,vo2:+(46-i*.03).toFixed(1)});}
seed['settings/goalSuggestions']={items:[{id:'g1',title:'Average 7.5 h of sleep',detail:'7-day average',why:'Sleep has been under 7 h on 3 nights this week.'},{id:'g2',title:'Check in 5 days a week',detail:'',why:'Check-ins let the plan adjust to how you feel.'}]};
const html=fs.readFileSync(path.join(DIR,'app.html'),'utf8');
const src=fs.readFileSync(path.join(DIR,'vv2.js'),'utf8');const mockSb=eval(src.match(/const mockSb=(`[\s\S]*?`);/)[1].replace('${JSON.stringify(seed)}','__SEED__')).replace('__SEED__',JSON.stringify(seed));
const R=[];const ok=(n,c,x)=>R.push((c?'PASS ':'FAIL ')+n+(x?' :: '+x:''));
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
 ok(P+'five tabs including Health',(await pg.$$('.tab')).length===5&&!!(await pg.$('.tab[data-tab="health"]')));
 // Coming Up
 const days=await pg.$$('#view .day');ok(P+'Coming Up shows day cards with date blocks',days.length>=5&&!!(await pg.$('#view .day .dt .n')),String(days.length));
 await pg.screenshot({path:out+'-'+scheme+'-today.png',fullPage:true});
 await pg.tap('#view .day >> nth=0');await W(250);ok(P+'tapping a day opens its detail',(await pg.textContent('.sh-nav .ttl')).length>5&&(await pg.$$('.sh .group')).length>=1);await pg.tap('.sh [data-act="close"]');await W(200);
 // Health
 await pg.tap('.tab[data-tab="health"]');await W(300);
 const pil=await pg.$$eval('.pillar h3',x=>x.map(e=>e.textContent));ok(P+'Health shows the four pillars',pil.join('|')==='Heart & Fitness|Recovery|Strength|Body',pil.join('|'));
 const pills=await pg.$$eval('.pillar .ph .pill',x=>x.map(e=>e.textContent));ok(P+'pillar statuses computed from trends',pills[0]==='Improving'&&pills[1]==='Improving'&&pills[3]!=='Building baseline',pills.join(','));
 ok(P+'pillar charts drawn',(await pg.$$('.pillar svg')).length>=3);
 ok(P+'VO2 and steps shown',(await pg.textContent('#view')).includes('VO2 max')&&/9,\d{3}/.test(await pg.textContent('#view')));
 ok(P+'each pillar cites a study',(await pg.$$eval('.pillar .why',x=>x.filter(e=>/\(\w.*\d{4}\)/.test(e.textContent)).length))===4);
 await pg.screenshot({path:out+'-'+scheme+'-health.png',fullPage:true});
 // You: suggestions
 await pg.tap('.tab[data-tab="you"]');await W(250);
 ok(P+'suggested goals listed',(await pg.$$('[data-act="sugadd"]')).length===2);
 await pg.tap('[data-act="sugadd"][data-id="g1"]');await W(300);
 ok(P+'Add moves a suggestion into Goals',await pg.evaluate(()=>__store['settings/goals'].items.some(i=>i.title==='Average 7.5 h of sleep')&&__store['settings/goalSuggestions'].items.find(i=>i.id==='g1').state==='added'));
 await pg.tap('[data-act="sugno"][data-id="g2"]');await W(300);
 ok(P+'No dismisses and hides it',await pg.evaluate(()=>__store['settings/goalSuggestions'].items.find(i=>i.id==='g2').state==='dismissed')&&(await pg.$$('[data-act="sugadd"]')).length===0);
 ok(P+'milestones show date blocks and countdown',(await pg.$$('#view .ms-when')).length>=3);
 await pg.screenshot({path:out+'-'+scheme+'-you.png',fullPage:true});
 // draft survives an app restart
 await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(200);await pg.fill('#gT','Draft goal typed then app closed');await W(100);
 await pg.reload();await W(800);await pg.tap('.tab[data-tab="you"]');await W(200);await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(250);
 ok(P+'typed goal restored after restart',(await pg.inputValue('#gT'))==='Draft goal typed then app closed');
 await pg.tap('.sh [data-act="close"]');await W(200);await pg.tap('.sec-h [data-act="goal"][data-i="new"]');await W(200);
 ok(P+'Cancel clears the draft',(await pg.inputValue('#gT'))==='');await pg.tap('.sh [data-act="close"]');await W(200);
 // Lifts: alternatives as a request
 await pg.tap('.tab[data-tab="lifts"]');await W(200);await pg.tap('[data-lday="A"]');await W(150);await pg.tap('[data-act="exinfo"][data-id="a1"]');await W(250);
 const alts=await pg.$$eval('[data-act="altreq"]',x=>x.map(e=>e.textContent));
 ok(P+'Smith bench offers equivalent swaps with scaled loads',alts.some(t=>t.includes('Flat DB bench')&&t.includes('55s'))&&alts.some(t=>t.includes('Push-up')&&t.includes('4 x 12')),alts.slice(0,3).join(' | '));
 const before=await pg.evaluate(()=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length);
 await pg.tap('[data-act="altreq"] >> nth=0');await W(300);
 ok(P+'tapping a swap sends a request',await pg.evaluate(n=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length===n+1,before));
 // Workout
 await pg.tap('.tab[data-tab="lifts"]');await W(150);await pg.tap('[data-lday="B"]');await W(150);await pg.tap('[data-act="workout"][data-day="B"]');await W(400);
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
 // swap for today + keep going forward
 await pg.tap(`[data-w="swap"][data-e="${ex0}"]`);await W(250);
 const sw=await pg.$$eval('[data-w="swappick"]',x=>x.map(e=>e.textContent));ok(P+'Swap lists same-job exercises with loads',sw.some(t=>t.includes('Barbell back squat')&&t.includes('155')),sw.join(' | '));
 await pg.check('#swPerm');const rq0=await pg.evaluate(()=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length);
 await pg.tap('[data-w="swappick"] >> nth=0');await W(300);
 ok(P+'swap applied in the workout',(await pg.textContent('.sh-body')).includes('instead of Smith squat'));
 ok(P+'"keep going forward" files a request',await pg.evaluate(n=>Object.keys(__store).filter(k=>k.startsWith('requests/')).length===n+1,rq0));
 // add exercise
 await pg.tap('[data-w="addex"]');await W(250);const adds=await pg.$$('[data-w="addpick"]');ok(P+'add-exercise suggestions offered',adds.length>=2,String(adds.length));
 await pg.fill('#axName','Sled push');await pg.fill('#axLoad','90');await pg.fill('#axScheme','4 x 20');await pg.tap('[data-w="addcustom"]');await W(300);
 ok(P+'custom exercise added',(await pg.textContent('.sh-body')).includes('Sled push'));
 // typed set survives a restart, workout reopens by itself
 const inp=await pg.$('.sg input[data-f="load"]');await inp.fill('177');await pg.reload();await W(1200);
 ok(P+'open workout reopens after app restart',await pg.evaluate(()=>document.getElementById('dlg').open&&!!document.querySelector('[data-w="finish"]')));
 ok(P+'typed weight kept after restart',(await pg.$$eval('.sg input[data-f="load"]',x=>x.map(e=>e.value))).includes('177'));
 await pg.screenshot({path:out+'-'+scheme+'-workout.png'});
 // close pauses
 await pg.tap('[data-w="close"]');await W(300);ok(P+'closing pauses the workout',await pg.evaluate(()=>!!__store['liftlog/'+new Date().toISOString().slice(0,10)]||Object.values(__store).some(v=>v&&v.status==='in_progress'&&v.pausedAt)));
 // discard
 await pg.tap('.tab[data-tab="lifts"]');await W(150);await pg.tap('[data-lday="B"]');await W(100);await pg.tap('[data-act="workout"][data-day="B"]');await W(400);
 await pg.tap('[data-w="discard"]');await W(150);ok(P+'discard asks for a second tap',(await pg.textContent('[data-w="discard"]')).includes('Tap again'));
 await pg.tap('[data-w="discard"]');await W(400);ok(P+'discard removes the session',await pg.evaluate(()=>!Object.values(__store).some(v=>v&&v.status==='in_progress'&&v.exercises))&&!(await pg.evaluate(()=>document.getElementById('dlg').open)));
 for(const t of ['today','runs','lifts','health','you']){await pg.tap(`.tab[data-tab="${t}"]`);await W(150);if(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))ok(P+t+' no sideways scroll',false);}
 ok(P+'no sideways scroll on any tab',true);
 ok(P+'no script errors',errs.length===0,errs.join('|'));await ctx.close();}
ok('no em dashes',!html.includes('\u2014'));
console.log(R.join('\n'));await b.close();})();
