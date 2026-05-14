# AInote

AI 驱动的个人笔记应用，融合提示词管理与英语学习。

## 架构

```
浏览器 → Nginx (端口 8880) → 前端 (React SPA)
                         → /api/* → 后端 (FastAPI, 端口 38000)
                                         → SQLite (./backend/data/ainote.db)
                                         → 外部 AI 服务商 (HTTP API)
```

**技术栈：**
- 前端：React 19、Vite 8、Tailwind CSS v4、Zustand、shadcn/ui
- 后端：Python FastAPI、SQLAlchemy 2.0、SQLite、LiteLLM
- 部署：Docker Compose + Nginx 反向代理

## 快速开始

```bash
git clone https://github.com/ericyou1988/ainote.git
cd ainote
docker compose up -d --build
```

浏览器打开 `http://localhost:8880` 即可使用。

## 部署方式一：Docker Compose（推荐）

### 前置条件

- Ubuntu 22.04 或更高版本
- 已安装 Docker 和 Docker Compose
- 端口 8880 和 38000 未被占用

### 部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ericyou1988/ainote.git
cd ainote

# 2. （可选）生成自定义加密密钥
# 跳过此步骤则使用 docker-compose.yml 中的默认密钥
export ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# 3. 启动服务
docker compose up -d --build

# 4. 验证
curl http://localhost:38000/api/health
# 预期返回: {"status":"ok"}
```

浏览器打开 `http://localhost:8880` 即可使用。

### 服务端口

| 服务 | 主机端口 | 说明 |
|------|---------|------|
| 前端 (Nginx) | 8880 | Web UI + API 代理 |
| 后端 (FastAPI) | 38000 | 直接 API 访问（也可通过 Nginx 的 `/api/*` 访问） |

### 数据持久化

- SQLite 数据库：`./backend/data/ainote.db`（通过 volume 挂载到宿主机）
- 备份方法：复制 `backend/data/` 目录即可

### SSL / HTTPS

Nginx 默认监听 8880 端口。如需 HTTPS：

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

## 部署方式二：直接部署到服务器（不用 Docker）

适合不使用 Docker 的环境，直接在 Ubuntu 服务器上运行。

### 前置条件

- Ubuntu 22.04 或更高版本
- Python 3.11+
- Node.js 20+
- Nginx

```bash
# 安装 Python 3.11
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Nginx
sudo apt install -y nginx
```

### 步骤 1：克隆代码

```bash
git clone https://github.com/ericyou1988/ainote.git
cd ainote
```

### 步骤 2：部署后端

```bash
cd backend

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 创建数据目录
mkdir -p data

# 测试启动（确认无报错后 Ctrl+C 退出）
gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:38000 --timeout 120
```

**设置 systemd 服务（后台常驻运行）：**

```bash
sudo tee /etc/systemd/system/ainote-backend.service << 'EOF'
[Unit]
Description=AInote Backend
After=network.target

[Service]
Type=exec
User=www-data
WorkingDirectory=/opt/ainote/backend
Environment=APP_ENV=production
Environment=ENCRYPTION_KEY=eFqopC2tJsW_JLEMLDs6TZHcneubdDJhAuOKgda75eA=
ExecStart=/opt/ainote/backend/venv/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:38000 --timeout 120
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 如果代码不在 /opt/ainote，先移动或修改 WorkingDirectory 和 ExecStart 路径
# sudo cp -r /home/your-user/ainote /opt/ainote
# sudo chown -R www-data:www-data /opt/ainote/backend/data

sudo systemctl daemon-reload
sudo systemctl enable ainote-backend
sudo systemctl start ainote-backend
```

### 步骤 3：构建前端

```bash
cd ../frontend

npm install
npm run build
```

### 步骤 4：配置 Nginx

