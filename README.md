# 多一小步 · 第 95 版獨立測試專案

[開啟「多一小步」正式網站](https://small-step-analytics-2026.workspace-926599.chatgpt.site/)

第 95 版修正暖心精選筆數，並保留第 94 版恢復「全部便利貼」查閱，預設由新到舊，每頁 10 張。內含兩張示範便利貼與示範名單。使用獨立資料空間測試，正式站繼續使用原有帳號及資料。

## 啟動與測試

使用 Node.js 24，執行 `npm run build` 和 `npm test`。本機啟動前，在終端設定 ADMIN_ID（1～20 位數字）與 ADMIN_PASSWORD（至少 12 字元）環境變數，再執行 `npm run dev`。開啟 http://localhost:4173 。第一次登入會在本機儲存空間建立管理員，之後使用原帳號登入。

## 部署

### 公開應用程式

把 `dist/server/index.js` 部署為 Cloudflare Worker，或在 Cloudflare Pages 使用 Node.js 24、建置指令 `npm run build:cloudflare-pages` 與輸出目錄 `dist/cloudflare-pages`。在正式環境把 R2 bucket 綁定為 `BUCKET`。更新現有站點時使用原本的 bucket，以保留帳號、便利貼及審核紀錄。新建站點時，把 `ADMIN_ID` 和 `ADMIN_PASSWORD` 設為執行環境的 secrets，供首次後台登入使用。

公開應用程式的根網址直接開啟便利貼首頁。訪客可直接瀏覽與填寫，送出後由後台審核。管理員從首頁的「後台管理登入」進入。

### GitHub Pages 分享網址

在 GitHub 儲存庫的 **Settings → Pages**，將發布來源設為 **GitHub Actions**。預設轉址到上方的正式網站。若公開應用程式使用其他網址，在儲存庫的 **Settings → Secrets and variables → Actions → Variables** 將 `PUBLIC_APP_URL` 設為該站的 HTTPS 根網址，再執行 **Publish GitHub Pages entry**。

發布流程會以未登入訪客的身分確認首頁、資料 API 與填寫驗證。檢查通過後，GitHub Pages 分享網址會直接轉到公開應用程式，舊的 `login` 和 `login.html` 入口也會轉到同一個首頁。便利貼由公開應用程式的 API 保存。
