
/* CALM CLUB｜一團一碼：旅客只選團、填姓名 */
(() => {
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search),token=params.get('checkin');
  const key=typeof PUBLIC_KEY==='string'?PUBLIC_KEY:'';
  const say=(s,good=false)=>{const e=$('calmGuestMessage');if(e){e.textContent=s;e.style.color=good?'#267548':'#aa443b';}};
  const endpoint=s=>{const u=new URL(s);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('雲端連線網址不正確');return u.origin;};
  if(token){
    ['setupPanel','loginPanel','userPanel','app','topNotice'].forEach(id=>$(id)?.classList.add('hidden'));
    $('calmGuestPanel')?.classList.remove('hidden');
    const button=$('calmGuestSubmit');button.disabled=true;
    let client;
    (async()=>{
      try{
        client=window.supabase.createClient(endpoint(params.get('endpoint')) ,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        const {data,error}=await client.rpc('calm_guest_info',{p_token:token});
        if(error)throw error;
        if(!data?.ok)throw Error(data?.message||'QR Code 無效');
        const selector=$('calmGuestGroup');selector.replaceChildren();
        const opt=document.createElement('option');opt.value=data.group_id;opt.textContent=data.group_name||'CALM CLUB';selector.append(opt);
        if(data.open_count===1){button.disabled=false;say('請輸入姓名後按「確認報到」。',true);}
        else if(data.open_count===0)say('目前沒有開放報到的活動，請等待領隊開始報到。');
        else say('目前有多場活動同時開放，請通知領隊先保留一場開放報到。');
      }catch(e){say('無法載入報到資訊：'+e.message);}
    })();
    button.onclick=async()=>{
      const name=$('calmGuestName').value.trim().replace(/\s+/g,'');
      if(!name)return say('請輸入完整中文姓名。');
      button.disabled=true;
      try{
        const {data,error}=await client.rpc('calm_guest_checkin_name',{p_token:token,p_name:name});
        if(error)throw error;
        say(data?.message||'報到失敗',!!data?.ok);
        if(data?.ok){button.textContent='報到完成';return;}
      }catch(e){say('報到失敗：'+e.message);}finally{if(button.textContent!=='報到完成')button.disabled=false;}
    };
    return;
  }
  let currentLink='';
  let currentCanvas=null;
  let currentGroupName='CALM CLUB';
  const qrStatus=message=>{if($('groupQrStatus'))$('groupQrStatus').textContent=message;};
  const qrFileName=()=>((currentGroupName||'CALM_CLUB').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,65)||'CALM_CLUB')+'_QR_Code.png';
  const renderQr=(canvas,link)=>new Promise((resolve,reject)=>{
    if(!window.QRCode||typeof QRCode.toCanvas!=='function')return reject(Error('QR Code 圖片元件未載入，請重新整理網頁'));
    QRCode.toCanvas(canvas,link,{width:320,margin:3},err=>err?reject(err):resolve());
  });
  const imageBlob=canvas=>new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error('圖片轉換失敗')),'image/png');
  });
  const downloadQr=async()=>{
    if(!currentCanvas||!currentLink){qrStatus('請先產生團體 QR Code');return;}
    const button=$('downloadGroupQr');if(button)button.disabled=true;
    try{
      const blob=await imageBlob(currentCanvas);
      const name=qrFileName();
      const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
      if(isiOS&&navigator.share&&navigator.canShare){
        const file=new File([blob],name,{type:'image/png'});
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:currentGroupName+' QR Code'});
          qrStatus('已開啟分享選單，可選擇「儲存影像」或「儲存到檔案」');
          return;
        }
      }
      const objectUrl=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=objectUrl;a.download=name;
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
      qrStatus(isiOS?'已嘗試下載圖片；若未儲存，請長按 QR Code 圖片選擇儲存':'已下載本團 QR Code PNG 圖片');
    }catch(e){if(e.name==='AbortError')qrStatus('已取消分享');else qrStatus('下載失敗：'+e.message);}
    finally{if(button)button.disabled=false;}
  };
  $('downloadGroupQr')?.addEventListener('click',downloadQr);

  $('makeGroupQr')?.addEventListener('click',async()=>{
    try{
      if(typeof db==='undefined'||!groupId)throw Error('請先登入並選擇團體');
      const {data,error}=await db.rpc('calm_group_qr',{p_group_id:groupId});
      if(error)throw error;
      if(!data?.token)throw Error('無法取得團體 QR Code');
      const url=new URL(location.href);url.search='';url.hash='';
      url.searchParams.set('checkin',data.token);
      url.searchParams.set('endpoint',endpoint((typeof getUrl==='function'&&getUrl())||(typeof db!=='undefined'&&db&&db.supabaseUrl)||localStorage.getItem('calm_supabase_url')||''));
      currentLink=url.href;
      const area=$('qrCards');area.replaceChildren();
      const h=document.createElement('h3');h.textContent=data.group_name||'CALM CLUB';area.append(h);
      const canvas=document.createElement('canvas');area.append(canvas);
      currentCanvas=null;
      if($('downloadGroupQr'))$('downloadGroupQr').disabled=true;
      await renderQr(canvas,currentLink);
      currentCanvas=canvas;
      currentGroupName=data.group_name||'CALM CLUB';
      if($('downloadGroupQr'))$('downloadGroupQr').disabled=false;
      const img=document.createElement('img');
      img.src=canvas.toDataURL('image/png');img.alt=currentGroupName+' QR Code';
      img.style.cssText='max-width:100%;width:320px;height:auto;display:block;margin:0 auto';
      canvas.replaceWith(img);
      const p=document.createElement('p');p.textContent='本團整趟行程共用同一個 QR Code。手機可長按圖片儲存。';area.append(p);
      qrStatus('已顯示團體 QR Code，可下載 PNG 圖片');
    }catch(e){$('groupQrStatus').textContent='產生失敗：'+e.message;}
  });
  $('copyGroupLink')?.addEventListener('click',async()=>{
    if(!currentLink){$('groupQrStatus').textContent='請先產生團體 QR Code';return;}
    try{await navigator.clipboard.writeText(currentLink);$('groupQrStatus').textContent='已複製報到連結';}
    catch{$('groupQrStatus').textContent='複製失敗，請使用 HTTPS 網站';}
  });
})();

