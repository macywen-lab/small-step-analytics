# 多一小步：第 41 版程式備份

- 正式網站：https://small-step-analytics-2026.workspace-926599.chatgpt.site
- 備份基準：2026/11/17，第 41 版。
- 原始碼提交：e5ec5cee4c1a52dab7f3c176704b7359d5ca10d3。
- GitHub 儲存庫請設定為 Private。此專案包含歷史員工名冊與便條紙內容。

## 上傳到 GitHub

解壓縮後，上傳 small-step-v41 資料夾「裡面」的檔案與子資料夾，保留原目錄結構。根目錄應看得到 package.json、web、worker、scripts、tests、dist、docs，以及 .openai、.gitignore。

## 本機檢查

需要 Node.js；於專案目錄執行：

```sh
npm run build
npm test
```

## 備份範圍

這是目前已發布的程式碼快照，包含歷史基準資料與編譯產物，不含正式網站的即時資料庫、目前員工登入帳號資料、密碼雜湊、登入狀態、環境機密或 Git 存取憑證。網站後續送出的便條紙、後台審核結果及加分變更仍保存在正式網站的伺服器儲存空間。

正式網站的即時資料請另外從後台下載備份及電子便利貼審核檔，妥善保存。登入帳號與密碼不會因上傳此程式碼就自動移轉；換主機需另行規劃。

## 部署限制

此專案同時包含前端與 Cloudflare Worker 後端，使用 R2 儲存與伺服器登入驗證。上傳 GitHub 不會自動發布網站，也不會取代現有正式網站。GitHub Pages 無法直接執行此後端，不適合直接完整承載此版本。
