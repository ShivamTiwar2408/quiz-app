import { 
  Question, UserProgress, UserStats, TopicsMap, Note,
  GenerateQuizRequest, GenerateQuizResponse, 
  SubmitAnswerRequest, SubmitAnswerResponse,
  QuizType
} from './types';
import { getIdToken, refreshTokens } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getIdToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { ...options.headers, Authorization: token };
  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const newTokens = await refreshTokens();
    if (newTokens) {
      headers.Authorization = newTokens.idToken;
      response = await fetch(url, { ...options, headers });
    }
  }
  return response;
}

// ============================================
// TOPICS API
// ============================================

export async function fetchTopics(): Promise<TopicsMap> {
  if (!API_BASE_URL) return {};
  try {
    const response = await authFetch(`${API_BASE_URL}/topics`);
    if (!response.ok) throw new Error('Failed to fetch topics');
    const data = await response.json();
    return data.topics;
  } catch (error) {
    console.error('Error fetching topics:', error);
    return {};
  }
}

// ============================================
// SM-2 QUIZ API
// ============================================

export async function generateQuiz(request: GenerateQuizRequest): Promise<GenerateQuizResponse | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/quiz/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to generate quiz');
    return await response.json();
  } catch (error) {
    console.error('Error generating quiz:', error);
    return null;
  }
}

export async function submitAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to submit answer');
    return await response.json();
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
  if (!API_BASE_URL) return { progress: {}, stats: defaultStats };

  try {
    const response = await authFetch(`${API_BASE_URL}/progress`);
    if (!response.ok) throw new Error('Failed to fetch progress');
    const data = await response.json();
    return { 
      progress: data.progress || {}, 
      stats: data.stats || defaultStats,
      dueForReview: data.dueForReview,
    };
  } catch (error) {
    console.error('Error fetching progress:', error);
    return { progress: {}, stats: defaultStats };
  }
}

export async function getStats(): Promise<UserStats | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
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

// Maps legacy modes to new quiz types
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
  
  // Use new SM-2 API
  const quizType = mapLegacyModeToQuizType(mode);
  const result = await generateQuiz({
    quizType,
    count,
    topic,
    subtopic,
  });
  
  return result?.questions || [];
}

export interface SaveProgressParams {
  questionId: string;
  topic: string;
  subtopic: string;
  status: 'known' | 'remind' | 'wrong';
  answeredCorrectly: boolean;
}

// Legacy save progress - now handled by submitAnswer
export async function saveProgress(params: SaveProgressParams): Promise<void> {
  // This is now a no-op as progress is saved via submitAnswer
  // Kept for backward compatibility
  console.log('Legacy saveProgress called, use submitAnswer instead', params);
}

// ============================================
// NOTES API
// ============================================

export interface FetchNotesParams {
  pinned?: boolean;
  quizMe?: boolean;
}

