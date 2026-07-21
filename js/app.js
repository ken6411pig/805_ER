import { activateAntibioticSearch, initAntibioticSearch } from './antibiotic-search.js';
import { copyText, flashButton, flashCopyLine } from './clipboard.js';
import { initIcdSearch } from './icd-search.js';

function showPage(pageId) {
    document.querySelectorAll('.content').forEach(content => {
        content.classList.toggle('hidden', content.id !== pageId);
    });

    if (pageId === 'Plan') updateCertificateDate();
    if (pageId === 'Antibiotic_Dosage') {
        activateAntibioticSearch()?.catch(() => {});
    }
}

function showPETab(tabName) {
    document.querySelectorAll('.pe-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== tabName);
    });
    document.querySelectorAll('.pe-tabs [data-tab]').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
}

async function copyLine(element) {
    try {
        await copyText(element.textContent.trim(), () => flashCopyLine(element));
    } catch (error) {
        window.alert(error.message || '複製失敗，請手動複製');
    }
}

async function copyPEContent(button) {
    const peContent = button.closest('.pe-content');
    const paragraph = peContent?.querySelector('p');
    if (!paragraph) return;

    const cleanedContent = paragraph.textContent
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');

    try {
        await copyText(cleanedContent, () => flashButton(button));
    } catch (error) {
        window.alert(error.message || '複製失敗，請手動複製');
    }
}

function createCertificateLine(text) {
    const line = document.createElement('span');
    line.className = 'copy-line';
    line.title = '點擊複製此行';
    line.textContent = text;
    return line;
}

function updateCertificateDate() {
    const certificateElement = document.getElementById('certificateText');
    if (!certificateElement) return;

    const today = new Date();
    const taiwanYear = today.getFullYear() - 1911;
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const dateTime = `民國${taiwanYear}年${month}月${day}日${hours}時${minutes}分`;

    const lines = [
        `病人因上述疾病於${dateTime}至${dateTime}期間至本院急診就診並接受檢查，建議休養三日並門診追蹤複查。`,
        `病人因上述疾病於${dateTime}至${dateTime}期間至本院急診就診並接受傷口縫合 針，建議門診追蹤複查。`,
        `病人於${dateTime}至本院急診時無呼吸心跳(OHCA)，於急診行高級心臟救命術(ACLS)仍無恢復自發性呼吸心跳(ROSC)，於${dateTime}停止急救，病人死亡。`
    ];
    certificateElement.replaceChildren(...lines.map(createCertificateLine));
}

function bindPageEvents() {
    document.querySelector('.sidebar')?.addEventListener('click', event => {
        const item = event.target.closest('[data-page]');
        if (item) showPage(item.dataset.page);
    });

    document.querySelector('.pe-tabs')?.addEventListener('click', event => {
        const tab = event.target.closest('[data-tab]');
        if (tab) showPETab(tab.dataset.tab);
    });

    document.querySelector('.main-content')?.addEventListener('click', event => {
        const line = event.target.closest('.copy-line');
        if (line) copyLine(line);

        const peButton = event.target.closest('.pe-content .copy-button');
        if (peButton) copyPEContent(peButton);
    });
}

// 全新設計：AI 圖片辨識專用邏輯
function initAiVisionAssistant() {
    const aiPage = document.getElementById('Note');
    const pasteZone = document.getElementById('pasteZone');
    const pasteInstruction = document.getElementById('pasteInstruction');
    const imagePreview = document.getElementById('imagePreview');
    const aiPromptInput = document.getElementById('aiPromptInput');
    const sendToAiBtn = document.getElementById('sendToAiBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const aiResultContent = document.getElementById('aiResultContent');
    const copyAiResultBtn = document.getElementById('copyAiResultBtn');

    if (!pasteZone) return;

    let currentBase64Image = null;

    // 全局與區域貼上事件監聽
    function handlePaste(e) {
        // 如果目前不是顯示 AI 頁面，則不處理貼上事件
        if (aiPage.classList.contains('hidden')) return;

        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                displayImagePreview(blob);
                e.preventDefault(); 
                break;
            }
        }
    }

    pasteZone.addEventListener('paste', handlePaste);
    window.addEventListener('paste', handlePaste);

    function displayImagePreview(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            currentBase64Image = event.target.result; 
            imagePreview.src = currentBase64Image;
            imagePreview.style.display = 'block';
            pasteInstruction.style.display = 'none'; // 隱藏提示文字
        };
        reader.readAsDataURL(file);
    }

    // 一鍵清除功能
    clearAllBtn.addEventListener('click', function() {
        currentBase64Image = null;
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        pasteInstruction.style.display = 'block'; // 顯示提示文字
        aiPromptInput.value = '';
        aiResultContent.innerHTML = '<span style="color: #999; font-style: italic;">等待貼上圖片並傳送辨識...</span>';
        copyAiResultBtn.style.display = 'none';
    });

sendToAiBtn.addEventListener('click', async function() {
        console.log("--- 偵錯開始 ---");
        console.log("1. 成功觸發按鈕點擊事件！");

        if (!currentBase64Image) {
            console.log("2. 檢查結果：沒有圖片");
            window.alert('⚠️ 請先按下 Ctrl+V 貼上截圖，再傳送辨識！');
            return;
        }
        console.log("2. 檢查結果：有圖片，準備改變畫面...");

        try {
            // 如果是在這一步之前就報錯，代表上面有殘留舊變數沒刪乾淨
            copyAiResultBtn.style.display = 'none';
            aiResultContent.innerHTML = '<span style="color: #007bff; font-weight: bold;">⏳ AI 正在辨識處理中，請稍候...</span>';
            console.log("3. 畫面已成功切換為漏斗！準備呼叫 API...");

            // ⚠️ 請記得把這裡改成你的真實 Render 網址
            const backendURL = 'https://eight05-er.onrender.com/api/chat'; 
            console.log("4. 目標網址是：", backendURL);

            const response = await fetch(backendURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "", image: currentBase64Image }) 
            });

            console.log("5. 伺服器有回應了！狀態碼：", response.status);

            if (!response.ok) {
                throw new Error('伺服器回應錯誤，狀態碼：' + response.status);
            }
            
            const data = await response.json();
            console.log("6. 成功解讀伺服器資料！準備顯示在畫面上...");
            
            aiResultContent.innerText = data.reply;
            copyAiResultBtn.style.display = 'inline-block';
            console.log("--- 偵錯結束，任務完成 ---");
            
        } catch (error) {
            console.error("❌ 抓到錯誤了！詳細原因：", error);
            aiResultContent.innerHTML = `<span style="color: #dc3545; font-weight: bold;">⚠️ 執行發生錯誤：${error.message}</span>`;
        }
    });

    // 複製 AI 結果
    copyAiResultBtn.addEventListener('click', async function() {
        const textToCopy = aiResultContent.innerText;
        if (!textToCopy) return;

        try {
            await copyText(textToCopy, () => flashButton(copyAiResultBtn));
        } catch (error) {
            window.alert('複製失敗，請手動選取複製');
        }
    });
}

function initializePage() {
    bindPageEvents();
    updateCertificateDate();
    initIcdSearch();
    initAntibioticSearch();
    initAiVisionAssistant(); // 初始化全新的圖片辨識助手
    showPage('ICD_code');
}

initializePage();
