# MiMo-V2.5-TTS Web UI — 项目任务分解

> 基于小米 MiMo-V2.5-TTS 系列 API 的语音合成 Web 应用
> 技术栈：FastAPI + httpx + websockets（后端）| 原生 HTML/CSS/JS（前端）

---

## Epic 1：项目骨架

### 1.1 项目结构初始化
- 创建目录结构
- 编写 `requirements.txt`
- 编写 `Dockerfile` + `docker-compose.yml`
- 编写 `README.md`

**目录结构：**
```
mimo-tts-web/
├── main.py                 # FastAPI 入口
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── README.md
├── config.py               # 配置常量
├── schemas.py              # Pydantic 请求/响应模型
├── routers/
│   ├── synthesize.py       # 合成相关路由
│   └── health.py           # 健康检查 / 连接测试
├── services/
│   ├── mimo_client.py      # MiMo API 客户端封装
│   └── audio_utils.py      # 音频处理工具
├── static/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js          # 主入口 / 路由
│   │   ├── api.js          # 后端 API 调用封装
│   │   ├── audio.js        # Web Audio 播放器
│   │   ├── ui.js           # UI 交互逻辑
│   │   └── utils.js        # 工具函数
│   └── assets/
│       └── icons/          # SVG 图标
```

### 1.2 FastAPI 应用骨架
- 创建 `main.py`，注册路由、CORS、静态文件挂载
- 创建 `config.py`，定义常量（MiMo API base URL、支持的格式等）
- 创建 `schemas.py`，定义所有 Pydantic 模型

---

## Epic 2：后端服务

### 2.1 MiMo API 客户端封装 (`services/mimo_client.py`)

统一封装对 MiMo API 的调用逻辑，三个模型共享：

- `synthesize_nonstream(model, messages, audio_config, api_key) -> bytes`
  - 发送非流式请求
  - 解码 base64 音频
  - 返回 WAV bytes
- `synthesize_stream(model, messages, audio_config, api_key) -> AsyncGenerator[bytes]`
  - 发送流式请求（stream=True）
  - 逐 chunk 解码 PCM bytes
  - yield 每个 chunk
- 通用错误处理：网络超时、API 错误码映射、重试逻辑

### 2.2 请求/响应模型 (`schemas.py`)

```python
# 通用
class AudioConfig:
    format: "wav" | "pcm16"
    voice: str | None

# 预置音色合成
class PresetRequest:
    api_key: str
    voice: str           # 音色 ID
    text: str            # 合成文本 (assistant)
    style_prompt: str | None      # 自然语言控制 (user)
    audio_tags: str | None        # 音频标签前缀
    director: DirectorConfig | None  # 导演模式
    singing: bool
    stream: bool

# 音色设计
class VoiceDesignRequest:
    api_key: str
    voice_description: str   # 音色描述 (user)
    text: str                # 合成文本 (assistant)
    audio_tags: str | None
    stream: bool

# 音色复刻
class VoiceCloneRequest:
    api_key: str
    audio_base64: str        # 样本音频 Base64
    mime_type: str           # audio/mpeg | audio/wav
    text: str                # 合成文本 (assistant)
    audio_tags: str | None
    stream: bool

class DirectorConfig:
    character: str   # 角色
    scene: str       # 场景
    direction: str   # 指导
```

### 2.3 合成路由 (`routers/synthesize.py`)

- `POST /api/synthesize/preset`
  - 接收 PresetRequest
  - 构造 messages（user + assistant）
  - 调用 mimo_client 非流式
  - 返回 WAV 文件流（StreamingResponse）

- `POST /api/synthesize/voicedesign`
  - 接收 VoiceDesignRequest
  - 构造 messages
  - 调用 mimo_client 非流式
  - 返回 WAV 文件流

- `POST /api/synthesize/voiceclone`
  - 接收 VoiceCloneRequest
  - 构造 messages + audio.voice（带 data: 前缀）
  - 调用 mimo_client 非流式
  - 返回 WAV 文件流

- `WS /ws/synthesize`
  - 接收 JSON 配置
  - 调用 mimo_client 流式
  - 逐 chunk 发送 PCM bytes（二进制帧）
  - 发送结束信号（JSON 帧）

### 2.4 健康检查路由 (`routers/health.py`)

- `GET /api/test-connection`
  - 接收 api_key（header）
  - 调用 MiMo API 一个轻量请求验证
  - 返回连接状态

### 2.5 音频工具 (`services/audio_utils.py`)

- `pcm_to_wav(pcm_bytes, sample_rate=24000, channels=1, sample_width=2) -> bytes`
  - PCM16LE → WAV 封装
- `get_audio_duration(wav_bytes) -> float`
  - 计算音频时长

---

## Epic 3：前端 — 页面骨架与样式

### 3.1 HTML 结构 (`static/index.html`)

- 侧边栏：Logo + 导航菜单 + 设置面板
- 工作区：三个 Tab 面板（预置音色 / 音色设计 / 音色复刻）
- 全局 Toast 通知容器
- 引入所有 JS / CSS

### 3.2 CSS 样式 (`static/css/style.css`)

- CSS 变量定义（颜色、间距、字体）
- 暗色主题
- 侧边栏布局（固定宽度 + 折叠响应）
- Tab 面板切换动画
- 音色卡片网格
- 风格标签 chips 样式
- 音频播放器自定义样式
- 波形 Canvas 样式
- 按钮 / 输入框 / 文本框通用组件
- Toast 通知样式
- 上传拖拽区域样式
- 响应式断点（移动端适配）

---

## Epic 4：前端 — 设置与连接

### 4.1 API Key 管理 (`js/app.js` + `js/api.js`)

