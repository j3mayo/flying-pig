let wPeek=false, W=null, wLast=null, wTick=null, wEnd=0, wNext="", wInFlight=false, wDirty=false, wInputT=null, wClock=null, wDel="", wDiscard=false;
function parseScheme(s){ s=String(s||"").trim(); const m=s.match(/^(\d+)\s*x\s*(.+)$/i);
  if(m){ let r=m[2].trim(); const side=/\/side/i.test(r); r=r.replace(/\/side/i,"").trim(); return {sets:Array.from({length:+m[1]},()=>r), unit:side?"/side":""}; }
  if(/^\d+(\s*\/\s*\d+)+$/.test(s)) return {sets:s.split("/").map(x=>x.trim()), unit:""};
  return {sets:[""], unit:""}; }
function prevFor(id, date){
  const base=String(id).split("~")[0];
  const past=Object.values(S.liftlog).filter(l=>l.date<date&&l.exercises).sort((a,b)=>b.date.localeCompare(a.date));
  for(const l of past){ const e=l.exercises.find(x=>x.id===id)||(id===base?l.exercises.find(x=>x.id===base):null); if(e) return e.sets.filter(s=>s.done); }
  if(id!==base) return [];
  const ld=S.loads.find(x=>x.id===id); const h=ld&&ld.history&&[...ld.history].sort((a,b)=>b.date.localeCompare(a.date))[0];
  return h? [{load:String(h.load), reps:String(h.reps)}] : [];
}
/* A Prep or Finish block that lists several moves ("Dead hang 2x30s, doorway pec stretch 2x45s/side") becomes one checkbox per move. */
function splitSimple(e){ const parts=String(e.name).split(/,\s*/).filter(Boolean);
  const one=(id,name,target)=>({id, name, block:e.block||"", target, cue:"", unit:"", simple:true, pt:!!e.pt, rest:0, sets:[{done:false}]});
  if(parts.length<2) return [one(e.id, e.name, [e.load==="BW"?"":e.load, e.scheme].filter(Boolean).join(" · ")||e.hold||"")];
  return parts.map((p,k)=>{ const m=p.match(/^(.*?)\s+(\d+\s*x\s*\S+)$/i); let nm=(m?m[1]:p).trim(); nm=nm.charAt(0).toUpperCase()+nm.slice(1);
    const dose=m? m[2].replace(/\s*x\s*/i," x ").replace(/(\d)s\b/,"$1 s").replace("/side"," per side") : "";
    return one(e.id+"-"+(k+1), nm, dose); }); }
