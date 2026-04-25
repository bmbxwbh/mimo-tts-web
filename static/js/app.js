/**
 * MiMo-V2.5-TTS Web UI — 主入口 (Miuix Console 版)
 *
 * 使用 Miuix Console 框架的组件和工具
 */

'use strict';

/* ==================== 全局状态 ==================== */

const State = {
    currentTab: 'preset',
    selectedVoice: 'mimo_default',
    selectedStyleTags: new Set(),
    selectedVDStyleTags: new Set(),
    selectedVCStyleTags: new Set(),
    voices: [],
    styleTags: {},
    audioTags: [],

    preset: {
        player: new AudioPlayer(),
        waveform: null,
        lastBlob: null,
        lastParams: null,
    },
    voicedesign: {
        player: new AudioPlayer(),
        waveform: null,
        lastBlob: null,
        lastParams: null,
    },
    voiceclone: {
        player: new AudioPlayer(),
        waveform: null,
        lastBlob: null,
        lastParams: null,
        audioBase64: null,
        mimeType: null,
    },

    previewPlayer: new AudioPlayer(),
    previewPlayingVoice: null,
    batchRunning: false,
    ws: null,
};

/* ==================== IndexedDB 历史记录 ==================== */

const HistoryDB = {
    DB_NAME: 'mimo-tts-history',
    STORE_NAME: 'records',
    MAX_RECORDS: 50,
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            req.onerror = () => reject(req.error);
        });
    },

    async add(record) {
        if (!this.db) return;
        record.id = Utils.uid();
        record.timestamp = Date.now();
        const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).put(record);
        const all = await this.getAll();
        if (all.length > this.MAX_RECORDS) {
            const toDelete = all.slice(0, all.length - this.MAX_RECORDS);
            const tx2 = this.db.transaction(this.STORE_NAME, 'readwrite');
            toDelete.forEach(r => tx2.objectStore(this.STORE_NAME).delete(r.id));
        }
    },

    async getAll() {
        if (!this.db) return [];
        return new Promise((resolve) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).getAll();
            req.onsuccess = () => {
                const records = req.result || [];
                records.sort((a, b) => b.timestamp - a.timestamp);
                resolve(records);
            };
            req.onerror = () => resolve([]);
        });
    },

    async clear() {
        if (!this.db) return;
        this.db.transaction(this.STORE_NAME, 'readwrite').objectStore(this.STORE_NAME).clear();
    },

    async getCount() {
        return (await this.getAll()).length;
    },
};

/* ==================== 初始化 ==================== */

document.addEventListener('DOMContentLoaded', async () => {
    await HistoryDB.init();
    await loadConfigData();

    // 初始化主题
    if (typeof MxTheme !== 'undefined') MxTheme.init();
    UI.updateApiStatus(!!API.getApiKey());

    initApiKeyModal();
    initSidebar();
    initTabSwitch();
    initPresetPanel();
    initVoiceDesignPanel();
    initVoiceClonePanel();
    initSettingsPanel();
    initHistoryPanel();
    refreshHistoryUI();
});

/* ==================== 加载配置 ==================== */

async function loadConfigData() {
    try {
        const [voices, styleTags, audioTags] = await Promise.all([
            API.getVoices(), API.getStyleTags(), API.getAudioTags(),
        ]);
        State.voices = voices;
        State.styleTags = styleTags;
        State.audioTags = audioTags;
    } catch (e) {
        console.error('加载配置失败:', e);
        UI.toast('加载配置数据失败', 'error');
    }
}

/* ==================== API Key 弹窗 ==================== */

function initApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    const modalInput = document.getElementById('modal-api-key');
    const modalSaveBtn = document.getElementById('modal-save-btn');

    if (!API.getApiKey()) {
        modal.classList.add('open');
    }

    modalSaveBtn.addEventListener('click', () => {
        const key = modalInput.value.trim();
        if (!key) { UI.toast('请输入 API Key', 'error'); return; }
        API.setApiKey(key);
        UI.updateApiStatus(true);
        modal.classList.remove('open');
        UI.toast('API Key 已保存', 'success');
        const settingsInput = document.getElementById('settings-api-key');
        if (settingsInput) settingsInput.value = key;
    });

    modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modalSaveBtn.click();
    });
}

/* ==================== 侧边栏 ==================== */

function initSidebar() {
    // 侧边栏折叠在平板模式下由 CSS 自动处理
}

/* ==================== Tab 切换 ==================== */

