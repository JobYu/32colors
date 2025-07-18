# Color by Numbers - 像素級數位填色遊戲

一個基於 Web 的互動式像素級數位填色遊戲，使用者可以上傳圖片。系統會自動將圖片轉換為像素級數位填色遊戲。每個像素都是一個可點擊的填色區域。

## 🎨 功能特性

### 核心功能
- **圖片匯入**: 支援本機檔案上傳
- **像素級精確**: 每個像素都是一個獨立的可點擊填色區域
- **智慧顏色量化**: 自動將複雜圖片簡化為可管理的調色盤
- **高倍放大顯示**: 遊戲開始時自動放大500%-800%，便於操作像素級別的填色
- **互動式填色**: 點擊像素區域進行填色，支援縮放和平移
- **即時進度**: 顯示填色進度和完成狀態
- **顏色圖例**: 顯示數字與顏色的對應關係

### 互動體驗
- **極致縮放**: 支援高達5000%的縮放，檢視單一像素細節
- **精確點擊**: 像素級精確的點擊偵測和填色
- **智慧顯示**: 根據縮放級別自動顯示/隱藏像素數字和邊框
- **平移功能**: 拖曳移動畫布視圖
- **進度追蹤**: 即時顯示完成進度
- **重設功能**: 一鍵重新開始遊戲

### 像素級遊戲特色
- **1:1像素對應**: 原圖每個像素對應遊戲中一個填色格子
- **精確填色**: 像素級精確度，完美還原原圖

## 🛠️ 技術堆疊

### 前端技術
- **HTML5**: 頁面結構和 Canvas 繪圖
- **CSS3**: 現代化 UI 設計和響應式佈局
- **JavaScript (ES6+)**: 核心遊戲邏輯和互動
- **Canvas API**: 影像處理和遊戲渲染

### 核心演算法
- **顏色量化**: K-means 分群和中位切割演算法
- **影像處理**: 像素資料分析和顏色空間轉換
- **座標轉換**: 縮放平移狀態下的精確座標對應

## 📁 專案結構

```
pixel-study/
├── index.html              # 主頁面
├── css/
│   ├── style.css           # 主樣式檔案
│   └── responsive.css      # 響應式樣式
├── js/
│   ├── main.js             # 主應用程式邏輯
│   ├── imageProcessor.js   # 影像處理模組
│   ├── gameEngine.js       # 遊戲引擎
│   ├── canvasRenderer.js   # Canvas 渲染器
│   ├── colorQuantizer.js   # 顏色量化演算法
│   └── utils.js            # 工具函式
├── assets/
│   ├── icons/              # 圖示資源
│   └── sample-images/      # 範例圖片
├── server/                 # 可選的後端代理
│   ├── server.js           # Node.js 伺服器
│   └── package.json        # 後端依賴
└── README.md               # 專案說明
```

## 🚀 快速開始

### 方法一：直接執行（推薦）
1. 複製或下載專案到本機
2. 使用現代瀏覽器開啟 `index.html`
3. 開始享受數位填色遊戲！

### 方法二：本機伺服器執行
```bash
# 使用 Python 啟動本機伺服器
python -m http.server 8000

# 或使用 Node.js
npx http-server

# 然後造訪 http://localhost:8000
```

### 方法三：啟用後端代理（解決 CORS 問題）
```bash
cd server
npm install
npm start

# 後端將在 http://localhost:3000 執行
```

## 🎮 使用說明

1. **匯入圖片**
   - 點擊「選擇檔案」上傳本機圖片（推薦小尺寸圖片，如8x8到64x64像素）

2. **產生像素填色遊戲**
   - 系統會自動處理圖片並產生像素級填色遊戲
   - 遊戲會自動放大到500%-800%以便操作

3. **開始填色**
   - 每個像素都是一個可點擊的填色區域
   - 使用滑鼠滾輪縮放檢視像素細節（最高5000%）
   - 點擊灰色像素中的數字進行填色
   - 參考右側顏色圖例了解數字對應的顏色

4. **遊戲控制**
   - 拖曳移動畫布視圖
   - 使用控制按鈕重設或檢視原圖
   - 當縮放級別足夠高時會顯示像素數字

## 🌟 進階功能

### 演算法最佳化
- **智慧顏色選擇**: 基於視覺重要性的顏色量化
- **自適應網格**: 根據圖片複雜度調整網格密度
- **效能最佳化**: Web Workers 處理大型圖片

### 使用者體驗
- **進度儲存**: 本機儲存遊戲進度
- **多種難度**: 簡單、中等、困難模式
- **分享功能**: 匯出完成的作品

## 🐛 故障排除

### 常見問題
1. **圖片無法載入**: 嘗試使用本機檔案
2. **CORS 錯誤**: 啟用後端代理伺服器
3. **效能問題**: 嘗試使用較小的圖片或降低顏色數量

### 瀏覽器相容性
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 專案
2. 建立功能分支
3. 提交變更
4. 推送到分支
5. 建立 Pull Request

## 📄 版權許可

本軟體根據 GNU 通用公共授權條款第3版（GPLv3）授權。詳情請參閱 `LICENSE` 檔案。

## 🙏 致謝

感謝所有為這個專案做出貢獻的開發者和使用者！

---

**開始您的數位填色之旅吧！** 🎨✨ 