function wLocal(){ try{ return JSON.parse(localStorage.getItem("fp-w")||"null"); }catch(_){ return null; } }
function startWorkout(day){
  const t=todayISO(), cur=S.liftlog[t], loc=wLocal();
  if(loc&&loc.date===t&&loc.day===day&&loc.status==="in_progress"&&(!cur||!cur.exercises||String(loc.updatedAt||"")>=String(cur.updatedAt||""))) W=loc;
  else if(cur&&cur.exercises&&cur.day===day) W=JSON.parse(JSON.stringify(cur));
  else { W={date:t, day, status:"in_progress", startedAt:new Date().toISOString(), pausedMs:0, pausedAt:null, notes:(cur&&cur.notes)||"", source:"app", exercises:[]};
    exFor(day).forEach(e=>{ const simple=!e.scheme||e.block==="Prep"||e.block==="Finish"; if(simple){ W.exercises.push(...splitSimple(e)); return; }
      const ps=parseScheme(e.scheme); W.exercises.push({id:e.id, name:e.name, block:e.block||"", target:[e.load,e.scheme].filter(Boolean).join(" · "), cue:e.cue||"", unit:ps.unit, simple:false, pt:!!e.pt, rest:e.rest||(e.track?120:90), sets:ps.sets.map(r=>({load:e.load, reps:r, done:false}))}); }); }
  if(W.status==="done") W.status="in_progress";
  wResume(); wDel=""; wDiscard=false; wEnd=W.restEnd&&W.restEnd>Date.now()?W.restEnd:0; wNext=W.restNext||"";
  try{ localStorage.setItem("fp-w-open", day); }catch(_){}
  dlg.className="full"; renderWorkout(); if(!dlg.open) dlg.showModal(); try{ sh.focus({preventScroll:true}); }catch(_){}
  if(wEnd){ clearInterval(wTick); wTick=setInterval(()=>{ tickRest(); if(Date.now()>wEnd+8000) stopRest(); },500); }
  clearInterval(wClock); wClock=setInterval(()=>{ const el=document.getElementById("wEl"); if(el&&W) el.textContent=elapsed(); }, 1000);
  persistWorkout();
}
const wSecs=()=>{ if(!W) return 0; const now=W.pausedAt?new Date(W.pausedAt).getTime():Date.now(); return Math.max(0,Math.floor((now-new Date(W.startedAt).getTime()-(W.pausedMs||0))/1000)); };
const elapsed=()=>{ if(!W) return ""; const s=wSecs(); return (W.pausedAt?"Paused · ":"")+Math.floor(s/60)+":"+pad(s%60); };
function wPause(){ if(W&&!W.pausedAt){ W.pausedAt=new Date().toISOString(); stopRest(); } }
function wResume(){ if(W&&W.pausedAt){ W.pausedMs=(W.pausedMs||0)+Math.max(0,Date.now()-new Date(W.pausedAt).getTime()); W.pausedAt=null; } }
function wCounts(){ let n=0,d=0; W.exercises.forEach(e=>{ e.sets.forEach(s=>{n++; if(s.done)d++;}); }); return {n,d}; }
const PTTAG='<span class="tagpt">PT</span>';
function renderWorkout(){
  const c=wCounts(), sc=sh.querySelector(".sh-body"), keep=sc?sc.scrollTop:0, paused=!!W.pausedAt;
  let lastBlock=null;
  const body = W.exercises.map((e,ei)=>{
    const head = (e.block==="Prep"||e.block==="Finish") && e.block!==lastBlock ? `<div class="cap" style="padding-top:4px">${e.block==="Prep"?"Warm-up":"Cool-down"}</div>` : ""; lastBlock=e.block;
    if(e.simple) return `${head}<div class="ex" style="margin-bottom:8px"><div class="sets simple"><div style="min-width:0"><div style="font-weight:600">${esc(e.name)}${e.pt?PTTAG:""}</div>${e.target?`<div class="ex-cue" style="padding:0">${esc(e.target)}</div>`:""}</div><button type="button" class="ck" data-w="tick" data-e="${ei}" data-s="0" aria-pressed="${!!e.sets[0].done}" aria-label="${esc(e.name)} done" style="${e.sets[0].done?"background:var(--good);color:#fff":""}">${CHECK}</button></div></div>`;
    const prev=prevFor(e.id, W.date);
    const L=S.loads.find(x=>x.id===e.id)||{}; const tl=[L.hold,L.tempo].filter(Boolean).join(" · ");
    const infoId=S.loads.find(x=>x.id===e.id)?e.id:"";
    return `${head}<div class="ex"><div class="ex-h">${infoId?`<button type="button" data-act="exinfo" data-id="${esc(infoId)}"><h3>${esc(e.name)}</h3><span class="info" aria-hidden="true">i</span></button>`:`<h3 style="margin:0;font:600 19px var(--font-d);color:var(--tint)">${esc(e.name)}</h3>`}<button type="button" class="swap" data-w="swap" data-e="${ei}" aria-label="Swap ${esc(e.name)}">Swap</button></div>
      <div class="ex-cue">${esc(e.target)}${e.pt?PTTAG:""}${e.swappedFrom?` · instead of ${esc(e.swappedFrom)}`:""}${tl?" · "+esc(tl):""}</div>
      <div class="sets"><div class="sg hd"><span style="text-align:center">Set</span><span>Previous</span><span style="text-align:center">lb</span><span style="text-align:center">Reps${esc(e.unit)}</span><span></span></div>
      ${e.sets.map((s,si)=>{ const pv=prev[si]||prev[prev.length-1], del=wDel===ei+":"+si; return `<div class="sg ${s.done?"done":""}"><button type="button" class="no" data-w="setmenu" data-e="${ei}" data-s="${si}" aria-label="Set ${si+1} options">${si+1}</button><span class="pv">${pv?esc((pv.load||"")+" × "+(pv.reps||"")):"–"}</span><input inputmode="decimal" data-f="load" data-e="${ei}" data-s="${si}" value="${esc(s.load)}" aria-label="Set ${si+1} weight"><input inputmode="numeric" data-f="reps" data-e="${ei}" data-s="${si}" value="${esc(s.reps)}" aria-label="Set ${si+1} reps">${del?`<button type="button" class="del" data-w="delset" data-e="${ei}" data-s="${si}">Delete</button>`:`<button type="button" class="ck" data-w="tick" data-e="${ei}" data-s="${si}" aria-pressed="${!!s.done}" aria-label="Set ${si+1} done">${CHECK}</button>`}</div>`; }).join("")}
      <button type="button" class="addset" data-w="add" data-e="${ei}">+ Add Set</button></div></div>`; }).join("");
  sh.innerHTML = navBar(`<button class="nav-btn" type="button" data-w="close">Close</button>`, `Day ${esc(W.day)} · ${esc(LIFT_NAMES[W.day]||"")}<small><span id="wEl">${elapsed()}</span> · ${c.d}/${c.n} done</small>`, `<button class="nav-btn" type="button" data-w="finish" style="font-weight:600">Finish</button>`)
    + `<div class="wp"><div style="width:${c.n?Math.round(c.d/c.n*100):0}%"></div></div>`
    + `<div class="sh-body">
      <div class="wtool"><button type="button" data-w="pause" class="${paused?"on":""}">${paused?"Resume":"Pause"}</button><span class="foot" style="padding:0">Tap a set number to delete it</span></div>
      ${paused?`<div class="paused"><div><div style="font-weight:600">Workout paused</div><div class="foot" style="padding:2px 0 0">The timer is stopped. Your sets are saved.</div></div><button class="btn-big" type="button" data-w="pause" style="width:auto;padding:0 18px;min-height:40px">Resume</button></div>`:""}
      ${body}
      <button type="button" class="btn-big sec2" data-w="addex" style="margin-bottom:22px">+ Add Exercise</button>
      <div class="cap">Session notes</div><div class="group"><div class="frow"><textarea id="wNotes" placeholder="Grinds, form breaks, what felt easy" aria-label="Session notes">${esc(W.notes||"")}</textarea></div></div>
      <div style="margin-top:16px"><button class="btn-big" type="button" data-w="finish">Finish Workout</button></div>
      <div style="margin-top:10px"><button class="btn-big sec2" type="button" data-w="discard" style="color:var(--bad)">${wDiscard?"Tap again to discard":"Discard Workout"}</button></div>
      <div class="rest" id="wRest" ${wEnd?"":"hidden"} role="status"><span class="tm" id="wTm"></span><span class="nx" id="wNx"></span><button type="button" class="x" data-w="skip" aria-label="Dismiss rest timer">×</button></div></div>`;
  const nb=sh.querySelector(".sh-body"); if(nb) nb.scrollTop=keep; tickRest();
}
function tickRest(){ const box=document.getElementById("wRest"); if(!box) return; if(!wEnd){ box.hidden=true; return; }
  const left=Math.ceil((wEnd-Date.now())/1000); box.hidden=false;
  document.getElementById("wTm").textContent = left>0? Math.floor(left/60)+":"+pad(left%60) : "Go";
  document.getElementById("wTm").style.color = left>0? "" : "var(--good)";
  document.getElementById("wNx").textContent = (left>0?"Rest · next: ":"Next: ")+wNext; }
