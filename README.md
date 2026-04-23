# MiMo-V2.5-TTS Web UI

基于小米 MiMo-V2.5-TTS 系列 API 的语音合成 Web 应用。通过直观的 Web 界面，支持预置音色合成、音色设计、音色复刻等全部 MiMo TTS 功能。

---

## ✨ 功能特性

### 语音合成（三个模型全覆盖）

| 功能 | 模型 | 说明 |
|------|------|------|
| 🎤 预置音色合成 | `mimo-v2.5-tts` | 8 种精品音色，支持自然语言风格控制、音频标签、导演模式、唱歌模式 |
| 🎨 音色设计 | `mimo-v2.5-tts-voicedesign` | 用文字描述音色，AI 即时生成，无需音频样本 |
| 🔄 音色复刻 | `mimo-v2.5-tts-voiceclone` | 上传音频样本（mp3/wav），精准复刻任意音色 |

### 风格控制

- **自然语言控制**：用一句话描述想要的语音风格（仅限预置音色模型）
- **音频标签控制**：通过 `(风格)` 前缀 + `[音频标签]` 细粒度控制语气、情绪、节奏
- **导演模式**：从角色、场景、指导三个维度精细刻画，适合影视级配音
- **唱歌模式**：添加 `(唱歌)` 标签即可合成歌唱音频
- **方言支持**：东北话、四川话、河南话、粤语
- **角色扮演**：孙悟空、林黛玉等预设角色

### 预置音色列表

| 音色名 | Voice ID | 语言 | 性别 |
|--------|----------|------|------|
| MiMo-默认 | `mimo_default` | 中文（冰糖）/ 英文（Mia） | — |
| 冰糖 | `冰糖` | 中文 | 女性 |
| 茉莉 | `茉莉` | 中文 | 女性 |
| 苏打 | `苏打` | 中文 | 男性 |
| 白桦 | `白桦` | 中文 | 男性 |
| Mia | `Mia` | 英文 | 女性 |
| Chloe | `Chloe` | 英文 | 女性 |
| Milo | `Milo` | 英文 | 男性 |
| Dean | `Dean` | 英文 | 男性 |

### 其他功能

- **批量合成**：多行文本逐段合成，进度追踪，打包下载
- **合成历史**：IndexedDB 存储最近 50 条记录，支持回放、下载、复用参数
- **参数摘要**：每次合成后显示完整参数（模型、音色、标签、字数、耗时），一键复制 JSON / 重新合成
- **音色试听**：每个音色卡片有 ▶ 按钮，无需消耗 API 额度即可试听
- **流式输出**：WebSocket 实时推送 PCM 数据，边收边播
- **波形可视化**：Web Audio API + Canvas 波形绘制，播放进度高亮
- **暗色主题**：深色系设计，连贯动画，响应式适配桌面 / 平板 / 手机
- **API Key 安全**：仅存浏览器 localStorage，不经过服务端持久化

---

## 📁 项目结构

```
mimo-tts-web/
├── main.py                          # FastAPI 入口，路由注册、CORS、静态文件
├── config.py                        # 配置常量（端口、模型 ID、音色列表、标签等）
├── schemas.py                       # Pydantic 请求/响应模型
├── requirements.txt                 # Python 依赖
├── Dockerfile                       # Docker 镜像定义
├── docker-compose.yml               # Docker Compose 部署配置
├── .github/
│   └── workflows/
│       └── docker.yml               # GitHub Actions CI/CD 流水线
├── routers/
│   ├── __init__.py
│   ├── health.py                    # 健康检查、连接测试、音色/标签列表 API
│   └── synthesize.py                # 合成路由（单条 + 批量 + WebSocket 流式）
├── services/
│   ├── __init__.py
│   ├── mimo_client.py               # MiMo API 客户端封装（非流式 + 流式）
│   └── audio_utils.py               # PCM→WAV 转换、音频时长计算
└── static/
    ├── index.html                   # 页面结构（三个功能 Tab + 历史面板）
    ├── css/
    │   └── style.css                # 暗色主题、动画、响应式样式
    ├── js/
    │   ├── app.js                   # 主入口，所有交互逻辑
    │   ├── api.js                   # 后端 API + WebSocket 调用封装
    │   ├── audio.js                 # AudioPlayer + WaveformRenderer
    │   ├── ui.js                    # Toast 通知、标签渲染、参数摘要组件
    │   └── utils.js                 # 工具函数（格式化、Base64、剪贴板）
    └── assets/
        └── previews/                # 9 个音色的试听 WAV 文件
```

