import { useState, useCallback, useRef } from 'react';
import { Question, QuizState, UserProgress, QuizMode, QuizType, GenerateQuizResponse } from '../types';
import { generateQuiz, submitAnswer, fetchNoteQuestions } from '../api';
import { QUESTIONS_PER_QUIZ } from '../constants';

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
  sessionId: string | null;
  quizMetadata: GenerateQuizResponse['metadata'] | null;
  questionStartTime: number;
  startQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => Promise<boolean>;
  handleAnswerSelect: (letter: string) => void;
  submitAnswerWithConfidence: (confidenceRating: number) => Promise<void>;
  submitAnswer: () => void;
  nextQuestion: () => boolean;
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

// Map legacy modes to new quiz types
function mapModeToQuizType(mode: QuizMode): QuizType {
  switch (mode) {
    case 'smart': return 'adaptive';
    case 'wrong': return 'weak_area';
    case 'remind': return 'spaced_review';
    case 'random': return 'random';
    case 'adaptive':
    case 'spaced_review':
    case 'topic_focused':
    case 'weak_area':
    case 'exam_prep':
      return mode;
    default: return 'adaptive';
  }
}

export function useQuiz(): UseQuizReturn {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>(initialQuizState);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<QuizFilter>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quizMetadata, setQuizMetadata] = useState<GenerateQuizResponse['metadata'] | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const isMultiSelect = currentQuestion?.correct_answers.length > 1;

  const startQuiz = useCallback(async (mode: QuizMode, topic?: string, subtopic?: string): Promise<boolean> => {
    setLoading(true);
    try {
      let qs: Question[];
      let newSessionId: string | null = null;
      let metadata: GenerateQuizResponse['metadata'] | null = null;
      
      if (mode === 'notes') {
        // Fetch questions generated from user notes
        qs = await fetchNoteQuestions(QUESTIONS_PER_QUIZ, true);
      } else {
        // Use new SM-2 quiz generation
        const quizType = mapModeToQuizType(mode);
        const result = await generateQuiz({
          quizType,
          count: QUESTIONS_PER_QUIZ,
          topic,
          subtopic,
        });
        
        if (!result || result.questions.length === 0) {
          return false;
        }
        
        qs = result.questions;
        newSessionId = result.sessionId;
        metadata = result.metadata;
      }
      
      if (qs.length === 0) {
        return false;
      }
      
      setQuestions(qs);
      setSessionId(newSessionId);
      setQuizMetadata(metadata);
      setCurrentFilter({ topic, subtopic });
      setQuizState(initialQuizState);
      setShowExplanation(false);
      questionStartTimeRef.current = Date.now();
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

  // New SM-2 submit with confidence rating
  const submitAnswerWithConfidence = useCallback(async (confidenceRating: number) => {
    if (!currentQuestion || !sessionId) return;
    
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    const selected = quizState.selectedAnswers;
    
    // Submit to backend
    const result = await submitAnswer({
      sessionId,
      questionId: currentQuestion.id,
      selectedAnswers: selected,
      confidenceRating,
      responseTimeMs,
    });
    
    const isCorrect = result?.isCorrect ?? 
      (currentQuestion.correct_answers.length === selected.length && 
       currentQuestion.correct_answers.every(c => selected.includes(c)));
    
    setQuizState(prev => ({
      ...prev,
      showResult: true,
      score: isCorrect ? prev.score + 1 : prev.score,
      answers: [...prev.answers, { questionId: currentQuestion.id, selected, correct: isCorrect }],
    }));
    setShowExplanation(true);
  }, [currentQuestion, sessionId, quizState.selectedAnswers]);

  // Legacy submit (for backward compatibility)
  const submitAnswerLegacy = useCallback(() => {
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
      questionStartTimeRef.current = Date.now();
      return false;
    }
    return true; // Quiz ended
  }, [quizState.currentQuestionIndex, questions.length]);

  // Legacy progress mark (now integrated with confidence rating)
  const handleProgressMark = useCallback((
    status: 'remind' | 'known',
    userProgress: Record<string, UserProgress>,
    setUserProgress: React.Dispatch<React.SetStateAction<Record<string, UserProgress>>>
  ) => {
    if (!currentQuestion) return;
    
    const isCorrect = quizState.answers[quizState.answers.length - 1]?.correct || false;
    
    // Map status to confidence rating for SM-2
    // known = 5 (perfect recall), remind = 3 (correct with difficulty)
    const confidenceRating = status === 'known' ? 5 : 3;
    
    // If we have a session, submit with confidence
    if (sessionId) {
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      submitAnswer({
        sessionId,
        questionId: currentQuestion.id,
        selectedAnswers: quizState.selectedAnswers,
        confidenceRating: isCorrect ? confidenceRating : 1, // 1 = wrong but recognized
        responseTimeMs,
      }).catch(err => console.error('Background submit failed:', err));
    }

    // Update local state immediately
    const finalStatus = !isCorrect ? 'wrong' : status;
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
  }, [currentQuestion, quizState.answers, quizState.selectedAnswers, sessionId]);

  const resetQuiz = useCallback(() => {
    setQuestions([]);
    setQuizState(initialQuizState);
    setShowExplanation(false);
    setCurrentFilter({});
    setSessionId(null);
    setQuizMetadata(null);
  }, []);

  return {
    questions,
    quizState,
    loading,
    showExplanation,
    currentFilter,
    currentQuestion,
    isMultiSelect,
    sessionId,
    quizMetadata,
    questionStartTime: questionStartTimeRef.current,
    startQuiz,
    handleAnswerSelect,
    submitAnswerWithConfidence,
    submitAnswer: submitAnswerLegacy,
    nextQuestion,
    handleProgressMark,
    resetQuiz,
  };
}
