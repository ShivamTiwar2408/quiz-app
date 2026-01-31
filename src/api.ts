import { Question, UserProgress } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

function getUserId(): string {
  let userId = localStorage.getItem('quizUserId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('quizUserId', userId);
  }
  return userId;
}

export async function fetchQuestions(count: number = 10): Promise<Question[]> {
  try {
    if (!API_BASE_URL) {
      // Fallback to local questions if no API configured
      const localQuestions = await import('./questions.json');
      return shuffleArray(localQuestions.default as Question[]).slice(0, count);
    }

    const response = await fetch(`${API_BASE_URL}/questions?count=${count}`, {
      headers: {
        'X-User-Id': getUserId(),
      },
    });

    if (!response.ok) throw new Error('Failed to fetch questions');
    
    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Error fetching questions:', error);
    // Fallback to local questions
    const localQuestions = await import('./questions.json');
    return shuffleArray(localQuestions.default as Question[]).slice(0, count);
  }
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  if (!API_BASE_URL) {
    // Save to localStorage if no API
    const saved = localStorage.getItem('quizProgress');
    const existing = saved ? JSON.parse(saved) : {};
    existing[progress.questionId] = progress;
    localStorage.setItem('quizProgress', JSON.stringify(existing));
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId(),
      },
      body: JSON.stringify(progress),
    });
  } catch (error) {
    console.error('Error saving progress:', error);
    // Fallback to localStorage
    const saved = localStorage.getItem('quizProgress');
    const existing = saved ? JSON.parse(saved) : {};
    existing[progress.questionId] = progress;
    localStorage.setItem('quizProgress', JSON.stringify(existing));
  }
}

export async function getProgress(): Promise<Record<string, UserProgress>> {
  if (!API_BASE_URL) {
    const saved = localStorage.getItem('quizProgress');
    return saved ? JSON.parse(saved) : {};
  }

  try {
    const response = await fetch(`${API_BASE_URL}/progress`, {
      headers: {
        'X-User-Id': getUserId(),
      },
    });

    if (!response.ok) throw new Error('Failed to fetch progress');
    
    const data = await response.json();
    return data.progress || {};
  } catch (error) {
    console.error('Error fetching progress:', error);
    const saved = localStorage.getItem('quizProgress');
    return saved ? JSON.parse(saved) : {};
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
