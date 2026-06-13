/**
 * lib/contracts.ts
 * =================
 * Defines API contracts (request/response schemas) between frontend and FastAPI backend.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface BackendQuestion {
  id: string;
  text: string;
  /** Backend returns 'category'; 'topic' is kept for backwards compat */
  category?: string;
  topic?: string;
  role?: string;
  difficulty?: string;
  ideal_answer?: string;
  _ideal_answer?: string;
}

export interface BackendEvalResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggested_answer: string;
  summary: string;
}

export interface BackendSession {
  id: string;
  role: string;
  difficulty: string;
  voice_mode: boolean;
  overall_score: number;
  started_at: string | null;
  completed_at: string | null;
  answer_count: number;
}

export interface BackendAnswerCreate {
  question_id: string;
  question_text: string;
  question_topic: string;
  answer_text: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggested_answer: string;
  summary: string;
}

export interface BackendSessionCreate {
  role: string;
  difficulty: string;
  voice_mode: boolean;
  started_at: string;
  answers: BackendAnswerCreate[];
}

export interface DashboardStats {
  total_sessions: number;
  average_score: number;
  scores_over_time: { date: string; score: number }[];
  weak_topics: string[];
  strong_topics: string[];
  best_role: string;
  sessions_this_week: number;
  improvement_trend: 'improving' | 'declining' | 'stable';
}

export interface BackendAnswerDetail {
  id: string;
  session_id: string;
  question_id: string;
  question_text: string;
  question_topic: string;
  answer_text: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggested_answer: string;
  summary: string;
  created_at: string | null;
}

export interface BackendSessionDetail {
  id: string;
  role: string;
  difficulty: string;
  voice_mode: boolean;
  overall_score: number;
  started_at: string | null;
  completed_at: string | null;
  answers: BackendAnswerDetail[];
}

export interface BackendResumeResult {
  id: string;
  user_id: string;
  skills: string[];
  extracted_text: string;
  created_at: string | null;
}

export interface StoredResume {
  id: string;
  user_id: string;
  skills: string[];
  created_at: string | null;
}