---

## 🚀 部署指南

### 方式一：直接运行（开发调试）

适用于本地开发、功能调试。

**环境要求：** Python 3.10+

```bash
# 安装依赖
cd mimo-tts-web
pip install -r requirements.txt

# 启动服务
python main.py
```

浏览器打开 **http://localhost:26645**

---

### 方式二：Docker 一键部署（推荐）

**无需本地构建，直接拉取 GitHub Actions 自动构建的镜像。**

#### 环境要求

- Docker

#### 快速启动（推荐）

```bash
# 一条命令搞定：拉取镜像 + 启动服务
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

启动后会输出容器 ID，访问 **http://你的服务器IP:26645** 即可使用。

#### 使用 docker-compose（可选）

如果习惯用 docker-compose，将以下内容保存为 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  mimo-tts-web:
    image: ghcr.io/bmbxwbh/mimo-tts-web:latest
    ports:
      - "26645:26645"
    restart: unless-stopped
```

然后执行：

```bash
docker compose up -d
```

> 如果提示 `unauthorized`，说明镜像包尚未设为公开。
> 前往 GitHub → Packages → mimo-tts-web → Package Settings → Change visibility → Public，
> 或手动登录：`echo "YOUR_TOKEN" | docker login ghcr.io -u bmbxwbh --password-stdin`

#### 日常更新

```bash
# docker run 方式
docker pull ghcr.io/bmbxwbh/mimo-tts-web:latest
docker rm -f mimo-tts-web
docker run -d --name mimo-tts-web -p 26645:26645 --restart unless-stopped ghcr.io/bmbxwbh/mimo-tts-web:latest

# docker-compose 方式
docker compose pull && docker compose up -d
```

#### 常用命令

```bash
# 查看运行日志
docker logs -f mimo-tts-web

# 停止服务
docker stop mimo-tts-web

# 重启服务
docker restart mimo-tts-web

# 查看容器状态
docker ps | grep mimo-tts-web
```

---

### 方式三：Nginx 反向代理 + HTTPS（公网部署）

适用于需要域名访问、HTTPS 加密的生产环境。

#### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

#### 2. 启动 MiMo TTS 服务

```bash
cd mimo-tts-web
docker compose up -d
```

#### 3. 配置 Nginx

创建 `/etc/nginx/sites-available/mimo-tts`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 音色复刻需要上传音频文件
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:26645;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（流式合成需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置（语音合成可能需要较长时间）
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/mimo-tts /etc/nginx/sites-enabled/
sudo nginx -t                  # 测试配置是否正确
sudo systemctl reload nginx    # 重载配置
```

#### 4. 配置 HTTPS（Let's Encrypt 免费证书）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动获取证书并配置 HTTPS
sudo certbot --nginx -d your-domain.com

# 测试自动续期
sudo certbot renew --dry-run
```

完成后访问 **https://your-domain.com**

#### 5. 防火墙放行（如需）

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 🔄 CI/CD 流水线

项目配置了 GitHub Actions，实现全自动构建和发布：

```
代码推送 main 分支
       ↓
GitHub Actions 自动触发
       ↓
构建 Docker 镜像（amd64 + arm64 双架构）
       ↓
推送至 GitHub Container Registry (GHCR)
       ↓
自动创建 Release（含更新日志 + 镜像信息）
       ↓
服务器 docker compose pull → 部署完成
```

### 镜像标签

