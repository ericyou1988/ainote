---
name: AInote Technical Design
version: v1.0
status: released
created: "2026-04-29"
released: "2026-05-12"
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
| 前端框架 | React 19 + Vite 8 | 成熟生态，组件化开发，Vite 8 性能优异 |
| UI 样式 | Tailwind CSS v4 + shadcn/ui | shadcn/ui 提供高质量 Radix UI 组件（Button, Input, Dialog, Switch, Badge, ScrollArea 等），基于 Tailwind v4 和 class-variance-authority |
| 路由 | react-router-dom (HashRouter) | 嵌套路由：Shell 布局 + 子路由切换 |
| 状态管理 | Zustand | 轻量，API 简单，适合中小型项目 |
| Markdown 渲染 | 无需额外库 | 分析面板和对话面板直接使用纯文本/whitespace-pre-wrap 渲染 AI 输出 |
| Markdown 编辑器 | 手写工具栏 + textarea | PRD 要求基础 Markdown 工具栏（加粗/斜体/标题/列表/链接/代码块） |
| 后端框架 | Python FastAPI | 异步支持好，OpenAPI 自动生成，与 AI 生态天然契合 |
| 数据库 | SQLite + 预留 PostgreSQL | 当前单用户 SQLite 足够，数据模型设计时预留迁移能力 |
| ORM | SQLAlchemy 2.0 | 成熟稳定，支持 SQLite/PostgreSQL 双后端 |
| AI 集成 | LiteLLM | 统一 OpenAI 兼容接口，自动适配通义千问/OpenAI 等不同服务商 |
| 部署 | Docker Compose + Nginx（开发） / systemd + Nginx（生产） | 支持裸金属直接部署，前端构建产物由 Nginx 静态服务 |

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

### 4.1 AI 分析流式输出与自动触发

AI 分析需要 3-10 秒，使用 SSE (Server-Sent Events) 流式返回分析结果。前端进入"AI 分析"面板后自动发起分析请求，边接收边渲染。

#### 4.1.0 前端自动触发逻辑

前端 `AnalysisPanel` 组件进入"AI 分析"子标签页时：
1. 先 `fetchNote(noteId)` 加载笔记详情
2. 检查 `currentNote.analysis_result` 是否存在
3. 如果不存在 → 自动发起 `POST /api/notes/{id}/analyze` 请求
4. SSE 流式接收 AI 响应，边接收边渲染文本到面板
5. 分析完成后，后端已将结果保存到数据库 → 前端再次 `fetchNote` 加载结构化结果
6. 同时加载对话历史 `GET /api/notes/{id}/chat`
7. 根据分析结果类型（prompt_analysis / translation_analysis）渲染对应视图
8. 分析结果下方显示对话区域，用户可直接在底部输入框发起追问

如果分析失败（无服务商、内容太短、网络错误等），面板显示错误信息和"重试"按钮。

```
前端进入 AI 分析子标签
    ↓
fetchNote(noteId) → 检查 analysis_result
    ↓
无结果 → POST /api/notes/{id}/analyze (SSE)
    ↓
逐 chunk 接收 → 渲染流式文本到面板
    ↓
后端完成 → 保存 analysis_result 到数据库
    ↓
前端 fetchNote → 渲染结构化分析视图
    ↓
加载对话历史 GET /api/notes/{id}/chat → 渲染对话区域
```

#### 4.1.1 后端流式输出

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

### 4.1.2 流式响应兼容层

系统支持所有主流大模型，包括推理模型（reasoning models）。不同模型的响应字段不同：
- 标准模型：响应内容在 `delta.content`
- 推理模型（如腾讯混元 HY3）：推理过程在 `delta.reasoning` 或 `delta.reasoning_content`

`ai_service.py` 中的 `_extract_delta()` 函数统一提取所有响应字段：

```python
def _extract_delta(chunk) -> str | None:
    delta = chunk.choices[0].delta
    text = getattr(delta, "content", None) or ""
    reasoning = getattr(delta, "reasoning", None) or getattr(delta, "reasoning_content", None) or ""
    result = text + reasoning
    return result if result else None
```

`analyze_note()` 和 `chat_message()` 的流式循环均调用此函数，确保所有模型（标准/推理）的响应都能正确渲染。

### 4.1.3 聚合路由平台自动前缀补全

