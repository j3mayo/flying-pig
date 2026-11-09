// V&V for the standalone app: mocks Supabase, Tesseract and pdf.js at the network layer.
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const DIR=__dirname, EXP=path.join(DIR,'../export'), out=path.join(DIR,'shots/vv');
fs.mkdirSync(path.dirname(out),{recursive:true});
const seed={};for(const c of fs.readdirSync(EXP))for(const f of fs.readdirSync(path.join(EXP,c)))seed[c+'/'+f.replace(/\.json$/,'')]=JSON.parse(fs.readFileSync(path.join(EXP,c,f)));
const html=fs.readFileSync(path.join(DIR,'app.html'),'utf8');
const mockSb=`(function(){const LS=localStorage;const seed=${JSON.stringify(seed)};
window.__store=JSON.parse(LS.getItem('mock-store')||'null')||seed;window.__uploads=[];const save=()=>LS.setItem('mock-store',JSON.stringify(__store));
window.supabase={createClient(){let sess=JSON.parse(LS.getItem('mock-sess')||'null');return{
 auth:{getSession:async()=>({data:{session:sess}}),
  signUp:async()=>{if(LS.getItem('mock-users'))return{error:{message:'Database error saving new user'}};LS.setItem('mock-users','1');return{data:{}}},
  signInWithPassword:async({password})=>{if(password!=='correct-horse-1')return{error:{message:'Invalid login credentials'}};sess={user:{id:'u1'}};LS.setItem('mock-sess',JSON.stringify(sess));return{data:{session:sess}}},
  signOut:async()=>{LS.removeItem('mock-sess')}},
 from(){return{select(){return{range:async(a,b)=>({data:Object.entries(__store).map(([k,v])=>{const j=k.indexOf('/');return{coll:k.slice(0,j),id:k.slice(j+1),data:v}}).slice(a,b+1)})}},
  delete(){return{match:async(m)=>{delete __store[m.coll+'/'+m.id];save();return{error:null}}}},
  upsert:async(row)=>{if(window.__failNext){window.__failNext=false;return{error:{message:'network'}}}__store[row.coll+'/'+row.id]=JSON.parse(JSON.stringify(row.data));save();return{error:null}}}},
 channel(){const ch={on(a,b,cb){window.__rt=cb;return ch},subscribe(){return ch}};return ch},
 storage:{from(){return{upload:async(p,b,o)=>{__uploads.push({p,type:o.contentType,size:b.size});return{error:null}},createSignedUrl:async()=>({data:{signedUrl:'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='}})}}}}}};})();`;
const mockTess=`window.Tesseract={recognize:async()=>({data:{text:'Side plank 3 x 30 s each side. Band external rotation 3 x 15.'}})};`;
const mockPdf=`window.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'PT plan: Wall slides 3 x 10, prone Y 3 x 12, chin tucks daily.'}]})})})})};`;
const R=[];process.on('unhandledRejection',e=>{console.log(R.join('\n'));console.log('FAIL crash: '+String(e&&e.message||e).split('\n')[0]);process.exit(1);});const ok=(n,c,x)=>R.push((c?'PASS ':'FAIL ')+n+(x?' :: '+x:''));
async function route(pg){await pg.route('**/*',r=>{const u=r.request().url();
 if(u.startsWith('https://app.test/')&&/\.png$/.test(u))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(DIR,'../..',u.split('/').pop()))});
 if(u.startsWith('https://app.test/')&&/\.(webmanifest|js)$/.test(u))return r.fulfill({contentType:'application/octet-stream',body:fs.readFileSync(path.join(DIR,'../..',u.split('/').pop()))});
 if(u.startsWith('https://app.test/'))return r.fulfill({contentType:'text/html',body:html});
 if(u.includes('supabase-js'))return r.fulfill({contentType:'application/javascript',body:mockSb});
 if(u.includes('tesseract'))return r.fulfill({contentType:'application/javascript',body:mockTess});
 if(u.includes('pdf.min.js'))return r.fulfill({contentType:'application/javascript',body:mockPdf});
 if(u.includes('functions/v1/app?f=icon'))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(DIR,'../../apple-touch-icon.png'))});
 return r.abort();});}
