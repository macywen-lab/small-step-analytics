# 多一小步第 41 版：Cloudflare 部署操作

本包以第 41 版為基礎，補上 Cloudflare 專用入口、安全管理員初始化與首次 JSON 備份匯入。現有 ChatGPT 網站未被修改。本包已執行 npm run build 與 72 項測試；尚未在你的 Cloudflare 帳號實際部署。

## 1. 備份舊站

到原網站 /admin.html 登入，下載「目前資料備份」JSON、「電子便利貼審核檔」Excel。保留最新員工名單及紙本 Excel。正式轉換前安排短暫停止舊站填寫與審核，重新下載最後一次 JSON。不要讓兩個站同時收件：兩邊資料不會自動同步。

## 2. GitHub

登入 https://github.com/ ，由右上 + → New repository 建立 small-step-analytics，Visibility 選 Private，不預先建立 README。按 Create repository → uploading an existing file。解壓縮部署 ZIP，進入 small-step-v41-cloudflare 資料夾，把裡面的檔案與子資料夾拖入。根目錄應直接看到 package.json、wrangler.jsonc、cloudflare-entry.js、web、worker、scripts、tests、dist。不要只上傳 ZIP，也不要多包一層外層資料夾。提交說明填「部署多一小步第41版至Cloudflare」，按 Commit changes。若原先已有儲存庫，可上傳同名檔更新；務必包含新增的入口、設定及匯入頁。不要將員工密碼 Excel 上傳 GitHub。

## 3. R2

登入 https://dash.cloudflare.com/ ，完成信箱驗證。到 Storage & databases → R2 Object Storage → Overview，首次使用依畫面啟用訂閱並確認付款條件。Create bucket：名稱 small-step-data，位置 Automatic，儲存類別 Standard。建立後保持私人，不開啟 Public Development URL 或公開網域；不需要 S3 API 金鑰或 CORS 設定。

## 4. Workers 連 GitHub

同一 Cloudflare 帳號 → Workers & Pages → Create application → 選 Git 儲存庫的 Worker 建立流程（畫面可能為 Import a repository／Continue with GitHub）。授權 GitHub 時選 Only select repositories，指定 small-step-analytics。選取儲存庫後設定：

| 設定 | 值 |
|---|---|
| Worker 名稱 | small-step-analytics |
| 正式分支 | main |
| Build command | npm run build |
| Deploy command | npx wrangler deploy |
| Root directory | 儲存庫根目錄，預設 / |

不是 Pages 的靜態網站流程，不需填靜態輸出目錄。按 Save and Deploy，等建置成功。wrangler.jsonc 已設定主入口 cloudflare-entry.js 與 R2 綁定 BUCKET → small-step-data。R2 要先建立於同一帳號。若授權畫面提供建置 token 設定，使用 Cloudflare 提供、具該 Worker 部署與 R2 綁定讀取權限的設定。

到 Worker → Bindings 檢查 BUCKET，類型 R2 bucket，值 small-step-data。到 Settings → Domains & Routes 找正式 workers.dev 網址並記下；不要使用臨時 Preview 網址。若首次要求設定 workers.dev 子網域，依畫面選一個可用名稱。

## 5. 管理員安全初始化

Worker → Settings → Variables and Secrets → Add，建立兩筆執行期 Secret：

| 名稱 | 值 |
|---|---|
| ADMIN_BOOTSTRAP_ID | 你的管理員工號，例如 2163 |
| ADMIN_BOOTSTRAP_PASSWORD | 自訂 12～128 字元密碼 |

不要把密碼填在 GitHub 或 Build variables。儲存並 Deploy。第一次登入會以這兩個值建立管理員；不會建立公開的預設密碼。若帳號已建立，修改 Secret 不會重設管理員密碼。開啟新站 /admin.html，以此工號與密碼登入。確認成功後可刪除兩筆初始化 Secret 並再次 Deploy，帳號已保存在 R2，不會消失。

## 6. 匯入舊站資料

在同一瀏覽器保持新站後台登入，開啟新站 /migration.html，選擇最後下載的完整 JSON 備份，按「匯入舊站備份」。上限 20 MB。此功能僅限全新站台、員工帳號匯入前；已有資料會拒絕覆蓋。它移轉紙本統計、電子便條紙、網站填寫紀錄、審核與加分及員工名冊，不移轉登入帳號、歷史版本鏈、原始 Excel 附件或舊登入 session。看到完成筆數後返回後台，核對來源月份、審核筆數、加分與統計。

不要將 JSON 直接拖入 R2 期待網站自動讀取；請透過此匯入頁。

## 7. 建立員工登入帳號

後台 → 員工登入帳號 → 選擇最新員工名單 Excel → 檢查預覽 → 確認匯入。本版使用 C 欄姓名、F 欄工號、G 欄初始密碼，並同步到離職資料。工號及密碼請以文字儲存，0348 等前導 0 必須保留。密碼空白、已離職或未到職者均不能登入。新站帳號會採用 Excel 的初始密碼，原站自行改過的密碼不在一般 JSON 備份中。管理員與員工登入分開，管理員 Secret 不會自動建立員工前台帳號。

## 8. 驗收並換網址

1. 無痕開啟新站首頁，應導向 /login.html。
2. 用在職、有密碼的員工登入；離職與空白密碼帳號應失敗。
3. 手機填寫一張便條紙，在「我的便條紙」看到審核中。
4. 後台通過並填加分，確認公開便條紙、票數與加分同步更新。
5. 換另一裝置登入與重新整理，確認同一筆資料仍存在。
6. 核對舊站統計與審核結果後，再把新正式網址發給同仁並停止舊站收件。

## 9. 後續更新

更新 GitHub main 的程式並 Commit，Cloudflare 會自動重新建置部署。R2 資料獨立保存，正常更新程式不需重匯帳號或備份。不要刪除 Bucket 或更換綁定，也不要對資料設定自動到期刪除。定期從後台下載備份。前台查閱、填寫仍需要網路。

此版送出便條紙的功能限定 2026 年；2027 年使用前需擴充年度規則。網址部署後不會自動解除程式內的年度限制。

## 排錯

| 問題 | 檢查 |
|---|---|
| 找不到 wrangler.jsonc／package.json | GitHub 根目錄是否多包一層資料夾 |
| Bucket 不存在／R2 綁定失敗 | 同一 Cloudflare 帳號是否已建立 small-step-data |
| 登入顯示服務未設定 | BUCKET 綁定、執行期兩筆 Secret、Deploy 是否完成 |
| 後台能登入但首頁不能 | 另匯入員工帳號，並使用員工登入頁 |
| 匯入提示已有資料 | 此匯入僅供空的新站；不要自行刪除已有正式資料 |
| 已變更 Secret 但密碼沒改 | 既有管理員密碼需在後台修改，不會被初始化 Secret 覆寫 |
| 原站密碼不能登入 | 新站採用重新匯入的 Excel 初始密碼 |
| 新版未顯示 | 確認 main 最新 commit 建置成功，重新整理／關閉 PWA 重開 |
| 送出發生資源限制錯誤 | 在 Workers logs 查看實際錯誤，再評估方案或程式調整 |

官方參考：https://developers.cloudflare.com/workers/ci-cd/builds/ 、https://developers.cloudflare.com/r2/get-started/ 、https://developers.cloudflare.com/workers/configuration/secrets/