function initTabSwitch() {
    // 侧边栏导航
    document.querySelectorAll('.mx-nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    // 移动端导航
    document.querySelectorAll('.mx-btm-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
}

function switchTab(tab) {
    State.currentTab = tab;

    // 面板切换
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${tab}`).classList.add('active');

    // 导航高亮
    document.querySelectorAll('.mx-nav-item[data-tab]').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.mx-btm-item[data-tab]').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));

    // 更新页面标题
    UI.updatePageTitle(tab);
}

/* ==================== 预置音色面板 ==================== */

function initPresetPanel() {
    UI.renderVoiceGrid(State.voices, State.selectedVoice, (id) => {
        State.selectedVoice = id;
        UI.updateVoiceSelection(id);
    }, (id, url) => playVoicePreview(id, url));

    renderPresetStyleTags();
    UI.renderAudioTags('audio-tags-container', State.audioTags, (tag) => {
        UI.insertAtCursor(document.getElementById('preset-tagged-text'), `[${tag}]`);
    });

    // 子 Tab（使用 mx-tabs）
    const subTabs = document.getElementById('preset-style-tabs');
    if (subTabs) {
        UI.initMxTabs(subTabs, (subtab) => {
            document.getElementById('preset-natural-lang').classList.toggle('active', subtab === 'natural-lang');
            document.getElementById('preset-audio-tags').classList.toggle('active', subtab === 'audio-tags');
        });
    }

    UI.bindCharCount('preset-style-prompt', 'preset-style-count');
    UI.bindCharCount('preset-text', 'preset-text-count');

    document.getElementById('preset-director-toggle').addEventListener('change', (e) => {
        document.getElementById('preset-director-fields').classList.toggle('hidden', !e.target.checked);
    });

    State.preset.waveform = new WaveformRenderer(document.getElementById('preset-waveform'));
    document.getElementById('preset-synthesize-btn').addEventListener('click', () => handlePresetSynthesis());
    initPlayerControls('preset', State.preset);
    document.getElementById('preset-download-btn').addEventListener('click', () => {
        if (State.preset.lastBlob) Utils.downloadBlob(State.preset.lastBlob, 'preset_audio.wav');
    });

    initBatchMode('preset');
    document.getElementById('preset-copy-params').addEventListener('click', () => copyParams('preset'));
    document.getElementById('preset-resynthesize').addEventListener('click', () => resynthesize('preset'));
}

function renderPresetStyleTags() {
    UI.renderStyleTags('style-tags-container', State.styleTags, State.selectedStyleTags, (tag) => {
        if (State.selectedStyleTags.has(tag)) State.selectedStyleTags.delete(tag);
        else State.selectedStyleTags.add(tag);
        renderPresetStyleTags();
        UI.updateTagsPreview('tags-preview', State.selectedStyleTags);
    });
}

async function handlePresetSynthesis() {
    if (!API.getApiKey()) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.add('open'); return; }

    const isBatch = document.getElementById('preset-batch-toggle').checked;
    const isStream = document.getElementById('preset-stream-toggle').checked;
    const btn = document.getElementById('preset-synthesize-btn');

    if (isBatch) { await handleBatchSynthesis('preset'); return; }

    const params = collectPresetParams();
    if (!params.text) { UI.toast('请输入合成文本', 'error'); return; }

    UI.setBtnLoading(btn, true);
    State.preset.lastParams = params;
    const startTime = performance.now();

    try {
        if (isStream) {
            await streamSynthesis('preset', params);
        } else {
            const { blob, duration } = await API.synthesizePreset(params);
            const elapsed = (performance.now() - startTime) / 1000;
            await showSynthResult('preset', blob, duration || elapsed);
            saveToHistory('preset', params, blob, duration || elapsed);
        }
    } catch (e) {
        UI.toast('合成失败: ' + e.message, 'error');
    } finally {
        UI.setBtnLoading(btn, false);
    }
}

function collectPresetParams() {
    const text = document.getElementById('preset-text').value.trim();
    const stylePrompt = document.getElementById('preset-style-prompt').value.trim();
    const taggedText = document.getElementById('preset-tagged-text').value.trim();
    const singing = document.getElementById('preset-singing-toggle').checked;
    const directorOn = document.getElementById('preset-director-toggle').checked;

    let finalText = text;
    let audioTags = null;

    const audioTabActive = document.getElementById('preset-audio-tags').classList.contains('active');
    if (audioTabActive && taggedText) finalText = taggedText;
    if (State.selectedStyleTags.size > 0) audioTags = [...State.selectedStyleTags].join(' ');

    const params = { voice: State.selectedVoice, text: finalText, singing };

    if (directorOn) {
        params.director = {
            character: document.getElementById('director-character').value.trim(),
            scene: document.getElementById('director-scene').value.trim(),
            direction: document.getElementById('director-direction').value.trim(),
        };
    } else if (stylePrompt) {
        params.style_prompt = stylePrompt;
    }
    if (audioTags) params.audio_tags = audioTags;
    return params;
}

/* ==================== 音色设计面板 ==================== */

function initVoiceDesignPanel() {
    const templates = ['温柔甜美的年轻女性', '低沉磁性的成熟男性', '活泼俏皮的少女', '苍老慈祥的老人'];
    const chipsRow = document.getElementById('voicedesign-templates');
    templates.forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'mx-tag mx-tag-clickable';
        chip.textContent = t;
        chip.addEventListener('click', () => { document.getElementById('voicedesign-description').value = t; });
        chipsRow.appendChild(chip);
    });

    renderVDStyleTags();
    UI.renderAudioTags('voicedesign-audio-tags', State.audioTags, (tag) => {
        UI.insertAtCursor(document.getElementById('voicedesign-tagged-text'), `[${tag}]`);
    });

    UI.bindCharCount('voicedesign-tagged-text', 'voicedesign-text-count');
    State.voicedesign.waveform = new WaveformRenderer(document.getElementById('voicedesign-waveform'));
    document.getElementById('voicedesign-synthesize-btn').addEventListener('click', () => handleVDSynthesis());
    initPlayerControls('voicedesign', State.voicedesign);
    document.getElementById('voicedesign-download-btn').addEventListener('click', () => {
        if (State.voicedesign.lastBlob) Utils.downloadBlob(State.voicedesign.lastBlob, 'voicedesign_audio.wav');
    });
    initBatchMode('voicedesign');
    document.getElementById('voicedesign-copy-params').addEventListener('click', () => copyParams('voicedesign'));
    document.getElementById('voicedesign-resynthesize').addEventListener('click', () => resynthesize('voicedesign'));
}

function renderVDStyleTags() {
    UI.renderStyleTags('voicedesign-style-tags', State.styleTags, State.selectedVDStyleTags, (tag) => {
        if (State.selectedVDStyleTags.has(tag)) State.selectedVDStyleTags.delete(tag);
        else State.selectedVDStyleTags.add(tag);
        renderVDStyleTags();
        UI.updateTagsPreview('voicedesign-tags-preview', State.selectedVDStyleTags);
    });
}

async function handleVDSynthesis() {
    if (!API.getApiKey()) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.add('open'); return; }
    const isBatch = document.getElementById('voicedesign-batch-toggle').checked;
    const isStream = document.getElementById('voicedesign-stream-toggle').checked;
    const btn = document.getElementById('voicedesign-synthesize-btn');
    if (isBatch) { await handleBatchSynthesis('voicedesign'); return; }
    const params = collectVDParams();
    if (!params.text) { UI.toast('请输入合成文本', 'error'); return; }
    UI.setBtnLoading(btn, true);
    State.voicedesign.lastParams = params;
    const startTime = performance.now();
    try {
        if (isStream) await streamSynthesis('voicedesign', params);
        else {
            const { blob, duration } = await API.synthesizeVoiceDesign(params);
            const elapsed = (performance.now() - startTime) / 1000;
            await showSynthResult('voicedesign', blob, duration || elapsed);
            saveToHistory('voicedesign', params, blob, duration || elapsed);
        }
    } catch (e) { UI.toast('合成失败: ' + e.message, 'error'); }
    finally { UI.setBtnLoading(btn, false); }
}

function collectVDParams() {
    const description = document.getElementById('voicedesign-description').value.trim();
    const text = document.getElementById('voicedesign-tagged-text').value.trim();
    const audioTags = State.selectedVDStyleTags.size > 0 ? [...State.selectedVDStyleTags].join(' ') : null;
    const params = { voice_description: description, text };
    if (audioTags) params.audio_tags = audioTags;
    return params;
}

/* ==================== 音色复刻面板 ==================== */

function initVoiceClonePanel() {
    const dropzone = document.getElementById('voiceclone-dropzone');
    const fileInput = document.getElementById('voiceclone-file-input');

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault(); dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleCloneFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length) handleCloneFile(fileInput.files[0]); });
    document.getElementById('voiceclone-remove-btn').addEventListener('click', () => {
        State.voiceclone.audioBase64 = null;
        State.voiceclone.mimeType = null;
        document.getElementById('voiceclone-file-info').classList.add('hidden');
        dropzone.classList.remove('hidden');
        fileInput.value = '';
    });

    renderVCStyleTags();
    UI.renderAudioTags('voiceclone-audio-tags', State.audioTags, (tag) => {
        UI.insertAtCursor(document.getElementById('voiceclone-tagged-text'), `[${tag}]`);
    });
    UI.bindCharCount('voiceclone-tagged-text', 'voiceclone-text-count');
    State.voiceclone.waveform = new WaveformRenderer(document.getElementById('voiceclone-waveform'));
    State.voiceclone.previewWaveform = new WaveformRenderer(document.getElementById('voiceclone-preview-waveform'));
    document.getElementById('voiceclone-synthesize-btn').addEventListener('click', () => handleVCSynthesis());
    initPlayerControls('voiceclone', State.voiceclone);
    document.getElementById('voiceclone-download-btn').addEventListener('click', () => {
        if (State.voiceclone.lastBlob) Utils.downloadBlob(State.voiceclone.lastBlob, 'voiceclone_audio.wav');
    });
    initBatchMode('voiceclone');
    document.getElementById('voiceclone-copy-params').addEventListener('click', () => copyParams('voiceclone'));
    document.getElementById('voiceclone-resynthesize').addEventListener('click', () => resynthesize('voiceclone'));
}

async function handleCloneFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) { UI.toast('仅支持 MP3 和 WAV 格式', 'error'); return; }
    const base64 = await Utils.fileToBase64(file);
    if (base64.length > 10 * 1024 * 1024) { UI.toast('Base64 后超过 10MB 限制', 'error'); return; }

    State.voiceclone.audioBase64 = base64;
    State.voiceclone.mimeType = Utils.getMimeType(file.name);

    document.getElementById('voiceclone-dropzone').classList.add('hidden');
    const info = document.getElementById('voiceclone-file-info');
    info.classList.remove('hidden');
    document.getElementById('voiceclone-file-name').textContent = file.name;
    document.getElementById('voiceclone-file-meta').textContent = `${Utils.formatSize(file.size)} · ${ext.toUpperCase()}`;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuf = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        State.voiceclone.previewWaveform.setAudioBuffer(audioBuffer);
        audioCtx.close();
    } catch {}
}

function renderVCStyleTags() {
    UI.renderStyleTags('voiceclone-style-tags', State.styleTags, State.selectedVCStyleTags, (tag) => {
        if (State.selectedVCStyleTags.has(tag)) State.selectedVCStyleTags.delete(tag);
        else State.selectedVCStyleTags.add(tag);
        renderVCStyleTags();
        UI.updateTagsPreview('voiceclone-tags-preview', State.selectedVCStyleTags);
    });
}

async function handleVCSynthesis() {
    if (!API.getApiKey()) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.add('open'); return; }
    if (!State.voiceclone.audioBase64) { UI.toast('请先上传音频样本', 'error'); return; }
    const isBatch = document.getElementById('voiceclone-batch-toggle').checked;
    const isStream = document.getElementById('voiceclone-stream-toggle').checked;
    const btn = document.getElementById('voiceclone-synthesize-btn');
    if (isBatch) { await handleBatchSynthesis('voiceclone'); return; }
    const params = collectVCParams();
    if (!params.text) { UI.toast('请输入合成文本', 'error'); return; }
    UI.setBtnLoading(btn, true);
    State.voiceclone.lastParams = params;
    const startTime = performance.now();
    try {
        if (isStream) await streamSynthesis('voiceclone', params);
        else {
            const { blob, duration } = await API.synthesizeVoiceClone(params);
            const elapsed = (performance.now() - startTime) / 1000;
            await showSynthResult('voiceclone', blob, duration || elapsed);
            saveToHistory('voiceclone', params, blob, duration || elapsed);
        }
    } catch (e) { UI.toast('合成失败: ' + e.message, 'error'); }
    finally { UI.setBtnLoading(btn, false); }
}

function collectVCParams() {
    const text = document.getElementById('voiceclone-tagged-text').value.trim();
    const audioTags = State.selectedVCStyleTags.size > 0 ? [...State.selectedVCStyleTags].join(' ') : null;
    return {
        audio_base64: State.voiceclone.audioBase64,
        mime_type: State.voiceclone.mimeType,
        text,
        ...(audioTags ? { audio_tags: audioTags } : {}),
    };
}

/* ==================== 设置面板 ==================== */

function initSettingsPanel() {
    const keyInput = document.getElementById('settings-api-key');
    const saveBtn = document.getElementById('settings-save-key');
    const testBtn = document.getElementById('settings-test-btn');
    const statusEl = document.getElementById('settings-connection-status');
    const voiceSelect = document.getElementById('settings-default-voice');

    // 填充音色下拉
    State.voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.language})`;
        voiceSelect.appendChild(opt);
    });

    // 恢复设置
    keyInput.value = API.getApiKey();
    const savedVoice = localStorage.getItem('mimo_default_voice') || 'mimo_default';
    voiceSelect.value = savedVoice;
    const savedStream = localStorage.getItem('mimo_default_stream') === 'true';
    document.getElementById('settings-default-stream').checked = savedStream;

    // 保存 API Key
    saveBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (!key) { UI.toast('请输入 API Key', 'error'); return; }
        API.setApiKey(key);
        UI.updateApiStatus(true);
        UI.toast('API Key 已保存', 'success');
    });

    keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });

    // 测试连接
    testBtn.addEventListener('click', async () => {
        if (!keyInput.value.trim()) { UI.toast('请先输入 API Key', 'error'); return; }
        API.setApiKey(keyInput.value.trim());
        UI.updateApiStatus(true);
        testBtn.disabled = true;
        statusEl.className = 'connection-status testing';
        statusEl.textContent = '测试中…';
        try {
            const result = await API.testConnection();
            if (result.success) {
                statusEl.className = 'connection-status success';
                statusEl.textContent = '✓ ' + result.message;
                UI.toast('连接成功', 'success');
            } else {
                statusEl.className = 'connection-status error';
                statusEl.textContent = '✗ ' + result.message;
                UI.toast(result.message, 'error');
            }
        } catch (e) {
            statusEl.className = 'connection-status error';
            statusEl.textContent = '✗ 网络错误';
        } finally { testBtn.disabled = false; }
    });

    // 保存默认音色
    voiceSelect.addEventListener('change', () => {
        localStorage.setItem('mimo_default_voice', voiceSelect.value);
        State.selectedVoice = voiceSelect.value;
        UI.updateVoiceSelection(voiceSelect.value);
        UI.toast('默认音色已更新', 'success');
    });

    // 保存默认流式
    document.getElementById('settings-default-stream').addEventListener('change', (e) => {
        localStorage.setItem('mimo_default_stream', e.target.checked);
        document.getElementById('preset-stream-toggle').checked = e.target.checked;
        document.getElementById('voicedesign-stream-toggle').checked = e.target.checked;
        document.getElementById('voiceclone-stream-toggle').checked = e.target.checked;
    });

    if (savedStream) {
        document.getElementById('preset-stream-toggle').checked = true;
        document.getElementById('voicedesign-stream-toggle').checked = true;
        document.getElementById('voiceclone-stream-toggle').checked = true;
    }
}

