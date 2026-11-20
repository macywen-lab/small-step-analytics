# 多一小步 · 第 95 版獨立測試專案

[開啟「多一小步」正式網站](https://small-step-analytics-2026.workspace-926599.chatgpt.site/)

第 95 版修正暖心精選筆數，並保留第 94 版恢復「全部便利貼」查閱，預設由新到舊，每頁 10 張。內含兩張示範便利貼與示範名單。使用獨立資料空間測試，正式站繼續使用原有帳號及資料。

## 啟動與測試

使用 Node.js 24，執行 `npm run build` 和 `npm test`。本機啟動前，在終端設定 ADMIN_ID（1～20 位數字）與 ADMIN_PASSWORD（至少 12 字元）環境變數，再執行 `npm run dev`。開啟 http://localhost:4173 。第一次登入會在本機儲存空間建立管理員，之後使用原帳號登入。

## 部署

GitHub 可保存這份原始碼。若需獨立上線，將建置產物 dist/server/index.js 部署為 Cloudflare Worker，綁定獨立的 R2 bucket 為 BUCKET，將 ADMIN_ID 與 ADMIN_PASSWORD 設定為執行環境的 secrets。正式站的帳號與紀錄存放在原本的服務中。此專案沒有設定自動發布或 Google Drive 同步。
