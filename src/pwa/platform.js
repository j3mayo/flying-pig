/* Platform layer: Supabase-backed db/assets with the same API the UI uses, sign-in gate, attachment text extraction. */
window.FP = (function(){
const SB_URL = "https://jpfvrrdxulcawectrozo.supabase.co";
const SB_KEY = "sb_publishable_fcvSMeCg8C95dkbSqm7Xrg_3YyC9dzK";
const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true, autoRefreshToken:true, storageKey:"fp-auth"}}) : null;
const clone = v => v===undefined ? undefined : JSON.parse(JSON.stringify(v));
const ls = { get(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(_){} } };

function makeDb(uid){
  const cache = new Map(), subs = [];
  let fromCache = true, started = false;
  try{ const c = JSON.parse(ls.get("fp-cache")||"null"); if(c && c.uid===uid) c.rows.forEach(([k,v])=>cache.set(k,v)); }catch(_){}
  const key = (c,i)=>c+"/"+i;
  function snapColl(coll){ const docs=[]; for(const [k,v] of cache){ const j=k.indexOf("/"); if(k.slice(0,j)===coll) docs.push({id:k.slice(j+1), data:()=>clone(v)}); } return {docs, metadata:{fromCache}}; }
  function snapDoc(coll,id){ const v=cache.get(key(coll,id)); return {id, exists:v!==undefined, data:()=>clone(v), metadata:{fromCache}}; }
  function fire(s){ try{ s.cb(s.id ? snapDoc(s.coll,s.id) : snapColl(s.coll)); }catch(e){ console.error(e); } }
  function emit(coll){ subs.forEach(s=>{ if(s.coll===coll) fire(s); }); }
  let pt; function persist(){ clearTimeout(pt); pt=setTimeout(()=>ls.set("fp-cache", JSON.stringify({uid, rows:[...cache]})), 400); }
  async function load(){
    let all=[], from=0;
    for(;;){ const {data,error} = await sb.from("docs").select("coll,id,data").range(from, from+999); if(error) throw error; all=all.concat(data); if(data.length<1000) break; from+=1000; }
    cache.clear(); all.forEach(r=>cache.set(key(r.coll,r.id), r.data)); fromCache=false; persist();
    subs.forEach(fire);
  }
  function listen(){
    sb.channel("docs-live").on("postgres_changes", {event:"*", schema:"public", table:"docs"}, p=>{
      if(p.eventType==="DELETE"){ const o=p.old||{}; if(o.coll){ cache.delete(key(o.coll,o.id)); emit(o.coll); } }
      else { const n=p.new; cache.set(key(n.coll,n.id), n.data); emit(n.coll); }
      persist();
    }).subscribe();
  }
  async function start(){
    if(started) return; started=true;
    try{ await load(); }catch(e){ subs.forEach(s=>s.err&&s.err(e)); }
    listen();
    document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") load().catch(()=>{}); });
  }
  async function write(coll, id, data){
    const k=key(coll,id), prev=cache.get(k);
    cache.set(k, clone(data)); emit(coll); persist();
    const {error} = await sb.from("docs").upsert({coll, id, data}, {onConflict:"coll,id"});
    if(error){ if(prev===undefined) cache.delete(k); else cache.set(k, prev); emit(coll); persist(); throw error; }
  }
  function ref(coll, id){ return {
    id,
    set: d => write(coll, id, d),
    update: d => write(coll, id, Object.assign({}, cache.get(key(coll,id))||{}, d)),
    get: async () => snapDoc(coll, id),
    delete: async () => { const k=key(coll,id), prev=cache.get(k); cache.delete(k); emit(coll); persist();
      const {error} = await sb.from("docs").delete().match({coll, id}); if(error){ if(prev!==undefined){ cache.set(k,prev); emit(coll); persist(); } throw error; } },
    onSnapshot(cb, err){ const s={coll, id, cb, err}; subs.push(s); if(cache.size) fire(s); return ()=>subs.splice(subs.indexOf(s),1); }
  }; }
  return {
    collection: coll => ({ doc: id => ref(coll, id), onSnapshot(cb, err){ const s={coll, cb, err}; subs.push(s); if(cache.size) fire(s); return ()=>subs.splice(subs.indexOf(s),1); } }),
    doc: path => { const [c,i] = path.split("/"); return ref(c, i); },
    start
  };
}

function makeAssets(uid){ return {
  async upload(blob, opt){
    if(blob.size > 20*1024*1024) throw {code:"too_large"};
    const type = (opt&&opt.type) || blob.type, ext = type==="application/pdf" ? "pdf" : "jpg";
    const path = uid+"/"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
    const {error} = await sb.storage.from("attachments").upload(path, blob, {contentType:type, upsert:false});
    if(error) throw error;
    return {id:path};
  }
}; }

/* Signed URLs for private attachments. Returns a placeholder until ready, then asks the UI to redraw. */
const urls = {}, pending = {}; let onUrl = null;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
function blobSrc(id){
  if(!id) return BLANK;
  if(urls[id]) return urls[id];
  if(!pending[id] && sb){ pending[id]=true; sb.storage.from("attachments").createSignedUrl(id, 60*60*24).then(({data})=>{ if(data&&data.signedUrl){ urls[id]=data.signedUrl; onUrl&&onUrl(); } }).finally(()=>{ pending[id]=false; }); }
  return BLANK;
}

