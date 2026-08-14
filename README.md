<div align="center">

# 🔥 FIRE Flow
### 簡單好用的 FIRE 財務自由計算器與資產管理工具

*輕鬆規劃退休進度，支援雙軌收支記帳與台美股投資庫存紀錄。*

[![Download APK](https://img.shields.io/badge/Download-Android_APK-emerald?style=for-the-badge&logo=android&logoColor=white)](https://github.com/lzwy1110/fire-finance-calculator/releases)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.1-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 核心功能 (Features)

### 📊 1. FIRE 退休進度與 4% 法則模擬
- **退休目標資產計算**：依據月收入、月支出、投資報酬率與預估通膨率，試算到達 FIRE 財務自由所需的總目標金額。
- **4% 安全提領率**：計算退休後每年可安全提領的生活費。
- **淨資產即時連動**：自動將現金儲蓄與當前股票庫存總市值連動，顯示目前退休達成率。

### 📈 2. 台股 / 美股投資庫存與交易紀錄
- **即時報價搜尋**：支援搜尋與即時抓取台股（如 `0050`, `0056`, `00878`, `2330`）與美股（`AAPL`, `NVDA`, `TSLA`）中文名稱與股價(目前因伺服器在海外故搜尋速度較慢，Android端不影響)。
- **買賣對帳單計算**：紀錄買進與賣出交易，自動計算加權平均成本、已實現損益與未實現報酬率。
- **現金流雙向連動**：
  - 賣出股票：收益自動歸還至現金儲蓄。
  - 買進股票：購入成本自動從現金儲蓄扣除。
  - 歷史現有持股標記：使用前已持有的老股票可勾選「歷史建倉」，免重複扣除現金。

### 💵 3. 雙軌收支管理與分類
- **收支與稅金記帳**：支援收入、支出、稅金規費紀錄。
- **自訂類別**：自由編輯主副分類、圖示與主題顏色。
- **快捷按鈕**：自訂常用消費按鈕，一鍵快速記帳。

### 📱 4. Android App 與桌面小工具
- **桌面小工具一秒速記**：專屬 Android 桌面 Widget，點擊即可完成記帳，數據自動同步至 App。
- **跨平台支援**：支援電腦網頁端與 Android 原生應用。

### ☁️ 5. Supabase 雙向雲端同步 (選填)
- **跨裝置對齊**：於設定中填入個人的 Supabase 資料庫憑證後，即可開啟多設備資料同步。
- **無感背景刷新**：連線狀態下，支援背景定時與切換視窗自動對齊最新資料。
- **離線優先**：未連線雲端時，預設採用本地安全儲存 (LocalStorage)，資料完全保留在您的裝置上。

### 🎨 6. 玻璃質感 UI
- 深色主題配色，搭配霧化玻璃質感與客製主題色切換。

---

## 📱 下載與安裝 (Download APK)

若您想直接在 Android 手機上使用，可至 [GitHub Releases](https://github.com/lzwy1110/fire-finance-calculator/releases) 下載最新版 `.apk` 檔案安裝。

---

## 🚀 本地開發 (Local Setup)

```bash
# 1. 複製專案
git clone https://github.com/lzwy1110/fire-finance-calculator.git
cd fire-finance-calculator

# 2. 安裝套件
npm install

# 3. 啟動開發伺服器
npm run dev
```

---

## 📄 授權 (License)

[MIT License](LICENSE)