/* CALM CLUB offline-first check-in extension. No database schema changes.
   Requires the existing authenticated app and activity membership list to be loaded once online. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORE = 'calm-club-offline-v1';
  const DB_VERSION = 1;
  let flushing = false;
  let lastError = '';
  let cacheGroup = '';
  const openDb = () => new Promise((resolve,reject) => {
    const req = indexedDB.open(STORE,DB_VERSION);
    req.onupgradeneeded = () => {
      const db=req.result;
      if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'key'});
      if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  async function tx(store,mode,action){
    const d=await openDb();
    try{return await new Promise((resolve,reject)=>{
      const t=d.transaction(store,mode), s=t.objectStore(store);
      const r=action(s);
      let result;
      r.onsuccess=()=>{result=r.result;};
      r.onerror=()=>reject(r.error);
      t.oncomplete=()=>resolve(result);
      t.onerror=()=>reject(t.error);
      t.onabort=()=>reject(t.error);
    });}finally{d.close();}
  }
  const put=(s,v)=>tx(s,'readwrite',o=>o.put(v));
  const del=(s,k)=>tx(s,'readwrite',o=>o.delete(k));
  const get=(s,k)=>tx(s,'readonly',o=>o.get(k));
  const all=s=>tx(s,'readonly',o=>o.getAll());
  const uid=()=>String(window.calmCurrentUserId||'');
  const currentGroup=()=>typeof groupId==='string'?groupId:'';
  const currentActivity=()=>typeof activityId==='string'?activityId:'';
  const key=(u,g,a,t)=>[u,g,a,t].join('|');
  const netError=e=> !navigator.onLine || /network|fetch|failed to fetch|load failed|timeout|connection|offline/i.test(String(e?.message||e));
  function panel(){
    let el=$('calmOfflineBanner');if(el)return el;
    const app=$('app');if(!app)return null;
    el=document.createElement('div');el.id='calmOfflineBanner';el.setAttribute('role','status');
    el.style.cssText='position:sticky;top:0;z-index:50;padding:11px 14px;margin:8px 0;border-radius:10px;border:1px solid #c6d8ce;background:#f0f7f2;color:#214936;font-size:14px;line-height:1.5';
    el.innerHTML='<span id="calmOfflineText">離線報到準備中</span> <button id="calmSyncNow" type="button" style="margin-left:8px;padding:6px 10px">立即同步</button>';
    app.prepend(el);
    $('calmSyncNow').onclick=()=>flush();return el;
  }
  async function update(){
    const el=panel();if(!el)return;
    let n=0;try{n=(await all('queue')).filter(x=>x.user_id===uid()).length;}catch(e){lastError='手機無法儲存離線資料：'+e.message;}
    const online=navigator.onLine;
    el.style.background=online?'#f0f7f2':'#fff3d9';
    $('calmOfflineText').textContent=(online?'網路已連線':'目前離線')+'｜待同步 '+n+' 筆'+(lastError?'｜'+lastError:'');
    $('calmSyncNow').disabled=!online||!n||flushing;
  }
  async function snapshot(){
    const u=uid(),g=currentGroup();if(!u||!g||!navigator.onLine)return;
    if(typeof travelers==='undefined'||typeof activities==='undefined')return;
    const data={key:u+'|'+g,user_id:u,group_id:g,at:Date.now(),travelers:[...travelers],activities:[...activities],members:[...members],checkins:[...checkins]};
    await put('snapshots',data);cacheGroup=g;update();
  }
  async function offlineSnapshot(){
    const u=uid(),g=currentGroup();if(!u||!g)return false;
    const s=await get('snapshots',u+'|'+g);if(!s)return false;
    travelers=s.travelers;activities=s.activities;members=s.members;checkins=s.checkins;
    if(!activities.some(x=>x.id===activityId))activityId=activities[0]?.id||'';
    await applyPending();render();
    const e=$('loadStatus');if(e)e.textContent='目前使用手機離線名單（上次同步：'+new Date(s.at).toLocaleString('zh-TW')+'）';
    return true;
  }
  async function applyPending(){
    const u=uid(),g=currentGroup();if(!u||!g)return;
    const pending=(await all('queue')).filter(x=>x.user_id===u&&x.group_id===g);
    for(const x of pending){
      if(!checkins.some(c=>c.activity_id===x.activity_id&&c.traveler_id===x.traveler_id))
        checkins.push({group_id:g,activity_id:x.activity_id,traveler_id:x.traveler_id,checked_in_at:x.created_at,calm_pending:true});
    }
  }
  async function queue(p){
    const u=uid(),g=currentGroup(),a=currentActivity();
    if(!u||!g||!a)throw Error('請先在線上登入並選擇團體與活動');
    if(!Array.isArray(members)||!members.some(m=>m.activity_id===a&&m.traveler_id===p.id&&m.is_participating!==false))
      throw Error('旅客不在本活動名單，不能離線報到');
    const k=key(u,g,a,p.id);
    const existing=await get('queue',k);
    if(existing)return '此旅客已離線報到，等待同步';
    const at=new Date().toISOString();
    await put('queue',{key:k,user_id:u,group_id:g,activity_id:a,traveler_id:p.id,created_at:at});
    if(!checkins.some(c=>c.activity_id===a&&c.traveler_id===p.id))
      checkins.push({group_id:g,activity_id:a,traveler_id:p.id,checked_in_at:at,calm_pending:true});
    render();await update();
    return (p.name||p.traveler_name||'旅客')+' 已離線記錄（待同步）';
  }
  async function flush(){
    if(flushing||!navigator.onLine||typeof db==='undefined'||!db||!uid())return;
    flushing=true;lastError='';await update();
    try{
      const {data:auth,error:authError}=await db.auth.getSession();
      if(authError||!auth?.session?.access_token)throw Error('登入已過期，請重新登入再同步');
      const pending=(await all('queue')).filter(x=>x.user_id===uid());
      for(const x of pending){
        try{
          const {data:existing,error:readError}=await db.from('checkins').select('traveler_id').eq('group_id',x.group_id).eq('activity_id',x.activity_id).eq('traveler_id',x.traveler_id).limit(1);
          if(readError)throw readError;
          if(!existing?.length){
            const {error}=await db.from('checkins').insert({group_id:x.group_id,activity_id:x.activity_id,traveler_id:x.traveler_id});
            if(error){
              // A concurrent device may have checked in the same traveler; verify before discarding.
              const {data:again,error:recheckError}=await db.from('checkins').select('traveler_id').eq('group_id',x.group_id).eq('activity_id',x.activity_id).eq('traveler_id',x.traveler_id).limit(1);
              if(recheckError||!again?.length)throw error;
            }
          }
          await del('queue',x.key);
        }catch(e){lastError=netError(e)?'網路不穩，稍後重試':'同步失敗：'+e.message;break;}
      }
      if(!lastError&&currentGroup()){
        try{await loadActivity();}catch(e){lastError=e.message;}
      }
    }catch(e){lastError=e.message;}
    finally{flushing=false;await update();}
  }
  const originalCheckin=typeof checkin==='function'?checkin:null;
  if(originalCheckin){
    checkin=async p=>{
      if(!p)return '請先選擇旅客';
      if(!currentActivity())return '請先選擇活動';
      if(!Array.isArray(members)||!members.some(m=>m.activity_id===currentActivity()&&m.traveler_id===p.id&&m.is_participating!==false))return '此旅客不在本活動名單';
      if(checkins.some(c=>c.activity_id===currentActivity()&&c.traveler_id===p.id))return (p.name||p.traveler_name)+' 已報到';
      if(!navigator.onLine){try{return await queue(p);}catch(e){return '離線儲存失敗：'+e.message;}}
      try{
        const message=await originalCheckin(p);
        if(/^報到失敗：/.test(message)&&netError(message))return await queue(p);
        if(/報到成功/.test(message))snapshot().catch(()=>{});
        return message;
      }catch(e){if(netError(e)){try{return await queue(p);}catch(q){return '離線儲存失敗：'+q.message;}}return '報到失敗：'+e.message;}
    };
  }
  const originalLoadTour=typeof loadTour==='function'?loadTour:null;
  if(originalLoadTour)loadTour=async(...args)=>{
    if(!navigator.onLine){if(await offlineSnapshot())return;}
    await originalLoadTour(...args);
    if(navigator.onLine&&Array.isArray(travelers)&&travelers.length){await applyPending();render();await snapshot().catch(()=>{});}
  };
  const originalLoadActivity=typeof loadActivity==='function'?loadActivity:null;
  if(originalLoadActivity)loadActivity=async(...args)=>{
    if(!navigator.onLine){if(await offlineSnapshot())return;}
    await originalLoadActivity(...args);
    if(navigator.onLine&&Array.isArray(members)){await applyPending();render();await snapshot().catch(()=>{});}
  };
  window.addEventListener('online',()=>{update();flush();});
  window.addEventListener('offline',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){update();if(navigator.onLine)flush();}});
  document.addEventListener('click',e=>{if(e.target.closest?.('#refreshBtn'))setTimeout(()=>{snapshot().catch(()=>{});flush();},1200);});
  setInterval(()=>{if(navigator.onLine)flush();else update();},20000);
  panel();update();
  window.calmOffline={sync:flush,save:snapshot,status:update};
})();