```bash
sudo tee /etc/nginx/sites-available/ainote << 'EOF'
server {
    listen 8880;
    server_name _;

    # 前端静态文件
    root /opt/ainote/frontend/dist;
    index index.html;

    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:38000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_cache off;
        # SSE 流式输出支持
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout 120s;
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 复制前端构建产物到 Nginx 目录
sudo mkdir -p /opt/ainote/frontend
sudo cp -r dist /opt/ainote/frontend/

# 启用站点
sudo ln -sf /etc/nginx/sites-available/ainote /etc/nginx/sites-enabled/ainote
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 步骤 5：验证

```bash
curl http://localhost:38000/api/health
# 预期返回: {"status":"ok"}
```

浏览器打开 `http://服务器IP:8880` 即可使用。

### SSL / HTTPS

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### 服务管理命令

```bash
# 查看后端状态
sudo systemctl status ainote-backend

# 重启后端
sudo systemctl restart ainote-backend

# 查看后端日志
sudo journalctl -u ainote-backend -f

# 重启 Nginx
sudo systemctl reload nginx
```

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_ENV` | `production` | 运行环境 |
| `ENCRYPTION_KEY` | 自动生成 | Fernet 密钥，用于加密数据库中的 API Key |

### AI 服务商配置

部署完成后，通过 UI 的「设置」页面添加 AI 服务商，或通过 API：

```bash
# 添加服务商（以 OpenRouter 为例）
curl -X POST http://localhost:38000/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenRouter",
    "api_key": "sk-or-v1-...",
    "base_url": "https://openrouter.ai/api/v1",
    "model": "tencent/hy3-preview:free"
  }'

# 设为当前服务商
curl -X PUT http://localhost:38000/api/providers/{provider_id}/set-current
```

**支持的平台：** 任意 OpenAI 兼容接口（OpenAI、OpenRouter、通义千问等），以及本地 Ollama 服务。

**模型名填写规则：**
- 直连平台（OpenAI、通义千问）：直接填模型名，如 `gpt-4o`
- OpenRouter：填裸模型名即可（如 `tencent/hy3-preview:free`），后端会自动补全 `openrouter/` 前缀
- 推理模型（如腾讯混元 HY3）完全支持，推理内容会正确渲染在分析面板和对话面板中

### 本地 Ollama 配置

如果你想在本地运行 Ollama 作为 AI 服务商：

```bash
# 1. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. 拉取模型（以 qwen:7b 为例）
ollama pull qwen:7b

# 3. 启动 Ollama 服务
ollama serve
```

在 AInote 的「设置」页面添加 AI 服务商：
- **名称**：Ollama
- **API Key**：随意填写（Ollama 不需要 API Key，填 `ollama` 即可）
- **接口地址**：`http://localhost:11434/v1`（使用 OpenAI 兼容端点）
- **模型名称**：`qwen:7b`（不带 `ollama/` 前缀）

> **注意**：使用 `/v1` OpenAI 兼容端点而非 `ollama/` 前缀。LiteLLM 1.58.1 的 `ollama/` 前缀存在路由 bug，会请求错误的端点。

## 项目结构

```
ainote/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── config.py               # 配置管理（环境变量、数据库、加密密钥）
│   │   ├── database.py             # SQLAlchemy 连接
│   │   ├── models/                 # 数据模型（Note、Conversation、AIProvider）
│   │   ├── schemas/                # Pydantic 请求/响应模型
│   │   ├── routers/                # API 路由（笔记、对话、服务商）
│   │   └── services/
│   │       ├── ai_service.py       # AI 分析 + 对话（SSE 流式输出）
│   │       └── provider_service.py # 服务商 CRUD + 连接测试
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/             # 可复用 UI 组件（AnalysisPanel, EditorPanel, Shell 等）
│   │   ├── pages/                  # 页面组件（NotesPage, SettingsPage）
│   │   ├── stores/                 # Zustand 状态管理
│   ├── Dockerfile
│   ├── nginx.conf                  # Nginx 配置（静态文件 + API 代理）
│   └── package.json
├── docker-compose.yml
└── docs/
    ├── PRD.md                      # 产品需求文档
    └── TECH_DESIGN.md              # 技术设计文档
```

