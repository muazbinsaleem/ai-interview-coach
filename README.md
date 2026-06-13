# 🎯 AI Interview Coach

> A full-stack AI-powered mock interview platform — practice with role-specific questions, get real-time expert feedback, and track your growth session by session.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎤 **Voice Mode** | Answer questions out loud with built-in audio recording & text-to-speech narration |
| 📄 **Resume-Personalised Questions** | Upload your PDF resume; the backend extracts your skills and generates tailored questions via Gemini |
| 🤖 **Dual AI Evaluation** | A trained scikit-learn ML model scores answers (cosine similarity, 0 – 10 scale) while Google Gemini provides rich qualitative feedback |
| 🔁 **API Key Rotation** | Two Gemini API keys are supported with automatic failover on rate-limit (HTTP 429) or quota (HTTP 403) errors |
| 📊 **Dashboard & History** | Track performance across sessions, review individual answers, and compare scores over time |
| 🌗 **Dark / Light Theme** | Persistent theme toggle with smooth transitions |
| 🔐 **JWT Auth** | Stateless JWT authentication backed by Supabase (PostgreSQL + GoTrue) |

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion 12 |
| Icons | React Icons 5 |
| Runtime | React 19 |

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111 |
| Language | Python 3.10+ |
| Server | Uvicorn (ASGI) |
| Auth & DB | Supabase (PostgreSQL + GoTrue) |
| ML Engine | scikit-learn 1.4 + joblib (trained interview model) |
| AI Feedback | Google Gemini 2.0 Flash (`gemini-2.0-flash`) |
| Resume Parsing | pypdf 4 |
| JWT | python-jose + passlib/bcrypt |

---

## 📂 Project Structure

```
ai-interview-coach/
│
├── frontend/                        # Next.js 16 Application
│   ├── app/
│   │   ├── page.tsx                 # Landing page (hero, features, session setup)
│   │   ├── layout.tsx               # Root layout with font + metadata
│   │   ├── globals.css              # Design tokens & global styles
│   │   ├── dashboard/               # Performance dashboard page
│   │   ├── history/                 # Session history & answer review
│   │   ├── interview/               # Live interview session page
│   │   ├── results/                 # Post-session results page
│   │   ├── resume/                  # Resume upload page
│   │   ├── login/                   # Login page
│   │   ├── signup/                  # Signup page
│   │   └── api/                     # Next.js API routes (proxies)
│   │
│   ├── components/
│   │   ├── interview/
│   │   │   ├── SessionSetup.tsx     # Role / difficulty / voice mode selector
│   │   │   ├── QuestionCard.tsx     # Displays the current question
│   │   │   ├── AnswerInput.tsx      # Text answer input with submit
│   │   │   ├── VoiceRecorder.tsx    # Full audio recording + waveform UI
│   │   │   ├── VoicePlayer.tsx      # Playback component for recorded audio
│   │   │   └── FeedbackCard.tsx     # Per-answer score + Gemini feedback card
│   │   ├── layout/
│   │   │   ├── Header.tsx           # Top nav with auth state & theme toggle
│   │   │   ├── Sidebar.tsx          # Collapsible sidebar navigation
│   │   │   └── ProgressBar.tsx      # Interview progress indicator
│   │   ├── results/
│   │   │   ├── PerformanceBreakdown.tsx  # Detailed score breakdown chart
│   │   │   ├── ReportModal.tsx           # Exportable session report modal
│   │   │   └── ScoreGauge.tsx            # Circular score gauge component
│   │   └── ui/                      # Reusable primitives
│   │       ├── Button.tsx, Card.tsx, Badge.tsx
│   │       ├── Input.tsx, Textarea.tsx, Select.tsx
│   │       ├── Modal.tsx, Loader.tsx, ProgressBar.tsx
│   │       └── ThemeToggle.tsx
│   │
│   ├── hooks/
│   │   ├── useVoiceRecorder.ts      # MediaRecorder hook with blob output
│   │   ├── useTextToSpeech.ts       # Web Speech API TTS hook
│   │   └── useTheme.ts              # Dark/light theme persistence
│   │
│   └── lib/
│       ├── api.ts                   # Typed Axios/fetch wrappers for backend
│       ├── auth.ts                  # JWT token helpers
│       ├── questions.ts             # Question generation & fetching logic
│       ├── evaluate.ts              # Answer evaluation API calls
│       ├── contracts.ts             # Shared TypeScript contracts / DTOs
│       ├── types.ts                 # Core type definitions
│       └── store.ts                 # Lightweight client-side state store
│
└── backend/                         # FastAPI Application
    ├── app/
    │   ├── main.py                  # App factory, CORS, router registration, lifespan
    │   ├── config.py                # Pydantic-settings; all env vars validated here
    │   ├── database.py              # Supabase client initialisation
    │   ├── dependencies.py          # FastAPI Depends — JWT auth, current user
    │   │
    │   ├── routers/
    │   │   ├── interview.py         # ★ Primary: ML + Gemini interview endpoints
    │   │   ├── auth.py              # /auth/register, /auth/login, /auth/me
    │   │   ├── resume.py            # /resume/upload, /resume/skills
    │   │   ├── sessions.py          # /sessions — CRUD for interview sessions
    │   │   ├── dashboard.py         # /dashboard — aggregated analytics
    │   │   ├── questions.py         # /questions — legacy question endpoint
    │   │   └── evaluate.py          # /evaluate — legacy evaluation endpoint
    │   │
    │   ├── services/
    │   │   ├── interview_model.py   # Loads joblib model; generates & scores answers
    │   │   ├── gemini_service.py    # Gemini 2.0 Flash: feedback + question generation
    │   │   ├── resume_service.py    # PDF text extraction + skill keyword parsing
    │   │   ├── auth_service.py      # Password hashing, JWT creation & validation
    │   │   ├── session_service.py   # Session + answer persistence to Supabase
    │   │   ├── dashboard_service.py # Analytics queries against Supabase
    │   │   └── ai_service.py        # Shared AI utilities
    │   │
    │   ├── models/                  # Pydantic request/response schemas
    │   └── utils/                   # Response helpers, logging utilities
    │
    ├── models_data/
    │   └── interview_model.joblib   # Trained scikit-learn model (add manually)
    ├── requirements.txt
    └── schema.sql                   # Supabase database schema (run once)
```

