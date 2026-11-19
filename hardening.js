/* hardening.js: data safety, accessibility, disclaimer and iPhone hint for Land Check. Loaded after the main script. */
(function(){
"use strict";
try{
var LAST="landcheck.lastBackup",SNAP="landcheck.prerestore",HINT="landcheck.iosHintSeen";
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function standalone(){return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}

/* Ask the browser to keep this app's storage (helps against iOS eviction). */
if(standalone()&&navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(function(){})}

/* Visible keyboard focus. */
var st=document.createElement("style");
st.textContent="button:focus-visible,summary:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid currentColor;outline-offset:2px}";
document.head.appendChild(st);

/* Screen reader hints. */
var to=document.getElementById("toast");if(to){to.setAttribute("role","status");to.setAttribute("aria-live","polite")}
["pick","res","fmap"].forEach(function(id){var s=document.getElementById(id);if(s){s.setAttribute("role","dialog");s.setAttribute("aria-modal","true")}});

/* One entry, cleaned: whitelisted fields only, no markup characters. */
var ID=/^[A-Za-z0-9_-]{1,40}$/,UNSAFE=/[<>"'&\x60\\]/;
function cleanEntry(e,strict,i){
if(!e||typeof e!=="object")return null;
var n=typeof e.n==="string"?e.n:"";
if(!n||n.length>80||UNSAFE.test(n))return null;
if(strict&&!byName[n])return null;
if(e.m!=="buy"&&e.m!=="sell")return null;
var t=+e.t,maxT=Date.now()+31536e6;
if(!isFinite(t)||t<=0||t>maxT)return null;
var o={id:ID.test(String(e.id))?String(e.id):"r"+Date.now().toString(36)+i,t:t,n:n,m:e.m};
if(e.a==="yes"||e.a==="no"||e.a==="wait")o.a=e.a;
var at=+e.at;
if(e.at!==undefined&&isFinite(at)&&at>0&&at<=maxT)o.at=at;
if(e.s)o.s=1;
return o;
}

/* Clean what is already stored. */
if(db&&Array.isArray(db.entries)){
var before=JSON.stringify(db.entries);
var cleaned=db.entries.map(function(e,i){return cleanEntry(e,false,i)}).filter(Boolean);
if(JSON.stringify(cleaned)!==before){db.entries=cleaned;save();render()}
}

function fail(msg){var e=new Error(msg);e.hx=1;return e}
function stamp(){lsSet(LAST,String(Date.now()));refresh()}

/* Backup: same file format, local-date name, remembers when it was made. */
window.backup=async function(){
var d=new Date(),p=function(n){return String(n).padStart(2,"0")};
var name="land-check-backup-"+d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+".json";
var txt=JSON.stringify({app:"landcheck",v:1,saved:d.toISOString(),entries:db.entries},null,1);
var file=new File([txt],name,{type:"application/json"});
try{
if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});stamp();return}
}catch(e){if(e&&e.name==="AbortError")return}
var a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();
setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
stamp();toast("Backup saved");
};
var bk=document.getElementById("bk");
if(bk)bk.onclick=window.backup;

/* Restore: validate, preview, snapshot for undo, then merge new checks in. */
var old=document.getElementById("file");
var inp=old.cloneNode(true);
old.parentNode.replaceChild(inp,old);
var rs=document.getElementById("rs");
if(rs)rs.onclick=function(){inp.click()};
inp.addEventListener("change",function(ev){
var f=ev.target.files[0];if(!f)return;
if(f.size>5e6){toast("That file is too big to be a backup. Nothing was changed.");inp.value="";return}
var r=new FileReader();
r.onload=function(){
var fresh,skipped;
try{
var d;
try{d=JSON.parse(r.result)}catch(x){throw fail("Import failed: this isn't a Land Check backup.")}
if(!d||d.app!=="landcheck"||!Array.isArray(d.entries))throw fail("Import failed: this isn't a Land Check backup.");
if(typeof d.v==="number"&&d.v>1)throw fail("Import failed: this backup is from a newer version of the app.");
var ok=d.entries.slice(0,5000).map(function(e,i){return cleanEntry(e,true,i)}).filter(Boolean);
var seen={};db.entries.forEach(function(e){seen[e.id]=1});
fresh=[];skipped=0;
ok.forEach(function(e){if(seen[e.id]){skipped++}else{seen[e.id]=1;fresh.push(e)}});
}catch(e){toast(e&&e.hx?e.message+" Nothing was changed.":"Import failed. Nothing was changed.");inp.value="";return}
if(!fresh.length){toast("Nothing new in this backup. Nothing was changed.");inp.value="";return}
if(db.entries.length+fresh.length>5000){toast("Too many checks to add. Nothing was changed.");inp.value="";return}
var msg="Add "+fresh.length+" checks from this backup?\n\n"+skipped+" already here and skipped.\nYour current data is saved first, so you can undo.";
if(!confirm(msg)){inp.value="";return}
if(!lsSet(SNAP,JSON.stringify({savedAt:Date.now(),entries:db.entries}))){toast("Not enough space to keep an undo copy. Nothing was changed.");inp.value="";return}
db.entries=db.entries.concat(fresh);save();render();
toast(fresh.length+" checks restored");
inp.value="";
};
r.readAsText(f);
});
function undo(){
var raw=lsGet(SNAP),list;
try{list=JSON.parse(raw).entries}catch(e){list=null}
if(!Array.isArray(list)){toast("Nothing to undo");refresh();return}
if(!confirm("Go back to the checks you had before the last restore?"))return;
db.entries=list;save();try{localStorage.removeItem(SNAP)}catch(e){}
render();toast("Restore undone");
}

/* Screen additions: backup status, undo, nudge, iPhone hint, disclaimer. */
var row=bk?bk.parentElement:null;
var ub=document.createElement("button");ub.id="hxUndo";ub.type="button";ub.className="btn";ub.textContent="Undo last restore";ub.style.display="none";ub.style.marginTop="8px";
ub.addEventListener("click",undo);
var info=document.createElement("div");info.id="hxInfo";info.className="mu";info.style.marginTop="8px";
if(row&&row.parentNode){row.parentNode.insertBefore(ub,row.nextSibling);row.parentNode.insertBefore(info,ub.nextSibling)}

var today=document.getElementById("today");
var ios=document.createElement("div");ios.id="hxIos";
var nudge=document.createElement("div");nudge.id="hxNudge";
if(today){today.insertBefore(nudge,today.firstChild);today.insertBefore(ios,today.firstChild)}

function banner(text,label,onClick){
var b=document.createElement("div");b.className="card";b.style.marginBottom="12px";
var s=document.createElement("div");s.className="mu";s.textContent=text;s.style.marginBottom="8px";
var btn=document.createElement("button");btn.type="button";btn.className="btn";btn.textContent=label;btn.addEventListener("click",onClick);
b.appendChild(s);b.appendChild(btn);return b;
}
function daysSince(){var t=+lsGet(LAST);return t?Math.floor((Date.now()-t)/864e5):null}
function refresh(){
var n=daysSince();
var real=(db&&db.entries?db.entries:[]).filter(function(e){return !e.s}).length;
nudge.textContent="";
if(real>=3&&(n===null||n>=7)){
nudge.appendChild(banner(n===null?"You haven't saved a backup yet.":"Last backup "+n+" days ago.","Back up now",function(){window.backup()}));
}
info.textContent=n===null?"No backup saved yet.":n===0?"Last backup: today.":"Last backup: "+n+" day"+(n===1?"":"s")+" ago.";
ub.style.display=lsGet(SNAP)?"block":"none";
}
var isIos=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
if(isIos&&!standalone()&&!lsGet(HINT)){
ios.appendChild(banner("On iPhone: tap Share, then Add to Home Screen. Checks made in a Safari tab will not carry over.","Got it",function(){lsSet(HINT,"1");ios.textContent=""}));
}

/* Disclaimer under every result, and on Numbers. */
var DISC="A guide, not legal advice. Prices are rough estimates, not valuations. Before paying, verify files and ownership with the CDA, RDA or the society office, and a lawyer.";
function note(id){var d=document.createElement("div");d.id=id;d.className="mu";d.style.cssText="margin-top:14px;font-size:12px;line-height:1.4";d.textContent=DISC;return d}
var rb=document.getElementById("resBody");
if(rb&&rb.parentNode)rb.parentNode.insertBefore(note("hxDisc"),rb.nextSibling);
var nm=document.getElementById("numbers");
if(nm)nm.appendChild(note("hxDisc2"));

var ra=window.render;
if(typeof ra==="function"){window.render=function(){var r=ra.apply(this,arguments);refresh();return r}}
refresh();
}catch(err){try{console.error("hardening.js",err)}catch(e){}}
})();