对于 OpenRouter 等聚合平台，LiteLLM 需要模型名带 provider 前缀（如 `openrouter/tencent/hy3-preview:free`）。用户在服务商配置中只需填写裸模型名（如 `tencent/hy3-preview:free`），`provider_service.py` 的 `test_connection()` 会自动检测 base_url 是否为 OpenRouter，如果是且模型名无 provider 前缀，则自动补全 `openrouter/` 前缀。

### 4.2 对话持久化

每条笔记的对话独立存储。用户首次发起追问时，自动为该笔记创建对话记录。用户追问和 AI 回复追加到 messages 数组。分析结果在分析面板中独立展示，不作为对话消息。

### 4.3 API Key 安全

- SQLite 中 API Key 使用 Fernet 对称加密存储
- 加密密钥通过环境变量注入，不写入代码或数据库
- 前端只接收脱敏后的 Key（`sk-***abc` 格式）

### 4.3.1 测试连接实现

`provider_service.py` 的 `test_connection()` 使用实际 completion API 调用验证连通性（10s 超时），而非仅检查 `/models` 端点。这确保配置的有效性不仅限于 API 可达，还包括模型可调用。

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

### 5.1 前端结构

```
frontend/
├── src/
│   ├── components/         # 可复用 UI 组件
│   │   ├── ui/             # shadcn/ui 组件（Button, Input, Dialog, Switch, Badge, ScrollArea, Separator, Tabs）
│   │   ├── Shell.jsx       # 顶部导航栏 + Outlet 嵌套路由
│   │   ├── EditorPanel.jsx # 笔记编辑器面板（嵌入右侧内容区）
│   │   ├── AnalysisPanel.jsx # AI 分析面板（自动触发分析 + SSE 流式渲染 + 内嵌追问对话）
│   │   └── ChatPanel.jsx   # （已删除，对话功能合并到 AnalysisPanel）
│   ├── pages/              # 页面组件
│   │   ├── NotesPage.jsx   # 笔记列表页（左侧边栏 + 右侧面板 + 2 个子标签路由：内容/AI分析）
│   │   └── SettingsPage.jsx # AI 服务商设置页（增删改查 + 测试连接）
│   ├── stores/             # Zustand 状态管理
│   │   ├── notesStore.js
│   │   └── settingsStore.js
│   ├── api/                # API 请求封装
│   │   └── client.js
│   ├── lib/                # 工具函数
│   │   └── utils.js        # cn() 类名合并工具
│   ├── App.jsx             # 路由配置（HashRouter + Shell 嵌套路由）
│   └── main.jsx
├── components.json         # shadcn/ui 配置
├── index.html
├── package.json
└── vite.config.js          # Vite + @tailwindcss/vite 插件
```

**架构说明**：
- `App.jsx` 使用 `Shell` 作为布局组件，通过 `Outlet` 渲染子路由
- `NotesPage` 同时作为笔记列表页和笔记详情页，根据 URL 参数 `:id` 和子路径决定渲染内容
- 两个子标签页（内容/AI 分析）作为独立组件嵌入右侧面板，通过 URL 路由切换。AI 分析面板内嵌追问对话功能
- Tailwind v4 使用 `@theme inline` 原生 CSS 变量定义，不需要 `tailwind.config.js`

### 5.2 后端结构

```
backend/
├── app/
│   ├── main.py             # FastAPI 入口
│   ├── models/             # SQLAlchemy 数据模型
│   │   ├── note.py
│   │   ├── conversation.py
│   │   └── provider.py
│   ├── schemas/            # Pydantic 请求/响应模型
│   ├── routers/            # API 路由
│   │   ├── notes.py
│   │   ├── chat.py         # AI 分析 + 对话（合并路由）
│   │   └── providers.py
│   ├── services/           # 业务逻辑
│   │   ├── ai_service.py   # AI 分析 + 对话 + 内容识别
│   │   └── provider_service.py  # 服务商管理 + 连接测试
│   ├── config.py           # 配置管理
│   └── database.py         # 数据库连接
├── requirements.txt
└── Dockerfile
```

## 6. V1.0 发布记录（2026-05-12）

**发布状态**：已上线