export async function fetchNotes(params: FetchNotesParams = {}): Promise<Note[]> {
  if (!API_BASE_URL) return [];
  try {
    const queryParams = new URLSearchParams();
    if (params.pinned !== undefined) queryParams.set('pinned', String(params.pinned));
    if (params.quizMe !== undefined) queryParams.set('quizMe', String(params.quizMe));
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/notes?${queryParams}` 
      : `${API_BASE_URL}/notes`;
    
    const response = await authFetch(url);
    if (!response.ok) throw new Error('Failed to fetch notes');
    const data = await response.json();
    return data.notes || [];
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
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to save note');
    const data = await response.json();
    return data.note;
  } catch (error) {
    console.error('Error saving note:', error);
    return null;
  }
}

export async function deleteNote(noteId: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  try {
    const response = await authFetch(`${API_BASE_URL}/notes/${noteId}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

// Note Questions API - Questions generated from user notes
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

export async function fetchNoteQuestions(count: number = 100, forQuiz: boolean = false): Promise<NoteQuestion[]> {
  if (!API_BASE_URL) return [];
  try {
    const params = new URLSearchParams({ count: String(count) });
    if (forQuiz) params.set('forQuiz', 'true');
    const response = await authFetch(`${API_BASE_URL}/note-questions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch note questions');
    const data = await response.json();
    return data.questions || [];
  } catch (error) {
    console.error('Error fetching note questions:', error);
    return [];
  }
}

export interface UpdateNoteQuestionParams {
  question?: string;
  options?: Record<string, string>;
  correct_answers?: string[];
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function updateNoteQuestion(questionId: string, params: UpdateNoteQuestionParams): Promise<NoteQuestion | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/note-questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to update note question');
    const data = await response.json();
    return data.question;
  } catch (error) {
    console.error('Error updating note question:', error);
    return null;
  }
}

export async function deleteNoteQuestion(questionId: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  try {
    const response = await authFetch(`${API_BASE_URL}/note-questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting note question:', error);
    return false;
  }
}

// ============================================
// ANALYTICS API
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
  dailyActivity: Array<{
    date: string;
    attempts: number;
    correct: number;
    timeSpentMs: number;
  }>;
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
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return await response.json();
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}

// ============================================
// ATTEMPTS & SESSIONS API
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
  if (!API_BASE_URL) return [];
  try {
    let url = `${API_BASE_URL}/attempts?limit=${limit}`;
    if (questionId) url += `&questionId=${encodeURIComponent(questionId)}`;
    const response = await authFetch(url);
    if (!response.ok) throw new Error('Failed to fetch attempts');
    const data = await response.json();
    return data.attempts || [];
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
  if (!API_BASE_URL) return [];
  try {
    const response = await authFetch(`${API_BASE_URL}/sessions?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

// ============================================
// CUSTOM QUESTIONS API
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

export async function fetchCustomQuestions(topic?: string): Promise<CustomQuestion[]> {
  if (!API_BASE_URL) return [];
  try {
    let url = `${API_BASE_URL}/questions`;
    if (topic) url += `?topic=${encodeURIComponent(topic)}`;
    const response = await authFetch(url);
    if (!response.ok) throw new Error('Failed to fetch custom questions');
    const data = await response.json();
    return data.questions || [];
  } catch (error) {
    console.error('Error fetching custom questions:', error);
    return [];
  }
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

export async function createQuestion(params: CreateQuestionParams): Promise<CustomQuestion | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create question');
    }
    const data = await response.json();
    return data.question;
  } catch (error) {
    console.error('Error creating question:', error);
    throw error;
  }
}

export async function updateQuestion(questionId: string, params: Partial<CreateQuestionParams>): Promise<CustomQuestion | null> {
  if (!API_BASE_URL) return null;
  try {
    const response = await authFetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to update question');
    const data = await response.json();
    return data.question;
  } catch (error) {
    console.error('Error updating question:', error);
    return null;
  }
}

export async function deleteQuestion(questionId: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  try {
    const response = await authFetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting question:', error);
    return false;
  }
}

// ============================================
// HIDDEN QUESTIONS API
// ============================================

export interface HiddenQuestion {
  questionId: string;
  topic: string;
  subtopic: string;
  hiddenAt: string;
  hideReason?: string;
}

export async function fetchHiddenQuestions(): Promise<HiddenQuestion[]> {
  if (!API_BASE_URL) return [];
  try {
    const response = await authFetch(`${API_BASE_URL}/hidden-questions`);
    if (!response.ok) throw new Error('Failed to fetch hidden questions');
    const data = await response.json();
    return data.hiddenQuestions || [];
  } catch (error) {
    console.error('Error fetching hidden questions:', error);
    return [];
  }
}

export async function hideQuestion(questionId: string, topic?: string, subtopic?: string, reason?: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  try {
    const response = await authFetch(`${API_BASE_URL}/hidden-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, topic, subtopic, reason }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error hiding question:', error);
    return false;
  }
}

export async function unhideQuestion(questionId: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  try {
    const response = await authFetch(`${API_BASE_URL}/hidden-questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error unhiding question:', error);
    return false;
  }
}
