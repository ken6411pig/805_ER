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

async function copyNote() {
    const noteText = document.getElementById('noteText').value;
    const button = document.getElementById('copyNoteButton');
    try {
        await copyText(noteText, () => flashButton(button));
    } catch (error) {
        window.alert(error.message || '複製失敗，請手動複製');
    }
}

function clearNote() {
    if (window.confirm('確定要清除所有備忘內容嗎？')) {
        document.getElementById('noteText').value = '';
    }
}

function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    const button = document.getElementById('toggleChatbotBtn');
    const isHidden = window.getComputedStyle(container).display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    button.textContent = isHidden ? '隱藏助手' : '顯示助手';
    button.classList.toggle('button-success', !isHidden);
    button.classList.toggle('button-secondary', isHidden);
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

    document.getElementById('copyNoteButton')?.addEventListener('click', copyNote);
    document.getElementById('clearNoteButton')?.addEventListener('click', clearNote);
    document.getElementById('toggleChatbotBtn')?.addEventListener('click', toggleChatbot);
}

function initializePage() {
    bindPageEvents();
    updateCertificateDate();
    initIcdSearch();
    initAntibioticSearch();
    showPage('ICD_code');
}

initializePage();
