/* ---------- exercise alternatives ---------- */
/* Each option: [name, equipment, factor vs the pattern reference, scheme override]. Loads scale from your current load. */
const PAT = {
  hpress:[["Smith bench","bar",1],["Barbell bench press","bar",1],["Flat DB bench","db",.4],["Machine chest press","mach",1],["Incline DB press","db",.33],["Push-up","bw",0,"4 x 12"]],
  vpull:[["Lat pulldown","cable",1],["Pull-up","bw",0],["Single-arm cable pulldown","cable",.45,"3 x 10/side"],["Band-assisted pull-up","band",0]],
  hrow:[["Smith bent-over row","bar",1],["Seated cable row","cable",1],["Chest-supported row","db",.33],["Single-arm DB row","db",.42,"3 x 10/side"],["Machine row","mach",1],["Inverted row","bw",0,"3 x 10"]],
  squat:[["Smith squat","bar",1],["Barbell back squat","bar",.9],["Hack squat","mach",1.1],["Leg press","mach",2],["Goblet squat","one",.35,"3 x 12"]],
  hinge:[["Smith RDL","bar",1],["Barbell RDL","bar",.95],["DB RDL","db",.35],["Back extension","bw",0,"3 x 12"]],
  calf:[["Standing calf raise","mach",1],["Smith calf raise","bar",1],["Leg press calf press","mach",1.2],["Seated calf raise","mach",.6],["Single-leg DB calf raise","one",.2,"3 x 12/side"]],
  adductor:[["Cable hip adduction","cable",1],["Adductor machine","mach",2],["Side-lying adduction","bw",0,"3 x 15/side"],["Ball squeeze","bw",0,"3 x 30 sec"]],
  single:[["Bulgarian split squat","db",1],["DB reverse lunge","db",.9],["Smith split squat","bar",2],["DB walking lunge","db",.8,"3 x 10/side"]],
  hamcurl:[["Standing cable leg curl","cable",1],["Lying leg curl","mach",1.3,"3 x 10"],["Seated leg curl","mach",1.5,"3 x 10"],["Stability ball leg curl","bw",0,"3 x 12"]],
  antiext:[["Dead bug","bw",0],["Plank","bw",0,"3 x 40 sec"],["Ab wheel rollout","bw",0,"3 x 8"],["Hollow hold","bw",0,"3 x 30 sec"]],
  antirot:[["Cable Pallof press","cable",1],["Half-kneeling cable Pallof","cable",.8],["Band Pallof press","band",0],["Bird dog","bw",0,"3 x 8/side"]],
  rotation:[["Cable rotational chop","cable",1],["Band rotational chop","band",0],["Half-kneeling cable lift","cable",.8]],
  hipext:[["Cable pull-through","cable",1],["Barbell hip thrust","bar",2,"3 x 10"],["DB glute bridge","one",.8,"3 x 12"]],
  carry:[["Suitcase carry","one",1],["Farmer carry","db",.8,"3 x 40 sec"],["Single-arm KB carry","kb",.9]],
  reardelt:[["Reverse fly","db",1],["Cable reverse fly","cable",.8],["Rear delt machine","mach",4],["Band pull-apart","band",0,"3 x 15"]],
  latraise:[["DB lateral raise","db",1],["Cable lateral raise","cable",.8,"3 x 12/side"],["Machine lateral raise","mach",3]],
  biceps:[["DB curl","db",1],["Hammer curl","db",1],["Cable curl","cable",1.6],["EZ-bar curl","bar",1.8]],
  triceps:[["Cable pushdown","cable",1],["Cable overhead triceps ext","cable",1.4],["DB skull crusher","db",.3],["Close-grip push-up","bw",0,"3 x 12"]],
  shrug:[["Shrug","db",1],["Smith shrug","bar",2.6],["Cable shrug","cable",2]],
  lowtrap:[["Incline T/Y","db",1],["Prone T/Y on the floor","bw",0],["Band Y raise","band",0]],
  facepull:[["Cable face pull","cable",1],["Band face pull","band",0,"3 x 20"],["Reverse fly","db",.25]],
  pwrsquat:[["Speed Smith squat","bar",1],["Speed barbell squat","bar",.9],["Box jump","bw",0,"5 x 3"],["Squat jump","bw",0,"5 x 3"]],
  pwrlunge:[["DB reverse lunge","db",1],["Speed split squat","db",.8],["Skater bound","bw",0,"4 x 4/side"]],
  pwrrow:[["Explosive cable row","cable",1],["Explosive DB row","db",.35,"4 x 4/side"],["Band explosive row","band",0]]
};
const PMAP = {a1:"hpress",a2:"vpull",a3:"hrow",a4:"antiext",a5:"lowtrap",a6:"facepull",a7:"biceps",a8:"triceps",a9:"shrug",
  b1:"squat",b2:"calf",b3:"hinge",b4:"adductor",b5:"single",b6:"hamcurl",c1:"pwrsquat",c2:"pwrlunge",c3:"pwrrow",c4:"rotation",c5:"hipext",c6:"antirot",c7:"carry",
  d1:"hpress",d2:"hrow",d3:"vpull",d4:"antiext",d5:"reardelt",d6:"latraise",d7:"facepull",d8:"biceps",d9:"triceps",d10:"shrug",d11:"lowtrap"};
