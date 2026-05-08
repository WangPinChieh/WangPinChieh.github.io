const STORAGE_KEY = "switch-dashboard-state-v1";
const SESSION_KEY = "switch-dashboard-authenticated";
const FIREBASE_DEFAULT_SDK_VERSION = "12.13.0";

const LOCAL_CREDENTIALS = {
  username: "parent",
  password: "switch1234",
};

const CHILDREN = {
  doudou: {
    name: "豆豆",
    accent: "#0f766e",
  },
  keke: {
    name: "可可",
    accent: "#ef6f61",
  },
};

const DEFAULT_STATE = {
  minutes: {
    doudou: 0,
    keke: 0,
  },
  history: [],
};

const firebaseSettings = window.firebaseSettings || {};

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginError = document.querySelector("#loginError");
const logoutButton = document.querySelector("#logoutButton");
const summaryGrid = document.querySelector("#summaryGrid");
const adjustForm = document.querySelector("#adjustForm");
const childSelect = document.querySelector("#childSelect");
const minutesInput = document.querySelector("#minutesInput");
const noteInput = document.querySelector("#noteInput");
const saveStatus = document.querySelector("#saveStatus");
const syncStatus = document.querySelector("#syncStatus");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const exportJsonButton = document.querySelector("#exportJsonButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const importJsonButton = document.querySelector("#importJsonButton");
const importFileInput = document.querySelector("#importFileInput");
const resetButton = document.querySelector("#resetButton");

let state = loadCachedState();
let cloud = null;
let isCloudMode = false;

function loadCachedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalizeState(value) {
  const history = Array.isArray(value?.history)
    ? value.history
        .filter((item) => CHILDREN[item.childId])
        .map(normalizeHistoryItem)
        .filter((item) => item.delta !== 0)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
    : [];

  return {
    minutes: normalizeMinutes(value?.minutes),
    history,
  };
}

function normalizeMinutes(value) {
  return {
    doudou: Math.max(0, Math.floor(Number(value?.doudou) || 0)),
    keke: Math.max(0, Math.floor(Number(value?.keke) || 0)),
  };
}

function normalizeHistoryItem(item) {
  const createdAt = normalizeCreatedAt(item.createdAt, item.createdAtMs);
  const createdAtMs = Date.parse(createdAt);

  return {
    id: String(item.id || createId()),
    childId: item.childId,
    delta: Math.trunc(Number(item.delta) || 0),
    before: Math.max(0, Math.floor(Number(item.before) || 0)),
    after: Math.max(0, Math.floor(Number(item.after) || 0)),
    note: String(item.note || "").slice(0, 40),
    createdAt,
    createdAtMs,
  };
}

function normalizeCreatedAt(createdAt, createdAtMs) {
  if (createdAt?.toDate) {
    return createdAt.toDate().toISOString();
  }

  if (typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt))) {
    return createdAt;
  }

  if (Number.isFinite(Number(createdAtMs))) {
    return new Date(Number(createdAtMs)).toISOString();
  }

  return new Date().toISOString();
}

function cacheState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveLocalState() {
  cacheState();
  saveStatus.textContent = `已儲存 ${formatTime(new Date())}`;
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  render();
}

function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
}

function setSyncStatus(message, kind = "neutral") {
  syncStatus.textContent = message;
  syncStatus.dataset.kind = kind;
}