## API 接口文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/notes` | 笔记列表（支持搜索、筛选、排序、分页） |
| POST | `/api/notes` | 创建笔记 |
| GET | `/api/notes/{id}` | 获取笔记详情 |
| PUT | `/api/notes/{id}` | 更新笔记 |
| DELETE | `/api/notes/{id}` | 删除笔记 |
| GET | `/api/notes/{id}/export?format=md` | 导出笔记（md/txt） |
| POST | `/api/notes/{id}/analyze` | AI 分析（SSE 流式输出） |
| GET | `/api/notes/{id}/chat` | 获取对话历史 |
| POST | `/api/notes/{id}/chat` | 发送对话消息（SSE 流式输出） |
| GET | `/api/providers` | 服务商列表 |
| POST | `/api/providers` | 添加服务商 |
| PUT | `/api/providers/{id}` | 编辑服务商 |
| DELETE | `/api/providers/{id}` | 删除服务商 |
| PUT | `/api/providers/{id}/toggle` | 启用/禁用 |
| PUT | `/api/providers/{id}/set-current` | 设为当前使用 |
| POST | `/api/providers/{id}/test` | 测试连接 |
| POST | `/api/providers/test-all` | 测试所有连接 |

## 核心功能

### 笔记管理
- Markdown 编辑器，支持标题/内容/标签
- 首页列表：搜索、标签筛选、排序、分页加载
- 笔记状态：未分析 → 已分析 → 有追问
- 语言标签自动识别（中文/英文/提示词）
- 导出为 Markdown 或纯文本

### AI 分析
- 提示词工程师：结构化拆解提示词（角色设定/任务描述/输出格式/优化建议）
- 技术翻译专家：逐词翻译表/语法树/纠错建议/改进版本
- 自动内容识别，选择对应专家
- SSE 流式输出，边接收边渲染

### AI 对话
- 笔记绑定独立对话线程，持久化存储
- 分析结果作为首条消息
- 支持跨天追问

### 服务商管理
- 多服务商配置，自由切换
- API Key 加密存储（Fernet）
- 一键测试连接（实际 completion 调用验证，10s 超时）
- 支持推理模型（reasoning models），推理内容自动渲染

### 加密密钥管理

`ENCRYPTION_KEY` 用于 Fernet 对称加密，加密存储在数据库中的 API Key。

**自动持久化**：首次启动时，如果 `.env` 文件中没有 `ENCRYPTION_KEY`，系统会自动生成一个并追加到 `.env` 文件中。后续启动都会读取这个固定的值。

**systemd 服务中的密钥必须与 .env 文件一致**：
```bash
# 从 .env 文件读取并更新到 systemd 服务
ENCRYPTION_KEY=$(grep ENCRYPTION_KEY /opt/ainote/backend/.env | cut -d= -f2-)
sudo sed -i "s/^Environment=ENCRYPTION_KEY=.*/Environment=ENCRYPTION_KEY=$ENCRYPTION_KEY/" /etc/systemd/system/ainote-backend.service
sudo systemctl daemon-reload && sudo systemctl restart ainote-backend
```

> **警告**：如果每次重启生成不同的 key，之前加密的 API Key 将无法解密（表现为"分析失败"）。

## 常见问题

- **端口 8880 被占用**：停止占用该端口的服务，或修改 docker-compose.yml 和 nginx.conf 中的端口
- **端口 38000 被占用**：停止占用该端口的服务，或修改配置
- **AI 分析返回空内容**：确认模型名与平台匹配。OpenRouter 平台后端会自动补全 `openrouter/` 前缀
- **重启后 API Key 无法解密**：`ENCRYPTION_KEY` 必须保持一致。使用默认值或固定环境变量，不要在每次重启时更换
- **分析失败: InvalidToken**：加密密钥变更导致。运行上面的「加密密钥管理」命令修复
- **Ollama 连接 404**：确保 `base_url` 使用 `http://localhost:11434/v1`（带 `/v1`），模型名不带 `ollama/` 前缀
- **systemd 服务启动失败**：检查 `WorkingDirectory` 路径是否正确，确认 `www-data` 用户有 `data/` 目录的写权限
- **Nginx 配置后 502**：确认后端正在运行 `sudo systemctl status ainote-backend`，检查 Nginx 日志 `sudo tail -f /var/log/nginx/error.log`

## 许可证

个人项目，非商业用途。