/* ==================== 通用：播放控制 ==================== */

function initPlayerControls(panel, panelState) {
    const player = panelState.player;
    const waveform = panelState.waveform;

    document.getElementById(`${panel}-play-btn`).addEventListener('click', () => {
        if (player.isPlaying) player.pause(); else player.play();
        updatePlayBtn(panel, player.isPlaying);
    });

    document.getElementById(`${panel}-progress-bar`).addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        player.seek(((e.clientX - rect.left) / rect.width) * player.getDuration());
    });

    player.onTimeUpdate = (current, total) => {
        const fill = document.getElementById(`${panel}-progress-fill`);
        const curLabel = document.getElementById(`${panel}-current-time`);
        const totLabel = document.getElementById(`${panel}-total-time`);
        if (fill) fill.style.width = (total > 0 ? (current / total * 100) : 0) + '%';
        if (curLabel) curLabel.textContent = Utils.formatTime(current);
        if (totLabel) totLabel.textContent = Utils.formatTime(total);
        if (waveform) waveform.setProgress(total > 0 ? current / total : 0);
    };

    player.onEnded = () => {
        updatePlayBtn(panel, false);
        document.getElementById(`${panel}-progress-fill`).style.width = '0%';
        if (waveform) waveform.setProgress(0);
    };
}

