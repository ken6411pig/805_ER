import { appendHighlightedText, loadCsv, showDataError } from './csv-loader.js';
import { copyText, flashButton } from './clipboard.js';

const INITIAL_RESULT_LIMIT = 15;

const state = {
    headers: [],
    records: [],
    abbreviations: new Map(),
    parentCategories: new Set(),
    activeHighlightTerms: [],
    currentResults: [],
    showingAll: false,
    ready: false,
    searchTimer: null
};

const elements = {};

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s.\-_,;:'"()\[\]{}/\\]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactText(value) {
    return normalizeText(value).replace(/[^a-z0-9\u3400-\u9fff]/g, '');
}

function containsWholePhrase(text, term) {
    if (!text || !term) return false;
    return /[\u3400-\u9fff]/.test(term)
        ? text.includes(term)
        : (` ${text} `).includes(` ${term} `);
}

function startsWithDelimitedTerm(field, term) {
    const rawField = String(field || '').normalize('NFKC').toLowerCase().trim();
    const rawTerm = String(term || '').normalize('NFKC').toLowerCase().trim();
    if (!rawField.startsWith(rawTerm)) return false;
    return /^\s*[,，:：;]/.test(rawField.substring(rawTerm.length));
}

function calculateTextScore(row, term) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return 0;

    const compactCode = compactText(row[0]);
    const compactTerm = compactText(term);
    const looksLikeIcdCode = /^[a-z]\d/i.test(compactTerm);

    if (looksLikeIcdCode) {
        if (compactCode === compactTerm) return 100;
        if (compactCode.startsWith(compactTerm)) return 90;
    }

    const isChineseTerm = /[\u3400-\u9fff]/.test(normalizedTerm);
    let bestScore = 0;

    [row[1] || '', row[2] || ''].forEach(field => {
        const normalizedField = normalizeText(field);
        if (!normalizedField) return;

        let score = 0;
        if (normalizedField === normalizedTerm) {
            score = 65;
        } else if (isChineseTerm && startsWithDelimitedTerm(field, term)) {
            score = 62;
        } else if (normalizedField.startsWith(`${normalizedTerm} `) ||
                   (isChineseTerm && normalizedField.startsWith(normalizedTerm))) {
            score = 60;
        } else if (containsWholePhrase(normalizedField, normalizedTerm)) {
            score = 50;
        } else {
            const keywords = normalizedTerm.split(/\s+/).filter(Boolean);
            const matchedKeywords = keywords.filter(keyword =>
                containsWholePhrase(normalizedField, keyword) || normalizedField.includes(keyword)
            ).length;

            if (keywords.length > 1 && matchedKeywords === keywords.length) {
                score = 45;
            } else if (matchedKeywords > 0) {
                score = Math.round(15 * matchedKeywords / keywords.length);
            } else if (normalizedField.includes(normalizedTerm)) {
                score = 12;
            }
        }

        bestScore = Math.max(bestScore, score);
    });

    const englishName = String(row[1] || '').toLowerCase();
    if (bestScore > 0 && /\bunspecified\b|\bnot specified\b/.test(englishName)) {
        bestScore += 2;
    }
    if (bestScore > 0 && /\binitial encounter\b/.test(englishName)) {
        bestScore += 1;
    }
    return bestScore;
}

function calculateDepthScore(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const dotIndex = normalizedCode.indexOf('.');
    if (dotIndex === -1) {
        return state.parentCategories.has(normalizedCode) ? 0 : 20;
    }

    const decimalLength = normalizedCode.substring(dotIndex + 1).length;
    if (decimalLength <= 1) return 20;
    if (decimalLength === 2) return 14;
    if (decimalLength === 3) return 8;
    return 4;
}

function recordMatches(record, searchTerms) {
    return searchTerms.some(term => {
        const rawTerm = String(term).toLowerCase();
        if (record.codeLower.includes(rawTerm) ||
            record.nameLower.includes(rawTerm) ||
            record.chineseLower.includes(rawTerm)) {
            return true;
        }

        const compactTerm = compactText(term);
        if (compactTerm && (
            record.compactCode.includes(compactTerm) ||
            record.compactName.includes(compactTerm) ||
            record.compactChinese.includes(compactTerm)
        )) {
            return true;
        }

        const keywords = normalizeText(term).split(/\s+/).filter(Boolean);
        if (keywords.length <= 1) return false;
        return [record.normalizedName, record.normalizedChinese]
            .some(field => keywords.every(keyword => field.includes(keyword)));
    });
}

