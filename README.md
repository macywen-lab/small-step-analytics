# 多一小步 · 網站程式

本儲存庫保留網站程式，可在本機啟動或部署至自己的資料空間。

## 啟動與測試

使用 Node.js 24，執行 `npm run build` 和 `npm test`。本機啟動前，在終端設定 ADMIN_ID（1～20 位數字）與 ADMIN_PASSWORD（至少 12 字元）環境變數，再執行 `npm run dev`。開啟 http://localhost:4173 。第一次登入會在本機儲存空間建立管理員，之後使用原帳號登入。

## 部署

### 公開應用程式

把 `dist/server/index.js` 部署為 Cloudflare Worker，或在 Cloudflare Pages 使用 Node.js 24、建置指令 `npm run build:cloudflare-pages` 與輸出目錄 `dist/cloudflare-pages`。在正式環境把 R2 bucket 綁定為 `BUCKET`。更新現有站點時使用原本的 bucket，以保留帳號、便利貼及審核紀錄。新建站點時，把 `ADMIN_ID` 和 `ADMIN_PASSWORD` 設為執行環境的 secrets，供首次後台登入使用。

公開應用程式的根網址直接開啟便利貼首頁。訪客可直接瀏覽與填寫，送出後由後台審核。管理員從首頁的「後台管理登入」進入。

### GitHub Pages

GitHub Pages 從 `main` 根目錄發布 `index.html`，作為原始碼入口。
