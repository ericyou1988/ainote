# AInote

AI 驱动的个人笔记应用，融合提示词管理与英语学习。

## 架构

```
浏览器 → Nginx (端口 80) → 前端 (React SPA)
                        → /api/* → 后端 (FastAPI, 端口 8000)
                                        → SQLite (./backend/data/ainote.db)
                                        → 外部 AI 服务商 (HTTP API)
```

**技术栈：**
- 前端：React 18、Vite、Tailwind CSS v4、Zustand
- 后端：Python FastAPI、SQLAlchemy 2.0、SQLite、LiteLLM
- 部署：Docker Compose + Nginx 反向代理

## 快速开始

```bash
git clone https://github.com/ericyou1988/ainote.git
cd ainote
docker compose up -d --build
```

浏览器打开 `http://localhost` 即可使用。

## 部署指南（阿里云）

### 前置条件

- Ubuntu 22.04 或更高版本
- 已安装 Docker 和 Docker Compose
- 端口 80 未被占用

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
curl http://localhost/api/health
# 预期返回: {"status":"ok"}
```

### 服务端口

| 服务 | 主机端口 | 说明 |
|------|---------|------|
| 前端 (Nginx) | 80 | Web UI + API 代理 |
| 后端 (FastAPI) | 8000 | 直接 API 访问（也可通过 Nginx 的 `/api/*` 访问） |

### 数据持久化

- SQLite 数据库：`./backend/data/ainote.db`（通过 volume 挂载到宿主机）
- 备份方法：复制 `backend/data/` 目录即可

### SSL / HTTPS

Nginx 默认监听 80 端口。如需 HTTPS：

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
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
curl -X POST http://localhost/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenRouter",
    "api_key": "sk-or-v1-...",
    "base_url": "https://openrouter.ai/api/v1",
    "model": "tencent/hy3-preview:free"
  }'

# 设为当前服务商
curl -X PUT http://localhost/api/providers/{provider_id}/set-current
```

**支持的平台：** 任意 OpenAI 兼容接口（OpenAI、OpenRouter、通义千问等）。

**模型名填写规则：**
- 直连平台（OpenAI、通义千问）：直接填模型名，如 `gpt-4o`
- OpenRouter：填裸模型名即可（如 `tencent/hy3-preview:free`），后端会自动补全 `openrouter/` 前缀
- 推理模型（如腾讯混元 HY3）完全支持，推理内容会正确渲染在分析面板和对话面板中

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
│   │   ├── pages/                  # 首页、编辑器、分析面板、对话、设置
│   │   ├── stores/                 # Zustand 状态管理
│   │   └── api/client.js           # Axios API 客户端
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

## 常见问题

- **端口 80 被占用**：停止系统 Nginx（`sudo systemctl stop nginx`）后再启动 Docker Compose
- **端口 8000 被占用**：停止本地 uvicorn 进程
- **AI 分析返回空内容**：确认模型名与平台匹配。OpenRouter 平台后端会自动补全 `openrouter/` 前缀
- **重启后 API Key 无法解密**：`ENCRYPTION_KEY` 必须保持一致。使用默认值或固定环境变量，不要在每次重启时更换

## 许可证

个人项目，非商业用途。