const EQ = {bar:"Barbell or Smith", db:"Dumbbells", one:"One dumbbell", kb:"Kettlebell", cable:"Cable", mach:"Machine", bw:"Bodyweight", band:"Band"};
const ADD_FOR = {A:["reardelt","latraise","antirot","biceps"], B:["calf","hamcurl","adductor","antiext","hipext"], C:["carry","antiext","antirot","rotation"], D:["triceps","biceps","antirot","hrow"]};
function patOf(e){ if(!e) return null; if(e.pattern&&PAT[e.pattern]) return e.pattern; const base=String(e.id||"").split("~")[0]; if(PMAP[base]) return PMAP[base];
  const n=String(e.name||"").toLowerCase();
  const rx=[[/speed .*squat|box jump|squat jump/,"pwrsquat"],[/bench|chest press|push-up/,"hpress"],[/pulldown|pull-up|chin-up/,"vpull"],[/explosive .*row/,"pwrrow"],[/row/,"hrow"],[/split squat|lunge/,"single"],[/squat|leg press/,"squat"],[/rdl|deadlift|back extension/,"hinge"],[/calf/,"calf"],[/adduct/,"adductor"],[/leg curl/,"hamcurl"],[/pallof|bird dog/,"antirot"],[/dead bug|plank|rollout|hollow/,"antiext"],[/chop|rotation/,"rotation"],[/pull-through|hip thrust|bridge/,"hipext"],[/carry/,"carry"],[/reverse fly|rear delt|pull-apart/,"reardelt"],[/lateral raise/,"latraise"],[/curl/,"biceps"],[/pushdown|triceps|skull/,"triceps"],[/shrug/,"shrug"],[/t\/y|y raise/,"lowtrap"],[/face pull/,"facepull"]];
  for(const [r,p] of rx) if(r.test(n)) return p; return null; }
const numLoad = s => { const m=String(s||"").match(/\d+(\.\d+)?/); return m?parseFloat(m[0]):null; };
function optFactor(pat,name){ const n=String(name||"").toLowerCase(); const o=(PAT[pat]||[]).find(x=>x[0].toLowerCase()===n)||(PAT[pat]||[]).find(x=>n.includes(x[0].toLowerCase())||x[0].toLowerCase().includes(n)); return o&&o[2]?o[2]:null; }
function refLoad(e,pat){ const f=optFactor(pat,e.name), n=numLoad(e.load); if(f&&n) return n/f;
  for(const s of S.loads){ if(s.id!==e.id&&patOf(s)===pat){ const sf=optFactor(pat,s.name), sn=numLoad(s.load); if(sf&&sn) return sn/sf; } } return null; }
