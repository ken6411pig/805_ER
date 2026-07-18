# 架構說明與整理路線

## 現況

網站是無建置程序的靜態前端。`index.html` 載入 `css/app.css` 與 `js/app.js`，並在單一頁面中切換病歷範本、ICD、抗生素、筆記等區塊。`app.js` 再載入 ICD、抗生素、CSV 與剪貼簿模組。

```
index.html
  ├─ css/app.css
  ├─ js/app.js
  │   ├─ js/icd-search.js ───── assets/data/ICD_10_CM.csv、medical_abbreviations.csv
  │   ├─ js/antibiotic-search.js ─ assets/data/antibiotic_dosage.csv
  │   ├─ js/csv-loader.js
  │   └─ js/clipboard.js
  └─ iframe
      ├─ Surgery_ICD.html
      ├─ SER_image.html
      ├─ DV_image.html
      └─ trauma_system.html
```

`roster.html` 與 `scheduler.html` 目前是可獨立開啟的工具，不由主入口載入。各工具頁都有自己的內嵌樣式與腳本，因此可單獨運作，但不容易重用樣式或共同維護。

## 主要維護風險

1. 頁面仍集中在根目錄，新增工具後不容易辨識用途。
2. 多個獨立工具頁內嵌 CSS 與 JavaScript，修正共通行為時須重複修改。
3. `index.html` 同時承擔版面、內容與工具整合責任，持續擴充會變得難以閱讀。
4. 尚未有自動檢查；檔案移動時，iframe、圖片與 CSV 的相對路徑容易失效。

## 建議目標結構

資料與圖片已依下列結構整理；頁面與腳本目錄則保留作為下一階段的目標。保留根目錄的 `index.html` 可維持原網址與入口不變。

```
index.html
assets/
  data/       ICD、縮寫、抗生素 CSV
  images/     人體與其他圖片
styles/
  app.css     主入口共用樣式
scripts/
  app.js      主入口協調與事件綁定
  modules/    搜尋、CSV、剪貼簿等可重用功能
pages/
  tools/      Surgery ICD、SER、DV、Trauma 等工具頁
  roster.html
  scheduler.html
docs/
  ARCHITECTURE.md
```

## 建議遷移順序

1. **已完成：資料與圖片目錄**：CSV 已移至 `assets/data/`、圖片已移至 `assets/images/`，並已更新引用路徑。
2. **整理主入口內容**：把 `index.html` 的各功能區塊拆成可辨識的片段或各自的頁面，再保留 `app.js` 作為唯一的頁面切換協調層。
3. **逐頁改造獨立工具**：從最常維護的工具開始，將內嵌 CSS/JS 抽至其專屬檔案；先不強行合併所有工具的樣式，避免互相覆蓋。
4. **加入基本驗證**：提供本機靜態伺服器與連結／資源路徑檢查，降低移動檔案後才發現功能失效的風險。

## 模組責任

| 模組 | 責任 | 不應負責 |
| --- | --- | --- |
| `app.js` | 主入口初始化、頁面與頁籤切換、共用按鈕事件 | CSV 搜尋演算法、資料轉換 |
| `icd-search.js` | ICD 載入、比對、排序與結果呈現 | 其他頁面的介面控制 |
| `antibiotic-search.js` | 抗生素資料載入與搜尋 | 主頁導覽 |
| `csv-loader.js` | 通用 CSV 載入與文字工具 | 特定醫療資料的商業邏輯 |
| `clipboard.js` | 現代／備援複製行為與成功提示 | 頁面內容格式化 |

## 遷移守則

- 每一批路徑修改都先測試主入口與受影響工具頁，確認後再進下一批。
- 所有新文字檔統一採 UTF-8；避免不同編碼造成繁體中文顯示異常。
- 先維持可直接開啟的靜態網站特性；只有確定需要打包、測試或元件化時才引入前端框架。
