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
      url.searchParams.set('endpoint',endpoint(localStorage.getItem('calm_supabase_url')||''));
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
      // iPhone 可長按圖片儲存；canvas 轉圖片以支援 Safari。
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