function altLoad(ref,o){ const eq=o[1], f=o[2]; if(eq==="bw") return "BW"; if(eq==="band") return "Band"; if(!f||!ref) return "Pick a load";
  let v=ref*f; const step=(eq==="db"||eq==="one"||eq==="kb")&&v<12?2.5:5; v=Math.max(step, Math.round(v/step)*step); return eq==="db"?v+"s":String(v); }
function alternatives(e){ const pat=patOf(e); if(!pat) return []; const ref=refLoad(e,pat), cur=String(e.name||"").toLowerCase();
  return PAT[pat].filter(o=>o[0].toLowerCase()!==cur).map(o=>({name:o[0], eq:o[1], load:altLoad(ref,o), scheme:o[3]||e.scheme||"3 x 10", pattern:pat})); }
const altRows = (list, act, extra) => list.map((a,k)=>`<button class="row" type="button" data-w="${act}" data-act="${act}" data-k="${k}" ${extra||""}><div class="main"><div class="t">${esc(a.name)}</div><div class="s">${esc(EQ[a.eq]||"")}</div></div><div class="v">${esc([a.load,a.scheme].filter(Boolean).join(" · "))}</div></button>`).join("");

/* swap inside a workout */
let wAlt=[], wAltIdx=-1;
function swapSheet(ei){ const ex=W.exercises[ei]; const base=S.loads.find(l=>l.id===String(ex.id).split("~")[0])||{id:ex.id,name:ex.name,load:"",scheme:""};
  wAlt=alternatives(Object.assign({}, base, {name:ex.swappedName||base.name})); wAltIdx=ei; wPeek=true;
  sh.innerHTML = navBar(`<button class="nav-btn" type="button" data-w="peekclose">Back</button>`, "Swap Exercise", "") + `<div class="sh-body">
    <div class="hero"><div class="big">${esc(ex.name)}</div><div class="pills"><span class="pill">${esc(ex.target||"")}</span>${base.pt?'<span class="pill tint">PT plan</span>':""}</div></div>
    <div class="cap">Same job, different equipment</div><div class="group">${wAlt.length?altRows(wAlt,"swappick"):'<div class="empty">No standard swaps for this one. Add a different exercise instead.</div>'}</div>
    <div class="group" style="margin-top:12px"><label class="row" style="cursor:pointer"><div class="main"><div class="t">Keep this swap going forward</div><div class="s">Sent as a request for tonight's review</div></div><input type="checkbox" id="swPerm" style="width:22px;height:22px;accent-color:var(--tint)"></label></div>
    ${base.pt?'<div class="foot">This one is from your PT plan. Swap only if the equipment is missing, and keep the same holds.</div>':""}
    <div class="sec"><button class="btn-big sec2" type="button" data-w="rmex" style="color:var(--bad)">Remove from today</button></div></div>`;
  sh.scrollTop=0; }
function buildEx(id, name, load, scheme, extra){ const ps=parseScheme(scheme); return Object.assign({id, name, block:"", target:[load,scheme].filter(Boolean).join(" · "), cue:"", unit:ps.unit, simple:false, rest:90, sets:ps.sets.map(r=>({load, reps:r, done:false}))}, extra||{}); }
function pickSwap(k){ const a=wAlt[k], ex=W.exercises[wAltIdx]; if(!a||!ex) return; const perm=$("#swPerm")&&$("#swPerm").checked;
  const baseId=String(ex.id).split("~")[0], orig=ex.swappedFrom||ex.name;
  W.exercises[wAltIdx]=buildEx(baseId+"~"+a.name.toLowerCase().replace(/[^a-z0-9]+/g,"-"), a.name, a.load, a.scheme, {swappedFrom:orig, block:ex.block, rest:ex.rest});
  if(perm&&db){ const id=Date.now().toString(36); db.collection("requests").doc(id).set({created:new Date().toISOString(), kind:"change", status:"pending", reply:"", attachments:[], text:`Swap ${orig} for ${a.name} going forward (${a.load} · ${a.scheme}). Equipment.`}).catch(failed); }
  wPeek=false; persistWorkout(); renderWorkout(); toast(perm?"Swapped. Tonight's review makes it permanent.":"Swapped for today"); }
