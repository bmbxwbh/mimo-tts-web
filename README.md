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
- **设置页面**：独立的设置面板，管理 API Key、默认参数、连接测试
- **API Key 安全**：仅存浏览器 localStorage，不经过服务端持久化

---

## 📁 项目结构

```
mimo-tts-web/
├── main.py                          # FastAPI 入口
├── config.py                        # 配置常量
├── schemas.py                       # Pydantic 请求/响应模型
├── requirements.txt                 # Python 依赖
├── Dockerfile                       # Docker 镜像定义
├── docker-compose.yml               # Docker Compose 配置
├── .github/workflows/docker.yml     # CI/CD 流水线
├── routers/
│   ├── health.py                    # 健康检查、连接测试
│   └── synthesize.py                # 合成路由（单条 + 批量 + WebSocket）
├── services/
│   ├── mimo_client.py               # MiMo API 客户端封装
│   └── audio_utils.py               # PCM→WAV 转换
└── static/
    ├── index.html                   # 页面结构
    ├── css/style.css                # 样式
    └── js/
        ├── app.js                   # 主入口
        ├── api.js                   # API 封装
        ├── audio.js                 # 音频播放器
        ├── ui.js                    # UI 组件
        └── utils.js                 # 工具函数
```

---

## 🚀 部署指南

### 方式一：直接运行（开发调试）

适用于本地开发、功能调试。

**环境要求：** Python 3.10+

```bash
# 克隆仓库
git clone https://github.com/bmbxwbh/mimo-tts-web.git
cd mimo-tts-web

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

浏览器打开 **http://localhost:26645**

---

### 方式二：Docker 部署（推荐）

无需安装 Python，无需克隆代码，一条命令即可运行。镜像由 GitHub Actions 自动构建，支持 `amd64` 和 `arm64` 两种架构。

---

#### 📋 前置要求

- 一台 Linux 服务器（Ubuntu / Debian / CentOS 均可）
- 已安装 Docker（见下方安装说明）

**安装 Docker（如未安装）：**

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# CentOS
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable docker
sudo systemctl start docker

# 验证安装
docker --version
# 输出类似：Docker version 24.0.x
```

---

#### 🚀 首次部署

**一条命令，拉取镜像并启动：**

```bash
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

**参数说明：**

| 参数 | 作用 |
|------|------|
| `-d` | 后台运行 |
| `--name mimo-tts-web` | 容器命名为 mimo-tts-web |
| `-p 26645:26645` | 将服务器的 26645 端口映射到容器的 26645 端口 |
| `--restart unless-stopped` | 服务器重启后容器自动启动 |
| `ghcr.io/bmbxwbh/mimo-tts-web:latest` | 使用的镜像（latest = 最新版） |

**验证是否启动成功：**

```bash
# 查看容器状态（应显示 Up 状态）
docker ps | grep mimo-tts-web

# 查看启动日志（应显示访问地址）
docker logs mimo-tts-web
```

输出类似：
```
=========================================
  MiMo-V2.5-TTS Web UI 已启动
  访问地址: http://localhost:26645
=========================================
```

打开浏览器访问 **http://你的服务器IP:26645** 即可使用。

---

#### 🔄 更新版本

当项目发布新版本时，按以下步骤更新：

```bash
# 1. 拉取最新镜像
docker pull ghcr.io/bmbxwbh/mimo-tts-web:latest

# 2. 删除旧容器
docker rm -f mimo-tts-web

# 3. 用新镜像重新创建容器
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

> **注意：** 更新会重建容器，但不会丢失数据。API Key 存在浏览器 localStorage 中，不受影响。

**也可以用一行命令完成：**

```bash
docker pull ghcr.io/bmbxwbh/mimo-tts-web:latest && docker rm -f mimo-tts-web && docker run -d --name mimo-tts-web -p 26645:26645 --restart unless-stopped ghcr.io/bmbxwbh/mimo-tts-web:latest
```

---

#### 🗑️ 完全卸载

```bash
# 1. 停止并删除容器
docker stop mimo-tts-web
docker rm mimo-tts-web

# 2. 删除镜像（可选，释放磁盘空间）
docker rmi ghcr.io/bmbxwbh/mimo-tts-web:latest

# 3. 清理所有未使用的镜像（可选）
docker image prune -a
```

---

#### 📊 日常管理命令

```bash
# 查看运行状态
docker ps | grep mimo-tts-web

# 查看实时日志
docker logs -f mimo-tts-web

# 查看最近 100 行日志
docker logs --tail 100 mimo-tts-web

# 停止服务
docker stop mimo-tts-web

# 启动已停止的容器
docker start mimo-tts-web

# 重启服务
docker restart mimo-tts-web

# 进入容器内部（调试用）
docker exec -it mimo-tts-web /bin/bash

# 查看容器资源占用
docker stats mimo-tts-web

# 查看容器详细信息
docker inspect mimo-tts-web
```

---

#### 🔧 自定义配置

**修改端口：**

将服务映射到其他端口（如 8080）：

```bash
docker run -d \
  --name mimo-tts-web \
  -p 8080:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

然后访问 **http://你的服务器IP:8080**

**使用特定版本：**

```bash
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:v1.0.3
```

**使用 Docker Compose：**

如果习惯用 docker-compose，创建 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  mimo-tts-web:
    image: ghcr.io/bmbxwbh/mimo-tts-web:latest
    container_name: mimo-tts-web
    ports:
      - "26645:26645"
    environment:
      - PORT=26645
      - WORKERS=1
    restart: unless-stopped
```

然后执行：

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f

# 更新
docker compose pull && docker compose up -d

# 停止
docker compose down