| 标签 | 触发条件 | 示例 |
|------|----------|------|
| `latest` | 推送到 main 分支 | `ghcr.io/bmbxwbh/mimo-tts-web:latest` |
| `v1.0.0` | 推送 v1.0.0 tag | `ghcr.io/bmbxwbh/mimo-tts-web:1.0.0` |
| `v1.0` | 推送 v1.0.x tag | `ghcr.io/bmbxwbh/mimo-tts-web:1.0` |
| `sha-abc1234` | 每次提交 | `ghcr.io/bmbxwbh/mimo-tts-web:sha-abc1234` |

### 发版流程

```bash
# 修改代码后推送到 main
git add -A
git commit -m "feat: 新功能"
git push origin main

# Actions 自动：构建镜像 → 推送 GHCR → 创建 Release
# 服务器自动/手动：docker compose pull && docker compose up -d
```

### 手动打 tag 发版

```bash
git tag v1.0.0
git push origin v1.0.0
# Actions 自动构建并创建 GitHub Release
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `26645` | 服务监听端口 |
| `WORKERS` | `1` | uvicorn worker 数（建议保持 1，WebSocket 不支持多 worker） |

在 `docker-compose.yml` 中修改：

```yaml
environment:
  - PORT=26645
  - WORKERS=1
```

---

## 📖 使用指南

### 基本流程

1. **获取 API Key**：前往 [platform.xiaomimimo.com](https://platform.xiaomimimo.com) 注册并获取 API Key
2. **填入 Key**：在页面左侧边栏的设置区输入 API Key
3. **测试连接**：点击「测试连接」按钮，验证 Key 有效
4. **选择功能**：在左侧导航选择预置音色 / 音色设计 / 音色复刻
5. **配置参数**：选择音色、设置风格、输入合成文本
6. **开始合成**：点击「开始合成」按钮
7. **播放下载**：合成完成后可在线播放、查看波形、下载 WAV 文件

### 预置音色合成

1. 在音色选择区点击选择一个音色（默认为「冰糖」）
2. （可选）展开风格控制区：
   - **自然语言**：用一句话描述想要的风格，如"用温柔的语调，语速稍慢"
   - **音频标签**：点击标签 chips 选择风格，如 `(温柔)` `(磁性)` `(东北话)`
   - **导演模式**：填写角色、场景、指导三个维度的描述
   - **唱歌模式**：开启后在文本开头自动添加 `(唱歌)` 标签
3. 在合成文本框输入要合成的文字
4. 点击「开始合成」

### 音色设计

1. 在音色描述框输入想要的音色特征，如 "Give me a young male tone"
2. 可点击预设模板快速填充
3. （可选）添加音频标签控制风格
4. 输入合成文本
5. 点击「开始合成」

### 音色复刻

1. 拖拽或点击上传音频样本（支持 mp3 / wav，Base64 后不超过 10MB）
2. 上传成功后可预览波形
3. （可选）添加音频标签控制风格
4. 输入合成文本
5. 点击「开始合成」

### 批量合成

1. 在任意合成面板中，开启「批量模式」开关
2. 文本框变为多行输入模式，每行一段文本
3. 底部显示段数统计
4. 点击「全部合成」，逐段调用 API
5. 进度条显示当前合成进度
6. 全部完成后可逐个播放或下载

### 合成历史

- 点击工作区底部的「历史记录」展开面板
- 每条记录显示：时间、音色、文本摘要
- 支持操作：播放、下载、复用参数（一键填充到当前面板）、删除
- 点击「清空历史」可清除所有记录

---

## 🔌 API 接口

服务启动后访问 **http://localhost:26645/docs** 查看自动生成的 FastAPI Swagger 文档。

### 主要端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/synthesize/preset` | 预置音色合成（非流式） |
| `POST` | `/api/synthesize/preset/batch` | 预置音色批量合成 |
| `POST` | `/api/synthesize/voicedesign` | 音色设计合成（非流式） |
| `POST` | `/api/synthesize/voicedesign/batch` | 音色设计批量合成 |
| `POST` | `/api/synthesize/voiceclone` | 音色复刻合成（非流式） |
| `POST` | `/api/synthesize/voiceclone/batch` | 音色复刻批量合成 |
| `WS`   | `/ws/synthesize` | 流式合成（WebSocket） |
| `GET`  | `/api/test-connection` | 测试 API Key 连接 |
| `GET`  | `/api/voices` | 获取音色列表 |
| `GET`  | `/api/styles` | 获取风格标签列表 |
| `GET`  | `/health` | 健康检查 |