function startRest(sec,next){ if(!sec) return stopRest(); wEnd=Date.now()+sec*1000; wNext=next; if(W){ W.restEnd=wEnd; W.restNext=next; } clearInterval(wTick); wTick=setInterval(()=>{ tickRest(); if(Date.now()>wEnd+8000) stopRest(); },500); tickRest(); }
function stopRest(){ clearInterval(wTick); wEnd=0; wNext=""; if(W){ W.restEnd=0; W.restNext=""; } tickRest(); }
function saveLocalW(){ if(!W) return; W.updatedAt=new Date().toISOString(); try{ localStorage.setItem("fp-w", JSON.stringify(W)); }catch(_){} }
async function persistWorkout(){ if(!W) return; saveLocalW(); if(!db) return; wLast=W; if(wInFlight){ wDirty=true; return; } wInFlight=true;
  try{ do{ wDirty=false; const doc=wLast; await db.collection("liftlog").doc(doc.date).set(JSON.parse(JSON.stringify(doc))); }while(wDirty); }catch(err){ failed(err); } finally{ wInFlight=false; } }
function grabNotes(){ const n=document.getElementById("wNotes"); if(n&&W) W.notes=n.value; }
function endWorkout(msg){ stopRest(); clearInterval(wClock); W=null; wPeek=false; try{ localStorage.removeItem("fp-w-open"); }catch(_){} closeSheet(); render(); if(msg) toast(msg); }
async function finishWorkout(){
  grabNotes(); wResume(); W.status="done"; W.finishedAt=new Date().toISOString();
  W.done=W.exercises.filter(e=>!e.simple).map(e=>({id:e.id, load:(e.sets.find(s=>s.done)||e.sets[0]||{}).load||"", scheme:e.sets.filter(s=>s.done).map(s=>s.reps).join("/")}));
  const w=W; await persistWorkout(); try{ localStorage.removeItem("fp-w"); }catch(_){}
  try{ for(const e of w.exercises){ const cur=S.loads.find(l=>l.id===e.id); if(!cur||!cur.track) continue;
      const done=e.sets.filter(s=>s.done&&parseFloat(s.load)&&parseInt(s.reps)); if(!done.length) continue;
      const top=Math.max(...done.map(s=>parseFloat(s.load))), reps=Math.min(...done.filter(s=>parseFloat(s.load)===top).map(s=>parseInt(s.reps)));
      const hist=(cur.history||[]).filter(h=>h.date!==w.date).concat([{date:w.date, load:top, reps, scheme:done.map(s=>s.load+"x"+s.reps).join(", ")}]);
      await db.collection("loads").doc(e.id).update({history:hist}); } }catch(err){ failed(err); }
  endWorkout("Workout saved. Tonight's review sets your next targets.");
}
async function discardWorkout(){ const d=W.date; try{ localStorage.removeItem("fp-w"); }catch(_){}
  clearTimeout(wInputT); W=null; try{ if(db&&S.liftlog[d]) await db.collection("liftlog").doc(d).delete(); }catch(err){ failed(err); }
  endWorkout("Workout discarded"); }