let wAdd=[];
function addSheet(){ wPeek=true; const have=new Set(W.exercises.map(e=>patOf(S.loads.find(l=>l.id===String(e.id).split("~")[0])||e)));
  const pats=(ADD_FOR[W.day]||[]).filter(p=>!have.has(p));
  wAdd=pats.map(p=>{ const o=PAT[p][0], ref=refLoad({id:"",name:o[0],load:""},p); return {name:o[0], eq:o[1], load:altLoad(ref,o), scheme:o[3]||"3 x 12", pattern:p}; });
  sh.innerHTML = navBar(`<button class="nav-btn" type="button" data-w="peekclose">Back</button>`, "Add Exercise", "") + `<div class="sh-body">
    <div class="cap">Suggested for Day ${esc(W.day)}</div><div class="group">${wAdd.length?altRows(wAdd,"addpick"):'<div class="empty">Today already covers the usual add-ons.</div>'}</div>
    <div class="cap" style="margin-top:22px">Your own</div><div class="group"><div class="frow"><input id="axName" placeholder="Exercise name" aria-label="Exercise name" style="flex:1;text-align:left;color:var(--label)"></div>
    <div class="frow"><label for="axLoad">Weight</label><input id="axLoad" inputmode="decimal" placeholder="lb"></div><div class="frow"><label for="axScheme">Sets x reps</label><input id="axScheme" placeholder="3 x 10" value="3 x 10"></div></div>
    <div style="margin-top:12px"><button class="btn-big" type="button" data-w="addcustom">Add to Workout</button></div>
    <div class="foot">Added exercises are logged with today's session so the nightly review sees them.</div></div>`; sh.scrollTop=0; }
function addEx(a){ W.exercises.push(buildEx("x-"+Date.now().toString(36), a.name, a.load, a.scheme, {added:true})); wPeek=false; persistWorkout(); renderWorkout();
  const nb=sh.querySelector(".sh-body"); if(nb) nb.scrollTop=nb.scrollHeight; toast(a.name+" added"); }

/* ---------- day detail (Coming Up) ---------- */
function actsFor(d){ const p=S.plan[d]||{}, out=[];
  if(p.run&&p.run.miles>0) out.push({c:"var(--run)", t:shortRun(p.run), s:p.run.miles+" mi"});
  if(p.lift) out.push({c:"var(--lift)", t:"Day "+p.lift+" · "+(LIFT_NAMES[p.lift]||""), s:""});
  if(p.extra) out.push({c:"#5856D6", t:"PT: shrug + incline T/Y", s:""});
  if(p.soccer) out.push({c:"var(--warn)", t:"Soccer", s:"Hard day"});
  return out; }
function dateBlock(d, cls){ const x=parse(d); return `<div class="dt ${cls||""}"><div class="w">${DOW[x.getDay()].toUpperCase()}</div><div class="n">${x.getDate()}</div></div>`; }
function upcoming(t){
  const rows=[]; for(let i=1;i<=7;i++){ const d=addDays(t,i), p=S.plan[d]; if(!p) continue; const a=actsFor(d);
    rows.push(`<button class="day" type="button" data-act="daysheet" data-d="${d}">${dateBlock(d)}<div class="acts">${a.length?a.map(x=>`<div class="act"><span class="dot" style="background:${x.c}"></span><span class="tx">${esc(x.t)}</span></div>`).join(""):`<div class="act rest"><span class="dot" style="background:var(--fill-2)"></span><span class="tx">Rest</span></div>`}${p.note?`<div class="act"><span class="sm">${esc(p.note)}</span></div>`:""}</div>${CHEV}</button>`); }
  return rows.join("") || '<div class="empty">Next weeks are added two weeks ahead.</div>'; }
