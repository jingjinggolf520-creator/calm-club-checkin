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
      QRCode.toCanvas(canvas,currentLink,{width:260,margin:3},err=>{if(err)$('groupQrStatus').textContent=err.message;});
      const p=document.createElement('p');p.textContent='本團整趟行程共用同一個 QR Code';area.append(p);
      $('groupQrStatus').textContent='已顯示團體 QR Code';
    }catch(e){$('groupQrStatus').textContent='產生失敗：'+e.message;}
  });
  $('copyGroupLink')?.addEventListener('click',async()=>{
    if(!currentLink){$('groupQrStatus').textContent='請先產生團體 QR Code';return;}
    try{await navigator.clipboard.writeText(currentLink);$('groupQrStatus').textContent='已複製報到連結';}
    catch{$('groupQrStatus').textContent='複製失敗，請使用 HTTPS 網站';}
  });
})();
