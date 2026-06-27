// API facade — the single data boundary for the UI.
//
// Previously this called an AWS API Gateway + Lambda backend. It now runs
// fully client-side against Firestore (user data) + a bundled question bank,
// with the SM-2 spaced-repetition and quiz-generation logic in src/lib.
//
// Every exported name and signature is preserved so screens/hooks are
// unchanged. Functions that depended on server-only features (LLM note-question
// generation, admin custom/hidden question management) degrade gracefully.
import {
  Question, UserProgress, UserStats, TopicsMap, Note,
  GenerateQuizRequest, GenerateQuizResponse,
  SubmitAnswerRequest, SubmitAnswerResponse,
  QuizType,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserId } from './auth';
import { loadTopics } from './data/questionBank';
import { notesRepo, attemptRepo, sessionRepo } from './data/repositories';
import {
  getAggregatedProgress,
  generateQuizForUser,
  submitAnswerForUser,
  toLegacyProgress,
  toLegacyStats,
} from './data/progressService';

function requireUid(): string | null {
  return getCurrentUserId();
}

// ============================================
// TOPICS API
// ============================================

export async function fetchTopics(): Promise<TopicsMap> {
  try {
    return await loadTopics();
  } catch (error) {
    console.error('Error fetching topics:', error);
    return {};
  }
}

// ============================================
// SM-2 QUIZ API
// ============================================

export async function generateQuiz(request: GenerateQuizRequest): Promise<GenerateQuizResponse | null> {
  const uid = requireUid();
  if (!uid) return null;
  try {
    return await generateQuizForUser(uid, request);
  } catch (error) {
    console.error('Error generating quiz:', error);
    return null;
  }
}

export async function submitAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse | null> {
  const uid = requireUid();
  if (!uid) return null;
  try {
    return await submitAnswerForUser(uid, request);
  } catch (error) {
    console.error('Error submitting answer:', error);
    return null;
  }
}

// ============================================
// PROGRESS & STATS API
// ============================================

export interface ProgressResponse {
  progress: Record<string, UserProgress>;
  stats: UserStats;
  dueForReview?: {
    overdue: string[];
    dueToday: string[];
    dueTomorrow: string[];
  };
}

export async function getProgress(): Promise<ProgressResponse> {
  const defaultStats: UserStats = {
    totalAnswered: 0, totalCorrect: 0, totalWrong: 0, totalKnown: 0, totalRemind: 0, topicStats: {},
  };
  const uid = requireUid();
  if (!uid) return { progress: {}, stats: defaultStats };

  try {
    const { progress, stats, dueForReview } = await getAggregatedProgress(uid);
    return {
      progress: toLegacyProgress(progress) as Record<string, UserProgress>,
      stats: toLegacyStats(stats) as UserStats,
      dueForReview,
    };
  } catch (error) {
    console.error('Error fetching progress:', error);
    return { progress: {}, stats: defaultStats };
  }
}

export async function getStats(): Promise<UserStats | null> {
  const { stats } = await getProgress();
  return stats;
}

// ============================================
// LEGACY QUIZ API (for backward compatibility)
// ============================================

export interface FetchQuestionsParams {
  count?: number;
  topic?: string;
  subtopic?: string;
  mode?: string;
}

function mapLegacyModeToQuizType(mode: string): QuizType {
  switch (mode) {
    case 'smart': return 'adaptive';
    case 'wrong': return 'weak_area';
    case 'remind': return 'spaced_review';
    case 'random': return 'random';
    default: return 'adaptive';
  }
}

export async function fetchQuestions(params: FetchQuestionsParams = {}): Promise<Question[]> {
  const { count = 10, topic, subtopic, mode = 'smart' } = params;
  const result = await generateQuiz({ quizType: mapLegacyModeToQuizType(mode), count, topic, subtopic });
  return result?.questions || [];
}

export interface SaveProgressParams {
  questionId: string;
  topic: string;
  subtopic: string;
  status: 'known' | 'remind' | 'wrong';
  answeredCorrectly: boolean;
}

