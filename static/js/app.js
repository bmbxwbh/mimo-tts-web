/**
 * MiMo-V2.5-TTS Web UI — 主入口
 *
 * 功能：
 * 1. Tab 切换、侧边栏、移动端导航
 * 2. API Key 管理
 * 3. 预置音色合成（自然语言 / 音频标签 / 导演模式 / 唱歌模式）
 * 4. 音色设计合成
 * 5. 音色复刻合成（文件上传）
 * 6. 批量合成
 * 7. 流式 / 非流式合成
 * 8. 音频播放 + 波形可视化
 * 9. 参数摘要 + 可复现
 * 10. 合成历史（IndexedDB）
 * 11. 音色试听
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

    // 面板状态
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

    // 预览播放器
    previewPlayer: new AudioPlayer(),
    previewPlayingVoice: null,

    // 批量合成中
    batchRunning: false,

    // WebSocket
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
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    },

    async add(record) {
        if (!this.db) return;
        record.id = Utils.uid();
        record.timestamp = Date.now();

        const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.put(record);

        // 超过上限时删除最旧的
        const all = await this.getAll();
        if (all.length > this.MAX_RECORDS) {
            const toDelete = all.slice(0, all.length - this.MAX_RECORDS);
            const tx2 = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store2 = tx2.objectStore(this.STORE_NAME);
            toDelete.forEach(r => store2.delete(r.id));
        }
    },

    async getAll() {
        if (!this.db) return [];
        return new Promise((resolve) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const req = store.getAll();
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
        const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).clear();
    },

    async getCount() {
        const all = await this.getAll();
        return all.length;
    },
};

/* ==================== 初始化 ==================== */

document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 IndexedDB
    await HistoryDB.init();

    // 加载配置数据
    await loadConfigData();

    // 初始化各模块
    initApiKey();
    initApiKeyModal();
    initSidebar();
    initTabSwitch();
    initPresetPanel();
    initVoiceDesignPanel();
    initVoiceClonePanel();
    initSettingsPanel();
    initHistoryPanel();

    // 渲染历史
    refreshHistoryUI();
});

/* ==================== 加载配置 ==================== */

async function loadConfigData() {
    try {
        const [voices, styleTags, audioTags] = await Promise.all([
            API.getVoices(),
            API.getStyleTags(),
            API.getAudioTags(),
        ]);
        State.voices = voices;
        State.styleTags = styleTags;
        State.audioTags = audioTags;
    } catch (e) {
        console.error('加载配置失败:', e);
        UI.toast('加载配置数据失败', 'error');
    }
}

/* ==================== API Key ==================== */

function initApiKey() {
    // API Key 管理已移至设置面板 (initSettingsPanel)
    // 此处仅更新侧边栏状态指示
    const sidebarDot = document.getElementById('sidebar-api-dot');
    const sidebarLabel = document.querySelector('.sidebar-api-label');
    const hasKey = !!API.getApiKey();
    if (sidebarDot) sidebarDot.className = `status-dot ${hasKey ? 'status-dot-green' : 'status-dot-red'}`;
    if (sidebarLabel) sidebarLabel.textContent = hasKey ? 'API 已连接' : 'API 未配置';
}

/* ==================== API Key 弹窗 ==================== */

function initApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    const modalInput = document.getElementById('modal-api-key');
    const modalToggle = document.getElementById('modal-toggle-key');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const settingsInput = document.getElementById('settings-api-key');

    // 没有 API Key 时显示弹窗
    if (!API.getApiKey()) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }

    // 显示/隐藏密码
    modalToggle.addEventListener('click', () => {
        modalInput.type = modalInput.type === 'password' ? 'text' : 'password';
    });

    // 保存
    modalSaveBtn.addEventListener('click', () => {
        const key = modalInput.value.trim();
        if (!key) {
            UI.toast('请输入 API Key', 'error');
            return;
        }
        API.setApiKey(key);
        if (settingsInput) settingsInput.value = key;
        // 更新设置面板状态
        const apiStatus = document.getElementById('settings-api-status');
        const sidebarDot = document.getElementById('sidebar-api-dot');
        const sidebarLabel = document.querySelector('.sidebar-api-label');
        if (apiStatus) {
            apiStatus.textContent = '已配置';
            apiStatus.className = 'settings-status-badge settings-status-on';
        }
        if (sidebarDot) sidebarDot.className = 'status-dot status-dot-green';
        if (sidebarLabel) sidebarLabel.textContent = 'API 已连接';
        modal.classList.add('hidden');
        UI.toast('API Key 已保存', 'success');
    });

    // Enter 键保存
    modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modalSaveBtn.click();
    });

    // 点击遮罩不关闭（强制填写）
    // 但允许已有 Key 的用户通过右上角关闭
    if (API.getApiKey()) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }
}