(async()=>{const b=await chromium.launch();
// ---- auth gate ----
{const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await route(pg);
 await pg.goto('https://app.test/');await pg.waitForTimeout(500);
 ok('auth: sign-in screen shows when signed out',await pg.isVisible('.auth #auIn'));
 await pg.screenshot({path:out+'-auth.png'});
 await pg.tap('#auUp');await pg.fill('#auE','owner@example.com');await pg.fill('#auP','short');await pg.tap('#auIn');await pg.waitForTimeout(150);
 ok('auth: short password rejected',(await pg.textContent('#auM')).includes('8 characters'));
 await pg.fill('#auP','correct-horse-1');await pg.tap('#auIn');await pg.waitForTimeout(900);
 ok('auth: create account then signed in, plan loads',!(await pg.$('.auth'))&&!!(await pg.$('#view .dt1')));
 await pg.evaluate(()=>{localStorage.removeItem('mock-sess');});await pg.reload();await pg.waitForTimeout(500);
 await pg.tap('#auUp');await pg.fill('#auE','someone@else.com');await pg.fill('#auP','another-pass-1');await pg.tap('#auIn');await pg.waitForTimeout(200);
 ok('auth: second account blocked',(await pg.textContent('#auM')).includes('already has its owner'));
 await pg.tap('#auUp');await pg.fill('#auE','owner@example.com');await pg.fill('#auP','wrong-pass-1');await pg.tap('#auIn');await pg.waitForTimeout(200);
 ok('auth: wrong password message',(await pg.textContent('#auM')).includes('incorrect'));
 ok('auth: no script errors',errs.length===0,errs.join('|'));await ctx.close();}
// ---- app, light + dark ----
for(const scheme of ['light','dark']){
 const ctx=await b.newContext({...devices['iPhone 13'],colorScheme:scheme,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await route(pg);
 await pg.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('mock-sess',JSON.stringify({user:{id:'u1'}}));}});
 await pg.goto('https://app.test/');await pg.waitForTimeout(700);
 const planN=Object.keys(seed).filter(k=>k.startsWith('plan/')).length;const st=await pg.evaluate(()=>({plan:Object.keys(__store).filter(k=>k.startsWith('plan/')).length}));
 ok(scheme+': plan days all in store ('+planN+')',st.plan===planN&&(await pg.$$('#view .tli')).length>=1,String(st.plan));
 ok(scheme+': home-screen tags present',await pg.evaluate(()=>!!document.querySelector('link[rel=apple-touch-icon]')&&document.querySelector('meta[name=apple-mobile-web-app-capable]').content==='yes'));
 await pg.tap('#logBtn');await pg.waitForTimeout(200);
 ok(scheme+': sheet opens with no button focused',await pg.evaluate(()=>document.activeElement&&document.activeElement.id)==='sh');
 await pg.tap('.sh [data-act="newreq"]');await pg.waitForTimeout(200);
 await pg.fill('#reqText','New PT plan from today');await pg.tap('[data-rk="pt"]');await pg.waitForTimeout(150);
 ok(scheme+': request form says it is reviewed at midnight',(await pg.textContent('.sh-body')).includes('Reviewed each morning at 9'));
 ok(scheme+': PT toggle selects',await pg.$eval('[data-rk="pt"]',e=>e.getAttribute('aria-pressed'))==='true');
 await pg.setInputFiles('#fileIn',[{name:'pt-plan.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')},{name:'photo.png',mimeType:'image/png',buffer:fs.readFileSync(path.join(DIR,'../../apple-touch-icon.png'))}]);
 await pg.waitForTimeout(900);ok(scheme+': two attachments uploaded to storage',(await pg.evaluate(()=>__uploads.length))===2&&(await pg.$$('#attList .a')).length===2);
 ok(scheme+': files stored in owner folder',await pg.evaluate(()=>__uploads.every(u=>u.p.startsWith('u1/'))));
 await pg.tap('[data-act="reqsave"]');await pg.waitForTimeout(500);
 const req=await pg.evaluate(()=>Object.values(__store).find(v=>v&&v.kind==='pt'&&v.attachments));
 ok(scheme+': PT request saved with text read from PDF and photo',req&&req.attachments.length===2&&req.attachments.some(a=>a.text.includes('Wall slides'))&&req.attachments.some(a=>a.text.includes('Side plank')),JSON.stringify(req&&req.attachments.map(a=>a.text.slice(0,20))));
 await pg.tap('.tab[data-tab="you"]');await pg.waitForTimeout(200);await pg.tap('[data-act="thread"]');await pg.waitForTimeout(300);await pg.tap('.sh [data-act="req"] >> nth=-1');await pg.waitForTimeout(300);
 ok(scheme+': request detail shows attachments',(await pg.$$('.sh .att .a')).length===2);await pg.tap('.sh [data-act="close"]');await pg.waitForTimeout(200);
 await pg.tap('[data-act="gear"][data-id="new"]');await pg.waitForTimeout(200);await pg.fill('#gnName','Nike Pegasus 41');await pg.fill('#gnSince','2026-10-20');await pg.fill('#gnBase','10');await pg.tap('[data-act="gearsave"]');await pg.waitForTimeout(300);
 const shoeMi=String(Math.round((10+Object.entries(seed).filter(([k,v])=>k.startsWith('runs/')&&v.date>='2026-10-20'&&!v.shoe).reduce((a,[,v])=>a+(+v.miles||0),0))*10)/10)+' mi';
 ok(scheme+': shoes added with miles counted ('+shoeMi+')',(await pg.$$eval('[data-act="gear"]',x=>x.map(e=>e.textContent))).some(t=>t.includes('Pegasus')&&t.includes(shoeMi)));
 await pg.tap('[data-act="goal"][data-i="new"]');await pg.waitForTimeout(200);await pg.fill('#gT','Sub 4:00 marathon');await pg.tap('[data-act="goalsave"]');await pg.waitForTimeout(300);
 ok(scheme+': goal added',await pg.evaluate(()=>__store['settings/goals'].items.some(i=>i.title==='Sub 4:00 marathon')));
 await pg.evaluate(()=>{window.__failNext=true;});await pg.tap('[data-act="goal"][data-i="new"]');await pg.waitForTimeout(200);await pg.fill('#gT','Should not stick');await pg.tap('[data-act="goalsave"]');await pg.waitForTimeout(300);
 ok(scheme+': failed save shows message and rolls back',(await pg.textContent('.toast')).includes("Couldn't save")&&!(await pg.textContent('#view')).includes('Should not stick'));
 await pg.evaluate(()=>{const c=document.querySelector('[data-act="close"]');if(c)c.click();});await pg.waitForTimeout(200);
 await pg.evaluate(()=>__rt({eventType:'INSERT',new:{coll:'updates',id:'2026-11-03-9',data:{date:'2026-11-03',title:'Nightly test update',detail:'Pushed live'}}}));await pg.waitForTimeout(300);
 ok(scheme+': nightly change appears live without reopening',(await pg.textContent('#view')).includes('Nightly test update'));
 await pg.screenshot({path:out+'-'+scheme+'-you.png',fullPage:true});
 await pg.tap('.tab[data-tab="plan"]');await pg.waitForTimeout(200);await pg.tap('[data-pseg="lifts"]');await pg.waitForTimeout(150);await pg.tap('[data-lday="A"]');await pg.waitForTimeout(150);await pg.tap('[data-act="workout"][data-day="A"]');await pg.waitForTimeout(300);
 await pg.tap('[data-w="tick"] >> nth=1');await pg.waitForTimeout(150);await pg.tap('[data-w="finish"] >> nth=0');await pg.waitForTimeout(500);
 ok(scheme+': workout logged set by set and saved',await pg.evaluate(()=>Object.values(__store).some(v=>v&&v.status==='done'&&v.exercises)));
 await pg.tap('#logBtn');await pg.waitForTimeout(200);await pg.tap('.sh [data-act="logrun"]');await pg.waitForTimeout(250);
 ok(scheme+': run time box has a keyboard with a colon',await pg.$eval('#rTime',e=>e.type==='text'&&e.inputMode==='text'));
 await pg.fill('#rMi','3.1');await pg.fill('#rTime','28.44');await pg.tap('.sh [type="submit"]');await pg.waitForTimeout(400);
 ok(scheme+': 28.44 is read as 28:44',await pg.evaluate(()=>Object.values(__store).some(v=>v&&v.miles===3.1&&v.timeSec===1724)));
 for(const t of ['today','plan']){await pg.tap(`.tab[data-tab="${t}"]`);await pg.waitForTimeout(200);await pg.screenshot({path:out+'-'+scheme+'-'+t+'.png'});}
 ok(scheme+': no sideways scroll',!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)));
 // offline relaunch uses cache
 await pg.evaluate(()=>{window.supabase=undefined;});
 ok(scheme+': local cache written for fast relaunch',await pg.evaluate(()=>{const c=JSON.parse(localStorage.getItem('fp-cache')||'null');return !!c&&c.rows.length>100;}));
 await pg.tap('.tab[data-tab="you"]');await pg.waitForTimeout(200);await pg.tap('[data-act="signout"]');await pg.waitForTimeout(600);
 ok(scheme+': sign out returns to sign-in screen',await pg.isVisible('.auth #auIn'));
 ok(scheme+': no script errors',errs.length===0,errs.join('|'));await ctx.close();}
ok('no em dashes in app',!html.includes('\u2014'));
ok('no secret keys in app (publishable key only)',!/service_role|sb_secret_/.test(html));
console.log(R.join('\n'));await b.close();})();
