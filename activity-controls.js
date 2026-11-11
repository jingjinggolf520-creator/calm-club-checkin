
/* CALM CLUB｜活動報到控制 */

(() => {
  const $ = id => document.getElementById(id);

  const panel = document.createElement("div");
  panel.style.cssText =
    "margin:14px 0;padding:16px;border:1px solid #ddd;" +
    "border-radius:12px;background:#f7faf7";

  panel.innerHTML = `
    <strong>本場活動報到控制</strong>
    <p id="calmActivityStatus">正在讀取活動狀態...</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button id="calmStartCheckin" type="button">
        開始報到
      </button>
      <button id="calmEndCheckin" type="button"
        class="secondary">
        結束本場報到
      </button>
    </div>
  `;

  const select = $("activitySelect");
  if (!select) return;

  select.closest(".row").after(panel);

  const startBtn = $("calmStartCheckin");
  const endBtn = $("calmEndCheckin");
  const status = $("calmActivityStatus");

  let client = null;
  let currentStatus = "";
  let busy = false;

  function selectedActivity() {
    return select.value;
  }

  function setButtons() {
    const ready = !!selectedActivity() && !busy;
    startBtn.disabled =
      !ready || currentStatus !== "not_started";
    endBtn.disabled =
      !ready || currentStatus !== "open";
  }

  function showStatus(value) {
    currentStatus = value;

    const names = {
      not_started: "尚未開始",
      open: "報到進行中",
      closed: "本場報到已結束"
    };

    status.textContent =
      "目前狀態：" + (names[value] || value);

    setButtons();
  }

  function getClient() {
    if (client) return client;

    const url = localStorage.getItem(
      "calm_supabase_url"
    );

    if (!url || !window.supabase) {
      throw Error("請先完成 Supabase 連線");
    }

    const scriptText = Array.from(
      document.querySelectorAll("script")
    ).map(s => s.textContent).join("\n");

    const match = scriptText.match(
      /const PUBLIC_KEY="([^"]+)"/
    );

    if (!match) {
      throw Error("找不到網站的公開連線金鑰");
    }

    client = window.supabase.createClient(
      url,
      match[1],
      {
        auth: {
          storageKey: "calm-activity-control-auth",
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    return client;
  }

  async function syncSession() {
    const authScript = Array.from(
      document.querySelectorAll("script")
    ).map(s => s.textContent).join("\n");

    const key = authScript.match(
      /const PUBLIC_KEY="([^"]+)"/
    )?.[1];

    const url = localStorage.getItem(
      "calm_supabase_url"
    );

    if (!key || !url) {
      throw Error("找不到雲端連線設定");
    }

    const project = new URL(url).hostname.split(".")[0];
    const stored = localStorage.getItem(
      "sb-" + project + "-auth-token"
    );

    if (!stored) {
      throw Error("請先登入工作人員帳號");
    }

    const session = JSON.parse(stored);

    if (!session.access_token) {
      throw Error("登入資料已失效，請重新登入");
    }

    return session.access_token;
  }

  async function request(method, path, body) {
    const db = getClient();
    const token = await syncSession();

    const url = localStorage.getItem(
      "calm_supabase_url"
    );

    const response = await fetch(
      url + path,
      {
        method,
        headers: {
          "apikey": db.supabaseKey,
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      }
    );

    if (!response.ok) {
      const error = await response.json()
        .catch(() => ({}));

      throw Error(
        error.message || "雲端操作失敗"
      );
    }

    if (response.status === 204) return null;

    return response.json();
  }

  async function refreshStatus() {
    const id = selectedActivity();

    if (!id) {
      status.textContent = "請先選擇活動";
      currentStatus = "";
      setButtons();
      return;
    }

    try {
      const data = await request(
        "GET",
        "/rest/v1/tour_activities" +
        "?id=eq." + encodeURIComponent(id) +
        "&select=checkin_status"
      );

      if (!data.length) {
        throw Error("找不到活動或沒有查看權限");
      }

      showStatus(
        data[0].checkin_status || "not_started"
      );
    } catch (error) {
      currentStatus = "";
      status.textContent = "讀取失敗：" + error.message;
      setButtons();
    }
  }

  async function changeStatus(next) {
    const id = selectedActivity();
    if (!id || busy) return;

    const message = next === "open"
      ? "確定開始本場活動報到？"
      : "確定結束本場報到？結束後不能再新增報到紀錄。";

    if (!confirm(message)) return;

    busy = true;
    setButtons();
    status.textContent = "正在更新...";

    try {
      await request(
        "POST",
        "/rest/v1/rpc/set_checkin_status",
        {
          p_activity_id: id,
          p_status: next
        }
      );

      await refreshStatus();
      alert("活動狀態更新成功");
    } catch (error) {
      alert("操作失敗：" + error.message);
      await refreshStatus();
    } finally {
      busy = false;
      setButtons();
    }
  }

  startBtn.addEventListener(
    "click",
    () => changeStatus("open")
  );

  endBtn.addEventListener(
    "click",
    () => changeStatus("closed")
  );

  select.addEventListener(
    "change",
    () => setTimeout(refreshStatus, 100)
  );

  $("tourSelect")?.addEventListener(
    "change",
    () => setTimeout(refreshStatus, 800)
  );

  $("refreshBtn")?.addEventListener(
    "click",
    () => setTimeout(refreshStatus, 800)
  );

  setInterval(() => {
    if (!$("app")?.classList.contains("hidden")) {
      refreshStatus();
    }
  }, 5000);

  refreshStatus();
})();