/* ==================== 设置面板 ==================== */

function initSettingsPanel() {
    const keyInput = document.getElementById('settings-api-key');
    const toggleBtn = document.getElementById('settings-toggle-key');
    const saveBtn = document.getElementById('settings-save-key');
    const testBtn = document.getElementById('settings-test-btn');
    const statusEl = document.getElementById('settings-connection-status');
    const apiStatus = document.getElementById('settings-api-status');
    const sidebarDot = document.getElementById('sidebar-api-dot');
    const sidebarLabel = document.querySelector('.sidebar-api-label');

    // 填充默认音色下拉
    const voiceSelect = document.getElementById('settings-default-voice');
    State.voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.language})`;
        voiceSelect.appendChild(opt);
    });

    // 恢复已保存的设置
    keyInput.value = API.getApiKey();
    const savedVoice = localStorage.getItem('mimo_default_voice') || 'mimo_default';
    voiceSelect.value = savedVoice;
    const savedStream = localStorage.getItem('mimo_default_stream') === 'true';
    document.getElementById('settings-default-stream').checked = savedStream;

    // 更新状态指示
    function updateApiStatus() {
        const hasKey = !!API.getApiKey();
        apiStatus.textContent = hasKey ? '已配置' : '未配置';
        apiStatus.className = `settings-status-badge ${hasKey ? 'settings-status-on' : 'settings-status-off'}`;
        if (sidebarDot) sidebarDot.className = `status-dot ${hasKey ? 'status-dot-green' : 'status-dot-red'}`;
        if (sidebarLabel) sidebarLabel.textContent = hasKey ? 'API 已连接' : 'API 未配置';
    }
    updateApiStatus();

    // 显示/隐藏密码
    toggleBtn.addEventListener('click', () => {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });

    // 保存 API Key
    saveBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (!key) {
            UI.toast('请输入 API Key', 'error');
            return;
        }
        API.setApiKey(key);
        updateApiStatus();
        UI.toast('API Key 已保存', 'success');
    });

    // Enter 保存
    keyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
    });

    // 测试连接
    testBtn.addEventListener('click', async () => {
        if (!keyInput.value.trim()) {
            UI.toast('请先输入 API Key', 'error');
            return;
        }
        // 先保存
        API.setApiKey(keyInput.value.trim());
        updateApiStatus();

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
            UI.toast('网络错误: ' + e.message, 'error');
        } finally {
            testBtn.disabled = false;
        }
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

    // 应用默认流式到各面板
    if (savedStream) {
        document.getElementById('preset-stream-toggle').checked = true;
        document.getElementById('voicedesign-stream-toggle').checked = true;
        document.getElementById('voiceclone-stream-toggle').checked = true;
    }
}

/* ==================== 侧边栏 ==================== */

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

/* ==================== Tab 切换 ==================== */

function initTabSwitch() {
    // 侧边栏导航
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 移动端导航
    document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tab) {
    State.currentTab = tab;

    // 面板切换
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${tab}`).classList.add('active');

    // 导航高亮
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
}

/* ==================== 预置音色面板 ==================== */

