# 🖥️ AI Interview Coach — Frontend

The Next.js 16 frontend for **InterviewAI**. A full-featured, dark-mode-first interview practice UI with voice recording, animated feedback cards, resume upload, and a performance dashboard.

> **Part of a monorepo.** The FastAPI backend lives in `../backend/`. See the [root README](../README.md) for full-stack setup.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set the backend URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

> Make sure the backend is running first (`uvicorn app.main:app --reload` in `../backend/`).

---

## 🗂️ Project Structure

```
frontend/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — Inter font, dark class, metadata
│   ├── globals.css               # Design tokens (CSS vars), animations, utilities
│   ├── page.tsx                  # Landing page — hero, features, how-it-works, setup
│   ├── interview/                # Live interview session
│   ├── results/                  # Post-session score + feedback review
│   ├── dashboard/                # User performance dashboard
│   ├── history/                  # Past sessions list + detailed answer replay
│   ├── resume/                   # Resume upload & skill extraction
│   ├── login/                    # Login page
│   ├── signup/                   # Signup / registration page
│   └── api/                      # Next.js route handlers (API proxies if needed)
│
├── components/
│   ├── interview/
│   │   ├── SessionSetup.tsx      # Role selector, difficulty picker, voice toggle,
│   │   │                         #   resume-skill mode toggle
│   │   ├── QuestionCard.tsx      # Displays the current interview question
│   │   ├── AnswerInput.tsx       # Textarea + submit button for text answers
│   │   ├── VoiceRecorder.tsx     # Full audio recording UI — waveform, timer,
│   │   │                         #   pause/resume, STT transcript
│   │   ├── VoicePlayer.tsx       # Playback control for recorded audio blobs
│   │   └── FeedbackCard.tsx      # Per-answer card: score ring, strengths,
│   │                             #   weaknesses, tips, model answer, follow-up Q
│   ├── layout/
│   │   ├── Header.tsx            # Top nav — logo, auth state, theme toggle, links
│   │   ├── Sidebar.tsx           # Collapsible side navigation with active states
│   │   └── ProgressBar.tsx       # Interview question progress tracker
│   ├── results/
│   │   ├── PerformanceBreakdown.tsx  # Per-question bar chart breakdown
│   │   ├── ScoreGauge.tsx            # SVG circular gauge for overall score
│   │   └── ReportModal.tsx           # Modal for viewing / exporting session report
│   └── ui/                       # Primitive reusable components
│       ├── Button.tsx            # Primary / ghost / danger variants
│       ├── Card.tsx              # Surface card with optional glow prop
│       ├── Badge.tsx             # Status / label badges
│       ├── Input.tsx             # Styled text input
│       ├── Textarea.tsx          # Auto-resize styled textarea
│       ├── Select.tsx            # Custom styled select dropdown
│       ├── Modal.tsx             # Accessible overlay modal
│       ├── Loader.tsx            # Spinner / skeleton loader
│       ├── ProgressBar.tsx       # Horizontal fill bar
│       └── ThemeToggle.tsx       # Dark ↔ Light toggle button
│
├── hooks/
│   ├── useVoiceRecorder.ts       # MediaRecorder hook → audio Blob output
│   ├── useTextToSpeech.ts        # Web Speech API TTS hook (narrates questions)
│   └── useTheme.ts               # Persists dark/light class on <html>
│
├── lib/
│   ├── api.ts                    # All typed fetch wrappers for the backend API
│   ├── auth.ts                   # JWT storage, getToken(), setToken(), clear()
│   ├── questions.ts              # Question fetch + generation logic
│   ├── evaluate.ts               # Answer evaluation API calls + result mapping
│   ├── contracts.ts              # Shared TS interfaces matching backend schemas
│   ├── types.ts                  # Core domain types (Role, Difficulty, Question…)
│   └── store.ts                  # Lightweight in-memory client-side state
│
├── public/
│   └── logo.webp                 # App favicon / logo
│
├── .env.local                    # Local environment variables (git-ignored)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript config (strict mode, @/* alias)
├── tailwind.config (via PostCSS) # Tailwind CSS v4 via @tailwindcss/postcss
└── package.json
```

---

## 🎨 Design System

All design tokens are defined as **CSS custom properties** in [`app/globals.css`](app/globals.css) and consumed via Tailwind utilities or inline `var(--...)` references.

### Colour Tokens

| Token | Dark mode | Light mode | Usage |
|---|---|---|---|
| `--bg-base` | `#0f0f0f` | `#fafafa` | Page background |
| `--bg-surface` | `#1a1a1a` | `#ffffff` | Cards, panels |
| `--bg-elevated` | `#242424` | `#f4f4f5` | Elevated surfaces |
| `--border` | `#2e2e2e` | `#e4e4e7` | Default borders |
| `--accent-blue` | `#2563eb` | `#2563eb` | Primary CTA colour |
| `--text-primary` | `#f5f5f5` | `#09090b` | Main text |
| `--text-secondary` | `#a0a0a0` | `#71717a` | Subdued text |
| `--success` | `#16a34a` | — | Success states |
| `--error` | `#ef4444` | — | Error states |
| `--warning` | `#f59e0b` | — | Warning states |

### Typography

Inter (Google Fonts, weights 300 – 700) is loaded in [`app/layout.tsx`](app/layout.tsx) and applied via `--font-sans`.

### Animations (defined in `globals.css`)

