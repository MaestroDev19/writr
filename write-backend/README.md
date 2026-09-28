# Writr Backend

FastAPI backend for **Writr**. Cloud-only for v1: **Supabase** (Auth + Postgres/`pgvector`) and hosted models (Gemini, OpenAI, Groq, OpenRouter).

---

## Features

- **Cloud inference**: Gemini, OpenAI, Groq, and OpenRouter via LangChain / LangGraph.
- **Cloud storage**: Supabase Postgres + `pgvector` for reference notes. Session drafts are not stored.
- **Auth**: Supabase JWT on protected routes.
- **Rate limiting**: SlowAPI.
- **Python**: `>=3.14` with [uv](https://docs.astral.sh/uv/).

---

## Project Structure

```text
write-backend/
├── main.py
├── pyproject.toml
├── router/
│   └── cloud/           # Cloud RAG, notes, Write / Review agents
├── services/
│   └── supabase.py      # Async Supabase client + current user
├── core/
│   └── config.py        # Pydantic settings from .env
└── utils/
    └── log.py
```

---

## Getting Started

Prerequisites: Python 3.14+ and a Supabase project with `pgvector` enabled.

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
uv sync
```

`.env`:

```env
ENVIRONMENT=development
PORT=8000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key

GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
OPENROUTER_API_KEY=your-openrouter-key
GROQ_API_KEY=your-groq-key
```

```bash
uv run fastapi dev main.py
```

- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Cloud notes (Supabase)

Reference notes (lore, character sheets, research) are embedded and stored. Write/Review session documents are request-scoped and returned as copiable text only.

```sql
create extension if not exists vector;

create table reference_chunks (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    metadata jsonb default '{}'::jsonb,
    embedding vector(768)
);
```

---

## License

Private repository. All rights reserved.