function updatePlayBtn(panel, isPlaying) {
    const btn = document.getElementById(`${panel}-play-btn`);
    if (isPlaying) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }
}

/* ==================== 通用：显示合成结果 ==================== */

async function showSynthResult(panel, blob, duration) {
    const panelState = State[panel];
    panelState.lastBlob = blob;
    const output = document.getElementById(`${panel}-output`);
    output.classList.remove('hidden');
    await panelState.player.loadFromBlob(blob);
    if (panelState.waveform && panelState.player.buffer) panelState.waveform.setAudioBuffer(panelState.player.buffer);

    const dur = panelState.player.getDuration();
    document.getElementById(`${panel}-duration`).textContent = `${Utils.formatTime(dur)} · ${duration.toFixed(1)}s`;
    document.getElementById(`${panel}-total-time`).textContent = Utils.formatTime(dur);
    document.getElementById(`${panel}-current-time`).textContent = '0:00';
    document.getElementById(`${panel}-progress-fill`).style.width = '0%';
    updatePlayBtn(panel, false);
    updateParamSummary(panel, duration);
}

/* ==================== 参数摘要 ==================== */

function updateParamSummary(panel, duration) {
    const params = State[panel].lastParams;
    if (!params) return;
    const rows = [];
    const modelMap = { preset: 'mimo-v2.5-tts', voicedesign: 'mimo-v2.5-tts-voicedesign', voiceclone: 'mimo-v2.5-tts-voiceclone' };
    rows.push({ label: '模型', value: modelMap[panel] });
    if (panel === 'preset') {
        rows.push({ label: '音色', value: params.voice || 'mimo_default' });
        if (params.style_prompt) rows.push({ label: '风格', value: Utils.truncate(params.style_prompt, 30) });
        if (params.director) rows.push({ label: '导演模式', value: '开启' });
        if (params.singing) rows.push({ label: '唱歌', value: '开启' });
    } else if (panel === 'voicedesign') {
        rows.push({ label: '音色描述', value: Utils.truncate(params.voice_description, 30) });
    } else if (panel === 'voiceclone') {
        rows.push({ label: '样本格式', value: params.mime_type });
    }
    if (params.audio_tags) rows.push({ label: '标签', value: Utils.truncate(params.audio_tags, 40) });
    rows.push({ label: '字数', value: params.text.length + ' 字' });
    rows.push({ label: '耗时', value: duration.toFixed(1) + 's' });
    UI.renderParamSummary(`${panel}-param-rows`, rows);
}

