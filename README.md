<div align="center">

# 🔥 FIRE Flow
### 現代化 FIRE 財務自由計算器・美股台股投資庫存・雙幣資產管理工具

*精準規劃退休時程，整合台美股投資庫存、雙幣現金池、即時匯率換匯、雙軌記帳與 Android 桌面速記小工具。*

<br/>

[![Download APK](https://img.shields.io/badge/Download-Android_APK-emerald?style=for-the-badge&logo=android&logoColor=white)](https://github.com/lzwy1110/fire-finance-calculator/releases)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.1-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 📖 專案簡介 (Overview)

**FIRE Flow** 是一款專為追求 **FIRE（Financial Independence, Retire Early，財務獨立、提早退休）** 族群打造的全方位資產管理系統。

不同於傳統單純記錄收支的記帳軟體，**FIRE Flow** 將 **日常收支記帳**、**台美股投資庫存即時行情**、**美金/台幣雙幣現金池**、**即時匯率換匯** 與 **FIRE 4% 安全提領法則** 深度融合，自動即時計算總淨資產與退休倒數進度。

---

## 🌟 核心特色 (Core Features)

### 💱 1. 雙幣獨立現金池與即時匯率換匯
- **獨立儲備帳戶**：將現金資產池拆分為 **台幣現金池 (`TWD`)** 與 **美金現金池 (`USD`)**，資產分類更清晰。
- **啟動自動抓取即時匯率**：每次開啟 App 自動抓取最新 `USD/TWD` 牌告匯率，換算總淨資產精確無時差。
- **專屬雙幣換匯轉帳彈窗**：
  - 支援 `TWD ➔ USD` 與 `USD ➔ TWD` 雙向自由換匯。
  - 提供 `25%`、`50%`、`75%`、`全部 (100%)` 快速帶入金額按鈕。
  - 支援選填銀行手續費與自訂實際成交匯率微調。
  - 即時預覽換匯前後的資產池變化，保證換匯後總淨資產平穩過渡不失真。
- **精準幣別扣抵**：
  - 美股交易直接從 **美金現金池** 扣存（USD）。
  - 台股交易直接從 **台幣現金池** 扣存（TWD）。
  - 日常收支預設連動台幣現金池，杜絕跨幣別造成的混亂匯損。

---

### 📈 2. 台股 / 美股投資庫存與專業 K 線圖
- **即時行情與智慧搜尋**：支援搜尋台灣上市上櫃（TWSE / TPEX）與美股（NYSE / NASDAQ）之股票、ETF 中文名稱與即時股價。
- **完整買賣對帳與投報率**：
  - 自動計算持股數量、加權買入均價、持股市值。
  - 精算已實現損益（Realized P&L）、未實現損益與未實現 ROI% 報酬率。
- **專業互動走勢圖與 K 線圖**：
  - 支援切換 **平滑折線圖** 與 **專業開高低收 K 線圖 (Candlestick Chart)**。
  - 內建 5 日均線（MA5）、20 日月線（MA20）指標，清楚掌握市場趨勢。
- **現金流雙向連動與時光機**：
  - 買入現股自動扣除對應幣別現金；賣出現股自動回存對應幣別現金。
  - **歷史建倉標記**：使用前已持有的股票可勾選「歷史已有持股」，不重複扣除當前現金。
  - **防裸賣時序時光機**：嚴密校驗交易歷史時序，防止歷史回溯造成的負庫存賣出。

---

### 🔥 3. FIRE 4% 法則退休倒數與動態情境模擬
- **精確退休倒數計時**：以天、月、年為單位，動態精算距離目標 FIRE 的剩餘時間與預計達成日期。
- **多維度 FIRE 指標**：
  - **標準 FIRE (Rule of 25)**：以 4% 安全提領率計算目標退休資產（年支出 × 25）。
  - **Lean FIRE (簡約型)**：以基礎生活花費（80% 支出）計算的極簡退休目標。
  - **Fat FIRE (富足型)**：以充裕生活花費（150% 支出）計算的高品質退休目標。
  - **Coast FIRE (躺平型)**：計算當前年齡所需的本金，靠現有資產複利即可自然成長至退休目標。
- **資產配置比例條**：實時呈現「台幣現金 + 美金現金折算」vs「股票市值」的資產佔比。
- **即時參數模擬器**：支援即時調整預估年化投資報酬率、預期通膨率、安全提領率（SWR）與目標退休年齡，動態觀察退休達成率變化。

---

### 📝 4. 智慧雙軌收支記帳與分類管理
- **四大記帳模式**：支援「支出」、「收入」、「投資」、「稅金規費」完整分流記錄。
- **彈性分類管理系統**：
  - 支援自由新增自訂大類、編輯子分類項目。
  - 提供大類管理與刪除功能，並具備最後大類保護機制。
- **常用消費快捷按鈕 (Quick Presets)**：自訂常用金額與消費項目，一鍵快速記帳。
- **多維度財務圖表分析**：
  - 支出大類佔比圓餅圖。
  - 近半年收支/投資/稅金趨勢柱狀圖。
  - 20 年淨資產複利累積預測曲線。
- **月度 / 年度財務報表**：月報表與年報表快速切換，掌握每月儲蓄率與財務健康評級。
- **CSV 明細匯出**：一鍵將所有收支明細匯出為 CSV 試算表備份。

---

### ☁️ 5. Supabase 跨裝置雙向無感同步
- **專屬 6 位數同步碼**：支援透過隨機生成或自訂的 6 位數同步碼，在電腦網頁端、筆電與手機 Android 端無縫雙向同步。
- **智能後台定時對齊**：定時刷新與視窗焦點切換時自動拉取最新資料。
- **防覆蓋保護**：背景自動同步採純讀取拉取（Pure Read），只有在使用者明確進行新增、修改、刪除時才執行主動寫入。
- **離線優先 (Offline-First)**：未連網或離線時，資料自動保存在本地 LocalStorage，連網後立即無縫銜接。

---

### 📱 6. Android 原生支援與桌面速記小工具 (Widget)
- **Android 原生應用**：採用 Capacitor 封裝，提供極速流暢的原生 Android APK 體驗。
- **專屬 Android 桌面 Widget**：
  - 提供 Android 桌面小工具，免開 App 即可在桌面一鍵完成速記。
  - 支援自訂桌面 Widget 顯示的快捷分類按鈕。
  - 桌面記帳數據零延遲寫入並同步至 App 資料庫。

---

## 🛠️ 技術架構 (Tech Stack)

| 領域 | 技術選型 | 說明 |
| :--- | :--- | :--- |
| **前端核心** | React 18 / TypeScript | 元件化架構、嚴格型別安全 |
| **構建工具** | Vite 6 | 極速開發伺服器與模組熱替換 |
| **樣式設計** | Tailwind CSS / CSS3 | 現代響應式佈局、暗黑主題調色盤 |
| **圖表可視化** | Recharts | 互動式圓餅圖、柱狀圖與走勢曲線 |
| **行動端框架** | Capacitor 8 | Web 封裝至 Android 原生架構與外掛橋接 |
| **雲端資料庫** | Supabase (PostgreSQL) | 即時資料同步、雙向 Upsert 與安全儲存 |
| **行情與匯率 API** | TWSE / TPEX / Yahoo Finance / Open Exchange | 即時股票報價、K 線歷史走勢與即時匯率 |

---

## 📱 下載與安裝 (Download Android APK)

若您想直接在 Android 手機上體驗完整功能（含桌面 Widget 速記）：

1. 前往本專案的 [GitHub Releases 頁面](https://github.com/lzwy1110/fire-finance-calculator/releases)。
2. 下載最新版本的 `app-release.apk`。
3. 在 Android 手機上點擊安裝即可開始使用。

---

## 🚀 本地開發與構建指南 (Local Setup)

### 1. 複製專案與安裝依賴

```bash
# 複製專案儲存庫
git clone https://github.com/lzwy1110/fire-finance-calculator.git
cd fire-finance-calculator

# 安裝相依套件
npm install
```

### 2. 啟動本機開發伺服器

```bash
npm run dev
```

開啟瀏覽器並造訪 `http://localhost:5173` 即可檢視應用。

### 3. 編譯生產版本

```bash
npm run build
```

### 4. 同步至 Android 專案

```bash
# 將 Vite 編譯產物同步至 Android 原生目錄
npx cap sync android

# 開啟 Android Studio 進行偵錯或打包 APK
npx cap open android
```

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 授權開源。歡迎自由使用、修改與分發。

---

<div align="center">
  <sub>Made with ❤️ for the FIRE Community. 祝大家早日實現財務自由！</sub>
</div>
