export function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function loadCsv(url) {
    if (!window.Papa) {
        throw new Error('CSV 解析工具尚未載入');
    }

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`${url} 載入失敗（HTTP ${response.status}）`);
    }

    const csvText = await response.text();
    return new Promise((resolve, reject) => {
        window.Papa.parse(csvText, {
            skipEmptyLines: true,
            complete(results) {
                if (results.errors?.length) {
                    const firstError = results.errors[0];
                    reject(new Error(`${url} CSV 格式錯誤：${firstError.message}`));
                    return;
                }
                resolve(results.data);
            },
            error(error) {
                reject(new Error(`${url} CSV 解析失敗：${error.message}`));
            }
        });
    });
}

export function showDataError(container, message) {
    if (!container) return;
    container.replaceChildren();
    const errorBox = document.createElement('div');
    errorBox.className = 'data-error';
    errorBox.textContent = message;
    container.appendChild(errorBox);
}

export function appendHighlightedText(container, value, terms) {
    const text = value == null ? '' : String(value);
    const candidates = [...new Map(
        terms
            .map(term => String(term || '').trim())
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)
            .map(term => [term.toLowerCase(), term])
    ).values()];

    if (!candidates.length) {
        container.textContent = text;
        return;
    }

    const regex = new RegExp(`(${candidates.map(escapeRegExp).join('|')})`, 'gi');
    text.split(regex).forEach(part => {
        if (!part) return;
        if (candidates.some(term => term.toLowerCase() === part.toLowerCase())) {
            const mark = document.createElement('mark');
            mark.textContent = part;
            container.appendChild(mark);
        } else {
            container.appendChild(document.createTextNode(part));
        }
    });
}