sh.addEventListener("input", e=>{ if(!W||wPeek) return; const f=e.target.dataset.f; if(e.target.id==="wNotes"){ W.notes=e.target.value; saveLocalW(); clearTimeout(wInputT); wInputT=setTimeout(persistWorkout,800); return; } if(!f) return;
  W.exercises[+e.target.dataset.e].sets[+e.target.dataset.s][f]=e.target.value.trim(); saveLocalW(); clearTimeout(wInputT); wInputT=setTimeout(persistWorkout,800); });
sh.addEventListener("focusin", e=>{ if(e.target.matches(".sg input")) e.target.select(); });
sh.addEventListener("click", e=>{
  const b=e.target.closest("[data-w]"); if(!b||!W) return; const w=b.dataset.w;
  if(wPeek){ if(w==="peekclose"){ wPeek=false; renderWorkout(); }
    else if(w==="swappick") pickSwap(+b.dataset.k);
    else if(w==="addpick") addEx(wAdd[+b.dataset.k]);
    else if(w==="addcustom"){ const n=($("#axName")||{}).value||""; if(!n.trim()){ toast("Name the exercise"); return; } addEx({name:n.trim(), load:($("#axLoad")||{}).value.trim(), scheme:($("#axScheme")||{}).value.trim()||"3 x 10"}); }
    else if(w==="rmex"){ W.exercises.splice(wAltIdx,1); wPeek=false; persistWorkout(); renderWorkout(); toast("Removed from today"); }
    return; }
  if(w!=="discard") wDiscard=false;
  if(w==="close"){ grabNotes(); wPause(); persistWorkout(); endWorkout("Paused and saved. Tap Resume Workout to continue."); return; }
  if(w==="finish"){ finishWorkout(); return; }
  if(w==="discard"){ if(!wDiscard){ wDiscard=true; renderWorkout(); return; } discardWorkout(); return; }
  if(w==="pause"){ grabNotes(); if(W.pausedAt) wResume(); else wPause(); persistWorkout(); renderWorkout(); return; }
  if(w==="skip"){ stopRest(); saveLocalW(); return; }
  if(w==="swap"){ grabNotes(); swapSheet(+b.dataset.e); return; }
  if(w==="addex"){ grabNotes(); addSheet(); return; }
  if(w==="setmenu"){ const k=b.dataset.e+":"+b.dataset.s; wDel = wDel===k ? "" : k; renderWorkout(); return; }
  if(w==="delset"){ grabNotes(); const ex=W.exercises[+b.dataset.e]; ex.sets.splice(+b.dataset.s,1); wDel=""; persistWorkout(); renderWorkout(); return; }
  if(w==="add"){ grabNotes(); wDel=""; const ex=W.exercises[+b.dataset.e], last=ex.sets[ex.sets.length-1]||{}; ex.sets.push({load:last.load||"", reps:last.reps||"", done:false}); persistWorkout(); renderWorkout(); return; }
  if(w==="tick"){ grabNotes(); wDel=""; if(W.pausedAt) wResume(); const ei=+b.dataset.e, si=+b.dataset.s, ex=W.exercises[ei], s=ex.sets[si]; s.done=!s.done;
    if(s.done&&!ex.simple){ const ns=ex.sets.findIndex(x=>!x.done), nx=W.exercises.slice(ei+1).find(x=>!x.simple&&x.sets.some(y=>!y.done));
      if(ns>-1) startRest(ex.rest, ex.name+", set "+(ns+1)); else if(nx) startRest(ex.rest, nx.name); else stopRest(); }
    persistWorkout(); renderWorkout(); }
});
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden"){ if(W){ grabNotes(); persistWorkout(); } else draftSave(); } });