function daySheet(d){ const p=S.plan[d]||{};
  let h=""; if(p.run&&p.run.miles>0) h+=`<div class="sec"><div class="cap">Run</div><div class="group"><div class="row"><span class="ico run">${ICON.run}</span><div class="main"><div class="t">${esc(shortRun(p.run))}</div></div><div class="v">${esc(p.run.miles)} mi</div></div>${p.run.detail?`<p class="para">${esc(p.run.detail)}</p>`:""}</div></div>`;
  if(p.lift) h+=`<div class="sec"><div class="cap">Day ${esc(p.lift)} · ${esc(LIFT_NAMES[p.lift]||"")}${p.liftNote?" · "+esc(p.liftNote):""}</div><div class="group">${exFor(p.lift).map(exRow).join("")}</div></div>`;
  if(p.extra) h+=`<div class="sec"><div class="cap">PT</div><div class="group"><div class="row"><span class="ico extra">${ICON.extra}</span><div class="main"><div class="t">Shrug + incline T/Y</div><div class="s">From your PT plan</div></div></div></div></div>`;
  if(p.soccer) h+=`<div class="sec"><div class="cap">Soccer</div><div class="group"><div class="row"><span class="ico soc">${ICON.soc}</span><div class="main"><div class="t">Full-intensity soccer</div><div class="s">Counts as a hard day</div></div></div></div></div>`;
  if(p.note) h+=`<div class="sec"><div class="cap">Note</div><div class="group"><p class="para">${esc(p.note)}</p></div></div>`;
  openSheet(navBar(navBtn("close","Close"), esc(longDate(d))+(p.week!=null?`<small>Week ${esc(p.week)}</small>`:""), "")+`<div class="sh-body">${h||'<div class="group"><div class="empty">Rest day. Recovery is training too.</div></div>'}</div>`); }

/* ---------- Health ---------- */
const dvals=(key,from,to)=>Object.values(S.daily).filter(d=>d.date>=from&&d.date<=to&&d[key]!=null&&d[key]!==""&&!isNaN(+d[key])).map(d=>+d[key]);
const mean=a=>a.length?sum(a)/a.length:null;
function trendOf(key, goodUp, t){ const rec=dvals(key,addDays(t,-13),t), base=dvals(key,addDays(t,-60),addDays(t,-14)), cur=mean(dvals(key,addDays(t,-6),t));
  if(rec.length<4||base.length<4) return {cur, st:null}; const r=mean(rec), b=mean(base), ch=(r-b)/(b||1);
  return {cur, diff:r-b, st: Math.abs(ch)<.02?"steady":((ch>0)===goodUp?"improving":"watch")}; }
