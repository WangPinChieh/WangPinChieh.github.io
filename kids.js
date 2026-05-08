const STORAGE_KEY = "switch-dashboard-state-v1";
const FIREBASE_DEFAULT_SDK_VERSION = "12.7.0";

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
const summaryGrid = document.querySelector("#summaryGrid");
const syncStatus = document.querySelector("#syncStatus");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");

let state = loadCachedState();

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

  return {
    id: String(item.id || createId()),
    childId: item.childId,
    delta: Math.trunc(Number(item.delta) || 0),
    before: Math.max(0, Math.floor(Number(item.before) || 0)),
    after: Math.max(0, Math.floor(Number(item.after) || 0)),
    note: String(item.note || "").slice(0, 40),
    createdAt,
    createdAtMs: Date.parse(createdAt),
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
        <article class="kid-card viewer-card" style="--card-accent: ${child.accent}; --ring-value: ${ringValue}%;">
          <div class="kid-visual" aria-hidden="true">
            <div class="minute-ring">
              <div class="minute-ring-inner">${ringValue}%</div>
            </div>
          </div>
          <div class="kid-content">
            <h2>${child.name}</h2>
            <div class="minute-number">${minutes}<span>分鐘</span></div>
            <div class="kid-meta">
              <span>${lastAction ? `最近 ${formatSigned(lastAction.delta)} 分鐘` : "尚未調整"}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const visibleHistory = state.history.slice(0, 8);
  historyCount.textContent = `${state.history.length} 筆`;

  if (visibleHistory.length === 0) {
    historyList.innerHTML = `<div class="empty-state">還沒有紀錄</div>`;
    return;
  }

  historyList.innerHTML = visibleHistory
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

function isFirebaseConfigured() {
  const config = firebaseSettings.config || {};
  const requiredValues = [config.apiKey, config.authDomain, config.projectId, config.appId];
  return Boolean(firebaseSettings.enabled && requiredValues.every((value) => value && !isPlaceholder(value)));
}

function isPlaceholder(value) {
  return /PASTE|YOUR_|your-/i.test(String(value));
}

async function setupCloudViewer() {
  const version = firebaseSettings.sdkVersion || FIREBASE_DEFAULT_SDK_VERSION;
  const [appModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
  ]);

  const app = appModule.initializeApp(firebaseSettings.config);
  const db = firestoreModule.getFirestore(app);
  const familyId = firebaseSettings.familyId || "main";
  const stateDoc = firestoreModule.doc(db, "switchDashboard", familyId);
  const historyCollection = firestoreModule.collection(stateDoc, "history");

  setSyncStatus("雲端讀取中", "cloud");

  firestoreModule.onSnapshot(
    stateDoc,
    (snapshot) => {
      if (!snapshot.exists()) {
        setSyncStatus("尚無雲端資料", "cloud");
        render();
        return;
      }

      state = {
        ...state,
        minutes: normalizeMinutes(snapshot.data()?.minutes),
      };
      cacheState();
      setSyncStatus("雲端已同步", "cloud");
      render();
    },
    (error) => {
      console.error(error);
      setSyncStatus("雲端讀取失敗", "error");
    }
  );

  const historyQuery = firestoreModule.query(historyCollection, firestoreModule.orderBy("createdAtMs", "desc"));
  firestoreModule.onSnapshot(
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
      console.error(error);
      setSyncStatus("紀錄讀取失敗", "error");
    }
  );
}

async function init() {
  render();

  if (!isFirebaseConfigured()) {
    setSyncStatus("本機快取", "local");
    return;
  }

  try {
    await setupCloudViewer();
  } catch (error) {
    console.error(error);
    setSyncStatus("Firebase 載入失敗", "error");
  }
}

init();
