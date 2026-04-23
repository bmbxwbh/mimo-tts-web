/**
 * MiMo-V2.5-TTS Web UI — 工具函数
 */

'use strict';

const Utils = {
    /**
     * 格式化秒数为 mm:ss
     */
    formatTime(seconds) {
        if (!seconds || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * 格式化文件大小
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * 格式化时间戳
     */
    formatTimestamp(ts) {
        const d = new Date(ts);
        const pad = n => n.toString().padStart(2, '0');
        return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    /**
     * 截取文本
     */
    truncate(str, max = 100) {
        if (!str) return '';
        return str.length > max ? str.slice(0, max) + '…' : str;
    },

    /**
     * 防抖
     */
    debounce(fn, ms = 300) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    },

    /**
     * 文件转 Base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * 获取 MIME 类型
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const map = { mp3: 'audio/mpeg', wav: 'audio/wav' };
        return map[ext] || 'audio/wav';
    },

    /**
     * 复制文本到剪贴板
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        }
    },

    /**
     * 下载 Blob 为文件
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Base64 转 Blob
     */
    base64ToBlob(base64, mime = 'audio/wav') {
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    },

    /**
     * 生成随机 ID
     */
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
};
