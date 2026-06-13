export type Role = 'software engineer' | 'data scientist' | 'devops engineer'
            | 'product manager' | 'qa analyst' | 'ux designer'
            | 'hr specialist' | 'marketing associate';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';
export type QuestionStatus = 'pending' | 'current' | 'answered' | 'skipped';

export interface Question {
  id: string;
  role: Role;
  difficulty: Difficulty;
  text: string;
  topic: string;
}

export interface Answer {
  questionId: string;
  text: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestedAnswer: string;
  summary: string;
}

export interface SessionConfig {
  role: Role;
  difficulty: Difficulty;
  voiceMode: boolean;
  narrateQuestions: boolean;
  useResumeSkills?: boolean;  // ← ADDED: whether to use resume skills
  skills?: string[];          // Extracted from resume — used to generate personalised questions
}

export interface InterviewSession {
  config: SessionConfig;
  questions: Question[];
  answers: Answer[];
  currentIndex: number;
  status: 'setup' | 'active' | 'complete';
  startedAt: number;
}