/* Text extraction so the nightly review can read PT plans. Runs on the phone. */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
async function ocr(img){
  if(!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
  /* Clean up phone photos first: grayscale, stronger contrast, about 2000 px wide. Much better results on handouts. */
  try{ const bmp = img instanceof HTMLCanvasElement ? img : await createImageBitmap(img); const sc=Math.min(2.5, 2000/Math.max(bmp.width,1));
    const c=document.createElement("canvas"); c.width=Math.round(bmp.width*sc); c.height=Math.round(bmp.height*sc); const x=c.getContext("2d");
    x.filter="grayscale(1) contrast(1.8) brightness(1.08)"; x.drawImage(bmp,0,0,c.width,c.height); img=c; }catch(_){}
  const r = await window.Tesseract.recognize(img, "eng");
  return (r && r.data && r.data.text || "").trim();
}
async function pdfText(file){
  if(!window.pdfjsLib){ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }
  const doc = await window.pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  let out = [];
  for(let p=1; p<=Math.min(doc.numPages, 20); p++){ const pg=await doc.getPage(p); const tc=await pg.getTextContent(); out.push(tc.items.map(i=>i.str).join(" ")); }
  let text = out.join("\n").trim();
  if(text.length < 40){ /* scanned PDF: OCR the first pages */
    out = [];
    for(let p=1; p<=Math.min(doc.numPages, 4); p++){ const pg=await doc.getPage(p); const vp=pg.getViewport({scale:2}); const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height; await pg.render({canvasContext:c.getContext("2d"), viewport:vp}).promise; out.push(await ocr(c)); }
    text = out.join("\n").trim();
  }
  return text;
}
async function extractText(blob, isPdf){ try{ const t = isPdf ? await pdfText(blob) : await ocr(blob); return t.slice(0, 20000); }catch(e){ console.warn(e); return ""; } }

/* Sign-in gate */
async function session(){ if(!sb) return null; const {data} = await sb.auth.getSession(); return data && data.session; }
function showAuth(done){
  const el = document.createElement("div"); el.className="auth";
  el.innerHTML = `<div class="auth-in"><img class="auth-ic" src="${window.FP_ICON||""}" alt=""><h1 class="large" style="padding:0;text-align:center">Healthspan</h1>
    <div class="sub" style="text-align:center;padding:0 0 18px">Sign in to your training plan</div>
    <div class="group"><label class="row"><input id="auE" type="email" autocomplete="username" inputmode="email" placeholder="Email" autocapitalize="off"></label><label class="row"><input id="auP" type="password" autocomplete="current-password" placeholder="Password"></label></div>
    <div class="auth-msg" id="auM" role="status"></div>
    <button class="btn-big" type="button" id="auIn">Sign In</button>
    <button class="lnk auth-alt" type="button" id="auUp">First time here? Create your account</button></div>`;
  document.body.appendChild(el);
  const msg = t => { el.querySelector("#auM").textContent = t; };
  const vals = () => [el.querySelector("#auE").value.trim(), el.querySelector("#auP").value];
  let mode = "in";
  el.querySelector("#auUp").onclick = () => { mode = mode==="in" ? "up" : "in"; el.querySelector("#auIn").textContent = mode==="in" ? "Sign In" : "Create Account"; el.querySelector("#auUp").textContent = mode==="in" ? "First time here? Create your account" : "Have an account? Sign in"; el.querySelector("#auP").autocomplete = mode==="in" ? "current-password" : "new-password"; msg(""); };
  el.querySelector("#auIn").onclick = async () => {
    const [email, password] = vals();
    if(!email || !password){ msg("Enter your email and password"); return; }
    if(mode==="up" && password.length < 8){ msg("Use at least 8 characters"); return; }
    msg(mode==="in" ? "Signing in…" : "Creating your account…");
    if(mode==="up"){ const {error} = await sb.auth.signUp({email, password}); if(error){ msg(/closed|Database error/i.test(error.message) ? "This app already has its owner. Sign in instead." : error.message); return; } }
    const {error} = await sb.auth.signInWithPassword({email, password});
    if(error){ msg(/Invalid login/i.test(error.message) ? "Email or password is incorrect" : error.message); return; }
    el.remove(); done();
  };
  el.querySelector("#auP").addEventListener("keydown", e=>{ if(e.key==="Enter") el.querySelector("#auIn").click(); });
}
async function signOut(){ await sb.auth.signOut(); try{ localStorage.removeItem("fp-cache"); }catch(_){} location.reload(); }

/* Push notifications and small helpers */
async function rpc(name, args){ if(!sb || !sb.rpc) return null; const {data, error} = await sb.rpc(name, args||{}); if(error) throw error; return data; }
const standalone = () => !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const b64u8 = s => { const b = atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushState(){
  if(!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if(Notification.permission === "denied") return "denied";
  try{ const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub ? "on" : "off"; }catch(_){ return "off"; }
}
async function pushSubscribe(){
  const perm = await Notification.requestPermission(); if(perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const r = await fetch(SB_URL + "/functions/v1/push/vapid"); const j = await r.json(); if(!j.publicKey) throw new Error("no key");
  const sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64u8(j.publicKey)});
  const s = await session(); if(!s) throw new Error("signed out");
  const res = await fetch(SB_URL + "/functions/v1/push/subscribe", {method:"POST", headers:{"Content-Type":"application/json", "Authorization":"Bearer " + s.access_token, "apikey":SB_KEY}, body:JSON.stringify({subscription:sub.toJSON(), ua:navigator.userAgent})});
  if(!res.ok) throw new Error("subscribe failed");
  return "on";
}
async function pushUnsubscribe(){ try{ const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if(sub) await sub.unsubscribe(); }catch(_){} return "off"; }

return { ready: !!sb, makeDb, makeAssets, blobSrc, extractText, session, showAuth, signOut, rpc, standalone, pushState, pushSubscribe, pushUnsubscribe, set onUrl(f){ onUrl=f; } };
})();
