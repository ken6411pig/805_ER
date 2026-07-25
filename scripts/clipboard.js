async function writeWithFallback(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('copy command failed');
        }
    } finally {
        textArea.remove();
    }
}

export async function copyText(text, onSuccess) {
    const cleanText = String(text ?? '');
    if (!cleanText.trim()) {
        throw new Error('沒有內容可以複製');
    }

    await writeWithFallback(cleanText);
    if (typeof onSuccess === 'function') {
        onSuccess();
    }
}

export function flashButton(button, successText = '已複製！', duration = 1500) {
    if (!button) return;
    const originalText = button.textContent;
    button.textContent = successText;
    button.classList.add('success');
    window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('success');
    }, duration);
}

export function flashCopyLine(element, duration = 1000) {
    if (!element) return;
    element.classList.add('copy-success');
    window.setTimeout(() => element.classList.remove('copy-success'), duration);
}
