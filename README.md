# AInote

AI-powered personal notes app for prompt management and English learning.

## Architecture

```
Browser → Nginx (port 80) → Frontend (React SPA)
                        → /api/* → Backend (FastAPI, port 8000)
                                        → SQLite (./backend/data/ainote.db)
                                        → External AI providers (HTTP API)
```

**Tech stack:**
- Frontend: React 18, Vite, Tailwind CSS v4, Zustand
- Backend: Python FastAPI, SQLAlchemy 2.0, SQLite, LiteLLM
- Deployment: Docker Compose + Nginx reverse proxy

## Quick Start

```bash
git clone https://github.com/ericyou1988/ainote.git
cd ainote
docker compose up -d --build
```

Then open `http://localhost` in your browser.

## Deployment Guide (Alibaba Cloud)

### Prerequisites

- Ubuntu 22.04 or later
- Docker and Docker Compose installed
- Port 80 available (no other service using it)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/ericyou1988/ainote.git
cd ainote

# 2. (Optional) Generate a custom encryption key for API key storage
# Skip this step to use the default key included in docker-compose.yml
export ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# 3. Start services
docker compose up -d --build

# 4. Verify
curl http://localhost/api/health
# Expected: {"status":"ok"}
```

### Service Ports

| Service | Host Port | Description |
|---------|-----------|-------------|
| Frontend (Nginx) | 80 | Web UI + API proxy |
| Backend (FastAPI) | 8000 | Direct API access (also accessible via Nginx at `/api/*`) |

### Data Persistence

- SQLite database: `./backend/data/ainote.db` (mounted to host via volume)
- To backup: copy the `backend/data/` directory

### SSL / HTTPS

Nginx is configured at port 80. To enable HTTPS with Let's Encrypt:

```bash
# Install certbot
apt install certbot python3-certbot-nginx -y

# Generate certificate (replace with your domain)
certbot --nginx -d your-domain.com
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Application environment |
| `ENCRYPTION_KEY` | auto-generated | Fernet key for encrypting API keys in database |

### AI Provider Setup

After deployment, configure your AI provider via the Settings page in the UI, or via API:

```bash
# Add a provider (example: OpenRouter)
curl -X POST http://localhost/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenRouter",
    "api_key": "sk-or-v1-...",
    "base_url": "https://openrouter.ai/api/v1",
    "model": "tencent/hy3-preview:free"
  }'

# Set as current provider
curl -X PUT http://localhost/api/providers/{provider_id}/set-current
```

**Supported platforms:** Any OpenAI-compatible API (OpenAI, OpenRouter, 通义千问, etc.).

**Model name format:**
- For direct providers (OpenAI, 通义千问): use the raw model name (e.g., `gpt-4o`)
- For OpenRouter: fill in the bare model name (e.g., `tencent/hy3-preview:free`). The backend auto-adds the `openrouter/` prefix when needed.
- Reasoning models (e.g., Tencent HY3) are fully supported — reasoning content renders correctly in the analysis and chat panels.

## Project Structure

```
ainote/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entrypoint
│   │   ├── config.py               # Settings (env vars, DB URL, encryption key)
│   │   ├── database.py             # SQLAlchemy session + engine
│   │   ├── models/                 # Data models (Note, Conversation, AIProvider)
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── routers/                # API endpoints (notes, chat, providers)
│   │   └── services/
│   │       ├── ai_service.py       # AI analysis + chat (streaming SSE)
│   │       └── provider_service.py # Provider CRUD + connection test
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Home, Editor, Analysis, Chat, Settings
│   │   ├── stores/                 # Zustand state (notes, settings)
│   │   └── api/client.js           # Axios API client
│   ├── Dockerfile
│   ├── nginx.conf                  # Nginx config for static files + API proxy
│   └── package.json
├── docker-compose.yml
└── docs/
    ├── PRD.md                      # Product requirements
    └── TECH_DESIGN.md              # Technical design document
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/notes` | List notes (`?q=search&tags=tag1,tag2&sort=updated_at&limit=20&offset=0`) |
| POST | `/api/notes` | Create note |
| GET | `/api/notes/{id}` | Get note detail |
| PUT | `/api/notes/{id}` | Update note |
| DELETE | `/api/notes/{id}` | Delete note |
| GET | `/api/notes/{id}/export?format=md` | Export note (md/txt) |
| POST | `/api/notes/{id}/analyze` | AI analyze (SSE stream) |
| GET | `/api/notes/{id}/chat` | Get chat history |
| POST | `/api/notes/{id}/chat` | Send chat message (SSE stream) |
| GET | `/api/providers` | List providers |
| POST | `/api/providers` | Create provider |
| PUT | `/api/providers/{id}` | Update provider |
| DELETE | `/api/providers/{id}` | Delete provider |
| PUT | `/api/providers/{id}/toggle` | Enable/disable provider |
| PUT | `/api/providers/{id}/set-current` | Set as active provider |
| POST | `/api/providers/{id}/test` | Test connection |
| POST | `/api/providers/test-all` | Test all connections |

## Known Issues & Troubleshooting

- **Port 80 already in use**: Stop any existing Nginx service (`sudo systemctl stop nginx`) before starting Docker Compose.
- **Port 8000 already in use**: Stop any local `uvicorn` process running on that port.
- **AI analysis returns empty content**: Ensure the model name matches your provider. For OpenRouter, the backend auto-adds `openrouter/` prefix if missing.
- **Container restarts lose API keys**: The `ENCRYPTION_KEY` must remain consistent. Use the `docker-compose.yml` default or set it via environment variable and keep it unchanged across deployments.

## License

Personal project — not for commercial use.