async function copyParams(panel) {
    const params = State[panel].lastParams;
    if (!params) return;
    const clean = { ...params }; delete clean.api_key;
    const json = JSON.stringify(clean, null, 2);
    const ok = await Utils.copyToClipboard(json);
    UI.toast(ok ? '已复制到剪贴板' : '复制失败', ok ? 'success' : 'error');
}

function resynthesize(panel) {
    const params = State[panel].lastParams;
    if (!params) return;
    if (panel === 'preset') {
        document.getElementById('preset-text').value = params.text || '';
        if (params.voice) { State.selectedVoice = params.voice; UI.updateVoiceSelection(params.voice); }
        handlePresetSynthesis();
    } else if (panel === 'voicedesign') {
        document.getElementById('voicedesign-tagged-text').value = params.text || '';
        handleVDSynthesis();
    } else if (panel === 'voiceclone') {
        document.getElementById('voiceclone-tagged-text').value = params.text || '';
        handleVCSynthesis();
    }
}

/* ==================== 流式合成 ==================== */

async function streamSynthesis(panel, params) {
    const panelState = State[panel];
    const modelMap = { preset: 'preset', voicedesign: 'voicedesign', voiceclone: 'voiceclone' };
    const wsConfig = { type: modelMap[panel] };

    if (panel === 'preset') {
        wsConfig.voice = params.voice; wsConfig.text = params.text;
        wsConfig.style_prompt = params.style_prompt; wsConfig.audio_tags = params.audio_tags;
        wsConfig.director = params.director; wsConfig.singing = params.singing;
    } else if (panel === 'voicedesign') {
        wsConfig.voice_description = params.voice_description; wsConfig.text = params.text;
        wsConfig.audio_tags = params.audio_tags;
    } else if (panel === 'voiceclone') {
        wsConfig.audio_base64 = params.audio_base64; wsConfig.mime_type = params.mime_type;
        wsConfig.text = params.text; wsConfig.audio_tags = params.audio_tags;
    }

    const chunks = [];
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
        State.ws = API.synthesizeStream(wsConfig,
            (arrayBuffer) => chunks.push(arrayBuffer),
            async (info) => {
                const elapsed = (performance.now() - startTime) / 1000;
                await panelState.player.loadFromPCMChunks(chunks);
                const wavBlob = panelState.player.toWavBlob();
                const output = document.getElementById(`${panel}-output`);
                output.classList.remove('hidden');
                if (panelState.waveform && panelState.player.buffer) panelState.waveform.setAudioBuffer(panelState.player.buffer);
                const dur = panelState.player.getDuration();
                document.getElementById(`${panel}-duration`).textContent = `${Utils.formatTime(dur)} · ${elapsed.toFixed(1)}s`;
                document.getElementById(`${panel}-total-time`).textContent = Utils.formatTime(dur);
                document.getElementById(`${panel}-current-time`).textContent = '0:00';
                document.getElementById(`${panel}-progress-fill`).style.width = '0%';
                updatePlayBtn(panel, false);
                panelState.lastBlob = wavBlob;
                updateParamSummary(panel, elapsed);
                saveToHistory(panel, params, wavBlob, elapsed);
                UI.toast(`流式合成完成 · ${elapsed.toFixed(1)}s`, 'success');
                resolve();
            },
            (msg) => { UI.toast('流式合成失败: ' + msg, 'error'); reject(new Error(msg)); }
        );
    });
}

