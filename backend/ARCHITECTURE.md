# Unified Backend Architecture

## Overview

The Dicoding GenAI webapp uses a **unified Python backend** powered by FastAPI. This simplifies deployment and reduces latency by eliminating the need for a separate Express.js server.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│                        Port 5173 (Vite)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Unified FastAPI Backend                       │
│                         Port 8000                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      API Endpoints                          ││
│  │  • /api/chats        - Chat CRUD                           ││
│  │  • /api/userchats    - User's chat list                    ││
│  │  • /api/documents    - Document CRUD                       ││
│  │  • /api/upload       - File uploads                        ││
│  │  • /api/kotaemon/*   - Kotaemon RAG proxy                  ││
│  │  • /api/agent/*      - AI Agent endpoints                  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   MongoDB    │  │   Kotaemon   │  │    Pydantic AI       │  │
│  │   (Motor)    │  │  (Gradio)    │  │   Agent System       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌────────────────────────┐       ┌────────────────────────┐
│        MongoDB         │       │       Kotaemon         │
│     Port 27017         │       │      Port 7860         │
└────────────────────────┘       └────────────────────────┘
```

## Why Unified Backend?

### Before (2 Backends)
```
Client → Express.js (3000) → FastAPI Proxy (8000) → Kotaemon (7860)
              ↓
           MongoDB
```
- Extra network hop = latency
- Two codebases to maintain
- Duplicate CORS configs
- Complex deployment

### After (1 Backend)
```
Client → FastAPI (8000) → Kotaemon (7860)
              ↓
           MongoDB
```
- Single hop = faster
- One Python codebase
- Unified configuration
- Simple deployment

## Directory Structure

```
backend/
├── main.py                  # FastAPI app entry point
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
│
├── agents/                  # AI Agent System
│   ├── __init__.py
│   ├── models.py           # Question/Agent Pydantic models
│   ├── skills.py           # Question generation skills
│   ├── question_generator.py # Main agent implementation
│   └── README.md           # Agent documentation
│
├── models/                  # Database Models
│   ├── __init__.py
│   ├── schemas.py          # Pydantic schemas (Chat, Document, etc.)
│   └── database.py         # MongoDB connection (Motor)
│
├── middleware/              # Middleware
│   ├── __init__.py
│   └── auth.py             # Clerk JWT authentication
│
├── routes/                  # API Routes
│   ├── __init__.py
│   ├── chats.py            # Chat CRUD endpoints
│   └── documents.py        # Document/Upload endpoints
│
└── uploads/                 # File uploads directory
```

## API Endpoints

### Chat Endpoints (migrated from Express.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chats` | Create new chat |
| GET | `/api/userchats` | Get user's chat list |
| GET | `/api/chats/:id` | Get chat by ID |
| PUT | `/api/chats/:id` | Update chat (add messages) |
| DELETE | `/api/chats/:id` | Delete chat |

### Document Endpoints (migrated from Express.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file |
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Create document record |
| DELETE | `/api/delete/:userId/:path` | Delete document |

### Kotaemon Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kotaemon/status` | Check Kotaemon connection |
| GET | `/api/kotaemon/api-info` | Get Kotaemon API info |
| POST | `/api/kotaemon/chat` | Send chat message (with RAG) |
| POST | `/api/kotaemon/upload` | Upload to Kotaemon |
| POST | `/api/kotaemon/delete` | Delete from Kotaemon |

### Agent Endpoints (new)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/chat` | AI agent chat |
| POST | `/api/agent/test-answer` | Test question answer |
| POST | `/api/agent/edit-question` | Edit generated question |
| POST | `/api/agent/export` | Export questions |
| GET | `/api/agent/questions/:session_id` | Get session questions |

## Configuration

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required variables:
```env
# MongoDB
MONGO=mongodb://localhost:27017/chatapp

# Kotaemon
KOTAEMON_URL=http://localhost:7860
KOTAEMON_USERNAME=admin
KOTAEMON_PASSWORD=admin

# Clerk (copy from Express backend)
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json

# Google AI (for Pydantic AI)
GOOGLE_API_KEY=your_key_here
```

## Running the Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend Configuration

Update `client/.env`:

```env
# Use unified backend for all API calls
VITE_API_URL=http://localhost:8000
VITE_PROXY_URL=http://localhost:8000
```

## Migration from Express.js

The following Express.js functionality has been migrated:

| Express.js | FastAPI | Status |
|------------|---------|--------|
| `/api/chats` CRUD | `routes/chats.py` | ✅ Migrated |
| `/api/userchats` | `routes/chats.py` | ✅ Migrated |
| `/api/documents` | `routes/documents.py` | ✅ Migrated |
| `/api/upload` | `routes/documents.py` | ✅ Migrated |
| `/api/delete` | `routes/documents.py` | ✅ Migrated |
| Clerk middleware | `middleware/auth.py` | ✅ Migrated |
| Mongoose models | `models/schemas.py` | ✅ Migrated |

## What's Next?

1. **Deprecate Express.js backend** - The `backend/` folder can be removed once migration is verified
2. **Update client API calls** - Point all frontend requests to port 8000
3. **Consolidate deployment** - Single Docker container for backend
