import { useState, useCallback } from 'react';
import { Question, QuizState, UserProgress, QuizMode } from '../types';
import { fetchQuestions, fetchNoteQuestions, saveProgress } from '../api';
import { QUESTIONS_PER_QUIZ, PROGRESS_STATUS } from '../constants';

export interface QuizFilter {
  topic?: string;
  subtopic?: string;
}

export interface UseQuizReturn {
  questions: Question[];
  quizState: QuizState;
  loading: boolean;
  showExplanation: boolean;
  currentFilter: QuizFilter;
  currentQuestion: Question | undefined;
  isMultiSelect: boolean;
  startQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => Promise<boolean>;
  handleAnswerSelect: (letter: string) => void;
  submitAnswer: () => void;
  nextQuestion: () => boolean; // returns true if quiz ended
  handleProgressMark: (
    status: 'remind' | 'known',
    userProgress: Record<string, UserProgress>,
    setUserProgress: React.Dispatch<React.SetStateAction<Record<string, UserProgress>>>
  ) => void;
  resetQuiz: () => void;
}

const initialQuizState: QuizState = {
  currentQuestionIndex: 0,
  selectedAnswers: [],
  showResult: false,
  score: 0,
  answers: [],
};

export function useQuiz(): UseQuizReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>(initialQuizState);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<QuizFilter>({});

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const isMultiSelect = currentQuestion?.correct_answers.length > 1;

  const startQuiz = useCallback(async (mode: QuizMode, topic?: string, subtopic?: string): Promise<boolean> => {
    setLoading(true);
    try {
      let qs: Question[];
      
      if (mode === 'notes') {
        // Fetch questions generated from user notes
        qs = await fetchNoteQuestions(QUESTIONS_PER_QUIZ);
      } else {
        qs = await fetchQuestions({ count: QUESTIONS_PER_QUIZ, topic, subtopic, mode });
      }
      
      if (qs.length === 0) {
        return false;
      }
      setQuestions(qs);
      setCurrentFilter({ topic, subtopic });
      setQuizState(initialQuizState);
      setShowExplanation(false);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnswerSelect = useCallback((letter: string) => {
    if (quizState.showResult) return;
    
    setQuizState(prev => {
      if (isMultiSelect) {
        const newSelected = prev.selectedAnswers.includes(letter)
          ? prev.selectedAnswers.filter(a => a !== letter)
          : [...prev.selectedAnswers, letter];
        return { ...prev, selectedAnswers: newSelected };
      }
      return { ...prev, selectedAnswers: [letter] };
    });
  }, [quizState.showResult, isMultiSelect]);

  const submitAnswer = useCallback(() => {
    if (!currentQuestion) return;
    
    const correct = currentQuestion.correct_answers;
    const selected = quizState.selectedAnswers;
    const isCorrect = correct.length === selected.length && correct.every(c => selected.includes(c));
    
    setQuizState(prev => ({
      ...prev,
      showResult: true,
      score: isCorrect ? prev.score + 1 : prev.score,
      answers: [...prev.answers, { questionId: currentQuestion.id, selected, correct: isCorrect }],
    }));
    setShowExplanation(true);
  }, [currentQuestion, quizState.selectedAnswers]);

  const nextQuestion = useCallback((): boolean => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        selectedAnswers: [],
        showResult: false,
      }));
      setShowExplanation(false);
      return false;
    }
    return true; // Quiz ended
  }, [quizState.currentQuestionIndex, questions.length]);

  const handleProgressMark = useCallback((
    status: 'remind' | 'known',
    userProgress: Record<string, UserProgress>,
    setUserProgress: React.Dispatch<React.SetStateAction<Record<string, UserProgress>>>
  ) => {
    if (!currentQuestion) return;
    
    const isCorrect = quizState.answers[quizState.answers.length - 1]?.correct || false;
    const finalStatus = !isCorrect ? PROGRESS_STATUS.WRONG : status;

    // Fire-and-forget - don't await, let it run in background
    saveProgress({
      questionId: currentQuestion.id,
      topic: currentQuestion.topic,
      subtopic: currentQuestion.subtopic,
      status: finalStatus,
      answeredCorrectly: isCorrect,
    }).catch(err => console.error('Background save failed:', err));

    // Update local state immediately
    setUserProgress(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        questionId: currentQuestion.id,
        status: finalStatus,
        answeredCorrectly: isCorrect,
        wrongCount: (prev[currentQuestion.id]?.wrongCount || 0) + (!isCorrect ? 1 : 0),
        correctCount: (prev[currentQuestion.id]?.correctCount || 0) + (isCorrect ? 1 : 0),
        remindCount: (prev[currentQuestion.id]?.remindCount || 0) + (status === 'remind' ? 1 : 0),
        knownCount: (prev[currentQuestion.id]?.knownCount || 0) + (status === 'known' ? 1 : 0),
      },
    }));
  }, [currentQuestion, quizState.answers]);

  const resetQuiz = useCallback(() => {
    setQuestions([]);
    setQuizState(initialQuizState);
    setShowExplanation(false);
    setCurrentFilter({});
  }, []);

  return {
    questions,
    quizState,
    loading,
    showExplanation,
    currentFilter,
    currentQuestion,
    isMultiSelect,
    startQuiz,
    handleAnswerSelect,
    submitAnswer,
    nextQuestion,
    handleProgressMark,
    resetQuiz,
  };
}
