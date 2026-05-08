# Switch 分鐘管理

這是一個可部署在 GitHub Pages 的純靜態網頁，用來記錄豆豆和可可可以玩 Switch 的分鐘數。

## 預設本機模式

如果 `firebase-config.js` 的 `enabled` 還是 `false`，資料會保存在目前瀏覽器的 `localStorage`。

- 帳號：`parent`
- 密碼：`switch1234`

## 跨裝置同步模式

要讓手機、平板、電腦看到同一份資料，請使用 Firebase Authentication + Firestore。

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立專案。
2. 在專案中新增 Web App，複製 Firebase config。
3. 到 Authentication 啟用 Email/Password 登入。
4. 在 Authentication 的 Users 新增一個使用者，例如 `parent@example.com`，密碼可設定為你要固定使用的密碼。
5. 到 Firestore Database 建立資料庫。
6. 把 Firebase config 貼到 `firebase-config.js`，並改成：

```js
window.firebaseSettings = {
  enabled: true,
  sdkVersion: "12.7.0",
  appUsername: "parent",
  authEmail: "parent@example.com",
  familyId: "main",
  config: {
    apiKey: "你的 apiKey",
    authDomain: "你的 project.firebaseapp.com",
    projectId: "你的 projectId",
    appId: "你的 appId",
  },
};
```

7. 在 Firebase Authentication 的 Settings > Authorized domains，把你的 GitHub Pages 網域加入，例如 `你的帳號.github.io`。

## Firestore Rules

簡單版，只允許已登入使用者讀寫：

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /switchDashboard/{familyId} {
      allow read, write: if request.auth != null;

      match /history/{recordId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

更安全版，把 `PASTE_AUTH_UID` 換成 Authentication 使用者列表裡的 UID：

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isParent() {
      return request.auth != null && request.auth.uid == "PASTE_AUTH_UID";
    }

    match /switchDashboard/{familyId} {
      allow read, write: if isParent();

      match /history/{recordId} {
        allow read, write: if isParent();
      }
    }
  }
}
```

## 備份與搬移

右上角提供 JSON 匯出、JSON 匯入和 CSV 匯出。若你之前已經在本機模式記錄資料，可以先匯出 JSON，啟用 Firebase 後登入，再匯入 JSON，上傳成雲端資料。

Firebase config 不是密碼，放在 GitHub Pages 前端是正常做法；真正的保護要靠 Firebase Auth 和 Firestore Rules。