### 6.1 前端交付
- React 19 + Vite 8 + Tailwind v4 + shadcn/ui 组件体系
- Zustand 状态管理（notesStore + settingsStore）
- HashRouter 嵌套路由（Shell 布局 → NotesPage → 子标签）
- SSE 流式渲染（分析面板 + 内嵌追问对话）
- 响应式布局（移动端侧边栏全屏 + 返回按钮 + 子标签横向滚动）
- textarea Markdown 编辑器 + 基础工具栏

### 6.2 后端交付
- FastAPI + SQLite + SQLAlchemy 2.0
- LiteLLM 统一接口，兼容 OpenAI/通义千问/推理模型
- SSE 流式输出（`_extract_delta()` 兼容层）
- AI 服务商管理（CRUD + 测试连接 + 当前切换）
- 笔记 CRUD + 搜索 + 标签筛选 + 分页
- AI 分析 + 对话（自动内容识别 + 双专家角色）
- Fernet 加密存储 API Key

### 6.3 关键变更历史
| 日期 | 变更 | 说明 |
|------|------|------|
| 04-29 | 项目启动 | 初始 PRD + TECH_DESIGN |
| 05-12 | 合并分析与对话面板 | AnalysisPanel 内嵌追问，删除 ChatPanel，子标签 3→2 |
| 05-12 | 移动端响应式修复 | 侧边栏/面板条件渲染，空状态隐藏 |

---

## 7. 部署方案

### 7.1 部署流程

```
本地开发 → 本地测试确认 → Push 到 GitHub → 阿里云 Agent 拉取并部署
```

1. **本地开发**：前端 `npm run dev`（Vite dev server + API 代理到后端），后端 `uvicorn`，本地浏览器确认
2. **推送 GitHub**：`git push` 到远程仓库
3. **阿里云部署**：服务器上 AI Agent 助手从 GitHub 拉取最新代码，执行部署脚本

### 7.2 Docker Compose 部署（开发/测试）

```
部署脚本大致流程:
  git pull origin main
  docker-compose build
  docker-compose up -d
```

- 前端端口：8880
- 后端端口：38000
- Nginx 反向代理：`/api/*` → 后端:38000，`/` → 前端静态文件

### 7.3 裸金属直接部署（生产）

**后端**：systemd 服务管理 Gunicorn + Uvicorn workers
```
[Unit]
Description=AInote Backend
[Service]
ExecStart=/path/to/venv/bin/gunicorn app.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:38000 --timeout 120
[Install]
WantedBy=multi-user.target
```

**前端**：`npm run build` → 构建产物复制到 `/var/www/ainote/`

**Nginx**：
- `root /var/www/ainote` 服务前端静态文件
- `proxy_pass http://127.0.0.1:38000` 代理 `/api/*` 到后端
- `try_files $uri $uri/ /index.html` 支持 SPA 路由
- SSE 支持：`proxy_read_timeout 120s`，关闭 chunked/buffering
- 前端端口默认 8880

**数据库**：SQLite 文件持久化到项目目录

### 7.4 资源预估

| 资源 | 预估 |
|------|------|
| 内存 | 2G 足够（Python + Nginx 约 400MB） |
| CPU | 2C 足够（AI 计算在外，本地只做 API 转发） |
| 磁盘 | SQLite + 静态文件，1G 以内 |

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| AI 服务商响应慢 | 用户等待 30s+ | SSE 流式 + 超时提示 + 重试 |
| 单 SQLite 文件损坏 | 数据丢失 | 每日自动备份到独立文件 |
| API Key 泄露 | 安全问题 | 加密存储 + 环境变量 + 前端脱敏 |
| 未来多用户并发 | 性能瓶颈 | 预留 PostgreSQL 迁移路径 |
| 新模型响应格式不同 | 推理模型返回空内容 | `_extract_delta()` 兼容层覆盖 content/reasoning/reasoning_content |

## 9. V2.0 设计（讨论中）

### 9.1 目标

将 V1.0 的「单次 AI 分析」升级为 Agent 级别的多步推理分析。Agent 自主决定工具调用顺序，结合外部知识（搜索 + 词典）和跨天记忆，生成高质量的笔记分析结果。

### 9.2 架构方案

**后端：方案2 — Hello-Agents 核心 + 手写编排层**