/* ==================== 批量合成 ==================== */

function initBatchMode(panel) {
    const toggle = document.getElementById(`${panel}-batch-toggle`);
    const progress = document.getElementById(`${panel}-batch-progress`);
    toggle.addEventListener('change', () => {
        progress.classList.toggle('hidden', !toggle.checked);
        updateBatchCount(panel);
    });
    const taId = panel === 'preset' ? 'preset-text' : `${panel === 'voicedesign' ? 'voicedesign-tagged-text' : 'voiceclone-tagged-text'}`;
    document.getElementById(taId).addEventListener('input', () => updateBatchCount(panel));
}

function updateBatchCount(panel) {
    const taId = panel === 'preset' ? 'preset-text' : `${panel === 'voicedesign' ? 'voicedesign-tagged-text' : 'voiceclone-tagged-text'}`;
    const text = document.getElementById(taId).value;
    const lines = text.split('\n').filter(l => l.trim());
    document.getElementById(`${panel}-batch-count`).textContent = `共 ${lines.length} 段`;
}

async function handleBatchSynthesis(panel) {
    if (!API.getApiKey()) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.add('open'); return; }
    if (State.batchRunning) { UI.toast('批量合成进行中', 'info'); return; }
    const taId = panel === 'preset' ? 'preset-text' : `${panel === 'voicedesign' ? 'voicedesign-tagged-text' : 'voiceclone-tagged-text'}`;
    const text = document.getElementById(taId).value;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) { UI.toast('请输入文本', 'error'); return; }
    if (lines.length > 50) { UI.toast('最多支持 50 段文本', 'error'); return; }

    const autoplay = document.getElementById(`${panel}-batch-autoplay`).checked;
    const btn = document.getElementById(`${panel}-synthesize-btn`);
    const statusEl = document.getElementById(`${panel}-batch-status`);
    const fillEl = document.getElementById(`${panel}-batch-fill`);

    State.batchRunning = true;
    UI.setBtnLoading(btn, true);

    let batchParams;
    if (panel === 'preset') {
        const p = collectPresetParams(); delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    } else if (panel === 'voicedesign') {
        const p = collectVDParams(); delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    } else if (panel === 'voiceclone') {
        const p = collectVCParams(); delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    }

    try {
        let resp;
        if (panel === 'preset') resp = await API.batchSynthesizePreset(batchParams);
        else if (panel === 'voicedesign') resp = await API.batchSynthesizeVoiceDesign(batchParams);
        else if (panel === 'voiceclone') resp = await API.batchSynthesizeVoiceClone(batchParams);

        const results = resp.results || [];
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            statusEl.textContent = `${i + 1}/${results.length}`;
            fillEl.style.width = ((i + 1) / results.length * 100) + '%';
            if (r.success && r.audio_base64) {
                const blob = Utils.base64ToBlob(r.audio_base64);
                saveToHistory(panel, { ...batchParams, text: r.text }, blob, r.duration || 0);
                if (autoplay && i === results.length - 1) await showSynthResult(panel, blob, r.duration || 0);
            }
        }
        const successCount = results.filter(r => r.success).length;
        statusEl.textContent = `完成 · ${successCount}/${results.length} 成功`;
        UI.toast(`批量合成完成 · ${successCount}/${results.length} 成功`, 'success');
    } catch (e) { UI.toast('批量合成失败: ' + e.message, 'error'); statusEl.textContent = '失败'; }
    finally { State.batchRunning = false; UI.setBtnLoading(btn, false); }
}

