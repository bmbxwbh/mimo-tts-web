/**
 * MiMo-V2.5-TTS Web UI — 音频播放器 & 波形可视化
 */

'use strict';

class AudioPlayer {
    constructor() {
        this.ctx = null;
        this.buffer = null;
        this.source = null;
        this.gainNode = null;
        this.startTime = 0;
        this.pauseOffset = 0;
        this.isPlaying = false;
        this.duration = 0;
        this.volume = 1;
        this._rafId = null;
        this.onTimeUpdate = null;
        this.onEnded = null;
    }

    /** 确保 AudioContext 已初始化 */
    _ensureCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /** 从 WAV Blob 加载 */
    async loadFromBlob(blob) {
        this.stop();
        this._ensureCtx();
        const arrayBuf = await blob.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuf);
        this.duration = this.buffer.duration;
        this.pauseOffset = 0;
    }

    /** 从 PCM chunks (ArrayBuffer[]) 拼接加载 */
    async loadFromPCMChunks(chunks, sampleRate = 24000) {
        this.stop();
        this._ensureCtx();

        // 计算总长度
        let totalLen = 0;
        for (const c of chunks) totalLen += c.byteLength / 2; // 16-bit = 2 bytes

        const float32 = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
            const view = new DataView(c);
            for (let i = 0; i < c.byteLength; i += 2) {
                const s = view.getInt16(i, true);
                float32[offset++] = s / 32768;
            }
        }

        this.buffer = this.ctx.createBuffer(1, float32.length, sampleRate);
        this.buffer.getChannelData(0).set(float32);
        this.duration = this.buffer.duration;
        this.pauseOffset = 0;
    }

    /** 从 AudioBuffer 直接加载 */
    loadFromAudioBuffer(audioBuffer) {
        this.stop();
        this.buffer = audioBuffer;
        this.duration = audioBuffer.duration;
        this.pauseOffset = 0;
    }

    play() {
        if (!this.buffer) return;
        this._ensureCtx();
        if (this.isPlaying) return;

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode);
        this.source.onended = () => {
            if (this.isPlaying) {
                this.isPlaying = false;
                this.pauseOffset = 0;
                cancelAnimationFrame(this._rafId);
                if (this.onEnded) this.onEnded();
            }
        };

        this.startTime = this.ctx.currentTime - this.pauseOffset;
        this.source.start(0, this.pauseOffset);
        this.isPlaying = true;
        this._tick();
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseOffset = this.ctx.currentTime - this.startTime;
        this.source.stop();
        this.source = null;
        this.isPlaying = false;
        cancelAnimationFrame(this._rafId);
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch {}
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseOffset = 0;
        cancelAnimationFrame(this._rafId);
    }

    seek(time) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();
        this.pauseOffset = Math.max(0, Math.min(time, this.duration));
        if (wasPlaying) this.play();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.gainNode) this.gainNode.gain.value = this.volume;
    }

    getCurrentTime() {
        if (!this.isPlaying) return this.pauseOffset;
        return this.ctx.currentTime - this.startTime;
    }

    getDuration() {
        return this.duration;
    }

    /** 生成 WAV Blob 供下载 */
    toWavBlob() {
        if (!this.buffer) return null;
        const numCh = this.buffer.numberOfChannels;
        const sr = this.buffer.sampleRate;
        const len = this.buffer.length;
        const bytesPerSample = 2;
        const dataSize = len * numCh * bytesPerSample;

        const buf = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buf);

        // RIFF header
        writeStr(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(view, 8, 'WAVE');

        // fmt
        writeStr(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numCh, true);
        view.setUint32(24, sr, true);
        view.setUint32(28, sr * numCh * bytesPerSample, true);
        view.setUint16(32, numCh * bytesPerSample, true);
        view.setUint16(34, 16, true);

        // data
        writeStr(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        const channels = [];
        for (let ch = 0; ch < numCh; ch++) channels.push(this.buffer.getChannelData(ch));

        let pos = 44;
        for (let i = 0; i < len; i++) {
            for (let ch = 0; ch < numCh; ch++) {
                let s = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                pos += 2;
            }
        }

        return new Blob([buf], { type: 'audio/wav' });
    }

    _tick() {
        if (!this.isPlaying) return;
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.getCurrentTime(), this.duration);
        }
        this._rafId = requestAnimationFrame(() => this._tick());
    }

    destroy() {
        this.stop();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}


class WaveformRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.peaks = null;
        this.progress = 0;
        this._resizeObserver = null;

        // 响应式
        this._resizeObserver = new ResizeObserver(() => this.draw());
        this._resizeObserver.observe(canvas.parentElement);
    }

    /** 从 AudioBuffer 计算 peaks 并绘制 */
    setAudioBuffer(audioBuffer) {
        const raw = audioBuffer.getChannelData(0);
        const numBars = Math.max(100, this.canvas.parentElement.clientWidth / 2);
        const step = Math.floor(raw.length / numBars);
        this.peaks = [];
        for (let i = 0; i < numBars; i++) {
            let max = 0;
            for (let j = 0; j < step; j++) {
                const v = Math.abs(raw[i * step + j] || 0);
                if (v > max) max = v;
            }
            this.peaks.push(max);
        }
        this.draw();
    }

    /** 从 PCM chunks 计算 peaks */
    setPCMChunks(chunks, sampleRate = 24000) {
        let totalLen = 0;
        for (const c of chunks) totalLen += c.byteLength / 2;

        const numBars = Math.max(100, this.canvas.parentElement.clientWidth / 2);
        const step = Math.max(1, Math.floor(totalLen / numBars));
        this.peaks = new Array(numBars).fill(0);

        let sampleIdx = 0;
        let barIdx = 0;
        for (const c of chunks) {
            const view = new DataView(c);
            for (let i = 0; i < c.byteLength; i += 2) {
                const v = Math.abs(view.getInt16(i, true)) / 32768;
                barIdx = Math.floor(sampleIdx / step);
                if (barIdx < numBars && v > this.peaks[barIdx]) this.peaks[barIdx] = v;
                sampleIdx++;
            }
        }
        this.draw();
    }

    setProgress(p) {
        this.progress = Math.max(0, Math.min(1, p));
        this.draw();
    }

    draw() {
        const { canvas, ctx, peaks } = this;
        if (!peaks || !peaks.length) return;

        const dpr = window.devicePixelRatio || 1;
        // 只读取父元素宽度，高度用 CSS 计算值（避免 ResizeObserver 反馈循环）
        const parentWidth = canvas.parentElement.getBoundingClientRect().width;
        const computedStyle = getComputedStyle(canvas);
        const cssHeight = parseFloat(computedStyle.height) || 80;
        canvas.width = parentWidth * dpr;
        canvas.height = cssHeight * dpr;
        canvas.style.width = parentWidth + 'px';
        // 不覆盖 style.height，让 CSS 控制
        ctx.scale(dpr, dpr);

        const w = parentWidth;
        const h = cssHeight;
        const barW = w / peaks.length;
        const midY = h / 2;

        ctx.clearRect(0, 0, w, h);

        const isDark = document.documentElement.dataset.theme !== 'light';
        const progressColor = isDark ? '#818cf8' : '#6366f1';
        const defaultColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

        for (let i = 0; i < peaks.length; i++) {
            const barH = Math.max(2, peaks[i] * (h * 0.85));
            const x = i * barW;
            const frac = i / peaks.length;

            if (frac <= this.progress) {
                ctx.fillStyle = progressColor;
            } else {
                ctx.fillStyle = defaultColor;
            }

            ctx.beginPath();
            ctx.roundRect(x + 1, midY - barH / 2, Math.max(1, barW - 2), barH, 1);
            ctx.fill();
        }
    }

    clear() {
        this.peaks = null;
        const { canvas, ctx } = this;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }

    destroy() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