### 请求示例

```bash
curl -X POST http://localhost:26645/api/synthesize/preset \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-mimo-api-key" \
  -d '{
    "voice": "冰糖",
    "text": "你好，欢迎使用 MiMo 语音合成。",
    "style_prompt": "用温柔的语调",
    "audio_tags": null,
    "director": null,
    "singing": false
  }' \
  --output output.wav
```

---

## 🛠️ 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 后端框架 | FastAPI | 异步 Python Web 框架 |
| HTTP 客户端 | httpx | 异步 HTTP 客户端，调用 MiMo API |
| WebSocket | websockets | 流式音频传输 |
| 数据校验 | Pydantic | 请求/响应模型 |
| 前端 | 原生 HTML/CSS/JS | 零外部依赖 |
| 音频播放 | Web Audio API | PCM 流式播放 + 波形可视化 |
| 存储 | IndexedDB | 合成历史本地存储 |
| CI/CD | GitHub Actions | 自动构建 + 发布 Docker 镜像 |
| 部署 | Docker + Docker Compose | 容器化部署 |
| 反向代理 | Nginx（可选） | HTTPS + WebSocket 代理 |

---

## ❓ 常见问题

### Q: 合成失败，提示 "Unauthorized"

检查 API Key 是否正确填写，可以在 [platform.xiaomimimo.com](https://platform.xiaomimimo.com) 的控制台确认 Key 状态。

### Q: 合成失败，提示 "Rate limit exceeded"

API 调用频率超限，请稍后再试。MiMo 平台对每个 API Key 有调用频率限制。

### Q: 音色复刻上传失败

确认音频文件格式为 mp3 或 wav，且 Base64 编码后不超过 10MB。建议音频时长在 10-60 秒之间，效果最佳。

### Q: 流式合成没有声音

当前 MiMo-V2.5-TTS 的流式接口为兼容模式（推理完成后一次性返回），并非真正的低延迟流式。如遇到问题，建议使用非流式模式。

### Q: Docker 容器内无法访问 MiMo API

确保容器有外网访问权限。如果使用代理，需要在 docker-compose.yml 中配置 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量。

### Q: 如何更换端口

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "你的端口:26645"
```

### Q: GitHub Actions 构建失败

1. 确认仓库已启用 GitHub Actions（Actions 页面 → 启用）
2. 检查仓库 Settings → Actions → General → Workflow permissions 是否设为 "Read and write"
3. 查看 Actions 页面的构建日志排查具体错误

### Q: 如何回滚到旧版本

```bash
# 查看可用的镜像标签
# 在 GitHub Packages 页面查看：https://github.com/bmbxwbh/mimo-tts-web/pkgs/container/mimo-tts-web

# 修改 docker-compose.yml 中的镜像标签
image: ghcr.io/bmbxwbh/mimo-tts-web:v1.0.0  # 替换为要回滚的版本

# 重新部署
docker compose pull && docker compose up -d
```

---

## 📄 许可

本项目为开源项目，基于 MiMo-V2.5-TTS API 构建。MiMo API 的使用需遵守 [小米 MiMo 开放平台服务协议](https://platform.xiaomimimo.com/docs/terms/user-agreement)。

---

## 🔗 相关链接

- [MiMo 开放平台](https://platform.xiaomimimo.com)
- [MiMo API 文档](https://platform.xiaomimimo.com/docs/welcome)
- [MiMo-V2.5-TTS 语音合成文档](https://platform.xiaomimimo.com/docs/usage-guide/speech-synthesis-v2.5)
- [MiMo 控制台](https://platform.xiaomimimo.com/console/balance)
- [GitHub 仓库](https://github.com/bmbxwbh/mimo-tts-web)
- [Docker 镜像](https://github.com/bmbxwbh/mimo-tts-web/pkgs/container/mimo-tts-web)