# 重启
docker compose restart
```

---

#### ❓ Docker 常见问题

**Q: 提示 `unauthorized` 无法拉取镜像**

镜像包可能尚未设为公开。前往 GitHub → Packages → mimo-tts-web → Package Settings → Change visibility → Public。或手动登录：

```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u bmbxwbh --password-stdin
```

**Q: 端口被占用**

```bash
# 查看谁占用了端口
lsof -i :26645
# 或
ss -tlnp | grep 26645

# 换一个端口
docker run -d --name mimo-tts-web -p 8080:26645 --restart unless-stopped ghcr.io/bmbxwbh/mimo-tts-web:latest
```

**Q: 容器启动后立即退出**

```bash
# 查看退出原因
docker logs mimo-tts-web

# 常见原因：端口冲突、镜像损坏
# 解决：换端口 或 重新拉取镜像
docker pull ghcr.io/bmbxwbh/mimo-tts-web:latest
```

**Q: 容器无法访问外部网络**

检查服务器防火墙是否放行了出站流量。如果使用代理，需要配置环境变量：

```bash
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  -e HTTP_PROXY=http://proxy:port \
  -e HTTPS_PROXY=http://proxy:port \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

**Q: 如何回滚到旧版本**

```bash
# 1. 查看可用版本
# 访问 https://github.com/bmbxwbh/mimo-tts-web/pkgs/container/mimo-tts-web

# 2. 删除当前版本，运行旧版本
docker rm -f mimo-tts-web
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:v1.0.0
```

**Q: 如何设置开机自启**

`--restart unless-stopped` 参数已经实现了开机自启。如果 Docker 服务本身未设置开机自启：

```bash
sudo systemctl enable docker
```

---

### 方式三：Nginx 反向代理 + HTTPS（公网部署）

适用于需要域名访问、HTTPS 加密的生产环境。

#### 1. 安装 Nginx

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y nginx

# CentOS / RHEL
sudo yum install -y nginx
```

#### 2. 启动 MiMo TTS 服务

```bash
docker run -d \
  --name mimo-tts-web \
  -p 26645:26645 \
  --restart unless-stopped \
  ghcr.io/bmbxwbh/mimo-tts-web:latest
```

#### 3. 配置 Nginx

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/mimo-tts
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 音色复刻需要上传音频文件，限制上传大小
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

#### 5. 防火墙放行

```bash
# Ubuntu / Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS / RHEL (firewalld)
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
服务器 docker pull → 部署完成
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
# 服务器：docker pull && 重新部署
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `26645` | 服务监听端口 |
| `WORKERS` | `1` | uvicorn worker 数（建议保持 1，WebSocket 不支持多 worker） |

---

## 📖 使用指南

### 基本流程

1. **获取 API Key**：前往 [platform.xiaomimimo.com](https://platform.xiaomimimo.com) 注册并获取 API Key
2. **填入 Key**：点击左侧导航的「设置」，输入 API Key 并保存
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

1. 在音色描述框输入想要的音色特征
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

### 设置页面

- **API Key 配置**：输入、保存、测试连接
- **默认参数**：设置默认音色、默认流式输出
- **关于**：版本信息、API 平台链接

---

## 🔌 API 接口

服务启动后访问 **http://localhost:26645/docs** 查看 Swagger 文档。

### 主要端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/synthesize/preset` | 预置音色合成 |
| `POST` | `/api/synthesize/batch/preset` | 预置音色批量合成 |
| `POST` | `/api/synthesize/voicedesign` | 音色设计合成 |
| `POST` | `/api/synthesize/batch/voicedesign` | 音色设计批量合成 |
| `POST` | `/api/synthesize/voiceclone` | 音色复刻合成 |
| `POST` | `/api/synthesize/batch/voiceclone` | 音色复刻批量合成 |
| `WS`   | `/api/ws/synthesize` | 流式合成（WebSocket） |
| `GET`  | `/api/test-connection` | 测试 API Key |
| `GET`  | `/api/voices` | 获取音色列表 |
| `GET`  | `/api/style-tags` | 获取风格标签 |
| `GET`  | `/api/audio-tags` | 获取音频标签 |
| `GET`  | `/api/health` | 健康检查 |

### 请求示例

```bash
curl -X POST http://localhost:26645/api/synthesize/preset \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-mimo-api-key" \
  -d '{
    "voice": "冰糖",
    "text": "你好，欢迎使用 MiMo 语音合成。",
    "style_prompt": "用温柔的语调"
  }' \
  --output output.wav
```

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 后端 | FastAPI + httpx + websockets + Pydantic |
| 前端 | 原生 HTML/CSS/JS + Web Audio API |
| 存储 | IndexedDB（合成历史） |
| CI/CD | GitHub Actions → GHCR |
| 部署 | Docker |
| 反代 | Nginx（可选） + Let's Encrypt |

---

## 📄 许可

本项目基于 MiMo-V2.5-TTS API 构建。MiMo API 的使用需遵守 [小米 MiMo 开放平台服务协议](https://platform.xiaomimimo.com/docs/terms/user-agreement)。

---

## 🔗 相关链接

- [MiMo 开放平台](https://platform.xiaomimimo.com)
- [MiMo API 文档](https://platform.xiaomimimo.com/docs/welcome)
- [MiMo-V2.5-TTS 语音合成文档](https://platform.xiaomimimo.com/docs/usage-guide/speech-synthesis-v2.5)
- [MiMo 控制台](https://platform.xiaomimimo.com/console/balance)
- [GitHub 仓库](https://github.com/bmbxwbh/mimo-tts-web)
- [Docker 镜像](https://github.com/bmbxwbh/mimo-tts-web/pkgs/container/mimo-tts-web)
