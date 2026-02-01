import { Question, UserProgress, UserStats, TopicsMap, QuizMode } from './types';
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
