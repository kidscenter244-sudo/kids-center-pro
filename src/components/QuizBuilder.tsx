import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  Plus, 
  Trash2, 
  Sliders, 
  ArrowRight
} from 'lucide-react';
import { OperationType, QuestionGroup, Quiz, QuizConfig } from '../types/quiz';
import { quizService } from '../services/quizService';
import { generateSingleQuestion } from '../utils/mathGenerator';
import { sound } from '../utils/audio';

interface QuizBuilderProps {
  onQuizCreated: (quiz: Quiz) => void;
  onGoToDashboard: () => void;
}

export const QuizBuilder: React.FC<QuizBuilderProps> = ({
  onQuizCreated,
  onGoToDashboard,
}) => {
  // Question Groups (Multi-section builder)
  const [groups, setGroups] = useState<QuestionGroup[]>([
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
  ]);

  // Free custom time in minutes (0 means unlimited)
  const [timeMinutes, setTimeMinutes] = useState<number>(3);
  const [divisionExactOnly, setDivisionExactOnly] = useState<boolean>(true);
  const [previewSeed, setPreviewSeed] = useState(0);

  // Total questions count calculated from all groups
  const totalQuestions = useMemo(() => {
    return groups.reduce((acc, curr) => acc + (Number(curr.questionCount) || 0), 0);
  }, [groups]);

  // Preset Handlers
  const applyUserExamplePreset = () => {
    setGroups([
      {
        id: `grp_${Date.now()}_1`,
        operation: 'multiply',
        num1Digits: 1,
        num2Digits: 1,
        questionCount: 10,
      },
      {
        id: `grp_${Date.now()}_2`,
        operation: 'multiply',
        num1Digits: 2,
        num2Digits: 1,
        questionCount: 10,
      },
    ]);
    setTimeMinutes(3);
    sound.playClick();
  };

  const applyMultiplyAndDividePreset = () => {
    setGroups([
      {
        id: `grp_${Date.now()}_1`,
        operation: 'multiply',
        num1Digits: 2,
        num2Digits: 2,
        questionCount: 10,
      },
      {
        id: `grp_${Date.now()}_2`,
        operation: 'divide',
        num1Digits: 2,
        num2Digits: 1,
        questionCount: 10,
      },
    ]);
    setTimeMinutes(4);
    sound.playClick();
  };

  const applySingleGroup2x2 = () => {
    setGroups([
      {
        id: `grp_${Date.now()}_1`,
        operation: 'multiply',
        num1Digits: 2,
        num2Digits: 2,
        questionCount: 10,
      },
    ]);
    setTimeMinutes(2);
    sound.playClick();
  };

  // Add a new question group
  const handleAddGroup = () => {
    sound.playClick();
    const newGroup: QuestionGroup = {
      id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      operation: 'multiply',
      num1Digits: 2,
      num2Digits: 2,
      questionCount: 10,
    };
    setGroups([...groups, newGroup]);
  };

  // Remove a group
  const handleRemoveGroup = (id: string) => {
    if (groups.length <= 1) return;
    sound.playClick();
    setGroups(groups.filter((g) => g.id !== id));
  };

  // Update a field in a group
  const handleUpdateGroup = (
    id: string,
    field: keyof QuestionGroup,
    value: unknown
  ) => {
    setGroups(
      groups.map((g) => {
        if (g.id === id) {
          return { ...g, [field]: value };
        }
        return g;
      })
    );
  };

  // Live sample preview from active groups
  const sampleQuestions = useMemo(() => {
    const list = [];
    for (const g of groups) {
      list.push(generateSingleQuestion(g.operation, g.num1Digits, g.num2Digits));
      if (list.length >= 3) break;
    }
    while (list.length < 3 && groups.length > 0) {
      const g = groups[0];
      list.push(generateSingleQuestion(g.operation, g.num1Digits, g.num2Digits));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, previewSeed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playVictory();

    // Auto-generate clean title based on groups
    const opTypes = Array.from(new Set(groups.map((g) => g.operation)));
    let opSummary = 'Multiplication';
    if (opTypes.includes('multiply') && opTypes.includes('divide')) {
      opSummary = 'Multiplication & Division';
    } else if (opTypes.includes('divide')) {
      opSummary = 'Division';
    } else if (opTypes.includes('mixed')) {
      opSummary = 'Mixed Math';
    }

    const autoTitle = `${opSummary} Quiz (${totalQuestions} Questions) - kidscenter PRO`;

    const config: QuizConfig = {
      title: autoTitle,
      groups,
      totalQuestionCount: totalQuestions,
      timeMinutes: Math.max(0, Number(timeMinutes) || 0),
      allowScratchpad: true,
      divisionExactOnly,
    };

    try {
      const newQuiz = await quizService.saveQuiz(config);
      onQuizCreated(newQuiz);
    } catch (err) {
      console.error('Quiz could not be synced to Supabase', err);
      const detail = err instanceof Error ? err.message : String(err);
      window.alert('فشل حفظ الاختبار في قاعدة البيانات المشتركة. لا تشارك الكود قبل إصلاح المشكلة. سبب الخطأ: ' + detail);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-300">
      
      {/* Intro Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Create & Customize Math Quiz
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto font-medium">
          Combine multiplication and division, configure digit lengths, and add multiple question sections
        </p>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        <button
          type="button"
          onClick={applyUserExamplePreset}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>⭐ Custom: 10 Qs (1×1) + 10 Qs (2×1)</span>
        </button>

        <button
          type="button"
          onClick={applyMultiplyAndDividePreset}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 card-soft-black-shadow cursor-pointer"
        >
          <span>➗ Mixed Math (10 Multiply + 10 Divide)</span>
        </button>

        <button
          type="button"
          onClick={applySingleGroup2x2}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 card-soft-black-shadow cursor-pointer"
        >
          <span>🎯 10 Qs 2-Digit × 2-Digit (2×2)</span>
        </button>
      </div>

      {/* Main Central Card */}
      <div className="bg-white border border-slate-200/90 rounded-[36px] p-6 sm:p-8 card-soft-black-shadow relative">
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Header of Section: Question Groups List */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-sm font-black text-slate-900 block">
                Question Groups in this Quiz:
              </span>
              <span className="text-[11px] text-slate-400">
                Set arithmetic operation, number digit lengths, and question count for each group
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddGroup}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Another Question Group</span>
            </button>
          </div>

          {/* Groups List */}
          <div className="space-y-4">
            {groups.map((group, idx) => (
              <div
                key={group.id}
                className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 relative transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Group {idx + 1}
                    </span>
                  </div>

                  {groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(group.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors"
                      title="Delete this group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  
                  {/* Operation */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Operation:
                    </label>
                    <select
                      value={group.operation}
                      onChange={(e) =>
                        handleUpdateGroup(group.id, 'operation', e.target.value as OperationType)
                      }
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="multiply">Multiplication (×)</option>
                      <option value="divide">Division (÷)</option>
                      <option value="mixed">Mixed (× & ÷)</option>
                    </select>
                  </div>

                  {/* Num1 Digits */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Number 1 Digits:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={group.num1Digits}
                      onChange={(e) =>
                        handleUpdateGroup(group.id, 'num1Digits', Number(e.target.value))
                      }
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-center text-sm font-black math-font text-slate-900 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                      ({group.num1Digits === 1 ? '1 digit' : `${group.num1Digits} digits`})
                    </span>
                  </div>

                  {/* Num2 Digits */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Number 2 Digits:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={group.num2Digits}
                      onChange={(e) =>
                        handleUpdateGroup(group.id, 'num2Digits', Number(e.target.value))
                      }
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-center text-sm font-black math-font text-slate-900 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                      ({group.num2Digits === 1 ? '1 digit' : `${group.num2Digits} digits`})
                    </span>
                  </div>

                  {/* Question Count */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Questions Count:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={group.questionCount}
                      onChange={(e) =>
                        handleUpdateGroup(group.id, 'questionCount', Number(e.target.value))
                      }
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-center text-sm font-black math-font text-indigo-600 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                      questions
                    </span>
                  </div>

                </div>

                <div className="mt-2 text-left text-[11px] text-slate-500 font-semibold">
                  Preview: {group.num1Digits}-digit {group.operation === 'multiply' ? '×' : group.operation === 'divide' ? '÷' : '×/÷'} {group.num2Digits}-digit ({group.questionCount} questions)
                </div>
              </div>
            ))}
          </div>

          {/* Time & Total Questions Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">
                Total Questions in Quiz:
              </span>
              <span className="text-2xl font-black math-font text-slate-900">
                {totalQuestions} <span className="text-xs font-normal text-slate-500">questions total</span>
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Exam Time Limit (in minutes):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(Number(e.target.value))}
                  placeholder="Minutes (0 = Unlimited)"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-center text-base font-black math-font text-slate-900 outline-none"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {timeMinutes > 0 ? `${timeMinutes} mins` : 'Unlimited time'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live sample problems generated from active groups:</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setPreviewSeed((prev) => prev + 1);
                  sound.playClick();
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Regenerate Samples</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {sampleQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/90 rounded-2xl p-3 text-center shadow-sm"
                >
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                    Sample {idx + 1}
                  </span>
                  <div className="text-lg font-black math-font text-slate-900">
                    {q.num1} {q.operator} {q.num2} = <span className="text-indigo-600">?</span>
                  </div>
                  <span className="text-[10px] text-slate-400 math-font block mt-0.5">
                    (Answer: {q.correctAnswer})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              className="w-full sm:flex-1 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-lg shadow-slate-900/15 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Create & Publish Quiz for Students 🚀</span>
            </button>

            <button
              type="button"
              onClick={onGoToDashboard}
              className="w-full sm:w-auto py-3.5 px-5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer card-soft-black-shadow"
            >
              <span>View Submissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};