不直接使用 Hello-Agents 的 AgentRunner，而是提取其核心思想（ReAct 循环、4 层记忆、ToolRegistry），手写轻量的编排层来适配 AInote 的业务逻辑。原因：
- Hello-Agents 是教学框架，直接引入会增加不必要的依赖
- AInote 的分析流程有固定的 5 步结构，不需要完全通用的 Agent
- 手写编排层可以精确控制 SSE 输出格式和 UI 渲染节奏

```
前端 AnalysisPanel
    ↓ (POST /api/notes/{id}/analyze)
agent_service.py (编排层)
    ├── Step 1: 理解意图 → detect_content_type()
    ├── Step 2: 工具调用 → ToolRegistry
    │   ├── search_tool.py (Tavily / DuckDuckGo)
    │   └── dictionary_tool.py (本地词典)
    ├── Step 3: 评估质量 → 对比原提示词 vs 分析结果
    ├── Step 4: 生成改进 → LLM 生成优化版本
    └── Step 5: 提取记忆 → 存入 agent_memories 表
    ↓ (SSE stream, 每步推送 {step, label, status, content})
前端分栏面板 (方案C: 左侧步骤列表 + 右侧内容区)
```

### 9.3 前端方案

**方案C — 分栏展示（Split Panel）**

- 左侧：5 步分析步骤的垂直列表，每步显示状态图标（✅ 完成 / ⏳ 进行中 / ⟳ 当前活跃）
- 右侧：点击左侧步骤切换显示对应分析内容
- 分析完成后，下方展示最终结果卡片 + 内嵌追问对话
- 与 V1.0 的 AnalysisPanel 组件结构兼容，只需追加分栏布局

### 9.4 Agent 推理循环（5 步）

| 步骤 | Label | 说明 |
|------|-------|------|
| 1 | 理解意图 | 检测笔记内容类型，提取关键元素，确定分析方向 |
| 2 | 工具调用 | 根据分析方向自动调用搜索工具或词典工具，获取外部知识 |
| 3 | 评估质量 | 评估原始笔记/提示词的质量，识别缺失信息 |
| 4 | 生成改进 | 结合工具结果和记忆，生成改进版本 |
| 5 | 提取记忆 | 将本次分析的关键发现存入长期记忆（跨天复用） |

### 9.5 SSE 格式

V2.0 的 SSE 输出格式统一为 JSON：

```json
{"step": 1, "label": "理解意图", "status": "active", "content": "..."}
{"step": 1, "label": "理解意图", "status": "done", "content": "完整内容"}
{"step": 2, "label": "工具调用", "status": "active", "content": "..."}
...
{"step": 5, "label": "提取记忆", "status": "done", "content": "..."}
```

前端根据 `step` 和 `status` 更新左侧步骤状态，根据 `content` 更新右侧内容区。

### 9.6 新增数据模型

#### 9.6.1 Agent 记忆 (agent_memories)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 记忆 ID |
| type | ENUM | NOT NULL | episodic（情景记忆）/ semantic（语义记忆） |
| content | TEXT | NOT NULL | 记忆内容 |
| tags | JSON | DEFAULT '[]' | 关联标签，用于检索 |
| note_id | UUID | FK → notes.id, NULL | 关联笔记（情景记忆） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| last_accessed | DATETIME | NULL | 最后访问时间（用于衰减计算） |

- **情景记忆（episodic）**：与特定笔记绑定，记录「上次分析了什么、得到了什么结论」
- **语义记忆（semantic）**：全局知识，如「好的提示词通常包含角色设定 + 任务描述 + 输出格式」

### 9.7 新增后端文件

| 文件 | 说明 |
|------|------|
| `app/services/agent_service.py` | Agent 编排层，5 步推理循环，SSE 输出 |
| `app/tools/search_tool.py` | 联网搜索工具（Tavily 或 DuckDuckGo API） |
| `app/tools/dictionary_tool.py` | 本地词典工具，查询术语翻译和用法 |
| `app/models/memory.py` | Agent 记忆数据模型 |

### 9.8 V2.0 变更历史
| 日期 | 变更 | 说明 |
|------|------|------|
| 05-14 | V2.0 架构设计 | 确定后端方案2 + 前端方案C，Agent 5步推理循环设计 |
| 05-14 | Ollama 本地模型集成 | 通过 OpenAI 兼容端点 /v1 接入 LiteLLM |