---

## 🧠 How It Works

### Question Generation — Two Modes

```
┌─────────────────────────────────────────────────┐
│  Resume Mode  (skills provided)                 │
│  1. Gemini 2.0 Flash → personalised questions   │
│     (explicit skill references enforced)        │
│  2. Fallback → skill-template questions         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Practice Mode  (no resume / no skills)         │
│  1. Gemini 2.0 Flash → pure technical Qs        │
│     (behavioral questions explicitly excluded)  │
│  2. Fallback → ML model question bank           │
└─────────────────────────────────────────────────┘
```

### Answer Evaluation — Hybrid Pipeline

```
User Answer
     │
     ▼
┌────────────────────────────┐
│  ML Model (scikit-learn)   │
│  Cosine similarity vs.     │
│  ideal answer → 0–3 score  │
└────────────────┬───────────┘
                 │
                 ▼
┌────────────────────────────┐
│  Gemini 2.0 Flash          │
│  Qualitative enhancement:  │
│  strengths · weaknesses    │
│  tips · follow-up question │
└────────────────┬───────────┘
                 │
                 ▼
         Score 0 – 10 + Rich Feedback
```

**Score scale:** raw ML score (0 – 3) is normalised to a public **0 – 10** scale (`score_10 = raw × 10/3`).

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v20+
- **Python** 3.10+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- The trained `interview_model.joblib` file (place in `backend/models_data/`)

---

### 1 — Database Setup

Open the Supabase SQL editor and run `backend/schema.sql` once. This creates the `users`, `resumes`, `sessions`, and `answers` tables with all indexes.

---

### 2 — Backend Setup

```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_KEY=<your-service-role-key>

# JWT
JWT_SECRET=<a-long-random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080        # 7 days

# Google Gemini (primary + optional secondary for auto-rotation)
GOOGLE_GEMINI_API_KEY=<your-primary-key>
GOOGLE_GEMINI_API_KEY_2=<your-secondary-key>   # optional

# App
ENVIRONMENT=development
APP_VERSION=1.0.0
```

```bash
# Start the backend (hot-reload)
uvicorn app.main:app --reload
```

API runs at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

### 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
# Start the dev server
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## 📡 API Reference

All primary endpoints live under `/interview/*` and require a `Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Authenticate and receive a JWT |
| `GET` | `/auth/me` | Get the current authenticated user |
| `POST` | `/resume/upload` | Upload PDF and extract skills |
| `POST` | `/interview/generate-questions` | Generate 6 interview questions |
| `POST` | `/interview/evaluate-answer` | Score + enhance a single answer |
| `POST` | `/interview/evaluate-session` | Score + enhance a full session |
| `POST` | `/interview/save-session` | Evaluate and persist to database |
| `GET` | `/interview/health` | ML model + Gemini health probe |
| `GET` | `/dashboard` | Aggregated user performance stats |
| `GET` | `/sessions` | List past interview sessions |
| `GET` | `/health` | Global API health check |

---

## 🗄️ Database Schema

```
users        — id, name, email, password_hash, created_at
resumes      — id, user_id → users, extracted_text, skills (JSONB), created_at
sessions     — id, user_id → users, role, difficulty, voice_mode, overall_score, ...
answers      — id, session_id → sessions, question_text, answer_text, score,
               strengths (JSONB), weaknesses (JSONB), suggested_answer, summary, ...
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Full Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase service-role key |
| `JWT_SECRET` | ✅ | Secret used to sign JWTs |
| `JWT_ALGORITHM` | ✗ | Signing algorithm (default: `HS256`) |
| `JWT_EXPIRE_MINUTES` | ✗ | Token TTL in minutes (default: `10080` = 7 days) |
| `GOOGLE_GEMINI_API_KEY` | ✅ | Primary Gemini API key |
| `GOOGLE_GEMINI_API_KEY_2` | ✗ | Secondary key for auto-rotation on rate limits |
| `HUGGINGFACE_API_KEY` | ✗ | Hugging Face key (legacy, not actively used) |
| `ENVIRONMENT` | ✗ | `development` or `production` |
| `APP_VERSION` | ✗ | Displayed in health check response |
| `INTERVIEW_MODEL_PATH` | ✗ | Path to `.joblib` model (default: `models_data/interview_model.joblib`) |

---

## 🧪 Running Tests

```bash
cd backend
pytest
```

Tests live in `backend/tests/`. Uses `pytest` + `pytest-asyncio`.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project was built as a university project. Feel free to use it for learning and portfolio purposes.
