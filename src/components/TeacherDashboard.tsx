import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Trophy, 
  Search, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  X,
  Layers,
  Clock,
  Sparkles,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Quiz, QuizSubmission } from '../types/quiz';
import { quizService } from '../services/quizService';
import { sound } from '../utils/audio';

interface TeacherDashboardProps {
  quizzes: Quiz[];
  submissions: QuizSubmission[];
  selectedQuizId?: string;
  onSelectQuizId?: (quizId: string) => void;
  onRefresh: () => void;
  onGoToBuilder: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  quizzes,
  submissions,
  selectedQuizId = 'all',
  onSelectQuizId,
  onRefresh,
  onGoToBuilder,
}) => {
  const [internalQuizFilter, setInternalQuizFilter] = useState<string>(selectedQuizId);
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectSubmission, setInspectSubmission] = useState<QuizSubmission | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Sync external selectedQuizId if provided
  useEffect(() => {
    if (selectedQuizId) {
      setInternalQuizFilter(selectedQuizId);
    }
  }, [selectedQuizId]);

  const handleFilterChange = (id: string) => {
    setInternalQuizFilter(id);
    if (onSelectQuizId) {
      onSelectQuizId(id);
    }
    sound.playClick();
  };

  // Build unified quiz list combining quizzes and submissions
  const quizOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; code?: string; count: number }>();

    // 1. Add all quizzes created by teacher
    quizzes.forEach((q) => {
      map.set(q.id, {
        id: q.id,
        title: q.config.title || `Quiz ${q.code}`,
        code: q.code,
        count: 0,
      });
    });

    // 2. Count submissions for each quiz
    submissions.forEach((s) => {
      const existing = map.get(s.quizId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(s.quizId, {
          id: s.quizId,
          title: s.quizTitle || 'Quiz',
          code: undefined,
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [quizzes, submissions]);

  // Submissions filtered strictly by active quiz selection
  const activeQuizSubmissions = useMemo(() => {
    if (internalQuizFilter === 'all') {
      return submissions;
    }
    return submissions.filter((s) => s.quizId === internalQuizFilter);
  }, [submissions, internalQuizFilter]);

  // Submissions further filtered by search query
  const filteredSubmissions = useMemo(() => {
    return activeQuizSubmissions.filter((sub) => {
      return sub.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [activeQuizSubmissions, searchTerm]);

  // Metadata of currently selected quiz
  const currentSelectedQuiz = useMemo(() => {
    if (internalQuizFilter === 'all') return null;
    return quizzes.find((q) => q.id === internalQuizFilter) || null;
  }, [quizzes, internalQuizFilter]);

  // Stats dynamically computed strictly for the active selection
  const totalSubmissionsCount = activeQuizSubmissions.length;
  const averageScorePercent = useMemo(() => {
    if (totalSubmissionsCount === 0) return 0;
    const sum = activeQuizSubmissions.reduce((acc, curr) => acc + curr.percentage, 0);
    return Math.round(sum / totalSubmissionsCount);
  }, [activeQuizSubmissions, totalSubmissionsCount]);

  const topStudent = useMemo(() => {
    if (totalSubmissionsCount === 0) return null;
    return [...activeQuizSubmissions].sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds)[0];
  }, [activeQuizSubmissions, totalSubmissionsCount]);

  const fastestStudent = useMemo(() => {
    if (totalSubmissionsCount === 0) return null;
    return [...activeQuizSubmissions].sort((a, b) => a.timeSpentSeconds - b.timeSpentSeconds)[0];
  }, [activeQuizSubmissions, totalSubmissionsCount]);

  // CSV Export for active scope
  const handleExportCSV = () => {
    if (activeQuizSubmissions.length === 0) return;
    sound.playClick();

    const quizScopeName = currentSelectedQuiz?.config.title || 'All_Quizzes';
    const headers = ['Student Name', 'Quiz Title', 'Score', 'Total Questions', 'Percentage', 'Time in Seconds', 'Submitted At'];
    const rows = activeQuizSubmissions.map((s) => [
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${s.quizTitle.replace(/"/g, '""')}"`,
      s.score,
      s.totalQuestions,
      `${s.percentage}%`,
      s.timeSpentSeconds,
      new Date(s.submittedAt).toLocaleString('en-US'),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kidscenter_${quizScopeName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Summary Report for active scope
  const handleCopyReport = () => {
    if (activeQuizSubmissions.length === 0) return;
    sound.playClick();

    const scopeTitle = currentSelectedQuiz 
      ? `Quiz: ${currentSelectedQuiz.config.title} (Code: ${currentSelectedQuiz.code})` 
      : 'All Quizzes Combined';

    let text = `📊 kidscenter PRO - Student Quiz Results Report:\n`;
    text += `Scope: ${scopeTitle}\n`;
    text += `Total Completed Students: ${activeQuizSubmissions.length}\n`;
    text += `Average Score: ${averageScorePercent}%\n\n`;
    text += `🏆 Student Leaderboard:\n`;

    activeQuizSubmissions.forEach((s, idx) => {
      text += `${idx + 1}. ${s.studentName} - Score: ${s.score}/${s.totalQuestions} (${s.percentage}%) - in ${Math.floor(s.timeSpentSeconds / 60)}m ${s.timeSpentSeconds % 60}s\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Permanent clear: Deletes from BOTH local storage and Supabase database
  const handleClear = async () => {
    if (confirmClear) {
      setIsClearing(true);
      try {
        const targetQuizId = internalQuizFilter === 'all' ? undefined : internalQuizFilter;
        await quizService.clearSubmissions(targetQuizId);
        setConfirmClear(false);
        onRefresh();
        sound.playVictory();
      } catch (err) {
        console.error('Error clearing submissions:', err);
      } finally {
        setIsClearing(false);
      }
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-300">
      
      {/* Inspector Modal */}
      {inspectSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-xl overflow-hidden card-soft-black-shadow">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Student Answers: {inspectSubmission.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectSubmission.quizTitle} · Score: {inspectSubmission.score}/{inspectSubmission.totalQuestions} ({inspectSubmission.percentage}%)
                </p>
              </div>
              <button
                onClick={() => setInspectSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[420px] overflow-y-auto space-y-2">
              {inspectSubmission.answers.map((ans, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    ans.isCorrect
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                    <span className="text-base font-black math-font">{ans.questionText} =</span>
                    <span className="text-xs font-bold math-font">
                      Student: {ans.studentAnswer !== null ? ans.studentAnswer : 'blank'}
                    </span>
                  </div>

                  {ans.isCorrect ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Correct</span>
                    </span>
                  ) : (
                    <div className="text-right text-xs">
                      <span className="flex items-center gap-1 text-rose-600 font-bold justify-end">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Incorrect</span>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Correct: <strong className="text-indigo-600 math-font">{ans.correctAnswer}</strong>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectSubmission(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Student Submissions & Quiz Results
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review live scores, accuracy, and detailed student submissions for each specific quiz or overall
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await quizService.syncWithSupabase();
              onRefresh();
              sound.playClick();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors card-soft-black-shadow cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleCopyReport}
            disabled={activeQuizSubmissions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 card-soft-black-shadow cursor-pointer"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedReport ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={activeQuizSubmissions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Quiz Selector Navigation Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-[28px] p-3 mb-6 card-soft-black-shadow">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>اختر الاختبار لعرض استجاباته الخاصة (Filter by Quiz):</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            {quizOptions.length} quizzes created
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* Option: All Quizzes */}
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 ${
              internalQuizFilter === 'all'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>جميع الاختبارات (All Quizzes)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              internalQuizFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
            }`}>
              {submissions.length}
            </span>
          </button>

          {/* Individual Quizzes */}
          {quizOptions.map((q) => {
            const isSelected = internalQuizFilter === q.id;
            return (
              <button
                key={q.id}
                onClick={() => handleFilterChange(q.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                {q.code && (
                  <span className={`font-mono text-[11px] font-black px-1.5 py-0.5 rounded-lg ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {q.code}
                  </span>
                )}
                <span className="max-w-[180px] truncate">{q.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {q.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Quiz Info Banner (If individual quiz is active) */}
      {currentSelectedQuiz && (
        <div className="bg-gradient-to-r from-indigo-50/90 to-sky-50/60 border border-indigo-100 rounded-[28px] p-4 sm:p-5 mb-6 card-soft-black-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-black font-mono">
                Code: {currentSelectedQuiz.code}
              </span>
              <span className="text-xs text-indigo-800 font-extrabold">
                استجابات هذا الامتحان فقط (Viewing only this quiz's results)
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900">
              {currentSelectedQuiz.config.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>الأسئلة: <strong className="text-slate-800 math-font">{currentSelectedQuiz.questions.length}</strong></span>
              <span>•</span>
              <span>الوقت: <strong className="text-slate-800">{currentSelectedQuiz.config.timeMinutes === 0 ? 'مفتوح (Unlimited)' : `${currentSelectedQuiz.config.timeMinutes} دقائق`}</strong></span>
              <span>•</span>
              <span>الاستجابات الحالية: <strong className="text-indigo-600 math-font">{activeQuizSubmissions.length}</strong> طالب</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleFilterChange('all')}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              عرض جميع الاختبارات
            </button>

            {activeQuizSubmissions.length > 0 && (
              <button
                onClick={handleClear}
                disabled={isClearing}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  confirmClear
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
                title="حذف استجابات هذا الامتحان نهائياً من الموقع وسوبابيس"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {confirmClear
                    ? 'اضغط لتأكيد الحذف نهائياً'
                    : 'مسح استجابات هذا الامتحان'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards (Scoped strictly to current selection) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200/90 p-5 rounded-[28px] card-soft-black-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">Total Completed</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black math-font text-slate-900">{totalSubmissionsCount}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {internalQuizFilter === 'all' ? 'across all quizzes' : 'students in this quiz'}
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-[28px] card-soft-black-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">Average Accuracy</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black math-font text-emerald-600">{averageScorePercent}%</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">average score</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-[28px] card-soft-black-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">Top Student</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base font-black text-slate-900 truncate">
            {topStudent ? topStudent.studentName : '—'}
          </div>
          <span className="text-[10px] text-slate-400 math-font mt-0.5 block">
            {topStudent ? `${topStudent.score}/${topStudent.totalQuestions} (${topStudent.percentage}%)` : 'No submissions yet'}
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-[28px] card-soft-black-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold text-slate-600">Fastest Student</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-base font-black text-slate-900 truncate">
            {fastestStudent ? fastestStudent.studentName : '—'}
          </div>
          <span className="text-[10px] text-slate-400 math-font mt-0.5 block">
            {fastestStudent ? `in ${fastestStudent.timeSpentSeconds}s` : 'No submissions yet'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-[28px] p-3.5 mb-6 card-soft-black-shadow flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student by name..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 outline-none font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={internalQuizFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-2xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Quizzes ({submissions.length})</option>
            {quizOptions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.code ? `[${q.code}] ` : ''}{q.title} ({q.count})
              </option>
            ))}
          </select>

          {activeQuizSubmissions.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isClearing}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                confirmClear
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100'
              }`}
              title={
                confirmClear
                  ? 'Click again to permanently delete from local storage and Supabase'
                  : internalQuizFilter === 'all'
                  ? 'Clear all submissions permanently'
                  : 'Clear submissions for this quiz permanently'
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {confirmClear
                  ? 'تأكيد الحذف نهائياً'
                  : internalQuizFilter === 'all'
                  ? 'مسح الكل'
                  : 'مسح استجابات الاختبار'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-[32px] p-10 text-center card-soft-black-shadow">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {internalQuizFilter === 'all' 
              ? 'No Student Submissions Yet' 
              : 'لا توجد استجابات لهذا الاختبار حتى الآن'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
            {internalQuizFilter === 'all'
              ? 'Share the quiz link or code with your students. Each student\'s score and answers will appear here in real-time.'
              : `شارك كود الاختبار (${currentSelectedQuiz?.code || ''}) مع الطلاب لتسجيل استجاباتهم وظهورها هنا مباشرة.`}
          </p>
          <button
            onClick={onGoToBuilder}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs cursor-pointer transition-all shadow-sm"
          >
            Create a New Quiz
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-[32px] overflow-hidden card-soft-black-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Quiz Title</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Accuracy</th>
                  <th className="py-3 px-4">Time Taken</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSubmissions.map((sub, idx) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {sub.studentName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{sub.quizTitle}</td>
                    <td className="py-3 px-4 font-black math-font text-slate-900 text-sm">
                      {sub.score} / {sub.totalQuestions}
                    </td>
                    <td className="py-3 px-4 font-bold math-font">
                      <span className={`px-2 py-0.5 rounded-lg text-xs ${
                        sub.percentage >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {sub.percentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 math-font text-slate-600">
                      {Math.floor(sub.timeSpentSeconds / 60)}m {sub.timeSpentSeconds % 60}s
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(sub.submittedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setInspectSubmission(sub);
                          sound.playClick();
                        }}
                        className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View Answers</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
