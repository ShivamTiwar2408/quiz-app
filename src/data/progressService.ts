// Progress service — orchestrates the Firestore repositories and the pure
// SM-2 / quiz-generation logic in src/lib. Runs entirely client-side: it
// aggregates progress, generates quizzes, and applies the SM-2 update on each
// answer, persisting everything to Firestore.
import { v4 as uuidv4 } from 'uuid';
import {
  UserQuestionProgress,
  UserStats as DomainStats,
  GenerateQuizRequest,
  GenerateQuizResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  QuizAttempt,
} from '../lib/types';
import {
  createInitialProgress,
  updateProgressAfterAttempt,
  getDaysUntilReview,
} from '../lib/sm2';
import { generateQuiz as generateQuizPure } from '../lib/quizGenerator';
import { progressRepo, attemptRepo, sessionRepo } from './repositories';
import { loadQuestions, loadQuestionMap } from './questionBank';

// ---------------------------------------------------------------------------
// Stats aggregation (ported from getProgress Lambda)
// ---------------------------------------------------------------------------

function createEmptyStats(userId: string): DomainStats {
  return {
    userId,
    totalQuestionsAttempted: 0,
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    overallAccuracy: 0,
    learningCount: 0,
    reviewingCount: 0,
    masteredCount: 0,
    strugglingCount: 0,
    overdueCount: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0,
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    lastStudyDate: '',
    topicStats: {},
    averageConfidence: 0,
    confidenceAccuracyCorrelation: 0,
    totalStudyTimeMs: 0,
    averageSessionTimeMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export interface AggregatedProgress {
  progress: Record<string, UserQuestionProgress>;
  stats: DomainStats;
  dueForReview: { overdue: string[]; dueToday: string[]; dueTomorrow: string[] };
}

export function aggregate(userId: string, items: UserQuestionProgress[]): AggregatedProgress {
  const progress: Record<string, UserQuestionProgress> = {};
  const stats = createEmptyStats(userId);
  const dueForReview = { overdue: [] as string[], dueToday: [] as string[], dueTomorrow: [] as string[] };
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const item of items) {
    progress[item.questionId] = item;

    if (item.userStatus === 'learning') stats.learningCount++;
    else if (item.userStatus === 'reviewing') stats.reviewingCount++;
    else if (item.userStatus === 'mastered') stats.masteredCount++;
    else if (item.userStatus === 'struggling') stats.strugglingCount++;

    stats.totalQuestionsAttempted++;
    stats.totalCorrectAnswers += item.correctAttempts;
    stats.totalWrongAnswers += item.wrongAttempts;

    if (item.confidenceRatingsCount > 0) {
      totalConfidence += item.averageConfidenceRating * item.confidenceRatingsCount;
      confidenceCount += item.confidenceRatingsCount;
    }

    if (item.sm2?.nextReviewDate) {
      const daysUntil = getDaysUntilReview(item.sm2.nextReviewDate);
      if (daysUntil < 0) {
        stats.overdueCount++;
        dueForReview.overdue.push(item.questionId);
      } else if (daysUntil === 0) {
        stats.dueToday++;
        dueForReview.dueToday.push(item.questionId);
      } else if (daysUntil === 1) {
        stats.dueTomorrow++;
        dueForReview.dueTomorrow.push(item.questionId);
      } else if (daysUntil <= 7) {
        stats.dueThisWeek++;
      }
    }

    if (item.topic) {
      if (!stats.topicStats[item.topic]) {
        stats.topicStats[item.topic] = {
          topic: item.topic,
          totalQuestions: 0,
          attemptedQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          accuracy: 0,
          masteredCount: 0,
          strugglingCount: 0,
          averageConfidence: 0,
          lastStudiedAt: '',
        };
      }
      const ts = stats.topicStats[item.topic];
      ts.attemptedQuestions++;
      ts.correctAnswers += item.correctAttempts;
      ts.wrongAnswers += item.wrongAttempts;
      if (item.userStatus === 'mastered') ts.masteredCount++;
      if (item.userStatus === 'struggling') ts.strugglingCount++;
      if (item.lastAttemptDate && (!ts.lastStudiedAt || item.lastAttemptDate > ts.lastStudiedAt)) {
        ts.lastStudiedAt = item.lastAttemptDate;
      }
    }

    if (item.lastAttemptDate && (!stats.lastStudyDate || item.lastAttemptDate > stats.lastStudyDate)) {
      stats.lastStudyDate = item.lastAttemptDate;
    }
  }

  const totalAttempts = stats.totalCorrectAnswers + stats.totalWrongAnswers;
  stats.overallAccuracy = totalAttempts > 0
    ? Math.round((stats.totalCorrectAnswers / totalAttempts) * 100) / 100
    : 0;
  stats.averageConfidence = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100) / 100
    : 0;
  for (const ts of Object.values(stats.topicStats)) {
    const tt = ts.correctAnswers + ts.wrongAnswers;
    ts.accuracy = tt > 0 ? Math.round((ts.correctAnswers / tt) * 100) / 100 : 0;
  }
  stats.updatedAt = new Date().toISOString();

  return { progress, stats, dueForReview };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export async function getAggregatedProgress(uid: string): Promise<AggregatedProgress> {
  const items = await progressRepo.getAll(uid);
  return aggregate(uid, items);
}

export async function generateQuizForUser(
  uid: string,
  request: GenerateQuizRequest
): Promise<GenerateQuizResponse> {
  const [questions, items] = await Promise.all([loadQuestions(), progressRepo.getAll(uid)]);
  const progressMap = new Map(items.map((p) => [p.questionId, p]));

  const { questions: selected, metadata } = generateQuizPure(questions, progressMap, request);

  const sessionId = uuidv4();
  const estimatedTimeMinutes = Math.ceil(selected.length * 1.5);

  // Record the session (fire-and-forget; failure shouldn't block the quiz).
  void sessionRepo
    .save(uid, {
      sessionId,
      quizType: request.quizType,
      topic: request.topic,
      subtopic: request.subtopic,
      totalQuestions: selected.length,
      questionsAnswered: 0,
      correctAnswers: 0,
      startedAt: new Date().toISOString(),
    })
    .catch(() => {});

  return { sessionId, questions: selected, quizType: request.quizType, estimatedTimeMinutes, metadata };
}

export async function submitAnswerForUser(
  uid: string,
  request: SubmitAnswerRequest
): Promise<SubmitAnswerResponse | null> {
  const { sessionId, questionId, selectedAnswers, confidenceRating = 4, responseTimeMs = 0 } = request;

  const questionMap = await loadQuestionMap();
  const question = questionMap.get(questionId);
  if (!question) return null;

  const correctAnswers = question.correct_answers;
  const isCorrect =
    correctAnswers.length === selectedAnswers.length &&
    correctAnswers.every((c) => selectedAnswers.includes(c));

  let progress = await progressRepo.get(uid, questionId);
  if (!progress) {
    progress = createInitialProgress(uid, questionId, question.topic, question.subtopic, question.difficulty);
  }

  const updated = updateProgressAfterAttempt(progress, isCorrect, confidenceRating, responseTimeMs);
  await progressRepo.save(uid, updated);

  // Record the attempt for history / "past mistakes".
  const attempt: QuizAttempt = {
    attemptId: uuidv4(),
    userId: uid,
    questionId,
    selectedAnswers,
    correctAnswers,
    isCorrect,
    confidenceRating,
    responseTimeMs,
    quizType: 'adaptive',
    topic: question.topic,
    subtopic: question.subtopic,
    difficulty: question.difficulty,
    attemptedAt: new Date().toISOString(),
  };
  void attemptRepo.save(uid, attempt).catch(() => {});

  return {
    isCorrect,
    correctAnswers,
    explanation: question.explanation,
    nextReviewDate: updated.sm2.nextReviewDate,
    newInterval: updated.sm2.interval,
    newEaseFactor: updated.sm2.easeFactor,
    newStatus: updated.userStatus ?? 'learning',
    streakUpdate: {
      currentStreak: updated.currentStreak,
      isNewRecord: updated.currentStreak === updated.longestStreak && updated.currentStreak > 1,
    },
    relatedConcepts: question.relatedConcepts || [],
  };
}

// ---------------------------------------------------------------------------
// Legacy-shape converters (ported from getProgress Lambda) so the existing
// React UI, which consumes the legacy progress/stats shape, works unchanged.
// ---------------------------------------------------------------------------

export function toLegacyProgress(progress: Record<string, UserQuestionProgress>): Record<string, any> {
  const legacy: Record<string, any> = {};
  for (const [id, p] of Object.entries(progress)) {
    let status: 'known' | 'remind' | 'wrong' | null = null;
    if (p.userStatus === 'mastered') status = 'known';
    else if (p.userStatus === 'struggling') status = 'wrong';
    else if (p.flaggedForReview) status = 'remind';
    else if (p.totalAttempts > 0) {
      const accuracy = p.correctAttempts / p.totalAttempts;
      if (accuracy >= 0.9) status = 'known';
      else if (accuracy < 0.6) status = 'wrong';
      else status = 'remind';
    }
    legacy[id] = {
      questionId: p.questionId,
      topic: p.topic,
      subtopic: p.subtopic,
      status,
      answeredCorrectly: p.correctAttempts > p.wrongAttempts,
      wrongCount: p.wrongAttempts,
      correctCount: p.correctAttempts,
      remindCount: p.flaggedForReview ? 1 : 0,
      knownCount: p.userStatus === 'mastered' ? 1 : 0,
      lastAnswered: p.lastAttemptDate,
      sm2: p.sm2,
      userStatus: p.userStatus,
      currentStreak: p.currentStreak,
      averageConfidence: p.averageConfidenceRating,
    };
  }
  return legacy;
}

export function toLegacyStats(stats: DomainStats): any {
  return {
    totalAnswered: stats.totalQuestionsAttempted,
    totalCorrect: stats.totalCorrectAnswers,
    totalWrong: stats.totalWrongAnswers,
    totalKnown: stats.masteredCount,
    totalRemind: stats.reviewingCount + stats.learningCount,
    topicStats: Object.fromEntries(
      Object.entries(stats.topicStats).map(([topic, stat]) => [
        topic,
        { answered: stat.attemptedQuestions, correct: stat.correctAnswers, wrong: stat.wrongAnswers },
      ])
    ),
    overallAccuracy: stats.overallAccuracy,
    overdueCount: stats.overdueCount,
    dueToday: stats.dueToday,
    learningCount: stats.learningCount,
    reviewingCount: stats.reviewingCount,
    masteredCount: stats.masteredCount,
    strugglingCount: stats.strugglingCount,
  };
}
