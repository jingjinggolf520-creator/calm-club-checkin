/* CALM CLUB | 一團一碼旅客自行報到，搭配 calm-self-checkin.sql */
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const token = params.get('checkin');
  const key = typeof PUBLIC_KEY === 'string' ? PUBLIC_KEY : '';
  const say = (id, value, good=false) => { const el=$(id);if(el){el.textContent=value;el.style.color=good?'#267548':'#aa443b';} };
  const normalizeUrl = s => {try {const u=new URL(s);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error();return u.origin;}catch{throw Error('Supabase 連線網址無效');}};
  if (token) {
    // 旅客端只使用公開 anon RPC，絕不取得工作人員帳號或旅客名單
    document.querySelector('header .brand > div > div').textContent='旅客自行報到';
    ['setupPanel','loginPanel','userPanel','app','topNotice'].forEach(id=>$(id)?.classList.add('hidden'));
    $('calmGuestPanel')?.classList.remove('hidden');
    const url = params.get('endpoint');
    let client, activities=[];
    (async()=>{
      try {
        client=window.supabase.createClient(normalizeUrl(url),key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        const {data,error}=await client.rpc('calm_guest_info',{p_token:token});
        if(error)throw error;
        if(!data||!data.ok)throw Error(data?.message||'團體 QR Code 無效');
        $('calmGuestTour').textContent=data.group_name||'CALM CLUB';
        activities=data.activities||[];
        $('calmGuestActivity').innerHTML='';
        for(const a of activities){const option=document.createElement('option');option.value=a.id;option.textContent=(a.activity_date||'')+'｜'+(a.activity_name||'活動');$('calmGuestActivity').append(option);}
        if(!activities.length){$('calmGuestSubmit').disabled=true;say('calmGuestMessage','目前沒有開放報到的活動，請等待領隊開始報到。');}
      }catch(e){$('calmGuestSubmit').disabled=true;say('calmGuestMessage','無法載入報到資訊：'+e.message);}
    })();
    $('calmGuestSubmit').onclick=async()=>{
      const name=$('calmGuestName').value.trim().replace(/\s+/g,''),no=$('calmGuestNo').value.trim(),activity=$('calmGuestActivity').value;
      if(!name||!no||!activity)return say('calmGuestMessage','請填寫姓名、旅客編號並選擇活動。');
      const button=$('calmGuestSubmit');button.disabled=true;
      try {
        const {data,error}=await client.rpc('calm_guest_checkin',{p_token:token,p_name:name,p_traveler_no:no,p_activity_id:activity});
        if(error)throw error;
        say('calmGuestMessage',data?.message||'報到失敗',!!data?.ok);
        if(data?.ok){button.textContent='已完成報到';return;}
      }catch(e){say('calmGuestMessage','報到失敗：'+e.message);}finally{if(button.textContent!=='已完成報到')button.disabled=false;}
    };
    return;
  }
  // 管理員端：沿用既有登入，團體 QR 由登入後 RPC 發放，無法在前端偽造 token
  let currentLink='';
  const make = async()=>{
    try {
      if(typeof db === "undefined"||!groupId)throw Error('請先登入並選擇團體');
      const {data,error}=await db.rpc('calm_group_qr',{p_group_id:groupId});
      if(error)throw error;
      if(!data?.token)throw Error('無法取得團體 QR Token');
      const endpoint=normalizeUrl(localStorage.getItem('calm_supabase_url')||'');
      const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('checkin',data.token);url.searchParams.set('endpoint',endpoint);
      currentLink=url.href;
      const el=$('qrCards');el.replaceChildren();
      const title=document.createElement('h3');title.textContent=data.group_name||'CALM CLUB';el.append(title);
      const canvas=document.createElement('canvas');el.append(canvas);
      if(!window.QRCode)throw Error('QR Code 套件未載入');
      QRCode.toCanvas(canvas,currentLink,{width:260,margin:3},e=>{if(e)say('groupQrStatus','QR 產生失敗：'+e.message);});
      const p=document.createElement('p');p.textContent='同一團體整趟旅程使用這個 QR Code';el.append(p);
      say('groupQrStatus','QR Code 已產生。請先完成 SQL 安裝與手機實測，再提供給旅客。',true);
    }catch(e){say('groupQrStatus','無法產生：'+e.message+'。請先在 Supabase 執行配套 SQL。');}
  };
  $('makeGroupQr')?.addEventListener('click',make);
  $('copyGroupLink')?.addEventListener('click',async()=>{
    if(!currentLink)return say('groupQrStatus','請先產生團體 QR Code');
    try{await navigator.clipboard.writeText(currentLink);say('groupQrStatus','已複製旅客報到連結',true);}catch{say('groupQrStatus','無法自動複製，請使用 HTTPS 網站操作');}
  });
})();
