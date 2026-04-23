/**
 * MiMo-V2.5-TTS Web UI — UI 交互组件
 */

'use strict';

const UI = {
    /** Toast 通知 */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const iconMap = {
            success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        };

        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        el.querySelector('.toast-close').onclick = () => removeToast(el);
        container.appendChild(el);

        setTimeout(() => removeToast(el), duration);

        function removeToast(t) {
            if (t.classList.contains('removing')) return;
            t.classList.add('removing');
            setTimeout(() => t.remove(), 300);
        }
    },

    /** 设置按钮 loading 状态 */
    setBtnLoading(btn, loading) {
        if (loading) {
            btn.disabled = true;
            btn.classList.add('loading');
            const txt = btn.querySelector('.btn-text');
            if (txt) txt.dataset.origText = txt.textContent;
            const svg = btn.querySelector('svg');
            if (svg) svg.style.display = 'none';
            const spinner = document.createElement('span');
            spinner.className = 'spinner';
            btn.appendChild(spinner);
            if (txt) txt.textContent = '合成中…';
        } else {
            btn.disabled = false;
            btn.classList.remove('loading');
            const spinner = btn.querySelector('.spinner');
            if (spinner) spinner.remove();
            const svg = btn.querySelector('svg');
            if (svg) svg.style.display = '';
            const txt = btn.querySelector('.btn-text');
            if (txt) txt.textContent = txt.dataset.origText || '开始合成';
        }
    },

    /** 渲染音色网格 */
    renderVoiceGrid(voices, selectedId, onSelect, onPreview) {
        const grid = document.getElementById('voice-grid');
        grid.innerHTML = '';
        const genderIcon = {
            male: '♂',
            female: '♀',
            neutral: '◉',
        };
        voices.forEach(v => {
            const card = document.createElement('div');
            card.className = `voice-card${v.id === selectedId ? ' selected' : ''}`;
            card.dataset.voiceId = v.id;
            card.innerHTML = `
                <button class="voice-preview-btn" data-voice="${v.id}" title="试听">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <div class="voice-card-name">${v.name}</div>
                <div class="voice-card-meta">
                    <span>${genderIcon[v.gender] || '◉'}</span>
                    <span class="voice-card-badge">${v.language}</span>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.voice-preview-btn')) return;
                onSelect(v.id);
            });
            card.querySelector('.voice-preview-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onPreview(v.id, v.preview_url);
            });
            grid.appendChild(card);
        });
    },

    /** 更新音色选中状态 */
    updateVoiceSelection(selectedId) {
        document.querySelectorAll('.voice-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.voiceId === selectedId);
        });
    },

    /** 渲染风格标签 */
    renderStyleTags(containerId, tags, selectedSet, onToggle) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for (const [category, items] of Object.entries(tags)) {
            const catEl = document.createElement('span');
            catEl.className = 'tag-chip-category';
            catEl.textContent = category;
            container.appendChild(catEl);

            items.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = `tag-chip${selectedSet.has(tag) ? ' selected' : ''}`;
                chip.textContent = tag;
                chip.addEventListener('click', () => onToggle(tag));
                container.appendChild(chip);
            });
        }
    },

    /** 渲染音频标签 */
    renderAudioTags(containerId, tags, onInsert) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.addEventListener('click', () => onInsert(tag));
            container.appendChild(chip);
        });
    },

    /** 更新标签预览 */
    updateTagsPreview(previewId, selectedSet) {
        const preview = document.getElementById(previewId);
        const textEl = document.getElementById(previewId.replace('-preview', '-preview-text'));
        if (selectedSet.size === 0) {
            preview.classList.add('hidden');
        } else {
            preview.classList.remove('hidden');
            textEl.textContent = `(${[...selectedSet].join(' ')})`;
        }
    },

    /** 渲染参数摘要 */
    renderParamSummary(rowsId, params) {
        const container = document.getElementById(rowsId);
        container.innerHTML = '';
        params.forEach(({ label, value }) => {
            const row = document.createElement('div');
            row.className = 'param-row';
            row.innerHTML = `<span class="param-row-label">${label}</span><span class="param-row-value">${value}</span>`;
            container.appendChild(row);
        });
    },

    /** 初始化子 Tab 切换 */
    initSubTabs(tabsContainer, onSwitch) {
        const tabs = tabsContainer.querySelectorAll('.sub-tab');
        const indicator = tabsContainer.querySelector('.sub-tab-indicator');

        function updateIndicator() {
            const active = tabsContainer.querySelector('.sub-tab.active');
            if (active && indicator) {
                indicator.style.left = active.offsetLeft + 'px';
                indicator.style.width = active.offsetWidth + 'px';
            }
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateIndicator();
                if (onSwitch) onSwitch(tab.dataset.subtab);
            });
        });

        // 初始位置
        requestAnimationFrame(updateIndicator);
    },

    /** 字数统计绑定 */
    bindCharCount(textareaId, countId) {
        const ta = document.getElementById(textareaId);
        const count = document.getElementById(countId);
        if (!ta || !count) return;
        const update = () => { count.textContent = ta.value.length; };
        ta.addEventListener('input', update);
        update();
    },

    /** 在 textarea 光标位置插入文本 */
    insertAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.slice(0, start) + text + val.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
    },
};