function initPresetPanel() {
    // 渲染音色
    UI.renderVoiceGrid(State.voices, State.selectedVoice, (id) => {
        State.selectedVoice = id;
        UI.updateVoiceSelection(id);
    }, (id, url) => {
        playVoicePreview(id, url);
    });

    // 渲染标签
    renderPresetStyleTags();
    UI.renderAudioTags('audio-tags-container', State.audioTags, (tag) => {
        const ta = document.getElementById('preset-tagged-text');
        UI.insertAtCursor(ta, `[${tag}]`);
    });

    // 子 Tab
    const subTabs = document.querySelector('#panel-preset .sub-tabs');
    if (subTabs) {
        UI.initSubTabs(subTabs, (subtab) => {
            document.getElementById('preset-natural-lang').classList.toggle('active', subtab === 'natural-lang');
            document.getElementById('preset-audio-tags').classList.toggle('active', subtab === 'audio-tags');
        });
    }

    // 字数统计
    UI.bindCharCount('preset-style-prompt', 'preset-style-count');
    UI.bindCharCount('preset-text', 'preset-text-count');

    // 导演模式
    document.getElementById('preset-director-toggle').addEventListener('change', (e) => {
        document.getElementById('preset-director-fields').classList.toggle('hidden', !e.target.checked);
    });

    // 波形
    State.preset.waveform = new WaveformRenderer(document.getElementById('preset-waveform'));

    // 合成
    document.getElementById('preset-synthesize-btn').addEventListener('click', () => handlePresetSynthesis());

    // 播放控制
    initPlayerControls('preset', State.preset);

    // 下载
    document.getElementById('preset-download-btn').addEventListener('click', () => {
        if (State.preset.lastBlob) {
            Utils.downloadBlob(State.preset.lastBlob, 'preset_audio.wav');
        }
    });

    // 批量模式
    initBatchMode('preset');

    // 参数摘要按钮
    document.getElementById('preset-copy-params').addEventListener('click', () => copyParams('preset'));
    document.getElementById('preset-resynthesize').addEventListener('click', () => resynthesize('preset'));
}

function renderPresetStyleTags() {
    UI.renderStyleTags('style-tags-container', State.styleTags, State.selectedStyleTags, (tag) => {
        if (State.selectedStyleTags.has(tag)) {
            State.selectedStyleTags.delete(tag);
        } else {
            State.selectedStyleTags.add(tag);
        }
        renderPresetStyleTags();
        UI.updateTagsPreview('tags-preview', State.selectedStyleTags);
    });
}