/* ==================== 合成历史 ==================== */

function initHistoryPanel() {
    const toggle = document.getElementById('history-toggle');
    const panel = document.getElementById('history-panel');
    const chevron = toggle.querySelector('.history-chevron');

    toggle.addEventListener('click', () => {
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? '' : 'none';
        if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    });

    document.getElementById('history-clear').addEventListener('click', async () => {
        if (confirm('确定清空所有合成历史？')) {
            await HistoryDB.clear();
            refreshHistoryUI();
            UI.toast('历史已清空', 'info');
        }
    });
}

async function saveToHistory(panel, params, blob, duration) {
    try {
        const reader = new FileReader();
        reader.onload = async () => {
            const audioBase64 = reader.result.split(',')[1];
            await HistoryDB.add({
                model: panel,
                voice: params.voice || params.voice_description || '',
                text: params.text || '',
                params: JSON.parse(JSON.stringify(params)),
                duration, audioBase64,
            });
            refreshHistoryUI();
        };
        reader.readAsDataURL(blob);
    } catch (e) { console.error('保存历史失败:', e); }
}

async function refreshHistoryUI() {
    const count = await HistoryDB.getCount();
    document.getElementById('history-count').textContent = count;
    const list = document.getElementById('history-list');
    const records = await HistoryDB.getAll();

    if (records.length === 0) {
        list.innerHTML = '<div class="mx-empty"><div class="mx-empty-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="mx-empty-title">暂无合成记录</div><div class="mx-empty-desc">合成语音后，记录会自动保存在这里</div></div>';
        return;
    }

    list.innerHTML = '';
    const modelLabel = { preset: '预置音色', voicedesign: '音色设计', voiceclone: '音色复刻' };
    records.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <button class="history-item-play" data-id="${rec.id}" title="播放">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="history-item-info">
                <div class="history-item-text">${Utils.truncate(rec.text, 60)}</div>
                <div class="history-item-meta">${modelLabel[rec.model] || rec.model} · ${rec.voice || ''} · ${Utils.formatTimestamp(rec.timestamp)}</div>
            </div>
            <div class="history-item-actions">
                <button class="history-item-btn" data-action="download" data-id="${rec.id}" title="下载">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="history-item-btn" data-action="reuse" data-id="${rec.id}" title="复用参数">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
            </div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll('.history-item-play').forEach(btn => btn.addEventListener('click', () => playHistoryItem(btn.dataset.id, records)));
    list.querySelectorAll('[data-action="download"]').forEach(btn => btn.addEventListener('click', () => downloadHistoryItem(btn.dataset.id, records)));
    list.querySelectorAll('[data-action="reuse"]').forEach(btn => btn.addEventListener('click', () => reuseHistoryItem(btn.dataset.id, records)));
}

