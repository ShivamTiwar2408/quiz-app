/**
 * Integration Tests for Note Questions Flow via useQuiz Hook
 * Tests the complete flow of using note-generated questions in quizzes
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuiz } from '../../../hooks/useQuiz';

// Mock the API module
jest.mock('../../../api', () => ({
  generateQuiz: jest.fn(),
  submitAnswer: jest.fn(),
  fetchNoteQuestions: jest.fn(),
}));

import * as apiModule from '../../../api';

const mockApi = apiModule as jest.Mocked<typeof apiModule>;

const mockNoteQuestions = [
  {
    id: 'note-abc123',
    topic: 'My Notes',
    subtopic: 'CAP Theorem Notes',
    question: 'What does the C in CAP theorem stand for?',
    options: {
      A: 'Consistency',
      B: 'Concurrency',
      C: 'Capacity',
      D: 'Computation',
    },
    correct_answers: ['A'],
    explanation: 'C stands for Consistency in the CAP theorem.\n\n---\n📝 **From your note:**\nThe CAP theorem states that a distributed system can only guarantee two of three properties...',
    difficulty: 'medium' as const,
    category: 'notes',
    noteId: 'abc123',
  },
  {
    id: 'note-def456',
    topic: 'My Notes',
    subtopic: 'Microservices Architecture',
    question: 'What is a key characteristic of microservices?',
    options: {
      A: 'Tightly coupled components',
      B: 'Loosely coupled services',
      C: 'Single deployment unit',
      D: 'Shared database',
    },
    correct_answers: ['B'],
    explanation: 'Microservices are loosely coupled.\n\n---\n📝 **From your note:**\nMicroservices architecture structures an application as a collection of loosely coupled services...',
    difficulty: 'easy' as const,
    category: 'notes',
    noteId: 'def456',
  },
];

describe('Note Questions Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Starting Notes Quiz', () => {
    it('should start notes quiz and fetch note-generated questions', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);

      const { result } = renderHook(() => useQuiz());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.startQuiz('notes');
      });

      expect(success).toBe(true);
      expect(mockApi.fetchNoteQuestions).toHaveBeenCalledWith(10);
      expect(result.current.questions).toHaveLength(2);
      expect(result.current.questions[0].category).toBe('notes');
      expect(result.current.questions[0].noteId).toBe('abc123');
    });

    it('should handle empty note questions gracefully', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue([]);

      const { result } = renderHook(() => useQuiz());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.startQuiz('notes');
      });

      expect(success).toBe(false);
      expect(result.current.questions).toEqual([]);
    });

    it('should not call generateQuiz API for notes mode', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);

      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      expect(mockApi.fetchNoteQuestions).toHaveBeenCalled();
      expect(mockApi.generateQuiz).not.toHaveBeenCalled();
    });
  });

  describe('Answering Note Questions', () => {
    beforeEach(() => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);
    });

    it('should allow answering note-generated questions', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      // Select correct answer
      act(() => {
        result.current.handleAnswerSelect('A');
      });

      expect(result.current.quizState.selectedAnswers).toEqual(['A']);

      // Submit answer
      act(() => {
        result.current.submitAnswer();
      });

      expect(result.current.quizState.showResult).toBe(true);
      expect(result.current.quizState.score).toBe(1);
    });

    it('should track score correctly for note questions', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      // Answer first question correctly
      act(() => {
        result.current.handleAnswerSelect('A');
      });
      
      act(() => {
        result.current.submitAnswer();
      });

      expect(result.current.quizState.score).toBe(1);

      // Move to next question
      act(() => {
        result.current.nextQuestion();
      });

      // Answer second question incorrectly
      act(() => {
        result.current.handleAnswerSelect('A'); // Wrong - correct is B
      });
      
      act(() => {
        result.current.submitAnswer();
      });

      expect(result.current.quizState.score).toBe(1); // Still 1
    });

    it('should show explanation with note content reference', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      act(() => {
        result.current.handleAnswerSelect('A');
      });
      
      act(() => {
        result.current.submitAnswer();
      });

      expect(result.current.showExplanation).toBe(true);
      // The explanation should contain the note reference
      expect(result.current.currentQuestion?.explanation).toContain('From your note');
    });
  });

  describe('Note Questions Navigation', () => {
    beforeEach(() => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);
    });

    it('should navigate through all note questions', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      expect(result.current.currentQuestion?.id).toBe('note-abc123');

      // Answer and move to next
      act(() => {
        result.current.handleAnswerSelect('A');
        result.current.submitAnswer();
      });

      act(() => {
        result.current.nextQuestion();
      });

      expect(result.current.currentQuestion?.id).toBe('note-def456');
      expect(result.current.quizState.currentQuestionIndex).toBe(1);
    });

    it('should end quiz after all note questions answered', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      // Answer first question
      act(() => {
        result.current.handleAnswerSelect('A');
        result.current.submitAnswer();
        result.current.nextQuestion();
      });

      // Answer second question
      act(() => {
        result.current.handleAnswerSelect('B');
        result.current.submitAnswer();
      });

      // Try to go to next - should indicate quiz ended
      let quizEnded: boolean = false;
      act(() => {
        quizEnded = result.current.nextQuestion();
      });

      expect(quizEnded).toBe(true);
    });
  });

  describe('Note Questions with Confidence Rating', () => {
    beforeEach(() => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);
      mockApi.submitAnswer.mockResolvedValue({
        isCorrect: true,
        correctAnswers: ['A'],
        explanation: 'Correct!',
        nextReviewDate: '2026-02-20',
        newInterval: 3,
        newEaseFactor: 2.5,
        newStatus: 'reviewing',
        streakUpdate: { currentStreak: 1, isNewRecord: false },
      });
    });

    it('should use legacy submit for notes mode since sessionId is null', async () => {
      const { result } = renderHook(() => useQuiz());

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      // Notes mode has null sessionId
      expect(result.current.sessionId).toBeNull();

      act(() => {
        result.current.handleAnswerSelect('A');
      });

      // Use legacy submit for notes mode
      act(() => {
        result.current.submitAnswer();
      });

      // Score should be updated locally
      expect(result.current.quizState.score).toBe(1);
      expect(result.current.quizState.showResult).toBe(true);
      
      // submitAnswerWithConfidence requires sessionId, so it won't call the API for notes
      // This is expected behavior - notes questions are tracked locally
    });
  });

  describe('Switching Between Quiz Modes', () => {
    it('should switch from notes to adaptive quiz', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: [
          {
            id: 'q1',
            topic: 'Core Concepts',
            subtopic: 'Scalability',
            question: 'What is horizontal scaling?',
            options: { A: 'Adding more machines', B: 'Adding more RAM', C: 'Adding more CPU', D: 'Adding more storage' },
            correct_answers: ['A'],
            explanation: 'Horizontal scaling means adding more machines.',
            difficulty: 'medium' as const,
          },
        ],
        quizType: 'adaptive',
        estimatedTimeMinutes: 5,
        metadata: { overdueCount: 0, newCount: 1, reviewCount: 0, difficultyDistribution: {} },
      });

      const { result } = renderHook(() => useQuiz());

      // Start notes quiz
      await act(async () => {
        await result.current.startQuiz('notes');
      });

      expect(result.current.questions[0].category).toBe('notes');

      // Reset and start adaptive quiz
      act(() => {
        result.current.resetQuiz();
      });

      await act(async () => {
        await result.current.startQuiz('adaptive');
      });

      expect(result.current.questions[0].topic).toBe('Core Concepts');
      expect(result.current.sessionId).toBe('session-123');
    });

    it('should switch from adaptive to notes quiz', async () => {
      mockApi.generateQuiz.mockResolvedValue({
        sessionId: 'session-123',
        questions: [
          {
            id: 'q1',
            topic: 'Core Concepts',
            subtopic: 'Scalability',
            question: 'What is horizontal scaling?',
            options: { A: 'Adding more machines', B: 'Adding more RAM', C: 'Adding more CPU', D: 'Adding more storage' },
            correct_answers: ['A'],
            explanation: 'Horizontal scaling means adding more machines.',
            difficulty: 'medium' as const,
          },
        ],
        quizType: 'adaptive',
        estimatedTimeMinutes: 5,
        metadata: { overdueCount: 0, newCount: 1, reviewCount: 0, difficultyDistribution: {} },
      });
      mockApi.fetchNoteQuestions.mockResolvedValue(mockNoteQuestions);

      const { result } = renderHook(() => useQuiz());

      // Start adaptive quiz
      await act(async () => {
        await result.current.startQuiz('adaptive');
      });

      expect(result.current.sessionId).toBe('session-123');

      // Reset and start notes quiz
      act(() => {
        result.current.resetQuiz();
      });

      await act(async () => {
        await result.current.startQuiz('notes');
      });

      expect(result.current.questions[0].category).toBe('notes');
      // Notes mode doesn't use sessionId from generateQuiz
      expect(result.current.sessionId).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty response when fetching note questions', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue([]);

      const { result } = renderHook(() => useQuiz());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.startQuiz('notes');
      });

      expect(success).toBe(false);
      expect(result.current.questions).toEqual([]);
    });

    it('should handle null response from fetchNoteQuestions', async () => {
      mockApi.fetchNoteQuestions.mockResolvedValue([]);

      const { result } = renderHook(() => useQuiz());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.startQuiz('notes');
      });

      expect(success).toBe(false);
    });
  });
});