function series(key,t,days){ return Object.values(S.daily).filter(d=>d.date>=addDays(t,-(days||90))&&d[key]!=null&&d[key]!==""&&!isNaN(+d[key])).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({x:d.date,y:+d[key]})); }
function pillarStatus(list){ const s=list.map(x=>x&&x.st).filter(Boolean); if(!s.length) return null; if(s.includes("watch")) return "watch"; if(s.includes("improving")) return "improving"; return "steady"; }
const stPill = s => s? `<span class="pill ${s==="improving"?"good":s==="watch"?"warn":"tint"}">${s==="improving"?"Improving":s==="watch"?"Watch":"Steady"}</span>` : '<span class="pill">Building baseline</span>';
const fmtN=(v,dp)=>v==null?"–":(+v).toFixed(dp||0);
const dTxt=(x,unit,dp)=>x&&x.diff!=null?`${x.diff>0?"Up":"Down"} ${Math.abs(x.diff).toFixed(dp||0)}${unit} vs prior weeks`:"7-day average";
function liftE1(id){ const l=S.loads.find(x=>x.id===id); if(!l||!l.history) return null; const pts=l.history.map(h=>({x:h.date,y:e1rm(+h.load,+h.reps)})).filter(q=>q.y).sort((a,b)=>a.x.localeCompare(b.x)); return pts.length?{name:l.name, pts, last:pts[pts.length-1].y, first:pts[0].y}:null; }
function viewHealth(){
  const t=todayISO(), st=settings();
  const vo2=trendOf("vo2",true,t), rhr=trendOf("rhr",false,t), hrv=trendOf("hrv",true,t), slp=trendOf("sleep",true,t), wt=trendOf("weight",false,t), stp=trendOf("steps",true,t);
  const easy=[...S.runs].filter(r=>r.avgHR&&r.avgHR<=st.easyCap+2&&pace(r)).sort((a,b)=>a.date.localeCompare(b.date));
  const ep=easy.map(r=>({x:r.date,y:pace(r)/60}));
  let epSt=null; if(easy.length>=6){ const a=mean(easy.slice(-3).map(r=>pace(r))), b=mean(easy.slice(0,3).map(r=>pace(r))); const ch=(a-b)/b; epSt={st:Math.abs(ch)<.02?"steady":ch<0?"improving":"watch"}; }
  const lifts=["a1","b1","b3","a3","d3"].map(liftE1).filter(Boolean);
  let strSt=null; if(lifts.some(l=>l.pts.length>=3)){ const ch=mean(lifts.filter(l=>l.pts.length>=3).map(l=>(l.last-l.first)/l.first)); strSt={st:Math.abs(ch)<.02?"steady":ch>0?"improving":"watch"}; }
  const card=(icoCls,ico,title,status,nums,chart,why)=>`<div class="pillar"><div class="ph"><span class="ico ${icoCls}">${ico}</span><h3>${title}</h3>${stPill(status)}</div><div class="nums">${nums}</div>${chart}<div class="why">${why}</div></div>`;
  const num=(k,v,u,d)=>`<div class="num"><div class="k">${k}</div><div class="v">${v}<small> ${u}</small></div><div class="d">${d}</div></div>`;
  const chart=(pts,label,color,invert,dp)=>pts.length>=2?lineChart(pts,{label, color, invert, empty:"", fmt:v=>(+v).toFixed(dp||0)}):"";
  const rhrS=series("rhr",t), vo2S=series("vo2",t,180), hrvS=rolling(Object.values(S.daily).filter(d=>d.date>=addDays(t,-90)),"hrv",7), wtS=series("weight",t);
  const heart=card("run",ICON.heart,"Heart & Fitness",pillarStatus([vo2,rhr,epSt]),
    num("VO2 max",fmtN(vo2.cur,1),"",vo2.cur==null?"From your watch":dTxt(vo2,"",1))+num("Resting HR",fmtN(rhr.cur),"bpm",dTxt(rhr," bpm"))+num("Easy pace",ep.length?fmtPace(pace(easy[easy.length-1])):"–","/mi",`At HR under ${st.easyCap}`)+num("Easy runs",easy.length,"","Logged so far"),
    chart(vo2S.length>=2?vo2S:rhrS, vo2S.length>=2?"VO2 max, last 6 months":"Resting heart rate, last 90 days", "var(--run)", vo2S.length<2),
    "Higher cardiorespiratory fitness is linked to longer life in large cohort studies (Mandsager et al., JAMA Netw Open, 2018). Lower resting HR over time usually means a fitter heart.");
  const rec=card("extra",ICON.rest,"Recovery",pillarStatus([hrv,slp]),
    num("HRV",fmtN(hrv.cur),"ms",dTxt(hrv," ms"))+num("Sleep",fmtN(slp.cur,1),"h",dTxt(slp," h",1)),
    chart(hrvS,"HRV 7-day average, last 90 days","#5856D6"),
    "HRV is read as a 7-day average, not day to day (Plews et al., Sports Med, 2013). Adults need 7 or more hours of sleep (Watson et al., Sleep, 2015).");
  const str=card("lift",ICON.lift,"Strength",strSt&&strSt.st?strSt.st:null,
    lifts.slice(0,4).map(l=>num(l.name.replace(/^Smith /,"").replace(/ bent-over/,""),Math.round(l.last),"lb",(l.last-l.first)>=1?`+${Math.round(l.last-l.first)} since ${shortDate(l.pts[0].x)}`:"Est. max")).join("")||num("Main lifts","–","","Log sets to start"),
    lifts.length&&lifts[0].pts.length>=2?lineChart(lifts[0].pts,{label:lifts[0].name+" estimated max",color:"var(--lift)",empty:"",fmt:v=>Math.round(v)}):"",
    "Muscle strength predicts long-term health independent of aerobic fitness (Leong et al., Lancet, 2015). Estimated max uses the Epley formula from your best set.");
  const body=card("soc",ICON.body,"Body",pillarStatus([wt,stp]),
    num("Weight",fmtN(wt.cur,1),"lb",dTxt(wt," lb",1))+num("Steps",stp.cur==null?"–":Math.round(stp.cur).toLocaleString(),"/day",stp.cur==null?"From your watch":dTxt(stp,"",0)),
    chart(wtS,"Weight, last 90 days","var(--warn)"),
    "Daily steps are linked to lower mortality, leveling off around 8,000 to 10,000 a day for adults under 60 (Paluch et al., Lancet Public Health, 2022).");
  return `<h1 class="large">Health</h1><div class="sub">Long-term trends from your watch and training</div>${heart}${rec}${str}${body}
  <div class="foot" style="padding-top:14px">Status compares the last 2 weeks with the 6 weeks before. Trends, not a diagnosis.</div>`;
}

