/**
 * Integration Tests for useQuiz Hook
 * Tests quiz generation, answer submission, and state management
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuiz } from '../../../hooks/useQuiz';

// Mock the API module
jest.mock('../../../api', () => ({
  generateQuiz: jest.fn(),
  submitAnswer: jest.fn(),
}));

import * as apiModule from '../../../api';

const mockApi = apiModule as jest.Mocked<typeof apiModule>;

const mockQuestions = [
  {
    id: 'q1',
    topic: 'Core Concepts',
    subtopic: 'CAP Theorem',
    question: 'What does CAP stand for?',
    options: {
      A: 'Consistency, Availability, Partition tolerance',
      B: 'Cache, API, Protocol',
      C: 'Compute, Access, Performance',
      D: 'None of the above',
    },
    correct_answers: ['A'],
    explanation: 'CAP stands for Consistency, Availability, and Partition tolerance.',
    difficulty: 'medium' as const,
  },
  {
    id: 'q2',
    topic: 'Distributed Systems',
    subtopic: 'Consensus',
    question: 'Which algorithm is used for consensus?',
    options: {
      A: 'Bubble Sort',
      B: 'Raft',
      C: 'Quick Sort',
      D: 'Binary Search',
    },
    correct_answers: ['B'],
    explanation: 'Raft is a consensus algorithm.',
    difficulty: 'hard' as const,
  },
];

describe('useQuiz Hook Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should start with empty quiz state', () => {
      const { result } = renderHook(() => useQuiz());
      
      expect(result.current.questions).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.quizState.currentQuestionIndex).toBe(0);
      expect(result.current.quizState.score).toBe(0);
      expect(result.current.sessionId).toBeNull();
    });
  });

  describe('Quiz Generation', () => {
    it('should start adaptive quiz successfully', async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: mockQuestions,
        quizType: 'adaptive',
        estimatedTimeMinutes: 10,
        metadata: {
          overdueCount: 0,
          newCount: 2,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 1 },
        },
      });

      const { result } = renderHook(() => useQuiz());
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.startQuiz('adaptive');
      });
      
      expect(success).toBe(true);
      expect(result.current.questions).toHaveLength(2);
      expect(result.current.sessionId).toBe('session-123');
      expect(result.current.currentQuestion?.id).toBe('q1');
    });

    it('should start topic-focused quiz', async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-456',
        questions: [mockQuestions[0]],
        quizType: 'topic_focused',
        estimatedTimeMinutes: 5,
        metadata: {
          overdueCount: 0,
          newCount: 1,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 0 },
        },
      });

      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('topic_focused', 'Core Concepts', 'CAP Theorem');
      });
      
      expect(mockApi.generateQuiz).toHaveBeenCalledWith({
        quizType: 'topic_focused',
        count: 10,
        topic: 'Core Concepts',
        subtopic: 'CAP Theorem',
      });
      expect(result.current.currentFilter).toEqual({
        topic: 'Core Concepts',
        subtopic: 'CAP Theorem',
      });
    });

    it('should handle empty quiz response', async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: '',
        questions: [],
        quizType: 'adaptive',
        estimatedTimeMinutes: 0,
        metadata: {
          overdueCount: 0,
          newCount: 0,
          reviewCount: 0,
          difficultyDistribution: {},
        },
      });

      const { result } = renderHook(() => useQuiz());
      
      let success: boolean = true;
      await act(async () => {
        success = await result.current.startQuiz('adaptive');
      });
      
      expect(success).toBe(false);
      expect(result.current.questions).toEqual([]);
    });

    it('should handle API error gracefully', async () => {
      mockApi.generateQuiz.mockResolvedValue(null);

      const { result } = renderHook(() => useQuiz());
      
      let success: boolean = true;
      await act(async () => {
        success = await result.current.startQuiz('adaptive');
      });
      
      expect(success).toBe(false);
    });

  });

  describe('Answer Selection', () => {
    beforeEach(async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: mockQuestions,
        quizType: 'adaptive',
        estimatedTimeMinutes: 10,
        metadata: {
          overdueCount: 0,
          newCount: 2,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 1 },
        },
      });
    });

    it('should select single answer for single-choice question', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      act(() => {
        result.current.handleAnswerSelect('A');
      });
      
      expect(result.current.quizState.selectedAnswers).toEqual(['A']);
      
      // Selecting another should replace
      act(() => {
        result.current.handleAnswerSelect('B');
      });
      
      expect(result.current.quizState.selectedAnswers).toEqual(['B']);
    });

    it('should not allow selection after showing result', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      act(() => {
        result.current.handleAnswerSelect('A');
      });
      
      act(() => {
        result.current.submitAnswer();
      });
      
      // Try to change answer after submission
      act(() => {
        result.current.handleAnswerSelect('B');
      });
      
      // Should still be 'A'
      expect(result.current.quizState.selectedAnswers).toEqual(['A']);
    });
  });

  describe('Answer Submission', () => {
    beforeEach(async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: mockQuestions,
        quizType: 'adaptive',
        estimatedTimeMinutes: 10,
        metadata: {
          overdueCount: 0,
          newCount: 2,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 1 },
        },
      });
    });

    it('should submit correct answer and update score', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      act(() => {
        result.current.handleAnswerSelect('A'); // Correct answer
      });
      
      act(() => {
        result.current.submitAnswer();
      });
      
      expect(result.current.quizState.showResult).toBe(true);
      expect(result.current.quizState.score).toBe(1);
      expect(result.current.showExplanation).toBe(true);
    });

    it('should submit incorrect answer without updating score', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      act(() => {
        result.current.handleAnswerSelect('B'); // Wrong answer
      });
      
      act(() => {
        result.current.submitAnswer();
      });
      
      expect(result.current.quizState.showResult).toBe(true);
      expect(result.current.quizState.score).toBe(0);
    });

    it('should submit with confidence rating', async () => {
      mockApi.submitAnswer.mockResolvedValue({
        isCorrect: true,
        correctAnswers: ['A'],
        explanation: 'CAP stands for...',
        nextReviewDate: '2026-02-15',
        newInterval: 3,
        newEaseFactor: 2.5,
        newStatus: 'reviewing',
        streakUpdate: { currentStreak: 1, isNewRecord: false },
      });

      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      act(() => {
        result.current.handleAnswerSelect('A');
      });
      
      await act(async () => {
        await result.current.submitAnswerWithConfidence(5);
      });
      
      expect(mockApi.submitAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          questionId: 'q1',
          selectedAnswers: ['A'],
          confidenceRating: 5,
        })
      );
    });
  });

  describe('Quiz Navigation', () => {
    beforeEach(async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: mockQuestions,
        quizType: 'adaptive',
        estimatedTimeMinutes: 10,
        metadata: {
          overdueCount: 0,
          newCount: 2,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 1 },
        },
      });
    });

    it('should navigate to next question', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      // Answer first question
      act(() => {
        result.current.handleAnswerSelect('A');
        result.current.submitAnswer();
      });
      
      // Go to next
      let quizEnded: boolean = true;
      act(() => {
        quizEnded = result.current.nextQuestion();
      });
      
      expect(quizEnded).toBe(false);
      expect(result.current.quizState.currentQuestionIndex).toBe(1);
      expect(result.current.currentQuestion?.id).toBe('q2');
      expect(result.current.quizState.selectedAnswers).toEqual([]);
      expect(result.current.quizState.showResult).toBe(false);
    });

    it('should return true when quiz ends', async () => {
      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      // Answer first question
      act(() => {
        result.current.handleAnswerSelect('A');
        result.current.submitAnswer();
      });
      
      act(() => {
        result.current.nextQuestion();
      });
      
      // Answer second question
      act(() => {
        result.current.handleAnswerSelect('B');
        result.current.submitAnswer();
      });
      
      // Try to go to next (should end quiz)
      let quizEnded: boolean = false;
      act(() => {
        quizEnded = result.current.nextQuestion();
      });
      
      expect(quizEnded).toBe(true);
    });
  });

  describe('Quiz Reset', () => {
    it('should reset quiz state', async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: mockQuestions,
        quizType: 'adaptive',
        estimatedTimeMinutes: 10,
        metadata: {
          overdueCount: 0,
          newCount: 2,
          reviewCount: 0,
          difficultyDistribution: { easy: 0, medium: 1, hard: 1 },
        },
      });

      const { result } = renderHook(() => useQuiz());
      
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });
      
      expect(result.current.questions).toHaveLength(2);
      
      act(() => {
        result.current.resetQuiz();
      });
      
      expect(result.current.questions).toEqual([]);
      expect(result.current.sessionId).toBeNull();
      expect(result.current.quizState.score).toBe(0);
      expect(result.current.currentFilter).toEqual({});
    });
  });
});
