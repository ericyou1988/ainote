---
name: AInote Technical Design
version: v1.0
status: draft
created: "2026-04-29"
---

# AInote 技术设计文档

## 1. 技术选型

### 1.1 总体架构

```
浏览器 (H5)
    ↓ HTTPS
Nginx 反向代理 (阿里云 2C2G)
    ↓
FastAPI 后端 (Python)
    ├── SQLite 数据库 (本地文件)
    └── 外部 AI 服务商 (HTTP API)
```

### 1.2 技术栈

| 层次 | 技术 | 理由 |
|------|------|------|
| 前端框架 | React 18 + Vite | 成熟生态，组件化开发，Vite 开发体验好 |
| UI 样式 | 手写 CSS + Tailwind CSS | 遵循 DESIGN.md 设计系统，不需要重量级组件库 |
| 状态管理 | Zustand | 轻量，API 简单，适合中小型项目 |
| Markdown 渲染 | react-markdown | 支持笔记内容展示 |
| Markdown 编辑器 | 手写工具栏 + textarea | PRD 要求基础 Markdown 工具栏（加粗/斜体/标题/列表/链接/代码块） |
| 后端框架 | Python FastAPI | 异步支持好，OpenAPI 自动生成，与 AI 生态天然契合 |
| 数据库 | SQLite + 预留 PostgreSQL | 当前单用户 SQLite 足够，数据模型设计时预留迁移能力 |
| ORM | SQLAlchemy 2.0 | 成熟稳定，支持 SQLite/PostgreSQL 双后端 |
| AI 集成 | LiteLLM | 统一 OpenAI 兼容接口，自动适配通义千问/OpenAI 等不同服务商 |
| 部署 | Docker Compose + Nginx | 阿里云 2C2G，单容器即可满足 |

### 1.3 为什么选 Python 后端

- 用户是产品经理，无编码经验，Python 是最易读的后端语言
- AI 生态中 Python 是一等公民，调试 AI 调用更直接
- FastAPI 性能好，异步支持天然适合等待 AI 响应

## 2. 数据模型

### 2.1 笔记 (notes)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 全局唯一 ID |
| title | VARCHAR(200) | NOT NULL | 笔记标题 |
| content | TEXT | NOT NULL | Markdown 内容 |
| language_tags | JSON | DEFAULT '[]' | 语言标签：["中文","英文","提示词"] |
| status | ENUM | DEFAULT 'unanalyzed' | 状态：unanalyzed / analyzed / discussed |
| analysis_result | JSON | NULL | AI 分析结果（结构化存储，前端按类型渲染） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |

### 2.2 对话 (conversations)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 对话 ID |
| note_id | UUID | FK → notes.id | 绑定笔记 |
| messages | JSON | NOT NULL | 对话消息数组：[{role, content, timestamp}] |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 最后消息时间 |

### 2.3 AI 服务商 (ai_providers)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 服务商 ID |
| name | VARCHAR(100) | NOT NULL | 显示名称 |
| api_key | VARCHAR(500) | NOT NULL | 加密存储 |
| base_url | VARCHAR(500) | NOT NULL | 接口地址 |
| model | VARCHAR(100) | NOT NULL | 模型名称 |
| is_active | BOOLEAN | DEFAULT true | 启用/禁用 |
| is_current | BOOLEAN | DEFAULT false | 当前使用（全局唯一） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |

### 2.4 ER 关系图

```
ai_providers (多)        conversations (多)
    ↓                        ↓
  ┌─┴──────────────┐    ┌───┴────────┐
  │ ai_providers   │    │conversations│
  │ - is_current   │    │ - note_id  │──┐
  └────────────────┘    └────────────┘  │
                                        │
                                        ▼
                                  ┌─────────────┐
                                  │   notes     │
                                  │ - id        │
                                  │ - title     │
                                  │ - content   │
                                  │ - status    │
                                  └─────────────┘
```

## 3. API 设计

### 3.1 笔记管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notes` | 获取笔记列表（支持搜索、筛选、排序、分页） |
| GET | `/api/notes/{id}` | 获取单条笔记详情 |
| POST | `/api/notes` | 新建笔记 |
| PUT | `/api/notes/{id}` | 更新笔记 |
| DELETE | `/api/notes/{id}` | 删除笔记 |

**查询参数** (GET /api/notes):
- `q`: 搜索关键词（标题和内容模糊匹配）
- `tags`: 标签筛选，逗号分隔
- `sort`: 排序方式 (`updated_at` / `created_at`)
- `limit`: 每页条数（默认 20）
- `offset`: 偏移量（用于加载更多）

### 3.2 AI 分析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/notes/{id}/analyze` | 触发 AI 分析（流式返回） |

**请求体**: 无需额外参数，读取笔记 content

**响应**: Server-Sent Events (SSE) 流式输出，分析完成后更新笔记的 `analysis_result` 和 `status`

### 3.3 AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notes/{id}/chat` | 获取笔记的对话历史 |
| POST | `/api/notes/{id}/chat` | 发送消息，流式返回 AI 回复 |

### 3.4 AI 服务商管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers` | 获取所有服务商列表 |
| POST | `/api/providers` | 添加服务商 |
| PUT | `/api/providers/{id}` | 编辑服务商 |
| DELETE | `/api/providers/{id}` | 删除服务商 |
| PUT | `/api/providers/{id}/toggle` | 启用/禁用 |
| PUT | `/api/providers/{id}/set-current` | 设为当前使用 |
| POST | `/api/providers/{id}/test` | 测试连接 |
| POST | `/api/providers/test-all` | 测试所有连接 |