async function handlePresetSynthesis() {
    const apiKey = API.getApiKey();
    if (!apiKey) {
        UI.toast('请先输入 API Key', 'error');
        document.getElementById('api-key-modal').classList.remove('hidden');
        return;
    }

    const isBatch = document.getElementById('preset-batch-toggle').checked;
    const isStream = document.getElementById('preset-stream-toggle').checked;
    const btn = document.getElementById('preset-synthesize-btn');

    if (isBatch) {
        await handleBatchSynthesis('preset');
        return;
    }

    // 收集参数
    const params = collectPresetParams();
    if (!params.text) {
        UI.toast('请输入合成文本', 'error');
        return;
    }

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

    // 确定实际文本和标签
    let finalText = text;
    let audioTags = null;

    // 如果在音频标签 tab，用 taggedText
    const audioTabActive = document.getElementById('preset-audio-tags').classList.contains('active');
    if (audioTabActive && taggedText) {
        finalText = taggedText;
    }

    // 选中的风格标签
    if (State.selectedStyleTags.size > 0) {
        audioTags = [...State.selectedStyleTags].join(' ');
    }

    const params = {
        voice: State.selectedVoice,
        text: finalText,
        singing,
    };

    // 导演模式
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
    // 模板 chips
    const templates = [
        '温柔甜美的年轻女性',
        '低沉磁性的成熟男性',
        '活泼俏皮的少女',
        '苍老慈祥的老人',
    ];
    const chipsRow = document.getElementById('voicedesign-templates');
    templates.forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = t;
        chip.addEventListener('click', () => {
            document.getElementById('voicedesign-description').value = t;
        });
        chipsRow.appendChild(chip);
    });

    // 渲染标签
    renderVDStyleTags();
    UI.renderAudioTags('voicedesign-audio-tags', State.audioTags, (tag) => {
        const ta = document.getElementById('voicedesign-tagged-text');
        UI.insertAtCursor(ta, `[${tag}]`);
    });

    // 字数统计
    UI.bindCharCount('voicedesign-tagged-text', 'voicedesign-text-count');

    // 波形
    State.voicedesign.waveform = new WaveformRenderer(document.getElementById('voicedesign-waveform'));

    // 合成
    document.getElementById('voicedesign-synthesize-btn').addEventListener('click', () => handleVDSynthesis());

    // 播放控制
    initPlayerControls('voicedesign', State.voicedesign);

    // 下载
    document.getElementById('voicedesign-download-btn').addEventListener('click', () => {
        if (State.voicedesign.lastBlob) Utils.downloadBlob(State.voicedesign.lastBlob, 'voicedesign_audio.wav');
    });

    // 批量模式
    initBatchMode('voicedesign');

    // 参数摘要
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
    const apiKey = API.getApiKey();
    if (!apiKey) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.remove('hidden'); return; }

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
        if (isStream) {
            await streamSynthesis('voicedesign', params);
        } else {
            const { blob, duration } = await API.synthesizeVoiceDesign(params);
            const elapsed = (performance.now() - startTime) / 1000;
            await showSynthResult('voicedesign', blob, duration || elapsed);
            saveToHistory('voicedesign', params, blob, duration || elapsed);
        }
    } catch (e) {
        UI.toast('合成失败: ' + e.message, 'error');
    } finally {
        UI.setBtnLoading(btn, false);
    }
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
    const fileBtn = document.getElementById('voiceclone-file-btn');
    const fileInfo = document.getElementById('voiceclone-file-info');
    const removeBtn = document.getElementById('voiceclone-remove-btn');

    // 拖拽
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleCloneFile(e.dataTransfer.files[0]);
    });

    // 点击上传
    fileBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleCloneFile(fileInput.files[0]);
    });

    // 移除
    removeBtn.addEventListener('click', () => {
        State.voiceclone.audioBase64 = null;
        State.voiceclone.mimeType = null;
        fileInfo.classList.add('hidden');
        dropzone.classList.remove('hidden');
        fileInput.value = '';
    });

    // 渲染标签
    renderVCStyleTags();
    UI.renderAudioTags('voiceclone-audio-tags', State.audioTags, (tag) => {
        const ta = document.getElementById('voiceclone-tagged-text');
        UI.insertAtCursor(ta, `[${tag}]`);
    });

    // 字数统计
    UI.bindCharCount('voiceclone-tagged-text', 'voiceclone-text-count');

    // 波形
    State.voiceclone.waveform = new WaveformRenderer(document.getElementById('voiceclone-waveform'));
    // 预览波形（小）
    State.voiceclone.previewWaveform = new WaveformRenderer(document.getElementById('voiceclone-preview-waveform'));

    // 合成
    document.getElementById('voiceclone-synthesize-btn').addEventListener('click', () => handleVCSynthesis());

    // 播放控制
    initPlayerControls('voiceclone', State.voiceclone);

    // 下载
    document.getElementById('voiceclone-download-btn').addEventListener('click', () => {
        if (State.voiceclone.lastBlob) Utils.downloadBlob(State.voiceclone.lastBlob, 'voiceclone_audio.wav');
    });

    // 批量模式
    initBatchMode('voiceclone');

    // 参数摘要
    document.getElementById('voiceclone-copy-params').addEventListener('click', () => copyParams('voiceclone'));
    document.getElementById('voiceclone-resynthesize').addEventListener('click', () => resynthesize('voiceclone'));
}

async function handleCloneFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav'].includes(ext)) {
        UI.toast('仅支持 MP3 和 WAV 格式', 'error');
        return;
    }

    const base64 = await Utils.fileToBase64(file);
    if (base64.length > 10 * 1024 * 1024) {
        UI.toast('Base64 后超过 10MB 限制', 'error');
        return;
    }

    State.voiceclone.audioBase64 = base64;
    State.voiceclone.mimeType = Utils.getMimeType(file.name);

    // 显示文件信息
    document.getElementById('voiceclone-dropzone').classList.add('hidden');
    const info = document.getElementById('voiceclone-file-info');
    info.classList.remove('hidden');
    document.getElementById('voiceclone-file-name').textContent = file.name;
    document.getElementById('voiceclone-file-meta').textContent = `${Utils.formatSize(file.size)} · ${ext.toUpperCase()}`;

    // 绘制预览波形
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
    const apiKey = API.getApiKey();
    if (!apiKey) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.remove('hidden'); return; }

    if (!State.voiceclone.audioBase64) {
        UI.toast('请先上传音频样本', 'error');
        return;
    }

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
        if (isStream) {
            await streamSynthesis('voiceclone', params);
        } else {
            const { blob, duration } = await API.synthesizeVoiceClone(params);
            const elapsed = (performance.now() - startTime) / 1000;
            await showSynthResult('voiceclone', blob, duration || elapsed);
            saveToHistory('voiceclone', params, blob, duration || elapsed);
        }
    } catch (e) {
        UI.toast('合成失败: ' + e.message, 'error');
    } finally {
        UI.setBtnLoading(btn, false);
    }
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