function rankResults(records, searchTerms) {
    return records
        .map((record, originalIndex) => {
            const textScore = Math.max(...searchTerms.map(term =>
                calculateTextScore(record.row, term)
            ));
            const englishWordCount = record.normalizedName
                ? record.normalizedName.split(/\s+/).length
                : Number.MAX_SAFE_INTEGER;
            return {
                record,
                originalIndex,
                textScore,
                englishWordCount,
                depthScore: calculateDepthScore(record.row[0])
            };
        })
        .sort((a, b) =>
            b.textScore - a.textScore ||
            a.englishWordCount - b.englishWordCount ||
            b.depthScore - a.depthScore ||
            String(a.record.row[0] || '').localeCompare(String(b.record.row[0] || '')) ||
            a.originalIndex - b.originalIndex
        )
        .map(item => item.record.row);
}

function getHighlightTerms() {
    const candidates = [];
    state.activeHighlightTerms.forEach(term => {
        const cleanTerm = String(term || '').trim();
        if (!cleanTerm) return;
        candidates.push(cleanTerm);
        normalizeText(cleanTerm)
            .split(/\s+/)
            .filter(keyword => keyword.length >= 2)
            .forEach(keyword => candidates.push(keyword));
    });
    return candidates;
}

function createResultsTable(rows) {
    const table = document.createElement('table');
    table.className = 'icd-results-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    state.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    const highlightTerms = getHighlightTerms();
    rows.forEach(row => {
        const tr = tbody.insertRow();
        row.forEach((value, cellIndex) => {
            const td = tr.insertCell();
            if (cellIndex === 0) {
                td.className = 'icd-code-cell';
                td.tabIndex = 0;
                td.setAttribute('role', 'button');
                td.title = '點擊複製ICD碼';
                td.dataset.icdCode = String(value || '');
            }
            appendHighlightedText(td, value, highlightTerms);
        });
    });
    return table;
}

function renderResults() {
    elements.results.replaceChildren();
    const totalResults = state.currentResults.length;

    if (!totalResults) {
        const message = document.createElement('p');
        message.textContent = '找不到符合的結果';
        elements.results.appendChild(message);
        elements.count.textContent = '找到 0 筆符合的資料';
        return;
    }

    const visibleRows = state.showingAll
        ? state.currentResults
        : state.currentResults.slice(0, INITIAL_RESULT_LIMIT);
    elements.results.appendChild(createResultsTable(visibleRows));

    if (totalResults > INITIAL_RESULT_LIMIT) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'icd-results-toggle';
        toggle.dataset.action = 'toggle-results';
        toggle.textContent = state.showingAll
            ? `收合，只顯示前 ${INITIAL_RESULT_LIMIT} 筆`
            : `顯示全部 ${totalResults} 筆`;
        elements.results.appendChild(toggle);
    }

    elements.count.textContent = totalResults > INITIAL_RESULT_LIMIT
        ? `找到 ${totalResults} 筆符合的資料，目前顯示 ${visibleRows.length} 筆`
        : `找到 ${totalResults} 筆符合的資料`;
}

function search() {
    const originalTerm = elements.input.value.trim();
    const searchTerm = originalTerm.toLowerCase();
    elements.results.replaceChildren();
    elements.count.textContent = '';
    elements.notice.textContent = '';

    if (!state.ready) {
        elements.notice.textContent = 'ICD 資料仍在載入，請稍候';
        return;
    }

    const abbreviationTerms = state.abbreviations.get(searchTerm);
    const isKnownUppercaseAbbreviation = originalTerm === originalTerm.toUpperCase() &&
        Boolean(abbreviationTerms?.length);
    const chineseCount = (originalTerm.match(/[\u3400-\u9fff]/g) || []).length;

    if (searchTerm.length < 3 && !isKnownUppercaseAbbreviation && chineseCount < 2) {
        state.activeHighlightTerms = [];
        state.currentResults = [];
        elements.notice.textContent = /^[A-Za-z]{2}$/.test(originalTerm)
            ? '找不到此兩字縮寫；兩字英文縮寫需全大寫且已收錄於縮寫表'
            : '英文請輸入至少3個字元；中文可輸入2個字元';
        return;
    }

    const searchTerms = isKnownUppercaseAbbreviation ? abbreviationTerms : [searchTerm];
    state.activeHighlightTerms = searchTerms;
    state.currentResults = rankResults(
        state.records.filter(record => recordMatches(record, searchTerms)),
        searchTerms
    );
    state.showingAll = false;
    renderResults();
}

function scheduleSearch() {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(search, 300);
    elements.clearButton.classList.toggle('visible', elements.input.value.length > 0);
}

function clearSearch() {
    window.clearTimeout(state.searchTimer);
    elements.input.value = '';
    state.activeHighlightTerms = [];
    state.currentResults = [];
    state.showingAll = false;
    elements.results.replaceChildren();
    elements.count.textContent = '';
    elements.notice.textContent = '';
    elements.clearButton.classList.remove('visible');
    elements.input.focus();
}

