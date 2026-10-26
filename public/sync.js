(() => {
 const scripts=document.currentScript.dataset.scripts.split(',');
 const keys={'benjiFitness.v1':'fitness','dailyPlate.v1':'nutrition'};
 let user=null,records={},pending={},blocked=false,running=false,status='Checking cloud saving…';
 const bar=document.createElement('div');bar.className='cloudbar';bar.innerHTML='<span id="cloudStatus" role="status"></span><div id="cloudActions"></div>';
 const style=document.createElement('style');style.textContent='.cloudbar{padding:12px 18px;margin:0 0 20px;border:1px solid #ced8c6;border-radius:12px;background:#eef3e6;color:#31462c;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font:13px/1.5 system-ui}.cloudbar button,.cloudbar a{display:inline-block;font:inherit;color:#31462c;background:white;border:1px solid #c5d0bf;border-radius:6px;padding:6px 10px;margin:3px;text-decoration:none;cursor:pointer}';document.head.append(style);document.querySelector('main').prepend(bar);
 const note=()=>{document.querySelector('#cloudStatus').textContent=status;for(const id of ['saved','storageNote']){const e=document.getElementById(id);if(e)e.textContent=status;}};
 const prefix=()=>`dailyPlate.cloud.${user}.`;
 let cacheAvailable=true;
 const cache=()=>{try{if(user)localStorage.setItem(prefix()+'cache',JSON.stringify({records,pending}));cacheAvailable=true;}catch{cacheAvailable=false;}};
 const getLocal=k=>{try{return localStorage.getItem(k)}catch{return null}};
 const parse=s=>{try{return JSON.parse(s)}catch{return null}};
 const action=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;document.querySelector('#cloudActions').append(b);};
 function backup(browserOnly=false){const value={version:1,fitness:!browserOnly&&user?records.fitness?.value??null:parse(getLocal('benjiFitness.v1')),nutrition:!browserOnly&&user?records.nutrition?.value??null:parse(getLocal('dailyPlate.v1'))};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=browserOnly?'daily-plate-browser-backup.json':'daily-plate-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function actions(){const el=document.querySelector('#cloudActions');el.replaceChildren();
  if(!user){const a=document.createElement('a');a.textContent='Sign in to save across devices';a.href='/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.search);a.target='_top';el.append(a);action('Retry connection',()=>location.reload());return;}
  if(Object.keys(keys).some(k=>getLocal(k)))action('Import browser data',async()=>{
   if(blocked||running)return alert('Wait for saving to finish and resolve any sync conflict first.');
   const imports={};let conflicts=0;
   try{for(const [key,kind] of Object.entries(keys)){const local=parse(getLocal(key));if(local){const merged=PlateMerge(kind,records[kind]?.value,local);imports[kind]=merged.value;conflicts+=merged.conflicts;}}}catch{return alert('Could not read these browser records. Download the browser backup to keep them.');}
   if(!confirm(conflicts?`Add missing browser records to your account? ${conflicts} overlapping values differ: account values will stay unchanged. Your original browser records will be kept and can be downloaded separately.`:'Add this browser’s saved records to your private account? Existing account records and original browser data will be kept.'))return;
   for(const [kind,value] of Object.entries(imports)){records[kind]={value,revision:records[kind]?.revision||0};pending[kind]=true;}cache();await flush();if(!blocked&&!Object.values(pending).some(Boolean))location.reload();
  });
  if(Object.keys(keys).some(k=>getLocal(k)))action('Download browser backup',()=>backup(true));
  action('Download backup',()=>backup());action('Retry save',()=>{if(blocked){alert('Download a backup, then use Reload cloud to resolve the conflict.');return;}flush();});
  action('Reload cloud',()=>{if(Object.values(pending).some(Boolean)&&!confirm('Discard unsynced changes on this device and load the latest cloud records? Download a backup first to keep your changes.'))return;localStorage.removeItem(prefix()+'cache');location.reload();});
  const a=document.createElement('a');a.textContent='Sign out';a.target='_top';a.href='/signout-with-chatgpt?return_to='+encodeURIComponent(location.pathname);a.onclick=e=>{if(Object.values(pending).some(Boolean)&&!confirm('Some edits have not reached the cloud. Sign out anyway? They stay cached for this account on this browser.'))e.preventDefault();};el.append(a);
 }
 async function flush(){if(!user||blocked||running)return;running=true;
  try{while(Object.values(pending).some(Boolean)){for(const kind of ['fitness','nutrition']){while(pending[kind]){
   const value=JSON.stringify(records[kind].value),revision=records[kind].revision;
   status='Saving to your account…';note();
   const r=await fetch('/api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user,kind,revision,value:JSON.parse(value)}),signal:AbortSignal.timeout(15000)});
   if(!r.ok){if(r.status===409){blocked=true;status='Sync conflict — download a backup, then reload cloud.';}else if(r.status===401||r.status===403){blocked=true;status='Sign-in changed or expired — download a backup, then reload.';}else if(r.status===400||r.status===413){status='Could not save this data. Download a backup to keep it.';}else status=cacheAvailable?'Cloud unavailable — edits cached here. Retry when online.':'Cloud unavailable — keep this tab open and download a backup.';note();return;}
   records[kind].revision=(await r.json()).revision;
   if(JSON.stringify(records[kind].value)===value)pending[kind]=false;cache();
  }}}status='Saved to your account';note();
  }catch{status=cacheAvailable?'Offline — edits cached here. Retry when online.':'Offline — keep this tab open and download a backup.';note();}finally{running=false;}
 }
 window.PlateStorage={getItem(key){if(!user)return getLocal(key);const r=records[keys[key]];return r?JSON.stringify(r.value):null;},setItem(key,text){if(!user){localStorage.setItem(key,text);status='Saved on this browser · Sign in for cloud saving';note();return;}const kind=keys[key];if(!kind)return;const value=JSON.parse(text);if(JSON.stringify(records[kind]?.value)===JSON.stringify(value))return;records[kind]={value,revision:records[kind]?.revision||0};pending[kind]=true;cache();flush();}};
 window.PlateCloud={refreshStatus:note};
 async function start(){
  try{const r=await fetch('/api/progress',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(r.ok){const cloud=await r.json();user=cloud.userId;records=cloud.records;const cached=parse(getLocal(prefix()+'cache'));
    if(cached?.records&&cached?.pending)for(const kind of ['fitness','nutrition']){if(cached.pending[kind]&&cached.records[kind]){if((cloud.records[kind]?.revision||0)!==cached.records[kind].revision)blocked=true;records[kind]=cached.records[kind];pending[kind]=true;}}
    status=blocked?'Sync conflict — download a backup, then reload cloud.':Object.keys(keys).some(k=>getLocal(k))?'Private sync connected · Use Import browser data to bring across existing logs.':'Private sync connected';cache();
   }else if(r.status===401)status='Browser mode · Sign in for cloud saving';else status='Cloud unavailable · Using browser data';
  }catch{status='Cannot connect · Using browser data';}
  actions();note();
  for(const src of scripts){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});}
  if(user&&!blocked&&Object.values(pending).some(Boolean))flush();note();
 }
 window.addEventListener('online',()=>user?flush():location.reload());
 window.addEventListener('beforeunload',e=>{if(running||Object.values(pending).some(Boolean)){e.preventDefault();e.returnValue='';}});
 window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
 start().catch(()=>{status='Could not load the app. Please reload.';note();});
})();