// Progress is saved via submitAnswer; kept as a no-op for backward compatibility.
export async function saveProgress(params: SaveProgressParams): Promise<void> {
  console.log('Legacy saveProgress called, use submitAnswer instead', params);
}

// ============================================
// NOTES API (Firestore)
// ============================================

export interface FetchNotesParams {
  pinned?: boolean;
  quizMe?: boolean;
}

export async function fetchNotes(params: FetchNotesParams = {}): Promise<Note[]> {
  const uid = requireUid();
  if (!uid) return [];
  try {
    let notes = await notesRepo.getAll(uid);
    if (params.pinned !== undefined) notes = notes.filter((n) => n.pinned === params.pinned);
    if (params.quizMe !== undefined) notes = notes.filter((n) => n.quizMe === params.quizMe);
    return notes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

export interface SaveNoteParams {
  noteId?: string;
  title: string;
  content: string;
  color?: string;
  pinned?: boolean;
  quizMe?: boolean;
}

export async function saveNote(params: SaveNoteParams): Promise<Note | null> {
  const uid = requireUid();
  if (!uid) return null;
  try {
    const now = new Date().toISOString();
    const existing = params.noteId ? (await notesRepo.getAll(uid)).find((n) => n.noteId === params.noteId) : undefined;
    const note: Note = {
      noteId: params.noteId || uuidv4(),
      userId: uid,
      title: params.title,
      content: params.content,
      color: params.color ?? existing?.color ?? '#fff8b8',
      pinned: params.pinned ?? existing?.pinned ?? false,
      quizMe: params.quizMe ?? existing?.quizMe ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await notesRepo.save(uid, note);
    return note;
  } catch (error) {
    console.error('Error saving note:', error);
    return null;
  }
}

export async function deleteNote(noteId: string): Promise<boolean> {
  const uid = requireUid();
  if (!uid) return false;
  try {
    await notesRepo.delete(uid, noteId);
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

// Note Questions API — these were generated server-side via an LLM Lambda.
// Without that backend they return empty / no-op, but the shape is preserved.
export interface NoteQuestion {
  questionId: string;
  id: string;
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  noteId: string;
  noteTitle: string;
  generatedAt: string;
  isNoteQuestion: true;
}

export async function fetchNoteQuestions(_count: number = 100, _forQuiz: boolean = false): Promise<NoteQuestion[]> {
  return [];
}

export interface UpdateNoteQuestionParams {
  question?: string;
  options?: Record<string, string>;
  correct_answers?: string[];
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function updateNoteQuestion(_questionId: string, _params: UpdateNoteQuestionParams): Promise<NoteQuestion | null> {
  return null;
}

export async function deleteNoteQuestion(_questionId: string): Promise<boolean> {
  return false;
}

// ============================================
// ANALYTICS API (derived from Firestore progress + sessions)
// ============================================

export interface AnalyticsData {
  overview: {
    totalQuestions: number;
    totalAttempts: number;
    totalCorrect: number;
    overallAccuracy: number;
    totalStudyTimeMs: number;
    avgConfidence: number;
    currentStreak: number;
    longestStreak: number;
  };
  statusCounts: {
    learning: number;
    reviewing: number;
    mastered: number;
    struggling: number;
    new: number;
  };
  dueForReview: {
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
  };
  topicAnalytics: Array<{
    topic: string;
    totalQuestions: number;
    attempted: number;
    mastered: number;
    struggling: number;
    accuracy: number;
    avgConfidence: number;
    lastStudied: string | null;
  }>;
  dailyActivity: Array<{ date: string; attempts: number; correct: number; timeSpentMs: number }>;
  recentSessions: Array<{
    sessionId: string;
    quizType: string;
    topic?: string;
    questionsAnswered: number;
    correctAnswers: number;
    startedAt: string;
  }>;
}

export async function fetchAnalytics(): Promise<AnalyticsData | null> {
  const uid = requireUid();
  if (!uid) return null;
  try {
    const { progress, stats } = await getAggregatedProgress(uid);
    const items = Object.values(progress);
    const sessions = await sessionRepo.recent(uid, 10);

    const topicAnalytics = Object.values(stats.topicStats).map((t) => ({
      topic: t.topic,
      totalQuestions: t.attemptedQuestions,
      attempted: t.attemptedQuestions,
      mastered: t.masteredCount,
      struggling: t.strugglingCount,
      accuracy: t.accuracy,
      avgConfidence: t.averageConfidence,
      lastStudied: t.lastStudiedAt || null,
    }));

    let longestStreak = 0;
    for (const p of items) longestStreak = Math.max(longestStreak, p.longestStreak);

    return {
      overview: {
        totalQuestions: items.length,
        totalAttempts: stats.totalCorrectAnswers + stats.totalWrongAnswers,
        totalCorrect: stats.totalCorrectAnswers,
        overallAccuracy: stats.overallAccuracy,
        totalStudyTimeMs: 0,
        avgConfidence: stats.averageConfidence,
        currentStreak: stats.currentDailyStreak,
        longestStreak,
      },
      statusCounts: {
        learning: stats.learningCount,
        reviewing: stats.reviewingCount,
        mastered: stats.masteredCount,
        struggling: stats.strugglingCount,
        new: 0,
      },
      dueForReview: {
        overdue: stats.overdueCount,
        dueToday: stats.dueToday,
        dueThisWeek: stats.dueThisWeek,
      },
      topicAnalytics,
      dailyActivity: [],
      recentSessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        quizType: s.quizType,
        topic: s.topic,
        questionsAnswered: s.questionsAnswered,
        correctAnswers: s.correctAnswers,
        startedAt: s.startedAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}

// ============================================
// ATTEMPTS & SESSIONS API (Firestore)
// ============================================

export interface AttemptRecord {
  attemptId: string;
  questionId: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  isCorrect: boolean;
  confidenceRating: number;
  responseTimeMs: number;
  selectedAnswers: string[];
  correctAnswers: string[];
  quizType: string;
  attemptedAt: string;
}

export async function fetchAttempts(limit: number = 50, questionId?: string): Promise<AttemptRecord[]> {
  const uid = requireUid();
  if (!uid) return [];
  try {
    const attempts = await attemptRepo.recent(uid, limit, questionId);
    return attempts as unknown as AttemptRecord[];
  } catch (error) {
    console.error('Error fetching attempts:', error);
    return [];
  }
}

export interface SessionRecord {
  sessionId: string;
  quizType: string;
  topic?: string;
  subtopic?: string;
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  startedAt: string;
  completedAt?: string;
  totalTimeMs?: number;
}

export async function fetchSessions(limit: number = 20): Promise<SessionRecord[]> {
  const uid = requireUid();
  if (!uid) return [];
  try {
    const sessions = await sessionRepo.recent(uid, limit);
    return sessions.map((s) => ({
      ...s,
      accuracy: s.questionsAnswered > 0 ? Math.round((s.correctAnswers / s.questionsAnswered) * 100) / 100 : 0,
    }));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

// ============================================
// CUSTOM QUESTIONS API (admin feature — required a server; now no-op)
// ============================================

export interface CustomQuestion {
  questionId: string;
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCustom: true;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCustomQuestions(_topic?: string): Promise<CustomQuestion[]> {
  return [];
}

export interface CreateQuestionParams {
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function createQuestion(_params: CreateQuestionParams): Promise<CustomQuestion | null> {
  return null;
}

export async function updateQuestion(_questionId: string, _params: Partial<CreateQuestionParams>): Promise<CustomQuestion | null> {
  return null;
}

export async function deleteQuestion(_questionId: string): Promise<boolean> {
  return false;
}

// ============================================
// HIDDEN QUESTIONS API (per-user; now no-op without a server index)
// ============================================

export interface HiddenQuestion {
  questionId: string;
  topic: string;
  subtopic: string;
  hiddenAt: string;
  hideReason?: string;
}

export async function fetchHiddenQuestions(): Promise<HiddenQuestion[]> {
  return [];
}

export async function hideQuestion(_questionId: string, _topic?: string, _subtopic?: string, _reason?: string): Promise<boolean> {
  return false;
}

export async function unhideQuestion(_questionId: string): Promise<boolean> {
  return false;
}
