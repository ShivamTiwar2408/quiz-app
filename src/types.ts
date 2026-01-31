export interface Question {
  id: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: string;
  category: string;
}

export interface UserProgress {
  questionId: string;
  status: 'remind' | 'known' | null;
  answeredCorrectly: boolean;
}

export interface QuizState {
  currentQuestionIndex: number;
  selectedAnswers: string[];
  showResult: boolean;
  score: number;
  answers: { questionId: string; selected: string[]; correct: boolean }[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
