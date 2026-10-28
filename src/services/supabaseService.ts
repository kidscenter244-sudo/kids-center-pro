import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Quiz, QuizSubmission, SupabaseConfig } from '../types/quiz';

const SUPABASE_CONFIG_STORAGE_KEY = 'kidscenter_supabase_config_v1';

export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- SQL schema for the kidscenter PRO platform
-- Copy this script into the Supabase SQL Editor and click RUN
-- ========================================================

-- 1. Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Student results and answers table
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

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_code ON public.quizzes(code);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_name ON public.submissions(student_name);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. Allow public read and write access through the anon key
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
      return { success: false, message: 'Please enter the URL and anon key' };
    }
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('quizzes').select('id').limit(1);
    if (error) {
      return { success: false, message: `Connection failed: ${error.message} (make sure the SQL schema for the quizzes table has been applied)` };
    }
    return { success: true, message: 'Successfully connected to the Supabase database! 🚀' };
  } catch (err) {
    return { success: false, message: `Connection error: ${(err as Error).message}` };
  }
}

export async function pushQuizToSupabase(quiz: Quiz): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    // In-memory / local storage mode when Supabase is not configured
    return true;
  }
  try {
    const { error } = await client.from('quizzes').upsert({
      id: quiz.id,
      code: quiz.code,
      config: quiz.config,
      questions: quiz.questions,
      created_at: quiz.createdAt,
    });
    if (error) {
      console.warn('Supabase: failed to save quiz (retaining local copy):', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase: network error saving quiz (retaining local copy):', err);
    return false;
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
  if (!client) {
    // In-memory / local storage mode when Supabase is not configured
    return true;
  }
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
      console.warn('Supabase: failed to save submission (retaining local copy):', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase: network error saving submission (retaining local copy):', err);
    return false;
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


export async function deleteSubmissionsFromSupabase(quizId?: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    let query = client.from('submissions').delete();
    if (quizId) {
      query = query.eq('quiz_id', quizId);
    } else {
      query = query.neq('id', '');
    }
    const { error } = await query;
    if (error) {
      console.warn('Supabase: failed to delete submissions:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase: network error deleting submissions:', err);
    return false;
  }
}

export async function deleteAllQuizzesFromSupabase(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    // Delete quizzes first. The schema uses ON DELETE CASCADE for submissions,
    // so a foreign-key or permission error will stop the operation before clearing results.
    const { error: quizzesError } = await client.from('quizzes').delete().neq('id', '');
    if (quizzesError) {
      console.warn('Supabase: failed to delete all quizzes:', quizzesError);
      return false;
    }
    const { error: submissionsError } = await client.from('submissions').delete().neq('id', '');
    if (submissionsError) {
      console.warn('Supabase: failed to delete remaining submissions:', submissionsError);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase: network error deleting all quizzes:', err);
    return false;
  }
}

export async function deleteQuizFromSupabase(quizId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    await client.from('submissions').delete().eq('quiz_id', quizId);
    const { error } = await client.from('quizzes').delete().eq('id', quizId);
    if (error) {
      console.warn('Supabase: failed to delete quiz:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase: network error deleting quiz:', err);
    return false;
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
