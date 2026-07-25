# 架構說明

本專案維持「不需建置程序即可部署至 GitHub Pages」的靜態前端結構；根目錄的 `index.html` 是唯一主入口，Flask 後端則獨立提供 `/api`。

```
index.html
assets/
  data/                 ICD、縮寫與抗生素 CSV
  images/               工具頁使用的圖片
styles/
  app.css               主入口樣式
scripts/
  app.js                主入口初始化、頁面與頁籤切換
  icd-search.js         ICD 載入、搜尋與排序
  antibiotic-search.js  抗生素資料搜尋
  csv-loader.js         CSV 與文字工具
  clipboard.js          剪貼簿工具
  check-*.mjs           本機品質檢查
pages/
  roster.html           急診預假系統
  scheduler.html        急診排班系統
  tools/
    Surgery_ICD.html
    SER_image.html
    DV_image.html
    trauma_system.html
docs/
  ARCHITECTURE.md
```

## 入口

`index.html` 以 iframe 載入 `pages/tools/` 中的工具頁。獨立工具與排班頁僅保留在 `pages/` 或 `pages/tools/`；根目錄舊網址不再提供相容轉址。

工具頁仍保有各自的內嵌 CSS 與 JavaScript，避免不同醫療表單的樣式互相影響。後續若某工具有穩定的共用行為，再抽取成其專屬的 `styles/`、`scripts/` 檔案。

## 模組責任

| 模組 | 責任 | 不應負責 |
| --- | --- | --- |
| `scripts/app.js` | 主入口初始化、頁面與頁籤切換、共用按鈕事件 | CSV 搜尋演算法、資料轉換 |
| `scripts/icd-search.js` | ICD 載入、比對、排序與結果呈現 | 其他頁面的介面控制 |
| `scripts/antibiotic-search.js` | 抗生素資料載入與搜尋 | 主頁導覽 |
| `scripts/csv-loader.js` | 通用 CSV 載入與文字工具 | 特定醫療資料的商業邏輯 |
| `scripts/clipboard.js` | 現代／備援複製行為與成功提示 | 頁面內容格式化 |

## 本機檢查

執行 `npm run check` 可檢查 UTF-8、HTML 本機連結、JavaScript 模組與 Python 語法。檔案搬遷後，應先執行此命令，再開啟首頁與受影響工具頁手動驗證。