| Class | Effect |
|---|---|
| `.waveform-bar` | Staggered Y-scale wave (voice recorder visualiser) |
| `.recording-pulse` | Red radial pulse ring (active recording indicator) |
| `.dot-pulse` | Opacity pulse for live badges |
| `.recording-pulse` | Pulsing mic glow while recording |
| `.speaker-pulse` | Breathing opacity for TTS playback indicator |
| `.card-hover-glow` | Blue border + shadow on card hover |
| `.progress-bar-fill` | Smooth width transition for score bars |
| `score-ring` keyframe | SVG stroke animation for score gauge |

---

## 🔄 Interview Flow (Client-Side)

```
Landing page
    │
    ▼
SessionSetup — pick role + difficulty + voice mode
    │ (optionally: upload resume → extract skills)
    │
    ▼  saves config to localStorage["interview_config"]
/interview
    │
    ├── Questions fetched: POST /interview/generate-questions
    │     • With skills  → personalised Gemini questions
    │     • Without      → ML bank or Gemini technical questions
    │
    ├── For each question:
    │     • Text answer  → AnswerInput
    │     • Voice answer → VoiceRecorder → STT transcript
    │     → POST /interview/evaluate-answer → FeedbackCard
    │
    ▼
/results — aggregate scores + PerformanceBreakdown + ScoreGauge
    │
    ▼  (session saved to DB)
/dashboard — all-time stats
/history   — browse past sessions + replay per-answer feedback
```

---

## 🔌 API Client (`lib/api.ts`)

All requests to the FastAPI backend go through a single typed `request<T>()` helper that:

- Reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)
- Attaches `Authorization: Bearer <token>` from `auth.getToken()`
- Parses errors from both FastAPI validation format and custom `{ message }` format

### Key exported functions

| Function | Endpoint | Description |
|---|---|---|
| `apiSignup(name, email, password)` | `POST /auth/signup` | Register a new account |
| `apiLogin(email, password)` | `POST /auth/login` | Authenticate, receive JWT |
| `apiMe()` | `GET /auth/me` | Fetch current user |
| `apiUploadResume(file)` | `POST /resume/upload` | Upload PDF resume |
| `apiGetResumes()` | `GET /resume/` | List stored resumes |
| `apiGenerateQuestions(role, diff, skills)` | `POST /interview/generate-questions` | Personalised question gen |
| `apiGetQuestionsFromBank(role, diff)` | `POST /interview/generate-questions` | Practice mode (no skills) |
| `apiEvaluateAnswer(q, topic, a, role, diff, ideal)` | `POST /interview/evaluate-answer` | Score + feedback |
| `apiSaveSession(data)` | `POST /sessions/` | Persist completed session |
| `apiListSessions()` | `GET /sessions/` | User's session history |
| `apiGetSessionById(id)` | `GET /sessions/:id` | Session detail + answers |
| `apiGetDashboard()` | `GET /dashboard/` | Aggregated performance stats |
| `apiHealth()` | `GET /health` | Ping the backend |

---

## 🌐 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000` | Backend API base URL |

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📦 Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.2.6 | React framework (App Router) |
| `react` | 19.2.4 | UI library |
| `react-dom` | 19.2.4 | DOM rendering |
| `framer-motion` | ^12.38 | Animations & transitions |
| `react-icons` | ^5.6 | Icon sets (Remix Icons used) |

### Dev / Build

| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^4 | Utility CSS via PostCSS plugin |
| `@tailwindcss/postcss` | ^4 | Tailwind v4 PostCSS integration |
| `typescript` | ^5 | Type checking (strict mode) |
| `eslint` + `eslint-config-next` | 16.2.6 | Linting |

---

## 🛠️ Available Scripts

```bash
npm run dev      # Start dev server with hot-reload (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # Run ESLint
```

---

## 🔑 Auth Flow

Authentication is **JWT-based** — no cookies.

1. `apiLogin()` / `apiSignup()` return `{ token, user }`.
2. The token is stored via `auth.setToken(token)` (in `lib/auth.ts`) — persisted to `localStorage`.
3. Every subsequent `request<T>()` call reads it with `auth.getToken()` and sends `Authorization: Bearer <token>`.
4. `auth.clear()` removes the token on logout.

---

## 🎤 Voice Features

### Recording (`useVoiceRecorder` + `VoiceRecorder.tsx`)

- Uses the browser **MediaRecorder API** to capture audio.
- Supports pause / resume during recording.
- On stop, produces an audio **Blob** and triggers Speech-to-Text via the **Web Speech API** (`webkitSpeechRecognition`) to generate a transcript that is submitted as the text answer.

### Text-to-Speech (`useTextToSpeech`)

- Uses `window.speechSynthesis` to narrate question text aloud.
- Activated when `narrateQuestions: true` is set in the session config.

> Both features rely on browser APIs — Chrome / Edge recommended. Firefox has limited `SpeechRecognition` support.

---

## 🧩 Key Type Definitions (`lib/types.ts`)

```typescript
type Role = 'software engineer' | 'data scientist' | 'devops engineer'
           | 'product manager' | 'qa analyst' | 'ux designer'
           | 'hr specialist' | 'marketing associate';

type Difficulty = 'easy' | 'medium' | 'hard';

interface SessionConfig {
  role: Role;
  difficulty: Difficulty;
  voiceMode: boolean;
  narrateQuestions: boolean;
  useResumeSkills?: boolean;
  skills?: string[];            // extracted from uploaded resume
}
```

---

## 🚀 Deployment

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import **only the `frontend/` directory** into Vercel as the project root.
3. Add the environment variable `NEXT_PUBLIC_API_URL=<your-deployed-backend-url>`.
4. Deploy — Vercel auto-detects Next.js.

### Self-hosted

```bash
npm run build
npm run start          # listens on port 3000 by default
```
