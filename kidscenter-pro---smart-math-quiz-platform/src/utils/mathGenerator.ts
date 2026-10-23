import { OperationType, Question, QuestionGroup, QuizConfig } from '../types/quiz';

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRangeForDigits(digits: number): { min: number; max: number } {
  if (digits <= 1) {
    return { min: 2, max: 9 };
  }
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return { min, max };
}

export function generateSingleQuestion(
  operation: OperationType,
  num1Digits: number = 2,
  num2Digits: number = 2,
  groupId?: string,
  groupLabel?: string
): Question {
  const range1 = getRangeForDigits(num1Digits);
  const range2 = getRangeForDigits(num2Digits);

  let activeOp: 'multiply' | 'divide';
  if (operation === 'mixed') {
    activeOp = Math.random() > 0.5 ? 'multiply' : 'divide';
  } else {
    activeOp = operation;
  }

  let num1 = 10;
  let num2 = 10;
  let operator = '×';
  let correctAnswer = 0;

  if (activeOp === 'multiply') {
    operator = '×';
    num1 = getRandomInt(range1.min, range1.max);
    num2 = getRandomInt(range2.min, range2.max);
    correctAnswer = num1 * num2;
  } else {
    // division: ensure clean integer division without remainder
    operator = '÷';
    const quotient = getRandomInt(range1.min, range1.max);
    const divisor = getRandomInt(range2.min, range2.max);
    num1 = quotient * divisor;
    num2 = divisor;
    correctAnswer = quotient;
  }

  const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    id,
    num1,
    num2,
    operator,
    operatorType: activeOp,
    correctAnswer,
    groupId,
    groupLabel,
  };
}

export function generateQuizQuestions(config: QuizConfig): Question[] {
  const allQuestions: Question[] = [];
  const groups = config.groups && config.groups.length > 0
    ? config.groups
    : [
        {
          id: 'grp_default',
          operation: 'multiply' as OperationType,
          num1Digits: 2,
          num2Digits: 2,
          questionCount: 10,
        },
      ];

  groups.forEach((group: QuestionGroup, groupIdx: number) => {
    const targetCount = Math.max(1, group.questionCount || 5);
    const seenPairs = new Set<string>();
    const label = `Section ${groupIdx + 1}: ${
      group.operation === 'multiply' ? 'Multiply' : group.operation === 'divide' ? 'Divide' : 'Mixed'
    } (${group.num1Digits}×${group.num2Digits})`;

    let attempts = 0;
    const groupQuestions: Question[] = [];

    while (groupQuestions.length < targetCount && attempts < targetCount * 25) {
      attempts++;
      const q = generateSingleQuestion(
        group.operation,
        group.num1Digits,
        group.num2Digits,
        group.id,
        label
      );
      const key = `${q.num1}_${q.operator}_${q.num2}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        groupQuestions.push(q);
      }
    }

    // Fill if needed
    while (groupQuestions.length < targetCount) {
      groupQuestions.push(
        generateSingleQuestion(
          group.operation,
          group.num1Digits,
          group.num2Digits,
          group.id,
          label
        )
      );
    }

    allQuestions.push(...groupQuestions);
  });

  return allQuestions;
}
