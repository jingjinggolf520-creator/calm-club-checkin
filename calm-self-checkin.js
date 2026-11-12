/* CALM CLUB mobile-first staff scanning and one QR code per traveler.
   Uses existing authenticated main Supabase client and existing traveler qr_token.
   Legacy group QR entry is preserved for previously issued group codes. */
(() => {
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search),token=params.get('checkin');
  const key=typeof PUBLIC_KEY==='string'?PUBLIC_KEY:'';
  const say=(s,ok=false)=>{const e=$('calmGuestMessage');if(e){e.textContent=s;e.style.color=ok?'#267548':'#aa443b';}};
  const endpoint=s=>{const u=new URL(s);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('雲端網址不正確');return u.origin;};
  if(token){
    ['setupPanel','loginPanel','userPanel','app','topNotice'].forEach(id=>$(id)?.classList.add('hidden'));
    $('calmGuestPanel')?.classList.remove('hidden');
    const button=$('calmGuestSubmit');button.disabled=true;let client;
    (async()=>{try{
      const url=params.get('endpoint')||(typeof getUrl==='function'?getUrl():'');
      client=window.supabase.createClient(endpoint(url),key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const {data,error}=await client.rpc('calm_guest_info',{p_token:token});
      if(error)throw error;if(!data?.ok)throw Error(data?.message||'QR Code 無效');
      const select=$('calmGuestGroup');select.replaceChildren();const option=document.createElement('option');option.value=data.group_id;option.textContent=data.group_name||'CALM CLUB';select.append(option);
      if(data.open_count===1){button.disabled=false;say('請輸入姓名後按確認報到。',true);}
      else say(data.open_count===0?'目前沒有開放報到的活動。':'目前有多場活動開放，請聯絡領隊。');
    }catch(e){say('無法載入報到資訊：'+e.message);}})();
    button.onclick=async()=>{const name=$('calmGuestName').value.trim().replace(/\s+/g,'');if(!name)return say('請輸入完整中文姓名。');button.disabled=true;
      try{const {data,error}=await client.rpc('calm_guest_checkin_name',{p_token:token,p_name:name});if(error)throw error;say(data?.message||'報到失敗',!!data?.ok);if(data?.ok){button.textContent='報到完成';return;}}
      catch(e){say('報到失敗：'+e.message);}finally{if(button.textContent!=='報到完成')button.disabled=false;}
    };
    return;
  }
  const qrPane=$('qrPane'),scanPane=$('scanPane');
  const qrHeading=qrPane?.querySelector('h2');
  if(qrHeading)qrHeading.textContent='旅客專屬 QR Code';
  const qrIntro=qrPane?.querySelector('p.muted');
  if(qrIntro)qrIntro.textContent='每位旅客一個專屬 QR Code，整趟旅程可重複使用；由領隊或導遊使用手機掃描報到。';
  const qrArea=$('qrCards');
  if(qrArea){qrArea.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;text-align:center';}
  const qrStatus=msg=>{if($('groupQrStatus'))$('groupQrStatus').textContent=msg;};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canvasQR=(canvas,value,size=260)=>new Promise((resolve,reject)=>{
    if(!window.QRCode?.toCanvas)return reject(Error('QR Code 元件未載入，請確認網路'));
    window.QRCode.toCanvas(canvas,value,{width:size,margin:3},e=>e?reject(e):resolve());
  });
  const nameOf=t=>String(t.traveler_name||t.name||'');
  let lastKey='',currentQrs=[];
  async function showQrs(){
    if(typeof db==='undefined'||!db||!groupId){qrStatus('請先登入並選擇團體');return;}
    const list=Array.isArray(travelers)?travelers:[];
    const group=(typeof getGroup==='function'&&getGroup())||{};
    const groupName=group.group_name||group.name||group.tour_name||'CALM CLUB';
    qrArea.replaceChildren();currentQrs=[];
    if(!list.length){qrStatus('目前沒有旅客，請先匯入名單');return;}
    qrStatus('正在產生 '+list.length+' 位旅客的 QR Code…');
    const fragment=document.createDocumentFragment();
    for(const p of list){
      const card=document.createElement('div');card.className='qritem';card.style.cssText='padding:12px;border:1px solid #d6c399;border-radius:12px;break-inside:avoid;background:#fff';
      const heading=document.createElement('div');heading.innerHTML='<strong>'+esc(p.traveler_no||'')+' '+esc(nameOf(p))+'</strong><small style="display:block">'+esc(p.bus_no||p.bus||'')+'</small>';
      card.append(heading);
      const canvas=document.createElement('canvas');canvas.style.display='none';card.append(canvas);const preview=document.createElement('img');preview.alt='旅客專屬 QR Code';preview.style.cssText='display:block;width:220px;max-width:100%;height:auto;margin:8px auto';card.append(preview);
      if(!p.qr_token){const warn=document.createElement('p');warn.textContent='缺少旅客 QR 識別碼，請聯絡管理員';card.append(warn);fragment.append(card);continue;}
      const payload=JSON.stringify({token:p.qr_token,group_id:groupId});
      try{await canvasQR(canvas,payload,220);preview.src=canvas.toDataURL('image/png');}catch(e){const err=document.createElement('p');err.textContent=e.message;card.append(err);}
      const download=document.createElement('button');download.type='button';download.className='secondary noprint';download.textContent='儲存此旅客 QR';
      download.onclick=()=>saveImage(canvas,groupName+'_'+(p.traveler_no||'')+'_'+nameOf(p)+'.png');
      card.append(download);currentQrs.push({canvas,p});fragment.append(card);
    }
    qrArea.append(fragment);
    qrStatus('已產生 '+currentQrs.length+' 位旅客專屬 QR Code。');
  }
  function saveImage(canvas,filename){
    const image=canvas.toDataURL('image/png');
    const a=document.createElement('a');a.href=image;a.download=filename.replace(/[\\/:*?"<>|]/g,'_');document.body.append(a);a.click();a.remove();
    if(/iPhone|iPad|iPod/.test(navigator.userAgent))qrStatus('iPhone 若未自動儲存，可長按 QR 圖片儲存；也可用分享功能。');
  }
  $('makeGroupQr')?.addEventListener('click',showQrs);
  if($('makeGroupQr'))$('makeGroupQr').textContent='產生／顯示全團旅客 QR Code';
  if($('copyGroupLink'))$('copyGroupLink').style.display='none';
  if($('downloadGroupQr')){$('downloadGroupQr').disabled=true;$('downloadGroupQr').style.display='none';}
  // Turn the existing hidden scanner area into a mobile-friendly camera scanner.
  const reader=$('reader'),start=$('startScan'),stop=$('stopScan'),result=$('scanResult');
  const hiddenContainer=start?.parentElement;
  if(hiddenContainer){hiddenContainer.style.display='block';}
  if(start){start.style.display='inline-block';start.textContent='開啟手機相機掃描';}
  if(stop){stop.style.display='inline-block';stop.textContent='停止掃描';}
  if(reader){reader.style.maxWidth='100%';reader.style.width='100%';}
  if(scanPane){
    const tip=document.createElement('p');tip.className='muted';tip.textContent='請由工作人員掃描旅客的專屬 QR Code。需使用 HTTPS 並允許相機權限。';
    scanPane.insertBefore(tip,hiddenContainer||scanPane.firstChild);
  }
  // Override the previous scan handler to accept the existing per-traveler token and verify the group.
  if(start)start.onclick=async()=>{
    if(typeof db==='undefined'||!db)return result.textContent='請先登入';
    if(!groupId||!activityId)return result.textContent='請先選擇團體與活動';
    if(!window.Html5Qrcode)return result.textContent='相機掃描元件尚未載入，請確認網路';
    try{
      if(typeof stopScanner==='function')await stopScanner();
      scanner=new Html5Qrcode('reader');start.disabled=true;
      await scanner.start({facingMode:'environment'},{fps:8,qrbox:{width:220,height:220}},async raw=>{
        if(scanBusy)return;scanBusy=true;
        try{
          const parsed=JSON.parse(raw);
          if(parsed.group_id&&parsed.group_id!==groupId)throw Error('這是其他團體的 QR Code');
          const p=travelers.find(x=>x.qr_token===parsed.token);
          if(!p)throw Error('找不到本團旅客，請確認已選擇正確團體');
          const message=await checkin(p);
          result.textContent=message;
          result.style.color=/失敗|不在|請先/.test(message)?'#aa443b':'#267548';
        }catch(e){result.textContent='掃描失敗：'+e.message;result.style.color='#aa443b';}
        finally{setTimeout(()=>{scanBusy=false;},1200);}
      });
      result.textContent='相機已開啟，請對準旅客 QR Code';
    }catch(e){start.disabled=false;result.textContent='相機啟動失敗：'+e.message;}
  };
  if(stop)stop.onclick=async()=>{if(typeof stopScanner==='function')await stopScanner();if(start)start.disabled=false;result.textContent='已停止掃描';};
  // Main app calls this whenever a group changes. Avoid expensive regeneration on every 5s refresh.
  window.calmAutoShowGroupQr=id=>{
    const paneVisible=qrPane&&!qrPane.classList.contains('hidden');
    const list=typeof travelers!=='undefined'&&Array.isArray(travelers)?travelers:[];
    const next=id+'|'+list.map(p=>p.id+':'+p.qr_token).join(',');
    if(paneVisible&&next!==lastKey){lastKey=next;showQrs();}
  };
  document.querySelector('[data-tab="qrPane"]')?.addEventListener('click',()=>{lastKey='';setTimeout(showQrs,0);});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if(start)start.disabled=false;}));
  // iOS may suspend camera while app is backgrounded: release it on tab/page switch.
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&typeof stopScanner==='function')stopScanner().then(()=>{if(start)start.disabled=false;});});
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
