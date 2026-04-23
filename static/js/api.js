/**
 * MiMo-V2.5-TTS Web UI — API 调用封装
 */

'use strict';

const API = {
    /** 获取 API Key */
    getApiKey() {
        return localStorage.getItem('mimo_api_key') || '';
    },

    /** 保存 API Key */
    setApiKey(key) {
        localStorage.setItem('mimo_api_key', key);
    },

    /** 通用请求头 */
    _headers() {
        return {
            'Content-Type': 'application/json',
            'X-Api-Key': this.getApiKey(),
        };
    },

    /** 测试连接 */
    async testConnection() {
        const resp = await fetch('/api/test-connection', { headers: this._headers() });
        return resp.json();
    },

    /** 获取音色列表 */
    async getVoices() {
        const resp = await fetch('/api/voices');
        const data = await resp.json();
        return data.voices;
    },

    /** 获取风格标签 */
    async getStyleTags() {
        const resp = await fetch('/api/style-tags');
        const data = await resp.json();
        return data.tags;
    },

    /** 获取音频标签 */
    async getAudioTags() {
        const resp = await fetch('/api/audio-tags');
        const data = await resp.json();
        return data.tags;
    },

    /**
     * 预置音色合成（非流式）
     * @returns {Promise<{blob: Blob, duration: number}>}
     */
    async synthesizePreset(params) {
        const resp = await fetch('/api/synthesize/preset', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '合成失败');
        }
        const blob = await resp.blob();
        const duration = parseFloat(resp.headers.get('X-Audio-Duration') || '0');
        return { blob, duration };
    },

    /**
     * 音色设计合成（非流式）
     */
    async synthesizeVoiceDesign(params) {
        const resp = await fetch('/api/synthesize/voicedesign', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '合成失败');
        }
        const blob = await resp.blob();
        const duration = parseFloat(resp.headers.get('X-Audio-Duration') || '0');
        return { blob, duration };
    },

    /**
     * 音色复刻合成（非流式）
     */
    async synthesizeVoiceClone(params) {
        const resp = await fetch('/api/synthesize/voiceclone', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '合成失败');
        }
        const blob = await resp.blob();
        const duration = parseFloat(resp.headers.get('X-Audio-Duration') || '0');
        return { blob, duration };
    },

    /**
     * 批量预置音色合成
     */
    async batchSynthesizePreset(params) {
        const resp = await fetch('/api/synthesize/batch/preset', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '批量合成失败');
        }
        return resp.json();
    },

    /**
     * 批量音色设计合成
     */
    async batchSynthesizeVoiceDesign(params) {
        const resp = await fetch('/api/synthesize/batch/voicedesign', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '批量合成失败');
        }
        return resp.json();
    },

    /**
     * 批量音色复刻合成
     */
    async batchSynthesizeVoiceClone(params) {
        const resp = await fetch('/api/synthesize/batch/voiceclone', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(params),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: resp.statusText }));
            throw new Error(err.error || '批量合成失败');
        }
        return resp.json();
    },

    /**
     * WebSocket 流式合成
     * @param {Object} config - 配置帧
     * @param {Function} onChunk - 收到 PCM chunk 回调 (ArrayBuffer)
     * @param {Function} onDone - 完成回调 ({total_bytes, chunk_count, duration})
     * @param {Function} onError - 错误回调 (message)
     * @returns {WebSocket}
     */
    synthesizeStream(config, onChunk, onDone, onError) {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}/api/ws/synthesize`);

        ws.onopen = () => {
            ws.send(JSON.stringify({ ...config, api_key: this.getApiKey() }));
        };

        ws.onmessage = (evt) => {
            if (typeof evt.data === 'string') {
                // JSON 控制帧
                const msg = JSON.parse(evt.data);
                if (msg.type === 'done') onDone(msg);
                else if (msg.type === 'error') onError(msg.message);
            } else {
                // 二进制 PCM chunk
                onChunk(evt.data);
            }
        };

        ws.onerror = () => onError('WebSocket 连接错误');
        ws.onclose = (evt) => {
            if (!evt.wasClean) onError('连接意外断开');
        };

        return ws;
    },
};