function showCopySuccess(element) {
    if (element.classList.contains('quick-icd-code')) {
        flashButton(element, '已複製 ✓', 1200);
        return;
    }

    const originalNodes = [...element.childNodes].map(node => node.cloneNode(true));
    element.replaceChildren(document.createTextNode('已複製 ✓'));
    element.classList.add('copy-success');
    window.setTimeout(() => {
        element.replaceChildren(...originalNodes);
        element.classList.remove('copy-success');
    }, 1200);
}

async function copyIcdCode(code, element) {
    try {
        await copyText(code, () => showCopySuccess(element));
    } catch (error) {
        window.alert(error.message || '複製失敗，請手動複製');
    }
}

function bindEvents() {
    elements.input.addEventListener('input', scheduleSearch);
    elements.clearButton.addEventListener('click', clearSearch);

    elements.results.addEventListener('click', event => {
        const toggle = event.target.closest('[data-action="toggle-results"]');
        if (toggle) {
            state.showingAll = !state.showingAll;
            renderResults();
            elements.results.scrollTop = 0;
            return;
        }

        const codeCell = event.target.closest('.icd-code-cell');
        if (codeCell) copyIcdCode(codeCell.dataset.icdCode, codeCell);
    });

    elements.results.addEventListener('keydown', event => {
        const codeCell = event.target.closest('.icd-code-cell');
        if (!codeCell || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        copyIcdCode(codeCell.dataset.icdCode, codeCell);
    });

    document.querySelectorAll('.quick-icd-code').forEach(button => {
        button.addEventListener('click', () => copyIcdCode(button.dataset.icdCode, button));
    });
}

function prepareRecords(rows) {
    state.headers = rows[0] || [];
    state.parentCategories.clear();
    rows.slice(1).forEach(row => {
        const code = String(row[0] || '').trim().toUpperCase();
        const dotIndex = code.indexOf('.');
        if (dotIndex > 0) state.parentCategories.add(code.substring(0, dotIndex));
    });

    state.records = rows.slice(1).map(row => {
        const code = String(row[0] || '');
        const name = String(row[1] || '');
        const chinese = String(row[2] || '');
        return {
            row,
            codeLower: code.toLowerCase(),
            nameLower: name.toLowerCase(),
            chineseLower: chinese.toLowerCase(),
            compactCode: compactText(code),
            compactName: compactText(name),
            compactChinese: compactText(chinese),
            normalizedName: normalizeText(name),
            normalizedChinese: normalizeText(chinese)
        };
    });
}

function prepareAbbreviations(rows) {
    state.abbreviations.clear();
    rows.slice(1).forEach(row => {
        const abbreviation = String(row[0] || '').trim().toLowerCase();
        // 第二欄是完整診斷名稱；不可再用逗號拆開。
        const fullTerm = row.slice(1).join(',').trim().toLowerCase();
        if (!abbreviation || !fullTerm) return;
        const existingTerms = state.abbreviations.get(abbreviation) || [];
        if (!existingTerms.includes(fullTerm)) existingTerms.push(fullTerm);
        state.abbreviations.set(abbreviation, existingTerms);
    });
}

async function loadData() {
    elements.results.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = '載入中，請稍候...';
    elements.results.appendChild(loading);

    const [icdResult, abbreviationResult] = await Promise.allSettled([
        loadCsv('assets/data/ICD_10_CM.csv'),
        loadCsv('assets/data/medical_abbreviations.csv')
    ]);

    if (icdResult.status === 'rejected') {
        showDataError(elements.results, `ICD 資料載入失敗：${icdResult.reason.message}`);
        elements.notice.textContent = '請確認 assets/data/ICD_10_CM.csv 存在且可讀取';
        return;
    }

    prepareRecords(icdResult.value);
    state.ready = true;
    elements.results.replaceChildren();

    if (abbreviationResult.status === 'fulfilled') {
        prepareAbbreviations(abbreviationResult.value);
        elements.notice.textContent = '英文至少3個字元；中文或已收錄的全大寫縮寫可輸入2個字元';
    } else {
        elements.notice.textContent = 'ICD 已載入，但縮寫表載入失敗；仍可使用一般搜尋';
        console.error(abbreviationResult.reason);
    }

    if (elements.input.value.trim()) search();
}

export function initIcdSearch() {
    elements.input = document.getElementById('searchInput');
    elements.clearButton = document.getElementById('searchClearButton');
    elements.results = document.getElementById('results');
    elements.count = document.getElementById('countInfo');
    elements.notice = document.getElementById('minLengthNotice');
    if (!elements.input || !elements.results) return;

    bindEvents();
    loadData().catch(error => {
        console.error(error);
        showDataError(elements.results, `ICD 搜尋初始化失敗：${error.message}`);
    });
}