/* ---------- goal suggestions ---------- */
const sugItems=()=>((S.goalSug&&S.goalSug.items)||[]).filter(x=>!x.state);
async function sugAct(id, add){ const all=[...((S.goalSug&&S.goalSug.items)||[])], it=all.find(x=>x.id===id); if(!it) return;
  it.state=add?"added":"dismissed"; it.decidedAt=todayISO();
  try{ if(add){ const items=[...((S.goals&&S.goals.items)||[]), {title:it.title, detail:it.detail||"", status:""}]; await db.doc("settings/goals").set(Object.assign({}, S.goals||{}, {items, updated:todayISO()})); }
    await db.doc("settings/goalSuggestions").set(Object.assign({}, S.goalSug||{}, {items:all})); toast(add?"Goal added":"Suggestion dismissed"); }catch(err){ failed(err); } }

/* ---------- drafts: keep what you typed if the app closes ---------- */
const DRAFT="fp-draft";
function draftSave(){ if(W||!dlg.open) return; const key=sh.dataset.key; if(!key) return; const v={};
  sh.querySelectorAll("input[id],textarea[id],select[id]").forEach(el=>{ if(el.type==="file") return; v[el.id]= el.type==="checkbox"? el.checked : el.value; });
  try{ localStorage.setItem(DRAFT, JSON.stringify({key, at:Date.now(), v})); }catch(_){} }
function draftRestore(){ let d=null; try{ d=JSON.parse(localStorage.getItem(DRAFT)||"null"); }catch(_){} if(!d||d.key!==sh.dataset.key||Date.now()-d.at>3*864e5) return;
  Object.entries(d.v).forEach(([id,val])=>{ const el=sh.querySelector("#"+CSS.escape(id)); if(!el) return; if(el.type==="checkbox") el.checked=!!val; else el.value=val; }); }
function draftClear(){ try{ localStorage.removeItem(DRAFT); }catch(_){} }