function render() {
  renderCards();
  renderHistory();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderCards() {
  const maxMinutes = Math.max(60, state.minutes.doudou, state.minutes.keke);

  summaryGrid.innerHTML = Object.entries(CHILDREN)
    .map(([id, child]) => {
      const minutes = state.minutes[id];
      const ringValue = Math.min(100, Math.round((minutes / maxMinutes) * 100));
      const lastAction = state.history.find((item) => item.childId === id);

      return `
        <article class="kid-card" style="--card-accent: ${child.accent}; --ring-value: ${ringValue}%;">
          <div class="kid-visual" aria-hidden="true">
            <div class="minute-ring">
              <div class="minute-ring-inner">${ringValue}%</div>
            </div>
          </div>
          <div class="kid-content">
            <h2>${child.name}</h2>
            <div class="minute-number">${minutes}<span>分鐘</span></div>
            <div class="kid-meta">
              <span>累計 ${countHistory(id)} 筆紀錄</span>
              <span>${lastAction ? `上次 ${formatSigned(lastAction.delta)} 分鐘` : "尚未調整"}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  historyCount.textContent = `${state.history.length} 筆`;

  if (state.history.length === 0) {
    historyList.innerHTML = `<div class="empty-state">還沒有紀錄</div>`;
    return;
  }

  historyList.innerHTML = state.history
    .map((item) => {
      const child = CHILDREN[item.childId];
      const deltaClass = item.delta >= 0 ? "positive" : "negative";
      const note = item.note ? escapeHtml(item.note) : "未填備註";

      return `
        <article class="history-item">
          <div class="history-child">${child.name}</div>
          <div class="history-delta ${deltaClass}">${formatSigned(item.delta)} 分鐘</div>
          <div class="history-note">${note}</div>
          <time class="history-time" datetime="${item.createdAt}">${formatDateTime(item.createdAt)}</time>
        </article>
      `;
    })
    .join("");
}

async function adjustMinutes(childId, rawDelta, note = "") {
  if (isCloudMode && cloud?.user) {
    await adjustCloudMinutes(childId, rawDelta, note);
    return;
  }

  adjustLocalMinutes(childId, rawDelta, note);
}

function adjustLocalMinutes(childId, rawDelta, note = "") {
  const current = state.minutes[childId];
  const next = Math.max(0, current + rawDelta);
  const appliedDelta = next - current;

  if (appliedDelta === 0) {
    saveStatus.textContent = "分鐘數已經是 0";
    return;
  }

  state.minutes[childId] = next;
  state.history.unshift(createHistoryItem(childId, appliedDelta, current, next, note));

  saveLocalState();
  render();
}

async function adjustCloudMinutes(childId, rawDelta, note = "") {
  try {
    await cloud.runTransaction(cloud.db, async (transaction) => {
      const snapshot = await transaction.get(cloud.stateDoc);
      const minutes = normalizeMinutes(snapshot.data()?.minutes);
      const current = minutes[childId];
      const next = Math.max(0, current + rawDelta);
      const appliedDelta = next - current;

      if (appliedDelta === 0) {
        throw new Error("NO_CHANGE");
      }

      const recordRef = cloud.doc(cloud.historyCollection);
      const record = createHistoryItem(childId, appliedDelta, current, next, note, recordRef.id);

      transaction.set(
        cloud.stateDoc,
        {
          minutes: {
            ...minutes,
            [childId]: next,
          },
          updatedAt: cloud.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(recordRef, historyToCloudRecord(record));
    });

    saveStatus.textContent = `雲端已儲存 ${formatTime(new Date())}`;
  } catch (error) {
    if (error.message === "NO_CHANGE") {
      saveStatus.textContent = "分鐘數已經是 0";
      return;
    }

    saveStatus.textContent = "雲端儲存失敗，請稍後再試";
    console.error(error);
  }
}

function createHistoryItem(childId, delta, before, after, note = "", id = createId()) {
  const createdAtMs = Date.now();

  return {
    id,
    childId,
    delta,
    before,
    after,
    note: note.trim(),
    createdAt: new Date(createdAtMs).toISOString(),
    createdAtMs,
  };
}

function historyToCloudRecord(item) {
  return {
    id: item.id,
    childId: item.childId,
    delta: item.delta,
    before: item.before,
    after: item.after,
    note: item.note,
    createdAt: item.createdAt,
    createdAtMs: item.createdAtMs,
  };
}

function countHistory(childId) {
  return state.history.filter((item) => item.childId === childId).length;
}

function formatSigned(number) {
  return number > 0 ? `+${number}` : `${number}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportJson() {
  downloadFile(
    `switch-minutes-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(state, null, 2),
    "application/json"
  );
}

function exportCsv() {
  const header = ["時間", "小朋友", "增減分鐘", "調整前", "調整後", "備註"];
  const rows = state.history.map((item) => [
    formatDateTime(item.createdAt),
    CHILDREN[item.childId].name,
    item.delta,
    item.before,
    item.after,
    item.note || "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadFile(
    `switch-minutes-${new Date().toISOString().slice(0, 10)}.csv`,
    `\ufeff${csv}`,
    "text/csv;charset=utf-8"
  );
}

function importJson(file) {
  const reader = new FileReader();

  reader.addEventListener("load", async () => {
    try {
      const nextState = normalizeState(JSON.parse(String(reader.result)));

      if (isCloudMode && cloud?.user) {
        await replaceCloudState(nextState);
        saveStatus.textContent = "JSON 已匯入雲端";
        return;
      }

      state = nextState;
      saveLocalState();
      render();
      saveStatus.textContent = "JSON 已匯入並儲存";
    } catch (error) {
      saveStatus.textContent = "JSON 格式不正確";
      console.error(error);
    }
  });

  reader.readAsText(file);
}

function getSubmitAction(event) {
  if (event.submitter?.value) {
    return event.submitter.value;
  }

  return document.activeElement?.value || "add";
}

async function replaceCloudState(nextState) {
  const normalized = normalizeState(nextState);
  const existingHistory = await cloud.getDocs(cloud.historyCollection);
  let batch = cloud.writeBatch(cloud.db);
  let operationCount = 0;

  async function commitIfNeeded(force = false) {
    if (operationCount === 0) {
      return;
    }

    if (force || operationCount >= 400) {
      await batch.commit();
      batch = cloud.writeBatch(cloud.db);
      operationCount = 0;
    }
  }

  for (const item of existingHistory.docs) {
    batch.delete(item.ref);
    operationCount += 1;
    await commitIfNeeded();
  }

  batch.set(
    cloud.stateDoc,
    {
      minutes: normalized.minutes,
      updatedAt: cloud.serverTimestamp(),
    },
    { merge: true }
  );
  operationCount += 1;
  await commitIfNeeded();

  for (const item of normalized.history) {
    const recordRef = cloud.doc(cloud.historyCollection, item.id);
    batch.set(recordRef, historyToCloudRecord(item));
    operationCount += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
}

async function resetAllData() {
  if (isCloudMode && cloud?.user) {
    await replaceCloudState(cloneDefaultState());
    saveStatus.textContent = "雲端資料已清空";
    return;
  }

  state = cloneDefaultState();
  saveLocalState();
  render();
}

function isFirebaseConfigured() {
  const config = firebaseSettings.config || {};
  const requiredValues = [config.apiKey, config.authDomain, config.projectId, config.appId];
  return Boolean(firebaseSettings.enabled && requiredValues.every((value) => value && !isPlaceholder(value)));
}

function isPlaceholder(value) {
  return /PASTE|YOUR_|your-/i.test(String(value));
}

async function setupCloudMode() {
  const version = firebaseSettings.sdkVersion || FIREBASE_DEFAULT_SDK_VERSION;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
  ]);

  const app = appModule.initializeApp(firebaseSettings.config);
  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  const familyId = firebaseSettings.familyId || "main";
  const stateDoc = firestoreModule.doc(db, "switchDashboard", familyId);
  const historyCollection = firestoreModule.collection(stateDoc, "history");

  cloud = {
    app,
    auth,
    db,
    user: null,
    stateDoc,
    historyCollection,
    unsubscribeState: null,
    unsubscribeHistory: null,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged,
    doc: firestoreModule.doc,
    getDocs: firestoreModule.getDocs,
    onSnapshot: firestoreModule.onSnapshot,
    orderBy: firestoreModule.orderBy,
    query: firestoreModule.query,
    runTransaction: firestoreModule.runTransaction,
    serverTimestamp: firestoreModule.serverTimestamp,
    setDoc: firestoreModule.setDoc,
    writeBatch: firestoreModule.writeBatch,
  };

  isCloudMode = true;
  setSyncStatus("雲端模式", "cloud");

  cloud.onAuthStateChanged(auth, async (user) => {
    cloud.user = user;

    if (user) {
      await startCloudSync();
      showDashboard();
      return;
    }

    stopCloudSync();
    showLogin();
  });
}

async function startCloudSync() {
  stopCloudSync();
  setSyncStatus("雲端同步中", "cloud");

  cloud.unsubscribeState = cloud.onSnapshot(
    cloud.stateDoc,
    async (snapshot) => {
      if (!snapshot.exists()) {
        await cloud.setDoc(
          cloud.stateDoc,
          {
            minutes: cloneDefaultState().minutes,
            updatedAt: cloud.serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      state = {
        ...state,
        minutes: normalizeMinutes(snapshot.data()?.minutes),
      };
      cacheState();
      saveStatus.textContent = `雲端已同步 ${formatTime(new Date())}`;
      setSyncStatus("雲端已同步", "cloud");
      render();
    },
    (error) => {
      saveStatus.textContent = "雲端同步失敗";
      setSyncStatus("雲端錯誤", "error");
      console.error(error);
    }
  );

  const historyQuery = cloud.query(cloud.historyCollection, cloud.orderBy("createdAtMs", "desc"));
  cloud.unsubscribeHistory = cloud.onSnapshot(
    historyQuery,
    (snapshot) => {
      state = {
        ...state,
        history: snapshot.docs.map((item) => normalizeHistoryItem({ id: item.id, ...item.data() })),
      };
      cacheState();
      render();
    },
    (error) => {
      saveStatus.textContent = "歷史紀錄同步失敗";
      setSyncStatus("雲端錯誤", "error");
      console.error(error);
    }
  );
}

function stopCloudSync() {
  if (cloud?.unsubscribeState) {
    cloud.unsubscribeState();
    cloud.unsubscribeState = null;
  }

  if (cloud?.unsubscribeHistory) {
    cloud.unsubscribeHistory();
    cloud.unsubscribeHistory = null;
  }
}

async function handleCloudLogin(username, password) {
  const appUsername = firebaseSettings.appUsername || LOCAL_CREDENTIALS.username;
  const authEmail = firebaseSettings.authEmail;

  if (username !== appUsername || !authEmail || isPlaceholder(authEmail)) {
    loginError.textContent = "帳號或密碼不正確";
    return;
  }

  try {
    loginError.textContent = "";
    await cloud.signInWithEmailAndPassword(cloud.auth, authEmail, password);
    loginForm.reset();
  } catch (error) {
    loginError.textContent = getAuthErrorMessage(error);
    console.error(error);
  }
}

function getAuthErrorMessage(error) {
  const code = error?.code || "";

  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "帳號或密碼不正確";
  }

  if (code.includes("network")) {
    return "無法連線 Firebase，請檢查網路";
  }

  return "登入失敗，請稍後再試";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = String(formData.get("username")).trim();
  const password = String(formData.get("password"));

  if (isCloudMode && cloud) {
    await handleCloudLogin(username, password);
    return;
  }

  if (username === LOCAL_CREDENTIALS.username && password === LOCAL_CREDENTIALS.password) {
    sessionStorage.setItem(SESSION_KEY, "true");
    loginError.textContent = "";
    loginForm.reset();
    showDashboard();
    return;
  }

  loginError.textContent = "帳號或密碼不正確";
});

logoutButton.addEventListener("click", async () => {
  if (isCloudMode && cloud) {
    await cloud.signOut(cloud.auth);
    return;
  }

  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

adjustForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const minutes = Math.max(1, Math.floor(Number(minutesInput.value) || 0));
  const direction = getSubmitAction(event) === "subtract" ? -1 : 1;

  await adjustMinutes(childSelect.value, minutes * direction, noteInput.value);
  minutesInput.value = minutes;
  noteInput.value = "";
});

document.querySelectorAll("[data-quick]").forEach((button) => {
  button.addEventListener("click", async () => {
    const delta = Number(button.dataset.quick);
    await adjustMinutes(childSelect.value, delta, "快速調整");
  });
});

exportJsonButton.addEventListener("click", exportJson);
exportCsvButton.addEventListener("click", exportCsv);

importJsonButton.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", () => {
  const [file] = importFileInput.files;
  if (file) {
    importJson(file);
  }
  importFileInput.value = "";
});

resetButton.addEventListener("click", async () => {
  const confirmed = window.confirm("確定要清空所有分鐘數和歷史紀錄嗎？");
  if (!confirmed) {
    return;
  }

  await resetAllData();
});

async function init() {
  render();

  if (isFirebaseConfigured()) {
    try {
      await setupCloudMode();
      return;
    } catch (error) {
      console.error(error);
      setSyncStatus("Firebase 載入失敗，暫用本機", "error");
    }
  } else {
    setSyncStatus("本機模式", "local");
  }

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    showDashboard();
  } else {
    showLogin();
  }
}

init();
