import { appendHighlightedText, loadCsv, showDataError } from './csv-loader.js';

const state = {
    headers: [],
    records: [],
    loadPromise: null,
    ready: false,
    searchTimer: null
};

const elements = {};

function normalizeDrugName(value) {
    return String(value || '').toLowerCase().replace(/[\s.\-]/g, '');
}

function renderResults(rows, searchTerm) {
    elements.results.replaceChildren();
    if (!rows.length) {
        const message = document.createElement('p');
        message.textContent = '找不到符合的藥物';
        elements.results.appendChild(message);
        elements.count.textContent = '找到 0 筆符合的資料';
        return;
    }

    const table = document.createElement('table');
    table.className = 'antibiotic-results-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    state.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    rows.forEach(row => {
        const tr = tbody.insertRow();
        row.forEach((value, cellIndex) => {
            const td = tr.insertCell();
            if (cellIndex < 2) {
                appendHighlightedText(td, value, [searchTerm]);
            } else {
                td.className = 'dosage-cell';
                td.textContent = value == null ? '' : String(value);
            }
        });
    });

    elements.results.appendChild(table);
    elements.count.textContent = `找到 ${rows.length} 筆符合的藥物資料`;
}

function search() {
    const searchTerm = elements.input.value.trim().toLowerCase();
    elements.results.replaceChildren();
    elements.count.textContent = '';
    elements.notice.textContent = '';

    if (!searchTerm) {
        return;
    }
    if (!state.ready) {
        elements.notice.textContent = '抗生素資料仍在載入，請稍候';
        return;
    }

    const normalizedTerm = normalizeDrugName(searchTerm);
    const matches = state.records
        .filter(record =>
            record.genericName.includes(searchTerm) ||
            record.brandName.includes(searchTerm) ||
            record.normalizedGeneric.includes(normalizedTerm) ||
            record.normalizedBrand.includes(normalizedTerm)
        )
        .map(record => record.row);
    renderResults(matches, searchTerm);
}

function scheduleSearch() {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(search, 300);
    elements.clearButton.classList.toggle('visible', elements.input.value.length > 0);
}

function clearSearch() {
    window.clearTimeout(state.searchTimer);
    elements.input.value = '';
    elements.results.replaceChildren();
    elements.count.textContent = '';
    elements.notice.textContent = '';
    elements.clearButton.classList.remove('visible');
    elements.input.focus();
}

async function loadData() {
    elements.notice.textContent = '抗生素資料載入中...';
    const rows = await loadCsv('assets/data/antibiotic_dosage.csv');
    state.headers = rows[0] || [];
    state.records = rows.slice(1).map(row => {
        const genericName = String(row[0] || '').toLowerCase();
        const brandName = String(row[1] || '').toLowerCase();
        return {
            row,
            genericName,
            brandName,
            normalizedGeneric: normalizeDrugName(genericName),
            normalizedBrand: normalizeDrugName(brandName)
        };
    });
    state.ready = true;
    if (elements.input.value.trim()) search();
}

export function initAntibioticSearch() {
    elements.input = document.getElementById('antibioticSearchInput');
    elements.clearButton = document.getElementById('antibioticSearchClearButton');
    elements.results = document.getElementById('antibioticResults');
    elements.count = document.getElementById('antibioticCountInfo');
    elements.notice = document.getElementById('antibioticMinLengthNotice');
    if (!elements.input || !elements.clearButton) return;
    elements.input.addEventListener('input', scheduleSearch);
    elements.clearButton.addEventListener('click', clearSearch);
}

export function activateAntibioticSearch() {
    if (state.loadPromise || !elements.input) return state.loadPromise;
    state.loadPromise = loadData().catch(error => {
        console.error(error);
        showDataError(elements.results, `抗生素資料載入失敗：${error.message}`);
        elements.notice.textContent = '請確認 assets/data/antibiotic_dosage.csv 存在且可讀取';
        state.loadPromise = null;
        return null;
    });
    return state.loadPromise;
}