async function playHistoryItem(id, records) {
    const rec = records.find(r => r.id === id);
    if (!rec || !rec.audioBase64) return;
    const blob = Utils.base64ToBlob(rec.audioBase64);
    const panel = rec.model;
    const panelState = State[panel];
    await panelState.player.loadFromBlob(blob);
    if (panelState.waveform && panelState.player.buffer) panelState.waveform.setAudioBuffer(panelState.player.buffer);
    document.getElementById(`${panel}-output`).classList.remove('hidden');
    const dur = panelState.player.getDuration();
    document.getElementById(`${panel}-duration`).textContent = Utils.formatTime(dur);
    document.getElementById(`${panel}-total-time`).textContent = Utils.formatTime(dur);
    panelState.lastBlob = blob;
    panelState.player.play();
    updatePlayBtn(panel, true);
}

function downloadHistoryItem(id, records) {
    const rec = records.find(r => r.id === id);
    if (!rec || !rec.audioBase64) return;
    Utils.downloadBlob(Utils.base64ToBlob(rec.audioBase64), `tts_${rec.model}_${rec.id}.wav`);
}

function reuseHistoryItem(id, records) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    switchTab(rec.model);
    if (rec.model === 'preset' && rec.params) {
        document.getElementById('preset-text').value = rec.params.text || '';
        if (rec.params.voice) { State.selectedVoice = rec.params.voice; UI.updateVoiceSelection(rec.params.voice); }
        if (rec.params.style_prompt) document.getElementById('preset-style-prompt').value = rec.params.style_prompt;
        if (rec.params.director) {
            document.getElementById('preset-director-toggle').checked = true;
            document.getElementById('preset-director-fields').classList.remove('hidden');
            document.getElementById('director-character').value = rec.params.director.character || '';
            document.getElementById('director-scene').value = rec.params.director.scene || '';
            document.getElementById('director-direction').value = rec.params.director.direction || '';
        }
        document.getElementById('preset-singing-toggle').checked = !!rec.params.singing;
        if (rec.params.audio_tags) {
            State.selectedStyleTags = new Set(rec.params.audio_tags.split(' ').filter(Boolean));
            renderPresetStyleTags();
            UI.updateTagsPreview('tags-preview', State.selectedStyleTags);
        }
    } else if (rec.model === 'voicedesign' && rec.params) {
        document.getElementById('voicedesign-tagged-text').value = rec.params.text || '';
        if (rec.params.voice_description) document.getElementById('voicedesign-description').value = rec.params.voice_description;
    } else if (rec.model === 'voiceclone' && rec.params) {
        document.getElementById('voiceclone-tagged-text').value = rec.params.text || '';
    }
    UI.toast('参数已填充', 'success');
}

/* ==================== 音色试听 ==================== */

async function playVoicePreview(voiceId, previewUrl) {
    if (State.previewPlayingVoice === voiceId) {
        State.previewPlayer.stop();
        State.previewPlayingVoice = null;
        updatePreviewBtnState(voiceId, false);
        return;
    }
    State.previewPlayer.stop();
    if (State.previewPlayingVoice) updatePreviewBtnState(State.previewPlayingVoice, false);
    try {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        await State.previewPlayer.loadFromBlob(blob);
        State.previewPlayingVoice = voiceId;
        updatePreviewBtnState(voiceId, true);
        State.previewPlayer.onEnded = () => { State.previewPlayingVoice = null; updatePreviewBtnState(voiceId, false); };
        State.previewPlayer.play();
    } catch (e) { UI.toast('试听加载失败', 'error'); }
}

function updatePreviewBtnState(voiceId, playing) {
    const btn = document.querySelector(`.voice-preview-btn[data-voice="${voiceId}"]`);
    if (btn) {
        btn.classList.toggle('playing', playing);
        btn.innerHTML = playing
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }
}
