# 805_ER

急診臨床工作輔助的靜態網站。主入口提供病歷範本、ICD-10-CM 與抗生素查詢，並整合多個獨立工具頁。

## 使用方式

本專案不需要建置步驟。以靜態網站伺服器開啟專案根目錄後，從 `index.html` 進入即可。因為 ICD 與抗生素資料是由瀏覽器讀取 CSV，請不要直接以 `file://` 開啟。

## 目前結構

```
index.html                 主入口與主要工作區
css/app.css                主入口共用樣式
js/app.js                  頁籤、複製、筆記與初始化流程
js/icd-search.js           ICD-10-CM 搜尋與排序
js/antibiotic-search.js    抗生素劑量搜尋
js/csv-loader.js           CSV 讀取、醒目標示等共用工具
js/clipboard.js            複製文字的共用工具
assets/data/ICD_10_CM.csv  ICD-10-CM 資料
assets/data/medical_abbreviations.csv
                          醫學縮寫資料
assets/data/antibiotic_dosage.csv
                          抗生素劑量資料
Surgery_ICD.html           外嵌式獨立工具
SER_image.html             外嵌式獨立工具
DV_image.html              外嵌式獨立工具
trauma_system.html         外嵌式獨立工具
roster.html                獨立值班表工具
scheduler.html             獨立排班工具
assets/images/             工具頁圖片資源
```

詳細的功能邊界與重構路線請見 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 資料來源

| 功能 | 資料來源 | 版本／更新日期 |
| --- | --- | --- |
| ICD-10-CM 查詢 | 衛生福利部網站「2023 年版 ICD-10-CM」 | 114.05.09 更新 |
| 抗生素劑量查詢 | 《熱病》 | 2022 年版 |

## 維護原則

- 主入口的共用互動放在 `js/`，不要再把新的主入口邏輯寫進 `index.html`。
- 資料檔變更時維持既有 CSV 欄位名稱，避免搜尋模組失效。
- 將獨立工具逐頁遷移到共用架構；每完成一頁即確認其可直接開啟，也可從主入口使用。
- 提交前確認主入口、ICD 搜尋、抗生素搜尋以及各內嵌工具連結均可正常使用。
