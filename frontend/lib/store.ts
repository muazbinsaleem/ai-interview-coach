import { InterviewSession } from '@/lib/types';

const SESSION_KEY = 'interview_session';

export const store = {
  save: (session: InterviewSession) =>
    localStorage.setItem(SESSION_KEY, JSON.stringify(session)),
  load: (): InterviewSession | null => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear: () => localStorage.removeItem(SESSION_KEY),
};