/* ==================== 通用：播放控制 ==================== */

function initPlayerControls(panel, panelState) {
    const player = panelState.player;
    const waveform = panelState.waveform;

    // 播放/暂停
    document.getElementById(`${panel}-play-btn`).addEventListener('click', () => {
        if (player.isPlaying) {
            player.pause();
        } else {
            player.play();
        }
        updatePlayBtn(panel, player.isPlaying);
    });

    // 进度条点击
    document.getElementById(`${panel}-progress-bar`).addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        player.seek(frac * player.getDuration());
    });

    // 音量
    document.getElementById(`${panel}-volume`).addEventListener('input', (e) => {
        player.setVolume(parseFloat(e.target.value));
    });

    // 时间更新
    player.onTimeUpdate = (current, total) => {
        const fill = document.getElementById(`${panel}-progress-fill`);
        const curLabel = document.getElementById(`${panel}-current-time`);
        const totLabel = document.getElementById(`${panel}-total-time`);

        if (fill) fill.style.width = (total > 0 ? (current / total * 100) : 0) + '%';
        if (curLabel) curLabel.textContent = Utils.formatTime(current);
        if (totLabel) totLabel.textContent = Utils.formatTime(total);

        if (waveform) waveform.setProgress(total > 0 ? current / total : 0);
    };

    // 播放结束
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

    // 显示输出区
    const output = document.getElementById(`${panel}-output`);
    output.classList.remove('hidden');

    // 加载播放器
    await panelState.player.loadFromBlob(blob);

    // 绘制波形
    if (panelState.waveform && panelState.player.buffer) {
        panelState.waveform.setAudioBuffer(panelState.player.buffer);
    }

    // 时长
    const dur = panelState.player.getDuration();
    document.getElementById(`${panel}-duration`).textContent = `${Utils.formatTime(dur)} · ${duration.toFixed(1)}s`;
    document.getElementById(`${panel}-total-time`).textContent = Utils.formatTime(dur);
    document.getElementById(`${panel}-current-time`).textContent = '0:00';
    document.getElementById(`${panel}-progress-fill`).style.width = '0%';

    updatePlayBtn(panel, false);

    // 参数摘要
    updateParamSummary(panel, duration);
}

/* ==================== 参数摘要 + 可复现 ==================== */

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

    // 去掉 API Key
    const clean = { ...params };
    delete clean.api_key;

    const json = JSON.stringify(clean, null, 2);
    const ok = await Utils.copyToClipboard(json);
    UI.toast(ok ? '已复制到剪贴板' : '复制失败', ok ? 'success' : 'error');
}

function resynthesize(panel) {
    const params = State[panel].lastParams;
    if (!params) return;

    // 重新填充到表单并触发合成
    if (panel === 'preset') {
        document.getElementById('preset-text').value = params.text || '';
        if (params.voice) {
            State.selectedVoice = params.voice;
            UI.updateVoiceSelection(params.voice);
        }
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

    // 构造 WebSocket 配置
    const wsConfig = { type: modelMap[panel] };
    if (panel === 'preset') {
        wsConfig.voice = params.voice;
        wsConfig.text = params.text;
        wsConfig.style_prompt = params.style_prompt;
        wsConfig.audio_tags = params.audio_tags;
        wsConfig.director = params.director;
        wsConfig.singing = params.singing;
    } else if (panel === 'voicedesign') {
        wsConfig.voice_description = params.voice_description;
        wsConfig.text = params.text;
        wsConfig.audio_tags = params.audio_tags;
    } else if (panel === 'voiceclone') {
        wsConfig.audio_base64 = params.audio_base64;
        wsConfig.mime_type = params.mime_type;
        wsConfig.text = params.text;
        wsConfig.audio_tags = params.audio_tags;
    }

    const chunks = [];
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
        State.ws = API.synthesizeStream(wsConfig,
            // onChunk
            (arrayBuffer) => {
                chunks.push(arrayBuffer);
            },
            // onDone
            async (info) => {
                const elapsed = (performance.now() - startTime) / 1000;

                // 拼接 PCM → WAV
                await panelState.player.loadFromPCMChunks(chunks);

                // 生成 WAV blob
                const wavBlob = panelState.player.toWavBlob();

                // 显示结果
                const output = document.getElementById(`${panel}-output`);
                output.classList.remove('hidden');

                if (panelState.waveform && panelState.player.buffer) {
                    panelState.waveform.setAudioBuffer(panelState.player.buffer);
                }

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
            // onError
            (msg) => {
                UI.toast('流式合成失败: ' + msg, 'error');
                reject(new Error(msg));
            }
        );
    });
}

