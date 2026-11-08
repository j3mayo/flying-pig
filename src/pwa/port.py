import re, sys, pathlib, datetime
VERSION = datetime.datetime.now(datetime.timezone.utc).strftime("%Y.%m.%d.%H%M")
D = pathlib.Path(__file__).parent
src = (D.parent/"coach/flying-pig.html").read_text()
plat = (D/"platform.js").read_text()
ICON = "apple-touch-icon.png"

def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count: sys.exit(f"expected {count} of {old[:70]!r}, found {n}")
    src = src.replace(old, new)

head = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Healthspan">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#000000">
<meta name="format-detection" content="telephone=no">
<link rel="apple-touch-icon" href="{ICON}">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
'''
rep('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
src = head + src

css = '''
.auth{position:fixed;inset:0;z-index:50;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px 16px calc(24px + env(safe-area-inset-bottom,0px))}
.auth-in{width:100%;max-width:400px}
.auth-ic{display:block;width:84px;height:84px;border-radius:19px;margin:0 auto 14px;box-shadow:0 4px 16px rgba(0,0,0,.18)}
.auth input{width:100%;border:0;background:transparent;font:inherit;color:var(--label);padding:2px 0;outline:none}
.auth input::placeholder{color:var(--label-2)}
.auth .btn-big{margin-top:14px}
.auth-msg{min-height:20px;color:var(--label-2);font-size:13px;padding:8px 16px 0;text-align:center}
.auth-alt{display:block;margin:16px auto 0;background:none;border:0;color:var(--tint);font-size:15px}
'''
rep('</style>', css + '</style>\n</head><body>')

# load supabase-js + platform layer before the app script
rep('<input type="file" id="fileIn" accept="image/*,application/pdf" multiple hidden>\n',
    '<input type="file" id="fileIn" accept="image/*,application/pdf" multiple hidden>\n'
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n'
    f'<script>window.FP_ICON={ICON!r};\n{plat}</script>\n')

# attachment URLs
src = src.replace('/_blob/${esc(f.id)}', '${esc(FP.blobSrc(f.id))}')
src = src.replace('/_blob/${esc(a.id)}', '${esc(FP.blobSrc(a.id))}')
assert '/_blob/' not in src

# text extraction during attach; wait for it on send
rep('      entry.id=r.id; entry.uploading=false;\n',
    '      entry.id=r.id; entry.uploading=false;\n      entry.ocr=FP.extractText(blob, isPdf).then(t=>{ entry.text=t; }).finally(()=>{ entry.ocr=null; });\n')
rep('''  const id=Date.now().toString(36);
  await save(db.collection("requests").doc(id),''',
'''  const reading=reqDraft.files.filter(f=>f.ocr).map(f=>f.ocr);
  if(reading.length){ toast("Reading your attachment…"); await Promise.race([Promise.all(reading), new Promise(r=>setTimeout(r,45000))]); }
  const id=Date.now().toString(36);
  await save(db.collection("requests").doc(id),''')
rep('attachments:reqDraft.files.map(f=>({id:f.id, name:f.name, type:f.type}))',
    'attachments:reqDraft.files.map(f=>({id:f.id, name:f.name, type:f.type, text:f.text||""}))')

# sign out row on You
rep('''<div class="t">Add a check-in for another day</div></div>${CHEV}</button></div></div>`;''',
    '''<div class="t">Add a check-in for another day</div></div>${CHEV}</button></div></div>
  <div class="sec"><div class="group"><button class="row" type="button" data-act="signout"><div class="main"><div class="t" style="color:var(--bad)">Sign Out</div></div></button></div><div class="foot" style="text-align:center;padding-top:10px">Healthspan · version ${esc(window.FP_VERSION||"")}</div></div>`;''')
rep('liftsheet:()=>liftSheet(a.dataset.day, a.dataset.view==="1"),', 'signout:()=>FP.signOut(), liftsheet:()=>liftSheet(a.dataset.day, a.dataset.view==="1"),')

# boot
rep('''  const c=window.claude; db = c&&c.use ? await c.use("db") : null; if(c&&c.use) c.use("assets").then(a=>{ assets=a; }).catch(()=>{});
  if(!db){ $("#view").innerHTML='<h1 class="large">Today</h1><div class="group"><div class="empty">Your plan can\\'t be reached in this view. Open it from your artifacts while signed in to Claude.</div></div>'; return; }''',
'''  if(!FP.ready){ $("#view").innerHTML='<h1 class="large">Today</h1><div class="group"><div class="empty">Couldn\\'t load. Check your connection and reopen the app.</div></div>'; return; }
  const sess = await FP.session();
  if(!sess){ FP.showAuth(()=>location.reload()); return; }
  db = FP.makeDb(sess.user.id); assets = FP.makeAssets(sess.user.id); FP.onUrl = queue;''')
rep('''  db.doc("settings/goalSuggestions").onSnapshot(d=>{ S.goalSug=d.exists?d.data():null; queue(); },()=>{});
})();''', '''  db.doc("settings/goalSuggestions").onSnapshot(d=>{ S.goalSug=d.exists?d.data():null; queue(); },()=>{});
  db.doc("settings/ptDaily").onSnapshot(d=>{ S.ptDaily=d.exists?d.data():null; queue(); },()=>{});
  db.start();
})();''')

src = src.replace('</body>', '').replace('<div class="foot" style="padding-top:14px">Status compares', '<div class="foot" style="padding-top:14px">Status compares') 
src += '\n<script>window.FP_VERSION="'+VERSION+'";</script>\n<script>if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>{ r.update().catch(()=>{}); document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") r.update().catch(()=>{}); }); }).catch(()=>{}); let fpRel=false; navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(fpRel) return; fpRel=true; if(!document.getElementById("dlg").open) location.reload(); });</script>\n</body></html>\n'
(D/"app.html").write_text(src)

# stamp the service worker cache name so every build invalidates the old shell
sw = D.parent.parent/"sw.js"
sw_src = sw.read_text()
sw_new, n = re.subn(r'const C = "fp-shell-[^"]*";', f'const C = "fp-shell-{VERSION}";', sw_src)
if n != 1: sys.exit("sw.js: cache name constant not found")
sw.write_text(sw_new)
print("ok", len(src), "sw", VERSION)
