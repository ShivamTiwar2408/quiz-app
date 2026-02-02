import { Question, UserProgress, UserStats, TopicsMap, QuizMode, Note } from './types';
import { getIdToken, refreshTokens } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getIdToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { ...options.headers, Authorization: token };
  let response = await fetch(url, { ...options, headers });

  // If unauthorized, try refreshing token
  if (response.status === 401) {
    const newTokens = await refreshTokens();
    if (newTokens) {
      headers.Authorization = newTokens.idToken;
      response = await fetch(url, { ...options, headers });
    }
  }
  return response;
}

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

export interface FetchQuestionsParams {
  count?: number;
  topic?: string;
  subtopic?: string;
  mode?: QuizMode;
}

export async function fetchQuestions(params: FetchQuestionsParams = {}): Promise<Question[]> {
  const { count = 10, topic, subtopic, mode = 'smart' } = params;
  if (!API_BASE_URL) return [];

  try {
    const queryParams = new URLSearchParams({ count: count.toString(), mode });
    if (topic) queryParams.set('topic', topic);
    if (subtopic) queryParams.set('subtopic', subtopic);

    const response = await authFetch(`${API_BASE_URL}/questions?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch questions');
    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}

export interface SaveProgressParams {
  questionId: string;
  topic: string;
  subtopic: string;
  status: 'known' | 'remind' | 'wrong';
  answeredCorrectly: boolean;
}

export async function saveProgress(params: SaveProgressParams): Promise<void> {
  if (!API_BASE_URL) return;
  try {
    await authFetch(`${API_BASE_URL}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

export interface ProgressResponse {
  progress: Record<string, UserProgress>;
  stats: UserStats;
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
    return { progress: data.progress || {}, stats: data.stats || defaultStats };
  } catch (error) {
    console.error('Error fetching progress:', error);
    return { progress: {}, stats: defaultStats };
  }
}

// Notes API
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
export async function fetchNoteQuestions(count: number = 10): Promise<Question[]> {
  if (!API_BASE_URL) return [];
  try {
    const response = await authFetch(`${API_BASE_URL}/note-questions?count=${count}`);
    if (!response.ok) throw new Error('Failed to fetch note questions');
    const data = await response.json();
    return data.questions || [];
  } catch (error) {
    console.error('Error fetching note questions:', error);
    return [];
  }
}
