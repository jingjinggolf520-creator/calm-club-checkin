/* CALM CLUB mobile activity controls: reuse main authenticated Supabase client. */
(() => {
  const $ = id => document.getElementById(id);
  const select = $('activitySelect');
  if (!select) return;
  const panel = document.createElement('div');
  panel.style.cssText = 'margin:14px 0;padding:16px;border:1px solid #dce6df;border-radius:12px;background:#f7faf7';
  panel.innerHTML = '<strong>本場活動報到控制</strong><p id="calmActivityStatus" role="status">登入後讀取活動狀態</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button id="calmStartCheckin" type="button" disabled>開始報到</button><button id="calmEndCheckin" type="button" class="secondary" disabled>結束本場報到</button></div>';
  select.closest('.row').after(panel);
  const start = $('calmStartCheckin'), end = $('calmEndCheckin'), info = $('calmActivityStatus');
  let busy = false, current = '', lastActivity = '', seq = 0;
  function active() { return !$('app').classList.contains('hidden') && !!select.value; }
  function buttons() {
    const ok = active() && !busy && !!window.calmProfile;
    start.disabled = !ok || current !== 'not_started';
    end.disabled = !ok || current !== 'open';
  }
  function show(v) {
    current = v;
    info.textContent = '目前狀態：' + ({not_started:'尚未開始',open:'報到進行中',closed:'本場報到已結束'}[v] || v);
    buttons();
  }
  async function client() {
    if (typeof db === 'undefined' || !db) throw Error('雲端連線尚未就緒，請重新登入');
    const {data,error} = await db.auth.getSession();
    if(error) throw error;
    if(!data?.session?.access_token) throw Error('登入已過期，請重新登入');
    return db;
  }
  async function refresh() {
    if(!active()) { current=''; info.textContent='請先登入並選擇活動'; buttons(); return; }
    const id = select.value, n = ++seq;
    try {
      const c=await client();
      const {data,error}=await c.from('tour_activities').select('checkin_status').eq('id',id).maybeSingle();
      if(error) throw error;
      if(n!==seq || id!==select.value) return;
      if(!data) throw Error('找不到活動或沒有查看權限');
      show(data.checkin_status || 'not_started');
    } catch(e) { if(n===seq){current='';info.textContent='讀取失敗：'+e.message;buttons();} }
  }
  async function change(next) {
    if(busy || !active()) return;
    if(!confirm(next==='open'?'確定開始本場活動報到？':'確定結束本場報到？結束後將不能新增報到紀錄。')) return;
    busy=true;buttons();info.textContent='正在更新活動狀態…';
    try {
      const c=await client();
      const {error}=await c.rpc('set_checkin_status',{p_activity_id:select.value,p_status:next});
      if(error) throw error;
      await refresh();
      if(current!==next) throw Error('伺服器未確認狀態更新，請檢查資料庫權限');
      info.textContent+='（更新成功）';
    } catch(e) {info.textContent='操作失敗：'+e.message;await refresh();alert('活動狀態更新失敗：'+e.message);}
    finally {busy=false;buttons();}
  }
  start.onclick=()=>change('open');
  end.onclick=()=>change('closed');
  select.addEventListener('change',()=>{lastActivity=select.value;refresh();});
  $('tourSelect')?.addEventListener('change',()=>setTimeout(refresh,600));
  $('refreshBtn')?.addEventListener('click',()=>setTimeout(refresh,600));
  setInterval(()=>{if(active()){if(select.value!==lastActivity)lastActivity=select.value;refresh();}},5000);
  buttons();
})();
