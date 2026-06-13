/**
 * lib/api.ts
 * ==========
 * Typed API client that calls the FastAPI backend.
 * All requests include the stored JWT Bearer token.
 */

import { auth, AuthUser } from '@/lib/auth';
import {
  ApiResponse,
  BackendQuestion,
  BackendEvalResult,
  BackendSession,
  BackendAnswerCreate,
  BackendSessionCreate,
  DashboardStats,
  BackendAnswerDetail,
  BackendSessionDetail,
  BackendResumeResult,
  StoredResume,
} from './contracts';

export type {
  ApiResponse,
  BackendQuestion,
  BackendEvalResult,
  BackendSession,
  BackendAnswerCreate,
  BackendSessionCreate,
  DashboardStats,
  BackendAnswerDetail,
  BackendSessionDetail,
  BackendResumeResult,
  StoredResume,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Generic request helper ────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = auth.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`📡 API Request: ${path}`, { method: options.method });

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`❌ API Error ${res.status}: ${path}`, JSON.stringify(body, null, 2));
    
    if (body.detail) {
      if (Array.isArray(body.detail)) {
        const errors = body.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
        throw new Error(`Validation failed: ${errors}`);
      }
      throw new Error(body.detail);
    }
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  const json = await res.json();
  console.log(`✅ API Response: ${path}`, { success: json.success });
  return json;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export async function apiSignup(name: string, email: string, password: string) {
  const res = await request<ApiResponse<{ token: string; user: AuthUser }>>(
    '/auth/signup',
    { method: 'POST', body: JSON.stringify({ name, email, password }) }
  );
  return res.data;
}

export async function apiLogin(email: string, password: string) {
  const res = await request<ApiResponse<{ token: string; user: AuthUser }>>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
  return res.data;
}

export async function apiMe() {
  const res = await request<ApiResponse<AuthUser>>('/auth/me');
  return res.data;
}

// ── Questions endpoints ───────────────────────────────────────────────────────

export async function apiGetQuestionsFromBank(
  role: string,
  difficulty: string
): Promise<BackendQuestion[]> {
  console.log(`📚 No skills - using bank for role: ${role}, difficulty: ${difficulty}`);
  
  const res = await request<ApiResponse<{ questions: BackendQuestion[] }>>(
    '/interview/generate-questions',
    { 
      method: 'POST', 
      body: JSON.stringify({ role, difficulty, skills: [] })
    }
  );
  return res.data.questions;
}

export async function apiGenerateQuestions(
  role: string,
  difficulty: string,
  skills: string[] = []
): Promise<BackendQuestion[]> {
  console.log(`🎯 Personalized questions with ${skills.length} skills:`, skills.slice(0, 5));
  
  const res = await request<ApiResponse<{ questions: BackendQuestion[] }>>(
    '/interview/generate-questions',
    { 
      method: 'POST', 
      body: JSON.stringify({ role, difficulty, skills })
    }
  );
  
  console.log(`📚 Received ${res.data.questions.length} questions`);
  return res.data.questions;
}

// ── Evaluate endpoint ─────────────────────────────────────────────────────────

export async function apiEvaluateAnswer(
  questionText: string,
  questionTopic: string,
  answerText: string,
  role: string,
  difficulty: string,
  idealAnswer?: string  // ← ADDED: idealAnswer parameter
): Promise<BackendEvalResult> {
  const res = await request<ApiResponse<BackendEvalResult>>(
    '/interview/evaluate-answer',
    {
      method: 'POST',
      body: JSON.stringify({
        question: questionText,
        ideal_answer: idealAnswer || "",  // ← Use provided idealAnswer
        user_answer: answerText,
      }),
    }
  );
  return res.data;
}

// ── Sessions endpoints ────────────────────────────────────────────────────────

export async function apiSaveSession(
  sessionData: BackendSessionCreate
): Promise<BackendSession> {
  const res = await request<ApiResponse<BackendSession>>(
    '/sessions/',
    { method: 'POST', body: JSON.stringify(sessionData) }
  );
  return res.data;
}

export async function apiListSessions(): Promise<BackendSession[]> {
  const res = await request<ApiResponse<BackendSession[]>>('/sessions/');
  return res.data;
}

export async function apiGetSessionById(id: string): Promise<BackendSessionDetail> {
  const res = await request<ApiResponse<BackendSessionDetail>>(`/sessions/${id}`);
  return res.data;
}

// ── Resume endpoints ─────────────────────────────────────────────────────────

export async function apiUploadResume(file: File): Promise<BackendResumeResult> {
  const token = auth.getToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/resume/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `HTTP ${res.status}`);
  }

  const json = await res.json() as ApiResponse<BackendResumeResult>;
  return json.data;
}

export async function apiGetResumes(): Promise<StoredResume[]> {
  const res = await request<ApiResponse<{ resumes: StoredResume[] }>>('/resume/');
  return res.data.resumes;
}

export async function apiGetResumeById(id: string): Promise<BackendResumeResult> {
  const res = await request<ApiResponse<BackendResumeResult>>(`/resume/${id}`);
  return res.data;
}

export async function apiGetDashboard(): Promise<DashboardStats> {
  const res = await request<ApiResponse<DashboardStats>>('/dashboard/');
  return res.data;
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function apiHealth(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/health`);
    return true;
  } catch {
    return false;
  }
}