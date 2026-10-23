import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Quiz, QuizSubmission, SupabaseConfig } from '../types/quiz';

const SUPABASE_CONFIG_STORAGE_KEY = 'kidscenter_supabase_config_v1';

export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- كود إنشاء جداول منصة kidscenter PRO في Supabase
-- قم بنسخ هذا الكود ولصقه في SQL Editor داخل مشروع Supabase واضغط RUN
-- ========================================================

-- 1. جدول الاختبارات (quizzes)
CREATE TABLE IF NOT EXISTS public.quizzes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. جدول نتائج وإجابات الطلاب (submissions)
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    quiz_title TEXT,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    percentage INTEGER NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    answers JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. فهارس تسريع البحث (Indexes)
CREATE INDEX IF NOT EXISTS idx_quizzes_code ON public.quizzes(code);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_name ON public.submissions(student_name);

-- 4. تمكين سياسات الحماية العامة (Row Level Security - RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. السماح بالقراءة والكتابة للجميع (عبر Anon Key)
CREATE POLICY "Allow public read access on quizzes" 
ON public.quizzes FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on quizzes" 
ON public.quizzes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access on quizzes" 
ON public.quizzes FOR DELETE USING (true);

CREATE POLICY "Allow public read access on submissions" 
ON public.submissions FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on submissions" 
ON public.submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access on submissions" 
ON public.submissions FOR DELETE USING (true);
`;

export function getStoredSupabaseConfig(): SupabaseConfig {
  // Prefer Vercel's deployed configuration over stale localStorage values.
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';
  if (envUrl && envKey) return { url: envUrl, anonKey: envKey };

  // Manual configuration remains available when build-time variables are absent.
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore malformed browser configuration.
  }
  return { url: envUrl, anonKey: envKey };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig) {
  localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  initClient();
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  return initClient();
}

function initClient(): SupabaseClient | null {
  const cfg = getStoredSupabaseConfig();
  if (cfg.url && cfg.anonKey && cfg.url.startsWith('http')) {
    try {
      supabaseInstance = createClient(cfg.url, cfg.anonKey);
      return supabaseInstance;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
  return supabaseInstance;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'يرجى إدخال الرابط ومفتاح Anon Key' };
    }
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('quizzes').select('id').limit(1);
    if (error) {
      return { success: false, message: `فشل الاتصال: ${error.message} (تأكد من تطبيق كود SQL لإنشاء جدول quizzes)` };
    }
    return { success: true, message: 'تم الاتصال بنجاح بقاعدة بيانات Supabase! 🚀' };
  } catch (err) {
    return { success: false, message: `خطأ أثناء الاتصال: ${(err as Error).message}` };
  }
}

export async function pushQuizToSupabase(quiz: Quiz): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('quizzes').upsert({
      id: quiz.id,
      code: quiz.code,
      config: quiz.config,
      questions: quiz.questions,
      created_at: quiz.createdAt,
    });
    if (error) {
      console.error('Supabase: failed to save quiz', error);
      throw new Error(error.message || 'Supabase rejected the quiz save request.');
    }
    return true;
  } catch (err) {
    console.error('Supabase: failed to save quiz', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function fetchQuizzesFromSupabase(): Promise<Quiz[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (error) console.error('Supabase: failed to fetch quizzes', error);
      return null;
    }

    return data.map((item) => ({
      id: item.id,
      code: item.code,
      config: item.config,
      questions: item.questions,
      createdAt: item.created_at,
    }));
  } catch (err) {
    console.error('Supabase: failed to fetch quizzes', err);
    return null;
  }
}

export async function pushSubmissionToSupabase(sub: QuizSubmission): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('submissions').insert({
      id: sub.id,
      quiz_id: sub.quizId,
      quiz_title: sub.quizTitle,
      student_name: sub.studentName,
      score: sub.score,
      total_questions: sub.totalQuestions,
      percentage: sub.percentage,
      time_spent_seconds: sub.timeSpentSeconds,
      answers: sub.answers,
      submitted_at: sub.submittedAt,
    });
    if (error) {
      console.error('Supabase: failed to save submission', error);
      throw new Error(error.message || 'Supabase rejected the student result save request.');
    }
    return true;
  } catch (err) {
    console.error('Supabase: failed to save submission', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function fetchSubmissionsFromSupabase(quizId?: string): Promise<QuizSubmission[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    let query = client.from('submissions').select('*').order('submitted_at', { ascending: false });
    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }
    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error('Supabase: failed to fetch submissions', error);
      return null;
    }

    return data.map((item) => ({
      id: item.id,
      quizId: item.quiz_id,
      quizTitle: item.quiz_title,
      studentName: item.student_name,
      score: item.score,
      totalQuestions: item.total_questions,
      percentage: item.percentage,
      timeSpentSeconds: item.time_spent_seconds,
      submittedAt: item.submitted_at,
      answers: item.answers,
    }));
  } catch (err) {
    console.error('Supabase: failed to fetch submissions', err);
    return null;
  }
}


/** Subscribe to shared quiz/result changes from Supabase Realtime. */
export function subscribeToSupabaseRealtime(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel = client
    .channel('kidscenter-shared-data-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, onChange)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Supabase Realtime subscription status:', status);
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
