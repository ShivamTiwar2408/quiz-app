import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient, getTableName } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';
import { SMART_SCORING } from './shared/constants';
import { Question, UserProgress, QuizMode } from './shared/types';
import questions from './questions-data.json';

const typedQuestions = questions as Question[];

// Pure function - easy to test
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Separated data access from business logic
async function fetchUserProgress(userId: string): Promise<Map<string, UserProgress>> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) return new Map();

  try {
    const docClient = getDocClient();
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    const progressMap = new Map<string, UserProgress>();
    for (const item of (result.Items || []) as UserProgress[]) {
      progressMap.set(item.questionId, item);
    }
    return progressMap;
  } catch (error) {
    console.error('Error fetching progress:', error);
    return new Map();
  }
}

// Pure function - calculates score for a single question
function calculateQuestionScore(question: Question, progress: UserProgress | undefined): number {
  let score = SMART_SCORING.BASE_UNSEEN;

  if (progress) {
    if (progress.status === 'wrong' || progress.wrongCount > 0) {
      score = SMART_SCORING.WRONG_BASE + (progress.wrongCount || 0) * SMART_SCORING.WRONG_MULTIPLIER;
    } else if (progress.status === 'remind') {
      score = SMART_SCORING.REMIND_BASE + (progress.remindCount || 0) * SMART_SCORING.REMIND_MULTIPLIER;
    } else if (progress.status === 'known') {
      score = SMART_SCORING.KNOWN_BASE - Math.min((progress.knownCount || 0), 10);
    }

    // Boost score if not answered recently
    if (progress.lastAnswered) {
      const daysSince = (Date.now() - new Date(progress.lastAnswered).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) score += SMART_SCORING.DAYS_BOOST_7;
      if (daysSince > 30) score += SMART_SCORING.DAYS_BOOST_30;
    }
  }

  // Add randomness to prevent same order
  score += Math.random() * SMART_SCORING.RANDOMNESS_FACTOR;
  return score;
}

// Strategy pattern for question selection
interface QuestionSelector {
  select(questions: Question[], progress: Map<string, UserProgress>, count: number): Question[];
}

const smartSelector: QuestionSelector = {
  select(available, progress, count) {
    const scored = available.map(q => ({
      question: q,
      score: calculateQuestionScore(q, progress.get(q.id)),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.question);
  },
};

const wrongSelector: QuestionSelector = {
  select(available, progress, count) {
    const wrongIds = new Set(
      Array.from(progress.values())
        .filter(p => p.wrongCount > 0 || p.status === 'wrong')
        .map(p => p.questionId)
    );
    const wrongQuestions = available.filter(q => wrongIds.has(q.id));
    return shuffleArray(wrongQuestions).slice(0, count);
  },
};

const remindSelector: QuestionSelector = {
  select(available, progress, count) {
    const remindIds = new Set(
      Array.from(progress.values())
        .filter(p => p.status === 'remind')
        .map(p => p.questionId)
    );
    const remindQuestions = available.filter(q => remindIds.has(q.id));
    return shuffleArray(remindQuestions).slice(0, count);
  },
};

const randomSelector: QuestionSelector = {
  select(available, _progress, count) {
    return shuffleArray(available).slice(0, count);
  },
};

function getSelector(mode: QuizMode | undefined): QuestionSelector {
  switch (mode) {
    case 'wrong': return wrongSelector;
    case 'remind': return remindSelector;
    case 'random': return randomSelector;
    default: return smartSelector;
  }
}

// Fill remaining slots with random questions if needed
function fillRemainingSlots(selected: Question[], available: Question[], count: number): Question[] {
  if (selected.length >= count) return selected;

  const selectedIds = new Set(selected.map(q => q.id));
  const remaining = available.filter(q => !selectedIds.has(q.id));
  const additional = shuffleArray(remaining).slice(0, count - selected.length);
  return [...selected, ...additional];
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const params = event.queryStringParameters || {};
    const count = parseInt(params.count || '10', 10);
    const topic = params.topic;
    const subtopic = params.subtopic;
    const mode = params.mode as QuizMode | undefined;

    const userId = getUserId(event);

    // Filter questions by topic/subtopic
    let filteredQuestions = [...typedQuestions];
    if (topic) {
      filteredQuestions = filteredQuestions.filter(q => q.topic === topic);
    }
    if (subtopic) {
      filteredQuestions = filteredQuestions.filter(q => q.subtopic === subtopic);
    }

    // Get user progress and select questions
    const progress = await fetchUserProgress(userId);
    const selector = getSelector(mode);
    let selected = selector.select(filteredQuestions, progress, count);

    // Fill remaining slots if needed
    selected = fillRemainingSlots(selected, filteredQuestions, count);

    return successResponse({
      questions: shuffleArray(selected),
      total: filteredQuestions.length,
      returned: selected.length,
      mode: mode || 'smart',
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error');
  }
};
