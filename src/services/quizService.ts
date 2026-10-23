import { Quiz, QuizConfig, QuizSubmission } from '../types/quiz';
import { generateQuizQuestions } from '../utils/mathGenerator';
import { 
  pushQuizToSupabase, 
  fetchQuizzesFromSupabase, 
  pushSubmissionToSupabase, 
  fetchSubmissionsFromSupabase 
} from './supabaseService';

const QUIZZES_STORAGE_KEY = 'kidscenter_pro_quizzes_v3';
const SUBMISSIONS_STORAGE_KEY = 'kidscenter_pro_submissions_v3';

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('kidscenter_pro_sync_channel');
  }
} catch {
  // Ignored
}

export function subscribeToSync(callback: () => void): () => void {
  if (!channel) {
    const handler = (e: StorageEvent) => {
      if (e.key === QUIZZES_STORAGE_KEY || e.key === SUBMISSIONS_STORAGE_KEY) {
        callback();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const handler = () => {
    callback();
  };
  channel.addEventListener('message', handler);
  return () => {
    channel?.removeEventListener('message', handler);
  };
}

function notifySync() {
  if (channel) {
    channel.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
  }
}

export function generateQuizCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
  const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
  const n1 = nums.charAt(Math.floor(Math.random() * nums.length));
  const n2 = nums.charAt(Math.floor(Math.random() * nums.length));
  return `KC-${l1}${l2}${n1}${n2}`;
}

const defaultDemoQuizConfig: QuizConfig = {
  title: 'Comprehensive Math Challenge (10 Qs 1×1 + 10 Qs 2×1)',
  groups: [
    {
      id: 'grp_1',
      operation: 'multiply',
      num1Digits: 1,
      num2Digits: 1,
      questionCount: 10,
    },
    {
      id: 'grp_2',
      operation: 'multiply',
      num1Digits: 2,
      num2Digits: 1,
      questionCount: 10,
    },
  ],
  totalQuestionCount: 20,
  timeMinutes: 3,
  allowScratchpad: true,
  divisionExactOnly: true,
};

function createInitialQuizzes(): Quiz[] {
  const code = 'KC-PRO1';
  const quizId = 'quiz_demo_groups_1';
  const questions = generateQuizQuestions(defaultDemoQuizConfig);
  return [
    {
      id: quizId,
      code,
      config: defaultDemoQuizConfig,
      questions,
      createdAt: new Date().toISOString(),
    },
  ];
}

export const quizService = {
  getQuizzes(): Quiz[] {
    try {
      const data = localStorage.getItem(QUIZZES_STORAGE_KEY);
      if (!data) {
        const initial = createInitialQuizzes();
        localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(data);
    } catch {
      return createInitialQuizzes();
    }
  },

  async syncWithSupabase(): Promise<void> {
    try {
      const remoteQuizzes = await fetchQuizzesFromSupabase();
      if (remoteQuizzes !== null) {
        localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(remoteQuizzes));
      }

      const remoteSubs = await fetchSubmissionsFromSupabase();
      if (remoteSubs !== null) {
        localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(remoteSubs));
      }
      notifySync();
    } catch {
      // Ignored
    }
  },

  async getQuizByIdOrCode(idOrCode: string): Promise<Quiz | null> {
    const clean = idOrCode.trim().toUpperCase();
    const localMatch = this.getQuizzes().find(
      (q) => q.id === idOrCode || q.code.toUpperCase() === clean
    );
    if (localMatch) return localMatch;

    // A student's browser has separate localStorage; query the shared database.
    const remoteQuizzes = await fetchQuizzesFromSupabase();
    if (!remoteQuizzes) return null;
    const remoteMatch = remoteQuizzes.find(
      (q) => q.id === idOrCode || q.code.toUpperCase() === clean
    );
    if (remoteMatch) {
      const merged = [
        remoteMatch,
        ...this.getQuizzes().filter((q) => q.id !== remoteMatch.id),
      ];
      localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(merged));
      notifySync();
    }
    return remoteMatch || null;
  },

  async saveQuiz(config: QuizConfig): Promise<Quiz> {
    const quizzes = this.getQuizzes();
    const id = `quiz_${Date.now()}`;
    const code = generateQuizCode();
    const questions = generateQuizQuestions(config);

    const newQuiz: Quiz = {
      id,
      code,
      config,
      questions,
      createdAt: new Date().toISOString(),
    };

    const updated = [newQuiz, ...quizzes];
    localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(updated));
    notifySync();

    // Do not offer a share code until the quiz is saved to the shared database.
    const synced = await pushQuizToSupabase(newQuiz);
    if (!synced) {
      throw new Error('Supabase did not confirm saving this quiz. Check the browser console for details.');
    }
    return newQuiz;
  },

  deleteQuiz(id: string) {
    const quizzes = this.getQuizzes().filter((q) => q.id !== id);
    localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(quizzes));
    notifySync();
  },

  getSubmissions(quizId?: string): QuizSubmission[] {
    try {
      const data = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
      const list: QuizSubmission[] = data ? JSON.parse(data) : [];
      if (quizId) {
        return list.filter((s) => s.quizId === quizId);
      }
      return list;
    } catch {
      return [];
    }
  },

  async saveSubmission(submission: Omit<QuizSubmission, 'id' | 'submittedAt'>): Promise<QuizSubmission> {
    const submissions = this.getSubmissions();
    const fullSubmission: QuizSubmission = {
      ...submission,
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      submittedAt: new Date().toISOString(),
    };

    const updated = [fullSubmission, ...submissions];
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated));
    notifySync();

    const synced = await pushSubmissionToSupabase(fullSubmission);
    if (!synced) {
      throw new Error('Supabase did not confirm saving the student result. Check the browser console for details.');
    }
    return fullSubmission;
  },

  clearSubmissions(quizId?: string) {
    if (quizId) {
      const remaining = this.getSubmissions().filter((s) => s.quizId !== quizId);
      localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify([]));
    }
    notifySync();
  },
};