- API Key 输入框（password 类型 + 显示/隐藏切换）
- 存入 localStorage
- 从 localStorage 恢复
- "测试连接" 按钮 → 调用 `/api/test-connection`

### 4.2 API 调用封装 (`js/api.js`)

- `synthesizePreset(params) -> { audio, duration }`
- `synthesizeVoiceDesign(params) -> { audio, duration }`
- `synthesizeVoiceClone(params) -> { audio, duration }`
- `testConnection(apiKey) -> { success, message }`
- `synthesizePresetStream(params, onChunk, onDone)`
- 统一错误处理 + 超时

---

## Epic 5：前端 — 预置音色合成面板

### 5.1 音色选择器

- 8 个音色卡片组件（名称 + 语言标签 + 性别图标）
- 单选逻辑，选中高亮边框
- 默认选中 `mimo_default`
- 返回选中的 voice ID

### 5.2 风格控制区

- 子 Tab 切换：自然语言 / 音频标签
- **自然语言 Tab**：
  - textarea，placeholder 示例文案
  - 字数统计
- **音频标签 Tab**：
  - 顶部风格 chips（分类展示：情绪/语调/音色/方言/角色扮演/唱歌）
  - 点击 chip 切换选中状态
  - 选中的 chips 拼成 `(风格1 风格2)` 前缀预览
  - 正文 textarea
  - 插入标签按钮组（吸气/叹气/颤抖/轻笑/沉默片刻...）
  - 点击在光标位置插入 `[标签]`
- **导演模式**：开关 + 三个 textarea（角色/场景/指导）
- **唱歌模式**：开关，开启后自动添加 `(唱歌)` 前缀

### 5.3 合成文本区

- 大 textarea（目标文本）
- 字数统计
- 合成按钮（主色调、大尺寸）
- 流式/非流式切换开关

### 5.4 输出区

- 音频播放器（play/pause + 进度条 + 音量）
- 波形可视化 Canvas
- 下载按钮
- 合成耗时显示
- 合成中 loading 状态（按钮禁用 + spinner）

---

## Epic 6：前端 — 音色设计面板

### 6.1 音色描述输入

- textarea："描述你想要的音色"
- 预设模板 chips（点击填充）：
  - "温柔甜美的年轻女性"
  - "低沉磁性的成熟男性"
  - "活泼俏皮的少女"
  - "苍老慈祥的老人"

### 6.2 音频标签风格控制

- 复用 Epic 5.2 的音频标签部分（无自然语言 Tab）

### 6.3 合成文本区 + 输出区

- 同 Epic 5.3 + 5.4

---

## Epic 7：前端 — 音色复刻面板

### 7.1 音频样本上传

- 拖拽上传区域（drag & drop）
- 文件选择按钮
- 格式校验（仅 mp3 / wav）
- 大小校验（Base64 后 ≤ 10MB）
- 上传成功后显示：
  - 文件名 + 大小 + 时长
  - 波形预览（小 Canvas）
  - 移除按钮

### 7.2 音频标签风格控制

- 同 Epic 6.2

### 7.3 合成文本区 + 输出区

- 同 Epic 5.3 + 5.4

---

## Epic 8：前端 — 音频播放与可视化

### 8.1 Web Audio 播放器 (`js/audio.js`)

- `AudioPlayer` 类
  - `loadFromBlob(wavBlob)` — 加载 WAV
  - `loadFromPCMChunks(chunks)` — 流式拼接 PCM
  - `play()` / `pause()` / `stop()`
  - `seek(time)`
  - `setVolume(0-1)`
  - `getDuration()` / `getCurrentTime()`
  - 进度更新回调

### 8.2 波形可视化

- `WaveformRenderer` 类
  - 接收 AudioBuffer 或 PCM 数据
  - Canvas 绘制波形
  - 播放进度高亮
  - 响应式宽度

### 8.3 流式播放

- WebSocket 连接管理
- PCM chunk 实时送入 AudioWorklet / ScriptProcessor
- 边收边播，低延迟体验
- 播放结束后可切换为完整文件下载

---

## Epic 9：部署与文档

### 9.1 Docker 部署

- `Dockerfile`（Python 基础镜像 + 依赖安装 + 静态文件）
- `docker-compose.yml`（单服务 + 端口映射）
- 环境变量支持（端口、worker 数）

### 9.2 README

- 项目介绍 + 功能截图
- 快速启动（pip / docker）
- 配置说明
- API 文档（自动 FastAPI docs）

---

## 执行顺序

```
Phase 1（骨架）  → Epic 1 + 2.1 + 2.2 + 3.1 + 3.2
Phase 2（核心）  → Epic 2.3 + 2.4 + 2.5 + 4 + 5
Phase 3（扩展）  → Epic 6 + 7
Phase 4（体验）  → Epic 8
Phase 5（收尾）  → Epic 9
```

---

## 文件清单（预计 15 个文件）

| # | 文件 | 用途 |
|---|---|---|
| 1 | `main.py` | FastAPI 入口 |
| 2 | `config.py` | 配置常量 |
| 3 | `schemas.py` | Pydantic 模型 |
| 4 | `routers/synthesize.py` | 合成路由 |
| 5 | `routers/health.py` | 健康检查路由 |
| 6 | `services/mimo_client.py` | MiMo API 客户端 |
| 7 | `services/audio_utils.py` | 音频工具 |
| 8 | `static/index.html` | 页面 HTML |
| 9 | `static/css/style.css` | 样式 |
| 10 | `static/js/app.js` | 主入口 |
| 11 | `static/js/api.js` | API 封装 |
| 12 | `static/js/audio.js` | 音频播放器 |
| 13 | `static/js/ui.js` | UI 交互 |
| 14 | `requirements.txt` | Python 依赖 |
| 15 | `Dockerfile` + `docker-compose.yml` | 部署 |