/* ==================== 批量合成 ==================== */

function initBatchMode(panel) {
    const toggle = document.getElementById(`${panel}-batch-toggle`);
    const progress = document.getElementById(`${panel}-batch-progress`);

    toggle.addEventListener('change', () => {
        progress.classList.toggle('hidden', !toggle.checked);

        // 更新 textarea placeholder
        const taId = panel === 'preset' ? 'preset-text' : `${panel === 'voicedesign' ? 'voicedesign-tagged-text' : 'voiceclone-tagged-text'}`;
        const ta = document.getElementById(taId);
        if (toggle.checked) {
            ta.placeholder = '每行输入一段文本，逐行合成';
        } else {
            ta.placeholder = panel === 'preset' ? '输入要合成的文本内容……' : '输入要合成的文本';
        }

        // 更新段数
        updateBatchCount(panel);
    });

    // 文本变化时更新段数
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
    const apiKey = API.getApiKey();
    if (!apiKey) { UI.toast('请先输入 API Key', 'error'); document.getElementById('api-key-modal').classList.remove('hidden'); return; }
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

    // 构造批量请求参数
    let batchParams;
    if (panel === 'preset') {
        const p = collectPresetParams();
        delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    } else if (panel === 'voicedesign') {
        const p = collectVDParams();
        delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    } else if (panel === 'voiceclone') {
        const p = collectVCParams();
        delete p.text;
        batchParams = { ...p, texts: lines.map(t => ({ text: t })) };
    }

    try {
        let resp;
        const startTime = performance.now();

        if (panel === 'preset') {
            resp = await API.batchSynthesizePreset(batchParams);
        } else if (panel === 'voicedesign') {
            resp = await API.batchSynthesizeVoiceDesign(batchParams);
        } else if (panel === 'voiceclone') {
            resp = await API.batchSynthesizeVoiceClone(batchParams);
        }

        const elapsed = (performance.now() - startTime) / 1000;
        const results = resp.results || [];

        // 逐条处理
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            statusEl.textContent = `${i + 1}/${results.length}`;
            fillEl.style.width = ((i + 1) / results.length * 100) + '%';

            if (r.success && r.audio_base64) {
                const blob = Utils.base64ToBlob(r.audio_base64);

                // 保存到历史
                saveToHistory(panel, { ...batchParams, text: r.text }, blob, r.duration || 0);

                // 自动播放最后一条
                if (autoplay && i === results.length - 1) {
                    await showSynthResult(panel, blob, r.duration || 0);
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        statusEl.textContent = `完成 · ${successCount}/${results.length} 成功`;
        UI.toast(`批量合成完成 · ${successCount}/${results.length} 成功 · ${elapsed.toFixed(1)}s`, 'success');

    } catch (e) {
        UI.toast('批量合成失败: ' + e.message, 'error');
        statusEl.textContent = '失败';
    } finally {
        State.batchRunning = false;
        UI.setBtnLoading(btn, false);
    }
}

/* ==================== 合成历史 ==================== */

function initHistoryPanel() {
    const toggle = document.getElementById('history-toggle');
    const panel = document.getElementById('history-panel');
    const clearBtn = document.getElementById('history-clear');
    const chevron = toggle.querySelector('.history-chevron');

    toggle.addEventListener('click', () => {
        const collapsed = panel.classList.toggle('collapsed');
        chevron.style.transform = collapsed ? '' : 'rotate(180deg)';
    });

    clearBtn.addEventListener('click', async () => {
        if (confirm('确定清空所有合成历史？')) {
            await HistoryDB.clear();
            refreshHistoryUI();
            UI.toast('历史已清空', 'info');
        }
    });
}

async function saveToHistory(panel, params, blob, duration) {
    try {
        const audioBase64 = await blobToBase64(blob);
        await HistoryDB.add({
            model: panel,
            voice: params.voice || params.voice_description || '',
            text: params.text || '',
            params: JSON.parse(JSON.stringify(params)),
            duration: duration,
            audioBase64: audioBase64,
        });
        refreshHistoryUI();
    } catch (e) {
        console.error('保存历史失败:', e);
    }
}

function blobToBase64(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
}

async function refreshHistoryUI() {
    const count = await HistoryDB.getCount();
    document.getElementById('history-count').textContent = count;

    const list = document.getElementById('history-list');
    const records = await HistoryDB.getAll();

    if (records.length === 0) {
        list.innerHTML = '<div class="history-empty">暂无合成记录</div>';
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

    // 绑定事件
    list.querySelectorAll('.history-item-play').forEach(btn => {
        btn.addEventListener('click', () => playHistoryItem(btn.dataset.id, records));
    });
    list.querySelectorAll('[data-action="download"]').forEach(btn => {
        btn.addEventListener('click', () => downloadHistoryItem(btn.dataset.id, records));
    });
    list.querySelectorAll('[data-action="reuse"]').forEach(btn => {
        btn.addEventListener('click', () => reuseHistoryItem(btn.dataset.id, records));
    });
}

function findRecord(id, records) {
    return records.find(r => r.id === id);
}

async function playHistoryItem(id, records) {
    const rec = findRecord(id, records);
    if (!rec || !rec.audioBase64) return;

    const blob = Utils.base64ToBlob(rec.audioBase64);
    const panel = rec.model;
    const panelState = State[panel];

    await panelState.player.loadFromBlob(blob);
    if (panelState.waveform && panelState.player.buffer) {
        panelState.waveform.setAudioBuffer(panelState.player.buffer);
    }

    const output = document.getElementById(`${panel}-output`);
    output.classList.remove('hidden');

    const dur = panelState.player.getDuration();
    document.getElementById(`${panel}-duration`).textContent = Utils.formatTime(dur);
    document.getElementById(`${panel}-total-time`).textContent = Utils.formatTime(dur);
    panelState.lastBlob = blob;

    panelState.player.play();
    updatePlayBtn(panel, true);
}

function downloadHistoryItem(id, records) {
    const rec = findRecord(id, records);
    if (!rec || !rec.audioBase64) return;
    const blob = Utils.base64ToBlob(rec.audioBase64);
    Utils.downloadBlob(blob, `tts_${rec.model}_${rec.id}.wav`);
}

function reuseHistoryItem(id, records) {
    const rec = findRecord(id, records);
    if (!rec) return;

    // 切换到对应 tab
    switchTab(rec.model);

    // 填充参数
    if (rec.model === 'preset' && rec.params) {
        document.getElementById('preset-text').value = rec.params.text || '';
        if (rec.params.voice) {
            State.selectedVoice = rec.params.voice;
            UI.updateVoiceSelection(rec.params.voice);
        }
        if (rec.params.style_prompt) {
            document.getElementById('preset-style-prompt').value = rec.params.style_prompt;
        }
        if (rec.params.singing) {
            document.getElementById('preset-singing-toggle').checked = true;
        }
    } else if (rec.model === 'voicedesign' && rec.params) {
        document.getElementById('voicedesign-tagged-text').value = rec.params.text || '';
        if (rec.params.voice_description) {
            document.getElementById('voicedesign-description').value = rec.params.voice_description;
        }
    } else if (rec.model === 'voiceclone' && rec.params) {
        document.getElementById('voiceclone-tagged-text').value = rec.params.text || '';
    }

    UI.toast('参数已填充', 'success');
}

/* ==================== 音色试听 ==================== */

async function playVoicePreview(voiceId, previewUrl) {
    // 如果正在播放同一个音色，停止
    if (State.previewPlayingVoice === voiceId) {
        State.previewPlayer.stop();
        State.previewPlayingVoice = null;
        updatePreviewBtnState(voiceId, false);
        return;
    }

    // 停止之前的
    State.previewPlayer.stop();
    if (State.previewPlayingVoice) {
        updatePreviewBtnState(State.previewPlayingVoice, false);
    }

    try {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        await State.previewPlayer.loadFromBlob(blob);

        State.previewPlayingVoice = voiceId;
        updatePreviewBtnState(voiceId, true);

        State.previewPlayer.onEnded = () => {
            State.previewPlayingVoice = null;
            updatePreviewBtnState(voiceId, false);
        };

        State.previewPlayer.play();
    } catch (e) {
        UI.toast('试听加载失败', 'error');
    }
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