### 3.5 笔记导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notes/{id}/export?format=md` | 导出笔记（md/txt） |

## 4. 关键设计决策

### 4.1 AI 分析流式输出

AI 分析需要 3-10 秒，使用 SSE (Server-Sent Events) 流式返回分析结果。前端边接收边渲染，避免长时间等待。

```
前端 POST /api/notes/{id}/analyze
    ↓
后端判断内容类型 → 选择 AI 专家角色
    ↓
调用 LiteLLM → 流式接收 AI 响应
    ↓
逐 chunk 通过 SSE 推送给前端
    ↓
分析完成 → 保存 analysis_result 到数据库
    ↓
更新笔记 status = analyzed
```

### 4.2 对话持久化

每条笔记的对话独立存储。首次 AI 分析完成后，自动为该笔记创建对话记录，分析结果作为首条消息存入。后续用户追问追加到 messages 数组。

### 4.3 API Key 安全

- SQLite 中 API Key 使用 Fernet 对称加密存储
- 加密密钥通过环境变量注入，不写入代码或数据库
- 前端只接收脱敏后的 Key（`sk-***abc` 格式）

### 4.4 语言标签自动判断

后端保存笔记时，计算内容中中文字符和英文字符的比例：
- 中文字符 > 50% → 添加"中文"标签
- 英文字符 > 50% → 添加"英文"标签
- 两者都 > 20% 且接近 → 同时添加两个标签
- 包含指令性关键词（"请帮我"/"写一个"/"作为"）→ 添加"提示词"标签

### 4.5 笔记状态自动流转

- 新建/编辑 → `unanalyzed`（未分析）
- 首次 AI 分析完成 → `analyzed`（已分析）
- 该笔记有用户追问消息 → `discussed`（有追问）

### 4.6 SQLite 到 PostgreSQL 的迁移路径

当前使用 SQLite 是因为单用户场景不需要并发。数据模型设计上：
- 不用 SQLite 特有的 JSON 函数（用 SQLAlchemy JSON 类型，自动适配 PostgreSQL）
- 不用 SQLite 特有的日期函数
- 迁移时只需更换数据库连接字符串，运行 `alembic upgrade`

## 5. 项目结构

```
ainote/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/         # 可复用 UI 组件
│   │   │   ├── NoteCard.jsx
│   │   │   ├── TagPill.jsx
│   │   │   ├── ProviderCard.jsx
│   │   │   └── MarkdownEditor.jsx
│   │   ├── pages/              # 页面组件
│   │   │   ├── HomePage.jsx
│   │   │   ├── EditorPage.jsx
│   │   │   ├── AnalysisPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── stores/             # Zustand 状态管理
│   │   │   ├── notesStore.js
│   │   │   └── settingsStore.js
│   │   ├── api/                # API 请求封装
│   │   │   └── client.js
│   │   ├── styles/             # 全局样式
│   │   │   └── design.css      # 基于 DESIGN.md 的设计系统
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 入口
│   │   ├── models/             # SQLAlchemy 数据模型
│   │   │   ├── note.py
│   │   │   ├── conversation.py
│   │   │   └── provider.py
│   │   ├── schemas/            # Pydantic 请求/响应模型
│   │   ├── routers/            # API 路由
│   │   │   ├── notes.py
│   │   │   ├── analysis.py
│   │   │   ├── chat.py
│   │   │   └── providers.py
│   │   ├── services/           # 业务逻辑
│   │   │   ├── ai_service.py   # AI 分析 + 对话
│   │   │   └── provider_service.py  # 服务商管理
│   │   ├── config.py           # 配置管理
│   │   └── database.py         # 数据库连接
│   ├── alembic/                # 数据库迁移
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## 6. 部署方案

### 6.1 部署流程

```
本地开发 → 本地测试确认 → Push 到 GitHub → 阿里云 Agent 拉取并部署
```

1. **本地开发**：前端 `npm run dev`，后端 `uvicorn`，本地浏览器确认
2. **推送 GitHub**：`git push` 到远程仓库
3. **阿里云部署**：服务器上 AI Agent 助手从 GitHub 拉取最新代码，执行部署脚本

### 6.2 阿里云 2C2G Ubuntu

```
部署脚本大致流程:
  git pull origin main
  docker-compose build
  docker-compose up -d
```

后端 FastAPI (Gunicorn + Uvicorn workers × 2)
前端 Nginx 静态文件服务（与后端合并部署）
数据库 SQLite 文件持久化到宿主机

### 6.2 Nginx 反向代理

- 静态文件 → 前端 build 产物
- `/api/*` → FastAPI 后端
- SSL 证书 → Let's Encrypt 自动续期

### 6.3 资源预估

| 资源 | 预估 |
|------|------|
| 内存 | 2G 足够（Python + Nginx 约 400MB） |
| CPU | 2C 足够（AI 计算在外，本地只做 API 转发） |
| 磁盘 | SQLite + 静态文件，1G 以内 |

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| AI 服务商响应慢 | 用户等待 30s+ | SSE 流式 + 超时提示 + 重试 |
| 单 SQLite 文件损坏 | 数据丢失 | 每日自动备份到独立文件 |
| API Key 泄露 | 安全问题 | 加密存储 + 环境变量 + 前端脱敏 |
| 未来多用户并发 | 性能瓶颈 | 预留 PostgreSQL 迁移路径 |
