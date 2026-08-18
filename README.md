<div align="center">

# 🔥 FIRE Flow
### 現代化 FIRE 財務自由計算器・台美股投資庫存・雙幣資產管理系統

*精準規劃退休時程，深度整合台美股即時庫存、TWD/USD 雙幣現金池、即時匯率換匯、雙軌收支記帳與 Android 桌面速記小工具。*

<br/>

[![Download APK](https://img.shields.io/badge/Download-Android_APK-emerald?style=for-the-badge&logo=android&logoColor=white)](https://github.com/lzwy1110/fire-finance-calculator/releases)
[![Live Demo](https://img.shields.io/badge/Web_App-Live_Demo-blue?style=for-the-badge&logo=vercel&logoColor=white)](https://fire-finance-calculator.vercel.app/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.1-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 📖 專案簡介 (Overview)

**FIRE Flow** 是一款專為追求 **FIRE（Financial Independence, Retire Early，財務獨立、提早退休）** 族群打造的全方位現代化個人資產管理系統。

有別於傳統單純流水帳記帳軟體，**FIRE Flow** 將 **「日常雙軌記帳」**、**「台美股即時持股行情」**、**「美金/台幣獨立雙幣池」**、**「即時匯率換匯」** 與 **「FIRE 4% 安全提領法則」** 深度融合。所有資產變動自動即時連動總淨資產與 FIRE 達成進度，並支援離線本機運作與私有雲端雙向同步。

---

## 🌟 核心特色 (Core Features)

### 💱 1. 雙幣獨立現金池與即時匯率換匯
- **獨立儲備帳戶**：將現金資產池清晰拆分為 **台幣現金池 (`TWD`)** 與 **美金現金池 (`USD`)**。
- **自動即時匯率**：啟動自動抓取最新 `USD/TWD` 牌告匯率，換算總淨資產精確無時差。
- **專屬雙幣換匯轉帳彈窗**：
  - 支援 `TWD ➔ USD` 與 `USD ➔ TWD` 雙向自由換匯。
  - 提供 `25%`、`50%`、`75%`、`全部 (100%)` 快速帶入金額按鈕。
  - 支援自訂銀行手續費與成交匯率微調，即時預覽換匯前後的資產池變化。
- **精準幣別扣抵**：美股交易扣抵美金池、台股交易扣抵台幣池，杜絕跨幣別造成的混亂匯損。

---

### 📈 2. 台股 / 美股投資庫存與專業 K 線圖
- **即時行情與智慧搜尋**：支援搜尋台灣上市上櫃（TWSE / TPEX）與美股（NYSE / NASDAQ）之股票、ETF 中文名稱與即時股價。
- **完整買賣對帳與投報率**：
  - 自動計算加權買入均價、持股市值、已實現損益（Realized P&L）、未實現損益與未實現 ROI% 報酬率。
- **專業互動走勢圖與 K 線圖**：
  - 支援切換 **平滑折線圖** 與 **專業開高低收 K 線圖 (Candlestick Chart)**。
- **現金流雙向連動與歷史防護**：
  - 買入現股扣除對應現金、賣出現股回存對應現金。
  - 支援「歷史已有持股」免扣現金標記與「防負庫存裸賣」時序驗證。

---

### 🔥 3. FIRE 4% 法則退休倒數與動態情境模擬
- **精確退休倒數計時**：以天、月、年為單位，動態精算距離目標 FIRE 的剩餘時間與預計達成日期。
- **多維度 FIRE 指標**：
  - **標準 FIRE (Rule of 25)**：以 4% 安全提領率計算目標退休資產（年支出 × 25）。
  - **Lean FIRE (簡約型)**：基礎生活花費（80% 支出）極簡退休目標。
  - **Fat FIRE (富足型)**：充裕生活花費（150% 支出）高品質退休目標。
  - **Coast FIRE (躺平型)**：計算當前年齡所需本金，靠現有資產複利自然達標。
- **資產配置比例條**：實時呈現「現金儲備（TWD + USD）」vs「股票市值」的資產佔比。
- **即時參數模擬器**：即時調整年化投資報酬率、預期通膨率、安全提領率（SWR）與目標退休年齡，動態觀察退休達成率變化。

---

### 📝 4. 智慧雙軌收支記帳與分類管理
- **四大記帳模式**：支援「支出」、「收入」、「投資」、「稅金規費」完整分流。
- **全動態自訂分類**：支援自由新增大類、編輯子分類項目，具備最後大類保護機制。
- **常用消費快捷按鈕 (Quick Presets)**：自訂常用金額與消費項目，一鍵快速記帳。
- **多維度財務圖表分析**：支出佔比圓餅圖、近半年收支趨勢柱狀圖、20 年複利累積預測曲線。
- **報表與 CSV 匯出**：月報表、年報表快速切換，並支援一鍵匯出 CSV 試算表備份。

---

### 📱 5. Android 原生支援與 4×3 桌面速記小工具 (Widget)
- **4×3 自適應桌面小工具**：免開啟 App 即可在手機桌面直接速記日常收支。
- **動態分類翻頁器**：自動同步 App 內所有自訂大類與子類，支援「➡️ 更多」按鈕循環翻頁點選。
- **原生背景 0.5 秒直連 Supabase**：桌面輸入金額後點擊確定，背景執行緒自動寫入雲端並連動扣除現金儲備，整天免開 App 也完全同步！

---

### ☁️ 6. 靈活雙模式：純本機模式 & 雲端多端同步
- **純本機模式 (Local-First)**：所有資料安全保存在手機 / 瀏覽器本地，完全不發送任何雲端網路請求。
- **雲端同步模式 (Cloud Sync)**：輸入專屬 6 位數同步碼，即可在電腦網頁版、手機 App 之間實現即時雙向無感同步。

---

## ⚡ 如何建立並接入自己的專屬 Supabase 資料庫 (Self-Hosted Setup)

本專案支援 **100% 自建私有雲端資料庫**。只需 3 分鐘，即可免費使用 Supabase 託管您的個人財務數據，享有最高規格的資料所有權與隱私！

### 步驟 1：註冊並建立 Supabase 免費專案
1. 前往 [Supabase 官網](https://supabase.com/) 免費註冊帳號。
2. 點擊 **「New Project」**，輸入專案名稱（例如 `fire-flow`），設定資料庫密碼並選擇離您最近的區域（例如 `Tokyo / Singapore`）。

### 步驟 2：一鍵執行資料表結構 SQL
1. 進入 Supabase 專案控制台，在左側選單點選 **「SQL Editor」**。
2. 點擊 **「New query」**，複製本專案中的 [`supabase/schema.sql`](supabase/schema.sql) 完整內容。
3. 貼上至編輯器中，點擊右下角的 **「Run」** 執行。
4. 執行成功後，您的資料庫便已建置好標準 5 大資料表（`transactions`、`categories`、`fire_configs`、`quick_presets`、`portfolio_stocks`）與安全存取原則。

### 步驟 3：獲取您的專案 API 金鑰
1. 在 Supabase 左側選單點選 **「Project Settings」**（齒輪圖示）➔ **「API」**（或 **「Data API」**）。
2. 複製以下兩個資訊：
   - **Project URL**（格式如：`https://xxxxxxxxxxxx.supabase.co`）
   - **Project API keys** 中的 **`anon` / `public` Key**（一串長字符 Token）

### 步驟 4：在 FIRE Flow 中填入並開始同步
1. 開啟 **FIRE Flow**（網頁版或 Android App）。
2. 點擊右上角的 **⚙️ 系統設定** ➔ 切換至 **「雲端多端同步」**。
3. 選擇 **「自訂 Supabase 資料庫」**（或在開發環境寫入 `.env`）：
   - 填入 **Supabase URL**
   - 填入 **Supabase Anon Key**
   - 輸入或生成您的 **個人專屬同步碼**（例如：`MY-FIRE-888`）
4. 點擊 **「連線並同步」**，恭喜！您的財務資料已全面由您自己的 Supabase 雲端資料庫安全守護！

---

## 🚀 本地開發與編譯指南 (Local Development)

### 1. 複製專案與安裝依賴

```bash
git clone https://github.com/lzwy1110/fire-finance-calculator.git
cd fire-finance-calculator

npm install
```

### 2. 環境變數設定 (選填)

若您希望本機預設接入您的 Supabase，可在專案根目錄建立 `.env` 檔案：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. 啟動本機開發伺服器

```bash
npm run dev
```

開啟瀏覽器並造訪 `http://localhost:5173` 即可進行開發與測試。

### 4. 編譯生產版本

```bash
npm run build
```

### 5. Android APK 同步與打包 (Capacitor)

```bash
# 1. 將編譯產物同步至 Android 原生專案
npx cap sync android

# 2. 開啟 Android Studio
npx cap open android

# 3. 或直接透過 Gradle 命令列打包 Debug APK
cd android
./gradlew assembleDebug
```
編譯完成的 APK 位於：`android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 📱 下載 Android APK

想直接在手機上安裝體驗完整功能？
- 前往本專案的 [GitHub Releases 頁面](https://github.com/lzwy1110/fire-finance-calculator/releases) 下載最新版 `app-release.apk`。

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 授權開源，歡迎自由使用、二次開發與分發。

---

<div align="center">
  <sub>Made with ❤️ for the FIRE Community. 祝大家早日實現財務自由！🔥</sub>
</div>
